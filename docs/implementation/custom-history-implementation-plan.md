# Custom History System & Unified Operation Flow - Implementation Plan

**Status**: In Progress
**Started**: 2025-10-27
**Goal**: Remove X6 history, implement custom history management, fix remote operations, and maximize operation flow convergence

---

## Overview
This plan will:
1. **Remove X6 history plugin** and implement our own custom history management
2. **Fix broken remote operations path** by connecting WebSocket operations to the graph
3. **Maximize convergence** by routing ALL changes through a unified operation pipeline
4. **Integrate history, broadcasting, and auto-save** into a cohesive system

---

## Service Architecture

### Final Service Structure (Keep 4 Services, Add 2 New)

1. **`AppDfdOrchestrator`** (existing, ~1446 lines)
   - High-level coordination, initialization, operation routing
   - Depends on: OperationStateManager, HistoryService

2. **`AppOperationStateManager`** (rename from AppGraphHistoryCoordinator, ~400 lines)
   - Manages operation state flags (isRemote, isDragging, isLoading)
   - Drag tracking and completion detection
   - `executeRemoteOperation()` and `executeBatchOperation()` methods
   - Captures pre-operation state for history

3. **`AppHistoryService`** (NEW, ~500 lines)
   - Maintains undo/redo stacks
   - Adds history entries
   - Performs undo/redo operations
   - **Coordinates** broadcast vs auto-save based on session state
   - Depends on: Broadcaster, PersistenceCoordinator

4. **`AppRemoteOperationHandler`** (NEW, ~200 lines)
   - Subscribes to `appStateService.applyOperationEvents$`
   - Converts `CellOperation` (WebSocket format) to `GraphOperation` (internal format)
   - Routes operations through `GraphOperationManager` with source `'remote-collaboration'`

5. **`AppDiagramOperationBroadcaster`** (existing, 443 lines, keep separate)
   - X6 event listening and filtering
   - WebSocket operation broadcasting
   - Atomic operation batching
   - Only active during collaboration

6. **`AppPersistenceCoordinator`** (existing, 290 lines, keep separate)
   - REST/WebSocket save/load
   - localStorage fallback
   - Used in both solo and collaboration modes

---

## Phase 1: Fix Remote Operations Path (Immediate Bug Fix)

**Status**: ⏳ Not Started

### 1.1 Create Remote Operation Handler Service
**File**: `src/app/pages/dfd/application/services/app-remote-operation-handler.service.ts`

This new service will:
- Subscribe to `appStateService.applyOperationEvents$`
- Convert `CellOperation` (WebSocket format) to `GraphOperation` (internal format)
- Route operations through `GraphOperationManager` with source set to `'remote-collaboration'`
- Handle batch operations from remote users

**Tasks**:
- [ ] Create service file
- [ ] Implement CellOperation → GraphOperation conversion
- [ ] Subscribe to `applyOperationEvents$` in `initialize()` method
- [ ] Add to DFD component providers
- [ ] Test remote operation application

### 1.2 Initialize Remote Handler in Orchestrator
**File**: `src/app/pages/dfd/application/services/app-dfd-orchestrator.service.ts`

Update `AppDfdOrchestrator.initialize()` to create and initialize the remote operation handler.

**Tasks**:
- [ ] Inject `AppRemoteOperationHandler` in constructor
- [ ] Call `remoteHandler.initialize()` during DFD initialization
- [ ] Ensure proper cleanup in `dispose()`

---

## Phase 2: Remove X6 History Plugin

**Status**: ⏳ Not Started

### 2.1 Remove History Plugin Initialization
**File**: `src/app/pages/dfd/infrastructure/adapters/infra-x6-graph.adapter.ts`

- Remove `History` import from `@antv/x6-plugin-history`
- Remove history plugin from graph initialization (keep clipboard plugin)
- Remove history plugin configuration

**Tasks**:
- [ ] Remove History import
- [ ] Remove history plugin use statement from graph initialization
- [ ] Keep Clipboard plugin intact
- [ ] Remove any history-related graph configuration options

### 2.2 Update Services that Reference X6 History

**Files to update**:
- `app-graph-history-coordinator.service.ts` - Remove all X6 history plugin interactions (will be renamed)
- `infra-x6-history.adapter.ts` - Remove X6 history interactions, keep event infrastructure
- `infra-visual-effects.service.ts` - Remove history plugin disable/enable calls
- `dfd.state.ts` - Remove History import

**Tasks**:
- [ ] Update `app-graph-history-coordinator.service.ts` (remove X6 history plugin calls)
- [ ] Update `infra-x6-history.adapter.ts` (remove X6-specific code)
- [ ] Update `infra-visual-effects.service.ts` (remove history disable/enable)
- [ ] Update `dfd.state.ts` (remove History type import)

### 2.3 Update History Debug Dialog
**File**: `src/app/pages/dfd/presentation/components/x6-history-dialog/`

Transform this component to display our custom history instead of X6 history.

**Tasks**:
- [ ] Update component to inject `AppHistoryService`
- [ ] Display undo/redo stack contents
- [ ] Show operation type, timestamp, affected cells
- [ ] Update template to show custom history data
- [ ] Rename component to `history-dialog` (remove x6 prefix)

---

## Phase 3: Implement Custom History System

**Status**: ⏳ Not Started

### 3.1 Define History Data Structures
**File**: `src/app/pages/dfd/types/history.types.ts` (NEW)

```typescript
/**
 * History entry representing a single user action
 * Each entry contains the cells affected and their states
 */
export interface HistoryEntry {
  id: string;
  timestamp: number;
  operationType: HistoryOperationType;
  description: string; // e.g., "Add Process Node", "Move 3 Nodes"

  // The new state of affected cells (for redo)
  cells: Cell[]; // WebSocket Cell format - matches diagram operations

  // The previous state of affected cells (for undo)
  previousCells: Cell[];

  // Metadata
  userId?: string;
  operationId?: string;
}

export type HistoryOperationType =
  | 'add-node'
  | 'add-edge'
  | 'move-node'
  | 'resize-node'
  | 'change-vertices'
  | 'change-label'
  | 'change-edge-endpoint'
  | 'delete'
  | 'batch'
  | 'remote-operation'; // Special case - don't trigger broadcast

export interface HistoryState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  maxStackSize: number; // e.g., 50 entries
  currentIndex: number;
}
```

**Tasks**:
- [ ] Create `history.types.ts` file
- [ ] Define `HistoryEntry` interface
- [ ] Define `HistoryOperationType` enum
- [ ] Define `HistoryState` interface
- [ ] Add JSDoc documentation

### 3.2 Create Custom History Manager Service
**File**: `src/app/pages/dfd/application/services/app-history.service.ts` (NEW)

Responsibilities:
- Maintain undo/redo stacks
- Add history entries for user operations
- Perform undo/redo by converting history entries back to operations
- Emit observables for `canUndo`, `canRedo`, `historyChanged$`
- **Integration point**: When adding history, also trigger broadcast OR auto-save based on session state

Key methods:
```typescript
addHistoryEntry(entry: HistoryEntry): void
undo(): Observable<OperationResult>
redo(): Observable<OperationResult>
canUndo(): boolean
canRedo(): boolean
clear(): void
getUndoStack(): HistoryEntry[]
getRedoStack(): HistoryEntry[]
```

**Tasks**:
- [ ] Create service file
- [ ] Implement undo/redo stack management
- [ ] Implement `addHistoryEntry()` with stack size limits
- [ ] Implement `undo()` - convert history entry to operations
- [ ] Implement `redo()` - convert history entry to operations
- [ ] Implement `canUndo()` / `canRedo()`
- [ ] Create observables for history state changes
- [ ] Add collaboration session detection
- [ ] Integrate broadcast/auto-save triggers
- [ ] Add to DFD component providers

### 3.3 Rename and Refocus AppGraphHistoryCoordinator
**File**: `app-graph-history-coordinator.service.ts` → `app-operation-state-manager.service.ts`

Transform this service to work with our custom history:
- Remove all X6 history plugin interactions
- Keep `executeRemoteOperation()` method (it's still useful for suppressing history)
- Keep `executeBatchOperation()` method
- Add `capturePreOperationState(cellIds)` method to snapshot cell states before changes
- Keep drag tracking functionality
- Update references throughout codebase

**Tasks**:
- [ ] Rename file to `app-operation-state-manager.service.ts`
- [ ] Rename class to `AppOperationStateManager`
- [ ] Remove all X6 history plugin calls
- [ ] Add `capturePreOperationState()` method
- [ ] Keep drag tracking logic
- [ ] Update all imports/references throughout codebase
- [ ] Update DFD component providers

---

## Phase 4: Unified Operation Flow Architecture

**Status**: ⏳ Not Started

### 4.1 Document Unified Pipeline

All changes will flow through this unified pipeline:

```
User Action / Load / Remote / Undo-Redo
              ↓
    [Convert to GraphOperation]
              ↓
    GraphOperationManager.execute()
              ↓
    [Executors perform X6 changes]
              ↓
         X6 Graph Updated
              ↓
   [Post-operation processing]
              ↓
   ┌─────────┴──────────┐
   │                    │
   ├→ [Capture History] │
   │   (if source != remote) │
   │                    │
   └→ [Broadcast OR AutoSave]
      - If in session → Broadcast
      - If not in session → Auto-save
```

### 4.2 Operation Sources and History Behavior

| Source | Record History? | Broadcast? | Auto-Save? |
|--------|----------------|------------|------------|
| `user-interaction` | ✅ Yes | ✅ If in session | ✅ If not in session |
| `remote-collaboration` | ❌ No | ❌ No | ❌ No |
| `diagram-load` | ❌ No | ❌ No | ❌ No |
| `undo-redo` | ❌ No | ✅ If in session | ✅ If not in session |

### 4.3 Update Operation Executors
**Files**: All executors in `src/app/pages/dfd/application/executors/`

Each executor will:
1. **Before execution**: Receive pre-operation state in context if source is `user-interaction`
2. **Execute**: Perform the X6 graph changes
3. **After execution**: Return `OperationResult` with affected cell IDs and new cell states
4. Executors should NOT directly interact with history - that's the orchestrator's job

**Tasks**:
- [ ] Update `NodeOperationExecutor` to capture/return cell states
- [ ] Update `EdgeOperationExecutor` to capture/return cell states
- [ ] Update `BatchOperationExecutor` to aggregate cell states
- [ ] Update `LoadDiagramExecutor` to handle load operations
- [ ] Update `OperationContext` type to include pre-operation state
- [ ] Update `OperationResult` type to include new cell states

---

## Phase 5: History Recording Integration

**Status**: ⏳ Not Started

### 5.1 Post-Operation History Recording
**File**: `app-dfd-orchestrator.service.ts`

After each operation completes:
```typescript
private _handleOperationCompleted(
  operation: GraphOperation,
  result: OperationResult,
  context: OperationContext
): void {
  if (!result.success) return;

  // Record history for user interactions only
  if (operation.source === 'user-interaction') {
    const historyEntry = this._createHistoryEntry(operation, result);
    this.historyService.addHistoryEntry(historyEntry);
  }

  // Trigger broadcast or auto-save (history service will handle this)
}
```

**Tasks**:
- [ ] Subscribe to `graphOperationManager.operationCompleted$`
- [ ] Implement `_handleOperationCompleted()` handler
- [ ] Implement `_createHistoryEntry()` conversion method
- [ ] Extract affected cells from graph after operation
- [ ] Use pre-operation state from context for undo data

### 5.2 History Entry Creation from Operations
The orchestrator will convert `OperationResult` to `HistoryEntry`:
- Extract affected cells from graph using `result.affectedCellIds`
- Use `previousCellState` from context (captured before operation)
- Create forward/reverse cell arrays for undo/redo
- Generate human-readable description

**Tasks**:
- [ ] Implement cell extraction from graph by ID
- [ ] Implement operation → description mapping
- [ ] Handle batch operations (combine descriptions)
- [ ] Handle multi-cell operations (e.g., "Move 3 Nodes")

---

## Phase 6: Undo/Redo Implementation

**Status**: ⏳ Not Started

### 6.1 Undo Operation Flow
```
User clicks Undo
       ↓
historyService.undo()
       ↓
Pop entry from undoStack
       ↓
Convert previousCells to GraphOperations
       ↓
Execute operations with source='undo-redo'
       ↓
Push entry to redoStack
       ↓
Broadcast/Auto-save (but DON'T record in history)
```

**Tasks**:
- [ ] Implement `undo()` in `AppHistoryService`
- [ ] Convert `HistoryEntry.previousCells` to `GraphOperation[]`
- [ ] Execute operations via `GraphOperationManager`
- [ ] Use source `'undo-redo'` to prevent history recording
- [ ] Move entry from undo to redo stack
- [ ] Emit history state change events

### 6.2 Redo Operation Flow
Similar to undo, but uses `cells` instead of `previousCells`.

**Tasks**:
- [ ] Implement `redo()` in `AppHistoryService`
- [ ] Convert `HistoryEntry.cells` to `GraphOperation[]`
- [ ] Execute operations via `GraphOperationManager`
- [ ] Use source `'undo-redo'` to prevent history recording
- [ ] Move entry from redo to undo stack
- [ ] Emit history state change events

### 6.3 Update UI Undo/Redo Handlers
**File**: `src/app/pages/dfd/presentation/components/dfd.component.ts`

Replace calls to `graphAdapter.undo()` / `graphAdapter.redo()` with orchestrator calls.

**Tasks**:
- [ ] Update `onUndo()` to call `appDfdOrchestrator.undo()`
- [ ] Update `onRedo()` to call `appDfdOrchestrator.redo()`
- [ ] Subscribe to history state changes from `AppHistoryService`
- [ ] Update `canUndo` and `canRedo` component properties

### 6.4 Update InfraX6GraphAdapter
**File**: `infra-x6-graph.adapter.ts`

- Remove `undo()` and `redo()` methods (or make them call orchestrator)
- Remove `historyChanged$` observable (replaced by AppHistoryService)
- Remove `historyModified$` observable

**Tasks**:
- [ ] Remove `undo()` method
- [ ] Remove `redo()` method
- [ ] Remove `historyChanged$` observable
- [ ] Remove `historyModified$` observable
- [ ] Remove history-related event handling

### 6.5 Add Undo/Redo Methods to Orchestrator
**File**: `app-dfd-orchestrator.service.ts`

Add public methods that delegate to history service.

**Tasks**:
- [ ] Add `undo(): Observable<OperationResult>` method
- [ ] Add `redo(): Observable<OperationResult>` method
- [ ] Add `canUndo(): boolean` method
- [ ] Add `canRedo(): boolean` method
- [ ] Delegate to `AppHistoryService`

---

## Phase 7: Broadcast & Auto-Save Integration

**Status**: ⏳ Not Started

### 7.1 Unified Persistence Trigger in History Service
**File**: `app-history.service.ts`

When adding history entries:
```typescript
addHistoryEntry(entry: HistoryEntry): void {
  // Add to stack
  this._undoStack.push(entry);
  this._redoStack = []; // Clear redo stack

  // Apply stack size limit
  if (this._undoStack.length > this._maxStackSize) {
    this._undoStack.shift();
  }

  // Determine action based on session state
  if (this._isInCollaborationSession()) {
    this._broadcastOperation(entry);
  } else {
    this._triggerAutoSave();
  }

  // Emit history changed
  this._emitHistoryStateChanged();
}
```

**Tasks**:
- [ ] Implement collaboration session detection
- [ ] Implement `_broadcastOperation()` to call broadcaster
- [ ] Implement `_triggerAutoSave()` to call persistence coordinator
- [ ] Handle errors from broadcast/save operations

### 7.2 Integration with Existing Services
- `AppDiagramOperationBroadcaster` - Called by history service when in session
- `AppPersistenceCoordinator` - Called by history service when NOT in session
- Both use the same `Cell[]` format from history entries

**Tasks**:
- [ ] Update `AppDiagramOperationBroadcaster` to accept `Cell[]` directly
- [ ] Update `AppPersistenceCoordinator` to accept trigger from history service
- [ ] Ensure both services are properly injected in `AppHistoryService`

---

## Phase 8: Supported History Operations

**Status**: ⏳ Not Started

### 8.1 Operations to Track
Based on requirements and UI capabilities:

**Node Operations**:
1. ✅ Add node (any type: actor, process, store, security-boundary, text-box)
2. ✅ Move node (single or multiple via drag)
3. ✅ Resize node
4. ✅ Delete node(s)
5. ✅ Change node label/edit text
6. ✅ Change node properties (style, color, etc.)
7. ✅ Embed/un-embed nodes (drag into/out of security boundary)

**Edge Operations**:
8. ✅ Add edge
9. ✅ Change edge vertices (bend points)
10. ✅ Change edge endpoint (reconnect source or target)
11. ✅ Change edge label
12. ✅ Delete edge(s)

**Batch Operations**:
13. ✅ Multi-select delete
14. ✅ Multi-node move (drag selection)
15. ✅ Copy-paste operations (create multiple cells)
16. ✅ Cut-paste operations (delete + create)

**Special Cases**:
17. ✅ Remote diagram operations (tracked but NOT re-broadcast)
18. ❌ Diagram load (NOT tracked)
19. ❌ Auto-corrections (NOT tracked)

### 8.2 Operation Type Mapping
Document how each X6 event maps to a history operation type:

| X6 Event | History Operation Type | Description |
|----------|----------------------|-------------|
| `node:added` (user) | `add-node` | User adds node via palette |
| `node:moved` (drag end) | `move-node` | User drags node(s) |
| `node:resized` | `resize-node` | User resizes node |
| `node:change:data` (label) | `change-label` | User edits label text |
| `edge:added` (user) | `add-edge` | User creates edge |
| `edge:change:vertices` | `change-vertices` | User adds/moves bend points |
| `edge:change:source/target` | `change-edge-endpoint` | User reconnects edge |
| `cell:removed` (user) | `delete` | User deletes cell(s) |
| Multiple simultaneous | `batch` | Multiple operations together |

**Tasks**:
- [ ] Document all operation type mappings
- [ ] Implement mapping logic in history entry creation
- [ ] Add tests for each operation type
- [ ] Verify correct history entry creation for each type

---

## Phase 9: State Flag Management

**Status**: ⏳ Not Started

### 9.1 Flags to Control Behavior
We'll use these flags (already partially in place):

```typescript
interface OperationFlags {
  isApplyingRemoteChange: boolean;  // Suppress history + broadcast
  isDiagramLoading: boolean;         // Suppress history + broadcast
  isUndoRedoOperation: boolean;      // Suppress history, allow broadcast/save
}
```

### 9.2 Flag Setting Points
- `isApplyingRemoteChange`: Set in `executeRemoteOperation()` and remote operation handler
- `isDiagramLoading`: Set in `DiagramLoadingService.loadCellsIntoGraph()`
- `isUndoRedoOperation`: Set when executing undo/redo operations

**Tasks**:
- [ ] Verify `isApplyingRemoteChange` is properly set (already done in recent fix)
- [ ] Add `isUndoRedoOperation` flag to `AppStateService`
- [ ] Set flag in `AppHistoryService` during undo/redo
- [ ] Clear flag after undo/redo completes
- [ ] Update history recording logic to check all flags

---

## Phase 10: Testing & Migration

**Status**: ⏳ Not Started

### 10.1 Unit Tests to Update
**Files**:
- `app-graph-history-coordinator.service.spec.ts` → rename to `app-operation-state-manager.service.spec.ts`
- All executor tests - Ensure they work without X6 history
- Create new tests for `app-history.service.spec.ts`
- Create new tests for `app-remote-operation-handler.service.spec.ts`

**Tasks**:
- [ ] Update/rename history coordinator tests
- [ ] Create `AppHistoryService` test suite
- [ ] Create `AppRemoteOperationHandler` test suite
- [ ] Test undo/redo functionality
- [ ] Test history entry creation
- [ ] Test stack size limits
- [ ] Test broadcast/save integration
- [ ] Update all executor tests

### 10.2 Integration Tests
- Test undo/redo functionality with real graph operations
- Test that remote operations don't create history entries
- Test that undo/redo triggers broadcast in collaboration mode
- Test that undo/redo triggers auto-save in solo mode
- Test that diagram load doesn't trigger operations

**Tasks**:
- [ ] Create integration test for undo/redo flow
- [ ] Test remote operation application
- [ ] Test collaboration mode broadcast
- [ ] Test solo mode auto-save
- [ ] Test diagram load without spurious operations

### 10.3 Migration Checklist
- [ ] Verify clipboard functionality still works (copy/paste)
- [ ] Verify undo/redo buttons update state correctly
- [ ] Verify auto-save triggers correctly
- [ ] Verify collaboration broadcasts correctly
- [ ] Verify no duplicate operations during diagram load
- [ ] Verify remote operations are applied correctly
- [ ] Verify history dialog shows correct information
- [ ] Test multi-node operations (drag selection, multi-delete)
- [ ] Test all operation types are properly tracked
- [ ] Performance test with large diagrams (50+ nodes)

---

## Implementation Order

1. ✅ **Phase 1** (Fix remote ops) - CRITICAL BUG FIX - **START HERE**
2. ⏳ **Phase 3** (Custom history types & service) - FOUNDATION
3. ⏳ **Phase 2** (Remove X6 history) - CLEANUP
4. ⏳ **Phase 4** (Unified pipeline) - ARCHITECTURE
5. ⏳ **Phase 5** (History recording) - INTEGRATION
6. ⏳ **Phase 6** (Undo/redo) - FEATURE
7. ⏳ **Phase 7** (Broadcast/save) - FEATURE
8. ⏳ **Phase 8** (Operation mapping) - COMPLETENESS
9. ⏳ **Phase 9** (State flags) - POLISH
10. ⏳ **Phase 10** (Testing) - VALIDATION

---

## Key Files to Create
1. ✅ `src/app/pages/dfd/types/history.types.ts`
2. ✅ `src/app/pages/dfd/application/services/app-history.service.ts`
3. ✅ `src/app/pages/dfd/application/services/app-remote-operation-handler.service.ts`

## Key Files to Rename
1. `app-graph-history-coordinator.service.ts` → `app-operation-state-manager.service.ts`
2. `x6-history-dialog` → `history-dialog` (directory and component)

## Key Files to Modify
1. `infra-x6-graph.adapter.ts` - Remove X6 history
2. `app-operation-state-manager.service.ts` (renamed) - Repurpose for custom history
3. `app-dfd-orchestrator.service.ts` - Add history recording & undo/redo
4. `dfd.component.ts` - Update undo/redo handlers
5. `app-diagram-operation-broadcaster.service.ts` - Integrate with history
6. `app-persistence-coordinator.service.ts` - Integrate with history
7. All executors - Add pre-operation state capture
8. `infra-x6-history.adapter.ts` - Remove X6-specific code
9. `infra-visual-effects.service.ts` - Remove history plugin calls
10. `dfd.state.ts` - Remove History import

## Key Files to Remove
None - all components will be repurposed or updated

---

## Benefits of This Approach

1. ✅ **Single source of truth** - All operations flow through one pipeline
2. ✅ **History matches operations** - Same Cell format used everywhere
3. ✅ **Clean separation** - History, broadcast, and save are properly integrated
4. ✅ **No more bugs** - Remote operations won't bypass the system
5. ✅ **Testable** - Each component has clear responsibilities
6. ✅ **Maintainable** - No reliance on X6 internal history implementation
7. ✅ **Flexible** - Easy to add new operation types or change behavior
8. ✅ **Debuggable** - Custom history dialog shows exactly what's happening

---

## Notes & Decisions

### Service Consolidation Decisions
- **Keep separate**: `AppDiagramOperationBroadcaster` and `AppPersistenceCoordinator`
  - Different technical mechanisms (event-driven vs imperative)
  - Different activation conditions (collaboration vs solo)
  - Coordinated through `AppHistoryService`

- **Keep separate**: `AppOperationStateManager` and `AppDfdOrchestrator`
  - Single Responsibility Principle
  - Orchestrator coordinates, state manager tracks operation context
  - Easier to test in isolation

### History Dialog
- Updated to show custom history instead of X6 history
- Displays undo/redo stacks
- Shows operation type, timestamp, affected cells
- Kept for debugging and transparency

### Naming Conventions
- `AppHistoryService` (not "Custom" - it's our only history service)
- `AppOperationStateManager` (renamed from AppGraphHistoryCoordinator)
- `AppRemoteOperationHandler` (new service for remote operations)
