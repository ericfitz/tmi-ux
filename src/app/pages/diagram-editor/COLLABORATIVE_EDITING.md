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
- Local diagram editing powered by maxGraph
- Diagram changes sent to server via WebSocket
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
4. Client and server sync states before enabling editing capabilities

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