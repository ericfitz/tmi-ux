# Mermaid Diagram Viewer — Design Spec

**Issue:** [#535](https://github.com/ericfitz/tmi-ux/issues/535) — Add zoom and save capabilities to markdown editor mermaid diagram preview
**Date:** 2026-03-29
**Supersedes:** `2026-03-26-mermaid-lightbox-design.md`

## Problem

Mermaid diagrams rendered in the markdown preview are often too small to read. The preview container has a fixed `max-height` with `overflow-y: auto`, so large diagrams get clipped. Users have no way to zoom in, save diagrams as images, or copy them to the clipboard.

## Solution

A two-tier viewer system for mermaid diagrams in the markdown preview:

1. **Inline hover toolbar** — appears over each diagram on hover with zoom, save, copy, and expand controls
2. **Overlay viewer** — full-viewport CDK Overlay with zoom+pan for detailed inspection

Both tiers provide save (SVG/PNG) and clipboard copy. A right-click context menu offers the same actions as an alternative discovery path.

## Architecture

### New Files

```
src/app/shared/components/mermaid-viewer/
  mermaid-viewer.component.ts       # Inline wrapper with hover toolbar + context menu
  mermaid-viewer.component.html
  mermaid-viewer.component.scss
  mermaid-viewer.component.spec.ts

src/app/shared/components/mermaid-overlay-viewer/
  mermaid-overlay-viewer.component.ts   # Full-viewport overlay with zoom+pan
  mermaid-overlay-viewer.component.html
  mermaid-overlay-viewer.component.scss
  mermaid-overlay-viewer.component.spec.ts

src/app/shared/services/
  mermaid-viewer.service.ts          # Shared initialization/cleanup logic
  mermaid-viewer.service.spec.ts
```

### Modified Files

- `src/app/pages/tm/components/note-editor-dialog/note-editor-dialog.component.ts` — add `initializeMermaidViewers()` call
- `src/app/pages/tm/components/note-page/note-page.component.ts` — add `initializeMermaidViewers()` call
- `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.ts` — add `initializeMermaidViewers()` call
- `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.html` — add `mermaid` attribute to `<markdown>` tag
- `src/styles/_markdown-editor.scss` — add cursor/hover affordance to `.mermaid` elements
- `src/assets/i18n/en-US.json` — add 5 new i18n keys

## MermaidViewerService

Shared service that handles initialization and cleanup for all 3 editor components. Injected via Angular DI.

### API

```typescript
initialize(previewElement: ElementRef<HTMLDivElement>): () => void
```

- Queries the preview element for all `.mermaid` elements
- For each diagram: wraps it with hover toolbar behavior, context menu listener, and click-to-expand handler
- Returns a cleanup function that removes all listeners and DOM modifications

### Integration Pattern

Each editor component calls the service in `ngAfterViewChecked`, alongside existing initializations:

```typescript
if (this.previewMode && !this.mermaidViewersInitialized) {
  this.mermaidCleanup = this.mermaidViewerService.initialize(this.markdownPreview);
  this.mermaidViewersInitialized = true;
} else if (!this.previewMode) {
  this.mermaidCleanup?.();
  this.mermaidViewersInitialized = false;
}
```

Cleanup is also called in `ngOnDestroy`.

## Inline Hover Toolbar

When the user hovers over a `.mermaid` diagram, a floating toolbar appears at the top-right corner of the diagram container.

### Controls

| Button | Icon | Tooltip Key | Action |
|--------|------|-------------|--------|
| Zoom In | `zoom_in` | `mermaidViewer.zoomIn` | Scale SVG +25% |
| Zoom Out | `zoom_out` | `mermaidViewer.zoomOut` | Scale SVG -25% |
| Reset | `fit_screen` | `mermaidViewer.resetZoom` | Reset to original size |
| Save | `save_alt` | `common.save` | Opens mat-menu: "Export as SVG" / "Export as PNG" |
| Copy | `content_copy` | `common.copyToClipboard` | Copy to clipboard (PNG+SVG) |
| Expand | `open_in_full` | `mermaidViewer.openInViewer` | Open overlay viewer |

### Behavior

- Toolbar uses `position: absolute` relative to the diagram's wrapper container
- Inline zoom applies CSS `transform: scale()` on the SVG
- Diagram container gets `overflow: auto` so user can scroll when zoomed beyond bounds
- Zoom range: 25% to 400%
- Toolbar and context menu remain available at all zoom levels

## Overlay Viewer

Opened via the "Expand" button or by double-clicking a diagram. Uses Angular CDK `Overlay` with `GlobalPositionStrategy`.

### Layout

- **Backdrop**: semi-transparent dark overlay, click-to-close
- **Viewer area**: near-full-viewport with padding, surface-colored background, diagram centered
- **Top toolbar**: zoom in/out, reset, fit-to-view, save (SVG/PNG menu), copy, close

### Zoom Behavior

- **Buttons**: ±25% increments, clamped to 25%–400%
- **Scroll wheel**: same increments, applied at cursor position
- **Fit-to-view**: fits diagram to viewport with padding
- **Initial state**: fit-to-viewport on open

### Pan Behavior

- `pointerdown` → `pointermove` → `pointerup` translates SVG position via CSS `transform: translate()`
- Cursor: `grab` (idle), `grabbing` (dragging)

### Keyboard Shortcuts

- `Escape` — close
- `+` / `=` — zoom in
- `-` — zoom out
- `0` — reset zoom

### Toolbar Controls

| Button | Icon | Tooltip Key | Action |
|--------|------|-------------|--------|
| Zoom In | `zoom_in` | `mermaidViewer.zoomIn` | Scale +25% |
| Zoom Out | `zoom_out` | `mermaidViewer.zoomOut` | Scale -25% |
| Reset Zoom | `fit_screen` | `mermaidViewer.resetZoom` | Reset to 100% |
| Fit to View | `zoom_out_map` | `dfd.toolbar.tooltips.zoomToFit` | Fit diagram to viewport |
| Save | `save_alt` | `common.save` | Opens mat-menu: SVG / PNG |
| Copy | `content_copy` | `common.copyToClipboard` | Copy to clipboard |
| Close | `close` | `common.close` | Close overlay |

## Context Menu

Right-clicking a `.mermaid` diagram suppresses the browser context menu and shows a `mat-menu` positioned at the pointer.

| Item | Icon | Key | Action |
|------|------|-----|--------|
| Export as SVG | `image` | `dfd.toolbar.exportMenu.exportAsSvg` | Download SVG |
| Export as PNG | `image` | `dfd.toolbar.exportMenu.exportAsPng` | Download PNG |
| Copy to Clipboard | `content_copy` | `common.copyToClipboard` | Copy PNG+SVG |
| Open in Viewer | `open_in_full` | `mermaidViewer.openInViewer` | Open overlay |

Positioned via a hidden `mat-menu` trigger element repositioned on right-click.

## Save & Export

### SVG Export

1. Clone the mermaid-rendered SVG element
2. Remove Angular-specific attributes (`_ng*`, `ng-*`)
3. Add XML declaration and namespace attributes
4. Serialize with `XMLSerializer`
5. Create `Blob` with MIME type `image/svg+xml`
6. Download as `mermaid-diagram-{timestamp}.svg` via blob URL + anchor click

### PNG Export

1. Serialize SVG to data URI
2. Create `Image` element, load the data URI
3. Draw onto offscreen `<canvas>` at `max(2, 2 * currentZoom)` resolution — ensures the export is at least as detailed as what the user was viewing, even for small diagrams
4. `canvas.toBlob('image/png')` → download as `mermaid-diagram-{timestamp}.png`
5. Always exports the full uncropped diagram regardless of zoom/pan state

### Clipboard Copy

1. Use `navigator.clipboard.write()` with a `ClipboardItem` containing both `image/svg+xml` and `image/png` representations
2. If the browser doesn't support `image/svg+xml` on the clipboard, fall back to PNG only
3. Show snackbar confirmation via `MatSnackBar` using `common.copiedToClipboard`

### Error Handling

If canvas rendering or clipboard write fails, catch the error, show a snackbar with `mermaidViewer.exportFailed`, and log via `LoggerService`.

## i18n

### Existing Keys Reused

| Key | Value | Used For |
|-----|-------|----------|
| `common.close` | "Close" | Overlay close button |
| `common.copy` | "Copy" | — |
| `common.copyToClipboard` | "Copy to Clipboard" | Copy button tooltip, context menu |
| `common.copiedToClipboard` | "Copied to clipboard" | Snackbar confirmation |
| `common.save` | "Save" | Save button tooltip |
| `dfd.toolbar.exportMenu.exportAsPng` | "Export as PNG" | Save menu, context menu |
| `dfd.toolbar.exportMenu.exportAsSvg` | "Export as SVG" | Save menu, context menu |
| `dfd.toolbar.tooltips.zoomToFit` | "Zoom to Fit" | Overlay fit button |

### New Keys

| Key | Value |
|-----|-------|
| `mermaidViewer.zoomIn` | "Zoom In" |
| `mermaidViewer.zoomOut` | "Zoom Out" |
| `mermaidViewer.resetZoom` | "Reset Zoom" |
| `mermaidViewer.openInViewer` | "Open in Viewer" |
| `mermaidViewer.exportFailed` | "Failed to export diagram" |

## Visual Affordance

In `_markdown-editor.scss`, add to the existing `.mermaid` rule:

- `cursor: pointer` — indicates clickability
- Subtle hover effect (border color change or slight elevation)

## Triage Note Editor Fix

The triage-note-editor-dialog's `<markdown>` tag currently lacks the `mermaid` attribute. Add it: `<markdown [data]="markdownContent" mermaid>`.

## Accessibility

- CDK `FocusTrap` wraps overlay content
- `Escape` key closes the overlay (via `overlayRef.keydownEvents()`)
- Backdrop click closes the overlay
- All toolbar buttons have `matTooltip` and appropriate `aria-label`
- Focus returns to the triggering element on close

## Testing (Vitest)

- **MermaidViewerService** — initialization finds `.mermaid` elements, cleanup removes listeners, handles zero diagrams
- **MermaidViewerComponent** — hover toolbar appears/disappears, zoom scale changes, context menu triggers
- **MermaidOverlayViewerComponent** — open/close, zoom/pan state, keyboard shortcuts (Escape, +/-, 0)
- **Save/export utilities** — SVG blob creation, PNG canvas rendering with correct scale factor (`max(2, 2 * currentZoom)`), filename generation
- **Clipboard** — `navigator.clipboard.write` called with correct MIME types, PNG fallback
- **Editor integration** — `initializeMermaidViewers()` called in `ngAfterViewChecked` when preview activates, cleanup on destroy/edit-mode-switch

No E2E tests — mermaid rendering + canvas export + clipboard interactions are unreliable in Playwright.

## Out of Scope

- Extracting shared markdown preview initialization logic into a reusable mixin (pre-existing pattern)
- Localization backfill for non-English locales (separate issue)
- Touch/pinch-zoom gestures for mobile
