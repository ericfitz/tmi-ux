# Collaborative Diagram Editing Plan

## Overview

This document outlines the plan for implementing collaborative diagram editing in the TMI application. This represents the original planning document; the actual implementation may differ in details.

## Architecture

### Server-Side

- Server maintains the canonical state for each diagram being collaboratively edited
- WebSocket connections used for real-time communication between clients and server
- Server enforces ordering of changes and ensures consistency
- Server tracks active collaboration sessions and participating users

### Client-Side

- Local diagram editing powered by AntV/X6 (version 2.19.2)
- When a change is made to a node or edge in the graph (including create/delete), a partial copy of the updated element is made in the diagram object
- Diagram changes are then sent to the server via WebSocket using operation-based messages (`diagram_operation` message type)
- Client receives updates from server for changes made by other users
- Client applies updates to local diagram model

## Collaboration Flow

### Starting a Collaboration Session

1. User loads a diagram locally
2. User initiates collaboration via the UI (REST API call to create session)
3. Server creates the session and returns WebSocket URL
4. A user with the "owner" or "writer" role can enable collaboration, marking the diagram as available for collaboration and creating a collaboration session using the server API.
5. Additional users can browse to a diagram, or the user that initiates the collaboration can send a link to the diagram directly to users (outside of the application) as part of an invitation.

### Joining a Collaboration Session

1. User navigates to a page listing all available collaboration sessions
   - The list is filtered based on user's permissions - users only see sessions for which they are assigned at least one role (reader, writer, owner)
2. User selects a diagram to collaborate on
3. Server sends complete diagram state to the joining user via `diagram_state_sync` message
4. Client initializes diagram editor and sends each node and edge from the diagram to the graph
5. Client and server sync states before enabling editing capabilities
6. Client does not allow users to make changes to diagrams where their only role is "reader"

### Editing During Collaboration

1. User A makes a change to the diagram
2. Client sends `diagram_operation` message to server via WebSocket
3. Server:
   - Updates the global diagram state
   - If successful:
     - Looks up all users collaborating on this diagram
     - Sends update messages to all collaborating clients
   - If fails:
     - Sends `state_correction` message to resync the client
     - Client displays error and reverts change locally
4. Clients receive and apply updates to their local diagrams
   - If fails:
     - Client requests full diagram state from server and rebuilds locally

### Handling Synchronization Issues

- If a client falls out of sync or a new client joins:
  - Server can send complete diagram via `diagram_state_sync` or optimized delta from known-good point
- Update vector (version number) is used for conflict detection
- Periodic validation can ensure client and server states match

## Permission Model

### Diagrams

- **Owner**: Full control (edit, share, delete, manage permissions)
- **Writer**: Can make changes to the diagram
- **Reader**: View-only access, can see real-time changes but cannot edit

### Sessions

- **Host**: The user who initiated the collaboration session; they are the only user allowed to end the session (corresponds to "Initiator" in original plan)
- **Participant**: Any user other than the host who participates in a session. They are allowed to join sessions where they have at least the "reader" role, and they are allowed to leave any session that they belong to.
- **Presenter**: Optional role that can be assigned to enable presenter mode with cursor/selection sharing

## Technical Considerations

- Use WebSockets for low-latency bidirectional communication
- Implement reconnection logic for temporary disconnections (currently disabled in implementation)
- Operation-based conflict resolution with server-authoritative state
- Design for eventual consistency
- Custom `AppHistoryService` for local undo/redo operations (works alongside X6's history plugin)
- Use X6's event system to track changes for collaboration

## X6-Specific Implementation Details

### Change Tracking

- Listen to X6 graph events (`node:added`, `node:removed`, `edge:added`, `edge:removed`, `node:change:position`, `node:change:size`, `edge:change:vertices`, etc.)
- Serialize changes into operations that can be sent to the server
- Apply incoming operations from other users to the local graph via `AppRemoteOperationHandlerService`

### User Presence

- Implement user cursors and selections using X6's overlay system via `ui-presenter-cursor.service.ts`
- Show which user is editing which cell
- Display user information (name) near their cursor in presenter mode

### Conflict Resolution

- Server-authoritative state with `update_vector` for version tracking
- Implement optimistic updates with rollback capability via `state_correction` messages
- Custom `AppHistoryService` for local undo/redo with collaboration awareness

### Performance Considerations

- Batch updates to reduce network traffic
- Use delta updates (`diagram_operation`) instead of full state synchronization when possible
- Implement throttling for high-frequency operations (like dragging) via `AppOperationStateManager`

<!--
VERIFICATION SUMMARY
Verified on: 2026-01-25
Agent: verify-migrate-doc

Verified items:
- WebSocket communication: Verified in websocket.adapter.ts with comprehensive implementation
- AntV/X6 for diagram editing: Verified in infra-x6-graph.adapter.ts, version 2.19.2 in package.json
- X6 events (node:added, node:removed, edge:added, edge:removed): Verified in infra-x6-graph.adapter.ts event listeners
- X6 history plugin: Verified @antv/x6-plugin-history in package.json
- Custom history service: Verified AppHistoryService in app-history.service.ts
- Owner/Writer/Reader roles: Verified in dfd-collaboration.service.ts and wiki documentation
- Collaboration session management: Verified in collaboration-session.service.ts
- Presenter mode: Verified in dfd-collaboration.service.ts with request/approve/deny flow
- WebSocket message types: Verified in websocket.adapter.ts (MessageType enum)
- Reconnection logic: Verified (currently commented out in websocket.adapter.ts)
- Operation-based conflict resolution: Verified via state_correction message handling
- User presence/cursors: Verified in ui-presenter-cursor.service.ts

Items corrected during verification:
- Updated "Initiator" terminology to "Host" (matches implementation)
- Clarified diagram sending uses REST API + WebSocket, not serialized pieces
- Changed "operational transformation" to "server-authoritative state with update_vector"
- Added specific service names and message types from implementation
- Added Presenter role to Session roles
-->
