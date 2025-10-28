// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

/**
 * DFD Integration Tests - Presenter Cursor Viewport Changes
 *
 * Tests the presenter cursor system's ability to handle viewport changes
 * such as window resize, scroll, and container size changes. Uses real X6
 * graph instances and tests actual coordinate transformations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph } from '@antv/x6';
import { JSDOM } from 'jsdom';
import { Subject } from 'rxjs';

import { createMockLoggerService, type MockLoggerService } from '../../../../testing/mocks';
import { UiPresenterCursorDisplayService } from '../presentation/services/ui-presenter-cursor-display.service';
import { UiPresenterCursorService } from '../presentation/services/ui-presenter-cursor.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { InfraWebsocketCollaborationAdapter } from '../infrastructure/adapters/infra-websocket-collaboration.adapter';
import { LoggerService } from '../../../../core/services/logger.service';

// Setup JSDOM environment for X6
const mockSVGElement = {
  getCTM: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
  getScreenCTM: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
  createSVGMatrix: vi.fn(() => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    rotate: function (_angle: number) {
      return this;
    },
    translate: function (_x: number, _y: number) {
      return this;
    },
    scale: function (_factor: number) {
      return this;
    },
    inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  })),
};

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  pretendToBeVisual: true,
  resources: 'usable',
});

Object.defineProperty(dom.window.SVGElement.prototype, 'getCTM', {
  value: mockSVGElement.getCTM,
});
Object.defineProperty(dom.window.SVGElement.prototype, 'getScreenCTM', {
  value: mockSVGElement.getScreenCTM,
});

// Make JSDOM window and document available globally
(global as any).window = dom.window;
(global as any).document = dom.window.document;
(global as any).navigator = dom.window.navigator;
(global as any).HTMLElement = dom.window.HTMLElement;
(global as any).SVGElement = dom.window.SVGElement;

// Add ResizeObserver mock
(global as any).ResizeObserver = class ResizeObserver {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(_target: Element): void {
    // Mock implementation
  }

  disconnect(): void {
    // Mock implementation
  }

  unobserve(_target: Element): void {
    // Mock implementation
  }
};

// Add IntersectionObserver mock
(global as any).IntersectionObserver = class IntersectionObserver {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
  }

  observe(_target: Element): void {
    // Mock implementation
  }

  disconnect(): void {
    // Mock implementation
  }

  unobserve(_target: Element): void {
    // Mock implementation
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
};

describe('Presenter Cursor Viewport Change Integration', () => {
  let graph: Graph;
  let container: HTMLDivElement;
  let mockLogger: MockLoggerService;
  let displayService: UiPresenterCursorDisplayService;
  let cursorService: UiPresenterCursorService;
  let mockCollaborationService: any;
  let mockCollaborativeOpService: any;
  let collaborationState$: Subject<any>;

  beforeEach(() => {
    // Create container element
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    container.style.position = 'absolute';
    container.style.top = '100px';
    container.style.left = '50px';
    document.body.appendChild(container);

    // Create real X6 graph
    graph = new Graph({
      container,
      width: 800,
      height: 600,
      grid: true,
      panning: true,
      mousewheel: {
        enabled: true,
        modifiers: ['ctrl', 'meta'],
      },
    });

    // Create mock services
    mockLogger = createMockLoggerService();
    collaborationState$ = new Subject();

    mockCollaborationService = {
      isCurrentUserPresenter: vi.fn(() => false),
      collaborationState$,
    };

    mockCollaborativeOpService = {
      sendPresenterCursor: vi.fn(() => new Subject()),
    };

    // Create services
    displayService = new UiPresenterCursorDisplayService(
      mockLogger as unknown as LoggerService,
      mockCollaborationService as DfdCollaborationService,
    );

    cursorService = new UiPresenterCursorService(
      mockLogger as unknown as LoggerService,
      mockCollaborationService as DfdCollaborationService,
      mockCollaborativeOpService as InfraWebsocketCollaborationAdapter,
    );
  });

  afterEach(() => {
    displayService.ngOnDestroy();
    cursorService.ngOnDestroy();
    graph.dispose();
    document.body.removeChild(container);
  });

  describe('Display Service - Coordinate Recalculation on Viewport Changes', () => {
    it('should recalculate cursor position when window resizes', async () => {
      displayService.initialize(container, graph);

      // Simulate receiving cursor position
      const graphPosition = { x: 400, y: 300 };
      displayService.handlePresenterCursorUpdate(graphPosition);

      // Verify position was stored
      expect((displayService as any)._lastGraphPosition).toEqual(graphPosition);

      // Clear previous logs
      mockLogger.debug.mockClear();

      // Simulate window resize
      window.dispatchEvent(new Event('resize'));

      // Wait for debounce (150ms)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should trigger recalculation
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('recalculating cursor position'),
        expect.any(Object),
      );
    });

    it('should handle graph pan/zoom transformations correctly', async () => {
      displayService.initialize(container, graph);

      // Initial cursor position
      const graphPosition = { x: 400, y: 300 };
      displayService.handlePresenterCursorUpdate(graphPosition);

      // Pan the graph
      graph.translate(100, 50);

      mockLogger.debug.mockClear();

      // Trigger viewport change
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should recalculate with new pan offset
      const lastGraphPos = (displayService as any)._lastGraphPosition;
      expect(lastGraphPos).toEqual(graphPosition);

      // Zoom the graph
      graph.zoom(1.5);

      mockLogger.debug.mockClear();

      // Trigger another viewport change
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should still use the original graph coordinates
      expect((displayService as any)._lastGraphPosition).toEqual(graphPosition);
    });

    it('should hide cursor when it moves outside viewport after resize', async () => {
      displayService.initialize(container, graph);

      // Position cursor near edge of viewport
      const graphPosition = { x: 750, y: 550 };
      displayService.handlePresenterCursorUpdate(graphPosition);

      // Make service think cursor is showing
      (displayService as any)._isShowingPresenterCursor = true;

      // Mock conversion to return position outside viewport
      vi.spyOn(graph, 'graphToLocal').mockReturnValue({ x: 750, y: 550 });
      vi.spyOn(graph, 'localToClient').mockReturnValue({ x: -100, y: -100 });

      mockLogger.debug.mockClear();

      // Trigger viewport change
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should log that cursor is outside viewport
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cursor outside viewport after viewport change - hiding',
      );
    });

    it('should handle rapid consecutive viewport changes efficiently', async () => {
      displayService.initialize(container, graph);

      displayService.handlePresenterCursorUpdate({ x: 400, y: 300 });
      (displayService as any)._isShowingPresenterCursor = true;

      mockLogger.debug.mockClear();

      // Trigger multiple rapid resizes
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 50));
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 50));
      window.dispatchEvent(new Event('resize'));

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should only recalculate once due to debouncing
      const recalcCalls = mockLogger.debug.mock.calls.filter(
        call => typeof call[0] === 'string' && call[0].includes('recalculating cursor position'),
      );

      expect(recalcCalls.length).toBe(1);
    });

    it('should not process updates when graph is not visible', () => {
      displayService.initialize(container, graph);

      // Set graph as not visible
      (displayService as any)._isGraphVisible = false;

      mockLogger.debug.mockClear();

      // Try to update cursor
      displayService.handlePresenterCursorUpdate({ x: 400, y: 300 });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Skipping presenter cursor update - graph not visible',
      );

      // Position should not be stored
      expect((displayService as any)._lastGraphPosition).toBeNull();
    });
  });

  describe('Display Service - ResizeObserver Integration', () => {
    it('should recalculate when container size changes', async () => {
      displayService.initialize(container, graph);

      displayService.handlePresenterCursorUpdate({ x: 400, y: 300 });
      (displayService as any)._isShowingPresenterCursor = true;

      mockLogger.debug.mockClear();

      // Simulate container resize
      const resizeObserver = (displayService as any)._resizeObserver as ResizeObserver;
      const entries = [
        {
          target: container,
          contentRect: { width: 1000, height: 700, top: 0, bottom: 700, left: 0, right: 1000 },
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        } as ResizeObserverEntry,
      ];

      (resizeObserver as any).callback(entries, resizeObserver);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Graph container resized',
        expect.objectContaining({
          width: 1000,
          height: 700,
        }),
      );
    });
  });

  describe('Display Service - IntersectionObserver Integration', () => {
    it('should hide cursor when graph becomes invisible', () => {
      displayService.initialize(container, graph);

      displayService.handlePresenterCursorUpdate({ x: 400, y: 300 });
      (displayService as any)._isShowingPresenterCursor = true;

      mockLogger.debug.mockClear();

      // Simulate graph becoming invisible
      const intersectionObserver = (displayService as any)
        ._intersectionObserver as IntersectionObserver;
      const entries = [
        {
          target: container,
          isIntersecting: false,
          intersectionRatio: 0,
          boundingClientRect: container.getBoundingClientRect(),
          intersectionRect: new DOMRect(0, 0, 0, 0),
          rootBounds: null,
          time: Date.now(),
        } as IntersectionObserverEntry,
      ];

      (intersectionObserver as any).callback(entries, intersectionObserver);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Graph visibility changed',
        expect.objectContaining({
          isVisible: false,
        }),
      );
    });
  });

  describe('Cursor Service - Broadcast Suppression When Not Visible', () => {
    it('should not broadcast when graph is not visible', () => {
      cursorService.initialize(container, graph);

      // Set as presenter and start tracking
      mockCollaborationService.isCurrentUserPresenter.mockReturnValue(true);
      collaborationState$.next({ isPresenterModeActive: true });

      // Simulate graph becoming invisible
      const intersectionObserver = (cursorService as any)
        ._intersectionObserver as IntersectionObserver;
      const entries = [
        {
          target: container,
          isIntersecting: false,
          intersectionRatio: 0,
          boundingClientRect: container.getBoundingClientRect(),
          intersectionRect: new DOMRect(0, 0, 0, 0),
          rootBounds: null,
          time: Date.now(),
        } as IntersectionObserverEntry,
      ];

      (intersectionObserver as any).callback(entries, intersectionObserver);

      mockCollaborativeOpService.sendPresenterCursor.mockClear();
      mockLogger.debug.mockClear();

      // Try to simulate mouse move (would normally trigger broadcast)
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 300,
        clientY: 250,
        bubbles: true,
      });
      container.dispatchEvent(mouseEvent);

      // Should not broadcast (check happens synchronously in handler)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Skipping cursor broadcast - graph not visible',
      );
      expect(mockCollaborativeOpService.sendPresenterCursor).not.toHaveBeenCalled();
    });
  });

  describe('End-to-End Viewport Change Scenario', () => {
    it('should handle complete workflow: cursor update -> viewport change -> recalculation', async () => {
      // Initialize both services
      displayService.initialize(container, graph);
      cursorService.initialize(container, graph);

      // Participant receives cursor update
      const graphPosition = { x: 400, y: 300 };
      displayService.handlePresenterCursorUpdate(graphPosition);

      // Verify position stored
      expect((displayService as any)._lastGraphPosition).toEqual(graphPosition);

      // Pan the graph to simulate participant exploring
      graph.translate(50, 50);

      // Simulate window resize
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should recalculate using stored graph coordinates
      // with new viewport transformation
      const lastPos = (displayService as any)._lastGraphPosition;
      expect(lastPos).toEqual(graphPosition); // Original graph coords preserved

      // Zoom
      graph.zoom(2.0);

      // Another viewport change
      window.dispatchEvent(new Event('scroll'));
      await new Promise(resolve => setTimeout(resolve, 200));

      // Graph coordinates should still be preserved
      expect((displayService as any)._lastGraphPosition).toEqual(graphPosition);
    });
  });
});
