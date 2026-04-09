# Classification Section Unification Design

## Overview

Unify the three mapping sub-sections in the Classification area (Framework Mappings, CWE Mappings, CVSS) to use a consistent chip + dialog pattern. Move the CVSS vector paste input into the CVSS Calculator dialog. Create a new Framework Mapping Picker dialog. Update max-length validations to match the API spec.

## 1. Uniform Label Styling

All three mapping sub-sections use identical label styling: the `.mapping-label` class (13px, `var(--mat-sys-on-surface-variant)`, block display, 8px bottom margin). The CVSS section's existing `.section-label` class is replaced with `.mapping-label` for consistency.

The three sub-sections each follow the same visual pattern:

```
Label text
[chip] [chip] [chip]                    [+ Add Button]
```

## 2. Framework Mapping Picker Dialog

**Location:** `src/app/pages/tm/components/framework-mapping-picker-dialog/`

### Dialog Data

```typescript
interface FrameworkMappingPickerDialogData {
  /** All threat types from the current framework */
  availableTypes: ThreatTypeModel[];
  /** Currently selected threat type names */
  selectedTypes: string[];
  /** Current cell shape/type for appliesTo filtering (null if no cell associated) */
  cellType: string | null;
}
```

### Dialog Result

```typescript
interface FrameworkMappingPickerDialogResult {
  /** Updated full list of selected threat type names */
  selectedTypes: string[];
}
```

### UI Layout

- **Title:** "Select Framework Mappings" (i18n key: `threatEditor.frameworkMappingPicker.title`)
- **Body:** Scrollable list of all `availableTypes`, each rendered as a row with:
  - A `mat-checkbox`
  - The threat type name
  - **Enabled** if `cellType` is null (no cell association) OR `cellType` is in the type's `appliesTo` array
  - **Disabled** if `cellType` is NOT in the type's `appliesTo` array
  - Already-selected types that don't apply to the current cell: **checked and disabled** (preserves existing selections; user removes via chip X on the threat page)
- **Actions:** Cancel and OK buttons. OK returns the updated selection list. Cancel closes without changes.
- **No search field** — framework type lists are typically small (STRIDE has 6)
- **Dialog sizing:** `width: 500px, maxWidth: 95vw, maxHeight: 90vh`

### Component Pattern

Follows the same patterns as `CwePickerDialogComponent`:
- Standalone component, OnPush change detection
- `DIALOG_IMPORTS` + `TranslocoModule`
- Injected via `MAT_DIALOG_DATA`
- RTL support via `LanguageService.direction$`

## 3. Framework Mappings on Threat Page

### Remove

- The `mat-form-field` with `mat-select[formControlName="threat_type"]` multi-select dropdown

### Add

- `mat-chip-set` displaying one chip per selected threat type (from `threatForm.get('threat_type')?.value`)
- Each chip is removable (X button) when `canEdit`
- `+ Add Mapping` stroked button (same style as Add CWE / Add CVSS / Add SSVC) opens the Framework Mapping Picker dialog
- Button label i18n key: `threatEditor.addMapping`

### Integration

New method `openFrameworkMappingPicker()` on the threat page component:
- Opens the dialog with `availableTypes: this.threatTypeOptions` (mapped back to `ThreatTypeModel[]`), `selectedTypes: this.threatForm.get('threat_type')?.value`, and `cellType` derived from the current cell's shape
- On result: patches `threat_type` form value with the returned `selectedTypes`

The component needs access to `ThreatTypeModel[]` (not just `string[]` names) so the `appliesTo` data can be passed to the dialog. The `initializeThreatTypeOptions()` method should store the full `ThreatTypeModel[]` array alongside the existing `threatTypeOptions: string[]`.

The `cellType` is derived from the currently selected cell's shape. The `CellOption` interface doesn't include shape, so the component needs to look up the cell in the threat model's diagram data (via `CellDataExtractionService` or by searching `threatModel.diagrams[].cells[]` for the matching cell ID and reading its `shape` property). If no cell is associated, `cellType` is null and all types are enabled.

## 4. CWE Mappings on Threat Page

### Remove

- The `mat-chip-grid` with inline text input for typing CWE IDs
- The `addCweId()` method and `separatorKeysCodes` usage for chip input
- The `mat-form-field` wrapper around the chip grid

### Keep

- `mat-chip-set` displaying one chip per CWE ID (from `threatForm.get('cwe_id')?.value`)
- Each chip is removable (X button) when `canEdit`
- `+ Add CWE` stroked button opens the existing CWE Picker dialog (no changes to that dialog)

### Result

The CWE section becomes identical in structure to the framework mappings section: chips + button, no inline input.

## 5. CVSS Section on Threat Page

### Remove

- The `.cvss-input-row` div containing the vector paste input field and its error messages
- The `cvssVectorControl` FormControl
- The `addCvssFromVector()` method
- The `_cvssVectorValidator()` method
- The `_syncCvssVectorControlState()` method

### Keep

- `mat-chip-set` displaying one chip per CVSS entry (vector + score), each removable/clickable
- `+ Add CVSS` stroked button opens the CVSS Calculator dialog

### Label

Change the CVSS label from `.section-label` class to `.mapping-label` class for visual consistency with Framework Mappings and CWE Mappings labels.

## 6. CVSS Calculator Dialog — Vector Paste Input

### Add

A text input field inside the CVSS calculator dialog, placed in the footer area between the vector string display and the action buttons.

```
Vector String: CVSS:3.1/AV:N/... [copy]
Score: 9.8 Critical

[Paste a CVSS vector string and press Enter    ]
[error message if invalid]

                              [Cancel]  [Apply]
```

### Behavior

- Input field with placeholder: i18n key `cvssCalculator.pasteVectorPlaceholder` ("Paste a CVSS vector string and press Enter")
- On Enter keypress:
  1. Trim the input value
  2. Detect version from prefix (`CVSS:3.1` or `CVSS:4.0`)
  3. If version is unsupported: show error
  4. If version conflicts with `existingVersions`: show error
  5. Parse using `Cvss3P1` or `Cvss4P0` constructor (existing library)
  6. If parsing fails: show error
  7. If valid: update `selectedVersion`, call `_initializeFromVector()`, clear the input, rebuild metric groups
- Error display: `mat-error` under the input (same pattern as the old external input)
- The input is only shown in create mode (not edit mode, since edit already has a vector)

### Validation

Reuse the same validation logic that was in `_cvssVectorValidator()` on the threat page, adapted for inline use in the dialog.

## 7. Max Length Validation Updates

Update `Validators.maxLength()` values in the threat page form setup:

| Field | Current | API Spec (ThreatBase) | Change |
|-------|---------|----------------------|--------|
| `name` | `Validators.maxLength(100)` | `maxLength: 256` | Update to `Validators.maxLength(256)` |
| `description` | `Validators.maxLength(500)` | `maxLength: 2048` | Update to `Validators.maxLength(2048)` |
| `mitigation` | `Validators.maxLength(1024)` | `maxLength: 1024` | No change |

Also update the corresponding template error messages that pass the max value as a transloco param (e.g., `{ max: 100 }` becomes `{ max: 256 }`).

## 8. i18n Keys

New translation keys:

| Key | Value |
|-----|-------|
| `threatEditor.frameworkMappingPicker.title` | `Select Framework Mappings` |
| `threatEditor.frameworkMappingPicker.notApplicable` | `Not applicable to the current cell type` |
| `threatEditor.addMapping` | `Add Mapping` |
| `cvssCalculator.pasteVectorPlaceholder` | `Paste a CVSS vector string and press Enter` |

Each key gets a `.comment` sibling for translator context.

## 9. Files

### New
- `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.ts`
- `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.html`
- `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.scss`
- `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.types.ts`
- `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.spec.ts`

### Modified
- `src/app/pages/tm/components/threat-page/threat-page.component.html` — replace multi-select with chips+button, remove CWE inline input, remove CVSS vector input, update CVSS label class
- `src/app/pages/tm/components/threat-page/threat-page.component.ts` — add `openFrameworkMappingPicker()`, store `ThreatTypeModel[]`, remove `addCweId()`, `addCvssFromVector()`, `cvssVectorControl`, `_cvssVectorValidator()`, `_syncCvssVectorControlState()`, `separatorKeysCodes`; update maxLength validators
- `src/app/pages/tm/components/threat-page/threat-page.component.scss` — remove `.chip-input-section` remnants if any, update CVSS label styling
- `src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.html` — add vector paste input in footer
- `src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.ts` — add paste handling method, FormControl for vector input
- `src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.scss` — style for paste input
- `src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.spec.ts` — add tests for vector paste behavior
- `src/assets/i18n/en-US.json` — add new keys
- Other locale files — backfill translations

### Removed Code (from threat page)
- `cvssVectorControl` FormControl and its validator
- `addCvssFromVector()` method
- `_cvssVectorValidator()` method
- `_syncCvssVectorControlState()` method
- `addCweId()` method
- `separatorKeysCodes` property and `COMMA, ENTER` imports from `@angular/cdk/keycodes`
- `MatChipInputEvent` import
