"""
TMI Python SDK - A Python client for the Collaborative Threat Modeling Interface API.

This SDK provides a Python interface to the TMI API, supporting:
- Authentication with OAuth providers and JWT tokens
- CRUD operations for threat models, diagrams, threats, documents, and sources  
- Real-time collaboration via WebSocket connections
- Metadata management for all entities
- Batch operations for efficient data handling
"""

from .client import TMIClient
from .auth.oauth import OAuthHandler
from .websocket.collaboration import CollaborationWebSocket

__version__ = "0.1.0"
__all__ = ["TMIClient", "OAuthHandler", "CollaborationWebSocket"]