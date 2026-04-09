# Threat Page Form Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the threat edit form into 5 labeled sections with reordered fields, merged Threat Type + CWE row, and restyled CWE button.

**Architecture:** Template-and-style-only changes to the threat page component. No logic, validator, or method changes. Fields are reordered in the HTML, section dividers are added, and the CWE button is restyled. New i18n keys for section headers and labels.

**Tech Stack:** Angular 21, Angular Material, Transloco i18n, SCSS

**Spec:** `docs/superpowers/specs/2026-04-08-threat-form-reorganization-design.md`

---

### Task 1: Add i18n Keys

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Add section header keys to `threatEditor`**

In `src/assets/i18n/en-US.json`, find the `"threatEditor"` section (line 1652). Add a `"sections"` sub-object and the two new label keys. Insert them alphabetically within the `threatEditor` object — `"frameworkMappings"` goes after `"cweIds.comment"` (line 1665), `"cweMappings"` goes before `"frameworkMappings"`, and `"sections"` goes after `"notAssociatedWithDiagram"` (line 1668):

Add after `"cweIds.comment"` line:

```json
    "cweMappings": "CWE Mappings",
    "cweMappings.comment": "Sub-label for the CWE IDs section. CWE = Common Weakness Enumeration, should not be translated.",
    "frameworkMappings": "Threat Model Framework Mappings",
    "frameworkMappings.comment": "Sub-label for the Threat Type section within the Classification area.",
```

Add after `"notAssociatedWithDiagram"` line:

```json
    "sections": {
      "classification": "Classification",
      "classification.comment": "Section header for threat classification fields (severity, type, CWE, CVSS).",
      "description": "Description",
      "description.comment": "Section header for threat description fields (name, asset, description).",
      "diagramReferences": "Diagram References",
      "diagramReferences.comment": "Section header for diagram and cell association fields.",
      "mitigation": "Mitigation",
      "mitigation.comment": "Section header for the mitigation text area.",
      "tracking": "Tracking",
      "tracking.comment": "Section header for tracking fields (issue URL, status, checkboxes)."
    },
```

- [ ] **Step 2: Add `addCwe` key to `cwePicker`**

In `src/assets/i18n/en-US.json`, find the `"cwePicker"` section (line 844). Add after the `"addCweReference.comment"` line:

```json
    "addCwe": "Add CWE",
    "addCwe.comment": "Button label to open the CWE picker dialog. CWE = Common Weakness Enumeration, should not be translated.",
```

- [ ] **Step 3: Validate JSON**

Run: `python3 -c "import json; json.load(open('src/assets/i18n/en-US.json'))"`
Expected: No output (valid JSON)

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "chore(i18n): add threat form section header and label keys"
```

---

### Task 2: Reorganize the Template

**Files:**
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.html`

This task replaces the entire form body (from `<form>` to `</form>`) with the reorganized version. The field HTML blocks are moved, not rewritten — all bindings, directives, and event handlers stay identical.

- [ ] **Step 1: Replace the form content**

In `src/app/pages/tm/components/threat-page/threat-page.component.html`, replace the entire block from `<form [formGroup]="threatForm" class="threat-form">` (line 76) through `</form>` (line 455) with:

```html
      <form [formGroup]="threatForm" class="threat-form">
        <!-- ── Tracking ──────────────────────────────────────── -->
        <div class="form-section">
          <div class="section-header">
            <span class="section-label-text">{{ 'threatEditor.sections.tracking' | transloco }}</span>
            <mat-divider></mat-divider>
          </div>

          <!-- Issue URI field -->
          <div class="form-field-row">
            @if (canEdit) {
              <div
                class="issue-uri-container"
                appUrlDropZone
                (urlDropped)="onIssueUriUrlDropped($event)"
                [attr.data-drop-hint]="'threatModels.tooltips.dropToSetIssueUri' | transloco"
              >
                <mat-form-field appearance="outline" class="issue-uri-field" floatLabel="always">
                  <mat-label>{{ 'common.issueUri' | transloco }}</mat-label>
                  @if (shouldShowIssueUriHyperlink()) {
                    <input
                      matInput
                      readonly
                      [value]="initialIssueUriValue"
                      class="uri-view-content"
                      (click)="openUriInNewTab(initialIssueUriValue)"
                      style="cursor: pointer; color: #1976d2; text-decoration: underline"
                    />
                  } @else {
                    <input
                      matInput
                      formControlName="issue_uri"
                      type="url"
                      (blur)="onIssueUriBlur()"
                    />
                  }
                </mat-form-field>

                @if (shouldShowIssueUriHyperlink()) {
                  <button
                    mat-icon-button
                    class="external-edit-button"
                    (click)="editIssueUri()"
                    [matTooltip]="'common.edit' | transloco"
                  >
                    <mat-icon>edit</mat-icon>
                  </button>
                }
              </div>
            }

            @if (!canEdit && threat?.issue_uri) {
              <div class="view-only-uri">
                <span class="uri-label">{{ 'common.issueUri' | transloco }}:</span>
                <a
                  [href]="threat?.issue_uri"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="issue-uri-link"
                >
                  {{ threat?.issue_uri }}
                </a>
              </div>
            }
          </div>

          <!-- Status, Mitigated, Include in Timmy Chat, Include in Report row -->
          <div class="form-field-row status-row">
            <mat-form-field appearance="outline" floatLabel="always" class="status-field">
              <mat-label>{{ 'common.status' | transloco }}</mat-label>
              <mat-select formControlName="status">
                <mat-option [value]="null">{{ 'common.none' | transloco }}</mat-option>
                @for (option of statusOptions; track option.key) {
                  <mat-option
                    [value]="option.key"
                    [matTooltip]="
                      'threatEditor.threatStatus.' + option.key + '.description' | transloco
                    "
                  >
                    {{ 'threatEditor.threatStatus.' + option.key | transloco }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="checkbox-field">
              <mat-checkbox formControlName="mitigated">
                {{ 'common.mitigated' | transloco }}
              </mat-checkbox>
            </div>

            <div class="checkbox-field">
              <mat-checkbox formControlName="timmy_enabled">
                {{ 'common.includeInTimmyChat' | transloco }}
              </mat-checkbox>
            </div>

            <div class="checkbox-field">
              <mat-checkbox formControlName="include_in_report">
                {{ 'common.includeInReport' | transloco }}
              </mat-checkbox>
            </div>
          </div>
        </div>

        <!-- ── Description ───────────────────────────────────── -->
        <div class="form-section">
          <div class="section-header">
            <span class="section-label-text">{{ 'threatEditor.sections.description' | transloco }}</span>
            <mat-divider></mat-divider>
          </div>

          <!-- Name field -->
          <div class="form-field-container">
            <mat-form-field appearance="outline" class="full-width" floatLabel="always">
              <mat-label>{{ 'common.threatName' | transloco }}</mat-label>
              <input matInput formControlName="name" />
              @if (threatForm.get('name')?.hasError('required')) {
                <mat-error>
                  {{ 'common.validation.required' | transloco }}
                </mat-error>
              }
              @if (threatForm.get('name')?.hasError('maxlength')) {
                <mat-error>
                  {{ 'common.validation.maxLength' | transloco: { max: 100 } }}
                </mat-error>
              }
            </mat-form-field>
          </div>

          <!-- Asset field -->
          <div class="form-field-row">
            <mat-form-field appearance="outline" class="full-width" floatLabel="always">
              <mat-label>{{ 'common.objectTypes.asset' | transloco }}</mat-label>
              <mat-select formControlName="asset_id">
                <mat-option *ngFor="let asset of assetOptions" [value]="asset.id">
                  {{
                    asset.id === NOT_ASSOCIATED_VALUE
                      ? asset.name
                      : asset.name + ' (' + asset.type + ')'
                  }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Description field -->
          <div class="form-field-container">
            <mat-form-field appearance="outline" class="full-width" floatLabel="always">
              <mat-label>{{ 'common.threatDescription' | transloco }}</mat-label>
              <textarea
                matInput
                formControlName="description"
                rows="3"
                [placeholder]="'common.threatDescriptionPlaceholder' | transloco"
              ></textarea>
              @if (threatForm.get('description')?.hasError('maxlength')) {
                <mat-error>
                  {{ 'common.validation.maxLength' | transloco: { max: 500 } }}
                </mat-error>
              }
            </mat-form-field>
          </div>
        </div>

        <!-- ── Classification ────────────────────────────────── -->
        <div class="form-section">
          <div class="section-header">
            <span class="section-label-text">{{ 'threatEditor.sections.classification' | transloco }}</span>
            <mat-divider></mat-divider>
          </div>

          <!-- Severity, Score, Priority, SSVC row -->
          <div class="form-field-row severity-row">
            <mat-form-field appearance="outline" floatLabel="always" class="severity-field">
              <mat-label>{{ 'common.severity' | transloco }}</mat-label>
              <mat-select formControlName="severity">
                <mat-option [value]="null">{{ 'common.none' | transloco }}</mat-option>
                @for (option of severityOptions; track option.key) {
                  <mat-option [value]="option.key" [matTooltip]="option.tooltip">
                    {{ option.label }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" floatLabel="always" class="score-field">
              <mat-label>{{ 'common.score' | transloco }}</mat-label>
              <input matInput type="number" formControlName="score" min="0" max="10" step="0.1" />
            </mat-form-field>

            <mat-form-field appearance="outline" floatLabel="always" class="priority-field">
              <mat-label>{{ 'common.priority' | transloco }}</mat-label>
              <mat-select formControlName="priority">
                <mat-option [value]="null">{{ 'common.none' | transloco }}</mat-option>
                @for (option of priorityOptions; track option.key) {
                  <mat-option [value]="option.key" [matTooltip]="option.tooltip">
                    {{ option.label }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            @if (threatForm.get('ssvc')?.value; as ssvc) {
              <mat-chip-set class="ssvc-chip-set inline-ssvc">
                <mat-chip
                  [removable]="canEdit"
                  (removed)="removeSsvcEntry()"
                  (click)="canEdit ? editSsvcEntry() : null"
                  [class.clickable]="canEdit"
                  [class]="getSsvcDecisionClass()"
                  [matTooltip]="ssvc.vector"
                >
                  SSVC: {{ 'ssvcCalculator.decisions.' + ssvc.decision | transloco }}
                  @if (canEdit) {
                    <button matChipRemove [attr.aria-label]="'Remove SSVC entry'">
                      <mat-icon>cancel</mat-icon>
                    </button>
                  }
                </mat-chip>
              </mat-chip-set>
            } @else if (canEdit) {
              <button
                mat-stroked-button
                color="primary"
                (click)="openSsvcCalculator()"
                class="ssvc-calculator-button"
              >
                <mat-icon>add</mat-icon>
                {{ 'ssvcCalculator.openCalculator' | transloco }}
              </button>
            }
          </div>

          <!-- Threat Type + CWE row -->
          <div class="mappings-row">
            <!-- Threat Type column -->
            <div class="mapping-column">
              <mat-label class="mapping-label">{{ 'threatEditor.frameworkMappings' | transloco }}</mat-label>
              <mat-form-field appearance="outline" class="full-width" floatLabel="always">
                <mat-label>{{ 'common.threatType' | transloco }}</mat-label>
                <mat-select formControlName="threat_type" multiple>
                  <mat-option *ngFor="let threatType of threatTypeOptions" [value]="threatType">
                    {{ threatType }}
                  </mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <!-- CWE column -->
            <div class="mapping-column">
              <mat-label class="mapping-label">{{ 'threatEditor.cweMappings' | transloco }}</mat-label>
              <div class="cwe-input-row">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-chip-grid #cweChipGrid>
                    @for (cweId of threatForm.get('cwe_id')?.value; track cweId) {
                      <mat-chip-row
                        (removed)="canEdit ? removeCweId(cweId) : null"
                        [removable]="canEdit"
                      >
                        {{ cweId }}
                        @if (canEdit) {
                          <button matChipRemove [attr.aria-label]="'Remove ' + cweId">
                            <mat-icon>cancel</mat-icon>
                          </button>
                        }
                      </mat-chip-row>
                    }
                  </mat-chip-grid>
                  @if (canEdit) {
                    <input
                      [placeholder]="'threatEditor.cweIdPlaceholder' | transloco"
                      [matChipInputFor]="cweChipGrid"
                      [matChipInputSeparatorKeyCodes]="separatorKeysCodes"
                      (matChipInputTokenEnd)="addCweId($event)"
                    />
                  }
                </mat-form-field>
                @if (canEdit) {
                  <button
                    mat-stroked-button
                    color="primary"
                    (click)="openCwePicker()"
                    class="cwe-picker-button"
                    [matTooltip]="'cwePicker.chooseCwe' | transloco"
                  >
                    <mat-icon>add</mat-icon>
                    {{ 'cwePicker.addCwe' | transloco }}
                  </button>
                }
              </div>
            </div>
          </div>

          <!-- CVSS Entries -->
          <div class="cvss-section">
            <mat-label class="section-label">{{ 'threatEditor.cvss' | transloco }}</mat-label>

            @if (threatForm.get('cvss')?.value?.length > 0) {
              <mat-chip-set class="cvss-chip-set">
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
            }

            @if (canEdit) {
              <div class="cvss-input-row">
                <mat-form-field
                  appearance="outline"
                  class="cvss-vector-input"
                  subscriptSizing="dynamic"
                >
                  <input
                    matInput
                    [placeholder]="'cvssCalculator.vectorPlaceholder' | transloco"
                    [formControl]="cvssVectorControl"
                    (keydown.enter)="$event.preventDefault(); addCvssFromVector()"
                  />
                  @if (cvssVectorControl.hasError('invalidVector')) {
                    <mat-error>{{ 'cvssCalculator.vectorInvalid' | transloco }}</mat-error>
                  } @else if (cvssVectorControl.hasError('duplicateVersion')) {
                    <mat-error>{{ 'cvssCalculator.vectorDuplicateVersion' | transloco }}</mat-error>
                  } @else if (cvssVectorControl.hasError('unsupportedVersion')) {
                    <mat-error>{{ 'cvssCalculator.vectorUnsupportedVersion' | transloco }}</mat-error>
                  }
                </mat-form-field>
                <button
                  mat-stroked-button
                  color="primary"
                  (click)="openCvssCalculator()"
                  [disabled]="!canAddCvss"
                  class="cvss-calculator-button"
                >
                  <mat-icon>add</mat-icon>
                  {{ 'cvssCalculator.openCalculator' | transloco }}
                </button>
              </div>
            }
          </div>
        </div>

        <!-- ── Mitigation ────────────────────────────────────── -->
        <div class="form-section">
          <div class="section-header">
            <span class="section-label-text">{{ 'threatEditor.sections.mitigation' | transloco }}</span>
            <mat-divider></mat-divider>
          </div>

          <div class="form-field-container">
            <mat-form-field appearance="outline" class="full-width" floatLabel="always">
              <mat-label>{{ 'common.mitigation' | transloco }}</mat-label>
              <textarea
                matInput
                formControlName="mitigation"
                rows="3"
                [placeholder]="'common.mitigationPlaceholder' | transloco"
              ></textarea>
              @if (threatForm.get('mitigation')?.hasError('maxlength')) {
                <mat-error>
                  {{ 'common.validation.maxLength' | transloco: { max: 1024 } }}
                </mat-error>
              }
            </mat-form-field>
          </div>
        </div>

        <!-- ── Diagram References ────────────────────────────── -->
        <div class="form-section">
          <div class="section-header">
            <span class="section-label-text">{{ 'threatEditor.sections.diagramReferences' | transloco }}</span>
            <mat-divider></mat-divider>
          </div>

          <div class="form-field-row two-columns">
            <mat-form-field appearance="outline" class="full-width" floatLabel="always">
              <mat-label>{{ 'common.diagramId' | transloco }}</mat-label>
              <mat-select formControlName="diagram_id">
                <mat-option *ngFor="let diagram of diagramOptions" [value]="diagram.id">
                  {{
                    diagram.id === NOT_ASSOCIATED_VALUE
                      ? diagram.name
                      : diagram.name + ' (' + diagram.id + ')'
                  }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width" floatLabel="always">
              <mat-label>{{ 'common.cellId' | transloco }}</mat-label>
              <mat-select formControlName="cell_id">
                <mat-option *ngFor="let cell of cellOptions" [value]="cell.id">
                  {{
                    cell.id === NOT_ASSOCIATED_VALUE ? cell.label : cell.label + ' (' + cell.id + ')'
                  }}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
      </form>
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/components/threat-page/threat-page.component.html
git commit -m "style(threat-page): reorganize form into labeled sections"
```

---

### Task 3: Add Section and Mapping Row Styles

**Files:**
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.scss`

- [ ] **Step 1: Add section header styles**

In `threat-page.component.scss`, add after the `.threat-form` block (after line 92):

```scss
// Form sections with divider headers
.form-section {
  margin-bottom: 8px;
}

.section-header {
  margin: 24px 0 12px;

  .section-label-text {
    display: block;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--mat-sys-on-surface-variant);
    margin-bottom: 4px;
  }
}

// First section needs no top margin
.form-section:first-child .section-header {
  margin-top: 0;
}
```

- [ ] **Step 2: Add mappings row styles**

Replace the existing `.chip-input-section` block (lines 261-291) with styles for the new mappings row and CWE input:

```scss
// Threat Type + CWE mappings row
.mappings-row {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  margin-bottom: 4px;

  .mapping-column {
    flex: 1;
    min-width: 0;
  }

  .mapping-label {
    display: block;
    font-size: 13px;
    color: var(--mat-sys-on-surface-variant);
    margin-bottom: 8px;
  }
}

.cwe-input-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;

  mat-form-field {
    flex: 1;
    margin-bottom: 0;
  }

  .cwe-picker-button {
    // Vertically center with the outline form field input area
    margin-top: 10px;
    white-space: nowrap;
  }
}
```

- [ ] **Step 3: Update responsive breakpoints**

In the `@media (width <= 800px)` block, add:

```scss
  .mappings-row {
    flex-wrap: wrap;
  }
```

In the `@media (width <= 600px)` block, add:

```scss
  .mappings-row {
    flex-direction: column;
  }
```

- [ ] **Step 4: Run lint**

Run: `pnpm run lint:all`
Expected: No errors

- [ ] **Step 5: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/tm/components/threat-page/threat-page.component.scss
git commit -m "style(threat-page): add section divider and mappings row styles"
```

---

### Task 4: Localization Backfill

**Files:**
- Modify: All locale files in `src/assets/i18n/` (except `en-US.json`)

- [ ] **Step 1: Run the localization backfill command**

Run: `/localization-backfill`

This will add the new `threatEditor.sections.*`, `threatEditor.frameworkMappings`, `threatEditor.cweMappings`, and `cwePicker.addCwe` keys to all non-English locale files.

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/
git commit -m "chore(i18n): backfill threat form section header translations"
```

---

### Task 5: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

Run: `pnpm run lint:all`
Expected: No errors. Fix any that appear.

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Run SSVC tests (regression check)**

Run: `pnpm vitest run --environment node src/app/pages/tm/components/ssvc-calculator-dialog/`
Expected: All 40 tests pass.

- [ ] **Step 4: Commit any fixes**

Only if fixes were needed:

```bash
git add -A
git commit -m "fix(threat-page): address lint issues from form reorganization"
```
