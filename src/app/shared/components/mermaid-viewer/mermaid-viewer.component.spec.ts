// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';

import { MermaidViewerComponent } from './mermaid-viewer.component';

describe('MermaidViewerComponent', () => {
  let component: MermaidViewerComponent;
  let mockOverlay: { create: ReturnType<typeof vi.fn> };
  let mockInjector: Record<string, unknown>;
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
    mockOverlay = {
      create: vi.fn().mockReturnValue({
        attach: vi.fn().mockReturnValue({ instance: {} }),
        dispose: vi.fn(),
        keydownEvents: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
        backdropClick: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
      }),
    };
    mockInjector = {};
    mockTranslocoService = { translate: vi.fn((key: string) => key) };
    mockSnackBar = { open: vi.fn() };
    mockLoggerService = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      debugComponent: vi.fn(),
    };

    component = new MermaidViewerComponent(
      mockOverlay as never,
      mockInjector as never,
      mockTranslocoService as never,
      mockSnackBar as never,
      mockLoggerService as never,
    );

    const container = document.createElement('div');
    container.classList.add('mermaid');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '200');
    svg.setAttribute('height', '100');
    svg.setAttribute('viewBox', '0 0 200 100');
    container.appendChild(svg);
    document.body.appendChild(container);

    component.mermaidElement = container;
    component.svgElement = svg;
  });

  describe('inline zoom', () => {
    it('should start at zoom 1', () => {
      expect(component.currentZoom).toBe(1);
    });

    it('should zoom in by 0.25', () => {
      component.zoomIn();
      expect(component.currentZoom).toBe(1.25);
    });

    it('should zoom out by 0.25', () => {
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
      component.currentZoom = 3;
      component.resetZoom();
      expect(component.currentZoom).toBe(1);
    });
  });

  describe('toolbar visibility', () => {
    it('should show toolbar on mouse enter', () => {
      component.onMouseEnter();
      expect(component.showToolbar).toBe(true);
    });

    it('should hide toolbar on mouse leave', () => {
      component.onMouseEnter();
      component.onMouseLeave();
      expect(component.showToolbar).toBe(false);
    });
  });

  describe('overlay', () => {
    it('should create overlay on expand', () => {
      component.openOverlay();
      expect(mockOverlay.create).toHaveBeenCalled();
    });
  });
});
