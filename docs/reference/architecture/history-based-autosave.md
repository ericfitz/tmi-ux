# History-Based Auto-Save Architecture

## Overview

The TMI-UX auto-save system uses a **zero-debouncing, history-based architecture** that ensures no diagram changes are ever missed. Instead of using time delays and change thresholds, the system tracks X6's history stack and saves immediately when not already saving.

## Core Principles

### 1. Single Trigger Source
- **Only source**: X6 history events (`history:change`, `history:undo`, `history:redo`)
- **No operation-based triggers**: Graph operations no longer directly trigger saves
- **Natural batching**: X6's `batchUpdate()` creates single history entry for multiple operations

### 2. Zero Debouncing
- **Immediate execution**: Saves execute as soon as previous save completes
- **No artificial delays**: No `setTimeout`, `debounceTime`, or time thresholds
- **Queue management**: Prevents concurrent saves via `saveInProgress` flag

### 3. Dual Version Tracking

**Client-Side (History Index)**:
```typescript
interface SaveTracking {
  localHistoryIndex: number;        // Current: graph.history.commands.length
  lastSavedHistoryIndex: number;    // Last index successfully saved
  saveInProgress: boolean;
  pendingHistoryChanges: number;    // Queue depth
}
```

**Server-Side (Update Vector)**:
```typescript
interface SaveTracking {
  serverUpdateVector: number;        // Latest from server
  lastSavedUpdateVector: number;     // Last saved version
}
```

## Architecture Components

### 1. History Event Flow

```
X6 Graph Operation
    ↓
X6 batchUpdate() (natural batching)
    ↓
X6 History Event (change/undo/redo)
    ↓
infra-x6-history.adapter.ts
    ↓
    Emits: { historyIndex, isUndo, isRedo }
    ↓
app-dfd-orchestrator.service.ts
    ↓
    _triggerAutoSave(historyIndex, isUndo, isRedo)
    ↓
app-auto-save-manager.service.ts
    ↓
    trigger(historyIndex, context, isUndo, isRedo)
```

### 2. Save Decision Logic

```typescript
// Deduplication
if (historyIndex <= lastSavedHistoryIndex) {
  return of(false); // Already saved
}

// Queue depth check
const queueDepth = historyIndex - lastSavedHistoryIndex;
if (queueDepth > maxQueueDepth) {
  return of(false); // Queue too deep
}

// Concurrent save prevention
if (saveInProgress) {
  pendingHistoryChanges = queueDepth;
  return of(false); // Save in progress
}

// Execute save immediately
return executeAutoSave(...);
```

### 3. Dual-Mode Persistence

**REST Mode** (Solo editing):
```typescript
// PATCH to /api/v1/threat-models/{id}/diagrams/{id}/cells
// Response includes update_vector for idempotency
{
  success: true,
  metadata: {
    update_vector: 42,  // Server version
    clientHistoryIndex: 5,
    isUndo: false,
    isRedo: false
  }
}
```

**WebSocket Mode** (Collaboration):
```typescript
// For undo/redo, send history-operation message
{
  message_type: 'history_operation',
  operation_type: 'undo' | 'redo',
  message: 'resync_required'
}

// Regular changes already broadcast via cell-level events
```

### 4. Queue Processing

When a save completes, the system checks for pending changes:

```typescript
if (pendingHistoryChanges > 0) {
  const currentIndex = localHistoryIndex;
  if (currentIndex > lastSavedHistoryIndex) {
    // Trigger next save after brief delay to avoid tight loop
    setTimeout(() => {
      trigger(currentIndex, context, false, false);
    }, 0);
  }
}
```

## Key Interfaces

### AutoSaveContext
```typescript
interface AutoSaveContext {
  diagramId: string;
  threatModelId: string;
  userId: string;
  userEmail: string;
  userName: string;
  getDiagramData: () => any;  // Lazy evaluation
  preferredStrategy: 'rest' | 'websocket';
}
```

### AutoSavePolicy
```typescript
interface AutoSavePolicy {
  readonly mode: 'auto' | 'manual';
  readonly maxQueueDepth: number;     // Default: 100
  readonly maxRetryAttempts: number;  // Default: 3
}
```

**Removed from policy**:
- ❌ `debounceMs`
- ❌ `timeThresholdMs`
- ❌ `changeThreshold`
- ❌ `maxDelayMs`
- ❌ `'aggressive' | 'normal' | 'conservative'` modes

## Lazy Data Evaluation

To prevent stale data issues, diagram data is retrieved **when the save executes**, not when triggered:

```typescript
// ❌ OLD: Captured at trigger time (time T)
const context = {
  diagramData: graph.toJSON(), // Stale after debounce delay
};

// ✅ NEW: Callback evaluated at save time (time T+immediate)
const context = {
  getDiagramData: () => graph.toJSON(), // Always fresh
};
```

## Integration Points

### 1. History Adapter
**File**: `infra-x6-history.adapter.ts`

```typescript
graph.on('history:change', () => {
  const historyIndex = graph.history?.commands?.length || 0;
  this._historyModified$.next({
    historyIndex,
    isUndo: false,
    isRedo: false
  });
});

graph.on('history:undo', () => {
  const historyIndex = graph.history?.commands?.length || 0;
  this._historyModified$.next({
    historyIndex,
    isUndo: true,
    isRedo: false
  });
});
```

### 2. Orchestrator
**File**: `app-dfd-orchestrator.service.ts`

```typescript
private _setupEventIntegration(): void {
  // ONLY history-based trigger
  this.dfdInfrastructure.historyModified$.subscribe(
    ({ historyIndex, isUndo, isRedo }) => {
      this._markUnsavedChanges();
      this._triggerAutoSave(historyIndex, isUndo, isRedo);
    }
  );
}

private _triggerAutoSave(
  historyIndex: number,
  isUndo: boolean,
  isRedo: boolean
): void {
  const context = {
    // ...
    getDiagramData: () => this._getGraphData(),
    preferredStrategy: this._state$.value.collaborating
      ? 'websocket'
      : 'rest',
  };

  this.appAutoSaveManager
    .trigger(historyIndex, context, isUndo, isRedo)
    ?.subscribe?.();
}
```

### 3. State Service (Update Vector Tracking)
**File**: `app-state.service.ts`

```typescript
private _processStateCorrection(event: StateCorrectionEvent): void {
  // Update auto-save manager's server update_vector
  this._autoSaveManager.updateServerUpdateVector(event.update_vector);

  // Trigger resync
  this._updateSyncState({ isSynced: false, isResyncing: true });
  this._triggerResyncEvent$.next();
}
```

## Advantages

### 1. No Missed Changes
- **Problem**: Debouncing can miss rapid changes if data captured early
- **Solution**: History index ensures every X6 command is accounted for

### 2. Immediate Feedback
- **Problem**: 5+ second debounce delays cause "unsaved changes" anxiety
- **Solution**: Save starts immediately (queue prevents concurrent saves)

### 3. Natural Batching
- **Problem**: Need artificial change thresholds to avoid save spam
- **Solution**: X6's batchUpdate() naturally groups operations

### 4. Collaboration-Friendly
- **Problem**: Debounced saves conflict with real-time updates
- **Solution**: History operations (undo/redo) sent as WebSocket messages

### 5. Idempotency
- **Problem**: Network retries can duplicate saves
- **Solution**: History index + server update_vector provide deduplication

## Migration Notes

### Removed Concepts
- **Trigger events**: No more `AutoSaveTriggerEvent` with operation types
- **Change analyzers**: No significance calculation needed
- **Decision makers**: Simple queue depth check replaces complex logic
- **Debounce timers**: All fake timer tests removed

### API Changes

**Old**:
```typescript
trigger(event: AutoSaveTriggerEvent, context: AutoSaveContext)

setPolicyMode('aggressive' | 'normal' | 'conservative' | 'manual')

configure({
  enabled: boolean,
  debounceMs: number,
  changeThreshold: number
})
```

**New**:
```typescript
trigger(
  historyIndex: number,
  context: AutoSaveContext,
  isUndo: boolean,
  isRedo: boolean
)

setPolicyMode('auto' | 'manual')

enable() / disable()  // No configure()
setPolicy({ mode, maxQueueDepth, maxRetryAttempts })
```

## Testing Strategy

### Unit Tests
- **History index deduplication**: Save same index twice → second ignored
- **Queue management**: Concurrent saves prevented, pending processed
- **Update vector tracking**: Extracted from response, updated from WebSocket
- **Undo/redo metadata**: Flags correctly set in save operation

### Integration Tests
- **End-to-end flow**: Graph operation → history event → save → response
- **Queue processing**: Multiple rapid changes → sequential saves
- **Collaboration**: Undo in collaboration → WebSocket message sent

### Removed Tests
- ❌ Fake timer tests
- ❌ Debounce delay verification
- ❌ Change threshold tests
- ❌ Time-based batching tests

## Performance Characteristics

### Typical Save Latency
- **REST**: ~100-300ms (network RTT + DB write)
- **WebSocket**: ~10-50ms (broadcast to peers)

### Queue Behavior
- **Max depth**: 100 changes
- **Processing**: Sequential, ~100-300ms per save
- **Backpressure**: Rejects new triggers if queue > max depth

### Memory Usage
- **Minimal**: No timer references, no buffered changes
- **History stack**: Managed by X6 (configurable limit)

## Troubleshooting

### "Changes not being saved"
1. Check `saveInProgress` flag
2. Verify history index incrementing
3. Confirm auto-save enabled
4. Check queue depth not exceeded

### "Save spam"
1. Verify operations use `batchUpdate()`
2. Check for redundant history events
3. Review history index deduplication

### "Stale data in saves"
1. Confirm `getDiagramData()` callback used
2. Verify graph state at callback execution time
3. Check for race conditions in data serialization

## Future Enhancements

### Possible Improvements
1. **Retry with exponential backoff**: Currently immediate retry
2. **Offline queue persistence**: Save to IndexedDB when offline
3. **Conflict resolution**: Merge strategies for concurrent edits
4. **Performance metrics**: Track save latency, queue depth trends
5. **Compression**: Diff-based saves for large diagrams

## References

- Implementation plan: `docs/implementation/history-based-autosave-refactor.md`
- X6 History Plugin: https://x6.antv.antgroup.com/api/graph/history
- Auto-save manager: `src/app/pages/dfd/application/services/app-auto-save-manager.service.ts`
- REST strategy: `src/app/pages/dfd/infrastructure/strategies/infra-rest-persistence.strategy.ts`
- WebSocket strategy: `src/app/pages/dfd/infrastructure/strategies/infra-websocket-persistence.strategy.ts`
