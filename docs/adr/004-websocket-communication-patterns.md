# ADR-004: WebSocket Communication Patterns

## Status
Accepted

## Date
2025-09-05

## Context
The TMI-UX application uses WebSockets for real-time collaboration features:
- Multiple users editing data flow diagrams simultaneously
- Real-time synchronization of diagram changes
- Collaboration session management
- User presence awareness

The WebSocket implementation needed to handle:
- Connection lifecycle (connect, disconnect, reconnect)
- Message routing to appropriate handlers
- Error handling and recovery
- State synchronization
- Performance optimization

## Decision
Implement a layered WebSocket architecture:

### 1. Core WebSocket Service
- Manages Socket.io connection lifecycle
- Handles authentication and reconnection
- Provides low-level send/receive capabilities
- Located in `core/services/websocket.service.ts`

### 2. Message Handler Service
- Routes messages to appropriate handlers
- Manages handler registration
- Provides message type safety
- Located in `core/services/tmi-message-handler.service.ts`

### 3. Feature-Specific Handlers
- Implement business logic for specific message types
- Manage feature state
- Located in feature modules (e.g., `dfd/services/websocket-handlers/`)

### 4. Message Type Definitions
- Strongly typed message interfaces
- Centralized in `types/websocket.types.ts`
- Shared between client and server

## Message Flow
```
Server → WebSocket → MessageHandler → FeatureHandler → UI Update
UI Action → FeatureService → WebSocket → Server
```

## Consequences

### Positive
- **Separation of Concerns**: Clear responsibilities for each layer
- **Type Safety**: Strongly typed messages prevent runtime errors
- **Testability**: Each layer can be tested independently
- **Scalability**: Easy to add new message types and handlers
- **Reusability**: Core WebSocket logic shared across features

### Negative
- **Complexity**: Multiple layers to understand
- **Debugging**: Message flow can be hard to trace
- **Performance**: Additional abstraction layers

### Mitigations
- Comprehensive logging at each layer
- WebSocket debugging tools in development
- Performance monitoring for message processing
- Clear documentation with sequence diagrams

## Implementation
1. Created core `WebsocketService` with Socket.io integration
2. Implemented `TmiMessageHandlerService` for routing
3. Created typed message interfaces
4. Implemented feature-specific handlers
5. Added reconnection logic with exponential backoff
6. Implemented presence tracking

## Example
```typescript
// Message type definition
interface CollaborationMessage {
  type: 'collaboration';
  action: 'node-added' | 'node-updated' | 'node-deleted';
  data: {
    nodeId: string;
    changes: any;
  };
}

// Handler registration
messageHandler.registerHandler('collaboration', collaborationHandler);

// Sending a message
websocketService.send({
  type: 'collaboration',
  action: 'node-updated',
  data: { nodeId: '123', changes: { x: 100, y: 200 } }
});
```

## References
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- TMI AsyncAPI Specification: `shared-api/api-specs/tmi-asyncapi.yaml`