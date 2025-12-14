# AppStateService Refactoring Plan

**Goal**: Extract WebSocket event processing logic into a dedicated service and fix bidirectional dependency anti-pattern with AppOperationStateManager.

**Current State**: 491 lines, HIGH complexity, bidirectional dependency issue
**Target State**: ~350 lines (29% reduction), MEDIUM complexity, clean dependency structure

---

## Overview

The AppStateService currently has multiple responsibilities:
1. Managing diagram state (sync state, operations, flags)
2. Processing 7 different types of WebSocket domain events
3. Bidirectional coordination with AppOperationStateManager

This plan addresses two issues:
1. **Priority 1**: Fix bidirectional dependency anti-pattern
2. **Priority 2**: Extract event processing to dedicated service

---

## Part 1: Fix Bidirectional Dependency (PRIORITY 1)

### Current Problem

**File**: `app-state.service.ts` (lines 132-136)

```typescript
constructor(
  // ... other dependencies
  private _historyCoordinator: AppOperationStateManager,
) {
  // Anti-pattern: Circular dependency via setter injection
  this._historyCoordinator.setAppStateService(this);
}
```

**File**: `app-operation-state-manager.service.ts`

```typescript
export class AppOperationStateManager {
  private _appStateService?: AppStateService;

  setAppStateService(service: AppStateService): void {
    this._appStateService = service;
  }

  // Uses _appStateService in various methods
}
```

### Why This Is Bad

1. Creates tight coupling between services
2. Violates dependency injection principles
3. Makes testing difficult (circular mock dependencies)
4. Hides true dependency relationship
5. Makes initialization order critical

### Solution: Event-Based Communication

Replace bidirectional dependency with unidirectional dependency + event streams.

#### Option A: Observable Event Streams (RECOMMENDED)

**AppOperationStateManager emits events → AppStateService subscribes**

```typescript
// app-operation-state-manager.service.ts
export interface OperationStateEvent {
  type: 'drag-started' | 'drag-ended' | 'operation-blocked' | 'operation-allowed';
  payload?: any;
}

@Injectable()
export class AppOperationStateManager {
  private _stateEvents$ = new Subject<OperationStateEvent>();
  public readonly stateEvents$ = this._stateEvents$.asObservable();

  // Remove setAppStateService() method entirely
  // Emit events instead of calling AppStateService directly

  private handleDragStart(): void {
    this._isDragging = true;
    this._stateEvents$.next({ type: 'drag-started' });
  }
}
```

```typescript
// app-state.service.ts
constructor(
  // ... other dependencies
  private _historyCoordinator: AppOperationStateManager,
) {
  // NO MORE: this._historyCoordinator.setAppStateService(this);
}

initialize(): void {
  // Subscribe to operation state events
  this._subscriptions.add(
    this._historyCoordinator.stateEvents$
      .pipe(takeUntil(this._destroy$))
      .subscribe(event => this._handleOperationStateEvent(event))
  );

  // ... rest of initialization
}

private _handleOperationStateEvent(event: OperationStateEvent): void {
  switch (event.type) {
    case 'drag-started':
      // Handle drag start
      break;
    case 'drag-ended':
      // Handle drag end
      break;
    // ... other event types
  }
}
```

#### Option B: Inject Minimal Interface

If AppOperationStateManager truly needs to call AppStateService methods:

```typescript
// Define minimal interface
export interface StateUpdater {
  setApplyingRemoteChange(isApplying: boolean): void;
  setBlockOperations(blocked: boolean): void;
}

// app-operation-state-manager.service.ts
constructor(private stateUpdater: StateUpdater) {}

// app-state.service.ts implements StateUpdater
export class AppStateService implements StateUpdater {
  // ... implementation
}

// Provide AppStateService as StateUpdater in DI
providers: [
  AppStateService,
  { provide: StateUpdater, useExisting: AppStateService },
  AppOperationStateManager,
]
```

**Recommendation**: Use Option A (Observable Events) - more decoupled and Angular-idiomatic.

---

## Part 2: Extract Event Processing (PRIORITY 2)

### Current Responsibilities in AppStateService

1. **State Management** (~150 lines):
   - Managing `_diagramState$` BehaviorSubject
   - Public observables (diagramState$, syncState$, isApplyingRemoteChange$)
   - State update methods (setApplyingRemoteChange, setReadOnly, etc.)

2. **Event Processing** (~200 lines):
   - Processing 7 WebSocket event types
   - 7 private event handler methods
   - Event subscription setup in initialize()

3. **Event Emission** (~50 lines):
   - Emitting processed events for graph application
   - 6 Subject instances for different event types

### Proposed Split

#### New Service: AppWebSocketEventProcessor

**Responsibility**: Process incoming WebSocket events and emit application-level events

**File**: `src/app/pages/dfd/application/services/app-websocket-event-processor.service.ts`

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoggerService } from '../../../../core/services/logger.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { InfraDfdWebsocketAdapter } from '../../infrastructure/adapters/infra-dfd-websocket.adapter';
import {
  CellOperation,
  Cell as WSCell,
  DiagramOperationMessage,
} from '../../../../core/types/websocket-message.types';
import {
  StateCorrectionEvent,
  DiagramStateSyncEvent,
  HistoryOperationEvent,
  ResyncRequestedEvent,
  ParticipantsUpdatedEvent,
} from '../../infrastructure/adapters/infra-dfd-websocket.adapter';

/**
 * Processed event types emitted to application layer
 */
export interface ProcessedDiagramOperation {
  userId: string;
  operationId: string;
  operations: CellOperation[];
}

export interface ProcessedStateCorrection {
  updateVector: number;
}

export interface ProcessedDiagramSync {
  diagramId: string;
  updateVector: number | null;
  cells: WSCell[];
}

export interface ProcessedHistoryOperation {
  requiresResync: boolean;
}

export interface ProcessedResyncRequest {
  method: string;
}

export interface ProcessedParticipantsUpdate {
  participants: any[];
  host: any;
  currentPresenter: any;
}

@Injectable()
export class AppWebSocketEventProcessor implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _subscriptions = new Subscription();

  // Processed event streams
  private readonly _diagramOperation$ = new Subject<ProcessedDiagramOperation>();
  private readonly _stateCorrection$ = new Subject<ProcessedStateCorrection>();
  private readonly _diagramSync$ = new Subject<ProcessedDiagramSync>();
  private readonly _historyOperation$ = new Subject<ProcessedHistoryOperation>();
  private readonly _resyncRequest$ = new Subject<ProcessedResyncRequest>();
  private readonly _participantsUpdate$ = new Subject<ProcessedParticipantsUpdate>();

  public readonly diagramOperations$ = this._diagramOperation$.asObservable();
  public readonly stateCorrections$ = this._stateCorrection$.asObservable();
  public readonly diagramSyncs$ = this._diagramSync$.asObservable();
  public readonly historyOperations$ = this._historyOperation$.asObservable();
  public readonly resyncRequests$ = this._resyncRequest$.asObservable();
  public readonly participantsUpdates$ = this._participantsUpdate$.asObservable();

  constructor(
    private logger: LoggerService,
    private webSocketService: InfraDfdWebsocketAdapter,
    private collaborationService: DfdCollaborationService,
  ) {}

  /**
   * Initialize event processing subscriptions
   */
  initialize(): void {
    this._subscriptions.add(
      this.webSocketService.diagramOperations$
        .pipe(takeUntil(this._destroy$))
        .subscribe(message => this._processDiagramOperation(message))
    );

    this._subscriptions.add(
      this.webSocketService.stateCorrections$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._processStateCorrection(event))
    );

    this._subscriptions.add(
      this.webSocketService.diagramStateSyncs$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._processDiagramStateSync(event))
    );

    this._subscriptions.add(
      this.webSocketService.historyOperations$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._processHistoryOperation(event))
    );

    this._subscriptions.add(
      this.webSocketService.resyncRequests$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._processResyncRequest(event))
    );

    this._subscriptions.add(
      this.webSocketService.participantsUpdated$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._processParticipantsUpdate(event))
    );
  }

  private _processDiagramOperation(message: DiagramOperationMessage): void {
    // Skip our own operations
    const currentUserEmail = this.collaborationService.getCurrentUserEmail();
    if (message.initiating_user.email === currentUserEmail) {
      this.logger.debugComponent('AppWebSocketEventProcessor', 'Skipping own operation', {
        operationId: message.operation_id,
      });
      return;
    }

    const userId = message.initiating_user.email || 'unknown';

    this.logger.info('Processing remote diagram operation', {
      userId,
      operationId: message.operation_id,
      operationType: message.operation?.type,
      cellCount: message.operation?.cells?.length || 0,
    });

    if (message.operation?.cells && message.operation.cells.length > 0) {
      this._diagramOperation$.next({
        userId,
        operationId: message.operation_id,
        operations: message.operation.cells,
      });
    }
  }

  private _processStateCorrection(event: StateCorrectionEvent): void {
    this.logger.warn('Processing state correction', {
      serverUpdateVector: event.update_vector,
    });

    this._stateCorrection$.next({
      updateVector: event.update_vector,
    });
  }

  private _processDiagramStateSync(event: DiagramStateSyncEvent): void {
    this.logger.info('Processing diagram state sync', {
      diagramId: event.diagram_id,
      serverUpdateVector: event.update_vector,
      cellCount: event.cells.length,
    });

    this._diagramSync$.next({
      diagramId: event.diagram_id,
      updateVector: event.update_vector,
      cells: event.cells,
    });
  }

  private _processHistoryOperation(event: HistoryOperationEvent): void {
    this.logger.debugComponent('AppWebSocketEventProcessor', 'Processing history operation', event);

    this._historyOperation$.next({
      requiresResync: event.message === 'resync_required',
    });
  }

  private _processResyncRequest(event: ResyncRequestedEvent): void {
    this.logger.info('Processing resync request', { method: event.method });

    this._resyncRequest$.next({
      method: event.method,
    });
  }

  private _processParticipantsUpdate(event: ParticipantsUpdatedEvent): void {
    this.logger.debugComponent('AppWebSocketEventProcessor', 'Processing participants update', {
      participantCount: event.participants?.length,
      host: event.host,
      currentPresenter: event.currentPresenter,
    });

    this._participantsUpdate$.next({
      participants: event.participants,
      host: event.host,
      currentPresenter: event.currentPresenter,
    });
  }

  ngOnDestroy(): void {
    this.logger.info('Destroying AppWebSocketEventProcessor');
    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();
  }
}
```

#### Updated AppStateService

Remove event processing, subscribe to processed events from the new service.

```typescript
// app-state.service.ts
@Injectable()
export class AppStateService implements OnDestroy {
  // ... existing state management code

  constructor(
    private _logger: LoggerService,
    private _eventProcessor: AppWebSocketEventProcessor, // NEW
    private _collaborationService: DfdCollaborationService,
    private _threatModelService: ThreatModelService,
    private _historyCoordinator: AppOperationStateManager,
  ) {
    // Removed: this._historyCoordinator.setAppStateService(this);
  }

  initialize(): void {
    // Subscribe to processed events from event processor
    this._subscriptions.add(
      this._eventProcessor.diagramOperations$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._handleDiagramOperation(event))
    );

    this._subscriptions.add(
      this._eventProcessor.stateCorrections$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._handleStateCorrection(event))
    );

    this._subscriptions.add(
      this._eventProcessor.diagramSyncs$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._handleDiagramSync(event))
    );

    this._subscriptions.add(
      this._eventProcessor.historyOperations$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._handleHistoryOperation(event))
    );

    this._subscriptions.add(
      this._eventProcessor.resyncRequests$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._handleResyncRequest(event))
    );

    this._subscriptions.add(
      this._eventProcessor.participantsUpdates$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._handleParticipantsUpdate(event))
    );

    // Initialize the event processor
    this._eventProcessor.initialize();
  }

  // Simplified handlers that receive processed events
  private _handleDiagramOperation(event: ProcessedDiagramOperation): void {
    // Check if already processed
    if (this.getCurrentState().lastOperationId === event.operationId) {
      return;
    }

    // Update state
    this._updateState({
      lastOperationId: event.operationId,
      pendingRemoteOperations: [
        ...this.getCurrentState().pendingRemoteOperations,
        {
          operationId: event.operationId,
          userId: event.userId,
          operation: { type: 'patch', cells: event.operations },
          timestamp: Date.now(),
        },
      ],
    });

    // Emit batched operation event
    this._applyBatchedOperationsEvent$.next({
      operations: event.operations,
      userId: event.userId,
      operationId: event.operationId,
    });

    // Update sync state
    this._updateSyncState({
      pendingOperations: Math.max(0, this.getCurrentState().syncState.pendingOperations - 1),
      lastSyncTimestamp: Date.now(),
    });
  }

  private _handleStateCorrection(event: ProcessedStateCorrection): void {
    this._updateSyncState({
      isSynced: false,
      isResyncing: true,
    });

    this._updateState({
      conflictCount: this.getCurrentState().conflictCount + 1,
    });

    this._triggerResyncEvent$.next();
  }

  private _handleDiagramSync(event: ProcessedDiagramSync): void {
    this._diagramStateSyncEvent$.next({
      diagram_id: event.diagramId,
      update_vector: event.updateVector,
      cells: event.cells,
    });
  }

  private _handleHistoryOperation(event: ProcessedHistoryOperation): void {
    if (event.requiresResync) {
      this._updateSyncState({ isSynced: false, isResyncing: true });
      this._requestResyncEvent$.next({ method: 'rest_api' });
    }
  }

  private _handleResyncRequest(event: ProcessedResyncRequest): void {
    this._updateSyncState({ isResyncing: true });
    this._requestResyncEvent$.next({ method: event.method });
  }

  private _handleParticipantsUpdate(event: ProcessedParticipantsUpdate): void {
    try {
      this._collaborationService.updateAllParticipants(
        event.participants,
        event.host,
        event.currentPresenter,
      );
    } catch (error) {
      this._logger.error('Error processing participants update', error);
    }
  }

  // ... rest of state management methods remain unchanged
}
```

---

## Step-by-Step Refactoring Plan

### Phase 1: Fix Bidirectional Dependency (PRIORITY 1)

1. **Analyze AppOperationStateManager**:
   - [ ] Identify all calls to `_appStateService` methods
   - [ ] Document what state updates are needed
   - [ ] Determine if events or interface injection is appropriate

2. **Implement Event Stream** (Option A - Recommended):
   - [ ] Add `_stateEvents$` Subject to AppOperationStateManager
   - [ ] Replace `_appStateService` calls with event emissions
   - [ ] Remove `setAppStateService()` method
   - [ ] Remove `_appStateService` property

3. **Update AppStateService**:
   - [ ] Remove `setAppStateService()` call from constructor
   - [ ] Subscribe to `stateEvents$` in `initialize()`
   - [ ] Add `_handleOperationStateEvent()` handler
   - [ ] Update state based on received events

4. **Test Changes**:
   - [ ] Run `pnpm run build` - verify no build errors
   - [ ] Run `pnpm test` - verify all tests pass
   - [ ] Update unit tests for both services

### Phase 2: Extract Event Processing (PRIORITY 2)

5. **Create AppWebSocketEventProcessor Service**:
   - [ ] Create new service file
   - [ ] Define processed event interfaces
   - [ ] Implement event processing methods (moved from AppStateService)
   - [ ] Add to DFD component providers

6. **Update AppStateService**:
   - [ ] Inject AppWebSocketEventProcessor
   - [ ] Remove WebSocket subscriptions from initialize()
   - [ ] Subscribe to processed event streams
   - [ ] Rename event handlers (add `_handle` prefix for clarity)
   - [ ] Simplify handlers to work with processed events
   - [ ] Remove now-unused private processing methods

7. **Test Changes**:
   - [ ] Run `pnpm run format` and `pnpm run lint:all`
   - [ ] Run `pnpm run build` - verify no build errors
   - [ ] Run `pnpm test` - verify all tests pass
   - [ ] Create unit tests for AppWebSocketEventProcessor
   - [ ] Update unit tests for AppStateService

### Phase 3: Verification

8. **Integration Testing**:
   - [ ] Test WebSocket event flow end-to-end
   - [ ] Verify diagram operations are processed correctly
   - [ ] Verify state corrections trigger resync
   - [ ] Verify participants updates work
   - [ ] Test with multiple concurrent users (if possible)

9. **Documentation**:
   - [ ] Update architecture documentation
   - [ ] Document event flow: WebSocket → Processor → AppState
   - [ ] Add JSDoc comments to new service
   - [ ] Update CLAUDE.md if needed

---

## Expected Outcomes

### Before Refactoring

- **AppStateService**: 491 lines, 4 dependencies + bidirectional dependency, HIGH complexity
- **Responsibilities**: State management + event processing + event emission
- **Issues**: Bidirectional dependency anti-pattern, multiple responsibilities

### After Refactoring (Phase 1 Only)

- **AppStateService**: 491 lines, 4 dependencies (no bidirectional), MEDIUM-HIGH complexity
- **AppOperationStateManager**: Cleaner, event-based communication
- **Benefits**: Eliminated anti-pattern, improved testability

### After Refactoring (Phase 1 + 2)

- **AppStateService**: ~350 lines (-29%), 5 dependencies (adds event processor), MEDIUM complexity
  - **Single Responsibility**: State management and coordination

- **AppWebSocketEventProcessor**: ~200 lines, 3 dependencies, LOW-MEDIUM complexity
  - **Single Responsibility**: Process WebSocket events, emit application events

- **AppOperationStateManager**: Event-based, no bidirectional dependency

### Benefits

1. **Eliminated Anti-Pattern**: Clean unidirectional dependencies
2. **Improved Testability**: Each service can be tested in isolation
3. **Reduced Complexity**: Clear separation of concerns
4. **Better Maintainability**: Event processing changes don't affect state management
5. **Easier Debugging**: Smaller services with focused responsibilities
6. **Reusability**: Event processor could be used by other components

---

## Risk Assessment

### Medium Risk - Phase 1 (Dependency Fix)

**Risks**:
- Changing communication pattern could break existing functionality
- Event timing could introduce race conditions
- May affect existing unit tests significantly

**Mitigation**:
- Write comprehensive tests before refactoring
- Use typed events with clear contracts
- Thorough integration testing after changes
- Gradual rollout (fix dependency first, extract processor second)

### Low Risk - Phase 2 (Extract Event Processor)

**Risks**:
- Event processing logic is well-contained
- Clear inputs (WebSocket events) and outputs (processed events)
- No shared state between processors

**Mitigation**:
- Test event processing in isolation
- Verify all event types are handled correctly
- Run full test suite after extraction

---

## Timeline Estimate

### Phase 1: Fix Bidirectional Dependency

- Analyze dependencies: ~1 hour
- Implement event stream: ~2 hours
- Update both services: ~1 hour
- Test and debug: ~2 hours
- **Subtotal**: ~6 hours

### Phase 2: Extract Event Processor

- Create new service: ~1 hour
- Move event processing logic: ~2 hours
- Update AppStateService: ~1 hour
- Write unit tests: ~3 hours
- Integration testing: ~1 hour
- **Subtotal**: ~8 hours

**Total Estimate**: ~14 hours (can be split across multiple sessions)

---

## Recommendations

1. **Do Phase 1 First**: Fix bidirectional dependency before extracting event processor
   - Simpler to validate each change independently
   - Reduces risk of introducing multiple issues simultaneously

2. **Write Tests Before Refactoring**: Create comprehensive unit tests for current AppStateService
   - Focus on state updates triggered by WebSocket events
   - Create safety net for refactoring

3. **Use Feature Flags** (Optional): If this is production code, consider feature flag
   - Toggle between old and new event processing
   - Allows gradual rollout and easy rollback

4. **Document Event Flow**: Create sequence diagrams showing:
   - WebSocket → Event Processor → AppState → Graph
   - Helps team understand new architecture

5. **Consider Incremental Approach**: Extract one event type at a time
   - Lower risk per change
   - Easier to debug if issues arise
   - More commits, but safer migration
