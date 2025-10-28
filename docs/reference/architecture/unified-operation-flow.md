# Unified Operation Flow Architecture

**Status**: Implemented
**Last Updated**: 2025-10-27
**Related**: [Custom History Implementation Plan](../../implementation/custom-history-implementation-plan.md)

---

## Overview

The TMI-UX DFD application uses a unified operation flow architecture where ALL graph modifications flow through a single, well-defined pipeline. This ensures consistency, enables proper history tracking, supports real-time collaboration, and provides a single point for persistence operations.

### Key Principles

1. **Single Source of Truth**: All changes flow through `GraphOperationManager`
2. **Source Awareness**: Every operation knows its origin (user, remote, load, undo/redo)
3. **Converged Pipeline**: Maximum code reuse across different operation sources
4. **History at the Right Level**: Track graph-interaction-level operations, not low-level X6 events
5. **Coordinated Side Effects**: History, broadcasting, and auto-save are coordinated based on operation source

---

## Operation Sources

Every operation that modifies the graph has a `source` property that determines how it's processed:

| Source                 | Description                               | Record History? | Broadcast?                     | Auto-Save?                |
| ---------------------- | ----------------------------------------- | --------------- | ------------------------------ | ------------------------- |
| `user-interaction`     | Direct user actions in the UI             | ✅ Yes          | ✅ If in collaboration session | ✅ If NOT in session      |
| `remote-collaboration` | Operations from other users via WebSocket | ❌ No           | ❌ No (already broadcast)      | ❌ No (handled by remote) |
| `diagram-load`         | Loading diagram from server/storage       | ❌ No           | ❌ No                          | ❌ No                     |
| `undo-redo`            | Undo/redo operations from history         | ❌ No           | ✅ If in session               | ✅ If NOT in session      |
| `auto-correction`      | System corrections (e.g., z-order fixes)  | ❌ No           | ⚠️ Maybe                       | ⚠️ Maybe                  |

---

## Unified Operation Pipeline

All changes flow through this pipeline regardless of their source:

```
┌─────────────────────────────────────────────────────────────────┐
│                     OPERATION SOURCES                            │
├─────────────┬───────────────┬─────────────┬────────────────────┤
│ User Action │ Diagram Load  │ Remote Ops  │ Undo/Redo          │
│ (UI Events) │ (REST/WS)     │ (WebSocket) │ (History Service)  │
└──────┬──────┴───────┬───────┴──────┬──────┴─────────┬──────────┘
       │              │              │                │
       │              │              │                │
       ▼              ▼              ▼                ▼
┌──────────────────────────────────────────────────────────────────┐
│              CONVERT TO GraphOperation                           │
│  - NodeOperations: create-node, update-node, delete-node        │
│  - EdgeOperations: create-edge, update-edge, delete-edge        │
│  - BatchOperations: batch of multiple operations                │
│  - LoadOperations: load-diagram with full cell array            │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│           GraphOperationManager.execute()                        │
│  - Routes operation to appropriate executor                      │
│  - Provides OperationContext with source, flags, metadata       │
│  - Manages operation lifecycle and error handling               │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    OPERATION EXECUTORS                           │
│  - NodeOperationExecutor: Handles node operations               │
│  - EdgeOperationExecutor: Handles edge operations               │
│  - BatchOperationExecutor: Handles batch operations             │
│  - LoadDiagramExecutor: Handles diagram loading                 │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│              INFRASTRUCTURE SERVICES                             │
│  - InfraNodeService: Creates/modifies nodes in X6               │
│  - InfraEdgeService: Creates/modifies edges in X6               │
│  - InfraX6GraphAdapter: Low-level X6 graph operations           │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                      X6 GRAPH                                    │
│  - Graph state updated with new cells/changes                   │
│  - Visual rendering updated                                     │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│              POST-OPERATION PROCESSING                           │
│  - Operation completed successfully                              │
│  - OperationResult returned with affected cell IDs              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
┌─────────────────────────┐  ┌──────────────────────────┐
│   HISTORY RECORDING     │  │  BROADCAST / AUTO-SAVE   │
│  (if user-interaction)  │  │  (based on session mode) │
│                         │  │                          │
│ AppHistoryService       │  │ ┌──────────────────────┐ │
│ - Add to undo stack     │  │ │ In Collaboration:    │ │
│ - Clear redo stack      │  │ │ → Broadcast via WS   │ │
│ - Track cell states     │  │ │   (AppDiagramOp...   │ │
│                         │  │ │    Broadcaster)      │ │
└─────────────────────────┘  │ └──────────────────────┘ │
                             │ ┌──────────────────────┐ │
                             │ │ Solo Mode:           │ │
                             │ │ → Auto-save to REST  │ │
                             │ │   (AppPersistence    │ │
                             │ │    Coordinator)      │ │
                             │ └──────────────────────┘ │
                             └──────────────────────────┘
```

---

## Operation Flow Details

### 1. User Interaction Flow

**Trigger**: User clicks "Add Process Node" button

```typescript
// 1. UI Handler in DFD Component
onAddProcess(): void {
  this.appDfdOrchestrator.addNode('process').subscribe({
    next: (result) => {
      if (result.success) {
        this.logger.info('Node added successfully');
      }
    }
  });
}

// 2. Orchestrator creates GraphOperation
addNode(nodeType: NodeType): Observable<OperationResult> {
  const operation: CreateNodeOperation = {
    type: 'create-node',
    source: 'user-interaction', // ← SOURCE SET
    nodeType,
    position: this._calculatePosition(),
    // ...
  };

  return this.graphOperationManager.execute(operation, this._operationContext);
}

// 3. GraphOperationManager routes to executor
execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult> {
  // Route based on operation type
  const executor = this._getExecutorForOperation(operation);
  return executor.execute(operation, context);
}

// 4. NodeOperationExecutor performs X6 changes
execute(operation: CreateNodeOperation, context: OperationContext): Observable<OperationResult> {
  // Call infrastructure service
  const node = this.infraNodeService.createNode(operation.nodeType, operation.position);

  return of({
    success: true,
    operationType: 'create-node',
    affectedCellIds: [node.id],
    timestamp: Date.now()
  });
}

// 5. Post-operation processing (in orchestrator)
// - Record in history (because source is 'user-interaction')
// - Trigger broadcast (if in session) OR auto-save (if solo mode)
```

### 2. Remote Collaboration Flow

**Trigger**: Remote user adds a node, server sends WebSocket message

```typescript
// 1. WebSocket message received
// InfraDfdWebsocketAdapter emits domain event

// 2. AppStateService processes event
// Emits on applyOperationEvents$ observable

// 3. AppRemoteOperationHandler subscribes and converts
this.appStateService.applyOperationEvents$.subscribe(event => {
  // Convert CellOperation (WebSocket) → GraphOperation
  const graphOp: CreateNodeOperation = {
    type: 'create-node',
    source: 'remote-collaboration', // ← SOURCE SET
    nodeType: this._extractNodeType(event.operation),
    position: event.operation.cell.position,
    // ...
  };

  // Execute through unified pipeline
  this.graphOperationManager.execute(graphOp, this._operationContext).subscribe();
});

// 4-5. Same as user interaction flow, but:
// - History NOT recorded (source is 'remote-collaboration')
// - NOT broadcast (already came from WebSocket)
// - NOT auto-saved (remote user is responsible for their changes)
```

### 3. Diagram Load Flow

**Trigger**: User navigates to diagram, or resync occurs

```typescript
// 1. Load triggered in orchestrator
loadDiagram(diagramId: string): Observable<OperationResult> {
  // Fetch diagram data from server
  return this.appDiagramService.loadDiagram(diagramId).pipe(
    switchMap(loadResult => {
      if (!loadResult.success || !loadResult.diagram?.cells) {
        return throwError(() => new Error('Failed to load diagram'));
      }

      // Create load operation
      const operation: LoadDiagramOperation = {
        type: 'load-diagram',
        source: 'diagram-load', // ← SOURCE SET
        cells: loadResult.diagram.cells,
        clearExisting: true
      };

      return this.graphOperationManager.execute(operation, this._operationContext);
    })
  );
}

// 2-5. Same pipeline, but:
// - History NOT recorded (source is 'diagram-load')
// - NOT broadcast
// - NOT auto-saved
// - State flags set (isDiagramLoading = true) to suppress other operations
```

### 4. Undo/Redo Flow

**Trigger**: User clicks Undo button

```typescript
// 1. UI handler calls orchestrator
onUndo(): void {
  this.appDfdOrchestrator.undo().subscribe({
    next: (result) => {
      if (result.success) {
        this.logger.info('Undo completed');
      }
    }
  });
}

// 2. Orchestrator delegates to history service
undo(): Observable<OperationResult> {
  return this.appHistoryService.undo();
}

// 3. AppHistoryService converts history entry to operations
undo(): Observable<OperationResult> {
  const entry = this._undoStack.pop();
  if (!entry) {
    return throwError(() => new Error('Nothing to undo'));
  }

  // Convert previousCells (desired state) to GraphOperations
  const operations = this._convertCellsToOperations(
    entry.previousCells,
    entry.cells,
    'undo-redo' // ← SOURCE SET
  );

  // Execute all operations
  return this._executeOperations(operations).pipe(
    tap(() => {
      // Move entry to redo stack
      this._redoStack.push(entry);
    })
  );
}

// 4-5. Operations executed through same pipeline, but:
// - History NOT recorded (source is 'undo-redo')
// - Broadcast/auto-save DOES occur (user action, just indirect)
```

---

## Service Responsibilities

### AppDfdOrchestrator

**Role**: High-level coordination and public API

- Provides public methods for all graph operations
- Creates GraphOperation objects with appropriate source
- Manages operation context and state
- Delegates to GraphOperationManager for execution
- Coordinates post-operation processing

**Does NOT**: Directly modify graph, handle history, or manage persistence

### GraphOperationManager

**Role**: Operation routing and lifecycle management

- Routes operations to appropriate executors
- Provides consistent OperationContext
- Handles operation errors and retries
- Emits operation events (started, completed, failed)

**Does NOT**: Know about history, broadcasting, or persistence

### Operation Executors

**Role**: Execute specific operation types

- Perform actual graph modifications via infrastructure services
- Return OperationResult with affected cells
- Handle operation-specific validation and logic

**Does NOT**: Record history, broadcast, or trigger persistence

### AppOperationStateManager

**Role**: Manage operation state flags and coordination

- Tracks `isApplyingRemoteChange`, `isDiagramLoading`, `isUndoRedoOperation`
- Provides `executeRemoteOperation()` for operations with suppressed flags
- Tracks drag completion for history coordination
- Provides utilities for executing operations with specific state

**Does NOT**: Modify graph or record history directly

### AppHistoryService

**Role**: Custom undo/redo history management

- Maintains undo and redo stacks
- Adds history entries after user interactions (called by orchestrator)
- Executes undo/redo by converting history to operations
- Emits `historyStateChange$` events when stacks change

**Does NOT**: Trigger persistence directly (orchestrator handles this)

### AppRemoteOperationHandler

**Role**: Handle operations from remote collaboration

- Subscribes to WebSocket operation events
- Converts CellOperation → GraphOperation
- Routes through GraphOperationManager with source='remote-collaboration'

**Does NOT**: Broadcast back (would create infinite loop)

### AppDiagramOperationBroadcaster

**Role**: Broadcast operations to remote users

- Listens to X6 graph events (for legacy compatibility)
- Converts X6 events to CellOperation format
- Sends operations via WebSocket
- **Only active during collaboration sessions**

**Note**: Runs independently from the main operation pipeline for now

### AppPersistenceCoordinator

**Role**: Save diagram to server or local storage

- Chooses between REST and WebSocket persistence strategies
- Handles REST API saves (solo mode)
- Handles WebSocket saves (collaboration mode via `diagram_state_sync`)
- Provides local storage fallback
- Manages save throttling and debouncing

**Called by**: AppDfdOrchestrator (when history changes trigger auto-save)

---

## State Flags and Coordination

### Operation State Flags

Managed by `AppOperationStateManager`:

```typescript
interface OperationState {
  isApplyingRemoteChange: boolean; // Suppress history and broadcast
  isDiagramLoading: boolean; // Suppress history and broadcast
  isUndoRedoOperation: boolean; // Suppress history, allow broadcast/save
}
```

### How Flags Affect Processing

```typescript
// In AppDfdOrchestrator._handleOperationCompleted()
private _handleOperationCompleted(event: OperationCompletedEvent): void {
  const { operation, result } = event;

  // Only record history for successful user interactions
  if (!result.success || !this._shouldRecordInHistory(operation)) {
    return;
  }

  // Create and add history entry
  const historyEntry = this._createHistoryEntry(operation, affectedCells);
  this.appHistoryService.addHistoryEntry(historyEntry);

  // History service emits historyStateChange$ event
  // which triggers auto-save via separate subscription
}

// In AppHistoryService.addHistoryEntry()
addHistoryEntry(entry: HistoryEntry): void {
  // Add to undo stack
  this._undoStack.push(entry);
  this._redoStack = []; // Clear redo

  // Emit state change event
  this._emitHistoryStateChange();

  // Orchestrator subscribes to historyStateChange$ and triggers auto-save
}

// In AppDfdOrchestrator._setupEventIntegration()
this.appHistoryService.historyStateChange$.subscribe(event => {
  this._markUnsavedChanges();
  this._triggerAutoSave(event.undoStackSize);
});
```

### Flag Lifecycle Examples

**User Action**:

```typescript
// No flags set (default state)
isApplyingRemoteChange = false
isDiagramLoading = false
→ History recorded ✓
→ Broadcast/auto-save triggered ✓
```

**Remote Operation**:

```typescript
// Set by AppRemoteOperationHandler before executing
isApplyingRemoteChange = true
→ History NOT recorded ✓
→ Broadcast NOT triggered ✓
```

**Diagram Load**:

```typescript
// Set by AppDiagramLoadingService
isDiagramLoading = true
→ History NOT recorded ✓
→ Broadcast NOT triggered ✓
```

**Undo/Redo**:

```typescript
// Set by AppHistoryService during undo/redo
isUndoRedoOperation = true
→ History NOT recorded ✓ (prevent undo-of-undo)
→ Broadcast/auto-save triggered ✓ (user action, needs sync)
```

---

## History Entry Format

History entries store complete cell state for reliable undo/redo:

```typescript
interface HistoryEntry {
  id: string; // Unique ID for this history entry
  timestamp: number; // When the change occurred
  operationType: HistoryOperationType; // Type of operation
  description: string; // Human-readable description

  // Cell states (WebSocket Cell format)
  cells: Cell[]; // New cell states (for redo)
  previousCells: Cell[]; // Previous cell states (for undo)

  // Additional metadata
  userId?: string; // User who made the change
  operationId?: string; // WebSocket operation ID
  metadata?: {
    nodeIds?: string[]; // IDs of affected nodes
    edgeIds?: string[]; // IDs of affected edges
    dragId?: string; // For grouped move operations
  };
}
```

### Example History Entry

```typescript
{
  id: "hist_1698765432000_a1b2c3",
  timestamp: 1698765432000,
  operationType: "move-node",
  description: "Move Process Node",

  cells: [{
    id: "node_123",
    shape: "process",
    position: { x: 250, y: 300 },
    size: { width: 120, height: 60 },
    attrs: { /* ... */ },
    // ...
  }],

  previousCells: [{
    id: "node_123",
    shape: "process",
    position: { x: 100, y: 150 }, // ← Previous position
    size: { width: 120, height: 60 },
    attrs: { /* ... */ },
    // ...
  }],

  metadata: {
    nodeIds: ["node_123"],
    dragId: "drag_1698765430000"
  }
}
```

---

## Benefits of Unified Architecture

### 1. Consistency

- All operations follow same path
- No "special cases" or divergent code paths
- Easier to reason about system behavior

### 2. Testability

- Single pipeline to test
- Mock at clear boundaries
- Operation executors are pure functions

### 3. Observability

- All operations emit events
- Easy to track operation flow
- Debug with operation logs

### 4. Extensibility

- Add new operation types easily
- New sources integrate naturally
- Executors can be composed

### 5. Collaboration Support

- Remote operations integrate seamlessly
- Conflict resolution at operation level
- State synchronization is consistent

### 6. History Management

- Graph-level operations (not X6 events)
- Reliable undo/redo
- Integrated with persistence

---

## Migration from X6 History

### What Changed

**Before (X6 History)**:

```
User Action → X6 Graph → History Plugin → Auto-save
Remote Op → ??? (BROKEN) → X6 Graph
Load → X6 Graph → Clear History
```

**After (Unified Pipeline)**:

```
All Sources → GraphOperation → Pipeline → History Service → Broadcast/Save
```

### Benefits of Migration

1. **Fixed Remote Operations**: Now properly routed through pipeline
2. **Reliable History**: Graph-level operations instead of low-level X6 events
3. **Coordinated Persistence**: History knows about collaboration mode
4. **No More X6 History Plugin**: One less dependency, more control
5. **Better Separation**: Clear responsibilities for each service

---

## Future Enhancements

### Potential Improvements

1. **Operation Batching**: Group related operations (e.g., multi-select drag)
2. **Conflict Resolution**: Handle concurrent edits intelligently
3. **Optimistic Updates**: Apply local changes immediately, sync later
4. **Operation Queuing**: Handle slow network conditions gracefully
5. **History Compression**: Combine similar consecutive operations
6. **Selective Sync**: Only sync changed cells, not entire diagram

### Extension Points

- Add new operation types by implementing executors
- Add new sources by setting appropriate source flag
- Add custom processing in post-operation phase
- Extend history format with additional metadata

---

## Related Documentation

- [Custom History Implementation Plan](../../implementation/custom-history-implementation-plan.md)
- [Service Provisioning Standards](./service-provisioning.md)
- [Architecture Overview](./overview.md)
- [WebSocket Integration](../../developer/integration/CLIENT_INTEGRATION_GUIDE.md)
