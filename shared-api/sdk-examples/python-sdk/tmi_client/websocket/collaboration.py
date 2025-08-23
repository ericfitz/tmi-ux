"""
WebSocket client for real-time diagram collaboration.
"""
import json
import threading
from typing import Dict, Any, Callable, Optional
import websocket
from urllib.parse import urljoin, urlparse


class CollaborationWebSocket:
    """WebSocket client for real-time collaboration on diagrams."""
    
    def __init__(self, base_url: str, token: str):
        """
        Initialize WebSocket client.
        
        Args:
            base_url: Base URL of the TMI API server
            token: JWT token for authentication
        """
        self.base_url = base_url
        self.token = token
        self.ws = None
        self.callbacks = {}
        self.connected = False
        self._thread = None
    
    def connect(self, threat_model_id: str, diagram_id: str) -> None:
        """
        Connect to a diagram collaboration session.
        
        Args:
            threat_model_id: ID of the threat model
            diagram_id: ID of the diagram
        """
        # Convert HTTP(S) URL to WebSocket URL
        parsed = urlparse(self.base_url)
        ws_scheme = 'wss' if parsed.scheme == 'https' else 'ws'
        ws_url = f'{ws_scheme}://{parsed.netloc}/ws/diagrams/{diagram_id}'
        
        # Add authentication token as query parameter or header
        headers = [f'Authorization: Bearer {self.token}']
        
        self.ws = websocket.WebSocketApp(
            ws_url,
            header=headers,
            on_open=self._on_open,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close
        )
        
        # Start WebSocket in a separate thread
        self._thread = threading.Thread(target=self.ws.run_forever)
        self._thread.daemon = True
        self._thread.start()
    
    def disconnect(self) -> None:
        """Disconnect from the collaboration session."""
        if self.ws:
            self.ws.close()
            self.connected = False
    
    def send_message(self, message_type: str, data: Dict[str, Any]) -> None:
        """
        Send a message through the WebSocket.
        
        Args:
            message_type: Type of message (e.g., 'diagram_update', 'cursor_move')
            data: Message data
        """
        if not self.connected:
            raise Exception("WebSocket not connected")
        
        message = {
            'type': message_type,
            'data': data
        }
        
        self.ws.send(json.dumps(message))
    
    def send_diagram_update(self, changes: Dict[str, Any]) -> None:
        """Send diagram update changes."""
        self.send_message('diagram_update', changes)
    
    def send_cursor_position(self, x: float, y: float, user_id: str) -> None:
        """Send cursor position for collaborative editing."""
        self.send_message('cursor_move', {
            'x': x,
            'y': y,
            'user_id': user_id
        })
    
    def on(self, event: str, callback: Callable[[Dict[str, Any]], None]) -> None:
        """
        Register a callback for WebSocket events.
        
        Args:
            event: Event type ('diagram_update', 'cursor_move', 'user_join', 'user_leave', etc.)
            callback: Function to call when event occurs
        """
        if event not in self.callbacks:
            self.callbacks[event] = []
        self.callbacks[event].append(callback)
    
    def off(self, event: str, callback: Optional[Callable] = None) -> None:
        """
        Unregister a callback for WebSocket events.
        
        Args:
            event: Event type
            callback: Specific callback to remove, or None to remove all
        """
        if event in self.callbacks:
            if callback:
                self.callbacks[event].remove(callback)
            else:
                self.callbacks[event] = []
    
    def _on_open(self, ws) -> None:
        """Handle WebSocket connection opened."""
        self.connected = True
        self._trigger_callbacks('connected', {})
    
    def _on_message(self, ws, message: str) -> None:
        """Handle incoming WebSocket message."""
        try:
            data = json.loads(message)
            message_type = data.get('type', 'unknown')
            payload = data.get('data', {})
            
            self._trigger_callbacks(message_type, payload)
            
        except json.JSONDecodeError:
            self._trigger_callbacks('error', {'error': 'Invalid JSON received'})
    
    def _on_error(self, ws, error) -> None:
        """Handle WebSocket error."""
        self.connected = False
        self._trigger_callbacks('error', {'error': str(error)})
    
    def _on_close(self, ws, close_status_code, close_msg) -> None:
        """Handle WebSocket connection closed."""
        self.connected = False
        self._trigger_callbacks('disconnected', {
            'code': close_status_code,
            'message': close_msg
        })
    
    def _trigger_callbacks(self, event: str, data: Dict[str, Any]) -> None:
        """Trigger all callbacks for a specific event."""
        if event in self.callbacks:
            for callback in self.callbacks[event]:
                try:
                    callback(data)
                except Exception as e:
                    # Log error but don't break other callbacks
                    print(f"Callback error for event '{event}': {e}")
    
    def is_connected(self) -> bool:
        """Check if WebSocket is connected."""
        return self.connected