/**
 * Unit tests for AppStateService
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/pages/dfd/application/services/app-state.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { Subject } from 'rxjs';
import { AppStateService, DfdDiagramState, SyncState } from './app-state.service';

describe('AppStateService', () => {
  let service: AppStateService;
  let mockLogger: {
    debugComponent: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let mockWebSocketService: {
    domainEvents$: Subject<any>;
  };
  let mockCollaborationService: {
    updateAllParticipants: ReturnType<typeof vi.fn>;
  };
  let mockThreatModelService: {
    getDiagramById: ReturnType<typeof vi.fn>;
  };
  let mockHistoryCoordinator: {
    stateEvents$: Subject<any>;
  };
  let mockEventProcessor: {
    initialize: ReturnType<typeof vi.fn>;
    diagramOperations$: Subject<any>;
    stateCorrections$: Subject<any>;
    diagramSyncs$: Subject<any>;
    historyOperations$: Subject<any>;
    resyncRequests$: Subject<any>;
    participantsUpdates$: Subject<any>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      debugComponent: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };

    mockWebSocketService = {
      domainEvents$: new Subject(),
    };

    mockCollaborationService = {
      updateAllParticipants: vi.fn(),
    };

    mockThreatModelService = {
      getDiagramById: vi.fn(),
    };

    mockHistoryCoordinator = {
      stateEvents$: new Subject(),
    };

    mockEventProcessor = {
      initialize: vi.fn(),
      diagramOperations$: new Subject(),
      stateCorrections$: new Subject(),
      diagramSyncs$: new Subject(),
      historyOperations$: new Subject(),
      resyncRequests$: new Subject(),
      participantsUpdates$: new Subject(),
    };

    service = new AppStateService(
      mockLogger as any,
      mockWebSocketService as any,
      mockCollaborationService as any,
      mockThreatModelService as any,
      mockHistoryCoordinator as any,
      mockEventProcessor as any,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with default state', () => {
      const state = service.getCurrentState();

      expect(state.syncState.isSynced).toBe(true);
      expect(state.syncState.pendingOperations).toBe(0);
      expect(state.syncState.isResyncing).toBe(false);
      expect(state.pendingRemoteOperations).toEqual([]);
      expect(state.isApplyingRemoteChange).toBe(false);
      expect(state.isApplyingUndoRedo).toBe(false);
      expect(state.lastOperationId).toBeNull();
      expect(state.conflictCount).toBe(0);
      expect(state.readOnly).toBe(false);
    });

    it('should expose observable streams', () => {
      expect(service.diagramState$).toBeDefined();
      expect(service.syncState$).toBeDefined();
      expect(service.isApplyingRemoteChange$).toBeDefined();
      expect(service.applyOperationEvents$).toBeDefined();
      expect(service.applyBatchedOperationsEvents$).toBeDefined();
      expect(service.applyCorrectionEvents$).toBeDefined();
      expect(service.requestResyncEvents$).toBeDefined();
      expect(service.triggerResyncEvents$).toBeDefined();
      expect(service.diagramStateSyncEvents$).toBeDefined();
    });
  });

  describe('initialize()', () => {
    it('should initialize event processor', () => {
      service.initialize();

      expect(mockEventProcessor.initialize).toHaveBeenCalled();
    });

    it('should subscribe to history coordinator state events', () => {
      const stateChanges: DfdDiagramState[] = [];
      service.diagramState$.subscribe(state => stateChanges.push(state));

      service.initialize();

      mockHistoryCoordinator.stateEvents$.next({
        type: 'remote-operation-start',
        timestamp: Date.now(),
      });

      expect(stateChanges.some(s => s.isApplyingRemoteChange)).toBe(true);
    });

    it('should subscribe to WebSocket domain events', () => {
      service.initialize();

      const initialState = service.getCurrentState();
      mockWebSocketService.domainEvents$.next({
        type: 'diagram-operation',
        payload: {},
      });

      const newState = service.getCurrentState();
      expect(newState.syncState.pendingOperations).toBeGreaterThan(
        initialState.syncState.pendingOperations,
      );
    });

    it('should subscribe to event processor streams', () => {
      const batchedOps: any[] = [];
      service.applyBatchedOperationsEvents$.subscribe(op => batchedOps.push(op));

      service.initialize();

      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [{ type: 'add', id: 'cell1' }],
      });

      expect(batchedOps).toHaveLength(1);
    });
  });

  describe('getCurrentState()', () => {
    it('should return current state', () => {
      const state = service.getCurrentState();

      expect(state).toBeDefined();
      expect(state.syncState).toBeDefined();
      expect(state.pendingRemoteOperations).toBeDefined();
    });

    it('should return updated state after changes', () => {
      service.setApplyingRemoteChange(true);

      const state = service.getCurrentState();
      expect(state.isApplyingRemoteChange).toBe(true);
    });
  });

  describe('setBlockOperations()', () => {
    it('should block operations', () => {
      service.setBlockOperations(true);

      expect(service.areOperationsBlocked()).toBe(true);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppStateService',
        'Operations blocked',
      );
    });

    it('should unblock operations', () => {
      service.setBlockOperations(true);
      service.setBlockOperations(false);

      expect(service.areOperationsBlocked()).toBe(false);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppStateService',
        'Operations unblocked',
      );
    });
  });

  describe('areOperationsBlocked()', () => {
    it('should return false by default', () => {
      expect(service.areOperationsBlocked()).toBe(false);
    });

    it('should return true when blocked', () => {
      service.setBlockOperations(true);

      expect(service.areOperationsBlocked()).toBe(true);
    });
  });

  describe('setApplyingRemoteChange()', () => {
    it('should update isApplyingRemoteChange flag', () => {
      service.setApplyingRemoteChange(true);

      const state = service.getCurrentState();
      expect(state.isApplyingRemoteChange).toBe(true);
    });

    it('should clear isApplyingRemoteChange flag', () => {
      service.setApplyingRemoteChange(true);
      service.setApplyingRemoteChange(false);

      const state = service.getCurrentState();
      expect(state.isApplyingRemoteChange).toBe(false);
    });

    it('should emit state change through observable', () => {
      const stateChanges: boolean[] = [];
      service.isApplyingRemoteChange$.subscribe(value => stateChanges.push(value));

      service.setApplyingRemoteChange(true);

      expect(stateChanges).toContain(true);
    });
  });

  describe('setApplyingUndoRedo()', () => {
    it('should update isApplyingUndoRedo flag', () => {
      service.setApplyingUndoRedo(true);

      const state = service.getCurrentState();
      expect(state.isApplyingUndoRedo).toBe(true);
    });

    it('should clear isApplyingUndoRedo flag', () => {
      service.setApplyingUndoRedo(true);
      service.setApplyingUndoRedo(false);

      const state = service.getCurrentState();
      expect(state.isApplyingUndoRedo).toBe(false);
    });
  });

  describe('setReadOnly()', () => {
    it('should update readOnly flag', () => {
      service.setReadOnly(true);

      const state = service.getCurrentState();
      expect(state.readOnly).toBe(true);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppStateService',
        'Read-only mode state updated',
        { readOnly: true },
      );
    });

    it('should clear readOnly flag', () => {
      service.setReadOnly(true);
      service.setReadOnly(false);

      const state = service.getCurrentState();
      expect(state.readOnly).toBe(false);
    });
  });

  describe('Operation State Event Handling', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should set flag on remote-operation-start', () => {
      mockHistoryCoordinator.stateEvents$.next({
        type: 'remote-operation-start',
        timestamp: Date.now(),
      });

      const state = service.getCurrentState();
      expect(state.isApplyingRemoteChange).toBe(true);
    });

    it('should not set flag if already set on remote-operation-start', () => {
      service.setApplyingRemoteChange(true);

      const stateChanges: DfdDiagramState[] = [];
      service.diagramState$.subscribe(state => stateChanges.push(state));
      const initialLength = stateChanges.length;

      mockHistoryCoordinator.stateEvents$.next({
        type: 'remote-operation-start',
        timestamp: Date.now(),
      });

      // Should not emit a duplicate state change
      expect(stateChanges.length).toBe(initialLength);
    });

    it('should clear flag on remote-operation-end', () => {
      service.setApplyingRemoteChange(true);

      mockHistoryCoordinator.stateEvents$.next({
        type: 'remote-operation-end',
        timestamp: Date.now(),
      });

      const state = service.getCurrentState();
      expect(state.isApplyingRemoteChange).toBe(false);
    });

    it('should not clear flag if not set on remote-operation-end', () => {
      const stateChanges: DfdDiagramState[] = [];
      service.diagramState$.subscribe(state => stateChanges.push(state));
      const initialLength = stateChanges.length;

      mockHistoryCoordinator.stateEvents$.next({
        type: 'remote-operation-end',
        timestamp: Date.now(),
      });

      // Should not emit a duplicate state change
      expect(stateChanges.length).toBe(initialLength);
    });
  });

  describe('Domain Event Processing', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should increment pending operations on diagram-operation event', () => {
      const initialState = service.getCurrentState();

      mockWebSocketService.domainEvents$.next({
        type: 'diagram-operation',
        payload: {},
      });

      const newState = service.getCurrentState();
      expect(newState.syncState.pendingOperations).toBe(
        initialState.syncState.pendingOperations + 1,
      );
    });

    it('should update sync state on state-correction event', () => {
      mockWebSocketService.domainEvents$.next({
        type: 'state-correction',
        payload: {},
      });

      const state = service.getCurrentState();
      expect(state.syncState.isSynced).toBe(false);
      expect(state.conflictCount).toBe(1);
    });

    it('should increment conflict count on authorization-denied event', () => {
      mockWebSocketService.domainEvents$.next({
        type: 'authorization-denied',
        payload: {},
      });

      const state = service.getCurrentState();
      expect(state.conflictCount).toBe(1);
    });

    it('should log domain event processing', () => {
      mockWebSocketService.domainEvents$.next({
        type: 'diagram-operation',
        payload: {},
      });

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppStateService',
        'Processing domain event',
        { type: 'diagram-operation' },
      );
    });
  });

  describe('Processed Diagram Operation Handling', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should emit batched operations event', () => {
      const batchedOps: any[] = [];
      service.applyBatchedOperationsEvents$.subscribe(op => batchedOps.push(op));

      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [{ type: 'add', id: 'cell1' }],
      });

      expect(batchedOps).toHaveLength(1);
      expect(batchedOps[0]).toMatchObject({
        operations: [{ type: 'add', id: 'cell1' }],
        userId: 'user1',
        operationId: 'op1',
      });
    });

    it('should add to pending remote operations', () => {
      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [{ type: 'add', id: 'cell1' }],
      });

      const state = service.getCurrentState();
      expect(state.pendingRemoteOperations).toHaveLength(1);
      expect(state.pendingRemoteOperations[0].operationId).toBe('op1');
    });

    it('should update last operation ID', () => {
      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [{ type: 'add', id: 'cell1' }],
      });

      const state = service.getCurrentState();
      expect(state.lastOperationId).toBe('op1');
    });

    it('should decrement pending operations', () => {
      // Set pending operations to 1
      mockWebSocketService.domainEvents$.next({
        type: 'diagram-operation',
        payload: {},
      });

      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [],
      });

      const state = service.getCurrentState();
      expect(state.syncState.pendingOperations).toBe(0);
    });

    it('should not go below 0 pending operations', () => {
      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [],
      });

      const state = service.getCurrentState();
      expect(state.syncState.pendingOperations).toBe(0);
    });

    it('should skip duplicate operations', () => {
      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [{ type: 'add', id: 'cell1' }],
      });

      const state1 = service.getCurrentState();
      const opCount1 = state1.pendingRemoteOperations.length;

      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [{ type: 'add', id: 'cell1' }],
      });

      const state2 = service.getCurrentState();
      expect(state2.pendingRemoteOperations.length).toBe(opCount1);
    });

    it('should update last sync timestamp', () => {
      const beforeTimestamp = Date.now();

      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [],
      });

      const state = service.getCurrentState();
      expect(state.syncState.lastSyncTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
    });
  });

  describe('Processed State Correction Handling', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should trigger resync on state correction', () => {
      const resyncEvents: any[] = [];
      service.triggerResyncEvents$.subscribe(() => resyncEvents.push(true));

      mockEventProcessor.stateCorrections$.next({
        updateVector: 42,
      });

      expect(resyncEvents).toHaveLength(1);
    });

    it('should update sync state on correction', () => {
      mockEventProcessor.stateCorrections$.next({
        updateVector: 42,
      });

      const state = service.getCurrentState();
      expect(state.syncState.isSynced).toBe(false);
      expect(state.syncState.isResyncing).toBe(true);
    });

    it('should increment conflict count', () => {
      mockEventProcessor.stateCorrections$.next({
        updateVector: 42,
      });

      const state = service.getCurrentState();
      expect(state.conflictCount).toBe(1);
    });

    it('should log warning on state correction', () => {
      mockEventProcessor.stateCorrections$.next({
        updateVector: 42,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Processing state correction - triggering debounced resync',
        { serverUpdateVector: 42 },
      );
    });
  });

  describe('Processed Diagram Sync Handling', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should emit diagram state sync event', () => {
      const syncEvents: any[] = [];
      service.diagramStateSyncEvents$.subscribe(event => syncEvents.push(event));

      mockEventProcessor.diagramSyncs$.next({
        diagramId: 'diagram1',
        updateVector: 42,
        cells: [{ id: 'cell1' }],
      });

      expect(syncEvents).toHaveLength(1);
      expect(syncEvents[0]).toMatchObject({
        diagram_id: 'diagram1',
        update_vector: 42,
        cells: [{ id: 'cell1' }],
      });
    });

    it('should log diagram sync', () => {
      mockEventProcessor.diagramSyncs$.next({
        diagramId: 'diagram1',
        updateVector: 42,
        cells: [{ id: 'cell1' }],
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Processing diagram state sync', {
        diagramId: 'diagram1',
        serverUpdateVector: 42,
        cellCount: 1,
      });
    });
  });

  describe('Processed History Operation Handling', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should request resync if required', () => {
      const resyncRequests: any[] = [];
      service.requestResyncEvents$.subscribe(req => resyncRequests.push(req));

      mockEventProcessor.historyOperations$.next({
        requiresResync: true,
      });

      expect(resyncRequests).toHaveLength(1);
      expect(resyncRequests[0].method).toBe('rest_api');
    });

    it('should update sync state if resync required', () => {
      mockEventProcessor.historyOperations$.next({
        requiresResync: true,
      });

      const state = service.getCurrentState();
      expect(state.syncState.isSynced).toBe(false);
      expect(state.syncState.isResyncing).toBe(true);
    });

    it('should not request resync if not required', () => {
      const resyncRequests: any[] = [];
      service.requestResyncEvents$.subscribe(req => resyncRequests.push(req));

      mockEventProcessor.historyOperations$.next({
        requiresResync: false,
      });

      expect(resyncRequests).toHaveLength(0);
    });
  });

  describe('Processed Resync Request Handling', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should emit resync request event', () => {
      const resyncRequests: any[] = [];
      service.requestResyncEvents$.subscribe(req => resyncRequests.push(req));

      mockEventProcessor.resyncRequests$.next({
        method: 'websocket',
      });

      expect(resyncRequests).toHaveLength(1);
      expect(resyncRequests[0].method).toBe('websocket');
    });

    it('should update sync state', () => {
      mockEventProcessor.resyncRequests$.next({
        method: 'websocket',
      });

      const state = service.getCurrentState();
      expect(state.syncState.isResyncing).toBe(true);
    });

    it('should log resync request', () => {
      mockEventProcessor.resyncRequests$.next({
        method: 'websocket',
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Processing resync request', {
        method: 'websocket',
      });
    });
  });

  describe('Processed Participants Update Handling', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should update collaboration service with participants', () => {
      const participants = [{ userId: 'user1' }, { userId: 'user2' }];
      const host = { userId: 'host1' };
      const currentPresenter = { userId: 'presenter1' };

      mockEventProcessor.participantsUpdates$.next({
        participants,
        host,
        currentPresenter,
      });

      expect(mockCollaborationService.updateAllParticipants).toHaveBeenCalledWith(
        participants,
        host,
        currentPresenter,
      );
    });

    it('should log participants update', () => {
      const participants = [{ userId: 'user1' }];

      mockEventProcessor.participantsUpdates$.next({
        participants,
        host: null,
        currentPresenter: null,
      });

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppStateService',
        'Processing participants update',
        expect.objectContaining({ participantCount: 1 }),
      );
    });

    it('should handle errors in participants update', () => {
      mockCollaborationService.updateAllParticipants.mockImplementation(() => {
        throw new Error('Update failed');
      });

      mockEventProcessor.participantsUpdates$.next({
        participants: [],
        host: null,
        currentPresenter: null,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing participants update',
        expect.any(Error),
      );
    });
  });

  describe('resyncComplete()', () => {
    it('should reset sync state', () => {
      service.setReadOnly(true);
      mockWebSocketService.domainEvents$.next({ type: 'state-correction' });

      service.resyncComplete();

      const state = service.getCurrentState();
      expect(state.syncState.isSynced).toBe(true);
      expect(state.syncState.isResyncing).toBe(false);
      expect(state.syncState.pendingOperations).toBe(0);
    });

    it('should clear pending remote operations', () => {
      service.initialize();

      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [],
      });

      service.resyncComplete();

      const state = service.getCurrentState();
      expect(state.pendingRemoteOperations).toEqual([]);
    });

    it('should reset conflict count', () => {
      service.initialize();
      mockWebSocketService.domainEvents$.next({ type: 'authorization-denied' });

      service.resyncComplete();

      const state = service.getCurrentState();
      expect(state.conflictCount).toBe(0);
    });

    it('should update last sync timestamp', () => {
      const beforeTimestamp = Date.now();

      service.resyncComplete();

      const state = service.getCurrentState();
      expect(state.syncState.lastSyncTimestamp).toBeGreaterThanOrEqual(beforeTimestamp);
    });

    it('should log resync completion', () => {
      service.resyncComplete();

      expect(mockLogger.info).toHaveBeenCalledWith('Resync complete');
    });
  });

  describe('clearProcessedOperation()', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should remove operation from pending list', () => {
      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [],
      });

      service.clearProcessedOperation('op1');

      const state = service.getCurrentState();
      expect(state.pendingRemoteOperations).toEqual([]);
    });

    it('should not affect other operations', () => {
      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [],
      });

      mockEventProcessor.diagramOperations$.next({
        userId: 'user2',
        operationId: 'op2',
        operations: [],
      });

      service.clearProcessedOperation('op1');

      const state = service.getCurrentState();
      expect(state.pendingRemoteOperations).toHaveLength(1);
      expect(state.pendingRemoteOperations[0].operationId).toBe('op2');
    });

    it('should handle non-existent operation ID', () => {
      service.clearProcessedOperation('nonexistent');

      const state = service.getCurrentState();
      expect(state.pendingRemoteOperations).toEqual([]);
    });
  });

  describe('Observable Streams', () => {
    it('should emit diagram state changes', () => {
      const states: DfdDiagramState[] = [];
      service.diagramState$.subscribe(state => states.push(state));

      service.setReadOnly(true);

      expect(states.length).toBeGreaterThan(0);
      expect(states[states.length - 1].readOnly).toBe(true);
    });

    it('should emit sync state changes', () => {
      const syncStates: SyncState[] = [];
      service.syncState$.subscribe(state => syncStates.push(state));

      service.resyncComplete();

      expect(syncStates.length).toBeGreaterThan(0);
      expect(syncStates[syncStates.length - 1].isSynced).toBe(true);
    });

    it('should emit isApplyingRemoteChange changes', () => {
      const values: boolean[] = [];
      service.isApplyingRemoteChange$.subscribe(value => values.push(value));

      service.setApplyingRemoteChange(true);

      expect(values).toContain(true);
    });
  });

  describe('ngOnDestroy()', () => {
    it('should unsubscribe from all subscriptions', () => {
      service.initialize();

      const batchedOps: any[] = [];
      service.applyBatchedOperationsEvents$.subscribe(op => batchedOps.push(op));

      service.ngOnDestroy();

      // Emit after destroy - should not be received
      mockEventProcessor.diagramOperations$.next({
        userId: 'user1',
        operationId: 'op1',
        operations: [],
      });

      expect(batchedOps).toHaveLength(0);
    });

    it('should log destruction', () => {
      service.ngOnDestroy();

      expect(mockLogger.info).toHaveBeenCalledWith('Destroying AppStateService');
    });

    it('should complete destroy subject', () => {
      const completeSpy = vi.fn();

      (service as any)._destroy$.subscribe({
        complete: completeSpy,
      });

      service.ngOnDestroy();

      expect(completeSpy).toHaveBeenCalled();
    });
  });
});
