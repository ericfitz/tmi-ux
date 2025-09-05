# WebSocket Collaboration Guide

This document consolidates all WebSocket and collaborative editing documentation for the TMI-UX application.

## Overview

TMI-UX implements real-time collaborative editing for Data Flow Diagrams (DFD) using WebSocket connections. The implementation follows a hybrid REST + WebSocket approach, leveraging existing stable REST infrastructure for diagram loading and authentication while using WebSockets for real-time collaboration.

## Architecture

### Key Components

1. **WebSocket Service** (`core/services/websocket.service.ts`)
   - Manages Socket.io connection lifecycle
   - Handles authentication and reconnection
   - Provides low-level send/receive capabilities

2. **Message Handler Service** (`core/services/tmi-message-handler.service.ts`)
   - Routes messages to appropriate handlers
   - Manages handler registration
   - Provides message type safety

3. **DFD Collaboration Service** (`core/services/dfd-collaboration.service.ts`)
   - Implements collaboration notification handling
   - Manages participant list and presence
   - Handles presenter mode

4. **Collaborative Operation Service** (`pages/dfd/services/collaborative-operation.service.ts`)
   - Handles outgoing diagram operations
   - Manages operation sequencing
   - Implements echo prevention

### Message Flow

```
User Action → Domain Service → Collaborative Operation Service → WebSocket
                                                                     ↓
UI Update ← Event Handler ← Message Handler ← WebSocket ← Server
```

## Message Types

### Collaboration Messages
- `collaboration` - Participant list updates, presenter mode
- `diagram_operation` - Cell add/update/remove operations
- `presenter_request` / `current_presenter` - Presenter mode control
- `undo_request` / `redo_request` - Server-managed history
- `history_operation` - History operation results
- `authorization_denied` - Permission errors

### Operation Types
```typescript
interface DiagramOperation {
  type: 'add' | 'update' | 'remove';
  objectId: string;
  objectType: 'node' | 'edge';
  data?: any;
  metadata?: OperationMetadata;
}
```

## Implementation Details

### Current State
- ✅ Complete WebSocket infrastructure
- ✅ Event-driven architecture with observables
- ✅ Domain-driven design supporting operations
- ✅ Collaboration session management
- ✅ Presenter mode implementation

### Hybrid Approach Benefits
- Leverages existing stable REST infrastructure
- WebSocket provides real-time collaboration
- Clean separation between modes
- Fallback mechanism if WebSocket fails

## Usage Guide

### Establishing Connection
```typescript
// Connection is automatically established when joining a collaboration session
this.dfdCollaborationService.joinCollaborationSession(diagramId);
```

### Sending Operations
```typescript
// Operations are sent automatically through domain services
this.dfdNodeService.addNode(nodeInfo); // Automatically synced via WebSocket
```

### Handling Incoming Changes
```typescript
// Subscribe to diagram updates
this.dfdEventHandlers.nodeAdded$.subscribe(node => {
  // Handle node addition from other users
});
```

### Presenter Mode
```typescript
// Request presenter mode
this.dfdCollaborationService.requestPresenter();

// Check presenter status
this.dfdCollaborationService.isCurrentUserPresenter$.subscribe(isPresenter => {
  // Update UI based on presenter status
});
```

## Security Considerations

### Permission Validation
- All operations validated server-side
- Client permissions checked before sending
- Authorization errors handled gracefully

### Echo Prevention
- Operations tagged with unique IDs
- Echo detection in message handlers
- Prevents duplicate operations

## Testing

### Unit Tests
- Mock WebSocket connections
- Test message routing
- Verify operation handling

### Integration Tests
- Real WebSocket connections in test environment
- Multi-client synchronization tests
- Conflict resolution scenarios

## Troubleshooting

### Connection Issues
1. Check WebSocket service status
2. Verify authentication token
3. Check network connectivity
4. Review server logs

### Synchronization Problems
1. Verify operation sequencing
2. Check echo prevention
3. Review conflict resolution
4. Monitor WebSocket messages

## Future Enhancements

1. **Offline Support**
   - Queue operations when disconnected
   - Sync on reconnection

2. **Conflict Resolution**
   - Advanced merge strategies
   - User conflict UI

3. **Performance Optimization**
   - Operation batching
   - Differential updates

## References

- [WebSocket Communication Patterns ADR](adr/004-websocket-communication-patterns.md)
- [AsyncAPI Specification](../shared-api/api-specs/tmi-asyncapi.yaml)
- [Socket.io Documentation](https://socket.io/docs/v4/)