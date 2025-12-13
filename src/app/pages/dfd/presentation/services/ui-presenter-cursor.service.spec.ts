/**
 * Unit tests for UiPresenterCursorService
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/pages/dfd/presentation/services/ui-presenter-cursor.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { UiPresenterCursorService } from './ui-presenter-cursor.service';

describe('UiPresenterCursorService', () => {
  let service: UiPresenterCursorService;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let mockCollaborationService: {
    collaborationState$: BehaviorSubject<any>;
    isCurrentUserPresenter: ReturnType<typeof vi.fn>;
  };
  let mockCollaborativeOperationService: {
    sendPresenterCursor: ReturnType<typeof vi.fn>;
  };
  let mockGraphContainer: HTMLElement;
  let mockGraph: {
    clientToGraph: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    // Create mock collaboration service
    mockCollaborationService = {
      collaborationState$: new BehaviorSubject({
        isPresenterModeActive: false,
      }),
      isCurrentUserPresenter: vi.fn(() => false),
    };

    // Create mock collaborative operation service
    mockCollaborativeOperationService = {
      sendPresenterCursor: vi.fn(() => of(undefined)),
    };

    // Create mock graph container
    mockGraphContainer = document.createElement('div');
    mockGraphContainer.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));

    // Create mock graph
    mockGraph = {
      clientToGraph: vi.fn((x: number, y: number) => ({ x, y })),
    };

    // Create service with mocks
    service = new UiPresenterCursorService(
      mockLogger as any,
      mockCollaborationService as any,
      mockCollaborativeOperationService as any,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
    vi.useRealTimers();
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });

    it('should not be tracking initially', () => {
      expect(service.isTracking).toBe(false);
    });
  });

  describe('initialize()', () => {
    it('should initialize with graph container and graph', () => {
      service.initialize(mockGraphContainer, mockGraph as any);

      // Should not throw error
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should start tracking when presenter mode becomes active', () => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(true);

      service.initialize(mockGraphContainer, mockGraph as any);

      // Activate presenter mode
      mockCollaborationService.collaborationState$.next({
        isPresenterModeActive: true,
      });

      expect(service.isTracking).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Started presenter cursor tracking');
    });

    it('should not start tracking if user is not presenter', () => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(false);

      service.initialize(mockGraphContainer, mockGraph as any);

      // Activate presenter mode
      mockCollaborationService.collaborationState$.next({
        isPresenterModeActive: true,
      });

      expect(service.isTracking).toBe(false);
    });

    it('should stop tracking when presenter mode is deactivated', () => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(true);

      service.initialize(mockGraphContainer, mockGraph as any);

      // Activate presenter mode
      mockCollaborationService.collaborationState$.next({
        isPresenterModeActive: true,
      });

      expect(service.isTracking).toBe(true);

      // Deactivate presenter mode
      mockCollaborationService.collaborationState$.next({
        isPresenterModeActive: false,
      });

      expect(service.isTracking).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Stopped presenter cursor tracking');
    });
  });

  describe('Mouse Event Handling', () => {
    beforeEach(() => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(true);
      service.initialize(mockGraphContainer, mockGraph as any);

      // Activate presenter mode
      mockCollaborationService.collaborationState$.next({
        isPresenterModeActive: true,
      });
    });

    it('should broadcast cursor position on mouse move', () => {
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 200,
      });

      mockGraphContainer.dispatchEvent(mouseEvent);

      // Wait for throttled event
      vi.advanceTimersByTime(100);

      expect(mockCollaborativeOperationService.sendPresenterCursor).toHaveBeenCalled();
    });

    it('should convert client coordinates to graph coordinates', () => {
      mockGraph.clientToGraph.mockReturnValue({ x: 150, y: 250 });

      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 200,
      });

      mockGraphContainer.dispatchEvent(mouseEvent);

      vi.advanceTimersByTime(100);

      expect(mockGraph.clientToGraph).toHaveBeenCalledWith(100, 200);
    });

    it('should not broadcast if coordinate conversion fails', () => {
      mockGraph.clientToGraph.mockReturnValue(null);

      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 200,
      });

      mockGraphContainer.dispatchEvent(mouseEvent);

      vi.advanceTimersByTime(100);

      expect(mockCollaborativeOperationService.sendPresenterCursor).not.toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'UiPresenterCursorService',
        'Skipping cursor broadcast - coordinate conversion failed',
      );
    });

    it('should handle errors during coordinate conversion', () => {
      mockGraph.clientToGraph.mockImplementation(() => {
        throw new Error('Conversion error');
      });

      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 200,
      });

      mockGraphContainer.dispatchEvent(mouseEvent);

      vi.advanceTimersByTime(100);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error converting client coordinates to graph coordinates',
        expect.any(Error),
      );
    });
  });

  describe('Position Broadcasting', () => {
    beforeEach(() => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(true);
      service.initialize(mockGraphContainer, mockGraph as any);

      mockCollaborationService.collaborationState$.next({
        isPresenterModeActive: true,
      });
    });

    it('should only broadcast if position changed significantly', () => {
      // First mouse move
      const mouseEvent1 = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 200,
      });

      mockGraphContainer.dispatchEvent(mouseEvent1);
      vi.advanceTimersByTime(100);

      expect(mockCollaborativeOperationService.sendPresenterCursor).toHaveBeenCalledTimes(1);

      // Second mouse move - small change (< 5 pixels)
      const mouseEvent2 = new MouseEvent('mousemove', {
        clientX: 102,
        clientY: 202,
      });

      mockGraphContainer.dispatchEvent(mouseEvent2);
      vi.advanceTimersByTime(100);

      // Should not broadcast again
      expect(mockCollaborativeOperationService.sendPresenterCursor).toHaveBeenCalledTimes(1);
    });

    it('should broadcast if position changed by at least 5 pixels', () => {
      // First mouse move
      const mouseEvent1 = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 200,
      });

      mockGraphContainer.dispatchEvent(mouseEvent1);
      vi.advanceTimersByTime(100);

      expect(mockCollaborativeOperationService.sendPresenterCursor).toHaveBeenCalledTimes(1);

      // Second mouse move - large change (>= 5 pixels)
      const mouseEvent2 = new MouseEvent('mousemove', {
        clientX: 106,
        clientY: 206,
      });

      mockGraphContainer.dispatchEvent(mouseEvent2);
      vi.advanceTimersByTime(100);

      // Should broadcast again
      expect(mockCollaborativeOperationService.sendPresenterCursor).toHaveBeenCalledTimes(2);
    });

    it('should handle broadcast errors', () => {
      mockCollaborativeOperationService.sendPresenterCursor.mockReturnValue(
        throwError(() => new Error('Broadcast error')),
      );

      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 200,
      });

      mockGraphContainer.dispatchEvent(mouseEvent);

      vi.advanceTimersByTime(100);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error broadcasting cursor position',
        expect.any(Error),
      );
    });
  });

  describe('Mouse Event Validation', () => {
    beforeEach(() => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(true);
      service.initialize(mockGraphContainer, mockGraph as any);

      mockCollaborationService.collaborationState$.next({
        isPresenterModeActive: true,
      });
    });

    it('should validate mouse is within viewport', () => {
      // Mock window size
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      const validEvent = new MouseEvent('mousemove', {
        clientX: 500,
        clientY: 400,
      });

      mockGraphContainer.dispatchEvent(validEvent);

      vi.advanceTimersByTime(100);

      expect(mockCollaborativeOperationService.sendPresenterCursor).toHaveBeenCalled();
    });

    it('should reject mouse outside viewport', () => {
      // Mock window size
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

      const invalidEvent = new MouseEvent('mousemove', {
        clientX: 2000, // Outside viewport
        clientY: 400,
      });

      mockGraphContainer.dispatchEvent(invalidEvent);

      vi.advanceTimersByTime(100);

      expect(mockCollaborativeOperationService.sendPresenterCursor).not.toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'UiPresenterCursorService',
        'Presenter cursor outside viewport - skipping broadcast',
        expect.any(Object),
      );
    });

    it('should reject mouse outside graph container', () => {
      const invalidEvent = new MouseEvent('mousemove', {
        clientX: 1000, // Outside container (which is 800px wide)
        clientY: 400,
      });

      mockGraphContainer.dispatchEvent(invalidEvent);

      vi.advanceTimersByTime(100);

      expect(mockCollaborativeOperationService.sendPresenterCursor).not.toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'UiPresenterCursorService',
        'Presenter cursor outside graph container - skipping broadcast',
        expect.any(Object),
      );
    });
  });

  describe('ngOnDestroy()', () => {
    it('should stop tracking and cleanup resources', () => {
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(true);
      service.initialize(mockGraphContainer, mockGraph as any);

      mockCollaborationService.collaborationState$.next({
        isPresenterModeActive: true,
      });

      expect(service.isTracking).toBe(true);

      service.ngOnDestroy();

      expect(service.isTracking).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('UiPresenterCursorService destroyed');
    });
  });
});
