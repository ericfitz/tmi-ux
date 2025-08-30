# TMI Threat Modeling Improved API

This document describes a RESTful API with WebSocket support for threat modeling with collaborative diagram editing. The API uses JSON payloads, OAuth for authentication, JWTs for session management, and UUIDs for unique identification. Diagrams are managed as sub-resources of threat models and support collaborative editing, while threat models provide a structured way to document threats, documents, and source code references.

## Overview

- **Base URL**: `https://api.example.com`
- **Authentication**: OAuth 2.0 with JWTs.
- **Real-Time**: WebSocket for collaborative diagram editing within threat models.
- **Format**: OpenAPI 3.0.3.

## Endpoints

### API Information

- `**GET /**`: Returns service, API, and operator information without authentication.
- `**GET /api/server-info**`: Returns server configuration information (TLS status, WebSocket base URL).

### Authentication

- `**GET /auth/providers**`: Lists available OAuth providers.
- `**GET /auth/login/{provider}**`: Redirects to OAuth provider for login.
- `**GET /auth/callback**`: Handles OAuth callback from provider.
- `**POST /auth/token/{provider}**`: Exchanges authorization code for JWT tokens.
- `**POST /auth/refresh**`: Refreshes access token using refresh token.
- `**POST /auth/logout**`: Invalidates JWT and ends session.
- `**GET /auth/me**`: Returns current authenticated user information.

### Threat Model Management

- `**GET /threat_models**`: Lists threat models accessible to the user as name-ID pairs (supports pagination and sorting).
- `**POST /threat_models**`: Creates a new threat model (owner set to creator).
- `**GET /threat_models/{threat_model_id}**`: Retrieves a threat model's full details.
- `**PUT /threat_models/{threat_model_id}**`: Fully updates a threat model.
- `**PATCH /threat_models/{threat_model_id}**`: Partially updates a threat model (JSON Patch).
- `**DELETE /threat_models/{threat_model_id}**`: Deletes a threat model (owner-only).

### Diagram Management

- `**GET /threat_models/{threat_model_id}/diagrams**`: Lists diagrams associated with a threat model.
- `**POST /threat_models/{threat_model_id}/diagrams**`: Creates a new diagram within a threat model.
- `**GET /threat_models/{threat_model_id}/diagrams/{diagram_id}**`: Retrieves a diagram's full details.
- `**PUT /threat_models/{threat_model_id}/diagrams/{diagram_id}**`: Fully updates a diagram.
- `**PATCH /threat_models/{threat_model_id}/diagrams/{diagram_id}**`: Partially updates a diagram (JSON Patch).
- `**DELETE /threat_models/{threat_model_id}/diagrams/{diagram_id}**`: Deletes a diagram (owner-only).

### Diagram Collaboration

- `**GET /threat_models/{threat_model_id}/diagrams/{diagram_id}/collaborate**`: Gets collaboration session status.
- `**POST /threat_models/{threat_model_id}/diagrams/{diagram_id}/collaborate**`: Joins or starts a session.
- `**DELETE /threat_models/{threat_model_id}/diagrams/{diagram_id}/collaborate**`: Leaves a session.
- `**GET /collaboration/sessions**`: Lists all active collaboration sessions accessible to the user.
- **WebSocket**: `/threat_models/{threat_model_id}/diagrams/{diagram_id}/ws` for real-time updates.

### Threat Sub-Resources

- `**GET /threat_models/{threat_model_id}/threats**`: Lists threats within a threat model (supports pagination).
- `**POST /threat_models/{threat_model_id}/threats**`: Creates a new threat within the threat model.
- `**GET /threat_models/{threat_model_id}/threats/{threat_id}**`: Retrieves a specific threat's details.
- `**PUT /threat_models/{threat_model_id}/threats/{threat_id}**`: Fully updates a threat.
- `**PATCH /threat_models/{threat_model_id}/threats/{threat_id}**`: Partially updates a threat (JSON Patch).
- `**DELETE /threat_models/{threat_model_id}/threats/{threat_id}**`: Deletes a threat.

### Document Sub-Resources

- `**GET /threat_models/{threat_model_id}/documents**`: Lists documents within a threat model (supports pagination).
- `**POST /threat_models/{threat_model_id}/documents**`: Creates a new document within the threat model.
- `**GET /threat_models/{threat_model_id}/documents/{document_id}**`: Retrieves a specific document's details.
- `**PUT /threat_models/{threat_model_id}/documents/{document_id}**`: Fully updates a document.
- `**DELETE /threat_models/{threat_model_id}/documents/{document_id}**`: Deletes a document.

### Source Code Sub-Resources

- `**GET /threat_models/{threat_model_id}/sources**`: Lists source code references within a threat model (supports pagination).
- `**POST /threat_models/{threat_model_id}/sources**`: Creates a new source code reference within the threat model.
- `**GET /threat_models/{threat_model_id}/sources/{source_id}**`: Retrieves a specific source reference's details.
- `**PUT /threat_models/{threat_model_id}/sources/{source_id}**`: Fully updates a source reference.
- `**DELETE /threat_models/{threat_model_id}/sources/{source_id}**`: Deletes a source reference.

### Metadata Management

#### Threat Model Metadata

- `**GET /threat_models/{threat_model_id}/metadata**`: Lists all metadata for a threat model.
- `**POST /threat_models/{threat_model_id}/metadata**`: Creates or updates multiple metadata entries.
- `**GET /threat_models/{threat_model_id}/metadata/{key}**`: Retrieves a specific metadata value.
- `**PUT /threat_models/{threat_model_id}/metadata/{key}**`: Sets a metadata key-value pair.
- `**DELETE /threat_models/{threat_model_id}/metadata/{key}**`: Deletes a metadata entry.

#### Diagram Metadata

- `**GET /threat_models/{threat_model_id}/diagrams/{diagram_id}/metadata**`: Lists all metadata for a diagram within a threat model.
- `**POST /threat_models/{threat_model_id}/diagrams/{diagram_id}/metadata**`: Creates or updates multiple metadata entries.
- `**GET /threat_models/{threat_model_id}/diagrams/{diagram_id}/metadata/{key}**`: Retrieves a specific metadata value.
- `**PUT /threat_models/{threat_model_id}/diagrams/{diagram_id}/metadata/{key}**`: Sets a metadata key-value pair.
- `**DELETE /threat_models/{threat_model_id}/diagrams/{diagram_id}/metadata/{key}**`: Deletes a metadata entry.
- `**POST /threat_models/{threat_model_id}/diagrams/{diagram_id}/metadata/bulk**`: Creates multiple metadata entries in a single operation.

#### Threat Metadata

- `**GET /threat_models/{threat_model_id}/threats/{threat_id}/metadata**`: Lists all metadata for a threat.
- `**POST /threat_models/{threat_model_id}/threats/{threat_id}/metadata**`: Creates or updates multiple metadata entries.
- `**GET /threat_models/{threat_model_id}/threats/{threat_id}/metadata/{key}**`: Retrieves a specific metadata value.
- `**PUT /threat_models/{threat_model_id}/threats/{threat_id}/metadata/{key}**`: Sets a metadata key-value pair.
- `**DELETE /threat_models/{threat_model_id}/threats/{threat_id}/metadata/{key}**`: Deletes a metadata entry.

#### Document Metadata

- `**GET /threat_models/{threat_model_id}/documents/{document_id}/metadata**`: Lists all metadata for a document.
- `**POST /threat_models/{threat_model_id}/documents/{document_id}/metadata**`: Creates or updates multiple metadata entries.
- `**GET /threat_models/{threat_model_id}/documents/{document_id}/metadata/{key}**`: Retrieves a specific metadata value.
- `**PUT /threat_models/{threat_model_id}/documents/{document_id}/metadata/{key}**`: Sets a metadata key-value pair.
- `**DELETE /threat_models/{threat_model_id}/documents/{document_id}/metadata/{key}**`: Deletes a metadata entry.

#### Source Metadata

- `**GET /threat_models/{threat_model_id}/sources/{source_id}/metadata**`: Lists all metadata for a source reference.
- `**POST /threat_models/{threat_model_id}/sources/{source_id}/metadata**`: Creates or updates multiple metadata entries.
- `**GET /threat_models/{threat_model_id}/sources/{source_id}/metadata/{key}**`: Retrieves a specific metadata value.
- `**PUT /threat_models/{threat_model_id}/sources/{source_id}/metadata/{key}**`: Sets a metadata key-value pair.
- `**DELETE /threat_models/{threat_model_id}/sources/{source_id}/metadata/{key}**`: Deletes a metadata entry.


### Bulk and Batch Operations

#### Threat Bulk Operations

- `**POST /threat_models/{threat_model_id}/threats/bulk**`: Creates multiple threats in a single request.
- `**PUT /threat_models/{threat_model_id}/threats/bulk**`: Updates multiple threats in a single request.

#### Threat Batch Operations

- `**POST /threat_models/{threat_model_id}/threats/batch/patch**`: Applies JSON Patch operations to multiple threats.
- `**DELETE /threat_models/{threat_model_id}/threats/batch**`: Deletes multiple threats by ID.

#### Document and Source Bulk Operations

- `**POST /threat_models/{threat_model_id}/documents/bulk**`: Creates multiple documents in a single request.
- `**POST /threat_models/{threat_model_id}/sources/bulk**`: Creates multiple source references in a single request.


#### Metadata Bulk Operations

- `**POST /threat_models/{threat_model_id}/metadata/bulk**`: Creates multiple threat model metadata entries.
- `**POST /threat_models/{threat_model_id}/threats/{threat_id}/metadata/bulk**`: Creates multiple threat metadata entries.
- `**POST /threat_models/{threat_model_id}/documents/{document_id}/metadata/bulk**`: Creates multiple document metadata entries.
- `**POST /threat_models/{threat_model_id}/sources/{source_id}/metadata/bulk**`: Creates multiple source metadata entries.
- `**POST /threat_models/{threat_model_id}/diagrams/{diagram_id}/metadata/bulk**`: Creates multiple diagram metadata entries.

## Data Models

### ApiInfo

- **Fields**:
  - `status`: Object - API status information.
    - `code`: String - Status code ("OK" or "ERROR").
    - `time`: String - Current server time in UTC (RFC 3339).
  - `service`: Object - Service information.
    - `name`: String - Name of the service.
    - `build`: String - Current build number.
  - `api`: Object - API information.
    - `version`: String - API version.
    - `specification`: String - URL to the API specification.
  - `operator`: Object (optional) - Operator information.
    - `name`: String - Operator name.
    - `contact`: String - Operator contact information.

### Diagram

- **Fields**:
  - `id`: UUID - Unique identifier.
  - `name`: String - Name of the diagram.
  - `description`: String - Description of the diagram.
  - `created_at`, `modified_at`: ISO8601 timestamps - Creation and modification times.
  - `metadata`: Array of `{key: string, value: string}` - Extensible metadata.
  - `graphData`: Array of Cell objects - Diagram elements.
  - `version`: Number - Diagram version number.

### Cell

- **Fields**:
  - `id`: String - Unique identifier of the cell.
  - `value`: String (optional) - Label or value associated with the cell.
  - `geometry`: Object (optional) - Position and size for vertices.
    - `x`, `y`: Number - Coordinates of the cell's top-left corner.
    - `width`, `height`: Number - Dimensions of the cell.
  - `style`: String (optional) - Style string defining the cell's appearance.
  - `vertex`: Boolean - Indicates if the cell is a vertex.
  - `edge`: Boolean - Indicates if the cell is an edge.
  - `parent`: String (optional) - ID of the parent cell for grouping.
  - `source`: String (optional) - ID of the source vertex for edges.
  - `target`: String (optional) - ID of the target vertex for edges.

### Threat Model

- **Fields**:
  - `id`: UUID - Unique identifier.
  - `name`: String - Name of the threat model.
  - `description`: String - Description of the threat model.
  - `created_at`, `modified_at`: ISO8601 timestamps - Creation and modification times.
  - `owner`: String - Username or identifier of the current owner (may be email address or other format).
  - `created_by`: String - Username or identifier of the creator of the threat model.
  - `threat_model_framework`: String - The framework used for this threat model (e.g., "STRIDE", "CIA", "LINDDUN", "DIE", "PLOT4ai").
  - `issue_url`: String (URI) - URL to an issue in an issue tracking system for this threat model.
  - `authorization`: Array of `{subject: string, role: "reader"|"writer"|"owner"}` - User roles.
  - `metadata`: Array of `{key: string, value: string}` - Extensible metadata.
  - `diagrams`: Array of diagram UUIDs - References to related diagrams.
  - `threats`: Array of threat objects - Embedded threats.

### Threat

- **Fields**:
  - `id`: UUID - Unique identifier.
  - `threat_model_id`: UUID - Parent threat model ID.
  - `name`: String - Name of the threat.
  - `description`: String - Description of the threat.
  - `created_at`, `modified_at`: ISO8601 timestamps - Creation and modification times.
  - `diagram_id`: UUID - UUID of the associated diagram (if applicable).
  - `cell_id`: UUID - UUID of the associated cell (if applicable).
  - `severity`: String - Severity level of the threat ("Unknown", "None", "Low", "Medium", "High", "Critical").
  - `score`: Number - Numeric score representing the risk or impact of the threat.
  - `priority`: String - Priority level for addressing the threat.
  - `mitigated`: Boolean - Whether the threat has been mitigated.
  - `status`: String - Current status of the threat.
  - `threat_type`: String - Type or category of the threat.
  - `issue_url`: String (URI) - URL to an issue in an issue tracking system for this threat.
  - `metadata`: Array of `{key: string, value: string}` - Extensible metadata.

### Authorization

- **Fields**:
  - `subject`: String - Username or identifier of the user.
  - `role`: String - Role: "reader" (view), "writer" (edit), "owner" (full control).

### Metadata

- **Fields**:
  - `key`: String - Metadata key.
  - `value`: String - Metadata value.

### CollaborationSession

- **Fields**:
  - `session_id`: String - Unique identifier for the session.
  - `threat_model_id`: UUID - UUID of the associated threat model.
  - `diagram_id`: UUID - UUID of the associated diagram.
  - `participants`: Array of participant objects.
    - `user_id`: String - Username or identifier of the participant.
    - `joined_at`: ISO8601 timestamp - Join timestamp.
  - `websocket_url`: String - WebSocket URL for real-time updates.

### ListItem

- **Fields**:
  - `name`: String - Name of the resource.
  - `id`: UUID - Unique identifier of the resource.

### Document

- **Fields**:
  - `id`: UUID - Unique identifier for the document.
  - `threat_model_id`: UUID - Parent threat model ID.
  - `name`: String - Name of the document.
  - `description`: String - Description of the document.
  - `url`: String (URI) - URL to the document resource.
  - `document_type`: String - Type or category of the document.
  - `created_at`, `modified_at`: ISO8601 timestamps - Creation and modification times.
  - `metadata`: Array of `{key: string, value: string}` - Extensible metadata.

### Source

- **Fields**:
  - `id`: UUID - Unique identifier for the source code reference.
  - `threat_model_id`: UUID - Parent threat model ID.
  - `name`: String - Name of the source code reference.
  - `description`: String - Description of the source code reference.
  - `url`: String (URI) - URL to the source code (repository, file, etc.).
  - `repository`: String - Repository name or identifier.
  - `branch`: String - Branch name in the repository.
  - `file_path`: String - Path to the specific file or directory.
  - `line_number`: Number - Specific line number (if applicable).
  - `created_at`, `modified_at`: ISO8601 timestamps - Creation and modification times.
  - `metadata`: Array of `{key: string, value: string}` - Extensible metadata.

## Behavior and Implementation Choices

### Authentication

- **OAuth**: External provider handles user auth; server exchanges code for JWT.
- **JWT**: Used for stateless session management, validated on each request.

### Permissions

- **Roles** (applies to `ThreatModel` and all sub-resources including diagrams):
  - `reader`: View-only access.
  - `writer`: Edit capabilities (via `PUT`/`PATCH`).
  - `owner`: Full control, including deletion and managing `authorization`.
- **Ownership**:
  - Initial `owner` set on creation with `"owner"` role in `authorization`.
  - `owner` can transfer to another `"owner"` in `authorization`.
  - Original `owner` retained in `authorization` as `"owner"` post-transfer unless explicitly removed.

### Diagram Collaboration

- **Sessions**: Managed via REST (`/collaborate`); active for 15 minutes without activity.
- **WebSocket**: Broadcasts JSON Patch operations for real-time editing; `"reader"` cannot edit.
- **Conflict Resolution**: Last-writer-wins.

### Threat Model Management

- **No Direct Collaboration**: Threat models themselves do not support real-time collaboration, but their diagrams do.
- **Integrated Sub-Resources**: Diagrams, threats, documents, and sources are managed as sub-resources of threat models.
- **Hierarchical Structure**: All diagram operations are scoped to threat models, ensuring proper authorization inheritance.

### Sub-Resource Management

- **Authorization Inheritance**: All sub-resources (diagrams, threats, documents, sources) inherit permissions from their parent threat model.
- **Granular Access**: Individual sub-resources can be accessed directly via their specific endpoints while maintaining parent authorization.
- **Consistency**: Sub-resource operations automatically maintain referential integrity with parent threat models.
- **Pagination**: List operations support `limit` and `offset` parameters for large datasets.
- **PATCH Support**: Threats support JSON Patch operations for granular updates; documents and sources use full replacement (PUT).
- **Metadata**: All sub-resources support extensible key-value metadata through dedicated endpoints.
- **Bulk Operations**: Multiple sub-resources can be created, updated, or deleted in single requests for efficiency.
- **Validation**: Server enforces data consistency, required fields, and format validation for all sub-resource operations.

### Design Choices

- **REST + WebSocket**: REST for structure; WebSocket for real-time diagram editing.
- **JSON Patch**: Flexible updates for diagrams and threat models.
- **UUIDs**: Ensures unique identification.
- **List vs. Retrieve**: List APIs return `[name, id]` pairs; retrieve APIs return full objects.
- **Last-Writer-Wins**: Simplest conflict resolution for diagrams.
- **15-Minute Timeout**: Applies to diagram collaboration sessions.

## Implementation Notes

- **Security**: All endpoints except `/`, `/api/server-info`, `/auth/providers`, `/auth/login/{provider}`, `/auth/callback`, `/auth/token/{provider}`, and static files require JWT.
- **Validation**: Server enforces role-based access, UUID uniqueness, email format, and referential integrity.
- **Scalability**: Stateless JWTs and WebSocket sessions support horizontal scaling.
- **Future Enhancements**:
  - Diagrams: Versioning, audit logs, advanced conflict resolution.
  - Sub-Resources: Advanced search and filtering, relationship mapping, export functionality.
  - Caching: Redis-based performance optimization, cache warming strategies.
  - Monitoring: Request tracing, performance metrics, usage analytics.

## Usage Examples

### API Information

#### Get API Information

```http
GET /
```

**Response** (200):

```json
{
  "status": {
    "code": "OK",
    "time": "2025-04-09T12:00:00Z"
  },
  "service": {
    "name": "TMI",
    "build": "1.0.0-386eea0"
  },
  "api": {
    "version": "1.0",
    "specification": "https://github.com/ericfitz/tmi/blob/main/tmi-openapi.json"
  },
  "operator": {
    "name": "Example Organization",
    "contact": "api-support@example.com"
  }
}
```

### Authentication

#### List OAuth Providers

```http
GET /auth/providers
```

**Response** (200):

```json
{
  "providers": [
    {
      "id": "test",
      "name": "Test Provider",
      "login_url": "/auth/login/test"
    }
  ]
}
```

#### Initiate Login

```http
GET /auth/login/test?redirect_uri=https://client.example.com/callback
```

**Response**: 302 Redirect, `Location: https://oauth-provider.com/auth?...`

#### OAuth Callback

```http
GET /auth/callback?code=abc123&state=xyz789
```

**Response**: 302 Redirect to client with tokens

#### Exchange Code for Token

```http
POST /auth/token/test
Content-Type: application/json

{
  "code": "abc123",
  "redirect_uri": "https://client.example.com/callback"
}
```

**Response** (200):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "def456...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

#### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "def456..."
}
```

**Response** (200):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

#### Get Current User

```http
GET /auth/me
Authorization: Bearer <JWT>
```

**Response** (200):

```json
{
  "sub": "user@example.com",
  "name": "John Doe",
  "email": "user@example.com"
}
```

#### Logout

```http
POST /auth/logout
Authorization: Bearer <JWT>
```

**Response**: 204 No Content

### Threat Model Management

#### List Threat Models

```http
GET /threat_models?limit=1
Authorization: Bearer <JWT>
```

**Response** (200):

```json
[
  {
    "name": "System Threat Model",
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
]
```

#### Create a Threat Model

```http
POST /threat_models
Authorization: Bearer <JWT>
Content-Type: application/json
{
  "name": "System Threat Model",
  "description": "Threats for system X",
  "threat_model_framework": "STRIDE"
}
```

**Response** (201):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "System Threat Model",
  "description": "Threats for system X",
  "created_at": "2025-04-06T12:00:00Z",
  "modified_at": "2025-04-06T12:00:00Z",
  "owner": "user@example.com",
  "authorization": [{ "subject": "user@example.com", "role": "owner" }],
  "metadata": [],
  "diagrams": [],
  "threats": [],
  "created_by": "user@example.com",
  "threat_model_framework": "STRIDE"
}
```

**Headers**: `Location: /threat_models/550e8400-e29b-41d4-a716-446655440000`

#### Retrieve a Threat Model

```http
GET /threat_models/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <JWT>
```

**Response** (200):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "System Threat Model",
  "description": "Threats for system X",
  "created_at": "2025-04-06T12:00:00Z",
  "modified_at": "2025-04-06T12:00:00Z",
  "owner": "user@example.com",
  "authorization": [{ "subject": "user@example.com", "role": "owner" }],
  "metadata": [],
  "diagrams": [],
  "threats": [],
  "created_by": "user@example.com",
  "threat_model_framework": "STRIDE"
}
```

#### Update a Threat Model (Full)

```http
PUT /threat_models/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <JWT>
Content-Type: application/json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Updated Threat Model",
  "description": "Updated threats",
  "created_at": "2025-04-06T12:00:00Z",
  "modified_at": "2025-04-06T12:00:00Z",
  "owner": "user@example.com",
  "authorization": [{"subject": "user@example.com", "role": "owner"}],
  "metadata": [],
  "diagrams": [],
  "threats": [],
  "created_by": "user@example.com",
  "threat_model_framework": "STRIDE"
}
```

**Response** (200):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Updated Threat Model",
  "description": "Updated threats",
  "created_at": "2025-04-06T12:00:00Z",
  "modified_at": "2025-04-06T12:45:00Z",
  "owner": "user@example.com",
  "authorization": [{ "subject": "user@example.com", "role": "owner" }],
  "metadata": [],
  "diagrams": [],
  "threats": [],
  "created_by": "user@example.com",
  "threat_model_framework": "STRIDE"
}
```

#### Update a Threat Model (Partial)

```http
PATCH /threat_models/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <JWT>
Content-Type: application/json
[
  {"op": "add", "path": "/threats/-", "value": {"id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8", "threat_model_id": "550e8400-e29b-41d4-a716-446655440000", "name": "Data Breach", "description": "Unauthorized access", "created_at": "2025-04-06T12:01:00Z", "modified_at": "2025-04-06T12:01:00Z", "severity": "High", "score": 7.5, "priority": "High", "mitigated": false, "status": "Open", "threat_type": "Information Disclosure", "metadata": []}}
]
```

**Response** (200):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Updated Threat Model",
  "description": "Updated threats",
  "created_at": "2025-04-06T12:00:00Z",
  "modified_at": "2025-04-06T12:45:00Z",
  "owner": "user@example.com",
  "authorization": [{ "subject": "user@example.com", "role": "owner" }],
  "metadata": [],
  "diagrams": [],
  "threats": [
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "threat_model_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Data Breach",
      "description": "Unauthorized access",
      "created_at": "2025-04-06T12:01:00Z",
      "modified_at": "2025-04-06T12:01:00Z",
      "severity": "High",
      "score": 7.5,
      "priority": "High",
      "mitigated": false,
      "status": "Open",
      "threat_type": "Information Disclosure",
      "metadata": []
    }
  ]
}
```

#### Delete a Threat Model

```http
DELETE /threat_models/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <JWT>
```

**Response**: 204 No Content

### Diagram Management

#### List Diagrams for a Threat Model

```http
GET /threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams?limit=2&offset=0
Authorization: Bearer <JWT>
```

**Response** (200):

```json
[
  { "name": "Workflow Diagram", "id": "123e4567-e89b-12d3-a456-426614174000" },
  { "name": "System Overview", "id": "456e7890-e12f-34d5-a678-426614174001" }
]
```

#### Create a Diagram

```http
POST /threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams
Authorization: Bearer <JWT>
Content-Type: application/json
{
  "name": "New Diagram",
  "description": "A test diagram"
}
```

**Response** (201):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "New Diagram",
  "description": "A test diagram",
  "created_at": "2025-04-06T12:00:00Z",
  "modified_at": "2025-04-06T12:00:00Z",
  "owner": "user@example.com",
  "authorization": [{ "subject": "user@example.com", "role": "owner" }],
  "metadata": [],
  "graphData": []
}
```

**Headers**: `Location: /threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000`

#### Retrieve a Diagram

```http
GET /threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <JWT>
```

**Response** (200):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Workflow Diagram",
  "description": "A process workflow",
  "created_at": "2025-04-06T12:00:00Z",
  "modified_at": "2025-04-06T12:30:00Z",
  "owner": "user@example.com",
  "authorization": [{ "subject": "user@example.com", "role": "owner" }],
  "metadata": [],
  "graphData": []
}
```

#### Update a Diagram (Full)

```http
PUT /threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <JWT>
Content-Type: application/json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Updated Diagram",
  "description": "Updated description",
  "created_at": "2025-04-06T12:00:00Z",
  "modified_at": "2025-04-06T12:00:00Z",
  "owner": "user@example.com",
  "authorization": [{"subject": "user@example.com", "role": "owner"}],
  "metadata": [],
  "graphData": []
}
```

**Response** (200):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Updated Diagram",
  "description": "Updated description",
  "created_at": "2025-04-06T12:00:00Z",
  "modified_at": "2025-04-06T12:45:00Z",
  "owner": "user@example.com",
  "authorization": [{ "subject": "user@example.com", "role": "owner" }],
  "metadata": [],
  "graphData": []
}
```

#### Update a Diagram (Partial)

```http
PATCH /threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <JWT>
Content-Type: application/json
[
  {"op": "replace", "path": "/name", "value": "Patched Diagram"}
]
```

**Response** (200):

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Patched Diagram",
  "description": "A process workflow",
  "created_at": "2025-04-06T12:00:00Z",
  "modified_at": "2025-04-06T12:45:00Z",
  "owner": "user@example.com",
  "authorization": [{ "subject": "user@example.com", "role": "owner" }],
  "metadata": [],
  "graphData": []
}
```

#### Delete a Diagram

```http
DELETE /threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <JWT>
```

**Response**: 204 No Content

### Diagram Collaboration

#### Get Collaboration Session Status

Retrieves the current collaboration session details for a diagram. The session payload indicates who has been authorized to the session, not who is currently active in the WebSocket session. The 200 status indicates successful retrieval - clients must NOT evaluate the payload to determine session status.

```http
GET /threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000/collaborate
Authorization: Bearer <JWT>
```

**Response** (200):

```json
{
  "session_id": "abc123-session-uuid",
  "threat_model_id": "550e8400-e29b-41d4-a716-446655440000",
  "diagram_id": "123e4567-e89b-12d3-a456-426614174000",
  "participants": [
    { "user_id": "user@example.com", "joined_at": "2025-04-06T12:02:00Z", "permissions": "writer" }
  ],
  "websocket_url": "wss://api.example.com/threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000/ws"
}
```

**Important Notes:**
- The `participants` array shows users authorized to join the session, not users currently connected to the WebSocket
- Connection and activity status is handled within the WebSocket session itself
- A 200 response indicates successful retrieval regardless of participants or session state

#### Create a Collaboration Session

Creates a new collaboration session for a diagram. Only one session can exist per diagram at a time.

```http
POST /threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000/collaborate
Authorization: Bearer <JWT>
```

**Response** (201 - Success):
*The 201 status indicates successful creation - clients must NOT evaluate the payload to determine success.*

```json
{
  "session_id": "abc123-session-uuid",
  "threat_model_id": "550e8400-e29b-41d4-a716-446655440000",
  "diagram_id": "123e4567-e89b-12d3-a456-426614174000",
  "participants": [
    { "user_id": "user@example.com", "joined_at": "2025-04-06T12:02:00Z", "permissions": "writer" }
  ],
  "websocket_url": "wss://api.example.com/threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000/ws"
}
```

**Response** (409 - Session Already Exists):

```json
{
  "error": "Collaboration session already exists for this diagram",
  "join_url": "/threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000/collaborate"
}
```

#### Join a Collaboration Session

Joins an existing collaboration session for a diagram.

```http
PUT /threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000/collaborate
Authorization: Bearer <JWT>
```

**Response** (200 - Success):
*The 200 status indicates successful join - clients must NOT evaluate the payload to determine success.*

```json
{
  "session_id": "abc123-session-uuid",
  "threat_model_id": "550e8400-e29b-41d4-a716-446655440000",
  "diagram_id": "123e4567-e89b-12d3-a456-426614174000",
  "participants": [
    { "user_id": "creator@example.com", "joined_at": "2025-04-06T12:00:00Z", "permissions": "writer" },
    { "user_id": "user@example.com", "joined_at": "2025-04-06T12:02:00Z", "permissions": "writer" }
  ],
  "websocket_url": "wss://api.example.com/threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000/ws"
}
```

**Response** (404 - No Session Exists):

```json
{
  "error": "unauthorized",
  "error_description": "No collaboration session exists for this diagram"
}
```

#### Leave a Collaboration Session

```http
DELETE /threat_models/550e8400-e29b-41d4-a716-446655440000/diagrams/123e4567-e89b-12d3-a456-426614174000/collaborate
Authorization: Bearer <JWT>
```

**Response**: 204 No Content

#### WebSocket Update (Example)

**Client Message** (via `wss://...`):

```json
{
  "operation": {
    "op": "replace",
    "path": "/graphData/0/data/label",
    "value": "Start Updated"
  }
}
```

**Server Broadcast**:

```json
{
  "event": "update",
  "user_id": "user@example.com",
  "operation": {
    "op": "replace",
    "path": "/graphData/0/data/label",
    "value": "Start Updated"
  },
  "timestamp": "2025-04-06T12:03:00Z"
}
```

### Sub-Resource Operations

#### Create a Threat

```http
POST /threat_models/550e8400-e29b-41d4-a716-446655440000/threats
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "name": "SQL Injection Vulnerability",
  "description": "User input is not properly sanitized before database queries",
  "severity": "High",
  "threat_type": "Input Validation",
  "mitigation": "Implement parameterized queries and input validation"
}
```

**Response** (201):

```json
{
  "id": "789f0123-e45d-67e8-90ab-123456789012",
  "threat_model_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "SQL Injection Vulnerability",
  "description": "User input is not properly sanitized before database queries",
  "severity": "High",
  "threat_type": "Input Validation",
  "mitigation": "Implement parameterized queries and input validation",
  "created_at": "2025-08-02T12:00:00Z",
  "modified_at": "2025-08-02T12:00:00Z",
  "metadata": []
}
```

#### List Threats with Pagination

```http
GET /threat_models/550e8400-e29b-41d4-a716-446655440000/threats?limit=10&offset=0
Authorization: Bearer <JWT>
```

**Response** (200):

```json
{
  "threats": [
    {
      "id": "789f0123-e45d-67e8-90ab-123456789012",
      "name": "SQL Injection Vulnerability",
      "severity": "High",
      "status": "Open"
    }
  ],
  "total_count": 1
}
```

#### Update a Threat with JSON Patch

```http
PATCH /threat_models/550e8400-e29b-41d4-a716-446655440000/threats/789f0123-e45d-67e8-90ab-123456789012
Authorization: Bearer <JWT>
Content-Type: application/json-patch+json

[
  {
    "op": "replace",
    "path": "/severity",
    "value": "Critical"
  },
  {
    "op": "replace",
    "path": "/status",
    "value": "In Progress"
  }
]
```

**Response** (200):

```json
{
  "id": "789f0123-e45d-67e8-90ab-123456789012",
  "threat_model_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "SQL Injection Vulnerability",
  "severity": "Critical",
  "status": "In Progress",
  "modified_at": "2025-08-02T12:30:00Z"
}
```

#### Create a Document

```http
POST /threat_models/550e8400-e29b-41d4-a716-446655440000/documents
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "name": "Security Requirements Document",
  "description": "Detailed security requirements for the application",
  "url": "https://docs.example.com/security-requirements.pdf",
  "document_type": "Requirements"
}
```

**Response** (201):

```json
{
  "id": "abc12345-def6-7890-abcd-ef1234567890",
  "threat_model_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Security Requirements Document",
  "description": "Detailed security requirements for the application",
  "url": "https://docs.example.com/security-requirements.pdf",
  "document_type": "Requirements",
  "created_at": "2025-08-02T12:00:00Z",
  "modified_at": "2025-08-02T12:00:00Z",
  "metadata": []
}
```

#### Create a Source Code Reference

```http
POST /threat_models/550e8400-e29b-41d4-a716-446655440000/sources
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "name": "User Authentication Module",
  "description": "Core authentication logic implementation",
  "url": "https://github.com/example/app/blob/main/src/auth/user.go",
  "repository": "example/app",
  "branch": "main",
  "file_path": "src/auth/user.go",
  "line_number": 45
}
```

**Response** (201):

```json
{
  "id": "fed09876-5432-10ab-cdef-098765432101",
  "threat_model_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "User Authentication Module",
  "description": "Core authentication logic implementation",
  "url": "https://github.com/example/app/blob/main/src/auth/user.go",
  "repository": "example/app",
  "branch": "main",
  "file_path": "src/auth/user.go",
  "line_number": 45,
  "created_at": "2025-08-02T12:00:00Z",
  "modified_at": "2025-08-02T12:00:00Z",
  "metadata": []
}
```

#### Add Metadata to a Threat

```http
POST /threat_models/550e8400-e29b-41d4-a716-446655440000/threats/789f0123-e45d-67e8-90ab-123456789012/metadata
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "priority": "P1",
  "owner": "security-team",
  "due_date": "2025-08-15"
}
```

**Response** (201):

```json
{
  "metadata": [
    { "key": "priority", "value": "P1" },
    { "key": "owner", "value": "security-team" },
    { "key": "due_date", "value": "2025-08-15" }
  ]
}
```

#### Get Specific Metadata Value

```http
GET /threat_models/550e8400-e29b-41d4-a716-446655440000/threats/789f0123-e45d-67e8-90ab-123456789012/metadata/priority
Authorization: Bearer <JWT>
```

**Response** (200):

```json
{
  "key": "priority",
  "value": "P1"
}
```

#### Bulk Create Threats

```http
POST /threat_models/550e8400-e29b-41d4-a716-446655440000/threats/bulk
Authorization: Bearer <JWT>
Content-Type: application/json

[
  {
    "name": "Cross-Site Scripting (XSS)",
    "description": "Malicious scripts executed in user browsers",
    "severity": "Medium",
    "threat_type": "Input Validation"
  },
  {
    "name": "Cross-Site Request Forgery (CSRF)",
    "description": "Unauthorized commands transmitted from trusted user",
    "severity": "Medium",
    "threat_type": "Authentication"
  }
]
```

**Response** (201):

```json
{
  "created": [
    {
      "id": "111a2222-b333-c444-d555-e66666666666",
      "name": "Cross-Site Scripting (XSS)",
      "severity": "Medium"
    },
    {
      "id": "777f8888-e999-1000-a111-b22222222222",
      "name": "Cross-Site Request Forgery (CSRF)",
      "severity": "Medium"
    }
  ],
  "count": 2
}
```

#### Batch Patch Multiple Threats

```http
POST /threat_models/550e8400-e29b-41d4-a716-446655440000/threats/batch/patch
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "operations": [
    {
      "threat_id": "111a2222-b333-c444-d555-e66666666666",
      "patches": [
        {"op": "replace", "path": "/status", "value": "Resolved"}
      ]
    },
    {
      "threat_id": "777f8888-e999-1000-a111-b22222222222",
      "patches": [
        {"op": "replace", "path": "/severity", "value": "High"}
      ]
    }
  ]
}
```

**Response** (200):

```json
{
  "updated": [
    {
      "id": "111a2222-b333-c444-d555-e66666666666",
      "status": "Resolved"
    },
    {
      "id": "777f8888-e999-1000-a111-b22222222222",
      "severity": "High"
    }
  ],
  "count": 2
}
```

#### Bulk Create Documents

```http
POST /threat_models/550e8400-e29b-41d4-a716-446655440000/documents/bulk
Authorization: Bearer <JWT>
Content-Type: application/json

[
  {
    "name": "Security Requirements",
    "description": "Security requirements document",
    "url": "https://docs.example.com/security-requirements.pdf",
    "document_type": "Requirements"
  },
  {
    "name": "Architecture Overview",
    "description": "System architecture document",
    "url": "https://docs.example.com/architecture.pdf",
    "document_type": "Architecture"
  }
]
```

**Response** (201):

```json
{
  "created": [
    {
      "id": "abc12345-def6-7890-abcd-ef1234567890",
      "name": "Security Requirements",
      "document_type": "Requirements"
    },
    {
      "id": "def67890-abc1-2345-6789-abcdef123456",
      "name": "Architecture Overview",
      "document_type": "Architecture"
    }
  ],
  "count": 2
}
```

#### Bulk Create Sources

```http
POST /threat_models/550e8400-e29b-41d4-a716-446655440000/sources/bulk
Authorization: Bearer <JWT>
Content-Type: application/json

[
  {
    "name": "Authentication Module",
    "description": "User authentication logic",
    "url": "https://github.com/example/app/blob/main/auth/user.go",
    "repository": "example/app",
    "branch": "main",
    "file_path": "auth/user.go"
  },
  {
    "name": "Database Layer",
    "description": "Database connection and queries",
    "url": "https://github.com/example/app/blob/main/db/postgres.go",
    "repository": "example/app",
    "branch": "main",
    "file_path": "db/postgres.go"
  }
]
```

**Response** (201):

```json
{
  "created": [
    {
      "id": "fed09876-5432-10ab-cdef-098765432101",
      "name": "Authentication Module",
      "file_path": "auth/user.go"
    },
    {
      "id": "123abcde-f456-7890-1234-56789abcdef0",
      "name": "Database Layer",
      "file_path": "db/postgres.go"
    }
  ],
  "count": 2
}
```

#### Batch Delete Threats

```http
DELETE /threat_models/550e8400-e29b-41d4-a716-446655440000/threats/batch
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "threat_ids": [
    "111a2222-b333-c444-d555-e66666666666",
    "777f8888-e999-1000-a111-b22222222222"
  ]
}
```

**Response** (200):

```json
{
  "deleted": [
    "111a2222-b333-c444-d555-e66666666666",
    "777f8888-e999-1000-a111-b22222222222"
  ],
  "count": 2
}
```

This API provides a robust foundation for an Angular-based tool supporting threat modeling with collaborative diagramming and comprehensive sub-resource management.
