// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiPresenterCoordinatorService } from './ui-presenter-coordinator.service';
import type { LoggerService } from '@app/core/services/logger.service';
import type { WebSocketAdapter } from '@app/core/services/websocket.adapter';
import type { UiPresenterCursorService } from './ui-presenter-cursor.service';
import type { UiPresenterCursorDisplayService } from './ui-presenter-cursor-display.service';
import type { UiPresenterSelectionService } from './ui-presenter-selection.service';
import type { InfraX6SelectionAdapter } from '../../infrastructure/adapters/infra-x6-selection.adapter';
import type { Graph } from '@antv/x6';
import type {
  PresenterCursorMessage,
  PresenterSelectionMessage,
} from '@app/core/types/websocket-message.types';
import { Subject } from 'rxjs';

describe('UiPresenterCoordinatorService', () => {
  let service: UiPresenterCoordinatorService;
  let mockLogger: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let mockWebSocketAdapter: {
    getTMIMessagesOfType: ReturnType<typeof vi.fn>;
  };
  let mockUiPresenterCursorService: {
    initialize: ReturnType<typeof vi.fn>;
    isTracking: boolean;
  };
  let mockUiPresenterCursorDisplayService: {
    initialize: ReturnType<typeof vi.fn>;
    handlePresenterCursorUpdate: ReturnType<typeof vi.fn>;
    forceRemovePresenterCursor: ReturnType<typeof vi.fn>;
    isShowingPresenterCursor: boolean;
  };
  let mockUiPresenterSelectionService: {
    initialize: ReturnType<typeof vi.fn>;
    handlePresenterSelectionUpdate: ReturnType<typeof vi.fn>;
    clearSelectionForNonPresenters: ReturnType<typeof vi.fn>;
    isInitialized: boolean;
  };

  let presenterCursorSubject: Subject<PresenterCursorMessage>;
  let presenterSelectionSubject: Subject<PresenterSelectionMessage>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create subjects for message streams
    presenterCursorSubject = new Subject<PresenterCursorMessage>();
    presenterSelectionSubject = new Subject<PresenterSelectionMessage>();

    // Create mock LoggerService
    mockLogger = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debugComponent: vi.fn(),
    };

    // Create mock WebSocketAdapter
    mockWebSocketAdapter = {
      getTMIMessagesOfType: vi.fn((messageType: string) => {
        if (messageType === 'presenter_cursor') {
          return presenterCursorSubject.asObservable();
        } else if (messageType === 'presenter_selection') {
          return presenterSelectionSubject.asObservable();
        }
        return new Subject().asObservable();
      }),
    };

    // Create mock UiPresenterCursorService
    mockUiPresenterCursorService = {
      initialize: vi.fn(),
      isTracking: false,
    };

    // Create mock UiPresenterCursorDisplayService
    mockUiPresenterCursorDisplayService = {
      initialize: vi.fn(),
      handlePresenterCursorUpdate: vi.fn(),
      forceRemovePresenterCursor: vi.fn(),
      isShowingPresenterCursor: false,
    };

    // Create mock UiPresenterSelectionService
    mockUiPresenterSelectionService = {
      initialize: vi.fn(),
      handlePresenterSelectionUpdate: vi.fn(),
      clearSelectionForNonPresenters: vi.fn(),
      isInitialized: false,
    };

    // Instantiate service with mock dependencies
    service = new UiPresenterCoordinatorService(
      mockLogger as unknown as LoggerService,
      mockWebSocketAdapter as unknown as WebSocketAdapter,
      mockUiPresenterCursorService as unknown as UiPresenterCursorService,
      mockUiPresenterCursorDisplayService as unknown as UiPresenterCursorDisplayService,
      mockUiPresenterSelectionService as unknown as UiPresenterSelectionService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should start not initialized', () => {
      expect(service.isInitialized).toBe(false);
    });
  });

  describe('initialize()', () => {
    let mockGraphContainer: HTMLElement;
    let mockGraph: Graph;
    let mockSelectionAdapter: InfraX6SelectionAdapter;

    beforeEach(() => {
      mockGraphContainer = document.createElement('div');
      mockGraph = {} as Graph;
      mockSelectionAdapter = {} as InfraX6SelectionAdapter;
    });

    it('should initialize all presenter services', () => {
      service.initialize(mockGraphContainer, mockGraph, mockSelectionAdapter);

      expect(mockUiPresenterCursorService.initialize).toHaveBeenCalledWith(
        mockGraphContainer,
        mockGraph,
      );
      expect(mockUiPresenterCursorDisplayService.initialize).toHaveBeenCalledWith(
        mockGraphContainer,
        mockGraph,
      );
      expect(mockUiPresenterSelectionService.initialize).toHaveBeenCalledWith(
        mockGraph,
        mockSelectionAdapter,
      );
    });

    it('should subscribe to presenter cursor messages', () => {
      service.initialize(mockGraphContainer, mockGraph, mockSelectionAdapter);

      expect(mockWebSocketAdapter.getTMIMessagesOfType).toHaveBeenCalledWith('presenter_cursor');
    });

    it('should subscribe to presenter selection messages', () => {
      service.initialize(mockGraphContainer, mockGraph, mockSelectionAdapter);

      expect(mockWebSocketAdapter.getTMIMessagesOfType).toHaveBeenCalledWith('presenter_selection');
    });

    it('should set isInitialized to true', () => {
      service.initialize(mockGraphContainer, mockGraph, mockSelectionAdapter);

      expect(service.isInitialized).toBe(true);
    });
  });

  describe('Presenter Cursor Message Handling', () => {
    let mockGraphContainer: HTMLElement;
    let mockGraph: Graph;
    let mockSelectionAdapter: InfraX6SelectionAdapter;

    beforeEach(() => {
      mockGraphContainer = document.createElement('div');
      mockGraph = {} as Graph;
      mockSelectionAdapter = {} as InfraX6SelectionAdapter;
      service.initialize(mockGraphContainer, mockGraph, mockSelectionAdapter);
    });

    it('should handle valid presenter cursor message', () => {
      const message: PresenterCursorMessage = {
        message_type: 'presenter_cursor',
        user: {
          provider: 'google',
          user_id: 'user-123',
          email: 'user@example.com',
        },
        cursor_position: { x: 100, y: 200 },
      };

      presenterCursorSubject.next(message);

      expect(mockUiPresenterCursorDisplayService.handlePresenterCursorUpdate).toHaveBeenCalledWith({
        x: 100,
        y: 200,
      });
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'UiPresenterCoordinator',
        'Handling presenter cursor update',
        expect.objectContaining({
          userCompositeKey: 'google:user-123',
          userEmail: 'user@example.com',
        }),
      );
    });

    it('should handle message without user field (per AsyncAPI spec)', () => {
      const message = {
        message_type: 'presenter_cursor',
        cursor_position: { x: 100, y: 200 },
      } as PresenterCursorMessage;

      presenterCursorSubject.next(message);

      expect(mockUiPresenterCursorDisplayService.handlePresenterCursorUpdate).toHaveBeenCalledWith({
        x: 100,
        y: 200,
      });
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'UiPresenterCoordinator',
        'Handling presenter cursor update',
        expect.objectContaining({
          position: { x: 100, y: 200 },
        }),
      );
    });

    it('should reject message with missing cursor_position', () => {
      const message = {
        message_type: 'presenter_cursor',
        user: {
          provider: 'google',
          provider_id: 'user-123',
          email: 'user@example.com',
        },
      } as PresenterCursorMessage;

      presenterCursorSubject.next(message);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Received presenter_cursor message without cursor position',
        expect.any(Object),
      );
      expect(
        mockUiPresenterCursorDisplayService.handlePresenterCursorUpdate,
      ).not.toHaveBeenCalled();
    });

    it('should log error when cursor subscription errors', () => {
      const error = new Error('WebSocket error');
      presenterCursorSubject.error(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in presenter cursor subscription',
        error,
      );
    });
  });

  describe('Presenter Selection Message Handling', () => {
    let mockGraphContainer: HTMLElement;
    let mockGraph: Graph;
    let mockSelectionAdapter: InfraX6SelectionAdapter;

    beforeEach(() => {
      mockGraphContainer = document.createElement('div');
      mockGraph = {} as Graph;
      mockSelectionAdapter = {} as InfraX6SelectionAdapter;
      service.initialize(mockGraphContainer, mockGraph, mockSelectionAdapter);
    });

    it('should handle valid presenter selection message', () => {
      const message: PresenterSelectionMessage = {
        message_type: 'presenter_selection',
        user: {
          provider: 'google',
          user_id: 'user-123',
          email: 'user@example.com',
        },
        selected_cells: ['cell-1', 'cell-2'],
      };

      presenterSelectionSubject.next(message);

      expect(mockUiPresenterSelectionService.handlePresenterSelectionUpdate).toHaveBeenCalledWith([
        'cell-1',
        'cell-2',
      ]);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'UiPresenterCoordinator',
        'Handling presenter selection update',
        expect.objectContaining({
          userCompositeKey: 'google:user-123',
          userEmail: 'user@example.com',
          cellCount: 2,
        }),
      );
    });

    it('should handle empty selection array', () => {
      const message: PresenterSelectionMessage = {
        message_type: 'presenter_selection',
        user: {
          provider: 'google',
          user_id: 'user-123',
          email: 'user@example.com',
        },
        selected_cells: [],
      };

      presenterSelectionSubject.next(message);

      expect(mockUiPresenterSelectionService.handlePresenterSelectionUpdate).toHaveBeenCalledWith(
        [],
      );
    });

    it('should handle message without user field (per AsyncAPI spec)', () => {
      const message = {
        message_type: 'presenter_selection',
        selected_cells: ['cell-1', 'cell-2'],
      } as PresenterSelectionMessage;

      presenterSelectionSubject.next(message);

      expect(mockUiPresenterSelectionService.handlePresenterSelectionUpdate).toHaveBeenCalledWith([
        'cell-1',
        'cell-2',
      ]);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'UiPresenterCoordinator',
        'Handling presenter selection update',
        expect.objectContaining({
          cellCount: 2,
          selectedCells: ['cell-1', 'cell-2'],
        }),
      );
    });

    it('should reject message with missing selected_cells', () => {
      const message = {
        message_type: 'presenter_selection',
        user: {
          provider: 'google',
          provider_id: 'user-123',
          email: 'user@example.com',
        },
      } as PresenterSelectionMessage;

      presenterSelectionSubject.next(message);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Received presenter_selection message without selected_cells',
        expect.any(Object),
      );
      expect(mockUiPresenterSelectionService.handlePresenterSelectionUpdate).not.toHaveBeenCalled();
    });

    it('should log error when selection subscription errors', () => {
      const error = new Error('WebSocket error');
      presenterSelectionSubject.error(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in presenter selection subscription',
        error,
      );
    });
  });

  describe('cleanupPresenterDisplay()', () => {
    it('should cleanup cursor display', () => {
      service.cleanupPresenterDisplay();

      expect(mockUiPresenterCursorDisplayService.forceRemovePresenterCursor).toHaveBeenCalled();
    });

    it('should cleanup selection display', () => {
      service.cleanupPresenterDisplay();

      expect(mockUiPresenterSelectionService.clearSelectionForNonPresenters).toHaveBeenCalled();
    });

    it('should log debug message', () => {
      service.cleanupPresenterDisplay();

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'UiPresenterCoordinator',
        'Cleaned up presenter display',
      );
    });
  });

  describe('getStatus()', () => {
    it('should return status before initialization', () => {
      const status = service.getStatus();

      expect(status).toEqual({
        coordinatorInitialized: false,
        cursorTracking: false,
        showingPresenterCursor: false,
        selectionInitialized: false,
      });
    });

    it('should return status after initialization', () => {
      const mockGraphContainer = document.createElement('div');
      const mockGraph = {} as Graph;
      const mockSelectionAdapter = {} as InfraX6SelectionAdapter;

      service.initialize(mockGraphContainer, mockGraph, mockSelectionAdapter);

      const status = service.getStatus();

      expect(status).toEqual({
        coordinatorInitialized: true,
        cursorTracking: false,
        showingPresenterCursor: false,
        selectionInitialized: false,
      });
    });

    it('should reflect cursor tracking state', () => {
      const mockGraphContainer = document.createElement('div');
      const mockGraph = {} as Graph;
      const mockSelectionAdapter = {} as InfraX6SelectionAdapter;

      mockUiPresenterCursorService.isTracking = true;
      service.initialize(mockGraphContainer, mockGraph, mockSelectionAdapter);

      const status = service.getStatus();

      expect(status.cursorTracking).toBe(true);
    });

    it('should reflect cursor display state', () => {
      const mockGraphContainer = document.createElement('div');
      const mockGraph = {} as Graph;
      const mockSelectionAdapter = {} as InfraX6SelectionAdapter;

      mockUiPresenterCursorDisplayService.isShowingPresenterCursor = true;
      service.initialize(mockGraphContainer, mockGraph, mockSelectionAdapter);

      const status = service.getStatus();

      expect(status.showingPresenterCursor).toBe(true);
    });

    it('should reflect selection initialization state', () => {
      const mockGraphContainer = document.createElement('div');
      const mockGraph = {} as Graph;
      const mockSelectionAdapter = {} as InfraX6SelectionAdapter;

      mockUiPresenterSelectionService.isInitialized = true;
      service.initialize(mockGraphContainer, mockGraph, mockSelectionAdapter);

      const status = service.getStatus();

      expect(status.selectionInitialized).toBe(true);
    });
  });

  describe('ngOnDestroy()', () => {
    it('should unsubscribe from WebSocket subscriptions', () => {
      const mockGraphContainer = document.createElement('div');
      const mockGraph = {} as Graph;
      const mockSelectionAdapter = {} as InfraX6SelectionAdapter;

      service.initialize(mockGraphContainer, mockGraph, mockSelectionAdapter);

      // Subscribe to check if subscriptions are active
      let cursorMessageReceived = false;
      let selectionMessageReceived = false;

      presenterCursorSubject.subscribe(() => {
        cursorMessageReceived = true;
      });
      presenterSelectionSubject.subscribe(() => {
        selectionMessageReceived = true;
      });

      service.ngOnDestroy();

      // Emit messages after destroy - coordinator should not handle them
      const cursorMessage: PresenterCursorMessage = {
        message_type: 'presenter_cursor',
        user: {
          provider: 'google',
          provider_id: 'user-123',
          email: 'user@example.com',
        },
        cursor_position: { x: 100, y: 200 },
      };
      presenterCursorSubject.next(cursorMessage);

      const selectionMessage: PresenterSelectionMessage = {
        message_type: 'presenter_selection',
        user: {
          provider: 'google',
          provider_id: 'user-123',
          email: 'user@example.com',
        },
        selected_cells: ['cell-1'],
      };
      presenterSelectionSubject.next(selectionMessage);

      // Messages should still be received by our test subscriptions
      expect(cursorMessageReceived).toBe(true);
      expect(selectionMessageReceived).toBe(true);

      // But coordinator should not have processed them (no additional calls)
      expect(
        mockUiPresenterCursorDisplayService.handlePresenterCursorUpdate,
      ).not.toHaveBeenCalled();
      expect(mockUiPresenterSelectionService.handlePresenterSelectionUpdate).not.toHaveBeenCalled();
    });

    it('should reset isInitialized to false', () => {
      const mockGraphContainer = document.createElement('div');
      const mockGraph = {} as Graph;
      const mockSelectionAdapter = {} as InfraX6SelectionAdapter;

      service.initialize(mockGraphContainer, mockGraph, mockSelectionAdapter);
      expect(service.isInitialized).toBe(true);

      service.ngOnDestroy();

      expect(service.isInitialized).toBe(false);
    });

    it('should log destruction', () => {
      service.ngOnDestroy();

      expect(mockLogger.info).toHaveBeenCalledWith('UiPresenterCoordinatorService destroyed');
    });
  });
});
