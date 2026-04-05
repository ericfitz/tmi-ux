# Mermaid Diagram Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add zoom, save, copy, and fullscreen viewing capabilities to mermaid diagrams rendered in the markdown preview pane.

**Architecture:** A shared `MermaidViewerService` initializes viewer behavior on `.mermaid` elements in the preview pane. An inline `MermaidViewerComponent` provides a hover toolbar and context menu. A `MermaidOverlayViewerComponent` provides a full-viewport CDK Overlay with zoom+pan. Both tiers share export utilities for SVG/PNG download and clipboard copy.

**Tech Stack:** Angular 19, Angular CDK Overlay, Angular Material (mat-icon-button, mat-menu, MatSnackBar), CSS transforms for zoom/pan, Canvas API for PNG export, Clipboard API.

**Spec:** `docs/superpowers/specs/2026-03-29-mermaid-viewer-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/app/shared/components/mermaid-viewer/mermaid-viewer.component.ts` | Inline wrapper: hover toolbar, context menu, inline zoom |
| `src/app/shared/components/mermaid-viewer/mermaid-viewer.component.html` | Template for hover toolbar and context menu |
| `src/app/shared/components/mermaid-viewer/mermaid-viewer.component.scss` | Toolbar positioning, hover states, zoom container |
| `src/app/shared/components/mermaid-viewer/mermaid-viewer.component.spec.ts` | Unit tests |
| `src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.ts` | Full-viewport overlay: zoom+pan, keyboard shortcuts |
| `src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.html` | Overlay template with toolbar and viewport |
| `src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.scss` | Overlay layout, backdrop, pan cursor states |
| `src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.spec.ts` | Unit tests |
| `src/app/shared/services/mermaid-viewer.service.ts` | Initialization/cleanup logic for editor integration |
| `src/app/shared/services/mermaid-viewer.service.spec.ts` | Unit tests |
| `src/app/shared/utils/mermaid-export.utils.ts` | SVG/PNG export and clipboard copy utilities |
| `src/app/shared/utils/mermaid-export.utils.spec.ts` | Unit tests |

### Modified Files

| File | Change |
|------|--------|
| `src/assets/i18n/en-US.json` | Add `mermaidViewer` keys |
| `src/styles/_markdown-editor.scss` | Add `.mermaid` hover affordance |
| `src/app/pages/tm/components/note-page/note-page.component.ts` | Add `initializeMermaidViewers()` call |
| `src/app/pages/tm/components/note-editor-dialog/note-editor-dialog.component.ts` | Add `initializeMermaidViewers()` call |
| `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.ts` | Add `initializeMermaidViewers()` call |
| `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.html` | Add `mermaid` attribute to `<markdown>` tag |

---

## Task 1: Add i18n Keys and Mermaid Hover Affordance

**Files:**
- Modify: `src/assets/i18n/en-US.json`
- Modify: `src/styles/_markdown-editor.scss`

- [ ] **Step 1: Add `mermaidViewer` i18n keys to `en-US.json`**

Add the following block between the `login` and `navbar` top-level keys (alphabetical order). Find the closing `}` of the `login` block and add after it:

```json
  "mermaidViewer": {
    "exportFailed": "Failed to export diagram",
    "openInViewer": "Open in Viewer",
    "resetZoom": "Reset Zoom",
    "zoomIn": "Zoom In",
    "zoomOut": "Zoom Out"
  },
```

- [ ] **Step 2: Add hover affordance to `.mermaid` in `_markdown-editor.scss`**

In `src/styles/_markdown-editor.scss`, find the existing `.mermaid` rule block (inside `::ng-deep` inside the `@mixin preview-content` mixin, around line 257):

```scss
    // Mermaid diagrams
    .mermaid {
      text-align: center;
      margin: 16px 0;
      padding: 16px;
      background-color: var(--theme-surface);
      border-radius: 6px;
      border: 1px solid var(--theme-divider);
    }
```

Replace it with:

```scss
    // Mermaid diagrams
    .mermaid {
      text-align: center;
      margin: 16px 0;
      padding: 16px;
      background-color: var(--theme-surface);
      border-radius: 6px;
      border: 1px solid var(--theme-divider);
      cursor: pointer;
      transition: border-color 0.2s ease;

      &:hover {
        border-color: var(--theme-text-secondary);
      }
    }
```

- [ ] **Step 3: Run lint**

Run: `pnpm run lint:all`
Expected: PASS (no errors related to our changes)

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n/en-US.json src/styles/_markdown-editor.scss
git commit -m "feat: add mermaid viewer i18n keys and hover affordance"
```

---

## Task 2: Mermaid Export Utilities

**Files:**
- Create: `src/app/shared/utils/mermaid-export.utils.ts`
- Create: `src/app/shared/utils/mermaid-export.utils.spec.ts`

- [ ] **Step 1: Write the failing tests for SVG export**

Create `src/app/shared/utils/mermaid-export.utils.spec.ts`:

```typescript
// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import { vi, expect, beforeEach, describe, it } from 'vitest';

import {
  cloneSvgForExport,
  exportAsSvg,
  exportAsPng,
  copyDiagramToClipboard,
} from './mermaid-export.utils';

describe('mermaid-export.utils', () => {
  describe('cloneSvgForExport', () => {
    it('should clone an SVG element', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '100');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      svg.appendChild(rect);

      const clone = cloneSvgForExport(svg);

      expect(clone.tagName).toBe('svg');
      expect(clone.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
      expect(clone.querySelector('rect')).not.toBeNull();
    });

    it('should remove Angular-specific attributes', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('_ngcontent-abc', '');
      svg.setAttribute('ng-reflect-something', 'value');
      svg.setAttribute('width', '200');

      const clone = cloneSvgForExport(svg);

      expect(clone.getAttribute('_ngcontent-abc')).toBeNull();
      expect(clone.getAttribute('ng-reflect-something')).toBeNull();
      expect(clone.getAttribute('width')).toBe('200');
    });
  });

  describe('exportAsSvg', () => {
    it('should create and click a download link', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '100');

      const clickSpy = vi.fn();
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: clickSpy,
      } as unknown as HTMLAnchorElement);

      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');

      exportAsSvg(svg);

      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test');

      createElementSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('exportAsPng', () => {
    it('should use max(2, 2 * currentZoom) as the scale factor', async () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '100');
      svg.setAttribute('viewBox', '0 0 200 100');

      // Mock canvas and image
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
        }),
        toBlob: vi.fn((callback: (blob: Blob) => void) => {
          callback(new Blob([''], { type: 'image/png' }));
        }),
      };
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
      });
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      // With zoom 3.0, scale should be max(2, 2*3) = 6
      await exportAsPng(svg, 3.0);

      expect(mockCanvas.width).toBe(200 * 6);
      expect(mockCanvas.height).toBe(100 * 6);
    });
  });

  describe('copyDiagramToClipboard', () => {
    it('should write to clipboard with PNG blob', async () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '100');
      svg.setAttribute('viewBox', '0 0 200 100');

      const writeSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { write: writeSpy },
      });

      // Mock canvas for PNG generation
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
        toBlob: vi.fn((callback: (blob: Blob) => void) => {
          callback(new Blob([''], { type: 'image/png' }));
        }),
      };
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return document.createElement(tag);
      });

      await copyDiagramToClipboard(svg, 1.0);

      expect(writeSpy).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --run src/app/shared/utils/mermaid-export.utils.spec.ts`
Expected: FAIL — module `./mermaid-export.utils` not found

- [ ] **Step 3: Implement the export utilities**

Create `src/app/shared/utils/mermaid-export.utils.ts`:

```typescript
/**
 * Utilities for exporting mermaid diagram SVGs as SVG files, PNG files, or clipboard data.
 */

/**
 * Clone an SVG element for export, removing Angular-specific attributes.
 */
export function cloneSvgForExport(svgElement: SVGSVGElement): SVGSVGElement {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // Ensure xmlns is set
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Remove Angular-specific attributes from all elements
  const allElements = [clone, ...Array.from(clone.querySelectorAll('*'))];
  for (const el of allElements) {
    const attrsToRemove: string[] = [];
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('_ng') || attr.name.startsWith('ng-')) {
        attrsToRemove.push(attr.name);
      }
    }
    for (const name of attrsToRemove) {
      el.removeAttribute(name);
    }
  }

  return clone;
}

/**
 * Get the intrinsic dimensions of an SVG element.
 * Prefers viewBox, falls back to width/height attributes, then getBoundingClientRect.
 */
function getSvgDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  const w = parseFloat(svg.getAttribute('width') || '0');
  const h = parseFloat(svg.getAttribute('height') || '0');
  if (w > 0 && h > 0) {
    return { width: w, height: h };
  }

  const rect = svg.getBoundingClientRect();
  return { width: rect.width || 300, height: rect.height || 150 };
}

/**
 * Generate a timestamped filename.
 */
function generateFilename(extension: string): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `mermaid-diagram-${timestamp}.${extension}`;
}

/**
 * Serialize an SVG element to a Blob.
 */
function svgToBlob(svg: SVGSVGElement): Blob {
  const serializer = new XMLSerializer();
  const svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(svg);
  return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
}

/**
 * Trigger a file download from a Blob.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export an SVG element as an SVG file download.
 */
export function exportAsSvg(svgElement: SVGSVGElement): void {
  const clone = cloneSvgForExport(svgElement);
  const blob = svgToBlob(clone);
  downloadBlob(blob, generateFilename('svg'));
}

/**
 * Render an SVG to a canvas and return the canvas.
 * Scale factor: max(2, 2 * currentZoom) for retina quality.
 */
function renderSvgToCanvas(
  svgElement: SVGSVGElement,
  currentZoom: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const clone = cloneSvgForExport(svgElement);
    const { width, height } = getSvgDimensions(clone);
    const scale = Math.max(2, 2 * currentZoom);

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas 2d context'));
      return;
    }

    const blob = svgToBlob(clone);
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = (): void => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    img.onerror = (): void => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG as image'));
    };

    img.src = url;
  });
}

/**
 * Convert a canvas to a PNG Blob.
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create PNG blob from canvas'));
      }
    }, 'image/png');
  });
}

/**
 * Export an SVG element as a PNG file download.
 * @param currentZoom Current zoom level (1.0 = 100%). PNG scale = max(2, 2 * currentZoom).
 */
export async function exportAsPng(svgElement: SVGSVGElement, currentZoom: number): Promise<void> {
  const canvas = await renderSvgToCanvas(svgElement, currentZoom);
  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, generateFilename('png'));
}

/**
 * Copy a diagram to the clipboard as both PNG and SVG (if supported), or PNG only.
 * @param currentZoom Current zoom level for PNG resolution.
 */
export async function copyDiagramToClipboard(
  svgElement: SVGSVGElement,
  currentZoom: number,
): Promise<void> {
  const canvas = await renderSvgToCanvas(svgElement, currentZoom);
  const pngBlob = await canvasToBlob(canvas);

  // Try to write both SVG and PNG; fall back to PNG only
  try {
    const clone = cloneSvgForExport(svgElement);
    const svgBlob = svgToBlob(clone);
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/svg+xml': svgBlob,
        'image/png': pngBlob,
      }),
    ]);
  } catch {
    // SVG clipboard not supported in this browser; fall back to PNG only
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': pngBlob,
      }),
    ]);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run src/app/shared/utils/mermaid-export.utils.spec.ts`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm run lint:all`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/utils/mermaid-export.utils.ts src/app/shared/utils/mermaid-export.utils.spec.ts
git commit -m "feat: add mermaid diagram SVG/PNG export and clipboard utilities"
```

---

## Task 3: Mermaid Overlay Viewer Component

**Files:**
- Create: `src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.ts`
- Create: `src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.html`
- Create: `src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.scss`
- Create: `src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.spec.ts`:

```typescript
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
  let mockTranslocoService: {
    translate: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };
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
    mockTranslocoService = {
      translate: vi.fn((key: string) => key),
    };
    mockSnackBar = {
      open: vi.fn(),
    };
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

    // Create a test SVG
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
      component.onPointerDown({ clientX: 100, clientY: 100, pointerId: 1, target: { setPointerCapture: vi.fn() } } as never);
      component.onPointerMove({ clientX: 150, clientY: 120 } as never);

      expect(component.panX).toBe(50);
      expect(component.panY).toBe(20);
    });

    it('should stop panning on pointer up', () => {
      component.onPointerDown({ clientX: 100, clientY: 100, pointerId: 1, target: { setPointerCapture: vi.fn() } } as never);
      component.onPointerUp({ pointerId: 1, target: { releasePointerCapture: vi.fn() } } as never);
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
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --run src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the overlay component template**

Create `src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.html`:

```html
<div class="overlay-container" cdkTrapFocus (wheel)="onWheel($event)">
  <!-- Toolbar -->
  <div class="overlay-toolbar">
    <button
      mat-icon-button
      (click)="zoomIn()"
      [matTooltip]="'mermaidViewer.zoomIn' | transloco"
    >
      <mat-icon>zoom_in</mat-icon>
    </button>
    <button
      mat-icon-button
      (click)="zoomOut()"
      [matTooltip]="'mermaidViewer.zoomOut' | transloco"
    >
      <mat-icon>zoom_out</mat-icon>
    </button>
    <button
      mat-icon-button
      (click)="resetZoom()"
      [matTooltip]="'mermaidViewer.resetZoom' | transloco"
    >
      <mat-icon>fit_screen</mat-icon>
    </button>
    <button
      mat-icon-button
      (click)="fitToView()"
      [matTooltip]="'dfd.toolbar.tooltips.zoomToFit' | transloco"
    >
      <mat-icon>zoom_out_map</mat-icon>
    </button>
    <span class="toolbar-spacer"></span>
    <button
      mat-icon-button
      [matMenuTriggerFor]="exportMenu"
      [matTooltip]="'common.save' | transloco"
    >
      <mat-icon>save_alt</mat-icon>
    </button>
    <button
      mat-icon-button
      (click)="copyToClipboard()"
      [matTooltip]="'common.copyToClipboard' | transloco"
    >
      <mat-icon>content_copy</mat-icon>
    </button>
    <button
      mat-icon-button
      (click)="close()"
      [matTooltip]="'common.close' | transloco"
    >
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <!-- Export Menu -->
  <mat-menu #exportMenu="matMenu">
    <button mat-menu-item (click)="onExportSvg()">
      <mat-icon>image</mat-icon>
      <span>{{ 'dfd.toolbar.exportMenu.exportAsSvg' | transloco }}</span>
    </button>
    <button mat-menu-item (click)="onExportPng()">
      <mat-icon>image</mat-icon>
      <span>{{ 'dfd.toolbar.exportMenu.exportAsPng' | transloco }}</span>
    </button>
  </mat-menu>

  <!-- Viewport -->
  <div
    class="overlay-viewport"
    [class.panning]="isPanning"
    (pointerdown)="onPointerDown($event)"
    (pointermove)="onPointerMove($event)"
    (pointerup)="onPointerUp($event)"
    (pointercancel)="onPointerUp($event)"
  >
    <div
      class="svg-container"
      [style.transform]="'translate(' + panX + 'px, ' + panY + 'px) scale(' + currentZoom + ')'"
    >
      <div #svgHost class="svg-host"></div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Create the overlay component styles**

Create `src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.scss`:

```scss
:host {
  display: block;
  width: 100vw;
  height: 100vh;
}

.overlay-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: var(--theme-surface, #fff);
}

.overlay-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  gap: 4px;
  background-color: var(--theme-surface, #fff);
  border-bottom: 1px solid var(--theme-divider, #e0e0e0);
  z-index: 1;
}

.toolbar-spacer {
  flex: 1;
}

.overlay-viewport {
  flex: 1;
  overflow: hidden;
  cursor: grab;
  position: relative;

  &.panning {
    cursor: grabbing;
  }
}

.svg-container {
  transform-origin: center center;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.svg-host {
  display: flex;
  align-items: center;
  justify-content: center;

  ::ng-deep svg {
    max-width: none;
    max-height: none;
  }
}
```

- [ ] **Step 5: Create the overlay component TypeScript**

Create `src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.ts`:

```typescript
import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OverlayRef } from '@angular/cdk/overlay';

import { A11yModule } from '@angular/cdk/a11y';

import {
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '../../../core/services/logger.service';
import {
  exportAsSvg,
  exportAsPng,
  copyDiagramToClipboard,
} from '../../utils/mermaid-export.utils';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

/**
 * Full-viewport overlay for viewing a mermaid diagram with zoom and pan controls.
 * Opened programmatically via CDK Overlay.
 */
@Component({
  selector: 'app-mermaid-overlay-viewer',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoModule,
    A11yModule,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
  ],
  templateUrl: './mermaid-overlay-viewer.component.html',
  styleUrls: ['./mermaid-overlay-viewer.component.scss'],
})
export class MermaidOverlayViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgHost') svgHost?: ElementRef<HTMLDivElement>;

  /** The SVG element to display. Set by the opener before view init. */
  svgElement!: SVGSVGElement;

  /** The CDK OverlayRef. Set by the opener for close/dispose. */
  overlayRef!: OverlayRef;

  /** Optional callback invoked when the overlay closes, for focus restoration. */
  onClose?: () => void;

  currentZoom = 1;
  panX = 0;
  panY = 0;
  isPanning = false;

  private dragStartX = 0;
  private dragStartY = 0;
  private panStartX = 0;
  private panStartY = 0;

  constructor(
    private translocoService: TranslocoService,
    private snackBar: MatSnackBar,
    private logger: LoggerService,
  ) {}

  ngAfterViewInit(): void {
    if (this.svgHost && this.svgElement) {
      const clone = this.svgElement.cloneNode(true) as SVGSVGElement;
      this.svgHost.nativeElement.appendChild(clone);
    }
  }

  ngOnDestroy(): void {
    this.overlayRef?.dispose();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case '+':
      case '=':
        event.preventDefault();
        this.zoomIn();
        break;
      case '-':
        event.preventDefault();
        this.zoomOut();
        break;
      case '0':
        event.preventDefault();
        this.resetZoom();
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
  }

  zoomIn(): void {
    this.currentZoom = Math.min(MAX_ZOOM, this.currentZoom + ZOOM_STEP);
  }

  zoomOut(): void {
    this.currentZoom = Math.max(MIN_ZOOM, this.currentZoom - ZOOM_STEP);
  }

  resetZoom(): void {
    this.currentZoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  fitToView(): void {
    this.currentZoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  onPointerDown(event: PointerEvent): void {
    this.isPanning = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.panStartX = this.panX;
    this.panStartY = this.panY;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isPanning) return;
    this.panX = this.panStartX + (event.clientX - this.dragStartX);
    this.panY = this.panStartY + (event.clientY - this.dragStartY);
  }

  onPointerUp(event: PointerEvent): void {
    this.isPanning = false;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
  }

  close(): void {
    this.onClose?.();
    this.overlayRef?.dispose();
  }

  onExportSvg(): void {
    try {
      exportAsSvg(this.svgElement);
    } catch (err) {
      this.logger.error('Failed to export SVG', err);
      this.showError();
    }
  }

  async onExportPng(): Promise<void> {
    try {
      await exportAsPng(this.svgElement, this.currentZoom);
    } catch (err) {
      this.logger.error('Failed to export PNG', err);
      this.showError();
    }
  }

  async copyToClipboard(): Promise<void> {
    try {
      await copyDiagramToClipboard(this.svgElement, this.currentZoom);
      this.snackBar.open(
        this.translocoService.translate('common.copiedToClipboard'),
        '',
        { duration: 2000 },
      );
    } catch (err) {
      this.logger.error('Failed to copy diagram to clipboard', err);
      this.showError();
    }
  }

  private showError(): void {
    this.snackBar.open(
      this.translocoService.translate('mermaidViewer.exportFailed'),
      '',
      { duration: 4000, panelClass: ['error-snackbar'] },
    );
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test -- --run src/app/shared/components/mermaid-overlay-viewer/mermaid-overlay-viewer.component.spec.ts`
Expected: PASS

- [ ] **Step 7: Run lint**

Run: `pnpm run lint:all`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/shared/components/mermaid-overlay-viewer/
git commit -m "feat: add mermaid overlay viewer component with zoom and pan"
```

---

## Task 4: Mermaid Viewer Component (Inline Toolbar + Context Menu)

**Files:**
- Create: `src/app/shared/components/mermaid-viewer/mermaid-viewer.component.ts`
- Create: `src/app/shared/components/mermaid-viewer/mermaid-viewer.component.html`
- Create: `src/app/shared/components/mermaid-viewer/mermaid-viewer.component.scss`
- Create: `src/app/shared/components/mermaid-viewer/mermaid-viewer.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/shared/components/mermaid-viewer/mermaid-viewer.component.spec.ts`:

```typescript
// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';

import { MermaidViewerComponent } from './mermaid-viewer.component';

describe('MermaidViewerComponent', () => {
  let component: MermaidViewerComponent;
  let mockOverlay: {
    create: ReturnType<typeof vi.fn>;
  };
  let mockInjector: Record<string, unknown>;
  let mockTranslocoService: {
    translate: ReturnType<typeof vi.fn>;
  };
  let mockSnackBar: {
    open: ReturnType<typeof vi.fn>;
  };
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
    mockTranslocoService = {
      translate: vi.fn((key: string) => key),
    };
    mockSnackBar = {
      open: vi.fn(),
    };
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

    // Create a test SVG inside a mermaid container
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --run src/app/shared/components/mermaid-viewer/mermaid-viewer.component.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the viewer component template**

Create `src/app/shared/components/mermaid-viewer/mermaid-viewer.component.html`:

```html
<!-- Hover Toolbar -->
@if (showToolbar) {
  <div class="mermaid-toolbar" (click)="$event.stopPropagation()">
    <button
      mat-icon-button
      (click)="zoomIn()"
      [matTooltip]="'mermaidViewer.zoomIn' | transloco"
    >
      <mat-icon>zoom_in</mat-icon>
    </button>
    <button
      mat-icon-button
      (click)="zoomOut()"
      [matTooltip]="'mermaidViewer.zoomOut' | transloco"
    >
      <mat-icon>zoom_out</mat-icon>
    </button>
    <button
      mat-icon-button
      (click)="resetZoom()"
      [matTooltip]="'mermaidViewer.resetZoom' | transloco"
    >
      <mat-icon>fit_screen</mat-icon>
    </button>
    <button
      mat-icon-button
      [matMenuTriggerFor]="saveMenu"
      [matTooltip]="'common.save' | transloco"
    >
      <mat-icon>save_alt</mat-icon>
    </button>
    <button
      mat-icon-button
      (click)="copyToClipboard()"
      [matTooltip]="'common.copyToClipboard' | transloco"
    >
      <mat-icon>content_copy</mat-icon>
    </button>
    <button
      mat-icon-button
      (click)="openOverlay()"
      [matTooltip]="'mermaidViewer.openInViewer' | transloco"
    >
      <mat-icon>open_in_full</mat-icon>
    </button>
  </div>
}

<!-- Save Menu (hover toolbar) -->
<mat-menu #saveMenu="matMenu">
  <button mat-menu-item (click)="onExportSvg()">
    <mat-icon>image</mat-icon>
    <span>{{ 'dfd.toolbar.exportMenu.exportAsSvg' | transloco }}</span>
  </button>
  <button mat-menu-item (click)="onExportPng()">
    <mat-icon>image</mat-icon>
    <span>{{ 'dfd.toolbar.exportMenu.exportAsPng' | transloco }}</span>
  </button>
</mat-menu>

<!-- Context Menu (hidden trigger) -->
<div
  style="visibility: hidden; position: fixed"
  [style.left]="contextMenuPosition.x"
  [style.top]="contextMenuPosition.y"
>
  <button
    mat-icon-button
    [matMenuTriggerFor]="contextMenu"
    #contextMenuTrigger="matMenuTrigger"
  ></button>
</div>
<mat-menu #contextMenu="matMenu">
  <button mat-menu-item (click)="onExportSvg()">
    <mat-icon>image</mat-icon>
    <span>{{ 'dfd.toolbar.exportMenu.exportAsSvg' | transloco }}</span>
  </button>
  <button mat-menu-item (click)="onExportPng()">
    <mat-icon>image</mat-icon>
    <span>{{ 'dfd.toolbar.exportMenu.exportAsPng' | transloco }}</span>
  </button>
  <button mat-menu-item (click)="copyToClipboard()">
    <mat-icon>content_copy</mat-icon>
    <span>{{ 'common.copyToClipboard' | transloco }}</span>
  </button>
  <button mat-menu-item (click)="openOverlay()">
    <mat-icon>open_in_full</mat-icon>
    <span>{{ 'mermaidViewer.openInViewer' | transloco }}</span>
  </button>
</mat-menu>
```

- [ ] **Step 4: Create the viewer component styles**

Create `src/app/shared/components/mermaid-viewer/mermaid-viewer.component.scss`:

```scss
:host {
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.mermaid-toolbar {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 2px;
  padding: 4px;
  background-color: var(--theme-surface, #fff);
  border-radius: 4px;
  border: 1px solid var(--theme-divider, #e0e0e0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  pointer-events: auto;
  z-index: 10;

  .mat-mdc-icon-button {
    --mdc-icon-button-state-layer-size: 32px;
    --mdc-icon-button-icon-size: 18px;
    padding: 0;
  }
}
```

- [ ] **Step 5: Create the viewer component TypeScript**

Create `src/app/shared/components/mermaid-viewer/mermaid-viewer.component.ts`:

```typescript
import {
  Component,
  Injector,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  Overlay,
  OverlayConfig,
  GlobalPositionStrategy,
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

import {
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '../../../core/services/logger.service';
import {
  exportAsSvg,
  exportAsPng,
  copyDiagramToClipboard,
} from '../../utils/mermaid-export.utils';
import { MermaidOverlayViewerComponent } from '../mermaid-overlay-viewer/mermaid-overlay-viewer.component';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

/**
 * Inline mermaid diagram viewer with hover toolbar and context menu.
 * Attached to each .mermaid element by MermaidViewerService.
 */
@Component({
  selector: 'app-mermaid-viewer',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoModule,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
  ],
  templateUrl: './mermaid-viewer.component.html',
  styleUrls: ['./mermaid-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MermaidViewerComponent {
  @ViewChild('contextMenuTrigger') contextMenuTrigger?: MatMenuTrigger;

  /** The .mermaid container element. Set by MermaidViewerService. */
  mermaidElement!: HTMLElement;

  /** The SVG element inside .mermaid. Set by MermaidViewerService. */
  svgElement!: SVGSVGElement;

  showToolbar = false;
  currentZoom = 1;
  contextMenuPosition = { x: '0px', y: '0px' };

  private cdr?: ChangeDetectorRef;

  constructor(
    private overlay: Overlay,
    private injector: Injector,
    private translocoService: TranslocoService,
    private snackBar: MatSnackBar,
    private logger: LoggerService,
  ) {}

  /** Inject ChangeDetectorRef after creation (set by service). */
  setChangeDetectorRef(cdr: ChangeDetectorRef): void {
    this.cdr = cdr;
  }

  onMouseEnter(): void {
    this.showToolbar = true;
    this.cdr?.markForCheck();
  }

  onMouseLeave(): void {
    this.showToolbar = false;
    this.cdr?.markForCheck();
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    this.contextMenuPosition = { x: `${event.clientX}px`, y: `${event.clientY}px` };
    this.cdr?.detectChanges();
    this.contextMenuTrigger?.openMenu();
  }

  onDoubleClick(): void {
    this.openOverlay();
  }

  zoomIn(): void {
    this.currentZoom = Math.min(MAX_ZOOM, this.currentZoom + ZOOM_STEP);
    this.applyInlineZoom();
  }

  zoomOut(): void {
    this.currentZoom = Math.max(MIN_ZOOM, this.currentZoom - ZOOM_STEP);
    this.applyInlineZoom();
  }

  resetZoom(): void {
    this.currentZoom = 1;
    this.applyInlineZoom();
  }

  openOverlay(): void {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const config = new OverlayConfig({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: new GlobalPositionStrategy().top('0').left('0'),
      width: '100vw',
      height: '100vh',
    });

    const overlayRef = this.overlay.create(config);
    const portal = new ComponentPortal(MermaidOverlayViewerComponent, null, this.injector);
    const componentRef = overlayRef.attach(portal);

    componentRef.instance.svgElement = this.svgElement;
    componentRef.instance.overlayRef = overlayRef;
    componentRef.instance.onClose = (): void => previouslyFocused?.focus();

    const restoreFocus = (): void => {
      previouslyFocused?.focus();
    };

    overlayRef.backdropClick().subscribe(() => {
      overlayRef.dispose();
      restoreFocus();
    });
    overlayRef.keydownEvents().subscribe(event => {
      if (event.key === 'Escape') {
        overlayRef.dispose();
        restoreFocus();
      }
    });
  }

  onExportSvg(): void {
    try {
      exportAsSvg(this.svgElement);
    } catch (err) {
      this.logger.error('Failed to export SVG', err);
      this.showExportError();
    }
  }

  async onExportPng(): Promise<void> {
    try {
      await exportAsPng(this.svgElement, this.currentZoom);
    } catch (err) {
      this.logger.error('Failed to export PNG', err);
      this.showExportError();
    }
  }

  async copyToClipboard(): Promise<void> {
    try {
      await copyDiagramToClipboard(this.svgElement, this.currentZoom);
      this.snackBar.open(
        this.translocoService.translate('common.copiedToClipboard'),
        '',
        { duration: 2000 },
      );
    } catch (err) {
      this.logger.error('Failed to copy diagram to clipboard', err);
      this.showExportError();
    }
  }

  private applyInlineZoom(): void {
    if (this.svgElement) {
      this.svgElement.style.transform = `scale(${this.currentZoom})`;
      this.svgElement.style.transformOrigin = 'center center';
    }
    this.cdr?.markForCheck();
  }

  private showExportError(): void {
    this.snackBar.open(
      this.translocoService.translate('mermaidViewer.exportFailed'),
      '',
      { duration: 4000, panelClass: ['error-snackbar'] },
    );
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test -- --run src/app/shared/components/mermaid-viewer/mermaid-viewer.component.spec.ts`
Expected: PASS

- [ ] **Step 7: Run lint**

Run: `pnpm run lint:all`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/shared/components/mermaid-viewer/
git commit -m "feat: add inline mermaid viewer with hover toolbar and context menu"
```

---

## Task 5: Mermaid Viewer Service

**Files:**
- Create: `src/app/shared/services/mermaid-viewer.service.ts`
- Create: `src/app/shared/services/mermaid-viewer.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/shared/services/mermaid-viewer.service.spec.ts`:

```typescript
// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { ElementRef } from '@angular/core';

import { MermaidViewerService } from './mermaid-viewer.service';

describe('MermaidViewerService', () => {
  let service: MermaidViewerService;
  let mockApplicationRef: {
    createComponent: ReturnType<typeof vi.fn>;
  };
  let mockInjector: {
    get: ReturnType<typeof vi.fn>;
  };
  let previewElement: ElementRef<HTMLDivElement>;
  let previewDiv: HTMLDivElement;

  beforeEach(() => {
    mockApplicationRef = {
      createComponent: vi.fn().mockReturnValue({
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
      }),
    };
    mockInjector = {
      get: vi.fn(),
    };

    service = new MermaidViewerService(
      mockApplicationRef as never,
      mockInjector as never,
    );

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

    expect(mockApplicationRef.createComponent).toHaveBeenCalledTimes(1);
    expect(typeof cleanup).toBe('function');
  });

  it('should handle zero mermaid elements', () => {
    const cleanup = service.initialize(previewElement);

    expect(mockApplicationRef.createComponent).not.toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');
  });

  it('should skip mermaid elements without SVG children', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    previewDiv.appendChild(mermaidDiv);

    const cleanup = service.initialize(previewElement);

    expect(mockApplicationRef.createComponent).not.toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');
  });

  it('should destroy components on cleanup', () => {
    const mermaidDiv = document.createElement('div');
    mermaidDiv.classList.add('mermaid');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    mermaidDiv.appendChild(svg);
    previewDiv.appendChild(mermaidDiv);

    const cleanup = service.initialize(previewElement);
    cleanup();

    expect(mockApplicationRef.createComponent.mock.results[0].value.destroy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --run src/app/shared/services/mermaid-viewer.service.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the service**

Create `src/app/shared/services/mermaid-viewer.service.ts`:

```typescript
import {
  Injectable,
  ApplicationRef,
  ComponentRef,
  ElementRef,
  Injector,
  createComponent,
} from '@angular/core';

import { MermaidViewerComponent } from '../components/mermaid-viewer/mermaid-viewer.component';

/**
 * Service that initializes MermaidViewerComponent instances on .mermaid elements
 * within a markdown preview container. Returns a cleanup function to destroy them.
 */
@Injectable({ providedIn: 'root' })
export class MermaidViewerService {
  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
  ) {}

  /**
   * Find all .mermaid elements in the preview and attach viewer components.
   * @returns Cleanup function that destroys all created components and removes listeners.
   */
  initialize(previewElement: ElementRef<HTMLDivElement>): () => void {
    const mermaidElements = previewElement.nativeElement.querySelectorAll('.mermaid');
    const componentRefs: ComponentRef<MermaidViewerComponent>[] = [];
    const cleanupHandlers: (() => void)[] = [];

    mermaidElements.forEach(mermaidEl => {
      const svg = mermaidEl.querySelector('svg') as SVGSVGElement | null;
      if (!svg) return;

      const htmlEl = mermaidEl as HTMLElement;

      // Make the mermaid container a positioning context
      htmlEl.style.position = 'relative';
      htmlEl.style.overflow = 'auto';

      // Create the viewer component dynamically
      const componentRef = createComponent(MermaidViewerComponent, {
        environmentInjector: this.appRef.injector,
        elementInjector: this.injector,
      });

      componentRef.instance.mermaidElement = htmlEl;
      componentRef.instance.svgElement = svg;
      componentRef.instance.setChangeDetectorRef(componentRef.changeDetectorRef);

      // Append the component's host element to the mermaid container
      htmlEl.appendChild(componentRef.location.nativeElement);
      this.appRef.attachView(componentRef.hostView);
      componentRef.changeDetectorRef.detectChanges();

      // Attach event listeners on the mermaid container
      const onMouseEnter = (): void => componentRef.instance.onMouseEnter();
      const onMouseLeave = (): void => componentRef.instance.onMouseLeave();
      const onContextMenu = (e: Event): void =>
        componentRef.instance.onContextMenu(e as MouseEvent);
      const onDblClick = (): void => componentRef.instance.onDoubleClick();

      htmlEl.addEventListener('mouseenter', onMouseEnter);
      htmlEl.addEventListener('mouseleave', onMouseLeave);
      htmlEl.addEventListener('contextmenu', onContextMenu);
      htmlEl.addEventListener('dblclick', onDblClick);

      componentRefs.push(componentRef);
      cleanupHandlers.push(() => {
        htmlEl.removeEventListener('mouseenter', onMouseEnter);
        htmlEl.removeEventListener('mouseleave', onMouseLeave);
        htmlEl.removeEventListener('contextmenu', onContextMenu);
        htmlEl.removeEventListener('dblclick', onDblClick);
        // Reset inline zoom
        svg.style.transform = '';
        svg.style.transformOrigin = '';
        htmlEl.style.position = '';
        htmlEl.style.overflow = '';
      });
    });

    return (): void => {
      for (const handler of cleanupHandlers) {
        handler();
      }
      for (const ref of componentRefs) {
        this.appRef.detachView(ref.hostView);
        ref.destroy();
      }
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --run src/app/shared/services/mermaid-viewer.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm run lint:all`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/services/mermaid-viewer.service.ts src/app/shared/services/mermaid-viewer.service.spec.ts
git commit -m "feat: add MermaidViewerService for initializing diagram viewers"
```

---

## Task 6: Integrate into Editor Components

**Files:**
- Modify: `src/app/pages/tm/components/note-page/note-page.component.ts`
- Modify: `src/app/pages/tm/components/note-editor-dialog/note-editor-dialog.component.ts`
- Modify: `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.ts`
- Modify: `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.html`

- [ ] **Step 1: Integrate into `note-page.component.ts`**

Add the import near the other service imports (around line 30):

```typescript
import { MermaidViewerService } from '../../../../shared/services/mermaid-viewer.service';
```

Add a private field after the existing `anchorClickHandler` field:

```typescript
  private mermaidViewersInitialized = false;
  private mermaidCleanup?: () => void;
```

Add `MermaidViewerService` to the constructor parameters. The constructor currently takes these positional parameters (check the actual constructor signature). Add `private mermaidViewerService: MermaidViewerService` as the last parameter.

In `ngAfterViewChecked()`, add mermaid initialization after the existing task list and anchor link initialization block. The current code (lines 263-272) is:

```typescript
  ngAfterViewChecked(): void {
    // Initialize task list checkboxes and anchor links after markdown is rendered
    if (this.previewMode && !this.taskListCheckboxesInitialized) {
      this.initializeTaskListCheckboxes();
      this.initializeAnchorLinks();
      this.taskListCheckboxesInitialized = true;
    } else if (!this.previewMode) {
      this.taskListCheckboxesInitialized = false;
    }
  }
```

Replace with:

```typescript
  ngAfterViewChecked(): void {
    // Initialize task list checkboxes and anchor links after markdown is rendered
    if (this.previewMode && !this.taskListCheckboxesInitialized) {
      this.initializeTaskListCheckboxes();
      this.initializeAnchorLinks();
      this.taskListCheckboxesInitialized = true;
    } else if (!this.previewMode) {
      this.taskListCheckboxesInitialized = false;
    }

    // Initialize mermaid diagram viewers
    if (this.previewMode && !this.mermaidViewersInitialized && this.markdownPreview) {
      this.mermaidCleanup = this.mermaidViewerService.initialize(this.markdownPreview);
      this.mermaidViewersInitialized = true;
    } else if (!this.previewMode && this.mermaidViewersInitialized) {
      this.mermaidCleanup?.();
      this.mermaidViewersInitialized = false;
    }
  }
```

In `ngOnDestroy()`, add mermaid cleanup. The current code (lines 274-283) is:

```typescript
  ngOnDestroy(): void {
    // Remove anchor click handler if present
    if (this.anchorClickHandler && this.markdownPreview) {
      this.markdownPreview.nativeElement.removeEventListener(
        'click',
        this.anchorClickHandler,
        true,
      );
    }
  }
```

Replace with:

```typescript
  ngOnDestroy(): void {
    // Remove anchor click handler if present
    if (this.anchorClickHandler && this.markdownPreview) {
      this.markdownPreview.nativeElement.removeEventListener(
        'click',
        this.anchorClickHandler,
        true,
      );
    }
    // Clean up mermaid viewers
    this.mermaidCleanup?.();
  }
```

- [ ] **Step 2: Integrate into `note-editor-dialog.component.ts`**

Add the import:

```typescript
import { MermaidViewerService } from '../../../../shared/services/mermaid-viewer.service';
```

Add private fields:

```typescript
  private mermaidViewersInitialized = false;
  private mermaidCleanup?: () => void;
```

Add `private mermaidViewerService: MermaidViewerService` to the constructor.

Update `ngAfterViewChecked()` — the current code (lines 140-148) is:

```typescript
  ngAfterViewChecked(): void {
    // Initialize task list checkboxes and anchor links after markdown is rendered
    if (this.previewMode && !this.taskListCheckboxesInitialized) {
      this.initializeTaskListCheckboxes();
      this.initializeAnchorLinks();
      this.taskListCheckboxesInitialized = true;
    } else if (!this.previewMode) {
      this.taskListCheckboxesInitialized = false;
    }
  }
```

Replace with:

```typescript
  ngAfterViewChecked(): void {
    // Initialize task list checkboxes and anchor links after markdown is rendered
    if (this.previewMode && !this.taskListCheckboxesInitialized) {
      this.initializeTaskListCheckboxes();
      this.initializeAnchorLinks();
      this.taskListCheckboxesInitialized = true;
    } else if (!this.previewMode) {
      this.taskListCheckboxesInitialized = false;
    }

    // Initialize mermaid diagram viewers
    if (this.previewMode && !this.mermaidViewersInitialized && this.markdownPreview) {
      this.mermaidCleanup = this.mermaidViewerService.initialize(this.markdownPreview);
      this.mermaidViewersInitialized = true;
    } else if (!this.previewMode && this.mermaidViewersInitialized) {
      this.mermaidCleanup?.();
      this.mermaidViewersInitialized = false;
    }
  }
```

This dialog component doesn't currently implement `OnDestroy`. The dialog lifecycle is short enough that the `ngAfterViewChecked` cleanup on edit-mode-switch handles it, but for safety add `OnDestroy`:

Add `OnDestroy` to the `implements` clause and add:

```typescript
  ngOnDestroy(): void {
    this.mermaidCleanup?.();
  }
```

- [ ] **Step 3: Integrate into `triage-note-editor-dialog.component.ts`**

Add the import:

```typescript
import { MermaidViewerService } from '../../../../shared/services/mermaid-viewer.service';
```

Add private fields:

```typescript
  private mermaidViewersInitialized = false;
  private mermaidCleanup?: () => void;
```

Add `private mermaidViewerService: MermaidViewerService` to the constructor.

Find the `ngAfterViewChecked()` method and add the same mermaid initialization block after the existing task list block (same pattern as the other two components above).

- [ ] **Step 4: Fix triage template — add `mermaid` attribute**

In `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.html`, line 130:

Change:
```html
          <markdown [data]="markdownContent"></markdown>
```

To:
```html
          <markdown [data]="markdownContent" mermaid></markdown>
```

- [ ] **Step 5: Run all tests**

Run: `pnpm test -- --run`
Expected: PASS (all existing tests should still pass)

- [ ] **Step 6: Run lint and build**

Run: `pnpm run lint:all && pnpm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/tm/components/note-page/note-page.component.ts \
  src/app/pages/tm/components/note-editor-dialog/note-editor-dialog.component.ts \
  src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.ts \
  src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.html
git commit -m "feat: integrate mermaid viewer into all 3 markdown editor components"
```

---

## Task 7: Final Build, Test, and Lint

- [ ] **Step 1: Run full test suite**

Run: `pnpm test -- --run`
Expected: PASS

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `pnpm run lint:all`
Expected: PASS

- [ ] **Step 4: Verify all new files are tracked**

Run: `git status`
Expected: Clean working tree (all changes committed)
