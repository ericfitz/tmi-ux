// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';

import { MermaidOverlayViewerComponent } from './mermaid-overlay-viewer.component';

describe('MermaidOverlayViewerComponent', () => {
  let component: MermaidOverlayViewerComponent;
  let mockOverlayRef: {
    dispose: ReturnType<typeof vi.fn>;
    keydownEvents: ReturnType<typeof vi.fn>;
    backdropClick: ReturnType<typeof vi.fn>;
  };
  let mockTranslocoService: { translate: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockLoggerService: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockOverlayRef = {
      dispose: vi.fn(),
      keydownEvents: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
      backdropClick: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
    };
    mockTranslocoService = { translate: vi.fn((key: string) => key) };
    mockSnackBar = { open: vi.fn() };
    mockLoggerService = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      debugComponent: vi.fn(),
    };

    component = new MermaidOverlayViewerComponent(
      mockTranslocoService as never,
      mockSnackBar as never,
      mockLoggerService as never,
    );
    component.overlayRef = mockOverlayRef as never;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '200');
    svg.setAttribute('height', '100');
    svg.setAttribute('viewBox', '0 0 200 100');
    component.svgElement = svg;
  });

  describe('zoom', () => {
    it('should initialize at fit-to-viewport scale', () => {
      expect(component.currentZoom).toBe(1);
    });

    it('should zoom in by 0.25 increments', () => {
      component.zoomIn();
      expect(component.currentZoom).toBe(1.25);
    });

    it('should zoom out by 0.25 increments', () => {
      component.currentZoom = 1.5;
      component.zoomOut();
      expect(component.currentZoom).toBe(1.25);
    });

    it('should not zoom below 0.25', () => {
      component.currentZoom = 0.25;
      component.zoomOut();
      expect(component.currentZoom).toBe(0.25);
    });

    it('should not zoom above 4', () => {
      component.currentZoom = 4;
      component.zoomIn();
      expect(component.currentZoom).toBe(4);
    });

    it('should reset zoom to 1', () => {
      component.currentZoom = 2.5;
      component.resetZoom();
      expect(component.currentZoom).toBe(1);
    });
  });

  describe('pan', () => {
    it('should track pan offset during drag', () => {
      component.onPointerDown({
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        target: { setPointerCapture: vi.fn() },
      } as never);
      component.onPointerMove({ clientX: 150, clientY: 120 } as never);
      expect(component.panX).toBe(50);
      expect(component.panY).toBe(20);
    });

    it('should stop panning on pointer up', () => {
      component.onPointerDown({
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        target: { setPointerCapture: vi.fn() },
      } as never);
      component.onPointerUp({
        pointerId: 1,
        target: { releasePointerCapture: vi.fn() },
      } as never);
      component.onPointerMove({ clientX: 200, clientY: 200 } as never);
      expect(component.panX).toBe(0);
      expect(component.panY).toBe(0);
    });
  });

  describe('close', () => {
    it('should dispose overlay on close', () => {
      component.close();
      expect(mockOverlayRef.dispose).toHaveBeenCalled();
    });

    it('should invoke onClose callback before disposing', () => {
      const callOrder: string[] = [];
      component.onClose = () => callOrder.push('onClose');
      mockOverlayRef.dispose.mockImplementation(() => callOrder.push('dispose'));
      component.close();
      expect(callOrder).toEqual(['onClose', 'dispose']);
    });

    it('should still dispose overlay even when onClose throws', () => {
      component.onClose = () => {
        throw new Error('onClose failed');
      };
      expect(() => component.close()).toThrow('onClose failed');
      expect(mockOverlayRef.dispose).toHaveBeenCalled();
    });
  });

  describe('keyboard shortcuts', () => {
    it('should zoom in on + key', () => {
      component.handleKeydown({ key: '+', preventDefault: vi.fn() } as never);
      expect(component.currentZoom).toBe(1.25);
    });

    it('should zoom in on = key', () => {
      component.handleKeydown({ key: '=', preventDefault: vi.fn() } as never);
      expect(component.currentZoom).toBe(1.25);
    });

    it('should zoom out on - key', () => {
      component.currentZoom = 1.5;
      component.handleKeydown({ key: '-', preventDefault: vi.fn() } as never);
      expect(component.currentZoom).toBe(1.25);
    });

    it('should reset zoom on 0 key', () => {
      component.currentZoom = 2.5;
      component.handleKeydown({ key: '0', preventDefault: vi.fn() } as never);
      expect(component.currentZoom).toBe(1);
    });

    it('should close overlay on Escape key', () => {
      component.handleKeydown({ key: 'Escape', preventDefault: vi.fn() } as never);
      expect(mockOverlayRef.dispose).toHaveBeenCalled();
    });
  });
});
