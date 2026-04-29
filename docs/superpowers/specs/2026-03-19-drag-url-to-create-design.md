# Design: Drag URL to Create Document/Repository

**Issue:** #522 — feat: add drag-url-to-create feature for documents and repositories
**Date:** 2026-03-19
**Branch:** release/1.3.0

## Overview

Allow users to drag a URL from a browser (address bar, hyperlink, bookmark, or tab) onto the documents or repositories card on the tm-edit page. On drop, open the respective create dialog with the URI field pre-populated.

## Decisions

- **No auto-detection:** Whichever card the user drops onto determines the entity type. The URL pre-populates the `uri` field only.
- **No name extraction:** Only the URI field is pre-populated; name is left blank for the user to fill in.
- **Drop target:** The entire `mat-card` element (header + content), not just the content area.
- **Approach:** HTML5 Drag and Drop API via a reusable Angular directive, for reuse in #523.

## Components

### 1. UrlDropZoneDirective

**File:** `src/app/shared/directives/url-drop-zone.directive.ts`
**Selector:** `[appUrlDropZone]`

A standalone directive that handles HTML5 drag-and-drop events on its host element and emits dropped URLs.

**Output:** `urlDropped: EventEmitter<string>` — emits the extracted URL string on valid drop.

**Behavior:**

1. Listens to `dragenter`, `dragover`, `dragleave`, `drop` on the host element.
2. Only processes drag events containing URL-like data (checks `dataTransfer.types` for `text/uri-list` or `text/plain`).
3. On `dragenter`/`dragover`: calls `event.preventDefault()` to allow drop; adds CSS class `url-drop-active` to the host element.
4. Uses an enter/leave counter to handle nested element boundary crossings — only removes the class when counter reaches 0.
5. On `drop`: extracts URL from `event.dataTransfer` (tries `text/uri-list` first, falls back to `text/plain`; validates it looks like a URL), emits via `urlDropped`, removes the CSS class, resets counter.
6. On `dragleave` (counter === 0): removes the CSS class.

**Export:** Added to `src/app/shared/imports.ts` alongside `ScrollIndicatorDirective` and `TooltipAriaLabelDirective`.

### 2. Styling

Defined in `tm-edit.component.scss`, scoped to the documents and repository cards.

The `url-drop-active` class applied by the directive provides:

- **Dashed border:** 2px dashed using the app's accent color.
- **Background tint:** Subtle semi-transparent overlay of the accent color.
- **"Drop to create" hint:** Via a CSS `::after` pseudo-element positioned in the top-right area of the card. The translated text is passed via a `data-drop-hint` attribute on the card element.
- **Transition:** Smooth `border-color` and `background-color` transition (~150ms) for enter/exit.

The directive is styling-agnostic — it only toggles the `url-drop-active` class. Each consumer provides their own CSS. This keeps the directive reusable for #523 where the visual treatment will differ (form field vs card).

### 3. Integration with tm-edit

**Template changes:**

Add `appUrlDropZone` directive and `(urlDropped)` handler to both `mat-card` elements (documents-card and repository-card). Bind `[attr.data-drop-hint]` to a translated string for the pseudo-element hint text.

**TypeScript changes:**

- Modify `addDocument()` to accept an optional `uri?: string` parameter. When provided, pass it as a partial document: `{ mode: 'create', document: { uri } }`.
- Modify `addRepository()` to accept an optional `uri?: string` parameter. Same pattern: `{ mode: 'create', repository: { uri } }`.
- Add `onDocumentUrlDropped(url: string)` handler that checks `this.canEdit` and `this.dialog.openDialogs.length === 0` before calling `addDocument(url)`.
- Add `onRepositoryUrlDropped(url: string)` handler with the same guards before calling `addRepository(url)`.

**No dialog changes needed:** Both `DocumentEditorDialogComponent` and `RepositoryEditorDialogComponent` already use `data.document?.uri || ''` / `data.repository?.uri || ''` as form defaults, so passing a partial object with just `uri` works without modification.

**Guards:**

- `this.canEdit` — same as existing add buttons; read-only users cannot create via drag.
- `this.dialog.openDialogs.length === 0` — per issue requirements, only open the dialog if no other dialogs are currently open.

### 4. Localization

New i18n keys in the English locale file:

- `threatModels.tooltips.dropToCreateDocument` — "Drop to create"
- `threatModels.tooltips.dropToCreateRepository` — "Drop to create"

Bound to `data-drop-hint` attributes and displayed via CSS `::after` pseudo-element.

### 5. Testing

Unit tests in `src/app/shared/directives/url-drop-zone.directive.spec.ts`:

- URL extraction from `text/uri-list` and `text/plain` DataTransfer types.
- Non-URL text drops are ignored (plain text, file drops).
- CSS class `url-drop-active` toggling on dragenter/dragleave/drop.
- Nested element enter/leave counter correctness.
- `urlDropped` event emission with correct URL string.
- `dragover` calls `preventDefault()` to allow drop.

No changes to existing dialog tests — dialogs already handle pre-populated data via their data interfaces.
