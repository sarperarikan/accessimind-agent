"""
Socket.io Server for Hermes Dashboard

Real-time bidirectional communication for:
- Chat messages
- Tool execution
- Tool output streaming
- Session events
- Status updates

Usage:
    from tui_gateway.socketio_server import SocketioServer
    
    server = SocketioServer(port=9120)
    server.start()
"""

import asyncio
import logging
import threading
import time
from typing import Any, Callable, Dict, Optional
from pathlib import Path

import socketio
from socketio import ASGIApp
import uvicorn

logger = logging.getLogger(__name__)


class SocketioServer:
    """Socket.io server for real-time dashboard communication"""
    
    def __init__(self, host: str = '0.0.0.0', port: int = 9120, cors_origins: list = None):
        self.host = host
        self.port = port
        self.cors_origins = cors_origins if cors_origins else ['*']
        
        # Socket.io server with async mode
        self.sio = socketio.AsyncServer(
            async_mode='asgi',
            cors_allowed_origins=self.cors_origins,
            logger=False,
            engineio_logger=False,
            ping_timeout=60,
            ping_interval=25,
        )
        
        # App instance
        self.app = ASGIApp(self.sio, socketio_path='socket.io')
        
        # Connection state
        self.connected_clients: Dict[str, Dict[str, Any]] = {}
        self.session_clients: Dict[str, set] = {}  # session_id -> set of sid
        
        # Event handlers registry
        self._event_handlers: Dict[str, Callable] = {}
        
        # Setup event handlers
        self._setup_handlers()
        
        # Server instance
        self._server = None
        self._thread = None
        self._running = False
    
    def _setup_handlers(self):
        """Register Socket.io event handlers"""
        
        @self.sio.event
        async def connect(sid, environ):
            logger.info(f'Client connected: {sid}')
            self.connected_clients[sid] = {
                'connected_at': time.time(),
                'session_id': None,
                'user_agent': environ.get('HTTP_USER_AGENT', 'unknown')
            }
            await self.sio.emit('connected', {'sid': sid}, room=sid)
        
        @self.sio.event
        async def disconnect(sid):
            logger.info(f'Client disconnected: {sid}')
            client_info = self.connected_clients.pop(sid, {})
            session_id = client_info.get('session_id')
            
            if session_id and sid in self.session_clients.get(session_id, set()):
                self.session_clients[session_id].discard(sid)
            
            # Notify others in session
            if session_id:
                await self._emit_to_session(session_id, 'client_left', {
                    'sid': sid,
                    'timestamp': time.time()
                })
        
        @self.sio.event
        async def join_session(sid, data):
            """Join a session room"""
            session_id = data.get('session_id')
            if not session_id:
                return {'error': 'session_id required'}
            
            await self.sio.enter_room(sid, session_id)
            
            if session_id not in self.session_clients:
                self.session_clients[session_id] = set()
            self.session_clients[session_id].add(sid)
            
            if sid in self.connected_clients:
                self.connected_clients[sid]['session_id'] = session_id
            
            logger.info(f'Client {sid} joined session {session_id}')
            
            return {
                'status': 'joined',
                'session_id': session_id,
                'clients_count': len(self.session_clients[session_id])
            }
        
        @self.sio.event
        async def leave_session(sid, data):
            """Leave a session room"""
            session_id = data.get('session_id')
            if session_id:
                await self.sio.leave_room(sid, session_id)
                if session_id in self.session_clients:
                    self.session_clients[session_id].discard(sid)
                
                if sid in self.connected_clients:
                    self.connected_clients[sid]['session_id'] = None
                
                logger.info(f'Client {sid} left session {session_id}')
            
            return {'status': 'left'}
        
        # Chat message handler
        @self.sio.on('chat_message')
        async def handle_chat_message(sid, data):
            """Handle incoming chat message"""
            session_id = data.get('session_id')
            message = data.get('message')
            
            if not message:
                return {'error': 'message required'}
            
            # Store message timestamp
            event_data = {
                'sid': sid,
                'message': message,
                'session_id': session_id,
                'timestamp': time.time()
            }
            
            # Emit to all in session
            if session_id:
                await self._emit_to_session(session_id, 'chat_message', event_data)
            else:
                await self.sio.emit('chat_message', event_data, room=sid)
            
            # Trigger backend processing (if handler registered)
            if 'chat_message' in self._event_handlers:
                try:
                    result = await self._event_handlers['chat_message'](sid, event_data)
                    return {'status': 'processed', 'result': result}
                except Exception as e:
                    logger.error(f'Chat handler error: {e}')
                    return {'error': str(e)}
            
            return {'status': 'sent'}
        
        # Tool execution handler
        @self.sio.on('tool_execute')
        async def handle_tool_execute(sid, data):
            """Handle tool execution request"""
            tool_name = data.get('tool')
            params = data.get('params', {})
            session_id = data.get('session_id')
            
            if not tool_name:
                return {'error': 'tool name required'}
            
            event_data = {
                'sid': sid,
                'tool': tool_name,
                'params': params,
                'session_id': session_id,
                'timestamp': time.time(),
                'status': 'started'
            }
            
            # Emit start event
            if session_id:
                await self._emit_to_session(session_id, 'tool_start', event_data)
            else:
                await self.sio.emit('tool_start', event_data, room=sid)
            
            # Execute tool (if handler registered)
            if 'tool_execute' in self._event_handlers:
                try:
                    result = await self._event_handlers['tool_execute'](sid, tool_name, params)
                    
                    # Emit completion
                    completion_data = {
                        **event_data,
                        'status': 'completed',
                        'result': result,
                        'completed_at': time.time()
                    }
                    
                    if session_id:
                        await self._emit_to_session(session_id, 'tool_complete', completion_data)
                    else:
                        await self.sio.emit('tool_complete', completion_data, room=sid)
                    
                    return {'status': 'executed', 'result': result}
                except Exception as e:
                    error_data = {
                        **event_data,
                        'status': 'error',
                        'error': str(e),
                        'completed_at': time.time()
                    }
                    
                    if session_id:
                        await self._emit_to_session(session_id, 'tool_error', error_data)
                    else:
                        await self.sio.emit('tool_error', error_data, room=sid)
                    
                    logger.error(f'Tool execution error: {e}')
                    return {'error': str(e)}
            
            return {'status': 'queued'}
        
        # Tool output streaming handler
        @self.sio.on('tool_output')
        async def handle_tool_output(sid, data):
            """Handle streaming tool output"""
            session_id = data.get('session_id')
            output = data.get('output')
            tool_call_id = data.get('tool_call_id')
            
            if not output:
                return
            
            event_data = {
                'sid': sid,
                'tool_call_id': tool_call_id,
                'output': output,
                'session_id': session_id,
                'timestamp': time.time()
            }
            
            if session_id:
                await self._emit_to_session(session_id, 'tool_output', event_data)
            else:
                await self.sio.emit('tool_output', event_data, room=sid)
        
        # Status request handler
        @self.sio.on('get_status')
        async def handle_get_status(sid, data):
            """Get server status"""
            return {
                'connected_clients': len(self.connected_clients),
                'active_sessions': len(self.session_clients),
                'uptime': time.time() - getattr(self, '_started_at', time.time()),
                'server': 'socketio',
                'version': '1.0.0'
            }
    
    async def _emit_to_session(self, session_id: str, event: str, data: dict):
        """Emit event to all clients in a session"""
        await self.sio.emit(event, data, room=session_id)
    
    def register_handler(self, event: str, handler: Callable):
        """Register custom event handler"""
        self._event_handlers[event] = handler
        logger.info(f'Registered handler for: {event}')
    
    def start(self, blocking: bool = True):
        """Start the Socket.io server"""
        self._started_at = time.time()
        self._running = True
        
        config = uvicorn.Config(
            self.app,
            host=self.host,
            port=self.port,
            log_level='info',
            access_log=False
        )
        self._server = uvicorn.Server(config)
        
        if blocking:
            logger.info(f'Starting Socket.io server on {self.host}:{self.port}')
            self._server.run()
        else:
            self._thread = threading.Thread(target=self._server.run, daemon=True)
            self._thread.start()
            logger.info(f'Socket.io server started on {self.host}:{self.port} (background)')
    
    def stop(self):
        """Stop the server"""
        self._running = False
        if self._server:
            self._server.should_exit = True
        if self._thread:
            self._thread.join(timeout=5)
        logger.info('Socket.io server stopped')
    
    @property
    def is_running(self) -> bool:
        return self._running


# Global server instance
_socketio_server: Optional[SocketioServer] = None


def get_server() -> Optional[SocketioServer]:
    """Get the global Socket.io server instance"""
    return _socketio_server


def create_server(host: str = '0.0.0.0', port: int = 9120) -> SocketioServer:
    """Create and return a new Socket.io server"""
    global _socketio_server
    _socketio_server = SocketioServer(host=host, port=port)
    return _socketio_server


def start_server(host: str = '0.0.0.0', port: int = 9120, blocking: bool = False) -> SocketioServer:
    """Create and start a Socket.io server"""
    server = create_server(host=host, port=port)
    server.start(blocking=blocking)
    return server


if __name__ == '__main__':
    # Test server
    logging.basicConfig(level=logging.INFO)
    
    server = SocketioServer(host='0.0.0.0', port=9120)
    
    # Register test handler
    async def on_chat(sid, data):
        print(f'Chat from {sid}: {data["message"]}')
        return {'echo': data['message']}
    
    server.register_handler('chat_message', on_chat)
    
    print('Starting Socket.io server on http://0.0.0.0:9120')
    server.start(blocking=True)
