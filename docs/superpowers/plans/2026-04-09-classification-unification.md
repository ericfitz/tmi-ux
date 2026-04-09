# Classification Section Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the Classification section's three mapping areas (Framework, CWE, CVSS) to use a consistent chip + dialog pattern, move the CVSS vector paste input into the CVSS Calculator dialog, create a new Framework Mapping Picker dialog, and update max-length validations to match the API spec.

**Architecture:** Convert all three mapping sections to a uniform chips-with-dialog pattern. Create a new standalone dialog component for framework mapping selection. Move CVSS vector paste functionality from the threat page into the existing CVSS calculator dialog. Remove dead code (inline CWE input, external CVSS vector input).

**Tech Stack:** Angular 21, Angular Material, Transloco i18n, Vitest

**Spec:** `docs/superpowers/specs/2026-04-09-classification-unification-design.md`

---

### Task 1: Max Length Validation Updates

**Files:**
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.ts`
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.html`

- [ ] **Step 1: Update validators in component TS**

In `src/app/pages/tm/components/threat-page/threat-page.component.ts`, update the form group validators:

Line 204 — change `Validators.maxLength(100)` to `Validators.maxLength(256)`:
```typescript
      name: ['', [Validators.required, Validators.maxLength(256)]],
```

Line 206 — change `Validators.maxLength(500)` to `Validators.maxLength(2048)`:
```typescript
      description: ['', Validators.maxLength(2048)],
```

- [ ] **Step 2: Update template error message params**

In `src/app/pages/tm/components/threat-page/threat-page.component.html`, find the two `maxLength` error messages and update the param values.

For the name field, change `{ max: 100 }` to `{ max: 256 }`:
```html
                {{ 'common.validation.maxLength' | transloco: { max: 256 } }}
```

For the description field, change `{ max: 500 }` to `{ max: 2048 }`:
```html
                {{ 'common.validation.maxLength' | transloco: { max: 2048 } }}
```

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/tm/components/threat-page/threat-page.component.ts \
       src/app/pages/tm/components/threat-page/threat-page.component.html
git commit -m "fix(threat-page): update maxLength validators to match API spec (name 256, description 2048)"
```

---

### Task 2: Framework Mapping Picker Dialog — Types

**Files:**
- Create: `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.types.ts`

- [ ] **Step 1: Create the types file**

```typescript
import { ThreatTypeModel } from '../../../../shared/models/framework.model';

/** Data passed into the framework mapping picker dialog */
export interface FrameworkMappingPickerDialogData {
  /** All threat types from the current framework */
  availableTypes: ThreatTypeModel[];
  /** Currently selected threat type names */
  selectedTypes: string[];
  /** Current cell shape/type for appliesTo filtering (null if no cell associated) */
  cellType: string | null;
}

/** Result returned from the framework mapping picker dialog */
export interface FrameworkMappingPickerDialogResult {
  /** Updated full list of selected threat type names */
  selectedTypes: string[];
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.types.ts
git commit -m "feat(framework-picker): add dialog data and result types"
```

---

### Task 3: Framework Mapping Picker Dialog — Component

**Files:**
- Create: `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.ts`
- Create: `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.html`
- Create: `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.scss`

- [ ] **Step 1: Create the component TypeScript**

```typescript
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  Inject,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

import { DIALOG_IMPORTS, DATA_MATERIAL_IMPORTS } from '@app/shared/imports';
import { LanguageService } from '../../../../i18n/language.service';
import { ThreatTypeModel } from '../../../../shared/models/framework.model';
import {
  FrameworkMappingPickerDialogData,
  FrameworkMappingPickerDialogResult,
} from './framework-mapping-picker-dialog.types';

interface MappingOption {
  name: string;
  checked: boolean;
  disabled: boolean;
}

@Component({
  selector: 'app-framework-mapping-picker-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, ...DATA_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './framework-mapping-picker-dialog.component.html',
  styleUrl: './framework-mapping-picker-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FrameworkMappingPickerDialogComponent implements OnInit {
  options: MappingOption[] = [];
  currentDirection: 'ltr' | 'rtl' = 'ltr';

  constructor(
    public dialogRef: MatDialogRef<FrameworkMappingPickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FrameworkMappingPickerDialogData,
    private _cdr: ChangeDetectorRef,
    private _languageService: LanguageService,
    private _destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this._languageService.direction$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(dir => {
        this.currentDirection = dir;
        this._cdr.markForCheck();
      });

    this._buildOptions();
  }

  onCheckChange(index: number, checked: boolean): void {
    this.options[index].checked = checked;
  }

  apply(): void {
    const selected = this.options
      .filter(o => o.checked)
      .map(o => o.name);
    const result: FrameworkMappingPickerDialogResult = { selectedTypes: selected };
    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  private _buildOptions(): void {
    const cellType = this.data.cellType;

    this.options = this.data.availableTypes.map(tt => {
      const isSelected = this.data.selectedTypes.includes(tt.name);
      const isApplicable = !cellType || tt.appliesTo.some(
        a => a.toLowerCase() === cellType.toLowerCase(),
      );

      return {
        name: tt.name,
        checked: isSelected,
        disabled: isSelected ? !isApplicable : !isApplicable,
      };
    });
  }
}
```

- [ ] **Step 2: Create the component template**

```html
<div [dir]="currentDirection" *transloco="let t" class="framework-mapping-picker-dialog">
  <h2 mat-dialog-title>{{ t('threatEditor.frameworkMappingPicker.title') }}</h2>

  <mat-dialog-content>
    <div class="options-list">
      @for (option of options; track option.name; let i = $index) {
        <div class="option-row" [class.disabled]="option.disabled">
          <mat-checkbox
            [checked]="option.checked"
            [disabled]="option.disabled"
            (change)="onCheckChange(i, $event.checked)"
          >
            {{ option.name }}
          </mat-checkbox>
          @if (option.disabled && !option.checked) {
            <span class="not-applicable-hint">
              {{ t('threatEditor.frameworkMappingPicker.notApplicable') }}
            </span>
          }
        </div>
      }
    </div>
  </mat-dialog-content>

  <mat-dialog-actions align="end">
    <button mat-button (click)="cancel()">{{ t('common.cancel') }}</button>
    <button mat-raised-button color="primary" (click)="apply()">
      {{ t('common.ok') }}
    </button>
  </mat-dialog-actions>
</div>
```

- [ ] **Step 3: Create the component styles**

```scss
.framework-mapping-picker-dialog {
  min-width: 400px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;

  &.disabled {
    opacity: 0.6;
  }
}

.not-applicable-hint {
  font-size: 12px;
  color: var(--mat-sys-on-surface-variant);
  font-style: italic;
}

@media (max-width: 600px) {
  .framework-mapping-picker-dialog {
    min-width: unset;
  }
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/components/framework-mapping-picker-dialog/
git commit -m "feat(framework-picker): add framework mapping picker dialog component"
```

---

### Task 4: Framework Mapping Picker Dialog — Tests

**Files:**
- Create: `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { BehaviorSubject } from 'rxjs';

import { FrameworkMappingPickerDialogComponent } from './framework-mapping-picker-dialog.component';
import { FrameworkMappingPickerDialogData } from './framework-mapping-picker-dialog.types';

interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
}

interface MockLanguageService {
  direction$: BehaviorSubject<'ltr' | 'rtl'>;
}

describe('FrameworkMappingPickerDialogComponent', () => {
  let component: FrameworkMappingPickerDialogComponent;
  let dialogRef: MockDialogRef;
  let languageService: MockLanguageService;

  const strideTypes = [
    { name: 'Spoofing', appliesTo: ['Actor', 'Process'] },
    { name: 'Tampering', appliesTo: ['Store', 'Flow', 'Process'] },
    { name: 'Repudiation', appliesTo: ['Actor', 'Store', 'Flow', 'Process'] },
    { name: 'Information Disclosure', appliesTo: ['Store', 'Flow', 'Process'] },
    { name: 'Denial of Service', appliesTo: ['Store', 'Flow', 'Process'] },
    { name: 'Elevation of Privilege', appliesTo: ['Process'] },
  ];

  function createComponent(data: FrameworkMappingPickerDialogData): void {
    dialogRef = { close: vi.fn() };
    languageService = {
      direction$: new BehaviorSubject('ltr' as const),
    };

    component = new FrameworkMappingPickerDialogComponent(
      dialogRef as any,
      data,
      { markForCheck: vi.fn() } as any,
      languageService as any,
      { onDestroy: vi.fn() } as any,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create', () => {
    createComponent({ availableTypes: strideTypes, selectedTypes: [], cellType: null });
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should show all options enabled when cellType is null', () => {
      createComponent({ availableTypes: strideTypes, selectedTypes: [], cellType: null });
      component.ngOnInit();
      expect(component.options).toHaveLength(6);
      expect(component.options.every(o => !o.disabled)).toBe(true);
    });

    it('should disable options that do not apply to the cell type', () => {
      createComponent({ availableTypes: strideTypes, selectedTypes: [], cellType: 'store' });
      component.ngOnInit();
      // Spoofing applies to Actor, Process — NOT store — should be disabled
      const spoofing = component.options.find(o => o.name === 'Spoofing');
      expect(spoofing?.disabled).toBe(true);
      // Tampering applies to Store — should be enabled
      const tampering = component.options.find(o => o.name === 'Tampering');
      expect(tampering?.disabled).toBe(false);
    });

    it('should check already-selected types', () => {
      createComponent({
        availableTypes: strideTypes,
        selectedTypes: ['Spoofing', 'Tampering'],
        cellType: null,
      });
      component.ngOnInit();
      expect(component.options.find(o => o.name === 'Spoofing')?.checked).toBe(true);
      expect(component.options.find(o => o.name === 'Tampering')?.checked).toBe(true);
      expect(component.options.find(o => o.name === 'Repudiation')?.checked).toBe(false);
    });

    it('should keep selected types checked but disabled when not applicable', () => {
      createComponent({
        availableTypes: strideTypes,
        selectedTypes: ['Spoofing'],
        cellType: 'store',
      });
      component.ngOnInit();
      const spoofing = component.options.find(o => o.name === 'Spoofing');
      expect(spoofing?.checked).toBe(true);
      expect(spoofing?.disabled).toBe(true);
    });

    it('should handle case-insensitive cellType matching', () => {
      createComponent({ availableTypes: strideTypes, selectedTypes: [], cellType: 'actor' });
      component.ngOnInit();
      const spoofing = component.options.find(o => o.name === 'Spoofing');
      expect(spoofing?.disabled).toBe(false);
    });
  });

  describe('dialog actions', () => {
    it('should return selected types on apply', () => {
      createComponent({ availableTypes: strideTypes, selectedTypes: [], cellType: null });
      component.ngOnInit();
      component.onCheckChange(0, true); // Spoofing
      component.onCheckChange(2, true); // Repudiation
      component.apply();
      expect(dialogRef.close).toHaveBeenCalledWith({
        selectedTypes: ['Spoofing', 'Repudiation'],
      });
    });

    it('should close without result on cancel', () => {
      createComponent({ availableTypes: strideTypes, selectedTypes: [], cellType: null });
      component.ngOnInit();
      component.cancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run --environment node src/app/pages/tm/components/framework-mapping-picker-dialog/`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.spec.ts
git commit -m "test(framework-picker): add dialog component unit tests"
```

---

### Task 5: CVSS Calculator Dialog — Add Vector Paste Input

**Files:**
- Modify: `src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.ts`
- Modify: `src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.html`
- Modify: `src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.scss`

- [ ] **Step 1: Add vector paste property and method to component TS**

In `cvss-calculator-dialog.component.ts`:

Add import for `FormControl` (add to existing `@angular/forms` import if present, or add new import):
```typescript
import { FormControl } from '@angular/forms';
```

Add import for `FORM_MATERIAL_IMPORTS` to the component's imports array (extend the existing imports in the `@Component` decorator):
```typescript
imports: [...DIALOG_IMPORTS, ...DATA_MATERIAL_IMPORTS, ...FORM_MATERIAL_IMPORTS, TranslocoModule],
```

And add the import at the top:
```typescript
import { DIALOG_IMPORTS, DATA_MATERIAL_IMPORTS, FORM_MATERIAL_IMPORTS } from '@app/shared/imports';
```

Add property after `currentDirection` (around line 54):
```typescript
  /** Form control for vector paste input */
  vectorPasteControl = new FormControl('');

  /** Error message key for invalid pasted vector */
  vectorPasteError = '';
```

Add method after `copyVector()`:
```typescript
  /**
   * Handle pasting a CVSS vector string into the dialog.
   * Validates, detects version, and initializes the dialog from the vector.
   */
  applyPastedVector(): void {
    const value = (this.vectorPasteControl.value ?? '').trim();
    if (!value) return;

    this.vectorPasteError = '';

    // Detect version
    let version: CvssVersion;
    if (value.startsWith('CVSS:4.0')) {
      version = '4.0';
    } else if (value.startsWith('CVSS:3.1')) {
      version = '3.1';
    } else {
      this.vectorPasteError = 'cvssCalculator.vectorUnsupportedVersion';
      this._cdr.markForCheck();
      return;
    }

    // Check for duplicate version (only in create mode)
    if (!this.isEditMode && this.data?.existingVersions?.includes(version)) {
      this.vectorPasteError = 'cvssCalculator.vectorDuplicateVersion';
      this._cdr.markForCheck();
      return;
    }

    // Try to parse and apply
    try {
      this.selectedVersion = version;
      this.isVersionLocked = true;
      this._initializeFromVector(value);
      this.vectorPasteControl.reset('');
    } catch {
      this.vectorPasteError = 'cvssCalculator.vectorInvalid';
    }

    this._cdr.markForCheck();
  }
```

- [ ] **Step 2: Add vector paste input to dialog template**

In `cvss-calculator-dialog.component.html`, add the paste input section between the `</div>` closing the `.score-display` div (line 96) and the `<div class="action-buttons">` (line 97):

```html
    @if (!isEditMode) {
      <div class="vector-paste-row">
        <mat-form-field appearance="outline" class="vector-paste-input" subscriptSizing="dynamic">
          <input
            matInput
            [placeholder]="'cvssCalculator.pasteVectorPlaceholder' | transloco"
            [formControl]="vectorPasteControl"
            (keydown.enter)="$event.preventDefault(); applyPastedVector()"
          />
          @if (vectorPasteError) {
            <mat-error>{{ vectorPasteError | transloco }}</mat-error>
          }
        </mat-form-field>
      </div>
    }
```

- [ ] **Step 3: Add styles for vector paste input**

In `cvss-calculator-dialog.component.scss`, add before the `.action-buttons` styles:

```scss
.vector-paste-row {
  margin-top: 8px;

  .vector-paste-input {
    width: 100%;
  }
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.ts \
       src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.html \
       src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.scss
git commit -m "feat(cvss-dialog): add vector paste input inside calculator dialog"
```

---

### Task 6: CVSS Calculator Dialog — Vector Paste Tests

**Files:**
- Modify: `src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.spec.ts`

- [ ] **Step 1: Add vector paste tests**

Add a new `describe('vector paste')` block to the existing test file:

```typescript
  describe('vector paste', () => {
    it('should apply a valid CVSS 3.1 vector', () => {
      createComponent({ existingVersions: [] });
      component.ngOnInit();
      component.vectorPasteControl.setValue('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H');
      component.applyPastedVector();
      expect(component.selectedVersion).toBe('3.1');
      expect(component.isVersionLocked).toBe(true);
      expect(component.isValid).toBe(true);
      expect(component.vectorPasteControl.value).toBe('');
      expect(component.vectorPasteError).toBe('');
    });

    it('should set error for unsupported version prefix', () => {
      createComponent({});
      component.ngOnInit();
      component.vectorPasteControl.setValue('CVSS:2.0/AV:N');
      component.applyPastedVector();
      expect(component.vectorPasteError).toBe('cvssCalculator.vectorUnsupportedVersion');
    });

    it('should set error for duplicate version in create mode', () => {
      createComponent({ existingVersions: ['3.1'] });
      component.ngOnInit();
      component.vectorPasteControl.setValue('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H');
      component.applyPastedVector();
      expect(component.vectorPasteError).toBe('cvssCalculator.vectorDuplicateVersion');
    });

    it('should set error for invalid vector', () => {
      createComponent({});
      component.ngOnInit();
      component.vectorPasteControl.setValue('CVSS:3.1/INVALID');
      component.applyPastedVector();
      expect(component.vectorPasteError).toBe('cvssCalculator.vectorInvalid');
    });

    it('should do nothing for empty input', () => {
      createComponent({});
      component.ngOnInit();
      component.vectorPasteControl.setValue('');
      component.applyPastedVector();
      expect(component.vectorPasteError).toBe('');
    });
  });
```

- [ ] **Step 2: Run tests**

Run: `pnpm vitest run --environment node src/app/pages/tm/components/cvss-calculator-dialog/`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.spec.ts
git commit -m "test(cvss-dialog): add vector paste unit tests"
```

---

### Task 7: Threat Page — Store Full ThreatTypeModel Array and Cell Shape Lookup

**Files:**
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.ts`

- [ ] **Step 1: Add property to store full ThreatTypeModel array**

Add a new property near the existing `threatTypeOptions` (line 156):
```typescript
  /** Full framework threat type models with appliesTo data */
  private threatTypeModels: ThreatTypeModel[] = [];
```

Add import for `ThreatTypeModel` — extend the existing import from framework.model.ts:
```typescript
import { FrameworkModel, ThreatTypeModel } from '../../../../shared/models/framework.model';
```

- [ ] **Step 2: Update initializeThreatTypeOptions to store models**

Replace the `initializeThreatTypeOptions()` method (lines 420-434) with:

```typescript
  private initializeThreatTypeOptions(): void {
    if (this.framework?.threatTypes?.length) {
      this.threatTypeModels = this.framework.threatTypes;
      this.threatTypeOptions = this.threatTypeModels.map(tt => tt.name);
    } else {
      // Fallback to default STRIDE threat types (no appliesTo filtering)
      const defaultTypes = [
        'Spoofing',
        'Tampering',
        'Repudiation',
        'Information Disclosure',
        'Denial of Service',
        'Elevation of Privilege',
      ];
      this.threatTypeModels = defaultTypes.map(name => ({ name, appliesTo: [] }));
      this.threatTypeOptions = defaultTypes;
    }
  }
```

- [ ] **Step 3: Add helper to get current cell shape**

Add a method to look up the selected cell's shape from the threat model data:

```typescript
  /**
   * Get the DFD element type (shape) for the currently selected cell.
   * Returns null if no cell is associated or shape cannot be determined.
   */
  private _getSelectedCellType(): string | null {
    const cellId = this.threatForm.get('cell_id')?.value as string;
    if (!cellId || cellId === this.NOT_ASSOCIATED_VALUE) return null;

    // Search through all diagrams' cells for the matching cell ID
    if (this.threatModel?.diagrams) {
      for (const diagram of this.threatModel.diagrams) {
        const cells = (diagram as any).cells as any[] | undefined;
        if (cells) {
          const cell = cells.find((c: any) => c.id === cellId);
          if (cell?.shape) return cell.shape;
        }
      }
    }
    return null;
  }
```

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/components/threat-page/threat-page.component.ts
git commit -m "refactor(threat-page): store ThreatTypeModel array and add cell shape lookup"
```

---

### Task 8: Threat Page — Replace Framework Multi-Select with Chips + Dialog

**Files:**
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.ts`
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.html`

- [ ] **Step 1: Add imports and method to component TS**

Add imports at the top of the file:
```typescript
import { FrameworkMappingPickerDialogComponent } from '../framework-mapping-picker-dialog/framework-mapping-picker-dialog.component';
import {
  FrameworkMappingPickerDialogData,
  FrameworkMappingPickerDialogResult,
} from '../framework-mapping-picker-dialog/framework-mapping-picker-dialog.types';
```

Add method to open the picker dialog (add after `openCwePicker()`):
```typescript
  /**
   * Open the framework mapping picker dialog
   */
  openFrameworkMappingPicker(): void {
    const dialogRef = this.dialog.open(FrameworkMappingPickerDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        availableTypes: this.threatTypeModels,
        selectedTypes: this.threatForm.get('threat_type')?.value as string[],
        cellType: this._getSelectedCellType(),
      } as FrameworkMappingPickerDialogData,
    });

    dialogRef
      .afterClosed()
      .pipe(this.untilDestroyed())
      .subscribe((result: FrameworkMappingPickerDialogResult | undefined) => {
        if (!result) return;
        this.threatForm.patchValue({ threat_type: result.selectedTypes });
        this.threatForm.markAsDirty();
      });
  }

  /**
   * Remove a threat type by name
   */
  removeThreatType(typeName: string): void {
    const current = this.threatForm.get('threat_type')?.value as string[];
    const updated = current.filter(t => t !== typeName);
    this.threatForm.patchValue({ threat_type: updated });
    this.threatForm.markAsDirty();
  }
```

- [ ] **Step 2: Replace multi-select with chips + button in template**

In the HTML, find the Threat Type column inside the `.mappings-row`. Replace the `mat-form-field` with `mat-select` with a chip set + button:

Replace the entire Threat Type column content (from `<mat-label class="mapping-label">{{ 'threatEditor.frameworkMappings'` through the closing `</mat-form-field>`) with:

```html
            <!-- Threat Type column -->
            <div class="mapping-column">
              <mat-label class="mapping-label">{{
                'threatEditor.frameworkMappings' | transloco
              }}</mat-label>
              <div class="mapping-chips-row">
                <mat-chip-set>
                  @for (type of threatForm.get('threat_type')?.value; track type) {
                    <mat-chip
                      [removable]="canEdit"
                      (removed)="removeThreatType(type)"
                    >
                      {{ type }}
                      @if (canEdit) {
                        <button matChipRemove [attr.aria-label]="'Remove ' + type">
                          <mat-icon>cancel</mat-icon>
                        </button>
                      }
                    </mat-chip>
                  }
                </mat-chip-set>
                @if (canEdit) {
                  <button
                    mat-stroked-button
                    color="primary"
                    (click)="openFrameworkMappingPicker()"
                    class="mapping-add-button"
                  >
                    <mat-icon>add</mat-icon>
                    {{ 'threatEditor.addMapping' | transloco }}
                  </button>
                }
              </div>
            </div>
```

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/tm/components/threat-page/threat-page.component.ts \
       src/app/pages/tm/components/threat-page/threat-page.component.html
git commit -m "feat(threat-page): replace framework multi-select with chips + picker dialog"
```

---

### Task 9: Threat Page — Replace CWE Inline Input with Chips-Only

**Files:**
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.html`
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.ts`

- [ ] **Step 1: Replace CWE column template with chips + button only**

In the HTML, replace the entire CWE column content with:

```html
            <!-- CWE column -->
            <div class="mapping-column">
              <mat-label class="mapping-label">{{
                'threatEditor.cweMappings' | transloco
              }}</mat-label>
              <div class="mapping-chips-row">
                <mat-chip-set>
                  @for (cweId of threatForm.get('cwe_id')?.value; track cweId) {
                    <mat-chip
                      [removable]="canEdit"
                      (removed)="removeCweId(cweId)"
                    >
                      {{ cweId }}
                      @if (canEdit) {
                        <button matChipRemove [attr.aria-label]="'Remove ' + cweId">
                          <mat-icon>cancel</mat-icon>
                        </button>
                      }
                    </mat-chip>
                  }
                </mat-chip-set>
                @if (canEdit) {
                  <button
                    mat-stroked-button
                    color="primary"
                    (click)="openCwePicker()"
                    class="mapping-add-button"
                    [matTooltip]="'cwePicker.chooseCwe' | transloco"
                  >
                    <mat-icon>add</mat-icon>
                    {{ 'cwePicker.addCwe' | transloco }}
                  </button>
                }
              </div>
            </div>
```

- [ ] **Step 2: Remove dead code from component TS**

Remove the `addCweId()` method (lines 812-834), the `separatorKeysCodes` property (line 165), and the imports for `COMMA, ENTER` from `@angular/cdk/keycodes` (line 17) and `MatChipInputEvent` from `@angular/material/chips` (line 18).

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/tm/components/threat-page/threat-page.component.ts \
       src/app/pages/tm/components/threat-page/threat-page.component.html
git commit -m "refactor(threat-page): replace CWE inline input with chips-only display"
```

---

### Task 10: Threat Page — Remove CVSS Vector Input and Unify CVSS Label

**Files:**
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.html`
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.ts`
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.scss`

- [ ] **Step 1: Replace CVSS section in template**

Replace the entire `<!-- CVSS Entries -->` section with a uniform chip + button layout matching Framework and CWE:

```html
          <!-- CVSS Entries -->
          <div class="mapping-section">
            <mat-label class="mapping-label">{{ 'threatEditor.cvss' | transloco }}</mat-label>
            <div class="mapping-chips-row">
              <mat-chip-set>
                @for (entry of threatForm.get('cvss')?.value; track entry.vector; let i = $index) {
                  <mat-chip
                    [removable]="canEdit"
                    (removed)="removeCvssEntry(i)"
                    (click)="canEdit ? editCvssEntry(i) : null"
                    [class.clickable]="canEdit"
                  >
                    {{ entry.vector }} ({{ entry.score }})
                    @if (canEdit) {
                      <button matChipRemove [attr.aria-label]="'Remove CVSS entry'">
                        <mat-icon>cancel</mat-icon>
                      </button>
                    }
                  </mat-chip>
                }
              </mat-chip-set>
              @if (canEdit) {
                <button
                  mat-stroked-button
                  color="primary"
                  (click)="openCvssCalculator()"
                  [disabled]="!canAddCvss"
                  class="mapping-add-button"
                >
                  <mat-icon>add</mat-icon>
                  {{ 'cvssCalculator.openCalculator' | transloco }}
                </button>
              }
            </div>
          </div>
```

- [ ] **Step 2: Remove dead code from component TS**

Remove these items from `threat-page.component.ts`:
- `cvssVectorControl` property declaration (line 181)
- `addCvssFromVector()` method (lines 917-934)
- `_cvssVectorValidator()` method (lines 941-974)
- `_syncCvssVectorControlState()` method (lines 1024-1030)
- The `cvssVectorControl.setValidators(...)` call in `ngOnInit()` (find it near line 290)
- The `_syncCvssVectorControlState()` call in `populateForm()` (near end of that method)
- The `this.cvssVectorControl.updateValueAndValidity()` calls in `openCvssCalculator()` and `removeCvssEntry()`
- Remove unused imports: `Cvss3P1, Cvss4P0` from `ae-cvss-calculator` (line 19), `CvssVersion` from the types import, `AbstractControl, ValidationErrors` from `@angular/forms` (unless used elsewhere)

- [ ] **Step 3: Remove old CVSS styles from SCSS**

Remove the `.cvss-section`, `.cvss-input-row`, and `.cvss-calculator-button` styles from the SCSS file, as they're no longer used.

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/components/threat-page/threat-page.component.ts \
       src/app/pages/tm/components/threat-page/threat-page.component.html \
       src/app/pages/tm/components/threat-page/threat-page.component.scss
git commit -m "refactor(threat-page): remove CVSS vector input and unify CVSS label styling"
```

---

### Task 11: Styles — Unified Mapping Chips Row

**Files:**
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.scss`

- [ ] **Step 1: Add mapping chips row styles**

Add styles for the new uniform chip + button layout used by all three mapping sections:

```scss
// Unified mapping chip + button layout (Framework, CWE, CVSS)
.mapping-section {
  margin-top: 4px;
  margin-bottom: 4px;
}

.mapping-chips-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;

  mat-chip-set {
    flex: 1;
    min-width: 0;
  }

  .mapping-add-button {
    // Vertically center with chip row
    margin-top: 2px;
    white-space: nowrap;
  }
}
```

- [ ] **Step 2: Update mappings-row styles if needed**

Ensure the `.mappings-row` still works with the new chip layout inside each column. The `.cwe-input-row` style is no longer used — remove it if present. Replace with `.mapping-chips-row` which is now used by both columns.

- [ ] **Step 3: Verify build and lint**

Run: `pnpm run build && pnpm run lint:all`
Expected: Both pass

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/tm/components/threat-page/threat-page.component.scss
git commit -m "style(threat-page): add unified mapping chips row styles"
```

---

### Task 12: Add i18n Keys

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Add new translation keys**

Add to the `threatEditor` section:
```json
    "addMapping": "Add Mapping",
    "addMapping.comment": "Button label to open the framework mapping picker dialog.",
    "frameworkMappingPicker": {
      "notApplicable": "Not applicable to the current cell type",
      "notApplicable.comment": "Hint shown next to disabled mapping options that don't apply to the associated cell's DFD element type.",
      "title": "Select Framework Mappings",
      "title.comment": "Title for the framework mapping picker dialog."
    },
```

Add to the `cvssCalculator` section:
```json
    "pasteVectorPlaceholder": "Paste a CVSS vector string and press Enter",
    "pasteVectorPlaceholder.comment": "Placeholder for the vector paste input inside the CVSS calculator dialog. CVSS is a proper name and should not be translated.",
```

`common.ok` already exists (line 737) — no need to add it.

- [ ] **Step 2: Validate JSON and build**

Run: `python3 -c "import json; json.load(open('src/assets/i18n/en-US.json'))" && pnpm run build`
Expected: Valid JSON, build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "chore(i18n): add classification unification translation keys"
```

---

### Task 13: Localization Backfill

**Files:**
- Modify: All locale files in `src/assets/i18n/` (except `en-US.json`)

- [ ] **Step 1: Run the localization backfill command**

Run: `/localization-backfill`

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/
git commit -m "chore(i18n): backfill classification unification translations"
```

---

### Task 14: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

Run: `pnpm run lint:all`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Run all SSVC and framework picker tests**

Run: `pnpm vitest run --environment node src/app/pages/tm/components/ssvc-calculator-dialog/ src/app/pages/tm/components/framework-mapping-picker-dialog/ src/app/pages/tm/components/cvss-calculator-dialog/`
Expected: All tests pass

- [ ] **Step 4: Commit any fixes**

Only if needed:
```bash
git add -A
git commit -m "fix: address lint and test issues from classification unification"
```
