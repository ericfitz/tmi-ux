// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { ElementRef } from '@angular/core';

// Mock createComponent from @angular/core before importing the service.
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
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
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
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

    vi.mocked(createComponent).mockReturnValue({
      instance: {
        mermaidElement: null,

        onMouseEnter: vi.fn(),
        onMouseLeave: vi.fn(),
        onContextMenu: vi.fn(),
        onDoubleClick: vi.fn(),
      },
      hostView: {},
      location: { nativeElement: document.createElement('div') },
      destroy: vi.fn(),
    } as never);

    service = new MermaidViewerService(
      mockApplicationRef as never,
      mockInjector as never,
      mockLogger as never,
    );

    previewDiv = document.createElement('div');
    document.body.appendChild(previewDiv);
    previewElement = new ElementRef(previewDiv);
  });

  afterEach(() => {
    document.body.removeChild(previewDiv);
  });

  it('should return null when no mermaid elements found', () => {
    const cleanup = service.initialize(previewElement);
    expect(cleanup).toBeNull();
  });

  it('should wrap .mermaid element and attach viewer component', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    previewDiv.appendChild(mermaidDiv);

    service.initialize(previewElement);

    // .mermaid should now be wrapped
    const wrapper = mermaidDiv.parentElement;
    expect(wrapper).not.toBe(previewDiv);
    expect(wrapper?.className).toBe('mermaid-viewer-wrapper');
    expect(wrapper?.style.position).toBe('relative');
    expect(wrapper?.parentElement).toBe(previewDiv);

    // Component should be created and attached
    expect(createComponent).toHaveBeenCalled();
    expect(mockApplicationRef.attachView).toHaveBeenCalled();
  });

  it('should survive mermaid innerHTML replacement', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mermaidDiv.appendChild(svg);
    previewDiv.appendChild(mermaidDiv);

    service.initialize(previewElement);

    const wrapper = mermaidDiv.parentElement!;
    const viewerHostEl = vi.mocked(createComponent).mock.results[0].value.location.nativeElement;

    // Verify viewer is in the wrapper
    expect(wrapper.contains(viewerHostEl)).toBe(true);

    // Simulate mermaid.run() replacing innerHTML
    mermaidDiv.innerHTML = '<svg id="new-svg"></svg>';

    // Viewer should still be in the wrapper (sibling, not child)
    expect(wrapper.contains(viewerHostEl)).toBe(true);
    expect(wrapper.children.length).toBe(2); // .mermaid + viewer
  });

  it('should unwrap .mermaid and remove wrapper on cleanup', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    previewDiv.appendChild(mermaidDiv);

    const cleanup = service.initialize(previewElement);
    cleanup!();

    // .mermaid should be back in previewDiv, wrapper removed
    expect(mermaidDiv.parentElement).toBe(previewDiv);
    expect(previewDiv.querySelector('.mermaid-viewer-wrapper')).toBeNull();
  });

  it('should detach and destroy component refs on cleanup', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    previewDiv.appendChild(mermaidDiv);

    const cleanup = service.initialize(previewElement);
    const mockRef = vi.mocked(createComponent).mock.results[0].value;

    cleanup!();

    expect(mockApplicationRef.detachView).toHaveBeenCalledWith(mockRef.hostView);
    expect(mockRef.destroy).toHaveBeenCalled();
  });

  it('should attach view to appRef for each mermaid element', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    previewDiv.appendChild(mermaidDiv);

    service.initialize(previewElement);

    const mockRef = vi.mocked(createComponent).mock.results[0].value;
    expect(mockApplicationRef.attachView).toHaveBeenCalledWith(mockRef.hostView);
  });

  it('should handle multiple .mermaid elements', () => {
    const mermaid1 = document.createElement('div');
    mermaid1.classList.add('mermaid');
    const mermaid2 = document.createElement('div');
    mermaid2.classList.add('mermaid');
    previewDiv.appendChild(mermaid1);
    previewDiv.appendChild(mermaid2);

    service.initialize(previewElement);

    expect(createComponent).toHaveBeenCalledTimes(2);
    expect(previewDiv.querySelectorAll('.mermaid-viewer-wrapper').length).toBe(2);
  });
});
