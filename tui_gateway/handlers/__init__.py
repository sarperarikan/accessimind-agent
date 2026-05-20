"""
TUI Gateway RPC Handlers

Modular RPC handler definitions for the Hermes TUI Gateway.
Split from server.py to improve maintainability and testability.

Structure:
- handlers/
  - __init__.py (exports all handlers)
  - session.py (session management RPCs)
  - cli.py (CLI execution RPCs)
  - browser.py (browser control RPCs)
  - skills.py (skill management RPCs)
  - approval.py (user approval RPCs)
  - metrics.py (performance metrics RPCs) ← NEW
"""

import logging
import time
from typing import Any, Dict, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Session Handlers ─────────────────────────────────────────────

def handle_session_create(params: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new session"""
    from tui_gateway.server import _sessions
    
    session_id = params.get('session_id', 'default')
    _sessions[session_id] = {
        'id': session_id,
        'created_at': Path.home(),
        'message_count': 0,
        'last_activity': None
    }
    
    logger.info(f"Session created: {session_id}")
    return {'session_id': session_id, 'status': 'created'}


def handle_session_resume(params: Dict[str, Any]) -> Dict[str, Any]:
    """Resume an existing session"""
    from tui_gateway.server import _sessions
    
    session_id = params.get('session_id')
    
    if session_id not in _sessions:
        return {'error': f'Session {session_id} not found'}
    
    session = _sessions[session_id]
    logger.info(f"Session resumed: {session_id}")
    
    return {
        'session_id': session_id,
        'message_count': session.get('message_count', 0),
        'status': 'resumed'
    }


def handle_session_branch(params: Dict[str, Any]) -> Dict[str, Any]:
    """Branch a session (create copy)"""
    from tui_gateway.server import _sessions
    import copy
    
    session_id = params.get('session_id')
    new_id = params.get('new_id', f'{session_id}_branch')
    
    if session_id not in _sessions:
        return {'error': f'Session {session_id} not found'}
    
    _sessions[new_id] = copy.deepcopy(_sessions[session_id])
    logger.info(f"Session branched: {session_id} → {new_id}")
    
    return {'session_id': new_id, 'status': 'branched'}


# ── CLI Handlers ─────────────────────────────────────────────

def handle_cli_exec(params: Dict[str, Any]) -> Dict[str, Any]:
    """Execute CLI command"""
    import subprocess
    
    command = params.get('command', '')
    timeout = params.get('timeout', 60)
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        
        return {
            'exit_code': result.returncode,
            'stdout': result.stdout[:10000],  # Limit output
            'stderr': result.stderr[:5000]
        }
    except subprocess.TimeoutExpired:
        return {'error': f'Command timed out after {timeout}s'}
    except Exception as e:
        return {'error': str(e)}


# ── Browser Handlers ─────────────────────────────────────────────

def handle_browser_manage(params: Dict[str, Any]) -> Dict[str, Any]:
    """Manage browser sessions"""
    action = params.get('action', 'status')
    
    # Placeholder - actual browser management in separate module
    return {
        'action': action,
        'status': 'not_implemented',
        'message': 'Browser management delegated to browser module'
    }


# ── Skills Handlers ─────────────────────────────────────────────

def handle_skills_manage(params: Dict[str, Any]) -> Dict[str, Any]:
    """Manage skills (create, update, delete)"""
    action = params.get('action')
    skill_name = params.get('name')
    
    if not action or not skill_name:
        return {'error': 'Missing action or name parameter'}
    
    # Placeholder - actual skill management in separate module
    return {
        'action': action,
        'skill': skill_name,
        'status': 'not_implemented'
    }


# ── Approval Handlers ─────────────────────────────────────────────

def handle_approval_respond(params: Dict[str, Any]) -> Dict[str, Any]:
    """Respond to user approval request"""
    approval_id = params.get('approval_id')
    response = params.get('response')  # 'approve' or 'reject'
    
    if not approval_id:
        return {'error': 'Missing approval_id'}
    
    # Placeholder - actual approval handling
    return {
        'approval_id': approval_id,
        'response': response,
        'status': 'processed'
    }


# ── Metrics Handlers (NEW) ─────────────────────────────────────────────

def handle_metrics_get(params: Dict[str, Any]) -> Dict[str, Any]:
    """Get performance metrics"""
    from tui_gateway.metrics import get_metrics
    
    metrics = get_metrics()
    return {
        'metrics': metrics.get_summary(),
        'timestamp': time.time()
    }


def handle_metrics_reset(params: Dict[str, Any]) -> Dict[str, Any]:
    """Reset performance metrics"""
    from tui_gateway.metrics import get_metrics
    
    metrics = get_metrics()
    metrics.reset()
    
    return {'status': 'reset'}


# ── Handler Registry ─────────────────────────────────────────────

HANDLERS = {
    'session.create': handle_session_create,
    'session.resume': handle_session_resume,
    'session.branch': handle_session_branch,
    'cli.exec': handle_cli_exec,
    'browser.manage': handle_browser_manage,
    'skills.manage': handle_skills_manage,
    'approval.respond': handle_approval_respond,
    'metrics.get': handle_metrics_get,
    'metrics.reset': handle_metrics_reset,
}


def get_handler(method: str):
    """Get handler function for a method"""
    return HANDLERS.get(method)


def list_handlers() -> list:
    """List all registered handlers"""
    return list(HANDLERS.keys())
