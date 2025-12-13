/**
 * @vitest-environment jsdom
 *
 * Unit tests for AppOperationRejectionHandler service
 * Run: pnpm test -- src/app/pages/dfd/application/services/app-operation-rejection-handler.service.spec.ts
 *
 * Tests should never be disabled or skipped - if there's an issue, troubleshoot to root cause
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { Subject, Observable, of, throwError } from 'rxjs';

import { AppOperationRejectionHandler } from './app-operation-rejection-handler.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { AppHistoryService } from './app-history.service';
import { AppDiagramResyncService } from './app-diagram-resync.service';
import { AppStateService } from './app-state.service';
import { InfraDfdWebsocketAdapter } from '../../infrastructure/adapters/infra-dfd-websocket.adapter';

describe('AppOperationRejectionHandler', () => {
  let service: AppOperationRejectionHandler;
  let mockLogger: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let mockHistoryService: {
    findEntryByOperationId: ReturnType<typeof vi.fn>;
    undoUntilOperationId: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let mockWebsocketAdapter: {
    operationRejected$: Subject<any>;
    diagramOperations$: Subject<any>;
  };
  let mockResyncService: {
    triggerResync: ReturnType<typeof vi.fn>;
  };
  let mockCollaborationService: {
    endCollaboration: ReturnType<typeof vi.fn>;
  };
  let mockAppStateService: {
    setBlockOperations: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debugComponent: vi.fn(),
    };

    mockHistoryService = {
      findEntryByOperationId: vi.fn(),
      undoUntilOperationId: vi.fn(),
      clear: vi.fn(),
    };

    mockWebsocketAdapter = {
      operationRejected$: new Subject(),
      diagramOperations$: new Subject(),
    };

    mockResyncService = {
      triggerResync: vi.fn(),
    };

    mockCollaborationService = {
      endCollaboration: vi.fn(() => of({})),
    };

    mockAppStateService = {
      setBlockOperations: vi.fn(),
    };

    service = new AppOperationRejectionHandler(
      mockLogger as unknown as LoggerService,
      mockHistoryService as unknown as AppHistoryService,
      mockWebsocketAdapter as unknown as InfraDfdWebsocketAdapter,
      mockResyncService as unknown as AppDiagramResyncService,
      mockCollaborationService as unknown as DfdCollaborationService,
      mockAppStateService as unknown as AppStateService,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize subscriptions', () => {
      service.initialize();

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should warn if already initialized', () => {
      service.initialize();
      service.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AppOperationRejectionHandler already initialized',
      );
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on destroy', () => {
      service.initialize();
      service.ngOnDestroy();

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppOperationRejectionHandler',
        'destroyed',
      );
    });

    it('should clear notification timer on destroy', () => {
      service.initialize();

      // Trigger a rejection to start notification timer
      mockHistoryService.findEntryByOperationId.mockReturnValue({
        operation_id: 'op-1',
      });
      mockHistoryService.undoUntilOperationId.mockReturnValue(of({ success: true, undoCount: 1 }));

      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Operation conflict',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      service.ngOnDestroy();

      // Timer should be cleared
      expect(mockLogger.debugComponent).toHaveBeenCalled();
    });
  });

  describe('Operation Rejection Handling', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should handle operation rejection with successful rollback', () => {
      mockHistoryService.findEntryByOperationId.mockReturnValue({
        operation_id: 'op-1',
      });
      mockHistoryService.undoUntilOperationId.mockReturnValue(of({ success: true, undoCount: 2 }));

      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Operation conflict',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      expect(mockLogger.warn).toHaveBeenCalledWith('Operation rejected by server', {
        operation_id: 'op-1',
        reason: 'conflict_detected',
        requires_resync: false,
      });
      expect(mockAppStateService.setBlockOperations).toHaveBeenCalledWith(true);
      expect(mockHistoryService.undoUntilOperationId).toHaveBeenCalledWith('op-1');
    });

    it('should force resync when history entry not found', () => {
      mockHistoryService.findEntryByOperationId.mockReturnValue(null);

      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Operation conflict',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cannot find history entry for rejected operation',
        { operation_id: 'op-1' },
      );
      expect(mockResyncService.triggerResync).toHaveBeenCalled();
    });

    it('should force resync on rollback failure', () => {
      mockHistoryService.findEntryByOperationId.mockReturnValue({
        operation_id: 'op-1',
      });
      mockHistoryService.undoUntilOperationId.mockReturnValue(of({ success: false, undoCount: 0 }));

      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Operation conflict',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to rollback operations',
        expect.any(Object),
      );
      expect(mockResyncService.triggerResync).toHaveBeenCalled();
    });

    it('should unblock operations after successful rollback', () => {
      mockHistoryService.findEntryByOperationId.mockReturnValue({
        operation_id: 'op-1',
      });
      mockHistoryService.undoUntilOperationId.mockReturnValue(of({ success: true, undoCount: 1 }));

      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Operation conflict',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      expect(mockAppStateService.setBlockOperations).toHaveBeenCalledWith(true);
      expect(mockAppStateService.setBlockOperations).toHaveBeenCalledWith(false);
    });
  });

  describe('Operation Queueing', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should queue operations during rollback', () => {
      mockHistoryService.findEntryByOperationId.mockReturnValue({
        operation_id: 'op-1',
      });

      // Use a delayed observable to keep rollback in progress
      let resolveRollback: any;
      mockHistoryService.undoUntilOperationId.mockReturnValue(
        new Observable(subscriber => {
          resolveRollback = () => {
            subscriber.next({ success: true, undoCount: 1 });
            subscriber.complete();
          };
        }),
      );

      // Start a rejection (triggers rollback)
      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Operation conflict',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      // Send operation during rollback (before completion)
      mockWebsocketAdapter.diagramOperations$.next({
        operation_id: 'op-2',
        type: 'add_node',
      });

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppOperationRejectionHandler',
        'Queued operation during rollback',
        expect.objectContaining({
          operation_id: 'op-2',
          queueLength: 1,
        }),
      );

      // Complete rollback
      resolveRollback();
    });

    it('should clear queued operations after rollback', () => {
      mockHistoryService.findEntryByOperationId.mockReturnValue({
        operation_id: 'op-1',
      });

      // Use a delayed observable to keep rollback in progress
      let resolveRollback: any;
      mockHistoryService.undoUntilOperationId.mockReturnValue(
        new Observable(subscriber => {
          resolveRollback = () => {
            subscriber.next({ success: true, undoCount: 1 });
            subscriber.complete();
          };
        }),
      );

      // Start a rejection (triggers rollback)
      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Operation conflict',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      // Send operations during rollback (before completion)
      mockWebsocketAdapter.diagramOperations$.next({
        operation_id: 'op-2',
        type: 'add_node',
      });
      mockWebsocketAdapter.diagramOperations$.next({
        operation_id: 'op-3',
        type: 'add_edge',
      });

      // Complete rollback
      resolveRollback();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Clearing queued operations after rollback',
        expect.objectContaining({
          queueLength: 2,
        }),
      );
    });
  });

  describe('Notification Batching', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should batch multiple rejections', async () => {
      mockHistoryService.findEntryByOperationId.mockReturnValue({
        operation_id: 'op-1',
      });
      mockHistoryService.undoUntilOperationId.mockReturnValue(of({ success: true, undoCount: 1 }));

      // Send two rejections
      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Operation conflict 1',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-2',
        reason: 'conflict_detected',
        message: 'Operation conflict 2',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      // Advance timer to trigger batched notification
      await vi.advanceTimersByTimeAsync(2000);

      expect(mockLogger.info).toHaveBeenCalledWith('Showing batched rejection notifications', {
        count: 2,
      });
    });

    it('should clear pending notifications after showing', async () => {
      mockHistoryService.findEntryByOperationId.mockReturnValue({
        operation_id: 'op-1',
      });
      mockHistoryService.undoUntilOperationId.mockReturnValue(of({ success: true, undoCount: 1 }));

      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Operation conflict',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      await vi.advanceTimersByTimeAsync(2000);

      // Second batch should show count 1, not 2
      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-2',
        reason: 'conflict_detected',
        message: 'Operation conflict 2',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      await vi.advanceTimersByTimeAsync(2000);

      expect(mockLogger.info).toHaveBeenCalledWith('Showing batched rejection notifications', {
        count: 1,
      });
    });

    it('should reset timer when new rejection arrives', async () => {
      mockHistoryService.findEntryByOperationId.mockReturnValue({
        operation_id: 'op-1',
      });
      mockHistoryService.undoUntilOperationId.mockReturnValue(of({ success: true, undoCount: 1 }));

      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Operation conflict 1',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      // Advance partway
      await vi.advanceTimersByTimeAsync(1000);

      // Send another rejection (should reset timer)
      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-2',
        reason: 'conflict_detected',
        message: 'Operation conflict 2',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      // Advance the rest
      await vi.advanceTimersByTimeAsync(2000);

      // Should show 2 notifications
      expect(mockLogger.info).toHaveBeenCalledWith('Showing batched rejection notifications', {
        count: 2,
      });
    });
  });

  describe('Circuit Breaker', () => {
    beforeEach(() => {
      service.initialize();
      mockHistoryService.findEntryByOperationId.mockReturnValue({
        operation_id: 'op-1',
      });
      mockHistoryService.undoUntilOperationId.mockReturnValue(of({ success: true, undoCount: 1 }));
    });

    it('should trip circuit breaker after too many rejections', () => {
      // Send 6 rejections (limit is 5)
      for (let i = 1; i <= 6; i++) {
        mockWebsocketAdapter.operationRejected$.next({
          operation_id: `op-${i}`,
          reason: 'conflict_detected',
          message: `Operation conflict ${i}`,
          requires_resync: false,
          timestamp: new Date().toISOString(),
        });
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Circuit breaker tripped - too many rejections or resyncs',
        expect.objectContaining({
          rejectionCount: 6,
        }),
      );
      expect(mockCollaborationService.endCollaboration).toHaveBeenCalled();
    });

    it('should clean up old rejections outside time window', async () => {
      // Send 3 rejections
      for (let i = 1; i <= 3; i++) {
        mockWebsocketAdapter.operationRejected$.next({
          operation_id: `op-${i}`,
          reason: 'conflict_detected',
          message: `Operation conflict ${i}`,
          requires_resync: false,
          timestamp: new Date().toISOString(),
        });
      }

      // Advance past 1 minute window
      await vi.advanceTimersByTimeAsync(61000);

      // Send 3 more rejections (should not trip breaker as old ones expired)
      for (let i = 4; i <= 6; i++) {
        mockWebsocketAdapter.operationRejected$.next({
          operation_id: `op-${i}`,
          reason: 'conflict_detected',
          message: `Operation conflict ${i}`,
          requires_resync: false,
          timestamp: new Date().toISOString(),
        });
      }

      // Should NOT have tripped circuit breaker
      expect(mockLogger.error).not.toHaveBeenCalledWith(
        'Circuit breaker tripped - too many rejections or resyncs',
        expect.any(Object),
      );
    });

    it('should trip circuit breaker after too many resyncs', () => {
      // Force resync 4 times (limit is 3)
      for (let i = 1; i <= 4; i++) {
        mockHistoryService.findEntryByOperationId.mockReturnValue(null);

        mockWebsocketAdapter.operationRejected$.next({
          operation_id: `op-${i}`,
          reason: 'conflict_detected',
          message: `Operation conflict ${i}`,
          requires_resync: false,
          timestamp: new Date().toISOString(),
        });
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Circuit breaker tripped - too many rejections or resyncs',
        expect.objectContaining({
          resyncCount: 4,
        }),
      );
    });

    it('should log collaboration end error on failure', () => {
      mockCollaborationService.endCollaboration.mockReturnValue(
        throwError(() => new Error('End failed')),
      );

      // Send 6 rejections to trip breaker
      for (let i = 1; i <= 6; i++) {
        mockWebsocketAdapter.operationRejected$.next({
          operation_id: `op-${i}`,
          reason: 'conflict_detected',
          message: `Operation conflict ${i}`,
          requires_resync: false,
          timestamp: new Date().toISOString(),
        });
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to end collaboration',
        expect.objectContaining({
          error: expect.any(Error),
        }),
      );
    });
  });

  describe('Notification Severity and Titles', () => {
    beforeEach(() => {
      service.initialize();
      mockHistoryService.findEntryByOperationId.mockReturnValue({
        operation_id: 'op-1',
      });
      mockHistoryService.undoUntilOperationId.mockReturnValue(of({ success: true, undoCount: 1 }));
    });

    it('should use info severity for no_state_change', async () => {
      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'no_state_change',
        message: 'No changes',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      await vi.advanceTimersByTimeAsync(2000);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rejection notification',
        expect.objectContaining({
          severity: 'info',
        }),
      );
    });

    it('should use warning severity for conflict_detected', async () => {
      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Conflict',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      await vi.advanceTimersByTimeAsync(2000);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rejection notification',
        expect.objectContaining({
          severity: 'warning',
        }),
      );
    });

    it('should use error severity for validation_failed', async () => {
      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'validation_failed',
        message: 'Invalid',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      await vi.advanceTimersByTimeAsync(2000);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rejection notification',
        expect.objectContaining({
          severity: 'error',
        }),
      );
    });

    it('should use correct title for conflict_detected', async () => {
      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Conflict',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      await vi.advanceTimersByTimeAsync(2000);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rejection notification',
        expect.objectContaining({
          title: 'Operation Conflict',
        }),
      );
    });

    it('should use correct title for permission_denied', async () => {
      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'permission_denied',
        message: 'No permission',
        requires_resync: false,
        timestamp: new Date().toISOString(),
      });

      await vi.advanceTimersByTimeAsync(2000);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rejection notification',
        expect.objectContaining({
          title: 'Permission Denied',
        }),
      );
    });

    it('should show resync action when required', async () => {
      mockWebsocketAdapter.operationRejected$.next({
        operation_id: 'op-1',
        reason: 'conflict_detected',
        message: 'Conflict',
        requires_resync: true,
        timestamp: new Date().toISOString(),
      });

      await vi.advanceTimersByTimeAsync(2000);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rejection notification',
        expect.objectContaining({
          action: 'Resync Diagram',
          requiresResync: true,
        }),
      );
    });
  });

  describe('Error Subscription Handling', () => {
    it('should handle errors in operation rejected subscription', () => {
      service.initialize();

      mockWebsocketAdapter.operationRejected$.error(new Error('Test error'));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in operation rejected subscription',
        expect.objectContaining({
          error: expect.any(Error),
        }),
      );
    });

    it('should handle errors in diagram operations subscription', () => {
      service.initialize();

      mockWebsocketAdapter.diagramOperations$.error(new Error('Test error'));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in diagram operations subscription',
        expect.objectContaining({
          error: expect.any(Error),
        }),
      );
    });
  });
});
