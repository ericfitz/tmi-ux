# Mermaid Diagram Lightbox — Design Spec

**Issue:** [#535](https://github.com/ericfitz/tmi-ux/issues/535) — Add zoom and save capabilities to markdown editor mermaid diagram preview
**Date:** 2026-03-26

## Problem

Mermaid diagrams rendered in the markdown preview are often too small to read. The preview container has a fixed `max-height` with `overflow-y: auto`, so large diagrams get clipped. Users have no way to zoom in or save diagrams as images.

## Solution

A shared lightbox component that opens when a user clicks a rendered mermaid diagram. The lightbox fills the browser viewport, displays the SVG diagram with zoom/pan controls, and provides export to SVG and PNG.

## Architecture

### Component

`MermaidLightboxComponent` — a standalone component in `src/app/shared/components/mermaid-lightbox/`.

**Overlay mechanism:** Angular CDK `Overlay` with `GlobalPositionStrategy` (full viewport). CDK was chosen over MatDialog because the lightbox is a viewer, not a dialog — using CDK avoids fighting dialog chrome defaults (padding, border-radius, animation) while retaining the same accessibility primitives (focus trapping, keyboard handling).

**Static opener:** The component exposes a static `open(overlay: Overlay, injector: Injector, svgElement: SVGElement)` method that creates the overlay, attaches the component via `ComponentPortal`, and passes the SVG element as data. Consumers inject `Overlay` and `Injector` and call this directly — no separate service needed.

### New Files

```
src/app/shared/components/mermaid-lightbox/
  mermaid-lightbox.component.ts
  mermaid-lightbox.component.html
  mermaid-lightbox.component.scss
  mermaid-lightbox.component.spec.ts
```

### Modified Files

- `src/app/pages/tm/components/note-editor-dialog/note-editor-dialog.component.ts` — add mermaid click handlers
- `src/app/pages/tm/components/note-page/note-page.component.ts` — add mermaid click handlers
- `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.ts` — add mermaid click handlers
- `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.html` — add `mermaid` attribute to `<markdown>` tag
- `src/styles/_markdown-editor.scss` — add cursor/hover affordance to `.mermaid` elements
- `src/assets/i18n/en-US.json` — add 2 new i18n keys

## Lightbox Layout

### Toolbar (top bar)

Action buttons (all `mat-icon-button` with `matTooltip`):

| Button | Icon | Tooltip | Behavior |
|--------|------|---------|----------|
| Zoom In | `zoom_in` | `mermaidLightbox.zoomIn` | Scale +0.25 |
| Zoom Out | `zoom_out` | `mermaidLightbox.zoomOut` | Scale -0.25 |
| Zoom to Fit | `fit_screen` | `editor.toolbar.tooltips.zoomToFit` | Reset to fit-to-viewport |
| Export | `save_alt` | `editor.toolbar.tooltips.export` | Opens mat-menu with SVG/PNG |
| Close | `close` | `common.close` | Closes lightbox |

### Viewport (remaining space)

- The cloned SVG diagram, centered in the available area
- `transform: scale()` for zoom, `translate()` for pan
- `overflow: hidden` on the container
- Dark/themed background for clean canvas

## Zoom Behavior

- **Buttons:** Zoom in/out in ±0.25 increments, clamped to 0.25x–5x range
- **Scroll wheel:** Same increments, applied at cursor position
- **Reset (Zoom to Fit):** Fit diagram to viewport with padding
- **Initial state:** Fit-to-viewport so the diagram fills the available space on open

## Pan Behavior

- Mouse drag: `pointerdown` → `pointermove` → `pointerup` translates SVG position
- Cursor feedback: `cursor: grab` (idle), `cursor: grabbing` (dragging)

## Export

### SVG Export

1. Clone the mermaid-rendered SVG element
2. Remove Angular-specific attributes (`_ng*`, `ng-*`)
3. Serialize with `XMLSerializer`
4. Download as `mermaid-diagram.svg` via blob URL + anchor click

### PNG Export

1. Serialize SVG to data URI
2. Create `Image` element, load the data URI
3. Draw onto offscreen `<canvas>` at 2x resolution (retina quality)
4. `canvas.toBlob('image/png')` → download as `mermaid-diagram.png`

### Export Menu

Matches the DFD editor pattern: `save_alt` icon button → `mat-menu` with two items:

- Export as SVG (`editor.toolbar.exportMenu.exportAsSvg`)
- Export as PNG (`editor.toolbar.exportMenu.exportAsPng`)

No JPEG — mermaid diagrams are line art where JPEG compression artifacts would be visible.

## Consumer Integration

### Click-to-open wiring

Each markdown preview consumer adds click handlers on `.mermaid svg` elements in `AfterViewChecked`, alongside existing task-list checkbox and anchor link initialization:

1. Query `.mermaid svg` elements within `#markdownPreview`
2. Attach click handlers that call `MermaidLightboxComponent.open()`
3. Track initialization state to avoid duplicate handlers (same pattern as `taskListCheckboxesInitialized`)

### Visual affordance

In `_markdown-editor.scss`, add to the existing `.mermaid` rule:

- `cursor: pointer` — indicates clickability
- Subtle hover effect (e.g., slight border color change or elevation)

### Triage note editor fix

The triage-note-editor-dialog's `<markdown>` tag currently lacks the `mermaid` attribute. Add it: `<markdown [data]="markdownContent" mermaid>`.

## i18n

### Existing keys reused

- `common.close` → "Close"
- `editor.toolbar.exportMenu.exportAsSvg` → "Export as SVG"
- `editor.toolbar.exportMenu.exportAsPng` → "Export as PNG"
- `editor.toolbar.tooltips.export` → "Export..."
- `editor.toolbar.tooltips.zoomToFit` → "Zoom to Fit"

### New keys

- `mermaidLightbox.zoomIn` → "Zoom In"
- `mermaidLightbox.zoomOut` → "Zoom Out"

## Accessibility

- CDK `FocusTrap` wraps lightbox content
- ESC key closes the lightbox (via `overlayRef.keydownEvents()`)
- Backdrop click closes the lightbox
- All toolbar buttons have `matTooltip` and appropriate `aria-label`
- Focus returns to the triggering element on close

## Out of Scope

- Extracting shared markdown preview initialization logic (task-list checkboxes, anchor links, mermaid handlers) into a reusable mixin — the duplication is a pre-existing pattern
- Localization backfill for non-English locales (separate issue)
- Touch/pinch-zoom gestures for mobile
