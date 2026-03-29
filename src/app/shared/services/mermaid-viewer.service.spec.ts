// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { ElementRef } from '@angular/core';

// Mock createComponent from @angular/core before importing the service.
// The factory returns a vi.fn() placeholder; each test sets the mock return value
// in beforeEach so a fresh DOM element is used per test, preventing shared-element
// fragility across test runs.
vi.mock('@angular/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@angular/core')>();
  return {
    ...actual,
    createComponent: vi.fn(),
  };
});

import { createComponent } from '@angular/core';
import { MermaidViewerService } from './mermaid-viewer.service';

describe('MermaidViewerService', () => {
  let service: MermaidViewerService;
  let mockApplicationRef: {
    createComponent: ReturnType<typeof vi.fn>;
    injector: Record<string, unknown>;
    attachView: ReturnType<typeof vi.fn>;
    detachView: ReturnType<typeof vi.fn>;
  };
  let mockInjector: {
    get: ReturnType<typeof vi.fn>;
  };
  let previewElement: ElementRef<HTMLDivElement>;
  let previewDiv: HTMLDivElement;

  beforeEach(() => {
    mockApplicationRef = {
      createComponent: vi.fn(),
      injector: {},
      attachView: vi.fn(),
      detachView: vi.fn(),
    };
    mockInjector = { get: vi.fn() };

    // Reset createComponent mock with a fresh DOM element each test to avoid
    // shared-element fragility from module-level mock factory.
    vi.mocked(createComponent).mockReturnValue({
      instance: {
        mermaidElement: null,
        svgElement: null,
        setChangeDetectorRef: vi.fn(),
        onMouseEnter: vi.fn(),
        onMouseLeave: vi.fn(),
        onContextMenu: vi.fn(),
        onDoubleClick: vi.fn(),
      },
      hostView: { detectChanges: vi.fn() },
      changeDetectorRef: { detectChanges: vi.fn(), markForCheck: vi.fn() },
      location: { nativeElement: document.createElement('div') },
      destroy: vi.fn(),
    } as never);

    service = new MermaidViewerService(mockApplicationRef as never, mockInjector as never);

    previewDiv = document.createElement('div');
    document.body.appendChild(previewDiv);
    previewElement = new ElementRef(previewDiv);
  });

  afterEach(() => {
    document.body.removeChild(previewDiv);
  });

  it('should find and initialize mermaid elements', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mermaidDiv.appendChild(svg);
    previewDiv.appendChild(mermaidDiv);

    const cleanup = service.initialize(previewElement);

    // The standalone createComponent function from @angular/core is called
    expect(createComponent).toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');
  });

  it('should handle zero mermaid elements', () => {
    const cleanup = service.initialize(previewElement);
    expect(typeof cleanup).toBe('function');
  });

  it('should skip mermaid elements without SVG children', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    previewDiv.appendChild(mermaidDiv);

    const cleanup = service.initialize(previewElement);

    // createComponent should not be called for an element without SVG
    expect(createComponent).not.toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');
  });

  it('should clean up on cleanup call', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mermaidDiv.appendChild(svg);
    previewDiv.appendChild(mermaidDiv);

    const cleanup = service.initialize(previewElement);
    cleanup();

    // After cleanup, mermaid element styles should be reset
    expect(mermaidDiv.style.position).toBe('');
    expect(mermaidDiv.style.overflow).toBe('');
  });

  it('should detach and destroy component refs on cleanup', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mermaidDiv.appendChild(svg);
    previewDiv.appendChild(mermaidDiv);

    const cleanup = service.initialize(previewElement);

    // Get the mock component ref returned by createComponent
    const mockRef = vi.mocked(createComponent).mock.results[0].value;

    cleanup();

    expect(mockApplicationRef.detachView).toHaveBeenCalledWith(mockRef.hostView);
    expect(mockRef.destroy).toHaveBeenCalled();
  });

  it('should set position and overflow styles on mermaid elements with SVG', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mermaidDiv.appendChild(svg);
    previewDiv.appendChild(mermaidDiv);

    service.initialize(previewElement);

    expect(mermaidDiv.style.position).toBe('relative');
    expect(mermaidDiv.style.overflow).toBe('auto');
  });

  it('should attach view to appRef for each mermaid element with SVG', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mermaidDiv.appendChild(svg);
    previewDiv.appendChild(mermaidDiv);

    service.initialize(previewElement);

    const mockRef = vi.mocked(createComponent).mock.results[0].value;
    expect(mockApplicationRef.attachView).toHaveBeenCalledWith(mockRef.hostView);
  });
});
