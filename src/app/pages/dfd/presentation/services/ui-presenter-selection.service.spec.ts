/**
 * Unit tests for UiPresenterSelectionService
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/pages/dfd/presentation/services/ui-presenter-selection.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { UiPresenterSelectionService } from './ui-presenter-selection.service';

describe('UiPresenterSelectionService', () => {
  let service: UiPresenterSelectionService;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let mockCollaborationService: {
    isCurrentUserPresenterModeActive: ReturnType<typeof vi.fn>;
    isCurrentUserPresenter: ReturnType<typeof vi.fn>;
  };
  let mockCollaborativeOperationService: {
    sendPresenterSelection: ReturnType<typeof vi.fn>;
  };
  let mockUiPresenterCursorDisplayService: {
    handlePresenterSelectionUpdate: ReturnType<typeof vi.fn>;
  };
  let mockGraph: {
    on: ReturnType<typeof vi.fn>;
    getCells: ReturnType<typeof vi.fn>;
  };
  let mockSelectionAdapter: {
    getSelectedCells: ReturnType<typeof vi.fn>;
    clearSelection: ReturnType<typeof vi.fn>;
    selectCells: ReturnType<typeof vi.fn>;
  };
  let selectionChangeCallback: (args: { added: any[]; removed: any[] }) => void;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    // Create mock collaboration service
    mockCollaborationService = {
      isCurrentUserPresenterModeActive: vi.fn(() => false),
      isCurrentUserPresenter: vi.fn(() => false),
    };

    // Create mock collaborative operation service
    mockCollaborativeOperationService = {
      sendPresenterSelection: vi.fn(() => of(undefined)),
    };

    // Create mock UI presenter cursor display service
    mockUiPresenterCursorDisplayService = {
      handlePresenterSelectionUpdate: vi.fn(),
    };

    // Create mock graph
    mockGraph = {
      on: vi.fn((event: string, callback: any) => {
        if (event === 'selection:changed') {
          selectionChangeCallback = callback;
        }
      }),
      getCells: vi.fn(() => []),
    };

    // Create mock selection adapter
    mockSelectionAdapter = {
      getSelectedCells: vi.fn(() => []),
      clearSelection: vi.fn(),
      selectCells: vi.fn(),
    };

    // Create service with mocks
    service = new UiPresenterSelectionService(
      mockLogger as any,
      mockCollaborationService as any,
      mockCollaborativeOperationService as any,
      mockUiPresenterCursorDisplayService as any,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });

    it('should not be initialized initially', () => {
      expect(service.isInitialized).toBe(false);
    });
  });

  describe('initialize()', () => {
    it('should initialize with graph and selection adapter', () => {
      service.initialize(mockGraph as any, mockSelectionAdapter as any);

      expect(service.isInitialized).toBe(true);
      expect(mockGraph.on).toHaveBeenCalledWith('selection:changed', expect.any(Function));
    });

    it('should setup selection change listener', () => {
      service.initialize(mockGraph as any, mockSelectionAdapter as any);

      expect(mockGraph.on).toHaveBeenCalledWith('selection:changed', expect.any(Function));
    });

    it('should log error if graph not available', () => {
      service.initialize(null as any, mockSelectionAdapter as any);

      // Try to trigger selection change (should fail gracefully)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cannot setup selection listener: graph not available',
      );
    });
  });

  describe('Selection Broadcasting', () => {
    beforeEach(() => {
      service.initialize(mockGraph as any, mockSelectionAdapter as any);
    });

    it('should broadcast selection change when presenter mode is active', () => {
      mockCollaborationService.isCurrentUserPresenterModeActive.mockReturnValue(true);
      mockSelectionAdapter.getSelectedCells.mockReturnValue([{ id: 'cell1' }, { id: 'cell2' }]);

      // Trigger selection change
      selectionChangeCallback({ added: [], removed: [] });

      expect(mockCollaborativeOperationService.sendPresenterSelection).toHaveBeenCalledWith([
        'cell1',
        'cell2',
      ]);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'UiPresenterSelectionService',
        'Broadcast presenter selection change',
        expect.objectContaining({
          selectedCellIds: ['cell1', 'cell2'],
          count: 2,
        }),
      );
    });

    it('should not broadcast when presenter mode is not active', () => {
      mockCollaborationService.isCurrentUserPresenterModeActive.mockReturnValue(false);

      // Trigger selection change
      selectionChangeCallback({ added: [], removed: [] });

      expect(mockCollaborativeOperationService.sendPresenterSelection).not.toHaveBeenCalled();
    });

    it('should broadcast empty selection', () => {
      mockCollaborationService.isCurrentUserPresenterModeActive.mockReturnValue(true);
      mockSelectionAdapter.getSelectedCells.mockReturnValue([]);

      // Trigger selection change
      selectionChangeCallback({ added: [], removed: [] });

      expect(mockCollaborativeOperationService.sendPresenterSelection).toHaveBeenCalledWith([]);
    });

    it('should handle broadcast errors', () => {
      mockCollaborationService.isCurrentUserPresenterModeActive.mockReturnValue(true);
      mockSelectionAdapter.getSelectedCells.mockReturnValue([{ id: 'cell1' }]);
      mockCollaborativeOperationService.sendPresenterSelection.mockReturnValue(
        throwError(() => new Error('Broadcast error')),
      );

      // Trigger selection change
      selectionChangeCallback({ added: [], removed: [] });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error broadcasting selection change',
        expect.any(Error),
      );
    });

    it('should handle errors when getting selected cells', () => {
      mockCollaborationService.isCurrentUserPresenterModeActive.mockReturnValue(true);
      mockSelectionAdapter.getSelectedCells.mockImplementation(() => {
        throw new Error('Get cells error');
      });

      // Trigger selection change
      selectionChangeCallback({ added: [], removed: [] });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error broadcasting selection change',
        expect.any(Error),
      );
    });
  });

  describe('handlePresenterSelectionUpdate()', () => {
    beforeEach(() => {
      service.initialize(mockGraph as any, mockSelectionAdapter as any);
    });

    it('should apply selection update for non-presenter users', () => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(false);
      mockGraph.getCells.mockReturnValue([{ id: 'cell1' }, { id: 'cell2' }, { id: 'cell3' }]);

      service.handlePresenterSelectionUpdate(['cell1', 'cell3']);

      expect(mockSelectionAdapter.clearSelection).toHaveBeenCalledWith(mockGraph);
      expect(mockSelectionAdapter.selectCells).toHaveBeenCalledWith(mockGraph, [
        { id: 'cell1' },
        { id: 'cell3' },
      ]);
      expect(mockUiPresenterCursorDisplayService.handlePresenterSelectionUpdate).toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'UiPresenterSelectionService',
        'Applied presenter selection update',
        expect.objectContaining({
          selectedCellIds: ['cell1', 'cell3'],
          foundCells: 2,
        }),
      );
    });

    it('should not apply selection if current user is presenter', () => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(true);

      service.handlePresenterSelectionUpdate(['cell1']);

      expect(mockSelectionAdapter.clearSelection).not.toHaveBeenCalled();
      expect(mockSelectionAdapter.selectCells).not.toHaveBeenCalled();
    });

    it('should clear selection if no cells match', () => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(false);
      mockGraph.getCells.mockReturnValue([{ id: 'cell1' }, { id: 'cell2' }]);

      service.handlePresenterSelectionUpdate(['cell3', 'cell4']);

      expect(mockSelectionAdapter.clearSelection).toHaveBeenCalledWith(mockGraph);
      expect(mockSelectionAdapter.selectCells).not.toHaveBeenCalled();
    });

    it('should handle errors during selection update', () => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(false);
      mockGraph.getCells.mockImplementation(() => {
        throw new Error('Get cells error');
      });

      service.handlePresenterSelectionUpdate(['cell1']);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error handling presenter selection update',
        expect.any(Error),
      );
    });

    it('should log error if graph not available', () => {
      service.initialize(null as any, mockSelectionAdapter as any);
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(false);

      service.handlePresenterSelectionUpdate(['cell1']);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cannot handle selection update: graph or selection adapter not available',
      );
    });
  });

  describe('broadcastCurrentSelection()', () => {
    beforeEach(() => {
      service.initialize(mockGraph as any, mockSelectionAdapter as any);
    });

    it('should broadcast current selection when presenter mode active', () => {
      mockCollaborationService.isCurrentUserPresenterModeActive.mockReturnValue(true);
      mockSelectionAdapter.getSelectedCells.mockReturnValue([{ id: 'cell1' }]);

      service.broadcastCurrentSelection();

      expect(mockCollaborativeOperationService.sendPresenterSelection).toHaveBeenCalledWith([
        'cell1',
      ]);
    });

    it('should not broadcast when presenter mode not active', () => {
      mockCollaborationService.isCurrentUserPresenterModeActive.mockReturnValue(false);

      service.broadcastCurrentSelection();

      expect(mockCollaborativeOperationService.sendPresenterSelection).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot broadcast selection: presenter mode not active',
      );
    });
  });

  describe('clearSelectionForNonPresenters()', () => {
    beforeEach(() => {
      service.initialize(mockGraph as any, mockSelectionAdapter as any);
    });

    it('should clear selection for non-presenter users', () => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(false);

      service.clearSelectionForNonPresenters();

      expect(mockSelectionAdapter.clearSelection).toHaveBeenCalledWith(mockGraph);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'UiPresenterSelectionService',
        'Cleared selection for non-presenter user',
      );
    });

    it('should not clear selection for presenter', () => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(true);

      service.clearSelectionForNonPresenters();

      expect(mockSelectionAdapter.clearSelection).not.toHaveBeenCalled();
    });

    it('should handle errors when clearing selection', () => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(false);
      mockSelectionAdapter.clearSelection.mockImplementation(() => {
        throw new Error('Clear error');
      });

      service.clearSelectionForNonPresenters();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error clearing selection for non-presenter',
        expect.any(Error),
      );
    });
  });

  describe('ngOnDestroy()', () => {
    it('should cleanup resources and reset state', () => {
      service.initialize(mockGraph as any, mockSelectionAdapter as any);

      expect(service.isInitialized).toBe(true);

      service.ngOnDestroy();

      expect(service.isInitialized).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('UiPresenterSelectionService destroyed');
    });
  });
});
