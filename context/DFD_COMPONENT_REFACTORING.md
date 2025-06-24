# DFD Component Refactoring Plan

This document outlines the plan for refactoring the DFD component to simplify event management and shape management while enhancing it for collaborative editing.

## Requirements

- Multiple users will be editing the diagram simultaneously
- Some users will be viewing only, others will be editing
- The TMI server will coordinate collaboration
  - Users will each only have a session (authenticated websocket) with the TMI server
  - The TMI server will receive updates and fan them out to each user in a session
  - The TMI server will be authoritative for diagram state
- Automation will be able to generate and collaborate on diagrams via TMI server API
- Shapes and styles will be fixed in advance, with styles managed in CSS, to allow us to omit style information from collaboration messaging
- TMI-UX will
  - Implement UX for diagram management
  - Implement UX for colloboration session management
  - Monitor user-made changes (not automatic style changes)
  - Serialize changes and send them to the server
  - Consume a stream of changes from the server and apply them locally

## Implementation Plan

### Phase 1: Shape and Command Simplification

1. **Simplify Shape Definitions**

   - Use X6's Shape.define method for shape definitions
   - Move styling to CSS and keep only structural properties in shape definitions
   - Centralize shape configuration

2. **Enhance Commands with Serialization**

   - Extend commands to support serialization to JSON
   - Add origin tracking to commands (local vs. remote)
   - Implement command replay functionality

3. **Implement Selective Change Tracking**
   - Add property to events to distinguish user-initiated vs. system-initiated changes
   - Filter events for synchronization
   - Implement selective deep comparison for user-modifiable properties

### Phase 2: Collaboration Infrastructure

1. **Implement Collaboration Service**

   - Create service for handling WebSocket connections with the TMI server
   - Implement message serialization/deserialization
   - Add authentication and authorization

2. **Add Remote Event Handling**

   - Extend event system to handle events from the server
   - Implement event reconciliation logic
   - Add conflict resolution strategies

3. **Implement User Presence Tracking**
   - Track connected users
   - Show user cursors/selections
   - Implement user activity indicators

### Phase 3: Optimization

1. **Implement Delta Updates**

   - Only send changes rather than entire graph state
   - Optimize serialization format

2. **Add Operation Batching**

   - Group multiple operations into a single network request
   - Implement debouncing for frequent updates

3. **Enhance Conflict Resolution**
   - Implement more sophisticated conflict resolution strategies
   - Add user notification for conflicts
   - Provide manual conflict resolution UI when needed

## Architecture

```mermaid
graph TD
    A[DFD Component] --> B[Graph Service]
    A --> C[Event Service]
    A --> D[Command Service]
    A --> E[Collaboration Service]

    B --> F[Shape Factory]
    F --> G[Shape Definitions]

    C --> H[Local Event Handlers]
    H --> D

    E --> I[Remote Event Handlers]
    I --> D

    D --> J[Command Factory]
    J --> K[Command Implementations]

    L[State Store] <--> A
    L <--> C
    L <--> D

    E <--> M[WebSocket Connection]
    M <--> N[Server]

    O[User Presence] <--> E
```

## Technical Details

### Enhanced Command Interface

```typescript
export interface Command<T = unknown> {
  readonly id: string;
  readonly name: string;
  readonly origin: 'local' | 'remote';

  execute(graph: Graph): Promise<CommandResult<T>>;
  undo(graph: Graph): Promise<CommandResult>;
  canExecute(graph: Graph): boolean;
  canUndo(graph: Graph): boolean;

  // New methods for collaboration
  serialize(): string;
  static deserialize(json: string): Command;
}
```

### Simplified Shape Definition

```typescript
export const ActorShape = Shape.Rect.define({
  constructorName: 'actor',
  markup: [
    { tagName: 'rect', selector: 'body' },
    { tagName: 'text', selector: 'label' },
  ],
  attrs: {
    body: {
      refWidth: '100%',
      refHeight: '100%',
      class: 'actor-shape', // CSS class for styling
    },
    label: {
      refX: '50%',
      refY: '50%',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      class: 'actor-label', // CSS class for styling
    },
  },
  ports: {
    /* port configuration */
  },
});
```

### Selective Change Tracking

```typescript
export function hasUserChanges(originalNode, currentNode) {
  // Only compare properties that users can modify
  const userProps = {
    position: originalNode.position,
    size: originalNode.size,
    label: originalNode.label,
    connections: originalNode.connections,
    // Other user-modifiable properties
  };

  const currentUserProps = {
    position: currentNode.position,
    size: currentNode.size,
    label: currentNode.label,
    connections: currentNode.connections,
    // Other user-modifiable properties
  };

  return !deepCompare(userProps, currentUserProps);
}
```

### Collaboration Event Service

```typescript
export class DfdCollaborationEventService {
  // Track connected users
  private connectedUsers = new Map<
    string,
    { id: string; name: string; role: 'viewer' | 'editor' }
  >();

  // Process remote events
  processRemoteEvent(event: RemoteEvent): void {
    // Check if this is a user event
    if (event.type === 'userJoined') {
      this.connectedUsers.set(event.userId, {
        id: event.userId,
        name: event.userName,
        role: event.userRole,
      });
      this.eventBus.publish({
        type: DfdEventType.UserJoined,
        user: this.connectedUsers.get(event.userId),
        timestamp: Date.now(),
      });
      return;
    }

    // Convert remote event to local command and execute
    const command = this.convertRemoteEventToCommand(event);
    if (command) {
      command.origin = 'remote';
      this.commandService.executeCommand(command).subscribe();
    }
  }
}
```

## Progress Tracking

### Phase 1: Shape and Command Simplification ✅ COMPLETE

- [x] Simplify ActorShape definition (implemented via domain value objects)
- [x] Simplify ProcessShape definition (implemented via domain value objects)
- [x] Simplify StoreShape definition (implemented via domain value objects)
- [x] Simplify SecurityBoundaryShape definition (implemented via domain value objects)
- [x] Simplify TextboxShape definition (implemented via domain value objects)
- [x] Enhance Command interface with serialization (SerializationService implemented)
- [x] Implement command serialization for AddNodeCommand
- [x] Implement command serialization for DeleteNodeCommand
- [x] Implement command serialization for MoveNodeCommand
- [x] Implement command serialization for edge commands (AddEdgeCommand, RemoveEdgeCommand)
- [x] Implement selective change tracking (ActivityMonitoringService)

### Phase 2: Collaboration Infrastructure ✅ COMPLETE

- [x] Create DfdCollaborationService (implemented)
- [x] Implement WebSocket connection handling (WebSocketAdapter, CollaborationWebSocketService)
- [x] Implement message serialization/deserialization (SerializationService, SerializationOptimizationService)
- [x] Extend event system for remote events (CollaborationEvents, BaseDomainEvent)
- [x] Implement event reconciliation (CollaborationApplicationService)
- [x] Implement user presence tracking (UserPresence, UserTrackingService, ActivityMonitoringService)

### Phase 3: Optimization 🔄 IN PROGRESS

- [x] Implement delta updates (SerializationOptimizationService with incremental serialization)
- [x] Add operation batching (implemented in SerializationOptimizationService)
- [x] Enhance conflict resolution (basic conflict handling in CollaborationApplicationService)
- [ ] Performance testing and optimization (ongoing)

### Current Implementation Status

**Architecture Components Implemented:**

- ✅ Clean Architecture with Domain/Application/Infrastructure layers
- ✅ Command Bus with middleware (validation, logging, serialization)
- ✅ Domain Aggregates (DiagramAggregate, CollaborationSession)
- ✅ Value Objects (NodeData, EdgeData, Point, UserPresence)
- ✅ Domain Events and Event Handling
- ✅ Repository Pattern (InMemoryDiagramRepository)
- ✅ Adapter Pattern (X6GraphAdapter, WebSocketAdapter)

**Collaboration Features Implemented:**

- ✅ Real-time WebSocket communication
- ✅ User presence tracking and status updates
- ✅ Collaborative command execution
- ✅ Session management
- ✅ Activity monitoring
- ✅ Conflict detection and basic resolution
- ✅ Message serialization with optimization

**Migration Strategy:**

- ✅ Migration facade pattern (DfdMigrationFacadeService) - REMOVED
- ✅ Feature flags for gradual rollout (MigrationFlagsService) - REMOVED
- ✅ Legacy adapters for backward compatibility - REMOVED
- ✅ Progressive enhancement approach - COMPLETE

**Migration Completion:**

- ✅ Performance testing and optimization completed
- ✅ Migration facade removed successfully
- ✅ DFD Component refactored to use new architecture directly
- ✅ All migration infrastructure cleaned up
- ✅ Build and lint validation passed
- ✅ Component now uses standalone architecture with:
  - Command Bus with middleware
  - Clean Architecture layers
  - Direct service injection
  - Performance testing capabilities
