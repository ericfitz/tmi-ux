# History-Based Auto-Save Refactor - Implementation Document

**Branch**: `feature/history-based-autosave-no-debouncing`
**Started**: 2025-10-05
**Status**: In Progress

## Executive Summary

Complete architectural refactor of the auto-save system to:
- Remove ALL debouncing and artificial delays
- Use X6 history events as the single source of truth
- Track both client history index and server update_vector
- Implement dual-mode persistence (REST vs WebSocket)
- Enable immediate saves with queue management

## Problem Statement

### Original Bug
Edges were not being saved because auto-save captured diagram data immediately when triggered, but executed the save 5+ seconds later (debounce delay). Newly created edges hadn't fully established in the X6 graph when data was captured.

### Root Causes
1. **Dual trigger paths**: Both operation-based and history-based triggers created confusion
2. **Early data capture**: Data captured when save triggered, not when save executed
3. **Artificial debouncing**: 5-second delays caused data loss window
4. **No version tracking**: No way to verify what was saved vs what changed

### Solution Approach
- Single trigger source: X6 history events only
- Lazy data evaluation: Get fresh data when save executes
- Zero debouncing: Immediate saves with queue management
- Version tracking: Client history index + server update_vector
- Natural batching: X6's batchUpdate() prevents save spam

## Architectural Changes

### Before
```
User Action
  ↓
Operation Manager → operation:completed → Trigger Auto-Save (capture data)
  ↓                                              ↓
X6 Graph Changes                          Wait 5 seconds (debounce)
  ↓                                              ↓
History Change → history:modified → Trigger Auto-Save (capture data)
                                                 ↓
                                          Execute save (stale data!)
```

### After
```
User Action
  ↓
Operation Manager → X6 Graph Changes
  ↓
X6 History Plugin
  ↓
history:change/undo/redo event (with index)
  ↓
Check: Save in progress?
  ↓ NO                    ↓ YES
Execute save immediately  Queue pending (track index)
  ↓ (get fresh data)          ↓
PATCH/WebSocket              Save completes → Process queue
  ↓
Update tracking (history index, update_vector)
```

## Implementation Phases

### Phase 1: History Event Enhancement
**Files**: `infra-x6-history.adapter.ts`, `infra-x6-graph.adapter.ts`, `app-dfd.facade.ts`

**Changes**:
1. Update `_historyModified$` observable type from `void` to:
   ```typescript
   { historyIndex: number; isUndo: boolean; isRedo: boolean }
   ```

2. Read history index from X6:
   ```typescript
   const historyIndex = (graph as any).history?.commands?.length || 0;
   ```

3. Detect undo/redo vs regular changes based on which event fired

4. Propagate type changes through facade and graph adapter

**Why**: We need to know the exact history index to track what's been saved, and we need to distinguish undo/redo for special handling in collaboration mode.

**Testing**: Verify observable emits correct values for each event type.

---

### Phase 2: Auto-Save Manager Rewrite
**File**: `app-auto-save-manager.service.ts`

**Remove Completely**:
- `debounceMs`, `timeThresholdMs`, `changeThreshold` from `AutoSavePolicy`
- `_triggerEvent$` observable with `debounceTime()`
- `_setupTriggerProcessing()` method
- `_processTrigger()` method
- `_shouldTriggerSave()` method with threshold checks
- `_scheduleAutoSave()` method with `setTimeout()`
- `_pendingSaveTimeout` property
- `_changesSinceLastSave` counter
- `AutoSaveTriggerEvent` interface (replaced with direct trigger call)

**Add New**:
```typescript
interface SaveTracking {
  localHistoryIndex: number;        // Current X6 history index
  lastSavedHistoryIndex: number;    // Last index we saved
  serverUpdateVector: number;        // Latest server version
  lastSavedUpdateVector: number;    // Last saved server version
  saveInProgress: boolean;           // Is a save running?
  pendingHistoryChanges: number;     // Count of queued changes
}

const DEFAULT_POLICIES = {
  auto: { mode: 'auto', maxQueueDepth: 100, maxRetryAttempts: 3 },
  manual: { mode: 'manual', maxQueueDepth: 0, maxRetryAttempts: 1 },
};
```

**New trigger() signature**:
```typescript
trigger(
  historyIndex: number,
  context: AutoSaveContext,
  isUndo = false,
  isRedo = false,
): Observable<boolean>
```

**Logic**:
1. Update `localHistoryIndex`
2. Check if already saved (index <= lastSavedHistoryIndex)
3. Check queue depth (prevent overflow)
4. If save in progress: mark pending, return
5. Otherwise: execute immediately

**New _executeAutoSave**:
- Set `saveInProgress = true`
- Get fresh data via `getDiagramData()` callback
- Add metadata: `clientHistoryIndex`, `serverUpdateVector`, `isUndo`, `isRedo`
- On success: Update `lastSavedHistoryIndex` and `serverUpdateVector` from response
- On complete: Check for pending changes, trigger recursively if needed
- On error: Reset state, don't retry automatically

**New method**:
```typescript
updateServerUpdateVector(updateVector: number): void
```
Called when receiving WebSocket state corrections to sync server version.

**Why**: This is the core of the refactor. By removing debouncing and tracking exact indices, we eliminate timing issues and ensure nothing is missed. The queue mechanism prevents overlapping saves while maintaining immediate responsiveness.

**Testing**:
- Test immediate save execution
- Test queue behavior when save in progress
- Test recursive save processing
- Test update_vector tracking
- Test undo/redo flag propagation

---

### Phase 3: WebSocket Strategy Enhancement
**File**: `infra-websocket-persistence.strategy.ts`

**Current**: Stub implementation that just returns success

**New**:
```typescript
save(operation: SaveOperation): Observable<SaveResult> {
  const isUndo = operation.metadata?.['isUndo'] === true;
  const isRedo = operation.metadata?.['isRedo'] === true;

  if (!this.webSocketAdapter.isConnected) {
    return throwError(() => new Error('WebSocket not connected'));
  }

  // For undo/redo, send history operation message
  if (isUndo || isRedo) {
    const message = {
      type: 'history-operation',
      operation_type: isUndo ? 'undo' : 'redo',
      diagram_id: operation.diagramId,
      user_id: operation.metadata?.['userId'],
      timestamp: Date.now(),
    };

    this.webSocketAdapter.send(message);

    return of({
      success: true,
      operationId: `ws-history-${Date.now()}`,
      diagramId: operation.diagramId,
      timestamp: Date.now(),
      metadata: {
        sentViaWebSocket: true,
        operationType: message.operation_type,
      },
    });
  }

  // Regular changes are already broadcast via cell events
  return of({
    success: true,
    operationId: `ws-save-${Date.now()}`,
    diagramId: operation.diagramId,
    timestamp: Date.now(),
  });
}
```

**Why**: In collaboration mode, undo/redo need to be broadcast to other users via WebSocket. Regular changes are already handled by cell-level events. This prevents double-broadcasting while ensuring undo/redo are synchronized.

**Testing**: Verify WebSocket messages sent for undo/redo operations.

---

### Phase 4: REST Strategy Update
**File**: `infra-rest-persistence.strategy.ts`

**Current**: Returns basic SaveResult

**New**: Extract and return `update_vector` from server response
```typescript
return this.threatModelService
  .patchDiagramCells(threatModelId, operation.diagramId, cells)
  .pipe(
    map((response) => ({
      success: true,
      operationId: `save-${Date.now()}`,
      diagramId: operation.diagramId,
      timestamp: Date.now(),
      metadata: {
        update_vector: response.update_vector,  // CRITICAL: Pass to auto-save manager
        cellsSaved: cells.length,
      },
    })),
    // ... error handling
  );
```

**Why**: The server's `update_vector` is needed for idempotency checking and conflict detection. By passing it through the save result, the auto-save manager can track it and use it for future operations.

**Testing**: Verify update_vector is extracted from response and included in metadata.

---

### Phase 5: Orchestrator Simplification
**File**: `app-dfd-orchestrator.service.ts`

**Remove**:
- `operationCompleted$` subscription in `_setupEventIntegration()`
- `_triggerAutoSave(operation: GraphOperation, result: OperationResult)` method
- `_triggerAutoSaveForBatch(operations, results)` method
- Calls to these methods in `executeOperation()` and `executeBatch()`

**Update _setupEventIntegration()**:
```typescript
private _setupEventIntegration(): void {
  // ONLY history-based trigger
  this.dfdInfrastructure.historyModified$.subscribe(({ historyIndex, isUndo, isRedo }) => {
    this._markUnsavedChanges();
    this._triggerAutoSave(historyIndex, isUndo, isRedo);
  });

  // Listen to save completion
  this.appAutoSaveManager.saveCompleted$.subscribe(result => {
    if (result.success) {
      this._updateState({
        hasUnsavedChanges: false,
        lastSaved: new Date(),
      });
    }
  });
}
```

**New _triggerAutoSave() signature**:
```typescript
private _triggerAutoSave(historyIndex: number, isUndo: boolean, isRedo: boolean): void {
  if (!this._initParams || !this.dfdInfrastructure.getGraph()) {
    return;
  }

  const autoSaveContext = {
    diagramId: this._initParams.diagramId,
    threatModelId: this._initParams.threatModelId,
    userId: this.authService.userId,
    userEmail: this.authService.userEmail,
    userName: this.authService.username,
    getDiagramData: () => this._getGraphData(),
    preferredStrategy: this._state$.value.collaborating ? 'websocket' : 'rest',
  };

  this.appAutoSaveManager.trigger(historyIndex, autoSaveContext, isUndo, isRedo)?.subscribe?.();
}
```

**Update executeOperation()**:
```typescript
return this.appGraphOperationManager.execute(operation, this._operationContext).pipe(
  tap(result => {
    if (result.success) {
      this._markUnsavedChanges();  // Keep dirty state tracking
      // REMOVE: this._triggerAutoSave() - history will trigger it
    } else {
      this._totalErrors++;
      this._updateStats();
    }
  }),
  // ... rest
);
```

**Update executeBatch()**: Same pattern - remove trigger call

**Clean up _getGraphData()**:
```typescript
private _getGraphData(): any {
  const graph = this.dfdInfrastructure.getGraph();
  if (!graph) {
    return { nodes: [], edges: [] };
  }

  const graphJson = graph.toJSON();
  const cells = graphJson.cells || [];

  // Simple logging - remove debug bloat
  this.logger.debug('Getting graph data for save', {
    totalCells: cells.length,
    nodes: cells.filter((c: any) => c.shape !== 'edge').length,
    edges: cells.filter((c: any) => c.shape === 'edge').length,
  });

  const nodes = cells
    .filter((cell: any) => cell.shape !== 'edge')
    .map((cell: any) => ({ ...cell, type: 'node' }));

  const edges = cells
    .filter((cell: any) => c.shape === 'edge')
    .map((cell: any) => ({ ...cell, type: 'edge' }));

  return { nodes, edges };
}
```

**Why**: Single trigger source eliminates confusion and redundancy. History events capture ALL changes (user and programmatic), so operation triggers are unnecessary. This massively simplifies the orchestrator.

**Testing**:
- Verify auto-save triggers only from history events
- Verify operations still mark dirty state
- Verify collaboration mode uses WebSocket strategy

---

### Phase 6: Collaboration Integration
**File**: `app-state.service.ts` or WebSocket event handlers

**Add**: When state correction received via WebSocket:
```typescript
this.appAutoSaveManager.updateServerUpdateVector(event.update_vector);
```

**Why**: When collaborating, the server may send state corrections with newer update_vectors. We need to track these to maintain consistency and detect conflicts.

**Testing**: Verify update_vector updated when state correction received.

---

### Phase 7: Test Updates

#### Orchestrator Tests
**File**: `app-dfd-orchestrator.service.spec.ts`

**Update tests**:
```typescript
it('should trigger auto-save from history changes with index', () => {
  const historySubject = mockDfdInfrastructure.historyModified$ as Subject<any>;

  historySubject.next({ historyIndex: 1, isUndo: false, isRedo: false });

  expect(mockAutoSaveManager.trigger).toHaveBeenCalledWith(
    1,
    expect.objectContaining({ diagramId: 'test-diagram' }),
    false,
    false,
  );
});

it('should trigger auto-save for undo with correct flags', () => {
  const historySubject = mockDfdInfrastructure.historyModified$ as Subject<any>;

  historySubject.next({ historyIndex: 2, isUndo: true, isRedo: false });

  expect(mockAutoSaveManager.trigger).toHaveBeenCalledWith(2, expect.any(Object), true, false);
});

it('should NOT trigger auto-save from operations', () => {
  mockGraphOperationManager.execute.mockReturnValue(of(mockResult));

  service.executeOperation(createNodeOperation).subscribe();

  expect(mockAutoSaveManager.trigger).not.toHaveBeenCalled();
  expect(service.getState().hasUnsavedChanges).toBe(true);
});
```

**Remove**: Test "should trigger auto-save on successful operations"

**Why**: Auto-save no longer triggers from operations, only from history.

#### Auto-Save Manager Tests
**File**: `app-auto-save-manager.service.spec.ts`

**Complete rewrite needed**:
- Remove all debounce timer tests (`vi.advanceTimersByTime`)
- Remove threshold tests (`changeThreshold`, `timeThresholdMs`)
- Add history index tracking tests
- Add queue depth tests
- Add update_vector tracking tests
- Add undo/redo flag propagation tests
- Add pending save queue processing tests

**Key new tests**:
```typescript
describe('History index tracking', () => {
  it('should track history index and skip already-saved changes', () => {
    // Save index 1
    service.trigger(1, context).subscribe();
    expect(mockPersistenceCoordinator.save).toHaveBeenCalledTimes(1);

    // Try to save index 1 again - should skip
    service.trigger(1, context).subscribe();
    expect(mockPersistenceCoordinator.save).toHaveBeenCalledTimes(1);
  });

  it('should queue pending changes when save in progress', () => {
    // Start save for index 1 (doesn't complete)
    service.trigger(1, context).subscribe();

    // Trigger for index 2 while save in progress
    service.trigger(2, context).subscribe();

    // Should still only have 1 save call (first one pending)
    expect(mockPersistenceCoordinator.save).toHaveBeenCalledTimes(1);
  });

  it('should process queued changes after save completes', (done) => {
    // Save for index 1
    service.trigger(1, context).subscribe();

    // Trigger for index 2 while save 1 in progress
    service.trigger(2, context).subscribe();

    // Complete save 1
    mockSaveSubject.next({ success: true, ... });
    mockSaveSubject.complete();

    // Should automatically trigger save for index 2
    setTimeout(() => {
      expect(mockPersistenceCoordinator.save).toHaveBeenCalledTimes(2);
      done();
    }, 50);
  });
});

describe('Update vector tracking', () => {
  it('should update serverUpdateVector from save response', () => {
    service.trigger(1, context).subscribe();

    mockSaveSubject.next({
      success: true,
      metadata: { update_vector: 42 },
    });

    expect(service.getSaveTracking().serverUpdateVector).toBe(42);
  });

  it('should update serverUpdateVector from external source', () => {
    service.updateServerUpdateVector(100);
    expect(service.getSaveTracking().serverUpdateVector).toBe(100);
  });
});

describe('Undo/Redo handling', () => {
  it('should include undo flag in save metadata', () => {
    service.trigger(1, context, true, false).subscribe();

    const saveCall = mockPersistenceCoordinator.save.mock.calls[0][0];
    expect(saveCall.metadata.isUndo).toBe(true);
    expect(saveCall.metadata.isRedo).toBe(false);
  });
});
```

**Why**: Complete behavior change requires complete test rewrite. New tests verify the core guarantees: nothing missed, no duplicates, proper queuing, version tracking.

---

### Phase 8: Documentation
**File**: `docs/reference/architecture/dfd-change-propagation/autosave-decision-tree.md`

**Complete rewrite** showing:
1. Single history-based trigger path
2. History index tracking diagram
3. Server update_vector tracking diagram
4. Dual-mode persistence (REST vs WebSocket) flowchart
5. Immediate save with queue flowchart
6. Undo/redo special handling in collaboration mode

**Remove**:
- Multiple trigger sources diagram
- Debouncing explanations
- Threshold/policy mode explanations

**Add**:
- Queue depth management
- Version tracking (client + server)
- Idempotency via update_vector

**Why**: Documentation must match the new architecture. Old docs would be misleading and confusing.

---

## Progress Tracking

### Phase Status
- [ ] Phase 1: History Event Enhancement
- [ ] Phase 2: Auto-Save Manager Rewrite
- [ ] Phase 3: WebSocket Strategy Enhancement
- [ ] Phase 4: REST Strategy Update
- [ ] Phase 5: Orchestrator Simplification
- [ ] Phase 6: Collaboration Integration
- [ ] Phase 7: Test Updates
- [ ] Phase 8: Documentation

### Files Modified
- [ ] `src/app/pages/dfd/infrastructure/adapters/infra-x6-history.adapter.ts`
- [ ] `src/app/pages/dfd/infrastructure/adapters/infra-x6-graph.adapter.ts`
- [ ] `src/app/pages/dfd/application/facades/app-dfd.facade.ts`
- [ ] `src/app/pages/dfd/application/services/app-auto-save-manager.service.ts`
- [ ] `src/app/pages/dfd/infrastructure/strategies/infra-websocket-persistence.strategy.ts`
- [ ] `src/app/pages/dfd/infrastructure/strategies/infra-rest-persistence.strategy.ts`
- [ ] `src/app/pages/dfd/application/services/app-dfd-orchestrator.service.ts`
- [ ] `src/app/pages/dfd/application/services/app-state.service.ts`
- [ ] `src/app/pages/dfd/application/services/app-dfd-orchestrator.service.spec.ts`
- [ ] `src/app/pages/dfd/application/services/app-auto-save-manager.service.spec.ts`
- [ ] `docs/reference/architecture/dfd-change-propagation/autosave-decision-tree.md`

### Quality Gates
- [ ] All files modified
- [ ] `pnpm run lint:all` passes
- [ ] `pnpm run build` succeeds
- [ ] All DFD tests pass (`pnpm test -- src/app/pages/dfd`)
- [ ] Manual testing complete

## Manual Testing Checklist

### REST Mode (Not Collaborating)
- [ ] Create node → save triggers immediately
- [ ] Create edge → save triggers immediately, edge included in save
- [ ] Modify label → save triggers immediately
- [ ] Undo operation → save triggers immediately with full state
- [ ] Redo operation → save triggers immediately with full state
- [ ] Rapid changes (batch) → single save with all changes
- [ ] Check network tab: PATCH requests show update_vector in response

### WebSocket Mode (Collaborating)
- [ ] Create node → no PATCH (handled by WebSocket events)
- [ ] Create edge → no PATCH (handled by WebSocket events)
- [ ] Undo operation → WebSocket message sent with operation_type: 'undo'
- [ ] Redo operation → WebSocket message sent with operation_type: 'redo'
- [ ] Other user's changes → received and applied without triggering save

### Edge Cases
- [ ] Network failure during save → error handled, no save loop
- [ ] Multiple rapid saves → queued properly, no overlaps
- [ ] History index decreases (undo) → handled gracefully
- [ ] Queue overflow (100+ pending) → user warned, operations blocked

## Risk Mitigation

### High-Risk Areas
1. **Save queue logic**: Could create infinite loops or miss changes
   - Mitigation: Extensive testing, strict index comparison, queue depth limit

2. **Update vector tracking**: Could get out of sync with server
   - Mitigation: Always trust server's update_vector, log all updates

3. **WebSocket mode**: Could duplicate or miss undo/redo operations
   - Mitigation: Clear separation of undo/redo vs regular operations

4. **Test coverage**: Complex state machine, easy to miss edge cases
   - Mitigation: Comprehensive unit tests, manual testing checklist

### Rollback Plan
If critical issues discovered:
1. Revert feature branch
2. Cherry-pick just the lazy evaluation fix (already working)
3. Return to debounced approach temporarily
4. Re-plan with learnings

## Success Criteria

✅ **Functional**:
- All auto-saves execute immediately (no debouncing)
- Nothing ever missed (history index tracking guarantees)
- No duplicate saves (queue prevents overlaps)
- Undo/redo properly handled in both modes
- Edges save correctly (original bug fixed)

✅ **Technical**:
- Zero `setTimeout` in auto-save code
- Zero `debounceTime` in auto-save code
- Single trigger source (history only)
- Complete version tracking (client + server)
- All tests pass

✅ **Performance**:
- Save latency: <200ms (REST), <50ms (WebSocket)
- Queue rarely >2 under normal usage
- No UI blocking during save operations
- X6 batchUpdate prevents save spam

## Next Steps After Completion

1. Monitor production logs for:
   - Queue depth patterns
   - Update vector mismatches
   - Save failure rates
   - Average save latency

2. Consider future enhancements:
   - Optimistic UI updates
   - Offline queue persistence
   - Conflict resolution UI
   - Save retry strategies

3. Apply same pattern to other modules if successful

---

## Implementation Log

*Track progress, blockers, and decisions here as we work through each phase*

### 2025-10-05

**Branch created**: `feature/history-based-autosave-no-debouncing`

**Ready to start Phase 1**
