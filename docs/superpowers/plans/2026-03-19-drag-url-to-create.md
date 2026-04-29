# Drag URL to Create Document/Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to drag URLs from a browser onto the documents or repositories card on the tm-edit page to open the create dialog with the URI pre-populated.

**Architecture:** A reusable standalone Angular directive (`UrlDropZoneDirective`) handles HTML5 drag-and-drop events, toggles a CSS class for visual feedback, and emits dropped URLs. The tm-edit component applies this directive to both cards and wires the output to the existing `addDocument()`/`addRepository()` methods with a new optional URI parameter.

**Tech Stack:** Angular 21, HTML5 Drag and Drop API, Vitest, Transloco i18n

**Spec:** `docs/superpowers/specs/2026-03-19-drag-url-to-create-design.md`
**Issue:** #522

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/app/shared/directives/url-drop-zone.directive.ts` | Reusable directive: drag event handling, CSS class toggle, URL extraction and emission |
| Create | `src/app/shared/directives/url-drop-zone.directive.spec.ts` | Unit tests for the directive |
| Modify | `src/app/shared/imports.ts` | Export the new directive |
| Modify | `src/app/pages/tm/tm-edit.component.html` | Add directive + event binding to documents-card and repository-card |
| Modify | `src/app/pages/tm/tm-edit.component.ts` | Add drop handlers, modify `addDocument()`/`addRepository()` to accept optional URI |
| Modify | `src/app/pages/tm/tm-edit.component.scss` | Add `url-drop-active` styles for card drop feedback |
| Modify | `src/assets/i18n/en-US.json` | Add `dropToCreateDocument` and `dropToCreateRepository` tooltip keys |

---

### Task 1: Create UrlDropZoneDirective with Tests

**Files:**
- Create: `src/app/shared/directives/url-drop-zone.directive.ts`
- Create: `src/app/shared/directives/url-drop-zone.directive.spec.ts`

- [ ] **Step 1: Write the directive test file**

```typescript
// src/app/shared/directives/url-drop-zone.directive.spec.ts
import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UrlDropZoneDirective } from './url-drop-zone.directive';
import type { ElementRef, Renderer2 } from '@angular/core';

function createDragEvent(type: string, data?: Record<string, string>): DragEvent {
  const dataTransfer: Partial<DataTransfer> = {
    types: Object.keys(data || {}),
    getData: vi.fn((format: string) => data?.[format] || ''),
  };
  const event = new Event(type, { bubbles: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
  Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });
  return event;
}

describe('UrlDropZoneDirective', () => {
  let directive: UrlDropZoneDirective;
  let mockElement: HTMLElement;
  let mockRenderer: { addClass: ReturnType<typeof vi.fn>; removeClass: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockElement = document.createElement('div');
    mockRenderer = {
      addClass: vi.fn(),
      removeClass: vi.fn(),
    };
    directive = new UrlDropZoneDirective(
      { nativeElement: mockElement } as ElementRef<HTMLElement>,
      mockRenderer as unknown as Renderer2,
    );
  });

  it('should create', () => {
    expect(directive).toBeTruthy();
  });

  describe('dragover', () => {
    it('should call preventDefault to allow drop', () => {
      const event = createDragEvent('dragover', { 'text/uri-list': 'https://example.com' });
      directive.onDragOver(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should not preventDefault for non-URL drags', () => {
      const event = createDragEvent('dragover', { 'Files': '' });
      directive.onDragOver(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('dragenter', () => {
    it('should add url-drop-active class on dragenter with URL data', () => {
      const event = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(event);
      expect(mockRenderer.addClass).toHaveBeenCalledWith(mockElement, 'url-drop-active');
    });

    it('should not add class for non-URL drags', () => {
      const event = createDragEvent('dragenter', { 'Files': '' });
      directive.onDragEnter(event);
      expect(mockRenderer.addClass).not.toHaveBeenCalled();
    });
  });

  describe('dragleave', () => {
    it('should remove class when counter reaches 0', () => {
      const enterEvent = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent);

      const leaveEvent = createDragEvent('dragleave', { 'text/uri-list': 'https://example.com' });
      directive.onDragLeave(leaveEvent);
      expect(mockRenderer.removeClass).toHaveBeenCalledWith(mockElement, 'url-drop-active');
    });

    it('should not remove class when nested elements cause enter/leave', () => {
      const enterEvent1 = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent1);

      const enterEvent2 = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent2);

      const leaveEvent = createDragEvent('dragleave', { 'text/uri-list': 'https://example.com' });
      directive.onDragLeave(leaveEvent);
      expect(mockRenderer.removeClass).not.toHaveBeenCalled();
    });
  });

  describe('drop', () => {
    it('should emit URL from text/uri-list', () => {
      const emitSpy = vi.spyOn(directive.urlDropped, 'emit');
      const event = createDragEvent('drop', { 'text/uri-list': 'https://example.com' });
      directive.onDrop(event);
      expect(emitSpy).toHaveBeenCalledWith('https://example.com');
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should fall back to text/plain when text/uri-list is empty', () => {
      const emitSpy = vi.spyOn(directive.urlDropped, 'emit');
      const event = createDragEvent('drop', {
        'text/plain': 'https://example.com/page',
      });
      directive.onDrop(event);
      expect(emitSpy).toHaveBeenCalledWith('https://example.com/page');
    });

    it('should not emit for non-URL plain text', () => {
      const emitSpy = vi.spyOn(directive.urlDropped, 'emit');
      const event = createDragEvent('drop', { 'text/plain': 'just some text' });
      directive.onDrop(event);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should remove url-drop-active class on drop', () => {
      const enterEvent = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent);

      const dropEvent = createDragEvent('drop', { 'text/uri-list': 'https://example.com' });
      directive.onDrop(dropEvent);
      expect(mockRenderer.removeClass).toHaveBeenCalledWith(mockElement, 'url-drop-active');
    });

    it('should reset enter counter on drop', () => {
      const enterEvent1 = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent1);
      const enterEvent2 = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent2);

      const dropEvent = createDragEvent('drop', { 'text/uri-list': 'https://example.com' });
      directive.onDrop(dropEvent);

      // After drop + reset, a new dragenter/dragleave cycle should work cleanly
      const enterEvent3 = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent3);
      const leaveEvent = createDragEvent('dragleave', { 'text/uri-list': 'https://example.com' });
      directive.onDragLeave(leaveEvent);
      // removeClass called twice: once for drop, once for this dragleave
      expect(mockRenderer.removeClass).toHaveBeenCalledTimes(2);
    });

    it('should take the first URL from text/uri-list with multiple lines', () => {
      const emitSpy = vi.spyOn(directive.urlDropped, 'emit');
      const event = createDragEvent('drop', {
        'text/uri-list': 'https://first.com\nhttps://second.com',
      });
      directive.onDrop(event);
      expect(emitSpy).toHaveBeenCalledWith('https://first.com');
    });

    it('should skip comment lines in text/uri-list', () => {
      const emitSpy = vi.spyOn(directive.urlDropped, 'emit');
      const event = createDragEvent('drop', {
        'text/uri-list': '# comment\nhttps://actual.com',
      });
      directive.onDrop(event);
      expect(emitSpy).toHaveBeenCalledWith('https://actual.com');
    });
  });
});
```

- [ ] **Step 2: Write the directive implementation**

```typescript
// src/app/shared/directives/url-drop-zone.directive.ts
import { Directive, ElementRef, EventEmitter, HostListener, Output, Renderer2 } from '@angular/core';

const DROP_ACTIVE_CLASS = 'url-drop-active';
const URL_PATTERN = /^https?:\/\//i;

@Directive({
  selector: '[appUrlDropZone]',
  standalone: true,
})
export class UrlDropZoneDirective {
  @Output() urlDropped = new EventEmitter<string>();

  private _enterCounter = 0;

  constructor(
    private _elementRef: ElementRef<HTMLElement>,
    private _renderer: Renderer2,
  ) {}

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    if (this._hasUrlData(event)) {
      event.preventDefault();
    }
  }

  @HostListener('dragenter', ['$event'])
  onDragEnter(event: DragEvent): void {
    if (!this._hasUrlData(event)) return;
    this._enterCounter++;
    if (this._enterCounter === 1) {
      this._renderer.addClass(this._elementRef.nativeElement, DROP_ACTIVE_CLASS);
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    if (!this._hasUrlData(event)) return;
    this._enterCounter--;
    if (this._enterCounter === 0) {
      this._renderer.removeClass(this._elementRef.nativeElement, DROP_ACTIVE_CLASS);
    }
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this._enterCounter = 0;
    this._renderer.removeClass(this._elementRef.nativeElement, DROP_ACTIVE_CLASS);

    const url = this._extractUrl(event);
    if (url) {
      this.urlDropped.emit(url);
    }
  }

  private _hasUrlData(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return types.includes('text/uri-list') || types.includes('text/plain');
  }

  private _extractUrl(event: DragEvent): string | null {
    const dt = event.dataTransfer;
    if (!dt) return null;

    // Try text/uri-list first (RFC 2483 format: one URL per line, # = comment)
    const uriList = dt.getData('text/uri-list');
    if (uriList) {
      const firstUrl = uriList
        .split('\n')
        .map(line => line.trim())
        .find(line => line && !line.startsWith('#'));
      if (firstUrl && URL_PATTERN.test(firstUrl)) return firstUrl;
    }

    // Fall back to text/plain
    const plain = dt.getData('text/plain')?.trim();
    if (plain && URL_PATTERN.test(plain)) return plain;

    return null;
  }
}
```

- [ ] **Step 3: Run the directive tests**

Run: `pnpm vitest run src/app/shared/directives/url-drop-zone.directive.spec.ts`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/directives/url-drop-zone.directive.ts src/app/shared/directives/url-drop-zone.directive.spec.ts
git commit -m "feat: add UrlDropZoneDirective for drag-and-drop URL handling"
```

---

### Task 2: Export Directive from Shared Imports

**Files:**
- Modify: `src/app/shared/imports.ts:50-54`

- [ ] **Step 1: Add the import and export**

At line 51, add the import:
```typescript
import { UrlDropZoneDirective } from './directives/url-drop-zone.directive';
```

At line 54, update the export to include it:
```typescript
export { ScrollIndicatorDirective, TooltipAriaLabelDirective, UrlDropZoneDirective };
```

- [ ] **Step 2: Run build to verify**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/shared/imports.ts
git commit -m "chore: export UrlDropZoneDirective from shared imports"
```

---

### Task 3: Add Localization Keys

**Files:**
- Modify: `src/assets/i18n/en-US.json:1618`

- [ ] **Step 1: Add the new tooltip keys**

In the `threatModels.tooltips` object (after the `threatsCardTitle` key at line 1618), add:

```json
"dropToCreateDocument": "Drop to create",
"dropToCreateRepository": "Drop to create"
```

Ensure proper comma placement — add a comma after the existing `threatsCardTitle` value on line 1618 before the new keys.

- [ ] **Step 2: Run build to verify JSON is valid**

Run: `pnpm run build`
Expected: Build succeeds (Transloco will pick up the new keys).

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "feat: add i18n keys for drag-to-create tooltip hints"
```

---

### Task 4: Add Drop Zone Styles to tm-edit

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.scss:183-192`

- [ ] **Step 1: Add the url-drop-active styles**

After the existing card width rules (line 192), add:

```scss
// Drag-and-drop URL drop zone feedback
.documents-card,
.repository-card {
  transition:
    border-color 150ms ease,
    background-color 150ms ease;

  &.url-drop-active {
    border: 2px dashed var(--mat-sys-primary);
    background-color: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);

    &::after {
      content: attr(data-drop-hint);
      position: absolute;
      top: 12px;
      right: 16px;
      font-size: 12px;
      color: var(--mat-sys-primary);
      font-weight: 500;
      pointer-events: none;
    }
  }
}
```

Note: `mat-card` already has `position: relative` from Material, so the `::after` positioning works.

- [ ] **Step 2: Run build to verify**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.scss
git commit -m "style: add drag-and-drop visual feedback styles for document/repository cards"
```

---

### Task 5: Integrate Directive into tm-edit Component

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.ts:37-43,1410-1423,1580-1594`
- Modify: `src/app/pages/tm/tm-edit.component.html:674,867`

- [ ] **Step 1: Import the directive in the component TypeScript**

In `tm-edit.component.ts`, add `UrlDropZoneDirective` to the import from `@app/shared/imports` at line 38:

```typescript
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
  UrlDropZoneDirective,
} from '@app/shared/imports';
```

Then add `UrlDropZoneDirective` to the component's `imports` array in the `@Component` decorator. Find the `imports:` array and add it alongside the other imports.

- [ ] **Step 2: Modify addDocument() to accept optional URI**

In `tm-edit.component.ts`, change the `addDocument()` method signature (line 1410) from:

```typescript
addDocument(): void {
```

to:

```typescript
addDocument(uri?: string): void {
```

And update the `dialogData` construction (lines 1415-1418) to include the partial document when a URI is provided:

```typescript
const dialogData: DocumentEditorDialogData = {
  mode: 'create',
  isReadOnly: !this.canEdit,
  ...(uri ? { document: { uri } as Document } : {}),
};
```

- [ ] **Step 3: Modify addRepository() to accept optional URI**

Same pattern. Change signature (line 1580) from:

```typescript
addRepository(): void {
```

to:

```typescript
addRepository(uri?: string): void {
```

Update dialogData (lines 1586-1589):

```typescript
const dialogData: RepositoryEditorDialogData = {
  mode: 'create',
  isReadOnly: !this.canEdit,
  ...(uri ? { repository: { uri } as Repository } : {}),
};
```

- [ ] **Step 4: Add drop handler methods**

Add these two methods to `tm-edit.component.ts`, near `addDocument()` and `addRepository()`:

```typescript
/**
 * Handles a URL dropped onto the documents card.
 * Opens the create document dialog with the URI pre-populated.
 */
onDocumentUrlDropped(url: string): void {
  if (!this.canEdit || this.dialog.openDialogs.length > 0) return;
  this.addDocument(url);
}

/**
 * Handles a URL dropped onto the repositories card.
 * Opens the create repository dialog with the URI pre-populated.
 */
onRepositoryUrlDropped(url: string): void {
  if (!this.canEdit || this.dialog.openDialogs.length > 0) return;
  this.addRepository(url);
}
```

- [ ] **Step 5: Update the documents card template**

In `tm-edit.component.html`, change line 674 from:

```html
<mat-card class="documents-card">
```

to:

```html
<mat-card class="documents-card"
  appUrlDropZone
  (urlDropped)="onDocumentUrlDropped($event)"
  [attr.data-drop-hint]="'threatModels.tooltips.dropToCreateDocument' | transloco">
```

- [ ] **Step 6: Update the repositories card template**

In `tm-edit.component.html`, change line 867 from:

```html
<mat-card class="repository-card">
```

to:

```html
<mat-card class="repository-card"
  appUrlDropZone
  (urlDropped)="onRepositoryUrlDropped($event)"
  [attr.data-drop-hint]="'threatModels.tooltips.dropToCreateRepository' | transloco">
```

- [ ] **Step 7: Run build and tests**

Run: `pnpm run build && pnpm test`
Expected: Build succeeds, all tests pass.

- [ ] **Step 8: Run lint**

Run: `pnpm run lint:all`
Expected: No lint errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.ts src/app/pages/tm/tm-edit.component.html
git commit -m "feat: add drag-url-to-create for documents and repositories (#522)"
```

---

### Task 6: Backfill Localization Keys

After all code changes are committed, run the localization backfill to propagate the new English keys to other language files.

- [ ] **Step 1: Run localization backfill**

Use the `/localization-backfill` skill to propagate the two new keys (`threatModels.tooltips.dropToCreateDocument` and `threatModels.tooltips.dropToCreateRepository`) to all other locale files.

- [ ] **Step 2: Commit translations**

```bash
git add src/assets/i18n/
git commit -m "chore: backfill localization for drag-to-create tooltip keys"
```
