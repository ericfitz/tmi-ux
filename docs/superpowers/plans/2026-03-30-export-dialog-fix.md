# Export Dialog Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken threat model export by decoupling async data fetching from the user-gesture-gated download trigger via an intermediary dialog.

**Architecture:** When the user clicks "Export", a dialog opens immediately (within user activation). The dialog fetches data and shows a spinner. When data is ready, a "Save" button appears. The user clicks "Save" (new user activation), and the dialog closes with the prepared blob. The caller triggers the download in the `afterClosed` callback.

**Tech Stack:** Angular Material Dialog, RxJS, Transloco i18n

**Branch strategy:** Implement on `main` first (uses `exportThreatModel()`), then cherry-pick to `dev/1.4.0` adjusting the fetch call to `getThreatModelById(id, true)`.

---

### Task 1: Create ExportDialog types

**Files:**
- Create: `src/app/pages/tm/components/export-dialog/export-dialog.types.ts`

- [ ] **Step 1: Create the types file**

```typescript
import { Observable } from 'rxjs';
import { ThreatModel } from '../../models/threat-model.model';

/**
 * Data passed to the ExportDialogComponent when opened.
 */
export interface ExportDialogData {
  /** Display name of the threat model being exported */
  threatModelName: string;
  /** Observable that fetches the full threat model data for export */
  fetchObservable: Observable<ThreatModel | undefined>;
}

/**
 * Result returned when the export dialog closes.
 * Undefined if the user cancelled.
 */
export interface ExportDialogResult {
  /** The prepared JSON blob ready for download */
  blob: Blob;
  /** The suggested filename */
  filename: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/pages/tm/components/export-dialog/export-dialog.types.ts
git commit -m "fix: add ExportDialog types for export dialog"
```

---

### Task 2: Add i18n keys

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Add exportDialog keys under threatModels**

Add the following keys inside the `"threatModels"` object, after the existing `"export"` key (around line 1552):

```json
"exportDialog": {
  "title": "Export Threat Model",
  "preparing": "Preparing export data...",
  "ready": "Export ready. Click Save to download.",
  "error": "Failed to prepare export data. Please try again.",
  "save": "Save",
  "retry": "Retry"
}
```

- [ ] **Step 2: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "fix: add i18n keys for export dialog"
```

---

### Task 3: Create ExportDialog component

**Files:**
- Create: `src/app/pages/tm/components/export-dialog/export-dialog.component.ts`
- Create: `src/app/pages/tm/components/export-dialog/export-dialog.component.html`
- Create: `src/app/pages/tm/components/export-dialog/export-dialog.component.scss`

- [ ] **Step 1: Create the component TypeScript file**

```typescript
import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';

import { DIALOG_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '../../../../core/services/logger.service';
import { ThreatModel } from '../../models/threat-model.model';
import { ExportDialogData, ExportDialogResult } from './export-dialog.types';

// Re-export types for consumers importing from the component file
export type { ExportDialogData, ExportDialogResult } from './export-dialog.types';

type ExportState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-export-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, TranslocoModule],
  templateUrl: './export-dialog.component.html',
  styleUrls: ['./export-dialog.component.scss'],
})
export class ExportDialogComponent implements OnInit, OnDestroy {
  state: ExportState = 'loading';

  private _blob: Blob | null = null;
  private _filename = '';
  private _destroy$ = new Subject<void>();

  constructor(
    private _dialogRef: MatDialogRef<ExportDialogComponent, ExportDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: ExportDialogData,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.fetchData();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  /** Trigger the fetch (used on init and retry). */
  fetchData(): void {
    this.state = 'loading';
    this._blob = null;

    this.data.fetchObservable.pipe(takeUntil(this._destroy$)).subscribe({
      next: (threatModel: ThreatModel | undefined) => {
        if (!threatModel) {
          this.logger.error('Export fetch returned no data');
          this.state = 'error';
          return;
        }

        try {
          const filename = this.generateFilename(threatModel.name);
          const normalized = this.normalizeDates(threatModel);
          const jsonContent = JSON.stringify(normalized, null, 2);
          this._blob = new Blob([jsonContent], { type: 'application/json' });
          this._filename = filename;
          this.state = 'ready';
        } catch (error) {
          this.logger.error('Error preparing export blob', error);
          this.state = 'error';
        }
      },
      error: (error: unknown) => {
        this.logger.error('Export fetch failed', error);
        this.state = 'error';
      },
    });
  }

  /** User clicked Save — close with the prepared blob. */
  onSave(): void {
    if (this._blob) {
      this._dialogRef.close({ blob: this._blob, filename: this._filename });
    }
  }

  /** User clicked Cancel or Retry failed. */
  onCancel(): void {
    this._dialogRef.close(undefined);
  }

  /**
   * Generate filename: sanitized threat model name (max 63 chars) + "-threat-model.json"
   */
  private generateFilename(name: string): string {
    const sanitized = name
      .trim()
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const truncated = sanitized.length > 63 ? sanitized.substring(0, 63) : sanitized;
    return `${truncated}-threat-model.json`;
  }

  /**
   * Normalize date fields to ISO 8601 format for consistent export.
   */
  private normalizeDates(threatModel: ThreatModel): ThreatModel {
    const normalizeDate = (dateString: string): string => {
      if (!dateString) return new Date().toISOString();
      try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
      } catch {
        return new Date().toISOString();
      }
    };

    const normalizeSub = <T extends { created_at: string; modified_at: string }>(
      items: T[] | undefined,
    ): T[] | undefined =>
      items?.map(item => ({
        ...item,
        created_at: normalizeDate(item.created_at),
        modified_at: normalizeDate(item.modified_at),
      }));

    return {
      ...threatModel,
      created_at: normalizeDate(threatModel.created_at),
      modified_at: normalizeDate(threatModel.modified_at),
      diagrams: normalizeSub(threatModel.diagrams),
      threats: normalizeSub(threatModel.threats),
      notes: normalizeSub(threatModel.notes),
      assets: normalizeSub(threatModel.assets),
      documents: normalizeSub(threatModel.documents),
      repositories: normalizeSub(threatModel.repositories),
    };
  }
}
```

- [ ] **Step 2: Create the template**

```html
<h2 mat-dialog-title class="export-dialog-title">
  <mat-icon>file_download</mat-icon>
  {{ 'threatModels.exportDialog.title' | transloco }}
</h2>

<mat-dialog-content>
  <div class="export-dialog-content">
    @switch (state) {
      @case ('loading') {
        <div class="status-row">
          <mat-spinner diameter="24"></mat-spinner>
          <span>{{ 'threatModels.exportDialog.preparing' | transloco }}</span>
        </div>
      }
      @case ('ready') {
        <div class="status-row ready">
          <mat-icon>check_circle</mat-icon>
          <span>{{ 'threatModels.exportDialog.ready' | transloco }}</span>
        </div>
      }
      @case ('error') {
        <div class="status-row error">
          <mat-icon>error</mat-icon>
          <span>{{ 'threatModels.exportDialog.error' | transloco }}</span>
        </div>
      }
    }
  </div>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <button
    mat-raised-button
    color="primary"
    (click)="onCancel()"
    tabindex="1"
    [attr.aria-label]="'common.cancel' | transloco"
  >
    {{ 'common.cancel' | transloco }}
  </button>

  @if (state === 'error') {
    <button
      mat-button
      color="primary"
      (click)="fetchData()"
      tabindex="2"
      [attr.aria-label]="'threatModels.exportDialog.retry' | transloco"
    >
      {{ 'threatModels.exportDialog.retry' | transloco }}
    </button>
  }

  @if (state === 'ready') {
    <button
      mat-button
      color="primary"
      (click)="onSave()"
      cdkFocusInitial
      tabindex="2"
      [attr.aria-label]="'threatModels.exportDialog.save' | transloco"
    >
      {{ 'threatModels.exportDialog.save' | transloco }}
    </button>
  }
</mat-dialog-actions>
```

- [ ] **Step 3: Create the stylesheet**

```scss
.export-dialog-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 20px 24px;

  mat-icon {
    color: var(--color-primary);
  }
}

.export-dialog-content {
  padding: 0 24px 20px;

  .status-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-radius: 8px;
    background-color: var(--color-surface-container);

    &.ready mat-icon {
      color: var(--color-success, #4caf50);
    }

    &.error mat-icon {
      color: var(--color-error-dark);
    }
  }
}

mat-dialog-actions {
  padding: 16px 24px;
  margin: 0;

  button {
    margin-left: 8px;

    [dir='rtl'] & {
      margin-left: 0;
      margin-right: 8px;
    }

    &:first-child {
      margin-left: 0;

      [dir='rtl'] & {
        margin-right: 0;
      }
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/tm/components/export-dialog/
git commit -m "fix: create ExportDialog component for async export flow"
```

---

### Task 4: Write ExportDialog tests

**Files:**
- Create: `src/app/pages/tm/components/export-dialog/export-dialog.component.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError, Subject } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTranslocoTestingModule } from '../../../../mocks/transloco-testing.module';

import { ExportDialogComponent } from './export-dialog.component';
import { ExportDialogData } from './export-dialog.types';
import { ThreatModel } from '../../models/threat-model.model';
import { LoggerService } from '../../../../core/services/logger.service';

const mockThreatModel: ThreatModel = {
  id: 'tm-1',
  name: 'Test TM',
  description: 'A test threat model',
  owner: 'user1',
  status: 'active',
  threat_model_framework: 'stride',
  created_at: '2026-01-01T00:00:00.000Z',
  modified_at: '2026-01-01T00:00:00.000Z',
  authorization: [],
  metadata: [],
  diagrams: [],
  threats: [],
  notes: [],
  assets: [],
  documents: [],
  repositories: [],
};

describe('ExportDialogComponent', () => {
  let component: ExportDialogComponent;
  let fixture: ComponentFixture<ExportDialogComponent>;
  let dialogRefSpy: { close: ReturnType<typeof vi.fn> };
  let loggerSpy: {
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };

  function createComponent(fetchObservable: ExportDialogData['fetchObservable']): void {
    dialogRefSpy = { close: vi.fn() };
    loggerSpy = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debugComponent: vi.fn(),
    };

    const data: ExportDialogData = {
      threatModelName: 'Test TM',
      fetchObservable,
    };

    TestBed.configureTestingModule({
      imports: [ExportDialogComponent, NoopAnimationsModule, getTranslocoTestingModule()],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: LoggerService, useValue: loggerSpy },
      ],
    });

    fixture = TestBed.createComponent(ExportDialogComponent);
    component = fixture.componentInstance;
  }

  it('should start in loading state and transition to ready on successful fetch', () => {
    createComponent(of(mockThreatModel));
    expect(component.state).toBe('loading');

    fixture.detectChanges(); // triggers ngOnInit

    expect(component.state).toBe('ready');
  });

  it('should transition to error when fetch returns undefined', () => {
    createComponent(of(undefined));
    fixture.detectChanges();

    expect(component.state).toBe('error');
    expect(loggerSpy.error).toHaveBeenCalled();
  });

  it('should transition to error when fetch observable errors', () => {
    createComponent(throwError(() => new Error('Network error')));
    fixture.detectChanges();

    expect(component.state).toBe('error');
    expect(loggerSpy.error).toHaveBeenCalled();
  });

  it('should close with blob and filename on save', () => {
    createComponent(of(mockThreatModel));
    fixture.detectChanges();

    component.onSave();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(
      expect.objectContaining({
        blob: expect.any(Blob),
        filename: 'Test-TM-threat-model.json',
      }),
    );
  });

  it('should close with undefined on cancel', () => {
    createComponent(of(mockThreatModel));
    fixture.detectChanges();

    component.onCancel();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(undefined);
  });

  it('should retry fetch when fetchData is called again', () => {
    const subject = new Subject<ThreatModel | undefined>();
    createComponent(subject.asObservable());
    fixture.detectChanges();

    expect(component.state).toBe('loading');

    // Simulate error
    subject.error(new Error('fail'));
    expect(component.state).toBe('error');

    // Retry — need a new observable since the old one errored
    component.data.fetchObservable = of(mockThreatModel);
    component.fetchData();

    expect(component.state).toBe('ready');
  });

  it('should sanitize filename with special characters', () => {
    const tmWithSpecialName = { ...mockThreatModel, name: 'My TM: "test" <v2>' };
    createComponent(of(tmWithSpecialName));
    fixture.detectChanges();

    component.onSave();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'My-TM--test--v2-threat-model.json',
      }),
    );
  });

  it('should truncate long filenames to 63 characters', () => {
    const longName = 'A'.repeat(100);
    const tmWithLongName = { ...mockThreatModel, name: longName };
    createComponent(of(tmWithLongName));
    fixture.detectChanges();

    component.onSave();

    const result = dialogRefSpy.close.mock.calls[0][0];
    // 63 chars + "-threat-model.json" suffix
    expect(result.filename).toBe('A'.repeat(63) + '-threat-model.json');
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm vitest run src/app/pages/tm/components/export-dialog/export-dialog.component.spec.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/components/export-dialog/export-dialog.component.spec.ts
git commit -m "test: add ExportDialog component tests"
```

---

### Task 5: Wire up ExportDialog in tm-edit component (main branch)

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.ts` (imports ~line 50-80, `downloadToDesktop` ~line 2586, remove `normalizeThreatModelForExport` ~line 2631, remove `normalizeDate` ~line 2694, remove `generateThreatModelFilename` ~line 2716, remove `handleThreatModelExport` ~line 2753)

- [ ] **Step 1: Add import for ExportDialogComponent**

In `src/app/pages/tm/tm-edit.component.ts`, add this import after the other dialog imports (around line 78):

```typescript
import {
  ExportDialogComponent,
  ExportDialogData,
  ExportDialogResult,
} from './components/export-dialog/export-dialog.component';
```

- [ ] **Step 2: Replace downloadToDesktop method**

Replace the entire `downloadToDesktop` method (starts around line 2586) with:

```typescript
  async downloadToDesktop(): Promise<void> {
    if (!this.threatModel) {
      this.logger.warn('Cannot download threat model: no threat model loaded');
      return;
    }

    this.logger.info('Opening export dialog for threat model', {
      threatModelId: this.threatModel.id,
      threatModelName: this.threatModel.name,
    });

    const dialogRef = this.dialog.open<
      ExportDialogComponent,
      ExportDialogData,
      ExportDialogResult
    >(ExportDialogComponent, {
      width: '450px',
      data: {
        threatModelName: this.threatModel.name,
        fetchObservable: this.threatModelService.exportThreatModel(this.threatModel.id),
      },
      disableClose: true,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe(result => {
        if (!result) return;
        this.triggerDownload(result.blob, result.filename);
      }),
    );
  }
```

- [ ] **Step 3: Add triggerDownload method**

Add a new private method after `downloadToDesktop` (replaces the old `handleThreatModelExport`):

```typescript
  /**
   * Trigger a file download using the File System Access API with fallback.
   * Must be called within a user activation context (e.g., from a dialog
   * afterClosed callback triggered by a user click).
   */
  private async triggerDownload(blob: Blob, filename: string): Promise<void> {
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'JSON files',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        this.logger.info('Threat model saved via File System Access API', { filename });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          this.logger.debugComponent('TmEdit', 'Save cancelled by user');
          return;
        }
        this.logger.warn('File System Access API failed, using fallback', error);
      }
    }

    // Fallback: anchor element download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.logger.info('Threat model downloaded via fallback method', { filename });
  }
```

- [ ] **Step 4: Remove old methods that are now in ExportDialogComponent**

Remove these methods from `tm-edit.component.ts` (they have been moved into the dialog component):
- `normalizeThreatModelForExport` (around line 2631)
- `normalizeDate` (around line 2694)
- `generateThreatModelFilename` (around line 2716)
- `handleThreatModelExport` (around line 2753)

Verify none of these are called from anywhere else in the file:
- `normalizeThreatModelForExport` — only called in old `downloadToDesktop`
- `normalizeDate` — only called by `normalizeThreatModelForExport`
- `generateThreatModelFilename` — only called in old `downloadToDesktop`
- `handleThreatModelExport` — only called in old `downloadToDesktop`

- [ ] **Step 5: Remove unused import**

`firstValueFrom` was only used by `downloadToDesktop`. Check if it is used elsewhere in the file. If not, remove it from the import on line 26:

```typescript
// Before:
import { Subscription, Subject, firstValueFrom } from 'rxjs';
// After (only if firstValueFrom is not used elsewhere):
import { Subscription, Subject } from 'rxjs';
```

Search the file for other uses of `firstValueFrom` before removing.

- [ ] **Step 6: Lint and build**

Run: `pnpm run lint:all`
Run: `pnpm run build`
Fix any issues.

- [ ] **Step 7: Run tests**

Run: `pnpm vitest run src/app/pages/tm/`
Fix any failures.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.ts
git commit -m "fix: use export dialog to decouple async fetch from download trigger

The downloadToDesktop() method performed async API calls between the
user's click and the file download trigger, causing browser transient
user activation to expire. The download silently failed.

Now opens an ExportDialog that shows fetch progress, then presents a
Save button. The user's click on Save provides fresh user activation
for the File System Access API or fallback download."
```

---

### Task 6: Backfill i18n for other languages

**Files:**
- Modify: All `src/assets/i18n/*.json` files (except `en-US.json` and `i18n-allowlist.json`)

- [ ] **Step 1: Add exportDialog keys to all locale files**

Use the localization-backfill skill to add the new `exportDialog` keys to all non-English locale files with appropriate translations.

- [ ] **Step 2: Commit**

```bash
git add src/assets/i18n/
git commit -m "fix: add export dialog i18n keys for all locales"
```

---

### Task 7: Cherry-pick to dev/1.4.0

**Files:**
- Same files as Tasks 1-6 but on `dev/1.4.0` branch
- Modify: `src/app/pages/tm/tm-edit.component.ts` — use `getThreatModelById(id, true)` instead of `exportThreatModel(id)`

- [ ] **Step 1: Switch to dev/1.4.0 branch**

```bash
git checkout dev/1.4.0
```

- [ ] **Step 2: Cherry-pick the commits**

Cherry-pick all commits from Tasks 1-6 in order. The dialog types, component, tests, and i18n commits should apply cleanly.

The Task 5 commit (wiring up in tm-edit) will likely conflict because `dev/1.4.0` uses `getThreatModelById` instead of `exportThreatModel`. Resolve the conflict by changing the `fetchObservable` in the dialog open call:

```typescript
// dev/1.4.0 version — uses getThreatModelById instead of exportThreatModel
fetchObservable: this.threatModelService.getThreatModelById(this.threatModel.id, true),
```

Also on `dev/1.4.0`, the old methods to remove may differ slightly. Use the same approach: remove `normalizeThreatModelForExport`, `normalizeDate`, `generateThreatModelFilename`, and `handleThreatModelExport` if they exist, and the old `downloadToDesktop` body.

- [ ] **Step 3: Lint, build, and test on dev/1.4.0**

Run: `pnpm run lint:all`
Run: `pnpm run build`
Run: `pnpm vitest run src/app/pages/tm/`
Fix any issues.

- [ ] **Step 4: Commit any conflict resolution**

```bash
git add -A
git commit -m "fix: adapt export dialog for dev/1.4.0 (uses getThreatModelById)"
```

- [ ] **Step 5: Switch back to main**

```bash
git checkout main
```
