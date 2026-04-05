# TM-Edit Field Organization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the tm-edit details card into three semantic groups (Identity card, Review Process panel, Audit panel) using expansion panels.

**Architecture:** The existing single `<mat-card>` keeps only Identity fields (Name, Description, Project). Two `<mat-expansion-panel>`s inside a `<mat-accordion>` replace the two-column grid for Review Process and Audit fields. Collapsed states show key summary info. `MatExpansionModule` is already available via `DATA_MATERIAL_IMPORTS`.

**Tech Stack:** Angular, Angular Material (mat-expansion-panel, mat-accordion), Transloco i18n, SCSS

---

## Chunk 1: i18n Keys and Template Restructuring

### Task 1: Add i18n keys for panel headers

**Files:**
- Modify: `src/assets/i18n/en-US.json` (line ~1414, `threatModels.sections`)

- [ ] **Step 1: Add English i18n keys**

In `src/assets/i18n/en-US.json`, add these four keys to the **existing** `threatModels.sections` object (which already contains `inputs`, `inputsDescription`, `outputs`, `outputsDescription`, and their `.comment` keys — do NOT overwrite those):

```json
"reviewProcess": "Review Process",
"reviewProcess.comment": "Section heading for the review process panel containing status, reviewer, framework, and issue URI",
"audit": "Audit",
"audit.comment": "Section heading for the audit panel containing ID, creator, and timestamps"
```

- [ ] **Step 2: Backfill translations to all locale files**

Use the localization-backfill skill (`/localization-backfill`) to add the four new keys (`threatModels.sections.reviewProcess`, `threatModels.sections.reviewProcess.comment`, `threatModels.sections.audit`, `threatModels.sections.audit.comment`) to all 16 locale files. The skill handles translation and formatting.

- [ ] **Step 3: Verify i18n consistency**

Run: `pnpm run check-i18n`
Expected: No errors for missing keys across locales.

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n/*.json
git commit -m "feat: add i18n keys for review process and audit panel headers (#488)"
```

---

### Task 2: Restructure Identity card template

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html` (lines 25-376)

- [ ] **Step 1: Move Project picker into Identity card**

In `src/app/pages/tm/tm-edit.component.html`, move the Project picker block (currently lines 229-242, inside `.details-pickers`) to after the Description field (after line 121), inside the `.details-name-description` div. The Project picker markup stays the same — just its location changes.

The moved block:

```html
<!-- Project -->
<div>
  @if (canEdit) {
    <app-project-picker
      [projectId]="threatModel.project_id ?? null"
      (projectChange)="onProjectChange($event)"
    />
  } @else {
    <div class="readonly-field">
      <span class="info-label">{{ 'common.project' | transloco }}:</span>
      <span class="info-value">{{ projectName || '—' }}</span>
    </div>
  }
</div>
```

- [ ] **Step 2: Remove the two-column grid**

Delete the entire `<div class="details-columns">` block (lines 124-306 after the previous edit adjustments). This removes:
- The `.details-columns` wrapper
- The `.details-pickers` div (Status, Security Reviewer — these move to Task 3)
- The `.details-metadata` div (all five metadata fields — these move to Tasks 3 and 4)

Do NOT delete the `<form>` block with Framework and Issue URI yet — that moves in Task 3.

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: Build succeeds. The page will be missing the Process and Audit fields until Tasks 3-4, but should compile without errors since the data bindings are removed with their template blocks.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "refactor: restructure identity card, remove two-column grid (#488)"
```

---

### Task 3: Add Review Process expansion panel

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html`

- [ ] **Step 1: Add the accordion and Review Process panel**

After the `</mat-card>` closing tag of the Identity card (after the details card's `</mat-card>`), and before the Inputs section, add:

```html
<!-- Review Process and Audit panels -->
<mat-accordion multi>
  <!-- Review Process Panel -->
  <mat-expansion-panel class="review-process-panel">
    <mat-expansion-panel-header>
      <mat-panel-title>{{ 'threatModels.sections.reviewProcess' | transloco }}</mat-panel-title>
      <mat-panel-description class="panel-summary">
        <span class="summary-item">
          <span class="summary-label">{{ 'common.status' | transloco }}:</span>
          @if (
            threatModelForm.get('status')?.value &&
            threatModelForm.get('status')?.value !== 'none'
          ) {
            <span class="summary-value">{{
              'threatModels.status.' + threatModelForm.get('status')?.value | transloco
            }}</span>
          } @else {
            <span class="summary-value">—</span>
          }
        </span>
        <span class="summary-item">
          <span class="summary-label">{{ 'threatModels.statusLastUpdated' | transloco }}:</span>
          <span>{{
            threatModel.status_updated
              ? (threatModel.status_updated | date: 'short' : undefined : currentLocale)
              : '—'
          }}</span>
        </span>
        <span class="summary-item">
          <span class="summary-label">{{ 'threatModels.securityReviewer' | transloco }}:</span>
          @if (threatModel.security_reviewer) {
            <span class="summary-value">{{
              threatModel.security_reviewer.display_name || threatModel.security_reviewer.email
            }}</span>
          } @else {
            <span class="summary-value">—</span>
          }
        </span>
      </mat-panel-description>
    </mat-expansion-panel-header>

    <!-- Panel body: 2fr 1fr grid -->
    <div class="process-grid" [dir]="currentDirection">
      <!-- Row 1: Status + Status Last Updated -->
      <div [formGroup]="threatModelForm">
        @if (canEdit) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'common.status' | transloco }}</mat-label>
            <mat-select formControlName="status">
              <mat-option [value]="null">{{ 'common.none' | transloco }}</mat-option>
              @for (option of statusOptions; track option.key) {
                <mat-option
                  [value]="option.key"
                  [matTooltip]="
                    'threatModels.status.' + option.key + '.tooltip' | transloco
                  "
                >
                  {{ 'threatModels.status.' + option.key | transloco }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        } @else {
          <div class="readonly-field">
            <span class="info-label">{{ 'common.status' | transloco }}:</span>
            @if (
              threatModelForm.get('status')?.value &&
              threatModelForm.get('status')?.value !== 'none'
            ) {
              <span class="info-value">{{
                'threatModels.status.' + threatModelForm.get('status')?.value | transloco
              }}</span>
            } @else {
              <span class="info-value">—</span>
            }
          </div>
        }
      </div>
      <div class="metadata-field">
        <span class="info-label">{{ 'threatModels.statusLastUpdated' | transloco }}:</span>
        <span class="info-value">{{
          threatModel.status_updated
            ? (threatModel.status_updated | date: 'short' : undefined : currentLocale)
            : '—'
        }}</span>
      </div>

      <!-- Row 2: Security Reviewer + empty -->
      <div>
        @if (canEdit && securityReviewerMode === 'dropdown') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'threatModels.securityReviewer' | transloco }}</mat-label>
            <mat-select
              [value]="threatModel.security_reviewer"
              [compareWith]="compareReviewers"
              (selectionChange)="onSecurityReviewerChange($event)"
            >
              <mat-option [value]="null">{{ 'common.none' | transloco }}</mat-option>
              @for (reviewer of securityReviewerOptions; track reviewer.provider_id) {
                <mat-option [value]="reviewer">
                  {{ reviewer.display_name || reviewer.email }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        } @else if (canEdit && securityReviewerMode === 'picker') {
          <div class="readonly-field">
            <span class="info-label"
              >{{ 'threatModels.securityReviewer' | transloco }}:</span
            >
            @if (threatModel.security_reviewer) {
              <span class="info-value"
                ><app-user-display [user]="threatModel.security_reviewer"
              /></span>
            } @else {
              <span class="info-value">—</span>
            }
            <button
              mat-icon-button
              (click)="openSecurityReviewerPicker()"
              [matTooltip]="'threatModels.changeSecurityReviewer' | transloco"
              [attr.aria-label]="'threatModels.changeSecurityReviewer' | transloco"
            >
              <mat-icon>edit</mat-icon>
            </button>
            @if (threatModel.security_reviewer) {
              <button
                mat-icon-button
                (click)="clearSecurityReviewer()"
                [matTooltip]="'threatModels.clearSecurityReviewer' | transloco"
                [attr.aria-label]="'threatModels.clearSecurityReviewer' | transloco"
              >
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>
        } @else if (securityReviewerMode !== 'loading') {
          <div class="readonly-field">
            <span class="info-label"
              >{{ 'threatModels.securityReviewer' | transloco }}:</span
            >
            @if (threatModel.security_reviewer) {
              <span class="info-value"
                ><app-user-display [user]="threatModel.security_reviewer"
              /></span>
            } @else {
              <span class="info-value">—</span>
            }
          </div>
        }
      </div>
      <div></div>

      <!-- Row 3: Issue URI + Framework -->
      <div class="issue-uri-container" [formGroup]="threatModelForm">
        <mat-form-field appearance="outline" class="issue-uri-field">
          <mat-label [transloco]="'common.issueUri'">Issue URI</mat-label>
          <input
            matInput
            formControlName="issue_uri"
            type="url"
            tabindex="4"
            placeholder="https://example.com/issue/123"
          />
          <mat-hint>{{ 'threatModels.issueUriHint' | transloco }}</mat-hint>
          @if (threatModelForm.get('issue_uri')?.hasError('url')) {
            <mat-error>
              {{ 'common.validation.invalidUrl' | transloco }}
            </mat-error>
          }
        </mat-form-field>
        <button
          mat-icon-button
          type="button"
          class="issue-uri-icon-button"
          [disabled]="!isValidUrl(threatModelForm.get('issue_uri')?.value)"
          (click)="openUriInNewTab(threatModelForm.get('issue_uri')?.value)"
          [matTooltip]="
            isValidUrl(threatModelForm.get('issue_uri')?.value)
              ? threatModelForm.get('issue_uri')?.value
              : 'Enter a valid URI to open'
          "
          matTooltipPosition="above"
          tabindex="5"
          [attr.aria-label]="'common.openInNewTab' | transloco"
        >
          <mat-icon fontSet="material-symbols-outlined">open_in_new</mat-icon>
        </button>
      </div>
      <div [formGroup]="threatModelForm">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'threatModels.threatModelFramework'"
            >Threat Model Framework</mat-label
          >
          <mat-select
            formControlName="threat_model_framework"
            tabindex="3"
            [attr.aria-label]="'threatModels.threatModelFramework' | transloco"
            (selectionChange)="onFrameworkChange($event)"
          >
            @for (framework of frameworks; track framework.name) {
              <mat-option [value]="framework.name">
                {{ framework.name }}
              </mat-option>
            }
          </mat-select>
          @if (hasThreats()) {
            <mat-hint>
              {{ 'threatModels.frameworkDisabledHint' | transloco }}
            </mat-hint>
          }
          @if (threatModelForm.get('threat_model_framework')?.hasError('required')) {
            <mat-error>
              {{ 'common.validation.required' | transloco }}
            </mat-error>
          }
        </mat-form-field>
      </div>
    </div>
  </mat-expansion-panel>
```

Note: The `</mat-accordion>` closing tag is NOT added yet — it will close after the Audit panel in Task 4.

- [ ] **Step 2: Remove the old Framework/Issue URI form block**

Delete the `<form [formGroup]="threatModelForm" class="threat-model-form">` block that previously held Framework and Issue URI (the block right before `</mat-card-content>`). These fields are now inside the Review Process panel. The `</mat-card-content>` and `</mat-card>` closing tags for the Identity card should remain.

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: Build succeeds. Audit fields are still missing (added in Task 4).

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "feat: add review process expansion panel (#488)"
```

---

### Task 4: Add Audit expansion panel

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html`

- [ ] **Step 1: Add the Audit panel and close the accordion**

Immediately after the `</mat-expansion-panel>` closing tag of the Review Process panel, add:

```html
  <!-- Audit Panel -->
  <mat-expansion-panel class="audit-panel">
    <mat-expansion-panel-header>
      <mat-panel-title>{{ 'threatModels.sections.audit' | transloco }}</mat-panel-title>
      <mat-panel-description class="panel-summary">
        <span class="summary-item">
          <span class="summary-label">{{ 'common.lastModified' | transloco }}:</span>
          <span>{{
            !isNewThreatModel && threatModel.modified_at
              ? (threatModel.modified_at | date: 'short' : undefined : currentLocale)
              : '—'
          }}</span>
        </span>
      </mat-panel-description>
    </mat-expansion-panel-header>

    <!-- Panel body: 2fr 1fr grid -->
    <div class="audit-grid" [dir]="currentDirection">
      <!-- Row 1: ID + Last Modified -->
      <div class="metadata-field">
        <span class="info-label">{{ 'threatModels.idLabel' | transloco }}:</span>
        <span class="info-value metadata-id">{{ threatModel.id || '—' }}</span>
        @if (threatModel.id) {
          <button
            mat-icon-button
            class="copy-id-button"
            (click)="copyThreatModelId()"
            [matTooltip]="'common.copyToClipboard' | transloco"
            [attr.aria-label]="'common.copyToClipboard' | transloco"
          >
            <mat-icon>content_copy</mat-icon>
          </button>
        }
      </div>
      <div class="metadata-field">
        <span class="info-label">{{ 'common.lastModified' | transloco }}:</span>
        <span class="info-value">{{
          !isNewThreatModel && threatModel.modified_at
            ? (threatModel.modified_at | date: 'short' : undefined : currentLocale)
            : '—'
        }}</span>
      </div>

      <!-- Row 2: Created By + Created -->
      <div class="metadata-field">
        <span class="info-label">{{ 'threatModels.createdBy' | transloco }}:</span>
        @if (threatModel.created_by) {
          <span class="info-value"
            ><app-user-display [user]="threatModel.created_by"
          /></span>
        } @else {
          <span class="info-value">—</span>
        }
      </div>
      <div class="metadata-field">
        <span class="info-label">{{ 'threatModels.created' | transloco }}:</span>
        <span class="info-value">{{
          !isNewThreatModel && threatModel.created_at
            ? (threatModel.created_at | date: 'short' : undefined : currentLocale)
            : '—'
        }}</span>
      </div>
    </div>
  </mat-expansion-panel>
</mat-accordion>
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Build succeeds. All fields are now present in the template.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "feat: add audit expansion panel (#488)"
```

---

## Chunk 2: Styling and Cleanup

### Task 5: Update SCSS styles

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.scss`

- [ ] **Step 1: Remove obsolete styles**

Remove these class definitions from `tm-edit.component.scss`:
- `.details-columns` (lines 293-305) — the two-column grid wrapper
- `.details-pickers` (lines 307-316) — the left column
- `.details-metadata` (lines 318-324) — the right column
- `.threat-model-form` (lines 264-268) — the old form wrapper
- `.form-fields-row` (lines 270-279) — the old framework/issue URI grid

Also update the comment on line 285 from `// Name and Description fields above the two-column layout` to `// Name, Description, and Project fields`.

- [ ] **Step 2: Add new panel and grid styles**

Add the following styles to `tm-edit.component.scss`:

```scss
// Review Process and Audit expansion panels
.review-process-panel,
.audit-panel {
  margin-top: 8px;
}

.audit-panel {
  background-color: var(--theme-surface, var(--color-background-secondary));
}

// Collapsed panel summary
.panel-summary {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--theme-text-secondary, var(--color-text-secondary));
  flex-wrap: wrap;
  align-items: center;
}

.summary-item {
  display: flex;
  gap: 4px;
  align-items: center;
}

.summary-label {
  font-weight: 500;
}

.summary-value {
  color: var(--theme-text-primary, var(--color-text-primary));
}

// Expanded panel grids
.process-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 8px 16px;
  align-items: start;

  mat-form-field {
    width: 100%;
  }

  @media (width < 768px) {
    grid-template-columns: 1fr;
  }
}

// Audit grid stays 2-column on mobile — content is compact enough (per spec)
.audit-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 4px 16px;
  font-size: 12px;
  color: var(--theme-text-secondary, var(--color-text-secondary));
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.scss
git commit -m "refactor: update styles for expansion panel layout (#488)"
```

---

### Task 6: Lint, build, and final verification

**Files:**
- All modified files

- [ ] **Step 1: Run linter**

Run: `pnpm run lint:all`
Expected: No lint errors. Fix any that arise.

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: Clean build with no errors or warnings.

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 4: Commit any lint fixes**

If lint fixes were needed:
```bash
git add src/app/pages/tm/tm-edit.component.html src/app/pages/tm/tm-edit.component.scss
git commit -m "style: lint fixes for tm-edit field organization (#488)"
```
