# E2E Phase 1: Threat Model Deep Coverage — Design Spec

**Issue:** [#575](https://github.com/ericfitz/tmi-ux/issues/575)
**Parent spec:** `docs/superpowers/specs/2026-04-10-e2e-comprehensive-test-plan-design.md` (Phase 1 section)
**Branch:** `dev/1.4.0`
**Estimated tests:** ~77 (16 workflow + 46 field coverage + 15 visual regression)

## Overview

Fill out complete E2E coverage for the threat model area — workflows, all child entities, scoring systems, schema-driven field validation, and visual regression with screenshot baselines. This is the first vertical slice after Phase 0 and validates all Phase 0 infrastructure patterns.

## Structure

Phase 1 decomposes into three sequential sub-phases:

| Sub-phase | Tests | Playwright project | Dependencies |
|-----------|-------|--------------------|--------------|
| 1A: Infrastructure + Workflows | ~16 | `workflows` | Phase 0 complete |
| 1B: Schema-Driven Field Coverage | ~46 | `field-coverage` | 1A (needs `data-testid` attrs + page objects) |
| 1C: Visual Regression | ~15 | `visual-regression` | 1A (needs `data-testid` attrs + page objects) |

1A must complete first. 1B and 1C are independent of each other.

---

## Sub-phase 1A: Infrastructure + Workflow Tests

### New `data-testid` Attributes

The following components currently lack `data-testid` attributes and need them added before E2E tests can target their elements reliably.

**create-threat-model-dialog.component.ts** (inline template) — the CreateTmDialog already has `create-tm-name-input` and `create-tm-submit` but needs:

| Attribute | Element |
|-----------|---------|
| `create-tm-description-input` | Description textarea |
| `create-tm-framework-select` | Framework dropdown |
| `create-tm-confidential-toggle` | Confidential slide toggle |

**tm-edit.component.html** — child entity add buttons and rows:

| Attribute | Element |
|-----------|---------|
| `add-asset-button` | Asset section add button |
| `asset-row` | Asset table rows |
| `add-document-button` | Document section add button |
| `document-row` | Document table rows |
| `add-repository-button` | Repository section add button |
| `repository-row` | Repository table rows |
| `add-note-button` | Note section add button |
| `note-row` | Note table rows |
| `tm-metadata-button` | TM metadata kebab menu item |
| `tm-permissions-button` | TM permissions kebab menu item |
| `tm-export-button` | TM export kebab menu item |
| `tm-framework-select` | Framework dropdown |
| `tm-confidential-badge` | Confidential project badge |

**asset-editor-dialog.component.html:**

| Attribute | Element |
|-----------|---------|
| `asset-name-input` | Name input |
| `asset-description-input` | Description textarea |
| `asset-type-select` | Type dropdown |
| `asset-criticality-input` | Criticality input |
| `asset-classification-chips` | Classification chip grid |
| `asset-sensitivity-input` | Sensitivity input |
| `asset-include-report-checkbox` | Include in Report checkbox |
| `asset-timmy-checkbox` | Include in Timmy Chat checkbox |
| `asset-save-button` | Save/Create button |
| `asset-cancel-button` | Cancel/Close button |

**document-editor-dialog.component.html:**

| Attribute | Element |
|-----------|---------|
| `document-name-input` | Name input |
| `document-uri-input` | URI input |
| `document-description-input` | Description textarea |
| `document-include-report-checkbox` | Include in Report checkbox |
| `document-timmy-checkbox` | Include in Timmy Chat checkbox |
| `document-save-button` | Save/Create button |
| `document-cancel-button` | Cancel/Close button |

**repository-editor-dialog.component.html:**

| Attribute | Element |
|-----------|---------|
| `repository-name-input` | Name input |
| `repository-description-input` | Description textarea |
| `repository-type-select` | Type dropdown |
| `repository-uri-input` | URI input |
| `repository-ref-type-select` | Ref type dropdown |
| `repository-ref-value-input` | Ref value input |
| `repository-sub-path-input` | Sub path input |
| `repository-include-report-checkbox` | Include in Report checkbox |
| `repository-timmy-checkbox` | Include in Timmy Chat checkbox |
| `repository-save-button` | Save/Create button |
| `repository-cancel-button` | Cancel/Close button |

**note-page.component.html:**

| Attribute | Element |
|-----------|---------|
| `note-name-input` | Name input |
| `note-description-input` | Description input |
| `note-content-textarea` | Content textarea |
| `note-include-report-checkbox` | Include in Report checkbox |
| `note-timmy-checkbox` | Include in Timmy Chat checkbox |
| `note-save-button` | Save action button |
| `note-delete-button` | Delete menu item |
| `note-metadata-button` | Metadata action button |
| `note-close-button` | Close action button |

**metadata-dialog.component.html:**

| Attribute | Element |
|-----------|---------|
| `metadata-add-button` | Add metadata button |
| `metadata-save-button` | Save button |
| `metadata-cancel-button` | Cancel button |
| `metadata-key-input` | Key input (per row) |
| `metadata-value-input` | Value input (per row) |
| `metadata-delete-button` | Delete button (per row) |

**permissions-dialog.component.ts** (inline template):

| Attribute | Element |
|-----------|---------|
| `permissions-add-button` | Add permission button |
| `permissions-save-button` | Save button |
| `permissions-cancel-button` | Cancel button |
| `permissions-type-select` | Principal type select (per row) |
| `permissions-provider-select` | Provider select (per row) |
| `permissions-subject-input` | Subject input (per row) |
| `permissions-role-select` | Role select (per row) |
| `permissions-delete-button` | Delete button (per row) |
| `permissions-set-owner-button` | Set as owner button (per row) |

**ssvc-calculator-dialog.component.html:**

| Attribute | Element |
|-----------|---------|
| `ssvc-step-dot` | Step indicator dot (per step) |
| `ssvc-value-card` | Value option card (per option) |
| `ssvc-back-button` | Back button |
| `ssvc-next-button` | Next button |
| `ssvc-cancel-button` | Cancel button |
| `ssvc-apply-button` | Apply button |
| `ssvc-decision-badge` | Decision result badge |
| `ssvc-summary-row` | Summary row (per decision point) |

**export-dialog.component.html:**

| Attribute | Element |
|-----------|---------|
| `export-save-button` | Save/download button |
| `export-cancel-button` | Cancel button |
| `export-retry-button` | Retry button (error state) |
| `export-status` | Status container (for state detection) |

**framework-mapping-picker-dialog.component.html:**

| Attribute | Element |
|-----------|---------|
| `framework-mapping-checkbox` | Framework type checkbox (per type) |
| `framework-mapping-save-button` | Save button |
| `framework-mapping-cancel-button` | Cancel button |

### New Page Objects

| File | Locators |
|------|----------|
| `e2e/pages/note-page.page.ts` | `nameInput()`, `descriptionInput()`, `contentTextarea()`, `includeReportCheckbox()`, `timmyCheckbox()`, `saveButton()`, `deleteButton()`, `metadataButton()`, `closeButton()` |

### New Dialog Objects

| File | Key Locators |
|------|--------------|
| `e2e/dialogs/asset-editor.dialog.ts` | `nameInput()`, `descriptionInput()`, `typeSelect()`, `criticalityInput()`, `classificationChips()`, `sensitivityInput()`, `includeReportCheckbox()`, `timmyCheckbox()`, `saveButton()`, `cancelButton()` |
| `e2e/dialogs/document-editor.dialog.ts` | `nameInput()`, `uriInput()`, `descriptionInput()`, `includeReportCheckbox()`, `timmyCheckbox()`, `saveButton()`, `cancelButton()` |
| `e2e/dialogs/repository-editor.dialog.ts` | `nameInput()`, `descriptionInput()`, `typeSelect()`, `uriInput()`, `refTypeSelect()`, `refValueInput()`, `subPathInput()`, `includeReportCheckbox()`, `timmyCheckbox()`, `saveButton()`, `cancelButton()` |
| `e2e/dialogs/metadata.dialog.ts` | `addButton()`, `saveButton()`, `cancelButton()`, `keyInput(index)`, `valueInput(index)`, `deleteButton(index)`, `rows()` |
| `e2e/dialogs/permissions.dialog.ts` | `addButton()`, `saveButton()`, `cancelButton()`, `typeSelect(index)`, `providerSelect(index)`, `subjectInput(index)`, `roleSelect(index)`, `deleteButton(index)`, `setOwnerButton(index)`, `rows()` |
| `e2e/dialogs/ssvc-calculator.dialog.ts` | `stepDot(index)`, `valueCard(name)`, `backButton()`, `nextButton()`, `cancelButton()`, `applyButton()`, `decisionBadge()`, `summaryRow(index)` |
| `e2e/dialogs/export.dialog.ts` | `saveButton()`, `cancelButton()`, `retryButton()`, `status()` |
| `e2e/dialogs/framework-mapping-picker.dialog.ts` | `checkbox(type)`, `saveButton()`, `cancelButton()` |

### New Flows

| File | Methods |
|------|---------|
| `e2e/flows/asset.flow.ts` | `createFromTmEdit(fields: {name, type?, criticality?, classification?, sensitivity?})`, `editFromTmEdit(name, updates)`, `deleteFromTmEdit(name)` |
| `e2e/flows/document.flow.ts` | `createFromTmEdit(fields: {name, uri, description?})`, `editFromTmEdit(name, updates)`, `deleteFromTmEdit(name)` |
| `e2e/flows/repository.flow.ts` | `createFromTmEdit(fields: {name, type, uri, refType?, refValue?, subPath?})`, `editFromTmEdit(name, updates)`, `deleteFromTmEdit(name)` |
| `e2e/flows/note.flow.ts` | `createFromTmEdit(name)`, `openFromTmEdit(name)`, `editNote(fields: {name?, description?, content?})`, `deleteNote()` |
| `e2e/flows/metadata.flow.ts` | `addEntry(key, value)`, `editEntry(index, key?, value?)`, `deleteEntry(index)`, `saveAndClose()` |
| `e2e/flows/permissions.flow.ts` | `addPermission(type, provider, subject, role)`, `deletePermission(index)`, `setOwner(index)`, `saveAndClose()` |
| `e2e/flows/scoring.flow.ts` | `scoreSsvc(selections: string[])`, `addFrameworkMapping(types: string[])`, `removeFrameworkMapping(type)` |

### Fixture Updates

Register all new page objects, dialog objects, and flows in `e2e/fixtures/test-fixtures.ts` so they are available as Playwright fixtures.

### Workflow Test Specs

#### `e2e/tests/workflows/tm-workflows.spec.ts`

| # | Test | Fixture | Steps |
|---|------|---------|-------|
| 1 | Reviewer edits assigned TM | `reviewerTest` | Login as reviewer → open seeded "Full Fields" TM → edit threat status → add a note → save → verify changes persisted |
| 2 | Owner shares TM with reviewer | `multiRoleTest` | User creates TM → opens permissions → adds reviewer as writer → saves → reviewer opens TM → edits description → user reloads → sees change |
| 3 | Project association + dashboard filter | `userTest` | Create TM → link to "Seed Project One" → go to dashboard → filter by project → verify TM appears |
| 4 | Framework selection (STRIDE) | `userTest` | Create TM with STRIDE framework → open → verify framework shows STRIDE → add threat → verify threat type options include STRIDE categories |
| 5 | Confidential TM visibility | `multiRoleTest` | User creates TM with `is_confidential: true` → reviewer navigates to dashboard → TM not visible → user adds reviewer as reader via permissions → reviewer reloads → TM now visible |
| 6 | Export dialog | `userTest` | Open seeded TM → kebab menu → export → verify dialog shows loading → ready state → cancel |

Notes:
- `is_confidential` is write-once at creation time. The CreateTmDialog must support setting it. Verify the seeded TM's confidential badge displays correctly.
- Test 2 (cross-role sharing) requires `multiRoleTest` fixture for two browser contexts.
- Test 5 also requires `multiRoleTest`. The reviewer is a security reviewer but NOT a "confidential reviewer" — they cannot see confidential TMs unless explicitly granted authorization.

#### `e2e/tests/workflows/child-entity-crud.spec.ts`

Serial suite. Creates a test TM in `beforeAll`, cleans up in `afterAll`.

| # | Test | Steps |
|---|------|-------|
| 1 | Asset CRUD | Create asset (name, type=data, criticality=high, classification=[confidential, pii], sensitivity=high) → verify in table → click to edit → change name → save → verify updated → delete → verify removed |
| 2 | Document CRUD | Create document (name, URI=https://example.com/doc.pdf, description) → verify in table → edit description → save → verify → delete |
| 3 | Repository CRUD | Create repository (name, type=git, URI=https://github.com/example/repo, ref_type=branch, ref_value=main, subpath=src/) → verify in table → edit ref_value → save → verify → delete |
| 4 | Note CRUD | Create note (name) → navigate to note page → edit description + content (markdown) → save → verify persisted → navigate back → verify in table → delete from note page → verify removed from table |
| 5 | Metadata CRUD | Open seeded TM → open metadata dialog → add entry (key=test-key, value=test-value) → save → reopen → verify → edit value → save → reopen → verify → delete entry → save → verify empty |
| 6 | Permissions CRUD | Open seeded TM → open permissions dialog → add reader (user, tmi provider, test-user, reader) → save → reopen → verify → change role to writer → save → verify → delete → save → verify removed |

Notes:
- Asset classification uses chip input with comma/Enter separator keys.
- Note CRUD navigates to a separate page (`/tm/{id}/note/{id}`), unlike the other child entities which use dialogs.
- Metadata and permissions tests use the seeded TM to avoid creating a TM just for metadata testing.
- Each entity's delete uses the kebab menu → delete → "gone forever" confirmation pattern already established for diagrams/threats.

#### `e2e/tests/workflows/scoring-systems.spec.ts`

Serial suite. Creates a test TM + threat in `beforeAll`, cleans up in `afterAll`.

| # | Test | Steps |
|---|------|-------|
| 1 | SSVC calculator full workflow | Open threat → click SSVC → step through 4 decision points (Exploitation: Active, Technical Impact: Total, Utility: Automatable, Public Safety Impact: Significant) → verify summary → verify decision = "Act" → apply → verify persisted |
| 2 | Multiple CVSS scores | Open threat → add CVSS 3.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H = 9.8) → verify chip → add CVSS 4.0 → verify both chips → remove 3.1 chip → verify only 4.0 remains |
| 3 | Multiple CWE references | Open threat → add CWE-79 → verify chip → add CWE-352 → verify both chips → remove CWE-79 → verify only CWE-352 remains |
| 4 | Framework mappings | Open threat → add mapping (Spoofing + Tampering) → verify chips → remove Spoofing → verify only Tampering remains |

Notes:
- SSVC calculator is a multi-step wizard with 4 decision points. Navigation: select value card → next → repeat. Final step shows summary + decision badge.
- CVSS 3.1 and 4.0 have different metric sets. The test uses the existing `CvssCalculatorDialog` and `ThreatFlow.scoreThreatWithCvss()` for 3.1, and adds a new interaction for 4.0.
- CWE removal: click the remove icon on the chip. Framework mapping removal: same chip removal pattern.

---

## Sub-phase 1B: Schema-Driven Field Coverage

### Field Interaction Utility

A thin mapping from `FieldDef.type` to Playwright actions, located at `e2e/helpers/field-interactions.ts`.

```
FieldDef.type    Verify                                  Edit
─────────────    ──────                                  ────
text             expect(locator).toHaveValue(expected)   locator.fill(newValue)
textarea         expect(locator).toHaveValue(expected)   locator.fill(newValue)
select           expect(locator).toContainText(expected) click select → click option
multiselect      verify chip text(s) present             click select → click additional option
checkbox/toggle  expect(locator).toBeChecked() or not    locator.click()
chips            verify chip text(s) present             type into chip input + Enter
```

Each test file calls this utility directly — no abstraction layer.

### Field Definition Updates

Before writing tests, `e2e/schema/field-definitions.json` must be updated to match the actual templates:

| Entity | Change | Reason |
|--------|--------|--------|
| Asset | Add `timmy_enabled` (checkbox) | Template has `formControlName="timmy_enabled"` |
| Asset | Change `criticality` type from `select` to `text` | Template uses `<input matInput>` not `<mat-select>` |
| Asset | Change `sensitivity` type from `select` to `text` | Template uses `<input matInput>` not `<mat-select>` |
| Document | Add `timmy_enabled` (checkbox) | Template has checkbox |
| Repository | Add `ref_type` (select: branch/tag/commit) | Template has `<mat-select formControlName="refType">` |
| Repository | Add `ref_value` (text) | Template has `<input matInput formControlName="refValue">` |
| Repository | Add `subpath` (text) | Template has `<input matInput formControlName="subPath">` |
| Repository | Add `timmy_enabled` (checkbox) | Template has checkbox |
| Note | Add `timmy_enabled` (checkbox) | Template has checkbox |
| Threat | Add `timmy_enabled` (checkbox) | Template has checkbox (verify) |
| ThreatModel | Set `owner` to `editable: false` | Owner is managed via permissions dialog, not directly editable |
| All entities | Update `uiSelector` values | Point to new `data-testid` attributes from 1A |

### Test Files

All in `e2e/tests/field-coverage/`. Each uses `userTest` fixture (owner/writer of seeded TM).

#### `tm-fields.spec.ts` (~11 parameterized tests)

- Navigate to seeded "Full Fields" TM edit page
- For each `THREAT_MODEL_FIELDS` entry: verify UI element exists, displays seeded value, can be edited (if editable), persists after save + reload
- Special cases:
  - `alias`: Chip input — verify seeded aliases display as chips, add a new alias, verify it appears
  - `metadata`: Skip (tested via MetadataDialog in 1A)
  - `is_confidential`: Display-only badge — verify badge visible on seeded TM if confidential, or absent if not
  - `owner`: Display-only — verify shows correct owner, no edit interaction

#### `threat-fields.spec.ts` (~15 parameterized tests)

- Navigate to seeded threat within seeded TM
- For each `THREAT_FIELDS` entry: verify + edit + persist cycle
- Special cases:
  - `cvss`: Display-only chips — verify seeded CVSS chip shows correct score. Edit tested in 1A scoring tests.
  - `cwe_id`: Display-only chips — verify seeded CWE chips. Edit tested in 1A.
  - `ssvc`: Display-only — verify value if set. Edit tested in 1A.
  - `threat_type`: Multiselect managed via framework mapping picker

#### `asset-fields.spec.ts` (~7 parameterized tests)

- Open seeded "Seed Asset - User Database" via edit dialog
- For each `ASSET_FIELDS` entry: verify field displays seeded value, edit, save, reopen, verify persisted
- Special cases:
  - `classification`: Chip input with COMMA/ENTER separator keys. Verify seeded chips (confidential, pii), add new chip, verify.

#### `document-fields.spec.ts` (~4 parameterized tests)

- Open seeded "Architecture Doc" via edit dialog
- Standard verify + edit + persist cycle for each field

#### `repository-fields.spec.ts` (~5 parameterized tests)

- Open seeded "Main Codebase" via edit dialog
- Standard cycle including nested parameter fields (ref_type, ref_value, subpath)

#### `note-fields.spec.ts` (~4 parameterized tests)

- Navigate to seeded "Review Notes" note page
- Standard cycle
- Special cases:
  - `content`: Markdown textarea in edit mode. Verify content displays, edit text, save, reload, verify. Preview mode is not part of field coverage (it's a UI feature, not a field).

### Total: ~46 parameterized field tests

---

## Sub-phase 1C: Visual Regression

### Screenshot Tests — `e2e/tests/visual-regression/tm-visual-regression.spec.ts`

Uses `userTest` fixture. Each test navigates independently and calls `takeThemeScreenshots()` from Phase 0 helpers. Baselines stored in `e2e/screenshots/visual-regression/`.

| # | Test name | Page | Masking |
|---|-----------|------|---------|
| 1 | Dashboard | `/dashboard` | Timestamps, collaboration indicators |
| 2 | TM edit page | `/tm/{id}` (seeded TM, all sections expanded) | Timestamps |
| 3 | Threat detail page | `/tm/{id}/threat/{id}` (seeded threat) | Timestamps |
| 4 | Asset editor dialog | Open seeded asset in edit dialog | None |
| 5 | Document editor dialog | Open seeded document in edit dialog | None |
| 6 | Repository editor dialog | Open seeded repository in edit dialog | None |
| 7 | Note page | Navigate to seeded note | Timestamps |

7 tests x 4 theme modes = 28 baseline screenshots.

### Translation + Icon Sweeps — `e2e/tests/visual-regression/tm-translation-icons.spec.ts`

Theme-independent (run once). Calls `assertNoMissingTranslations()` and `assertIconsRendered()` from Phase 0 helpers.

| # | Test name | Page/Dialog |
|---|-----------|-------------|
| 1 | Dashboard | `/dashboard` |
| 2 | TM edit page | `/tm/{id}` (all sections expanded) |
| 3 | Threat page | `/tm/{id}/threat/{id}` |
| 4 | Note page | Seeded note page |
| 5 | Asset dialog | Open seeded asset dialog |
| 6 | Document dialog | Open seeded document dialog |
| 7 | Repository dialog | Open seeded repository dialog |
| 8 | Metadata dialog | Open metadata dialog on seeded TM |

8 tests covering every distinct TM-area page and dialog.

### Masking Strategy

Dynamic content masked per-test via Playwright's `mask` option passed to `takeThemeScreenshots`:
- **Timestamps**: Target elements containing date pipe output (created_at, modified_at fields)
- **Collaboration indicators**: Session icons on dashboard cards
- **No global mask** — each test specifies its own mask locators

### Total: 15 visual regression tests (28 baseline images)

---

## Seed Data Requirements

The existing `e2e/seed/seed-spec.json` already contains the "Seed TM - Full Fields" threat model with populated threats, assets, documents, repositories, notes, and diagrams. No additions needed for Phase 1 — all tests use existing seed data or create their own ephemeral test data.

Verify that the seeded TM has:
- At least one threat with CVSS 3.1 score, CWE references, and all fields populated
- At least one asset with classification array populated
- At least one document with URI
- At least one repository with ref_type, ref_value, and subpath
- At least one note with markdown content
- Authorization entries granting test-reviewer writer access

All of these are present in the current seed spec.

---

## File Summary

### New files (E2E)

| File | Sub-phase |
|------|-----------|
| `e2e/pages/note-page.page.ts` | 1A |
| `e2e/dialogs/asset-editor.dialog.ts` | 1A |
| `e2e/dialogs/document-editor.dialog.ts` | 1A |
| `e2e/dialogs/repository-editor.dialog.ts` | 1A |
| `e2e/dialogs/metadata.dialog.ts` | 1A |
| `e2e/dialogs/permissions.dialog.ts` | 1A |
| `e2e/dialogs/ssvc-calculator.dialog.ts` | 1A |
| `e2e/dialogs/export.dialog.ts` | 1A |
| `e2e/dialogs/framework-mapping-picker.dialog.ts` | 1A |
| `e2e/flows/asset.flow.ts` | 1A |
| `e2e/flows/document.flow.ts` | 1A |
| `e2e/flows/repository.flow.ts` | 1A |
| `e2e/flows/note.flow.ts` | 1A |
| `e2e/flows/metadata.flow.ts` | 1A |
| `e2e/flows/permissions.flow.ts` | 1A |
| `e2e/flows/scoring.flow.ts` | 1A |
| `e2e/tests/workflows/tm-workflows.spec.ts` | 1A |
| `e2e/tests/workflows/child-entity-crud.spec.ts` | 1A |
| `e2e/tests/workflows/scoring-systems.spec.ts` | 1A |
| `e2e/helpers/field-interactions.ts` | 1B |
| `e2e/tests/field-coverage/tm-fields.spec.ts` | 1B |
| `e2e/tests/field-coverage/threat-fields.spec.ts` | 1B |
| `e2e/tests/field-coverage/asset-fields.spec.ts` | 1B |
| `e2e/tests/field-coverage/document-fields.spec.ts` | 1B |
| `e2e/tests/field-coverage/repository-fields.spec.ts` | 1B |
| `e2e/tests/field-coverage/note-fields.spec.ts` | 1B |
| `e2e/tests/visual-regression/tm-visual-regression.spec.ts` | 1C |
| `e2e/tests/visual-regression/tm-translation-icons.spec.ts` | 1C |

### Modified files

| File | Change | Sub-phase |
|------|--------|-----------|
| `src/app/pages/dashboard/create-threat-model-dialog/create-threat-model-dialog.component.ts` | Add `data-testid` for framework, confidential, description | 1A |
| `src/app/pages/tm/tm-edit.component.html` | Add `data-testid` attributes | 1A |
| `src/app/pages/tm/components/asset-editor-dialog/asset-editor-dialog.component.html` | Add `data-testid` attributes | 1A |
| `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.html` | Add `data-testid` attributes | 1A |
| `src/app/pages/tm/components/repository-editor-dialog/repository-editor-dialog.component.html` | Add `data-testid` attributes | 1A |
| `src/app/pages/tm/components/note-page/note-page.component.html` | Add `data-testid` attributes | 1A |
| `src/app/pages/tm/components/metadata-dialog/metadata-dialog.component.html` | Add `data-testid` attributes | 1A |
| `src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.ts` | Add `data-testid` attributes (inline template) | 1A |
| `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.html` | Add `data-testid` attributes | 1A |
| `src/app/pages/tm/components/export-dialog/export-dialog.component.html` | Add `data-testid` attributes | 1A |
| `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.html` | Add `data-testid` attributes | 1A |
| `e2e/dialogs/create-tm.dialog.ts` | Add `descriptionInput()`, `frameworkSelect()`, `confidentialToggle()` locators | 1A |
| `e2e/fixtures/test-fixtures.ts` | Register new page objects, dialogs, flows | 1A |
| `e2e/schema/field-definitions.json` | Fix field types, add missing fields, update selectors | 1B |
| `e2e/schema/field-definitions.ts` | Re-export updated definitions | 1B |

---

## Acceptance Criteria

From the issue:

- [ ] All workflow tests pass against live backend
- [ ] Schema-driven field tests cover every field in the OpenAPI spec for TM entities
- [ ] All scoring calculators (CVSS 3.1, 4.0, SSVC, CWE, framework mappings) tested
- [ ] Screenshot baselines established for all 4 theme modes
- [ ] No missing translation keys detected on any TM page
- [ ] All icons render correctly
