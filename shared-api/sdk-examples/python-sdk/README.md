# TMI Python SDK

A Python client library for the Collaborative Threat Modeling Interface (TMI) API.

## Features

- **Complete API Coverage**: Support for all TMI API endpoints including threat models, diagrams, threats, documents, and sources
- **Authentication**: OAuth flow support with multiple providers and JWT token management
- **Real-time Collaboration**: WebSocket client for real-time diagram collaboration
- **Type Safety**: Fully typed with dataclasses for all API models
- **Bulk Operations**: Efficient batch operations for managing multiple entities
- **Metadata Management**: Full support for entity metadata operations

## Installation

```bash
pip install tmi-client
```

For development:
```bash
pip install tmi-client[dev]
```

## Quick Start

### Basic Client Setup

```python
from tmi_client import TMIClient

# Initialize client
client = TMIClient("https://your-tmi-server.com")

# Authenticate with OAuth (opens browser)
auth_url = client.auth_handler.start_oauth_flow("google")
# After completing OAuth flow, token will be automatically set

# Or set token directly if you have one
client.set_token("your-jwt-token")
```

### Working with Threat Models

```python
from tmi_client.models import ThreatModel

# List all threat models
threat_models = client.list_threat_models()

# Create a new threat model
new_tm = ThreatModel(
    name="Web Application Security Model",
    description="Threat model for our web application",
    version="1.0"
)
created_tm = client.create_threat_model(new_tm)

# Get a specific threat model
tm = client.get_threat_model(created_tm.id)

# Update threat model
tm.description = "Updated description"
updated_tm = client.update_threat_model(tm.id, tm)
```

### Managing Diagrams

```python
from tmi_client.models import Diagram

# List diagrams for a threat model
diagrams = client.list_diagrams(threat_model_id)

# Create a new diagram
new_diagram = Diagram(
    threat_model_id=threat_model_id,
    name="System Architecture",
    description="High-level system diagram",
    diagram_type="data_flow"
)
created_diagram = client.create_diagram(threat_model_id, new_diagram)

# Update diagram content
diagram_content = {
    "nodes": [
        {"id": "web_server", "type": "process", "name": "Web Server"},
        {"id": "database", "type": "datastore", "name": "Database"}
    ],
    "edges": [
        {"from": "web_server", "to": "database", "label": "SQL queries"}
    ]
}
created_diagram.content = diagram_content
client.update_diagram(threat_model_id, created_diagram.id, created_diagram)
```

### Working with Threats

```python
from tmi_client.models import Threat

# List all threats for a threat model
threats = client.list_threats(threat_model_id)

# Create a new threat
new_threat = Threat(
    threat_model_id=threat_model_id,
    title="SQL Injection",
    description="Attacker can inject malicious SQL code",
    category="Input Validation",
    severity="High",
    likelihood="Medium",
    impact="High",
    status="Open"
)
created_threat = client.create_threat(threat_model_id, new_threat)

# Bulk create multiple threats
threats_to_create = [
    Threat(threat_model_id=threat_model_id, title="XSS", severity="Medium"),
    Threat(threat_model_id=threat_model_id, title="CSRF", severity="Medium")
]
bulk_threats = client.create_threats_bulk(threat_model_id, threats_to_create)
```

### Real-time Collaboration

```python
from tmi_client.websocket import CollaborationWebSocket

# Set up WebSocket for real-time collaboration
ws = CollaborationWebSocket("https://your-tmi-server.com", client.token)

# Define event handlers
def on_diagram_update(data):
    print(f"Diagram updated: {data}")

def on_cursor_move(data):
    print(f"User cursor moved: {data}")

def on_user_join(data):
    print(f"User joined: {data}")

# Register event handlers
ws.on('diagram_update', on_diagram_update)
ws.on('cursor_move', on_cursor_move)
ws.on('user_join', on_user_join)

# Connect to a specific diagram
ws.connect(threat_model_id, diagram_id)

# Send diagram updates
changes = {
    "operation": "add_node",
    "node": {"id": "new_node", "type": "process", "name": "New Process"}
}
ws.send_diagram_update(changes)

# Send cursor position
ws.send_cursor_position(100, 200, "user123")

# Disconnect when done
ws.disconnect()
```

### Authentication Examples

#### OAuth Flow
```python
# Get available providers
providers = client.get_auth_providers()

# Start OAuth flow (opens browser)
auth_url = client.auth_handler.start_oauth_flow("google")

# Handle callback (typically in a web server)
token_data = client.auth_handler.handle_callback(callback_url)

# Token is automatically set in the client
user_info = client.get_current_user()
```

#### Direct Login (for test environments)
```python
# Login with credentials (test provider)
token_data = client.auth_handler.login_with_credentials(
    "test", 
    "test@example.com", 
    "password"
)
```

### Metadata Management

```python
# Add metadata to any entity
metadata_path = f"/threat_models/{threat_model_id}"
client.create_metadata_entry(metadata_path, "project_code", "PROJ-123")
client.create_metadata_entry(metadata_path, "priority", "high")

# Get all metadata
metadata = client.get_metadata(metadata_path)

# Update metadata entry
client.update_metadata_entry(metadata_path, "priority", "critical")

# Bulk update metadata
bulk_metadata = {
    "owner": "security-team",
    "last_review": "2024-01-15",
    "next_review": "2024-04-15"
}
client.update_metadata_bulk(metadata_path, bulk_metadata)

# Delete metadata entry
client.delete_metadata_entry(metadata_path, "project_code")
```

### Error Handling

```python
import requests
from tmi_client import TMIClient

client = TMIClient("https://your-tmi-server.com", "your-token")

try:
    threat_model = client.get_threat_model("non-existent-id")
except requests.HTTPError as e:
    if e.response.status_code == 404:
        print("Threat model not found")
    elif e.response.status_code == 403:
        print("Access denied")
    else:
        print(f"API error: {e}")
```

## API Reference

### TMIClient

Main client class for interacting with the TMI API.

**Methods:**
- `list_threat_models(limit=None, offset=None)` - List threat models
- `get_threat_model(id)` - Get specific threat model
- `create_threat_model(threat_model)` - Create new threat model
- `update_threat_model(id, threat_model)` - Update threat model
- `patch_threat_model(id, patches)` - Apply JSON patches
- `delete_threat_model(id)` - Delete threat model

Similar methods exist for diagrams, threats, documents, and sources.

### Data Models

All models inherit from `BaseModel` and support:
- `from_dict(data)` - Create instance from dictionary
- `to_dict()` - Convert to dictionary
- Automatic timestamp parsing
- Metadata field support

**Available Models:**
- `ThreatModel` - Represents a threat model
- `Diagram` - Represents a diagram
- `Threat` - Represents a threat
- `Document` - Represents a document  
- `Source` - Represents a source

### WebSocket Client

`CollaborationWebSocket` provides real-time collaboration features:
- `connect(threat_model_id, diagram_id)` - Connect to collaboration session
- `send_diagram_update(changes)` - Send diagram changes
- `send_cursor_position(x, y, user_id)` - Send cursor position
- `on(event, callback)` - Register event handler
- `disconnect()` - Close connection

## Development

```bash
# Clone the repository
git clone https://github.com/your-org/tmi-python-sdk.git
cd tmi-python-sdk

# Install in development mode
pip install -e .[dev]

# Run tests
pytest

# Format code
black .
isort .

# Type checking
mypy tmi_client
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.