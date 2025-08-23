#!/usr/bin/env python3
"""
WebSocket collaboration example for TMI Python SDK.

This example demonstrates:
- Connecting to a diagram collaboration session
- Sending and receiving real-time updates
- Handling cursor movements and user events
"""

import os
import time
import json
from tmi_client import TMIClient, CollaborationWebSocket


class CollaborationDemo:
    def __init__(self, server_url: str, token: str):
        self.client = TMIClient(server_url, token)
        self.ws = None
        self.connected = False
        
    def setup_event_handlers(self):
        """Set up event handlers for WebSocket events."""
        self.ws.on('connected', self.on_connected)
        self.ws.on('disconnected', self.on_disconnected)
        self.ws.on('diagram_update', self.on_diagram_update)
        self.ws.on('cursor_move', self.on_cursor_move)
        self.ws.on('user_join', self.on_user_join)
        self.ws.on('user_leave', self.on_user_leave)
        self.ws.on('error', self.on_error)
    
    def on_connected(self, data):
        """Handle WebSocket connection."""
        print("✓ Connected to collaboration session")
        self.connected = True
    
    def on_disconnected(self, data):
        """Handle WebSocket disconnection."""
        print(f"❌ Disconnected from collaboration session: {data}")
        self.connected = False
    
    def on_diagram_update(self, data):
        """Handle diagram updates from other users."""
        print(f"📊 Diagram update received: {json.dumps(data, indent=2)}")
    
    def on_cursor_move(self, data):
        """Handle cursor movements from other users."""
        user_id = data.get('user_id', 'unknown')
        x, y = data.get('x', 0), data.get('y', 0)
        print(f"👆 User {user_id} moved cursor to ({x}, {y})")
    
    def on_user_join(self, data):
        """Handle user joining the session."""
        user_id = data.get('user_id', 'unknown')
        print(f"👋 User {user_id} joined the collaboration session")
    
    def on_user_leave(self, data):
        """Handle user leaving the session."""
        user_id = data.get('user_id', 'unknown')
        print(f"👋 User {user_id} left the collaboration session")
    
    def on_error(self, data):
        """Handle WebSocket errors."""
        error = data.get('error', 'Unknown error')
        print(f"❌ WebSocket error: {error}")
    
    def demo_collaboration(self, threat_model_id: str, diagram_id: str):
        """Run the collaboration demo."""
        print(f"Starting collaboration demo for diagram {diagram_id}")
        
        # Initialize WebSocket
        self.ws = CollaborationWebSocket(self.client.base_url, self.client.token)
        self.setup_event_handlers()
        
        try:
            # Start collaboration session via API
            print("Starting collaboration session via API...")
            collab_data = self.client.start_collaboration(threat_model_id, diagram_id)
            print(f"✓ Collaboration session started: {collab_data}")
            
            # Connect via WebSocket
            print("Connecting via WebSocket...")
            self.ws.connect(threat_model_id, diagram_id)
            
            # Wait for connection
            timeout = 10
            while not self.connected and timeout > 0:
                time.sleep(0.5)
                timeout -= 0.5
            
            if not self.connected:
                print("❌ Failed to connect to WebSocket")
                return
            
            # Simulate some diagram updates
            print("\n--- Sending Diagram Updates ---")
            
            # Add a new node
            update1 = {
                "operation": "add_node",
                "node": {
                    "id": "api_gateway",
                    "type": "process",
                    "name": "API Gateway",
                    "x": 150,
                    "y": 100
                }
            }
            self.ws.send_diagram_update(update1)
            print("📤 Sent: Add API Gateway node")
            time.sleep(1)
            
            # Add a connection
            update2 = {
                "operation": "add_edge",
                "edge": {
                    "id": "user_to_gateway",
                    "from": "user",
                    "to": "api_gateway",
                    "label": "HTTPS Requests"
                }
            }
            self.ws.send_diagram_update(update2)
            print("📤 Sent: Add connection from user to API Gateway")
            time.sleep(1)
            
            # Simulate cursor movements
            print("\n--- Simulating Cursor Movements ---")
            user_id = "demo_user_123"
            positions = [(50, 50), (100, 75), (150, 100), (200, 125)]
            
            for x, y in positions:
                self.ws.send_cursor_position(x, y, user_id)
                print(f"📤 Sent cursor position: ({x}, {y})")
                time.sleep(0.5)
            
            # Update node properties
            print("\n--- Updating Node Properties ---")
            update3 = {
                "operation": "update_node",
                "node_id": "api_gateway",
                "properties": {
                    "name": "Enhanced API Gateway",
                    "description": "Gateway with rate limiting and authentication"
                }
            }
            self.ws.send_diagram_update(update3)
            print("📤 Sent: Updated API Gateway properties")
            
            # Listen for responses
            print("\n--- Listening for responses (10 seconds) ---")
            print("(Simulate other users making changes in another client)")
            time.sleep(10)
            
        except Exception as e:
            print(f"❌ Error during collaboration demo: {e}")
        
        finally:
            # Clean up
            print("\n--- Cleaning Up ---")
            if self.ws:
                self.ws.disconnect()
            
            try:
                self.client.end_collaboration(threat_model_id, diagram_id)
                print("✓ Ended collaboration session")
            except Exception as e:
                print(f"Warning: Could not end collaboration session: {e}")


def main():
    # Get configuration from environment
    server_url = os.getenv("TMI_SERVER_URL", "http://localhost:8080")
    token = os.getenv("TMI_TOKEN")
    threat_model_id = os.getenv("TMI_THREAT_MODEL_ID")
    diagram_id = os.getenv("TMI_DIAGRAM_ID")
    
    if not token:
        print("❌ TMI_TOKEN environment variable is required")
        return 1
    
    if not threat_model_id:
        print("❌ TMI_THREAT_MODEL_ID environment variable is required")
        print("Run basic_usage.py first to create a threat model and get its ID")
        return 1
    
    if not diagram_id:
        print("❌ TMI_DIAGRAM_ID environment variable is required")
        print("Run basic_usage.py first to create a diagram and get its ID")
        return 1
    
    print(f"TMI WebSocket Collaboration Demo")
    print(f"Server: {server_url}")
    print(f"Threat Model ID: {threat_model_id}")
    print(f"Diagram ID: {diagram_id}")
    print()
    
    demo = CollaborationDemo(server_url, token)
    demo.demo_collaboration(threat_model_id, diagram_id)
    
    return 0


if __name__ == "__main__":
    exit(main())