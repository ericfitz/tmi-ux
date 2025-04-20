# Collaborative Diagram Editing Plan

## Overview

This document outlines the plan for implementing collaborative diagram editing in the TMI application.

## Architecture

### Server-Side

- Server maintains the canonical state for each diagram being collaboratively edited
- WebSocket connections used for real-time communication between clients and server
- Server enforces ordering of changes and ensures consistency
- Server tracks active collaboration sessions and participating users

### Client-Side

- Local diagram editing powered by AntV/X6
- When a change is made to a node or edge in the graph (including create/delete), a partial copy of the updated element is made in the diagram object
- Diagram changes are then sent to the server via WebSocket
- Client receives updates from server for changes made by other users
- Client applies updates to local diagram model

## Collaboration Flow

### Starting a Collaboration Session

1. User loads a diagram locally
2. User sends diagram to server (or serialized pieces)
3. Server builds its state and confirms readiness
4. User can enable collaboration, marking the diagram as available for collaboration

### Joining a Collaboration Session

1. User navigates to a page listing all available collaboration sessions
   - List is filtered based on user's permissions (owner, writer, reader)
2. User selects a diagram to collaborate on
3. Server sends complete diagram state to the joining user
4. Client initializes diagram editor and sends each node and edge from the diagram to the graph
5. Client and server sync states before enabling editing capabilities

### Editing During Collaboration

1. User A makes a change to the diagram
2. Client sends "patch diagram" message to server via WebSocket
3. Server:
   - Updates the global diagram state
   - If successful:
     - Looks up all users collaborating on this diagram
     - Sends update messages to all collaborating clients
   - If fails:
     - Sends rollback instruction to the original client
     - Client displays error and reverts change locally
4. Clients receive and apply updates to their local diagrams
   - If fails:
     - Client requests full diagram state from server and rebuilds locally

### Handling Synchronization Issues

- If a client falls out of sync or a new client joins:
  - Server can send complete diagram or optimized delta from known-good point
- Periodic validation can ensure client and server states match

## Permission Model

- **Owner**: Full control (edit, share, delete)
- **Writer**: Can make changes to the diagram
- **Reader**: View-only access, can see real-time changes but cannot edit

## Technical Considerations

- Use WebSockets for low-latency bidirectional communication
- Implement reconnection logic for temporary disconnections
- Consider operation-based conflict resolution
- Design for eventual consistency
- Leverage X6's built-in history manager for local undo/redo operations
- Use X6's event system to track changes for collaboration

## X6-Specific Implementation Details

### Change Tracking

- Listen to X6 graph events (node:added, node:removed, edge:added, edge:removed, etc.)
- Serialize changes into operations that can be sent to the server
- Apply incoming operations from other users to the local graph

### User Presence

- Implement user cursors and selections using X6's overlay system
- Show which user is editing which node or edge
- Display user information (name, avatar) near their cursor

### Conflict Resolution

- Use operational transformation for concurrent edits
- Implement optimistic updates with rollback capability
- Leverage X6's history manager for local undo/redo of conflicting changes

### Performance Considerations

- Batch updates to reduce network traffic
- Use delta updates instead of full state synchronization when possible
- Implement throttling for high-frequency operations (like dragging)
