/**
 * Socket.io Client for Hermes Dashboard
 * 
 * Replaces WebSocket with Socket.io for:
 * - Auto-reconnect
 * - Room-based sessions
 * - Better event handling
 * - Tool streaming support
 * 
 * Usage:
 *   import { socketClient } from './socketioClient.js'
 *   socketClient.connect()
 */

import { io, Socket } from 'socket.io-client'

export interface SocketMessage {
  message: string
  session_id?: string
  timestamp?: number
}

export interface ToolExecuteParams {
  tool: string
  params: Record<string, any>
  session_id?: string
  tool_call_id?: string
}

export interface SocketClientConfig {
  url: string
  session_id?: string
  autoConnect?: boolean
  reconnect?: boolean
  reconnectDelay?: number
  reconnectAttempts?: number
}

class SocketioClient {
  private socket: Socket | null = null
  private config: SocketClientConfig
  private connected = false
  private sessionId: string | null = null
  private eventHandlers: Map<string, Set<Function>> = new Map()

  constructor(config: Partial<SocketClientConfig> = {}) {
    this.config = {
      url: config.url || `http://${window.location.hostname}:9120`,
      session_id: config.session_id,
      autoConnect: config.autoConnect !== false,
      reconnect: config.reconnect !== false,
      reconnectDelay: config.reconnectDelay || 1000,
      reconnectAttempts: config.reconnectAttempts || 5,
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.config.url, {
          transports: ['websocket', 'polling'],
          reconnection: this.config.reconnect,
          reconnectionDelay: this.config.reconnectDelay,
          reconnectionAttempts: this.config.reconnectAttempts,
          timeout: 20000,
        })

        this.socket.on('connect', () => {
          this.connected = true
          console.log('[Socket.io] Connected:', this.socket?.id)
          
          // Join session if provided
          if (this.config.session_id) {
            this.joinSession(this.config.session_id)
          }
          
          resolve()
        })

        this.socket.on('disconnect', (reason) => {
          this.connected = false
          console.log('[Socket.io] Disconnected:', reason)
        })

        this.socket.on('connect_error', (error) => {
          console.error('[Socket.io] Connection error:', error)
          reject(error)
        })

        // Setup default event handlers
        this.setupDefaultHandlers()
      } catch (error) {
        reject(error)
      }
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
    }
  }

  private setupDefaultHandlers() {
    if (!this.socket) return

    // Connected event
    this.socket.on('connected', (data) => {
      console.log('[Socket.io] Server assigned SID:', data.sid)
    })

    // Chat message event
    this.socket.on('chat_message', (data) => {
      this.emit('chat_message', data)
    })

    // Tool events
    this.socket.on('tool_start', (data) => {
      this.emit('tool_start', data)
    })

    this.socket.on('tool_output', (data) => {
      this.emit('tool_output', data)
    })

    this.socket.on('tool_complete', (data) => {
      this.emit('tool_complete', data)
    })

    this.socket.on('tool_error', (data) => {
      this.emit('tool_error', data)
    })

    // Session events
    this.socket.on('client_left', (data) => {
      this.emit('client_left', data)
    })
  }

  on(event: string, callback: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(callback)
  }

  off(event: string, callback: Function) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(callback)
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(data))
    }
  }

  async joinSession(sessionId: string): Promise<any> {
    if (!this.socket) {
      throw new Error('Not connected')
    }
    
    this.sessionId = sessionId
    return new Promise((resolve, reject) => {
      this.socket!.emit('join_session', { session_id: sessionId }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          console.log(`[Socket.io] Joined session: ${sessionId} (${response.clients_count} clients)`)
          resolve(response)
        }
      })
    })
  }

  async leaveSession(sessionId?: string): Promise<any> {
    if (!this.socket) return
    
    const sid = sessionId || this.sessionId
    if (!sid) return
    
    return new Promise((resolve) => {
      this.socket!.emit('leave_session', { session_id: sid }, (response: any) => {
        this.sessionId = null
        resolve(response)
      })
    })
  }

  async sendMessage(message: string, sessionId?: string): Promise<any> {
    if (!this.socket) {
      throw new Error('Not connected')
    }
    
    return new Promise((resolve, reject) => {
      this.socket!.emit('chat_message', {
        message,
        session_id: sessionId || this.sessionId,
      }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response)
        }
      })
    })
  }

  async executeTool(toolName: string, params: Record<string, any>, sessionId?: string): Promise<any> {
    if (!this.socket) {
      throw new Error('Not connected')
    }
    
    return new Promise((resolve, reject) => {
      this.socket!.emit('tool_execute', {
        tool: toolName,
        params,
        session_id: sessionId || this.sessionId,
      }, (response: any) => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response)
        }
      })
    })
  }

  async sendToolOutput(output: string, toolCallId: string, sessionId?: string) {
    if (!this.socket) return
    
    this.socket.emit('tool_output', {
      output,
      tool_call_id: toolCallId,
      session_id: sessionId || this.sessionId,
    })
  }

  async getStatus(): Promise<any> {
    if (!this.socket) {
      throw new Error('Not connected')
    }
    
    return new Promise((resolve, reject) => {
      this.socket!.emit('get_status', {}, (response: any) => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response)
        }
      })
    })
  }

  isConnected(): boolean {
    return this.connected && this.socket !== null
  }

  getSessionId(): string | null {
    return this.sessionId
  }
}

// Singleton instance
let _socketClient: SocketioClient | null = null

export function getSocketClient(config?: Partial<SocketClientConfig>): SocketioClient {
  if (!_socketClient) {
    _socketClient = new SocketioClient(config)
  }
  return _socketClient
}

export const socketClient = getSocketClient()
