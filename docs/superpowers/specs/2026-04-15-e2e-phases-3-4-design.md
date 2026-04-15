# E2E Phases 3 & 4: Surveys/Triage + Teams/Projects — Design Spec

**Issues:** [#577](https://github.com/ericfitz/tmi-ux/issues/577), [#578](https://github.com/ericfitz/tmi-ux/issues/578)
**Parent spec:** `docs/superpowers/specs/2026-04-10-e2e-comprehensive-test-plan-design.md`
**Branch:** `dev/1.4.0`
**Estimated tests:** ~95 (Phase 3: ~55, Phase 4: ~40)

## Overview

Two independent E2E phases covering the survey lifecycle (admin authoring → user filling → reviewer triage) and team/project management with dashboard integration. Both phases follow the same three-layer architecture (Tests → Flows → Page Objects) and sub-phase structure established in Phase 1.

## Approach

Same conventions as Phase 1:
- Sub-phase A (infrastructure + workflows) must complete before B and C
- Sub-phases B (field coverage) and C (visual regression) are independent of each other
- `angularFill()` for all `[value]`/`[(ngModel)]` inputs; standard `fill()` for `formControlName`
- `dispatchEvent('click')` for mat-menu items and mat-button-toggles
- `scrollIntoViewIfNeeded()` before clicking buttons that may be below the fold
- Serial test suites for stateful workflows; fixture-based tests for independent scenarios
- `waitForResponse()` after save operations before assertions
- `getByTestId()` as primary selector strategy

## Seed Data Updates

The existing `e2e/seed/seed-spec.json` has placeholder survey JSON. Phase 3 requires realistic SurveyJS schemas.

### Kitchen Sink Survey — Replace Placeholder

```json
{
  "name": "Kitchen Sink Survey",
  "description": "Survey with all supported question types for integration testing",
  "version": "v1-seed",
  "status": "active",
  "survey_json": {
    "title": "Kitchen Sink Survey",
    "description": "Comprehensive survey for E2E testing",
    "pages": [
      {
        "name": "basicInputs",
        "title": "Basic Inputs",
        "elements": [
          {
            "type": "text",
            "name": "project_name",
            "title": "Project Name",
            "isRequired": true
          },
          {
            "type": "comment",
            "name": "project_description",
            "title": "Describe Your Project"
          },
          {
            "type": "boolean",
            "name": "has_external_users",
            "title": "Does this project have external users?",
            "labelTrue": "Yes",
            "labelFalse": "No"
          }
        ]
      },
      {
        "name": "selectionInputs",
        "title": "Selection Inputs",
        "elements": [
          {
            "type": "radiogroup",
            "name": "data_sensitivity",
            "title": "Data Sensitivity Level",
            "choices": [
              { "value": "public", "text": "Public" },
              { "value": "internal", "text": "Internal" },
              { "value": "confidential", "text": "Confidential" },
              { "value": "restricted", "text": "Restricted" }
            ]
          },
          {
            "type": "checkbox",
            "name": "compliance_frameworks",
            "title": "Applicable Compliance Frameworks",
            "choices": [
              { "value": "soc2", "text": "SOC 2" },
              { "value": "hipaa", "text": "HIPAA" },
              { "value": "pci", "text": "PCI DSS" },
              { "value": "gdpr", "text": "GDPR" }
            ]
          },
          {
            "type": "dropdown",
            "name": "deployment_model",
            "title": "Deployment Model",
            "choices": [
              { "value": "cloud", "text": "Cloud (SaaS)" },
              { "value": "on_prem", "text": "On-Premises" },
              { "value": "hybrid", "text": "Hybrid" }
            ]
          }
        ]
      },
      {
        "name": "conditionalLogic",
        "title": "Conditional Logic",
        "elements": [
          {
            "type": "radiogroup",
            "name": "stores_pii",
            "title": "Does this system store PII?",
            "choices": [
              { "value": "yes", "text": "Yes" },
              { "value": "no", "text": "No" }
            ]
          },
          {
            "type": "comment",
            "name": "pii_details",
            "title": "Describe what PII is stored and how it is protected",
            "visibleIf": "{stores_pii} = 'yes'"
          },
          {
            "type": "text",
            "name": "pii_retention_days",
            "title": "PII retention period (days)",
            "inputType": "number",
            "visibleIf": "{stores_pii} = 'yes'"
          }
        ]
      },
      {
        "name": "groupedInputs",
        "title": "Grouped Inputs",
        "elements": [
          {
            "type": "panel",
            "name": "infrastructure_panel",
            "title": "Infrastructure Details",
            "elements": [
              {
                "type": "text",
                "name": "cloud_provider",
                "title": "Cloud Provider"
              },
              {
                "type": "text",
                "name": "region",
                "title": "Primary Region"
              }
            ]
          },
          {
            "type": "paneldynamic",
            "name": "integrations",
            "title": "Third-Party Integrations",
            "templateTitle": "Integration #{panelIndex}",
            "templateElements": [
              {
                "type": "text",
                "name": "integration_name",
                "title": "Integration Name"
              },
              {
                "type": "dropdown",
                "name": "integration_type",
                "title": "Integration Type",
                "choices": [
                  { "value": "api", "text": "API" },
                  { "value": "sdk", "text": "SDK" },
                  { "value": "webhook", "text": "Webhook" }
                ]
              }
            ],
            "panelCount": 1,
            "minPanelCount": 0,
            "maxPanelCount": 5
          }
        ]
      }
    ]
  },
  "settings": { "allow_threat_model_linking": true }
}
```

### Simple Workflow Survey — Replace Placeholder

```json
{
  "name": "Simple Workflow Survey",
  "description": "Minimal survey for workflow testing (fill, submit, triage)",
  "version": "v1-seed",
  "status": "active",
  "survey_json": {
    "title": "Quick Security Review Request",
    "description": "Submit a request for security review",
    "pages": [
      {
        "name": "request",
        "title": "Review Request",
        "elements": [
          {
            "type": "text",
            "name": "system_name",
            "title": "System Name",
            "isRequired": true
          },
          {
            "type": "comment",
            "name": "review_reason",
            "title": "Reason for Review Request"
          },
          {
            "type": "radiogroup",
            "name": "urgency",
            "title": "Urgency",
            "choices": [
              { "value": "low", "text": "Low" },
              { "value": "medium", "text": "Medium" },
              { "value": "high", "text": "High" }
            ]
          }
        ]
      }
    ]
  },
  "settings": {}
}
```

### Updated Survey Response Seed

```json
{
  "survey": "Simple Workflow Survey",
  "user": "test-user",
  "status": "submitted",
  "responses": {
    "system_name": "E2E Seed System",
    "review_reason": "Annual security review",
    "urgency": "medium"
  }
}
```

### Additional Seed Data for Phase 4

The existing team and project seeds are sufficient for workflow tests but need enrichment for field coverage:

```json
{
  "name": "Seed Team Alpha",
  "status": "active",
  "description": "Primary engineering team for E2E testing",
  "email_address": "team-alpha@tmi.local",
  "uri": "https://example.com/teams/alpha",
  "members": [
    { "user_id": "test-user", "role": "engineer" },
    { "user_id": "test-reviewer", "role": "engineering_lead" }
  ],
  "responsible_parties": [
    { "user_id": "test-reviewer", "role": "engineering_lead" }
  ],
  "metadata": [{ "key": "department", "value": "Engineering" }]
}
```

```json
{
  "name": "Seed Project One",
  "team": "Seed Team Alpha",
  "status": "active",
  "description": "Primary project for E2E testing",
  "uri": "https://example.com/projects/one",
  "responsible_parties": [
    { "user_id": "test-user", "role": "engineer" }
  ],
  "metadata": [{ "key": "fiscal_year", "value": "2026" }]
}
```

Add a second team and project for "related" entity tests:

```json
{
  "name": "Seed Team Beta",
  "status": "active",
  "description": "Secondary team for relationship testing",
  "members": [
    { "user_id": "test-user", "role": "member" }
  ],
  "metadata": []
}
```

```json
{
  "name": "Seed Project Two",
  "team": "Seed Team Beta",
  "status": "planning",
  "description": "Secondary project for relationship testing",
  "metadata": []
}
```

---

# Phase 3: Surveys, Intake, and Triage

**Issue:** [#577](https://github.com/ericfitz/tmi-ux/issues/577)
**Estimated tests:** ~50 (20 workflow + 15 field + 15 visual)

## Structure

| Sub-phase | Tests | Playwright project | Dependencies |
|-----------|-------|--------------------|--------------|
| 3A: Infrastructure + Workflows | ~20 | `workflows`, `admin` | Phase 0 complete |
| 3B: Field Coverage | ~15 | `field-coverage` | 3A (needs `data-testid` attrs + page objects) |
| 3C: Visual Regression | ~15 | `visual-regression` | 3A (needs `data-testid` attrs + page objects) |

3A must complete first. 3B and 3C are independent of each other.

---

## Sub-phase 3A: Infrastructure + Workflow Tests

### New `data-testid` Attributes

**admin-surveys.component.html:**

| Attribute | Element |
|-----------|---------|
| `admin-surveys-search-input` | Search/filter input |
| `admin-surveys-status-filter` | Status filter select |
| `admin-surveys-create-button` | Create survey button |
| `admin-surveys-row` | Survey table rows |
| `admin-surveys-edit-button` | Edit button (per row) |
| `admin-surveys-toggle-status-button` | Activate/deactivate button (per row) |
| `admin-surveys-more-button` | More actions kebab menu (per row) |
| `admin-surveys-clone-item` | Clone menu item |
| `admin-surveys-archive-item` | Archive menu item |
| `admin-surveys-delete-item` | Delete menu item |

**template-builder.component.html:**

| Attribute | Element |
|-----------|---------|
| `builder-save-button` | Save button |
| `builder-delete-button` | Delete survey button |
| `builder-close-button` | Close/back button |
| `builder-survey-name` | Survey name input |
| `builder-survey-version` | Survey version input |
| `builder-survey-title` | Survey title input |
| `builder-survey-description` | Survey description textarea |
| `builder-add-question` | Add question button (per type, use `data-testid="builder-add-question-{type}"`) |
| `builder-question-item` | Question list item (per question) |
| `builder-question-move-up` | Move question up button |
| `builder-question-delete` | Delete question button |
| `builder-question-name` | Question name/ID input (properties panel) |
| `builder-question-title` | Question title input |
| `builder-question-description` | Question description textarea |
| `builder-question-required` | Required checkbox |
| `builder-question-choices` | Choices textarea |
| `builder-question-visible-if` | VisibleIf input |
| `builder-question-enable-if` | EnableIf input |
| `builder-question-required-if` | RequiredIf input |
| `builder-question-tm-field` | TM field mapping select |
| `builder-page-prev` | Previous page button |
| `builder-page-next` | Next page button |
| `builder-page-add` | Add page button |
| `builder-page-delete` | Delete page button |

**create-survey-dialog.component.ts** (inline template):

| Attribute | Element |
|-----------|---------|
| `create-survey-name-input` | Name input |
| `create-survey-version-input` | Version input |
| `create-survey-cancel-button` | Cancel button |
| `create-survey-submit-button` | Create button |

**survey-list.component.html:**

| Attribute | Element |
|-----------|---------|
| `survey-list-my-responses-button` | My Responses button |
| `survey-list-survey-card` | Survey card (per survey) |
| `survey-list-draft-item` | Draft item (per draft) |
| `survey-list-draft-delete-button` | Delete draft button (kebab menu item) |
| `survey-list-draft-continue-button` | Continue draft button |
| `survey-list-start-button` | Start new survey button |

**survey-fill.component.html:**

| Attribute | Element |
|-----------|---------|
| `survey-fill-save-button` | Save button |
| `survey-fill-close-button` | Close/back button |
| `survey-fill-save-exit-button` | Save & Exit button |
| `survey-fill-view-response-button` | View Response button (success state) |
| `survey-fill-start-another-button` | Start Another Survey button (success state) |
| `survey-fill-status` | Save status indicator |
| `survey-fill-revision-notes` | Revision notes display |

**my-responses.component.html:**

| Attribute | Element |
|-----------|---------|
| `my-responses-status-filter` | Status filter select |
| `my-responses-close-button` | Close button |
| `my-responses-row` | Response table rows |
| `my-responses-edit-button` | Edit/continue draft button (per row) |
| `my-responses-view-button` | View response button (per row) |
| `my-responses-delete-button` | Delete draft button (per row) |

**response-detail.component.html:**

| Attribute | Element |
|-----------|---------|
| `response-detail-close-button` | Close button |
| `response-detail-status` | Response status display |
| `response-detail-tm-link` | Threat model link |

**survey-confidential-dialog.component.ts** (inline template):

| Attribute | Element |
|-----------|---------|
| `confidential-no-button` | "No" button |
| `confidential-yes-button` | "Yes, mark as confidential" button |

**triage-list.component.html** (additions to existing):

| Attribute | Element |
|-----------|---------|
| `triage-view-button` | View response button (per row) |
| `triage-approve-button` | Approve button (per row) |
| `triage-revision-button` | Return for revision button (per row) |
| `triage-create-tm-button` | Create threat model button (per row) |
| `triage-paginator` | Pagination controls |
| `triage-tab-group` | Tab group (responses / reviewer assignment) |
| `triage-responses-tab` | Survey Responses tab |
| `triage-assignment-tab` | Reviewer Assignment tab |

**reviewer-assignment-list.component.html:**

| Attribute | Element |
|-----------|---------|
| `reviewer-assignment-search-input` | Search input |
| `reviewer-assignment-status-filter` | Status filter select |
| `reviewer-assignment-unassigned-checkbox` | Unassigned only checkbox |
| `reviewer-assignment-more-filters-button` | Toggle advanced filters button |
| `reviewer-assignment-clear-filters-button` | Clear filters button |
| `reviewer-assignment-row` | TM table row |
| `reviewer-assignment-reviewer-select` | Reviewer dropdown (per row) |
| `reviewer-assignment-assign-button` | Assign button (per row) |
| `reviewer-assignment-assign-me-button` | Assign to Me button (per row) |
| `reviewer-assignment-open-tm-button` | Open TM button (per row) |
| `reviewer-assignment-paginator` | Pagination controls |

**triage-detail.component.html:**

| Attribute | Element |
|-----------|---------|
| `triage-detail-approve-button` | Approve button |
| `triage-detail-revision-button` | Return for revision button |
| `triage-detail-create-tm-button` | Create threat model button |
| `triage-detail-close-button` | Close button |
| `triage-detail-toggle-notes-button` | Toggle triage notes button |
| `triage-detail-add-note-button` | Add note button |
| `triage-detail-note-row` | Note row (per note) |
| `triage-detail-view-note-button` | View note button (per row) |
| `triage-detail-toggle-responses-button` | Toggle survey responses button |
| `triage-detail-copy-id-button` | Copy ID button |
| `triage-detail-status` | Status display |
| `triage-detail-submitter` | Submitter display |
| `triage-detail-response-row` | Response data row |

**revision-notes-dialog.component.html:**

| Attribute | Element |
|-----------|---------|
| `revision-notes-textarea` | Notes textarea |
| `revision-notes-cancel-button` | Cancel button |
| `revision-notes-confirm-button` | Confirm/submit button |

**triage-note-editor-dialog.component.html:**

| Attribute | Element |
|-----------|---------|
| `triage-note-name-input` | Name input |
| `triage-note-content-textarea` | Content textarea |
| `triage-note-edit-toggle` | Edit mode toggle |
| `triage-note-preview-toggle` | Preview mode toggle |
| `triage-note-cancel-button` | Cancel button |
| `triage-note-save-button` | Save button |

### New Page Objects

| File | Key Locators |
|------|--------------|
| `e2e/pages/survey-list.page.ts` | `myResponsesButton()`, `surveyCard(name)`, `surveyCards()`, `draftItem(name)`, `draftDeleteButton(name)`, `draftContinueButton(name)`, `startButton(surveyName)` |
| `e2e/pages/survey-fill.page.ts` | `saveButton()`, `closeButton()`, `saveExitButton()`, `viewResponseButton()`, `startAnotherButton()`, `saveStatus()`, `revisionNotes()` |
| `e2e/pages/my-responses.page.ts` | `statusFilter()`, `closeButton()`, `responseRows()`, `responseRow(name)`, `editButton(name)`, `viewButton(name)`, `deleteButton(name)` |
| `e2e/pages/response-detail.page.ts` | `closeButton()`, `status()`, `tmLink()` |
| `e2e/pages/admin-surveys.page.ts` | `searchInput()`, `statusFilter()`, `createButton()`, `surveyRows()`, `surveyRow(name)`, `editButton(name)`, `toggleStatusButton(name)`, `moreButton(name)`, `cloneItem()`, `archiveItem()`, `deleteItem()` |
| `e2e/pages/template-builder.page.ts` | `saveButton()`, `deleteButton()`, `closeButton()`, `surveyName()`, `surveyVersion()`, `surveyTitle()`, `surveyDescription()`, `addQuestionButton(type)`, `questionItem(name)`, `questionMoveUp(name)`, `questionDelete(name)`, `questionName()`, `questionTitle()`, `questionDescription()`, `questionRequired()`, `questionChoices()`, `questionVisibleIf()`, `questionEnableIf()`, `questionRequiredIf()`, `questionTmField()`, `pagePrev()`, `pageNext()`, `pageAdd()`, `pageDelete()` |
| `e2e/pages/triage-detail.page.ts` | `approveButton()`, `revisionButton()`, `createTmButton()`, `closeButton()`, `toggleNotesButton()`, `addNoteButton()`, `noteRows()`, `noteRow(name)`, `viewNoteButton(name)`, `toggleResponsesButton()`, `copyIdButton()`, `status()`, `submitter()`, `responseRows()` |
| `e2e/pages/reviewer-assignment.page.ts` | `searchInput()`, `statusFilter()`, `unassignedCheckbox()`, `moreFiltersButton()`, `clearFiltersButton()`, `tmRows()`, `tmRow(name)`, `reviewerSelect(name)`, `assignButton(name)`, `assignMeButton(name)`, `openTmButton(name)`, `paginator()` |

### New Dialog Objects

| File | Key Locators |
|------|--------------|
| `e2e/dialogs/create-survey.dialog.ts` | `nameInput()`, `versionInput()`, `cancelButton()`, `submitButton()` |
| `e2e/dialogs/survey-confidential.dialog.ts` | `noButton()`, `yesButton()` |
| `e2e/dialogs/revision-notes.dialog.ts` | `notesTextarea()`, `cancelButton()`, `confirmButton()` |
| `e2e/dialogs/triage-note-editor.dialog.ts` | `nameInput()`, `contentTextarea()`, `editToggle()`, `previewToggle()`, `cancelButton()`, `saveButton()` |

### New Flows

| File | Methods |
|------|---------|
| `e2e/flows/survey-admin.flow.ts` | `createSurvey(name, version)`, `openInBuilder(name)`, `toggleStatus(name)`, `cloneSurvey(name)`, `archiveSurvey(name)`, `deleteSurvey(name)` |
| `e2e/flows/survey-builder.flow.ts` | `addQuestion(type, title)`, `selectQuestion(name)`, `editQuestionProperties(fields)`, `setConditionalLogic(visibleIf)`, `deleteQuestion(name)`, `addPage()`, `deletePage()`, `saveSurvey()` |
| `e2e/flows/survey-fill.flow.ts` | `startSurvey(name)`, `fillTextField(name, value)`, `fillCommentField(name, value)`, `selectRadioOption(name, value)`, `selectCheckboxOptions(name, values[])`, `selectDropdown(name, value)`, `toggleBoolean(name)`, `submitSurvey()`, `saveAndExit()` |
| `e2e/flows/survey-response.flow.ts` | `viewMyResponses()`, `viewResponse(name)`, `continueDraft(name)`, `deleteDraft(name)` |
| `e2e/flows/triage.flow.ts` | `filterByStatus(status)`, `filterByTemplate(name)`, `searchByName(term)`, `clearFilters()`, `viewResponse(name)`, `approveResponse(name)`, `returnForRevision(name, notes)`, `createThreatModel(name)` |
| `e2e/flows/triage-detail.flow.ts` | `approve()`, `returnForRevision(notes)`, `createThreatModel()`, `addNote(name, content)`, `viewNote(name)` |
| `e2e/flows/reviewer-assignment.flow.ts` | `filterUnassigned()`, `assignReviewer(tmName, reviewerName)`, `assignToMe(tmName)`, `openTm(tmName)` |

### Fixture Updates

Register all new page objects, dialog objects, and flows in `e2e/fixtures/test-fixtures.ts`.

### Workflow Test Specs

#### `e2e/tests/workflows/survey-admin.spec.ts` (admin project)

Serial suite using `adminTest` fixture.

| # | Test | Steps |
|---|------|-------|
| 1 | Create survey | Navigate to admin surveys → click create → fill name + version → submit → verify in list |
| 2 | Open in builder | Click edit on created survey → verify builder loads → verify name and version display |
| 3 | Add questions | Add text question → fill title → add radiogroup question → fill title + choices → save → verify |
| 4 | Set conditional logic | Select a question → set visibleIf expression → save → verify persisted |
| 5 | Survey lifecycle | Toggle status to inactive → verify inactive badge → toggle to active → archive → verify archived |
| 6 | Clone survey | Clone seeded survey → verify new copy in list with same structure |
| 7 | Delete survey | Delete the cloned survey → verify removed from list |

#### `e2e/tests/workflows/survey-fill.spec.ts`

Serial suite using `userTest` fixture.

| # | Test | Steps |
|---|------|-------|
| 1 | Survey list shows active surveys | Navigate to intake → verify seeded surveys visible → verify no inactive/archived surveys |
| 2 | Fill simple survey | Start "Simple Workflow Survey" → fill system_name, review_reason, urgency → submit → verify success state |
| 3 | Fill kitchen sink survey | Start "Kitchen Sink Survey" → fill all question types across all pages → exercise conditional logic (set stores_pii=yes → verify pii_details visible → set stores_pii=no → verify pii_details hidden) → submit |
| 4 | Draft auto-save | Start new survey → fill partially → navigate away → return to intake → verify draft appears → continue draft → verify answers preserved |
| 5 | My responses | Navigate to my-responses → verify submitted responses appear → filter by status → verify filtering works |
| 6 | View completed response | Open a submitted response → verify read-only display → verify all answers visible |

#### `e2e/tests/workflows/triage-workflows.spec.ts`

Serial suite using `reviewerTest` fixture. Operates on the pre-seeded submitted response.

| # | Test | Steps |
|---|------|-------|
| 1 | Triage list filters | Navigate to triage → verify submitted response visible → filter by status (submitted) → verify → filter by template → verify → search by submitter → verify → clear filters |
| 2 | View response detail | Click view on seeded response → verify detail page loads → verify submitter, status, answers display |
| 3 | Return for revision | Click return for revision → enter revision notes → confirm → verify status changes to needs_revision |
| 4 | Triage notes | Open response detail → add triage note (name, content) → verify note appears in list → view note → verify content |
| 5 | Reviewer assignment | Switch to Reviewer Assignment tab → filter for unassigned TMs → select reviewer from dropdown → assign → verify assignment persists |

#### `e2e/tests/workflows/survey-cross-role.spec.ts`

Uses `multiRoleTest` fixture (admin + user + reviewer contexts). This is the signature cross-role workflow.

| # | Test | Steps |
|---|------|-------|
| 1 | Full cross-role lifecycle | **Admin:** Create and publish survey → **User:** Fill and submit → **Reviewer:** View in triage → return for revision with notes → **User:** See revision request and notes → update and resubmit → **Reviewer:** Approve → **User:** Verify approved status |

Notes:
- This test requires the `multiRoleTest` fixture which provides `adminPage`, `userPage`, and `reviewerPage` — three independent browser contexts.
- The survey filled by the user must match the survey created by the admin. Use a simple 2-3 question survey created during the test, not the seeded kitchen sink.
- SurveyJS renders its own form controls inside `<survey>` component. The fill flow must use SurveyJS's DOM structure to target inputs (e.g., `input[aria-label="System Name"]` or `.sd-question` containers). These are NOT Angular Material controls and do NOT need `angularFill()` — SurveyJS manages its own reactivity.

---

## Sub-phase 3B: Field Coverage

### Field Definitions

Add survey-related field definitions to `e2e/schema/field-definitions.json`.

**Note:** Survey authoring fields (template builder) are tested via workflow tests since the builder is a complex multi-panel editor, not a simple form. Field coverage here covers the triage/response detail views.

#### Survey Response Fields (Triage Detail View)

The triage detail view displays response metadata as read-only info cards. These are display-only fields verified by visibility, not editability.

| Field | apiName | uiSelector | type | editable |
|-------|---------|------------|------|----------|
| Submitter | submitter | `[data-testid="triage-detail-submitter"]` | text | false |
| Status | status | `[data-testid="triage-detail-status"]` | text | false |
| Survey Name | survey_name | (in info card) | text | false |
| Created At | created_at | (in info card) | text | false |
| Version | version | (in info card) | text | false |

#### Survey Template Fields (Admin List View)

| Field | apiName | uiSelector | type | editable |
|-------|---------|------------|------|----------|
| Name | name | (inline edit in row) | text | true |
| Version | version | (display in row) | text | false |
| Status | status | (badge in row) | text | false |

### Test Files

#### `e2e/tests/field-coverage/survey-response-fields.spec.ts` (~5 parameterized tests)

- Navigate to triage → open seeded submitted response detail
- For each field: verify UI element exists and displays seeded value
- All fields are display-only (no edit cycle)

#### `e2e/tests/field-coverage/survey-template-fields.spec.ts` (~5 parameterized tests)

- Navigate to admin surveys → verify seeded surveys in list
- For each field: verify displays in list and/or builder
- Name is inline-editable in list; other fields display-only

#### `e2e/tests/field-coverage/survey-fill-fields.spec.ts` (~5 parameterized tests)

- Start seeded "Kitchen Sink Survey" and navigate through pages
- For each SurveyJS question type: verify renders, accepts input, value persists through page navigation
- Question types: text, comment, boolean, radiogroup, checkbox, dropdown, panel (static), paneldynamic

### Total: ~15 field coverage tests

---

## Sub-phase 3C: Visual Regression

### Screenshot Tests — `e2e/tests/visual-regression/survey-visual-regression.spec.ts`

| # | Test name | Page | Fixture | Masking |
|---|-----------|------|---------|---------|
| 1 | Survey list | `/intake` | `userTest` | None |
| 2 | Survey fill (basic inputs page) | `/intake/fill/...` (kitchen sink, page 1) | `userTest` | None |
| 3 | Survey fill (selection inputs page) | Kitchen sink, page 2 | `userTest` | None |
| 4 | My responses | `/intake/my-responses` | `userTest` | Timestamps |
| 5 | Response detail (read-only) | `/intake/response/...` | `userTest` | Timestamps |
| 6 | Admin survey list | `/admin/surveys` | `adminTest` | Timestamps |
| 7 | Template builder | `/admin/surveys/:id` | `adminTest` | None |
| 8 | Triage list | `/triage` | `reviewerTest` | Timestamps |
| 9 | Triage detail | `/triage/:id` | `reviewerTest` | Timestamps |

9 tests × 4 theme modes = 36 baseline screenshots.

### Translation + Icon Sweeps — `e2e/tests/visual-regression/survey-translation-icons.spec.ts`

| # | Test name | Page/Dialog |
|---|-----------|-------------|
| 1 | Survey list | `/intake` |
| 2 | Survey fill | Kitchen sink survey page 1 |
| 3 | My responses | `/intake/my-responses` |
| 4 | Admin survey list | `/admin/surveys` |
| 5 | Template builder | `/admin/surveys/:id` |
| 6 | Triage list | `/triage` |
| 7 | Triage detail | `/triage/:id` |

7 tests covering every distinct survey/triage page. SurveyJS-rendered content may produce false positives for translation scanning (SurveyJS uses its own i18n); exclude `.sd-question` containers from the Transloco key scanner.

### Total: ~16 visual regression tests (36 baseline images)

---

# Phase 4: Teams, Projects, and Shared Entities

**Issue:** [#578](https://github.com/ericfitz/tmi-ux/issues/578)
**Estimated tests:** ~40 (15 workflow + 15 field + 10 visual)

## Structure

| Sub-phase | Tests | Playwright project | Dependencies |
|-----------|-------|--------------------|--------------|
| 4A: Infrastructure + Workflows | ~15 | `workflows` | Phase 0 complete |
| 4B: Field Coverage | ~15 | `field-coverage` | 4A (needs `data-testid` attrs + page objects) |
| 4C: Visual Regression | ~10 | `visual-regression` | 4A (needs `data-testid` attrs + page objects) |

4A must complete first. 4B and 4C are independent of each other.

---

## Sub-phase 4A: Infrastructure + Workflow Tests

### New `data-testid` Attributes

**teams.component.html** (and admin-teams.component.html — same pattern):

| Attribute | Element |
|-----------|---------|
| `teams-search-input` | Search/filter input |
| `teams-close-button` | Close button |
| `teams-add-button` | Add team button |
| `teams-table` | Teams table |
| `teams-row` | Team table row |
| `teams-edit-button` | Edit button (per row) |
| `teams-members-button` | Members button (per row) |
| `teams-more-button` | More actions kebab menu (per row) |
| `teams-responsible-parties-item` | Responsible parties menu item |
| `teams-related-teams-item` | Related teams menu item |
| `teams-metadata-item` | Metadata menu item |
| `teams-delete-item` | Delete menu item (admin only) |
| `teams-paginator` | Pagination controls |

**projects.component.html** (and admin-projects.component.html — same pattern):

| Attribute | Element |
|-----------|---------|
| `projects-name-filter` | Name filter input |
| `projects-team-filter` | Team filter autocomplete |
| `projects-team-filter-clear` | Clear team filter button |
| `projects-status-filter` | Status filter select |
| `projects-clear-filters-button` | Clear all filters button |
| `projects-close-button` | Close button |
| `projects-add-button` | Add project button |
| `projects-table` | Projects table |
| `projects-row` | Project table row |
| `projects-edit-button` | Edit button (per row) |
| `projects-more-button` | More actions kebab menu (per row) |
| `projects-responsible-parties-item` | Responsible parties menu item |
| `projects-related-projects-item` | Related projects menu item |
| `projects-metadata-item` | Metadata menu item |
| `projects-delete-item` | Delete menu item (admin only) |
| `projects-paginator` | Pagination controls |

**dashboard.component.html** (additions to existing):

| Attribute | Element |
|-----------|---------|
| `dashboard-search-input` | Search input |
| `dashboard-search-clear` | Clear search button |
| `dashboard-name-filter` | Name filter input |
| `dashboard-status-filter` | Status multi-select |
| `dashboard-more-filters-button` | Toggle advanced filters |
| `dashboard-clear-filters-button` | Clear all filters button |
| `dashboard-description-filter` | Description filter (advanced) |
| `dashboard-owner-filter` | Owner filter (advanced) |
| `dashboard-issue-uri-filter` | Issue URI filter (advanced) |
| `dashboard-created-after` | Created after date picker (advanced) |
| `dashboard-created-before` | Created before date picker (advanced) |
| `dashboard-modified-after` | Modified after date picker (advanced) |
| `dashboard-modified-before` | Modified before date picker (advanced) |
| `dashboard-view-toggle` | Card/table view toggle |
| `dashboard-paginator` | Pagination controls |
| `dashboard-table` | Table view table element |
| `dashboard-table-row` | Table view row |

**create-team-dialog.component.ts** (inline template):

| Attribute | Element |
|-----------|---------|
| `create-team-name-input` | Name input |
| `create-team-description-input` | Description textarea |
| `create-team-email-input` | Email input |
| `create-team-uri-input` | URI input |
| `create-team-status-select` | Status select |
| `create-team-cancel-button` | Cancel button |
| `create-team-submit-button` | Create button |

**edit-team-dialog.component.ts** (inline template):

| Attribute | Element |
|-----------|---------|
| `edit-team-name-input` | Name input |
| `edit-team-description-input` | Description textarea |
| `edit-team-email-input` | Email input |
| `edit-team-uri-input` | URI input |
| `edit-team-status-select` | Status select |
| `edit-team-tab-group` | Tab group |
| `edit-team-details-tab` | Details tab |
| `edit-team-notes-tab` | Notes tab |
| `edit-team-add-note-button` | Add note button |
| `edit-team-note-row` | Note table row |
| `edit-team-edit-note-button` | Edit note button (per row) |
| `edit-team-delete-note-button` | Delete note button (per row) |
| `edit-team-cancel-button` | Cancel button |
| `edit-team-save-button` | Save button |

**team-members-dialog.component.ts** (inline template):

| Attribute | Element |
|-----------|---------|
| `team-members-row` | Member row |
| `team-members-remove-button` | Remove member button (per row) |
| `team-members-add-button` | Add member button |
| `team-members-cancel-button` | Cancel button |
| `team-members-save-button` | Save button |

**responsible-parties-dialog.component.ts** (inline template):

| Attribute | Element |
|-----------|---------|
| `responsible-parties-row` | Party row |
| `responsible-parties-remove-button` | Remove button (per row) |
| `responsible-parties-add-button` | Add party button |
| `responsible-parties-cancel-button` | Cancel button |
| `responsible-parties-save-button` | Save button |

**related-teams-dialog.component.ts** (inline template):

| Attribute | Element |
|-----------|---------|
| `related-teams-row` | Related team row |
| `related-teams-remove-button` | Remove button (per row) |
| `related-teams-add-button` | Add related team button |
| `related-teams-team-input` | Team search autocomplete input |
| `related-teams-relationship-select` | Relationship type select |
| `related-teams-custom-relationship-input` | Custom relationship input |
| `related-teams-confirm-add-button` | Confirm add button |
| `related-teams-cancel-add-button` | Cancel add form button |
| `related-teams-cancel-button` | Cancel dialog button |
| `related-teams-save-button` | Save button |

**create-project-dialog.component.ts** (inline template):

| Attribute | Element |
|-----------|---------|
| `create-project-name-input` | Name input |
| `create-project-description-input` | Description textarea |
| `create-project-team-select` | Team select/autocomplete |
| `create-project-uri-input` | URI input |
| `create-project-status-select` | Status select |
| `create-project-cancel-button` | Cancel button |
| `create-project-submit-button` | Create button |

**edit-project-dialog.component.ts** (inline template):

| Attribute | Element |
|-----------|---------|
| `edit-project-name-input` | Name input |
| `edit-project-description-input` | Description textarea |
| `edit-project-team-select` | Team select |
| `edit-project-uri-input` | URI input |
| `edit-project-status-select` | Status select |
| `edit-project-tab-group` | Tab group |
| `edit-project-details-tab` | Details tab |
| `edit-project-notes-tab` | Notes tab |
| `edit-project-add-note-button` | Add note button |
| `edit-project-note-row` | Note table row |
| `edit-project-edit-note-button` | Edit note button (per row) |
| `edit-project-delete-note-button` | Delete note button (per row) |
| `edit-project-cancel-button` | Cancel button |
| `edit-project-save-button` | Save button |

**related-projects-dialog.component.ts** (inline template):

| Attribute | Element |
|-----------|---------|
| `related-projects-row` | Related project row |
| `related-projects-remove-button` | Remove button (per row) |
| `related-projects-add-button` | Add related project button |
| `related-projects-project-input` | Project search autocomplete input |
| `related-projects-relationship-select` | Relationship type select |
| `related-projects-custom-relationship-input` | Custom relationship input |
| `related-projects-confirm-add-button` | Confirm add button |
| `related-projects-cancel-add-button` | Cancel add form button |
| `related-projects-cancel-button` | Cancel dialog button |
| `related-projects-save-button` | Save button |

### New Page Objects

| File | Key Locators |
|------|--------------|
| `e2e/pages/teams.page.ts` | `searchInput()`, `closeButton()`, `addButton()`, `table()`, `teamRows()`, `teamRow(name)`, `editButton(name)`, `membersButton(name)`, `moreButton(name)`, `responsiblePartiesItem()`, `relatedTeamsItem()`, `metadataItem()`, `deleteItem()`, `paginator()` |
| `e2e/pages/projects.page.ts` | `nameFilter()`, `teamFilter()`, `teamFilterClear()`, `statusFilter()`, `clearFiltersButton()`, `closeButton()`, `addButton()`, `table()`, `projectRows()`, `projectRow(name)`, `editButton(name)`, `moreButton(name)`, `responsiblePartiesItem()`, `relatedProjectsItem()`, `metadataItem()`, `deleteItem()`, `paginator()` |

### New Dialog Objects

| File | Key Locators |
|------|--------------|
| `e2e/dialogs/create-team.dialog.ts` | `nameInput()`, `descriptionInput()`, `emailInput()`, `uriInput()`, `statusSelect()`, `cancelButton()`, `submitButton()` |
| `e2e/dialogs/edit-team.dialog.ts` | `nameInput()`, `descriptionInput()`, `emailInput()`, `uriInput()`, `statusSelect()`, `tabGroup()`, `detailsTab()`, `notesTab()`, `addNoteButton()`, `noteRow(name)`, `editNoteButton(name)`, `deleteNoteButton(name)`, `cancelButton()`, `saveButton()` |
| `e2e/dialogs/team-members.dialog.ts` | `memberRows()`, `removeButton(index)`, `addButton()`, `cancelButton()`, `saveButton()` |
| `e2e/dialogs/responsible-parties.dialog.ts` | `partyRows()`, `removeButton(index)`, `addButton()`, `cancelButton()`, `saveButton()` |
| `e2e/dialogs/related-teams.dialog.ts` | `relatedRows()`, `removeButton(index)`, `addButton()`, `teamInput()`, `relationshipSelect()`, `customRelationshipInput()`, `confirmAddButton()`, `cancelAddButton()`, `cancelButton()`, `saveButton()` |
| `e2e/dialogs/create-project.dialog.ts` | `nameInput()`, `descriptionInput()`, `teamSelect()`, `uriInput()`, `statusSelect()`, `cancelButton()`, `submitButton()` |
| `e2e/dialogs/edit-project.dialog.ts` | `nameInput()`, `descriptionInput()`, `teamSelect()`, `uriInput()`, `statusSelect()`, `tabGroup()`, `detailsTab()`, `notesTab()`, `addNoteButton()`, `noteRow(name)`, `editNoteButton(name)`, `deleteNoteButton(name)`, `cancelButton()`, `saveButton()` |
| `e2e/dialogs/related-projects.dialog.ts` | `relatedRows()`, `removeButton(index)`, `addButton()`, `projectInput()`, `relationshipSelect()`, `customRelationshipInput()`, `confirmAddButton()`, `cancelAddButton()`, `cancelButton()`, `saveButton()` |

### New Flows

| File | Methods |
|------|---------|
| `e2e/flows/team.flow.ts` | `createTeam(fields)`, `editTeam(name, updates)`, `deleteTeam(name)`, `openMembers(name)`, `addMember(userId, role)`, `removeMember(index)`, `openResponsibleParties(name)`, `addResponsibleParty(userId, role)`, `openRelatedTeams(name)`, `addRelatedTeam(teamName, relationship)`, `openMetadata(name)` |
| `e2e/flows/project.flow.ts` | `createProject(fields)`, `editProject(name, updates)`, `deleteProject(name)`, `openResponsibleParties(name)`, `addResponsibleParty(userId, role)`, `openRelatedProjects(name)`, `addRelatedProject(projectName, relationship)`, `openMetadata(name)` |
| `e2e/flows/dashboard-filter.flow.ts` | `searchByName(term)`, `filterByStatus(statuses[])`, `filterByOwner(owner)`, `filterByDateRange(field, after, before)`, `clearAllFilters()`, `toggleAdvancedFilters()` |

### Fixture Updates

Register all new page objects, dialog objects, and flows in `e2e/fixtures/test-fixtures.ts`.

### Dashboard Page Object Updates

Extend the existing `e2e/pages/dashboard.page.ts` with new locators for filters, pagination, table view, and sorting.

### Workflow Test Specs

#### `e2e/tests/workflows/team-workflows.spec.ts`

Serial suite using `userTest` fixture. Creates test entities in `beforeAll`, cleans up in `afterAll`.

| # | Test | Steps |
|---|------|-------|
| 1 | Team CRUD | Navigate to teams → create team (name, status=active) → verify in list → edit (change name, add description) → save → verify updated → delete → verify removed |
| 2 | Team members | Create team → open members dialog → add test-reviewer as engineering_lead → save → reopen → verify member present → remove → save → verify removed |
| 3 | Responsible parties | Open team → open responsible parties dialog → add party → save → reopen → verify → remove → save → verify removed |
| 4 | Related teams | Open team → open related teams dialog → add Seed Team Beta as "dependency" → save → reopen → verify → remove → save → verify removed |
| 5 | Team metadata | Open team → kebab → metadata → add entry (key=env, value=prod) → save → reopen → verify → edit value → save → verify → delete → save → verify empty |

#### `e2e/tests/workflows/project-workflows.spec.ts`

Serial suite using `userTest` fixture.

| # | Test | Steps |
|---|------|-------|
| 1 | Project CRUD | Navigate to projects → create project (name, team=Seed Team Alpha, status=active) → verify in list → edit (change name, change status) → save → verify → delete → verify removed |
| 2 | Project-team linkage | Create project under Seed Team Alpha → verify team column shows Alpha → edit → change team to Seed Team Beta → save → verify team column updated |
| 3 | Responsible parties | Open project → responsible parties → add party → save → verify → remove → verify |
| 4 | Related projects | Open project → related projects → add Seed Project Two as "related" → save → verify → remove → verify |
| 5 | Project metadata | Open project → metadata → add/edit/delete cycle (same pattern as team metadata test) |

#### `e2e/tests/workflows/dashboard-filters.spec.ts`

Uses `userTest` fixture. Non-serial (each test navigates independently).

| # | Test | Steps |
|---|------|-------|
| 1 | Name search | Navigate to dashboard → search for seeded TM name → verify only matching TMs shown → clear → verify all restored |
| 2 | Status filter | Filter by status "active" → verify results → add second status → verify expanded results → clear |
| 3 | Owner filter | Toggle advanced filters → filter by owner → verify results → clear |
| 4 | Date range filter | Toggle advanced filters → set created-after to past date → verify seeded TM shows → set created-after to future date → verify no results → clear |
| 5 | Pagination | Verify paginator renders → change page size → verify table updates |

Notes:
- Dashboard tests use seeded data. They do not create TMs — they filter the existing seeded TM(s).
- Date filter tests use relative dates: "past" = 2020-01-01 (all TMs should match), "future" = 2099-01-01 (none should match).
- If there's only 1 seeded TM, pagination tests verify the paginator renders and responds to page size changes but can't verify actual page transitions. This is acceptable.

---

## Sub-phase 4B: Field Coverage

### Field Definitions

Add team and project field definitions to `e2e/schema/field-definitions.json`.

#### Team Fields

| Field | apiName | uiSelector | type | editable |
|-------|---------|------------|------|----------|
| Name | name | `[data-testid="edit-team-name-input"]` | text | true |
| Description | description | `[data-testid="edit-team-description-input"]` | textarea | true |
| Email | email_address | `[data-testid="edit-team-email-input"]` | text | true |
| URI | uri | `[data-testid="edit-team-uri-input"]` | text | true |
| Status | status | `[data-testid="edit-team-status-select"]` | select | true |

5 fields × verify + edit + persist = 5 parameterized tests.

#### Project Fields

| Field | apiName | uiSelector | type | editable |
|-------|---------|------------|------|----------|
| Name | name | `[data-testid="edit-project-name-input"]` | text | true |
| Description | description | `[data-testid="edit-project-description-input"]` | textarea | true |
| Team | team_id | `[data-testid="edit-project-team-select"]` | select | true |
| URI | uri | `[data-testid="edit-project-uri-input"]` | text | true |
| Status | status | `[data-testid="edit-project-status-select"]` | select | true |

5 fields × verify + edit + persist = 5 parameterized tests.

### Test Files

#### `e2e/tests/field-coverage/team-fields.spec.ts` (~5 parameterized tests)

- Navigate to teams → open seeded "Seed Team Alpha" via edit dialog
- For each `TEAM_FIELDS` entry: verify field displays seeded value, edit, save, reopen, verify persisted
- Special cases:
  - `status`: Select field — click select, choose new option, verify

#### `e2e/tests/field-coverage/project-fields.spec.ts` (~5 parameterized tests)

- Navigate to projects → open seeded "Seed Project One" via edit dialog
- For each `PROJECT_FIELDS` entry: verify field displays seeded value, edit, save, reopen, verify persisted
- Special cases:
  - `team_id`: Select/autocomplete — verify shows "Seed Team Alpha", change to "Seed Team Beta", save, reopen, verify

#### `e2e/tests/field-coverage/dashboard-fields.spec.ts` (~5 parameterized tests)

Dashboard column verification (display-only):

| Field | Column | Verifiable |
|-------|--------|------------|
| Name | name | Seeded TM name visible |
| Last Modified | lastModified | Date string visible |
| Status | status | Status chip visible |
| Owner | owner | Owner name visible |
| Created | created | Date string visible |

- Navigate to dashboard → verify each column header exists → verify seeded TM row has values in each column

### Total: ~15 field coverage tests

---

## Sub-phase 4C: Visual Regression

### Screenshot Tests — `e2e/tests/visual-regression/team-project-visual-regression.spec.ts`

| # | Test name | Page | Fixture | Masking |
|---|-----------|------|---------|---------|
| 1 | Teams list | `/teams` | `userTest` | Timestamps |
| 2 | Create team dialog | Open create team dialog | `userTest` | None |
| 3 | Edit team dialog | Open edit dialog for seeded team | `userTest` | Timestamps |
| 4 | Projects list | `/projects` | `userTest` | Timestamps |
| 5 | Create project dialog | Open create project dialog | `userTest` | None |
| 6 | Edit project dialog | Open edit dialog for seeded project | `userTest` | Timestamps |
| 7 | Dashboard with filters | `/dashboard` with advanced filters visible | `userTest` | Timestamps, collaboration indicators |

7 tests × 4 theme modes = 28 baseline screenshots.

### Translation + Icon Sweeps — `e2e/tests/visual-regression/team-project-translation-icons.spec.ts`

| # | Test name | Page/Dialog |
|---|-----------|-------------|
| 1 | Teams list | `/teams` |
| 2 | Projects list | `/projects` |
| 3 | Dashboard | `/dashboard` |

3 tests covering every distinct team/project/dashboard page. Dialog translation coverage is implicit — dialogs open on the same page, inheriting the page's translations.

### Total: ~10 visual regression tests (28 baseline images)

---

## Playwright Configuration

No changes needed to `playwright.config.ts`. Phase 3 admin survey tests go in `e2e/tests/admin/` (the existing `admin` project), and Phase 3 survey fill/triage tests go in `e2e/tests/workflows/`. Phase 4 tests follow the same pattern.

The `survey-admin.spec.ts` file belongs in `e2e/tests/admin/` since it tests admin-only functionality. The template builder workflow tests could also go there, but since the builder is complex enough to warrant its own file, and the admin project is designed for admin-specific tests, placing it in `admin/` is appropriate.

Alternatively, keep `survey-admin.spec.ts` in `workflows/` since it uses the `adminTest` fixture and the division between the `admin` and `workflows` Playwright projects is purely organizational (both run the same way). The existing Phase 1 tests put all workflow tests in `workflows/` regardless of role.

**Decision:** Keep all workflow tests in `e2e/tests/workflows/` for consistency with Phase 1. The `admin` project directory remains reserved for Phase 5 (Admin Full Coverage).

---

## SurveyJS Interaction Notes

SurveyJS renders its own DOM inside the `<survey>` Angular component. Key differences from Angular Material forms:

1. **Inputs are standard HTML** — SurveyJS uses native `<input>`, `<textarea>`, `<select>` elements styled by its own CSS. Standard Playwright `fill()` works. No need for `angularFill()`.
2. **Question containers** — Each question is wrapped in `.sd-question` with `[data-name="question_name"]` attribute. Use `page.locator('.sd-question[data-name="project_name"] input')` to target specific fields.
3. **Radio/checkbox groups** — Use `.sd-selectbase__item` with label text matching. Click the label, not the input.
4. **Boolean toggle** — Rendered as a SurveyJS custom toggle, not mat-slide-toggle. Click the `.sd-boolean__switch` element.
5. **Dropdown** — Rendered as a SurveyJS dropdown, not mat-select. Click the `.sd-dropdown` trigger, then select from the popup.
6. **Dynamic panels** — Add panel button is `.sd-paneldynamic__add-btn`. Panel items have `.sd-paneldynamic__panel` containers.
7. **Conditional visibility** — Setting a value that triggers `visibleIf` causes elements to appear/disappear after a brief delay. Use `waitFor({ state: 'visible' })` / `waitFor({ state: 'hidden' })` with a reasonable timeout.
8. **Page navigation** — Multi-page surveys have Next/Previous buttons: `.sd-navigation__next-btn`, `.sd-navigation__prev-btn`. Submit is `.sd-navigation__complete-btn`.

The `survey-fill.flow.ts` must encapsulate all SurveyJS DOM interaction patterns so that test specs remain clean and readable.

---

## File Summary

### New files (E2E)

| File | Phase | Sub-phase |
|------|-------|-----------|
| `e2e/pages/survey-list.page.ts` | 3 | 3A |
| `e2e/pages/survey-fill.page.ts` | 3 | 3A |
| `e2e/pages/my-responses.page.ts` | 3 | 3A |
| `e2e/pages/response-detail.page.ts` | 3 | 3A |
| `e2e/pages/admin-surveys.page.ts` | 3 | 3A |
| `e2e/pages/template-builder.page.ts` | 3 | 3A |
| `e2e/pages/triage-detail.page.ts` | 3 | 3A |
| `e2e/dialogs/create-survey.dialog.ts` | 3 | 3A |
| `e2e/dialogs/survey-confidential.dialog.ts` | 3 | 3A |
| `e2e/dialogs/revision-notes.dialog.ts` | 3 | 3A |
| `e2e/dialogs/triage-note-editor.dialog.ts` | 3 | 3A |
| `e2e/flows/survey-admin.flow.ts` | 3 | 3A |
| `e2e/flows/survey-builder.flow.ts` | 3 | 3A |
| `e2e/flows/survey-fill.flow.ts` | 3 | 3A |
| `e2e/flows/survey-response.flow.ts` | 3 | 3A |
| `e2e/flows/triage.flow.ts` | 3 | 3A |
| `e2e/flows/triage-detail.flow.ts` | 3 | 3A |
| `e2e/flows/reviewer-assignment.flow.ts` | 3 | 3A |
| `e2e/pages/reviewer-assignment.page.ts` | 3 | 3A |
| `e2e/tests/workflows/survey-admin.spec.ts` | 3 | 3A |
| `e2e/tests/workflows/survey-fill.spec.ts` | 3 | 3A |
| `e2e/tests/workflows/triage-workflows.spec.ts` | 3 | 3A |
| `e2e/tests/workflows/survey-cross-role.spec.ts` | 3 | 3A |
| `e2e/tests/field-coverage/survey-response-fields.spec.ts` | 3 | 3B |
| `e2e/tests/field-coverage/survey-template-fields.spec.ts` | 3 | 3B |
| `e2e/tests/field-coverage/survey-fill-fields.spec.ts` | 3 | 3B |
| `e2e/tests/visual-regression/survey-visual-regression.spec.ts` | 3 | 3C |
| `e2e/tests/visual-regression/survey-translation-icons.spec.ts` | 3 | 3C |
| `e2e/pages/teams.page.ts` | 4 | 4A |
| `e2e/pages/projects.page.ts` | 4 | 4A |
| `e2e/dialogs/create-team.dialog.ts` | 4 | 4A |
| `e2e/dialogs/edit-team.dialog.ts` | 4 | 4A |
| `e2e/dialogs/team-members.dialog.ts` | 4 | 4A |
| `e2e/dialogs/responsible-parties.dialog.ts` | 4 | 4A |
| `e2e/dialogs/related-teams.dialog.ts` | 4 | 4A |
| `e2e/dialogs/create-project.dialog.ts` | 4 | 4A |
| `e2e/dialogs/edit-project.dialog.ts` | 4 | 4A |
| `e2e/dialogs/related-projects.dialog.ts` | 4 | 4A |
| `e2e/flows/team.flow.ts` | 4 | 4A |
| `e2e/flows/project.flow.ts` | 4 | 4A |
| `e2e/flows/dashboard-filter.flow.ts` | 4 | 4A |
| `e2e/tests/workflows/team-workflows.spec.ts` | 4 | 4A |
| `e2e/tests/workflows/project-workflows.spec.ts` | 4 | 4A |
| `e2e/tests/workflows/dashboard-filters.spec.ts` | 4 | 4A |
| `e2e/tests/field-coverage/team-fields.spec.ts` | 4 | 4B |
| `e2e/tests/field-coverage/project-fields.spec.ts` | 4 | 4B |
| `e2e/tests/field-coverage/dashboard-fields.spec.ts` | 4 | 4B |
| `e2e/tests/visual-regression/team-project-visual-regression.spec.ts` | 4 | 4C |
| `e2e/tests/visual-regression/team-project-translation-icons.spec.ts` | 4 | 4C |

### Modified files

| File | Change | Phase |
|------|--------|-------|
| `e2e/seed/seed-spec.json` | Replace survey placeholders with real SurveyJS schemas; enrich team/project seeds; add Seed Team Beta + Seed Project Two | 3, 4 |
| `e2e/fixtures/test-fixtures.ts` | Register all new page objects, dialogs, flows | 3, 4 |
| `e2e/pages/dashboard.page.ts` | Add filter, pagination, table view locators | 4 |
| `e2e/pages/triage.page.ts` | Add action button locators (view, approve, revision, create TM) | 3 |
| `e2e/schema/field-definitions.json` | Add team, project, dashboard, survey field definitions | 3, 4 |
| `e2e/schema/field-definitions.ts` | Re-export updated definitions | 3, 4 |
| `src/app/pages/admin/surveys/admin-surveys.component.html` | Add `data-testid` attributes | 3 |
| `src/app/pages/admin/surveys/components/template-builder/template-builder.component.html` | Add `data-testid` attributes | 3 |
| `src/app/pages/admin/surveys/components/create-survey-dialog/create-survey-dialog.component.ts` | Add `data-testid` attributes (inline template) | 3 |
| `src/app/pages/surveys/components/survey-list/survey-list.component.html` | Add `data-testid` attributes | 3 |
| `src/app/pages/surveys/components/survey-fill/survey-fill.component.html` | Add `data-testid` attributes | 3 |
| `src/app/pages/surveys/components/my-responses/my-responses.component.html` | Add `data-testid` attributes | 3 |
| `src/app/pages/surveys/components/response-detail/response-detail.component.html` | Add `data-testid` attributes | 3 |
| `src/app/pages/surveys/components/survey-confidential-dialog/survey-confidential-dialog.component.ts` | Add `data-testid` attributes (inline template) | 3 |
| `src/app/pages/triage/components/triage-list/triage-list.component.html` | Add action button `data-testid` attributes | 3 |
| `src/app/pages/triage/components/triage-detail/triage-detail.component.html` | Add `data-testid` attributes | 3 |
| `src/app/pages/triage/components/revision-notes-dialog/revision-notes-dialog.component.html` | Add `data-testid` attributes | 3 |
| `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.html` | Add `data-testid` attributes | 3 |
| `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.html` | Add `data-testid` attributes | 3 |
| `src/app/pages/teams/teams.component.html` | Add `data-testid` attributes | 4 |
| `src/app/pages/admin/teams/admin-teams.component.html` | Add `data-testid` attributes | 4 |
| `src/app/pages/projects/projects.component.html` | Add `data-testid` attributes | 4 |
| `src/app/pages/admin/projects/admin-projects.component.html` | Add `data-testid` attributes | 4 |
| `src/app/pages/dashboard/dashboard.component.html` | Add filter/table `data-testid` attributes | 4 |
| `src/app/shared/components/create-team-dialog/create-team-dialog.component.ts` | Add `data-testid` attributes (inline template) | 4 |
| `src/app/shared/components/edit-team-dialog/edit-team-dialog.component.ts` | Add `data-testid` attributes (inline template) | 4 |
| `src/app/shared/components/team-members-dialog/team-members-dialog.component.ts` | Add `data-testid` attributes (inline template) | 4 |
| `src/app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component.ts` | Add `data-testid` attributes (inline template) | 4 |
| `src/app/shared/components/related-teams-dialog/related-teams-dialog.component.ts` | Add `data-testid` attributes (inline template) | 4 |
| `src/app/shared/components/create-project-dialog/create-project-dialog.component.ts` | Add `data-testid` attributes (inline template) | 4 |
| `src/app/shared/components/edit-project-dialog/edit-project-dialog.component.ts` | Add `data-testid` attributes (inline template) | 4 |
| `src/app/shared/components/related-projects-dialog/related-projects-dialog.component.ts` | Add `data-testid` attributes (inline template) | 4 |

---

## Acceptance Criteria

### Phase 3 (#577)

- [ ] Survey authoring with all question types including conditional logic
- [ ] All SurveyJS question types render and accept input in fill view
- [ ] Draft auto-save and resume works
- [ ] Triage filtering, status transitions, and reviewer assignment work
- [ ] Cross-role 6-step workflow passes end-to-end (admin creates → user fills → reviewer triages → user revises → reviewer approves → user sees approved)
- [ ] Screenshot baselines for all survey/triage pages in 4 theme modes
- [ ] No missing translation keys on any survey/triage page (excluding SurveyJS internal content)

### Phase 4 (#578)

- [ ] Team CRUD, membership, responsible parties, related teams all functional
- [ ] Project CRUD, team association, related projects all functional
- [ ] Dashboard filters (name, status, owner, date range) produce correct results
- [ ] Schema-driven field tests pass for all team and project fields
- [ ] Screenshot baselines for all team/project/dashboard pages in 4 theme modes
- [ ] No missing translation keys on any team/project/dashboard page
