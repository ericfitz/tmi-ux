# Collaboration Session Behavior Specification

This document defines the expected behavior for collaboration sessions in TMI, ensuring consistency between REST API and WebSocket message API.

## Overview

Collaboration sessions enable real-time collaborative editing of diagrams within threat models. The behavior must be consistent across all access points: REST API endpoints and WebSocket connections.

## 1. Session Enumeration (GET /threat_models/{threat_model_id}/diagrams/{diagram_id}/collaborate)

When a user requests collaboration session information:

- **Threat model doesn't exist**: Return 404 Not Found
- **Diagram doesn't exist**: Return 404 Not Found
- **Threat model and diagram exist, but user has NO permissions**: Return 401 Unauthorized
- **Threat model and diagram exist, and user has ANY role (reader/writer/owner)**: Return session information

## 2. Session Creation/Join (POST /threat_models/{threat_model_id}/diagrams/{diagram_id}/collaborate)

When a user attempts to create or join a collaboration session:

- **Threat model doesn't exist**: Return 404 Not Found
- **Diagram doesn't exist**: Return 404 Not Found
- **User has NO permissions on threat model**: Return 401 Unauthorized
- **Collaboration session already exists**: Return 200 OK with session ID (do NOT modify participants list)
- **Collaboration session doesn't exist**: Create session, return 201 Created with session ID (do NOT modify participants list)

### Important Notes:

- The POST endpoint should NOT add users to the participants list
- Participants are only added when they actually connect via WebSocket

## 3. WebSocket Connection (/threat_models/{threat_model_id}/diagrams/{diagram_id}/ws)

When a user connects to the collaboration session WebSocket:

### 3.1 Calculate Session Permissions and Roles

1. **Session Permission**:

   - `writer`: If user has `writer` or `owner` role on threat model
   - `reader`: If user has `reader` role on threat model
   - `none`: If user has no permissions on threat model → **Disconnect immediately**

2. **Host**:

   - The user who created the collaboration session
   - All other users are participants

3. **Presenter**:
   - Initially the host
   - Can be changed by the host

### 3.2 Connection Actions

If the user has valid session permissions:

1. Update session state in memory to include the new participant with their roles and permissions
2. Broadcast a `join` event to all participants
3. Broadcast a `participants_update` message to all participants including:
   - Complete list of participants
   - Each participant's permissions and roles
   - Current host
   - Current presenter

## 4. WebSocket Disconnection

When a user disconnects from the WebSocket:

1. Broadcast a `leave` event to all remaining participants
2. Broadcast a `participants_update` message to all remaining participants
3. Remove the user from the session state (both active clients and intended participants)

### Special Cases:

- **Presenter disconnects**: Automatically reassign presenter role (usually to host)
- **Host disconnects**: Broadcast `session_ended` event and prepare for session cleanup

## 5. Participants List Management

### Key Principles:

1. **REST API GET**: Shows all participants who have connected via WebSocket at any point
2. **REST API POST**: Does NOT modify participants - only creates/retrieves session
3. **WebSocket connect**: Adds user to participants and broadcasts updates
4. **WebSocket disconnect**: Removes user from participants and broadcasts updates

### Participant Information:

Each participant entry includes:

- `user_id`: User identifier (email)
- `permissions`: Session permissions (reader/writer)
- `joined_at`: Timestamp when user first connected
- `is_host`: Boolean flag
- `is_presenter`: Boolean flag

## 6. Error Handling

### REST API:

- Use proper HTTP status codes (404, 401, 200, 201)
- Include descriptive error messages in response body

### WebSocket:

- Disconnect users with no permissions immediately
- Send error messages before disconnecting when appropriate
- Log all connection/disconnection events for debugging

## 7. Consistency Requirements

1. **Participant lists must be identical** between REST API responses and WebSocket broadcasts
2. **Permission checks must use the same logic** across all endpoints
3. **Session state must be atomically updated** to prevent race conditions
4. **All clients must receive updates** when session state changes
