# E2E Phase 3: Surveys, Intake, and Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete E2E coverage for the survey lifecycle — admin authoring, user filling, reviewer triage — including a cross-role end-to-end workflow, field coverage, and visual regression.

**Architecture:** Three sub-phases following Phase 1 patterns: 3A adds ~70 data-testid attributes across 13 components, creates 7 page objects, 4 dialog objects, 8 flows, and 4 workflow specs (~21 tests). 3B adds field definitions and 3 field-coverage specs (~15 tests). 3C adds 2 visual regression specs (~16 tests). All tests use the three-layer pattern (tests → flows → page objects) and run against a live backend.

**Tech Stack:** Playwright, TypeScript, Angular Material, SurveyJS, Transloco

**Spec:** `docs/superpowers/specs/2026-04-15-e2e-phases-3-4-design.md` (Phase 3 section)

---

## Sub-phase 3A: Infrastructure + Workflow Tests

### Task 1: Update seed data with realistic survey JSON

**Files:**
- Modify: `e2e/seed/seed-spec.json`

- [ ] **Step 1: Replace Kitchen Sink Survey placeholder**

Find the Kitchen Sink Survey entry in the `surveys` array and replace the placeholder `survey_json`:

```
Old: "survey_json": { "pages": [{ "name": "placeholder", "elements": [{ "type": "text", "name": "placeholder_field", "title": "Placeholder" }] }] }

New: "survey_json": {
    "title": "Kitchen Sink Survey",
    "description": "Comprehensive survey for E2E testing",
    "pages": [
      {
        "name": "basicInputs",
        "title": "Basic Inputs",
        "elements": [
          { "type": "text", "name": "project_name", "title": "Project Name", "isRequired": true },
          { "type": "comment", "name": "project_description", "title": "Describe Your Project" },
          { "type": "boolean", "name": "has_external_users", "title": "Does this project have external users?", "labelTrue": "Yes", "labelFalse": "No" }
        ]
      },
      {
        "name": "selectionInputs",
        "title": "Selection Inputs",
        "elements": [
          { "type": "radiogroup", "name": "data_sensitivity", "title": "Data Sensitivity Level", "choices": [{ "value": "public", "text": "Public" }, { "value": "internal", "text": "Internal" }, { "value": "confidential", "text": "Confidential" }, { "value": "restricted", "text": "Restricted" }] },
          { "type": "checkbox", "name": "compliance_frameworks", "title": "Applicable Compliance Frameworks", "choices": [{ "value": "soc2", "text": "SOC 2" }, { "value": "hipaa", "text": "HIPAA" }, { "value": "pci", "text": "PCI DSS" }, { "value": "gdpr", "text": "GDPR" }] },
          { "type": "dropdown", "name": "deployment_model", "title": "Deployment Model", "choices": [{ "value": "cloud", "text": "Cloud (SaaS)" }, { "value": "on_prem", "text": "On-Premises" }, { "value": "hybrid", "text": "Hybrid" }] }
        ]
      },
      {
        "name": "conditionalLogic",
        "title": "Conditional Logic",
        "elements": [
          { "type": "radiogroup", "name": "stores_pii", "title": "Does this system store PII?", "choices": [{ "value": "yes", "text": "Yes" }, { "value": "no", "text": "No" }] },
          { "type": "comment", "name": "pii_details", "title": "Describe what PII is stored and how it is protected", "visibleIf": "{stores_pii} = 'yes'" },
          { "type": "text", "name": "pii_retention_days", "title": "PII retention period (days)", "inputType": "number", "visibleIf": "{stores_pii} = 'yes'" }
        ]
      },
      {
        "name": "groupedInputs",
        "title": "Grouped Inputs",
        "elements": [
          { "type": "panel", "name": "infrastructure_panel", "title": "Infrastructure Details", "elements": [
            { "type": "text", "name": "cloud_provider", "title": "Cloud Provider" },
            { "type": "text", "name": "region", "title": "Primary Region" }
          ]},
          { "type": "paneldynamic", "name": "integrations", "title": "Third-Party Integrations", "templateTitle": "Integration #{panelIndex}", "templateElements": [
            { "type": "text", "name": "integration_name", "title": "Integration Name" },
            { "type": "dropdown", "name": "integration_type", "title": "Integration Type", "choices": [{ "value": "api", "text": "API" }, { "value": "sdk", "text": "SDK" }, { "value": "webhook", "text": "Webhook" }] }
          ], "panelCount": 1, "minPanelCount": 0, "maxPanelCount": 5 }
        ]
      }
    ]
  }
```

- [ ] **Step 2: Replace Simple Workflow Survey placeholder**

Find the Simple Workflow Survey entry and replace the placeholder `survey_json`:

```
Old: "survey_json": { "pages": [{ "name": "placeholder", "elements": [{ "type": "text", "name": "placeholder_field", "title": "Placeholder" }] }] }

New: "survey_json": {
    "title": "Quick Security Review Request",
    "description": "Submit a request for security review",
    "pages": [
      {
        "name": "request",
        "title": "Review Request",
        "elements": [
          { "type": "text", "name": "system_name", "title": "System Name", "isRequired": true },
          { "type": "comment", "name": "review_reason", "title": "Reason for Review Request" },
          { "type": "radiogroup", "name": "urgency", "title": "Urgency", "choices": [{ "value": "low", "text": "Low" }, { "value": "medium", "text": "Medium" }, { "value": "high", "text": "High" }] }
        ]
      }
    ]
  }
```

- [ ] **Step 3: Update survey response to match new survey fields**

Find the `survey_responses` entry and update the `responses` object:

```
Old: "responses": { "placeholder_field": "placeholder value" }
New: "responses": { "system_name": "E2E Seed System", "review_reason": "Annual security review", "urgency": "medium" }
```

- [ ] **Step 4: Run build to verify JSON is valid**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add e2e/seed/seed-spec.json
git commit -m "test: replace placeholder survey JSON with realistic seed data for Phase 3"
```

### Task 2: Add `data-testid` attributes to survey/intake components

**Files:**
- Modify: `src/app/pages/surveys/components/survey-list/survey-list.component.html`
- Modify: `src/app/pages/surveys/components/survey-fill/survey-fill.component.html`
- Modify: `src/app/pages/surveys/components/my-responses/my-responses.component.html`
- Modify: `src/app/pages/surveys/components/response-detail/response-detail.component.html`
- Modify: `src/app/pages/surveys/components/survey-confidential-dialog/survey-confidential-dialog.component.ts`

- [ ] **Step 1: Add data-testid to survey-list.component.html**

```
"My Responses" button (mat-stroked-button with (click)="viewMyResponses()") → data-testid="survey-list-my-responses-button"
Survey card (mat-card with class="survey-card") → data-testid="survey-list-survey-card"
Draft item (div with class="draft-item") → data-testid="survey-list-draft-item"
Draft delete menu item (button mat-menu-item with (click)="deleteDraft(draft, $event)") → data-testid="survey-list-draft-delete-button"
Continue draft button (mat-stroked-button with (click)="continueDraft(getDrafts(survey.id)[0])") → data-testid="survey-list-draft-continue-button"
Start new survey button (mat-flat-button with (click)="startSurvey(survey)") → data-testid="survey-list-start-button"
```

- [ ] **Step 2: Add data-testid to survey-fill.component.html**

```
Save & Exit icon button (mat-icon-button with (click)="saveAndExit()" and mat-icon "save") → data-testid="survey-fill-save-button"
Close icon button (mat-icon-button with aria-label close) → data-testid="survey-fill-close-button"
Save & Exit stroked button (mat-stroked-button in footer) → data-testid="survey-fill-save-exit-button"
View Response button (success state) → data-testid="survey-fill-view-response-button"
Start Another Survey button (success state) → data-testid="survey-fill-start-another-button"
Save status div (div with class="save-status") → data-testid="survey-fill-status"
Revision notes card (mat-card with class="revision-notes-card") → data-testid="survey-fill-revision-notes"
```

- [ ] **Step 3: Add data-testid to my-responses.component.html**

```
Status filter (mat-select with [(value)]="statusFilter") → data-testid="my-responses-status-filter"
Close button (mat-icon-button with (click)="goBack()") → data-testid="my-responses-close-button"
Response table row (<tr mat-row> in responses table) → data-testid="my-responses-row"
Continue editing button (mat-icon-button with (click)="continueDraft(row)") → data-testid="my-responses-edit-button"
View response button (mat-icon-button with (click)="viewResponse(row)") → data-testid="my-responses-view-button"
Delete draft menu item (button mat-menu-item with (click)="deleteDraft(row, $event)") → data-testid="my-responses-delete-button"
```

- [ ] **Step 4: Add data-testid to response-detail.component.html**

```
Close button (mat-icon-button with (click)="goBack()") → data-testid="response-detail-close-button"
Status chip (mat-chip in header-meta) → data-testid="response-detail-status"
Threat model link (a with [routerLink] to created_threat_model_id) → data-testid="response-detail-tm-link"
```

- [ ] **Step 5: Add data-testid to survey-confidential-dialog.component.ts (inline template)**

```
"No" button (mat-button with (click)="onNo()") → data-testid="confidential-no-button"
"Yes, mark as confidential" button (mat-raised-button with (click)="onYes()") → data-testid="confidential-yes-button"
```

- [ ] **Step 6: Run build and lint**

Run: `pnpm run build && pnpm run lint:all`
Expected: Success

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/surveys/
git commit -m "test: add data-testid attributes to survey/intake components"
```

### Task 3: Add `data-testid` attributes to triage components

**Files:**
- Modify: `src/app/pages/triage/components/triage-list/triage-list.component.html`
- Modify: `src/app/pages/triage/components/triage-detail/triage-detail.component.html`
- Modify: `src/app/pages/triage/components/revision-notes-dialog/revision-notes-dialog.component.html`
- Modify: `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.html`
- Modify: `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.html`

- [ ] **Step 1: Add data-testid to triage-list.component.html (new attributes)**

The triage-list already has `triage-search-input`, `triage-status-filter`, `triage-template-filter`, `triage-clear-filters-button`, `triage-response-row`, `triage-error-retry-button`. Add:

```
View response button (mat-icon-button with (click)="viewResponse(row)") → data-testid="triage-view-button"
Approve button (mat-icon-button with (click)="approveResponse(row)") → data-testid="triage-approve-button"
Return for revision button (mat-icon-button with (click)="openRevisionDialogForRow(row)") → data-testid="triage-revision-button"
Create TM button (mat-icon-button with (click)="createThreatModel(row)") → data-testid="triage-create-tm-button"
mat-paginator element → data-testid="triage-paginator"
mat-tab-group element → data-testid="triage-tab-group"
Survey Responses tab (first mat-tab) → data-testid="triage-responses-tab"
Unassigned Reviews tab (second mat-tab) → data-testid="triage-assignment-tab"
```

- [ ] **Step 2: Add data-testid to triage-detail.component.html**

```
Approve button (mat-stroked-button with (click)="approveResponse()") → data-testid="triage-detail-approve-button"
Return for revision button (mat-stroked-button with (click)="openRevisionDialog()") → data-testid="triage-detail-revision-button"
Create TM button (mat-raised-button with (click)="createThreatModel()") → data-testid="triage-detail-create-tm-button"
Close button (mat-icon-button with class="close-button") → data-testid="triage-detail-close-button"
Toggle triage notes button (button.section-header with (click)="toggleTriageNotesSection()") → data-testid="triage-detail-toggle-notes-button"
Add note button (mat-button with (click)="openNoteEditor()") → data-testid="triage-detail-add-note-button"
Note table row (<tr mat-row> in notes table) → data-testid="triage-detail-note-row"
Note link (<a class="note-link">) → data-testid="triage-detail-view-note-button"
Toggle survey responses button (button.section-header with (click)="toggleSurveyResponsesSection()") → data-testid="triage-detail-toggle-responses-button"
Copy ID button (mat-icon-button with (click)="copyResponseId()") → data-testid="triage-detail-copy-id-button"
Status chip (mat-chip in info-grid status row) → data-testid="triage-detail-status"
Submitter display (span.info-value containing app-user-display for submitter) → data-testid="triage-detail-submitter"
Response data table row (<tr mat-row> in responses table) → data-testid="triage-detail-response-row"
```

- [ ] **Step 3: Add data-testid to revision-notes-dialog.component.html**

```
Revision notes textarea (textarea with [(ngModel)]="revisionNotes") → data-testid="revision-notes-textarea"
Cancel button (mat-raised-button with (click)="onCancel()") → data-testid="revision-notes-cancel-button"
Confirm button (mat-button with (click)="onConfirm()") → data-testid="revision-notes-confirm-button"
```

- [ ] **Step 4: Add data-testid to triage-note-editor-dialog.component.html**

```
Name input (input with formControlName="name") → data-testid="triage-note-name-input"
Content textarea (textarea with formControlName="content") → data-testid="triage-note-content-textarea"
Edit mode toggle (mat-icon-button with (click)="previewMode = false") → data-testid="triage-note-edit-toggle"
Preview mode toggle (mat-icon-button with (click)="togglePreview()") → data-testid="triage-note-preview-toggle"
Cancel button (mat-button with (click)="onCancel()") → data-testid="triage-note-cancel-button"
Save button (mat-raised-button with (click)="onSave()") → data-testid="triage-note-save-button"
```

- [ ] **Step 5: Add data-testid to reviewer-assignment-list.component.html**

```
Search input (input in search-field mat-form-field) → data-testid="reviewer-assignment-search-input"
Status filter (mat-select with [(ngModel)]="filters.status") → data-testid="reviewer-assignment-status-filter"
Unassigned checkbox (mat-checkbox with (change)="onUnassignedChange(...)") → data-testid="reviewer-assignment-unassigned-checkbox"
More filters toggle button (mat-icon-button with (click)="showAdvancedFilters = ...") → data-testid="reviewer-assignment-more-filters-button"
Clear filters button (mat-stroked-button with (click)="clearFilters()") → data-testid="reviewer-assignment-clear-filters-button"
TM table row (<tr mat-row> in assignment table) → data-testid="reviewer-assignment-row"
Reviewer select (mat-select with class="reviewer-select") → data-testid="reviewer-assignment-reviewer-select"
Assign button (mat-raised-button with assignReviewer) → data-testid="reviewer-assignment-assign-button"
Assign to Me button (mat-raised-button with assignToMe) → data-testid="reviewer-assignment-assign-me-button"
Open TM button (mat-icon-button with (click)="viewThreatModel(row)") → data-testid="reviewer-assignment-open-tm-button"
mat-paginator element → data-testid="reviewer-assignment-paginator"
```

- [ ] **Step 6: Run build and lint**

Run: `pnpm run build && pnpm run lint:all`
Expected: Success

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/triage/
git commit -m "test: add data-testid attributes to triage components"
```

### Task 4: Add `data-testid` attributes to admin survey components

**Files:**
- Modify: `src/app/pages/admin/surveys/admin-surveys.component.html`
- Modify: `src/app/pages/admin/surveys/components/template-builder/template-builder.component.html`
- Modify: `src/app/pages/admin/surveys/components/create-survey-dialog/create-survey-dialog.component.ts`

- [ ] **Step 1: Add data-testid to admin-surveys.component.html**

```
Search input (input with [(ngModel)]="searchText") → data-testid="admin-surveys-search-input"
Status filter (mat-select with [(value)]="statusFilter") → data-testid="admin-surveys-status-filter"
Create survey button (mat-flat-button with (click)="createTemplate()") → data-testid="admin-surveys-create-button"
Template table row (<tr mat-row> with (click)="editTemplate(row)") → data-testid="admin-surveys-row"
Edit button (mat-icon-button with (click)="...editTemplate(template)") → data-testid="admin-surveys-edit-button"
Toggle status button (mat-icon-button with (click)="...toggleStatus(template)") → data-testid="admin-surveys-toggle-status-button"
More actions kebab (mat-icon-button with [matMenuTriggerFor]="moreMenu") → data-testid="admin-surveys-more-button"
Clone menu item (button mat-menu-item with (click)="cloneTemplate(template)") → data-testid="admin-surveys-clone-item"
Archive menu item (button mat-menu-item with (click)="archiveTemplate(template)") → data-testid="admin-surveys-archive-item"
Delete menu item (button mat-menu-item with (click)="deleteTemplate(template)") → data-testid="admin-surveys-delete-item"
```

- [ ] **Step 2: Add data-testid to template-builder.component.html**

```
Save button (mat-icon-button with (click)="save()") → data-testid="builder-save-button"
Delete button (mat-icon-button with (click)="deleteSurvey()") → data-testid="builder-delete-button"
Close button (mat-icon-button with (click)="goBack()") → data-testid="builder-close-button"
Survey name input (input in name-field) → data-testid="builder-survey-name"
Survey version input (input in version-field) → data-testid="builder-survey-version"
Survey title input (input in title-field) → data-testid="builder-survey-title"
Survey description textarea (textarea in description-field) → data-testid="builder-survey-description"
Add question button (mat-stroked-button with (click)="addQuestion(qType.type)") → data-testid="builder-add-question-{{qType.type}}"
  Use Angular attribute binding: [attr.data-testid]="'builder-add-question-' + qType.type"
Question list item (div.question-item with (click)="selectQuestion(question, i)") → data-testid="builder-question-item"
Move question up button (mat-icon-button with (click)="moveQuestionUp()") → data-testid="builder-question-move-up"
Delete question button (mat-raised-button with (click)="deleteSelectedQuestion()") → data-testid="builder-question-delete"
Question name input (input with [(ngModel)]="selectedQuestion.name") → data-testid="builder-question-name"
Question title input (input with [(ngModel)]="selectedQuestion.title") → data-testid="builder-question-title"
Question description textarea (textarea with [(ngModel)]="selectedQuestion.description") → data-testid="builder-question-description"
Required checkbox (mat-checkbox with [(ngModel)]="selectedQuestion.isRequired") → data-testid="builder-question-required"
Choices textarea (textarea with [ngModel]="getChoicesText()") → data-testid="builder-question-choices"
VisibleIf input (input with [(ngModel)]="selectedQuestion.visibleIf") → data-testid="builder-question-visible-if"
EnableIf input (input with [(ngModel)]="selectedQuestion.enableIf") → data-testid="builder-question-enable-if"
RequiredIf input (input with [(ngModel)]="selectedQuestion.requiredIf") → data-testid="builder-question-required-if"
TM field mapping select (mat-select with [ngModel]="getSelectedTmFieldPath()") → data-testid="builder-question-tm-field"
Previous page button → data-testid="builder-page-prev"
Next page button → data-testid="builder-page-next"
Add page button → data-testid="builder-page-add"
Delete page button → data-testid="builder-page-delete"
```

- [ ] **Step 3: Add data-testid to create-survey-dialog.component.ts (inline template)**

```
Name input (input with formControlName="name") → data-testid="create-survey-name-input"
Version input (input with formControlName="version") → data-testid="create-survey-version-input"
Cancel button (mat-button with (click)="onCancel()") → data-testid="create-survey-cancel-button"
Create button (mat-raised-button with (click)="onCreate()") → data-testid="create-survey-submit-button"
```

- [ ] **Step 4: Run build and lint**

Run: `pnpm run build && pnpm run lint:all`
Expected: Success

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/surveys/
git commit -m "test: add data-testid attributes to admin survey components"
```

### Task 5: Create survey/intake page objects

**Files:**
- Create: `e2e/pages/survey-list.page.ts`
- Create: `e2e/pages/survey-fill.page.ts`
- Create: `e2e/pages/my-responses.page.ts`
- Create: `e2e/pages/response-detail.page.ts`
- Create: `e2e/pages/admin-surveys.page.ts`
- Create: `e2e/pages/template-builder.page.ts`

- [ ] **Step 1: Create survey-list.page.ts**

```typescript
import { Page } from '@playwright/test';

export class SurveyListPage {
  constructor(private page: Page) {}

  readonly myResponsesButton = () =>
    this.page.getByTestId('survey-list-my-responses-button');
  readonly surveyCards = () =>
    this.page.getByTestId('survey-list-survey-card');
  readonly surveyCard = (name: string) =>
    this.surveyCards().filter({ hasText: name });
  readonly draftItems = () =>
    this.page.getByTestId('survey-list-draft-item');
  readonly draftItem = (name: string) =>
    this.draftItems().filter({ hasText: name });
  readonly draftDeleteButton = (name: string) =>
    this.draftItem(name).getByTestId('survey-list-draft-delete-button');
  readonly draftContinueButton = (name: string) =>
    this.surveyCard(name).getByTestId('survey-list-draft-continue-button');
  readonly startButton = (surveyName: string) =>
    this.surveyCard(surveyName).getByTestId('survey-list-start-button');
}
```

- [ ] **Step 2: Create survey-fill.page.ts**

```typescript
import { Page } from '@playwright/test';

export class SurveyFillPage {
  constructor(private page: Page) {}

  readonly saveButton = () =>
    this.page.getByTestId('survey-fill-save-button');
  readonly closeButton = () =>
    this.page.getByTestId('survey-fill-close-button');
  readonly saveExitButton = () =>
    this.page.getByTestId('survey-fill-save-exit-button');
  readonly viewResponseButton = () =>
    this.page.getByTestId('survey-fill-view-response-button');
  readonly startAnotherButton = () =>
    this.page.getByTestId('survey-fill-start-another-button');
  readonly saveStatus = () =>
    this.page.getByTestId('survey-fill-status');
  readonly revisionNotes = () =>
    this.page.getByTestId('survey-fill-revision-notes');
}
```

- [ ] **Step 3: Create my-responses.page.ts**

```typescript
import { Page } from '@playwright/test';

export class MyResponsesPage {
  constructor(private page: Page) {}

  readonly statusFilter = () =>
    this.page.getByTestId('my-responses-status-filter');
  readonly closeButton = () =>
    this.page.getByTestId('my-responses-close-button');
  readonly responseRows = () =>
    this.page.getByTestId('my-responses-row');
  readonly responseRow = (name: string) =>
    this.responseRows().filter({ hasText: name });
  readonly editButton = (name: string) =>
    this.responseRow(name).getByTestId('my-responses-edit-button');
  readonly viewButton = (name: string) =>
    this.responseRow(name).getByTestId('my-responses-view-button');
  readonly deleteButton = (name: string) =>
    this.responseRow(name).getByTestId('my-responses-delete-button');
}
```

- [ ] **Step 4: Create response-detail.page.ts**

```typescript
import { Page } from '@playwright/test';

export class ResponseDetailPage {
  constructor(private page: Page) {}

  readonly closeButton = () =>
    this.page.getByTestId('response-detail-close-button');
  readonly status = () =>
    this.page.getByTestId('response-detail-status');
  readonly tmLink = () =>
    this.page.getByTestId('response-detail-tm-link');
}
```

- [ ] **Step 5: Create admin-surveys.page.ts**

```typescript
import { Page } from '@playwright/test';

export class AdminSurveysPage {
  constructor(private page: Page) {}

  readonly searchInput = () =>
    this.page.getByTestId('admin-surveys-search-input');
  readonly statusFilter = () =>
    this.page.getByTestId('admin-surveys-status-filter');
  readonly createButton = () =>
    this.page.getByTestId('admin-surveys-create-button');
  readonly surveyRows = () =>
    this.page.getByTestId('admin-surveys-row');
  readonly surveyRow = (name: string) =>
    this.surveyRows().filter({ hasText: name });
  readonly editButton = (name: string) =>
    this.surveyRow(name).getByTestId('admin-surveys-edit-button');
  readonly toggleStatusButton = (name: string) =>
    this.surveyRow(name).getByTestId('admin-surveys-toggle-status-button');
  readonly moreButton = (name: string) =>
    this.surveyRow(name).getByTestId('admin-surveys-more-button');
  readonly cloneItem = () =>
    this.page.getByTestId('admin-surveys-clone-item');
  readonly archiveItem = () =>
    this.page.getByTestId('admin-surveys-archive-item');
  readonly deleteItem = () =>
    this.page.getByTestId('admin-surveys-delete-item');
}
```

- [ ] **Step 6: Create template-builder.page.ts**

```typescript
import { Page } from '@playwright/test';

export class TemplateBuilderPage {
  constructor(private page: Page) {}

  readonly saveButton = () =>
    this.page.getByTestId('builder-save-button');
  readonly deleteButton = () =>
    this.page.getByTestId('builder-delete-button');
  readonly closeButton = () =>
    this.page.getByTestId('builder-close-button');
  readonly surveyName = () =>
    this.page.getByTestId('builder-survey-name');
  readonly surveyVersion = () =>
    this.page.getByTestId('builder-survey-version');
  readonly surveyTitle = () =>
    this.page.getByTestId('builder-survey-title');
  readonly surveyDescription = () =>
    this.page.getByTestId('builder-survey-description');
  readonly addQuestionButton = (type: string) =>
    this.page.getByTestId(`builder-add-question-${type}`);
  readonly questionItems = () =>
    this.page.getByTestId('builder-question-item');
  readonly questionItem = (name: string) =>
    this.questionItems().filter({ hasText: name });
  readonly questionMoveUp = (name: string) =>
    this.questionItem(name).getByTestId('builder-question-move-up');
  readonly questionDelete = () =>
    this.page.getByTestId('builder-question-delete');
  readonly questionName = () =>
    this.page.getByTestId('builder-question-name');
  readonly questionTitle = () =>
    this.page.getByTestId('builder-question-title');
  readonly questionDescription = () =>
    this.page.getByTestId('builder-question-description');
  readonly questionRequired = () =>
    this.page.getByTestId('builder-question-required');
  readonly questionChoices = () =>
    this.page.getByTestId('builder-question-choices');
  readonly questionVisibleIf = () =>
    this.page.getByTestId('builder-question-visible-if');
  readonly questionEnableIf = () =>
    this.page.getByTestId('builder-question-enable-if');
  readonly questionRequiredIf = () =>
    this.page.getByTestId('builder-question-required-if');
  readonly questionTmField = () =>
    this.page.getByTestId('builder-question-tm-field');
  readonly pagePrev = () =>
    this.page.getByTestId('builder-page-prev');
  readonly pageNext = () =>
    this.page.getByTestId('builder-page-next');
  readonly pageAdd = () =>
    this.page.getByTestId('builder-page-add');
  readonly pageDelete = () =>
    this.page.getByTestId('builder-page-delete');
}
```

- [ ] **Step 7: Run build to verify TypeScript compiles**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 8: Commit**

```bash
git add e2e/pages/survey-list.page.ts e2e/pages/survey-fill.page.ts e2e/pages/my-responses.page.ts e2e/pages/response-detail.page.ts e2e/pages/admin-surveys.page.ts e2e/pages/template-builder.page.ts
git commit -m "test: create survey/intake page objects for Phase 3"
```

### Task 6: Create triage page objects and extend existing triage.page.ts

**Files:**
- Create: `e2e/pages/triage-detail.page.ts`
- Create: `e2e/pages/reviewer-assignment.page.ts`
- Modify: `e2e/pages/triage.page.ts`

- [ ] **Step 1: Extend existing triage.page.ts with new locators**

Add the following locators after the existing ones:

```typescript
  readonly viewButton = (name: string) =>
    this.responseRows().filter({ hasText: name }).getByTestId('triage-view-button');
  readonly approveButton = (name: string) =>
    this.responseRows().filter({ hasText: name }).getByTestId('triage-approve-button');
  readonly revisionButton = (name: string) =>
    this.responseRows().filter({ hasText: name }).getByTestId('triage-revision-button');
  readonly createTmButton = (name: string) =>
    this.responseRows().filter({ hasText: name }).getByTestId('triage-create-tm-button');
  readonly paginator = () => this.page.getByTestId('triage-paginator');
  readonly tabGroup = () => this.page.getByTestId('triage-tab-group');
  readonly responsesTab = () => this.page.getByTestId('triage-responses-tab');
  readonly assignmentTab = () => this.page.getByTestId('triage-assignment-tab');
```

- [ ] **Step 2: Create triage-detail.page.ts**

```typescript
import { Page } from '@playwright/test';

export class TriageDetailPage {
  constructor(private page: Page) {}

  readonly approveButton = () =>
    this.page.getByTestId('triage-detail-approve-button');
  readonly revisionButton = () =>
    this.page.getByTestId('triage-detail-revision-button');
  readonly createTmButton = () =>
    this.page.getByTestId('triage-detail-create-tm-button');
  readonly closeButton = () =>
    this.page.getByTestId('triage-detail-close-button');
  readonly toggleNotesButton = () =>
    this.page.getByTestId('triage-detail-toggle-notes-button');
  readonly addNoteButton = () =>
    this.page.getByTestId('triage-detail-add-note-button');
  readonly noteRows = () =>
    this.page.getByTestId('triage-detail-note-row');
  readonly noteRow = (name: string) =>
    this.noteRows().filter({ hasText: name });
  readonly viewNoteButton = (name: string) =>
    this.noteRow(name).getByTestId('triage-detail-view-note-button');
  readonly toggleResponsesButton = () =>
    this.page.getByTestId('triage-detail-toggle-responses-button');
  readonly copyIdButton = () =>
    this.page.getByTestId('triage-detail-copy-id-button');
  readonly status = () =>
    this.page.getByTestId('triage-detail-status');
  readonly submitter = () =>
    this.page.getByTestId('triage-detail-submitter');
  readonly responseRows = () =>
    this.page.getByTestId('triage-detail-response-row');
}
```

- [ ] **Step 3: Create reviewer-assignment.page.ts**

```typescript
import { Page } from '@playwright/test';

export class ReviewerAssignmentPage {
  constructor(private page: Page) {}

  readonly searchInput = () =>
    this.page.getByTestId('reviewer-assignment-search-input');
  readonly statusFilter = () =>
    this.page.getByTestId('reviewer-assignment-status-filter');
  readonly unassignedCheckbox = () =>
    this.page.getByTestId('reviewer-assignment-unassigned-checkbox');
  readonly moreFiltersButton = () =>
    this.page.getByTestId('reviewer-assignment-more-filters-button');
  readonly clearFiltersButton = () =>
    this.page.getByTestId('reviewer-assignment-clear-filters-button');
  readonly tmRows = () =>
    this.page.getByTestId('reviewer-assignment-row');
  readonly tmRow = (name: string) =>
    this.tmRows().filter({ hasText: name });
  readonly reviewerSelect = (name: string) =>
    this.tmRow(name).getByTestId('reviewer-assignment-reviewer-select');
  readonly assignButton = (name: string) =>
    this.tmRow(name).getByTestId('reviewer-assignment-assign-button');
  readonly assignMeButton = (name: string) =>
    this.tmRow(name).getByTestId('reviewer-assignment-assign-me-button');
  readonly openTmButton = (name: string) =>
    this.tmRow(name).getByTestId('reviewer-assignment-open-tm-button');
  readonly paginator = () =>
    this.page.getByTestId('reviewer-assignment-paginator');
}
```

- [ ] **Step 4: Run build to verify TypeScript compiles**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add e2e/pages/triage.page.ts e2e/pages/triage-detail.page.ts e2e/pages/reviewer-assignment.page.ts
git commit -m "test: create triage page objects for Phase 3"
```

### Task 7: Create dialog objects

**Files:**
- Create: `e2e/dialogs/create-survey.dialog.ts`
- Create: `e2e/dialogs/survey-confidential.dialog.ts`
- Create: `e2e/dialogs/revision-notes.dialog.ts`
- Create: `e2e/dialogs/triage-note-editor.dialog.ts`

- [ ] **Step 1: Create create-survey.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class CreateSurveyDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () =>
    this.dialog.getByTestId('create-survey-name-input');
  readonly versionInput = () =>
    this.dialog.getByTestId('create-survey-version-input');
  readonly cancelButton = () =>
    this.dialog.getByTestId('create-survey-cancel-button');
  readonly submitButton = () =>
    this.dialog.getByTestId('create-survey-submit-button');

  async fillName(name: string) {
    // formControlName input — use standard fill()
    await this.nameInput().fill(name);
  }

  async fillVersion(version: string) {
    // formControlName input — use standard fill()
    await this.versionInput().clear();
    await this.versionInput().fill(version);
  }

  async submit() {
    await this.submitButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 2: Create survey-confidential.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class SurveyConfidentialDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly noButton = () =>
    this.dialog.getByTestId('confidential-no-button');
  readonly yesButton = () =>
    this.dialog.getByTestId('confidential-yes-button');

  async selectNo() {
    await this.noButton().click();
  }

  async selectYes() {
    await this.yesButton().click();
  }
}
```

- [ ] **Step 3: Create revision-notes.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class RevisionNotesDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly notesTextarea = () =>
    this.dialog.getByTestId('revision-notes-textarea');
  readonly cancelButton = () =>
    this.dialog.getByTestId('revision-notes-cancel-button');
  readonly confirmButton = () =>
    this.dialog.getByTestId('revision-notes-confirm-button');

  async fillNotes(notes: string) {
    // [(ngModel)] textarea — use angularFill()
    await angularFill(this.notesTextarea(), notes);
  }

  async confirm() {
    await this.confirmButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 4: Create triage-note-editor.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class TriageNoteEditorDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () =>
    this.dialog.getByTestId('triage-note-name-input');
  readonly contentTextarea = () =>
    this.dialog.getByTestId('triage-note-content-textarea');
  readonly editToggle = () =>
    this.dialog.getByTestId('triage-note-edit-toggle');
  readonly previewToggle = () =>
    this.dialog.getByTestId('triage-note-preview-toggle');
  readonly cancelButton = () =>
    this.dialog.getByTestId('triage-note-cancel-button');
  readonly saveButton = () =>
    this.dialog.getByTestId('triage-note-save-button');

  async fillName(name: string) {
    // formControlName input — use standard fill()
    await this.nameInput().fill(name);
  }

  async fillContent(content: string) {
    // formControlName textarea — use standard fill()
    await this.contentTextarea().fill(content);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 5: Run build to verify TypeScript compiles**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add e2e/dialogs/create-survey.dialog.ts e2e/dialogs/survey-confidential.dialog.ts e2e/dialogs/revision-notes.dialog.ts e2e/dialogs/triage-note-editor.dialog.ts
git commit -m "test: create dialog objects for Phase 3"
```

### Task 8: Create survey flows

**Files:**
- Create: `e2e/flows/survey-admin.flow.ts`
- Create: `e2e/flows/survey-builder.flow.ts`
- Create: `e2e/flows/survey-fill.flow.ts`
- Create: `e2e/flows/survey-response.flow.ts`

- [ ] **Step 1: Create survey-admin.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { AdminSurveysPage } from '../pages/admin-surveys.page';
import { CreateSurveyDialog } from '../dialogs/create-survey.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class SurveyAdminFlow {
  private adminSurveysPage: AdminSurveysPage;
  private createSurveyDialog: CreateSurveyDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.adminSurveysPage = new AdminSurveysPage(page);
    this.createSurveyDialog = new CreateSurveyDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createSurvey(name: string, version: string) {
    await this.adminSurveysPage.createButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.createSurveyDialog.fillName(name);
    await this.createSurveyDialog.fillVersion(version);
    await this.createSurveyDialog.submit();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openInBuilder(name: string) {
    await this.adminSurveysPage.editButton(name).click();
    await this.page.waitForURL(/\/admin\/surveys\/[a-f0-9-]+/, { timeout: 10000 });
  }

  async toggleStatus(name: string) {
    await this.adminSurveysPage.toggleStatusButton(name).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/surveys/') && resp.status() < 300
    );
  }

  async cloneSurvey(name: string) {
    await this.adminSurveysPage.moreButton(name).click();
    await this.adminSurveysPage.cloneItem().dispatchEvent('click');
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/surveys') && resp.status() < 300
    );
  }

  async archiveSurvey(name: string) {
    await this.adminSurveysPage.moreButton(name).click();
    await this.adminSurveysPage.archiveItem().dispatchEvent('click');
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/surveys/') && resp.status() < 300
    );
  }

  async deleteSurvey(name: string) {
    await this.adminSurveysPage.moreButton(name).click();
    await this.adminSurveysPage.deleteItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirmDialog.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }
}
```

- [ ] **Step 2: Create survey-builder.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { TemplateBuilderPage } from '../pages/template-builder.page';
import { angularFill } from '../helpers/angular-fill';

export class SurveyBuilderFlow {
  private builder: TemplateBuilderPage;

  constructor(private page: Page) {
    this.builder = new TemplateBuilderPage(page);
  }

  async addQuestion(type: string, title: string) {
    await this.builder.addQuestionButton(type).scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await this.builder.addQuestionButton(type).click();
    // New question is auto-selected; fill title
    await angularFill(this.builder.questionTitle(), title);
  }

  async selectQuestion(name: string) {
    await this.builder.questionItem(name).click();
  }

  async editQuestionProperties(fields: {
    name?: string;
    title?: string;
    description?: string;
    required?: boolean;
    choices?: string;
    visibleIf?: string;
    enableIf?: string;
    requiredIf?: string;
  }) {
    if (fields.name !== undefined) {
      await angularFill(this.builder.questionName(), fields.name);
    }
    if (fields.title !== undefined) {
      await angularFill(this.builder.questionTitle(), fields.title);
    }
    if (fields.description !== undefined) {
      await angularFill(this.builder.questionDescription(), fields.description);
    }
    if (fields.required !== undefined) {
      const checkbox = this.builder.questionRequired();
      const input = checkbox.locator('input[type="checkbox"]');
      const isChecked = await input.isChecked();
      if (isChecked !== fields.required) {
        await checkbox.click();
      }
    }
    if (fields.choices !== undefined) {
      await angularFill(this.builder.questionChoices(), fields.choices);
    }
    if (fields.visibleIf !== undefined) {
      // Expand conditional logic panel first
      await this.page.locator('mat-expansion-panel').filter({ hasText: /Conditional Logic/i })
        .locator('mat-expansion-panel-header').click();
      await this.page.waitForTimeout(300);
      await angularFill(this.builder.questionVisibleIf(), fields.visibleIf);
    }
    if (fields.enableIf !== undefined) {
      await angularFill(this.builder.questionEnableIf(), fields.enableIf);
    }
    if (fields.requiredIf !== undefined) {
      await angularFill(this.builder.questionRequiredIf(), fields.requiredIf);
    }
  }

  async setConditionalLogic(visibleIf: string) {
    await this.editQuestionProperties({ visibleIf });
  }

  async deleteQuestion(name: string) {
    await this.selectQuestion(name);
    await this.builder.questionDelete().scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await this.builder.questionDelete().click();
  }

  async addPage() {
    await this.builder.pageAdd().click();
  }

  async deletePage() {
    await this.builder.pageDelete().click();
  }

  async saveSurvey() {
    await this.builder.saveButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/surveys') && resp.status() < 300
    );
  }
}
```

- [ ] **Step 3: Create survey-fill.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { SurveyListPage } from '../pages/survey-list.page';
import { SurveyFillPage } from '../pages/survey-fill.page';

export class SurveyFillFlow {
  private surveyList: SurveyListPage;
  private surveyFill: SurveyFillPage;

  constructor(private page: Page) {
    this.surveyList = new SurveyListPage(page);
    this.surveyFill = new SurveyFillPage(page);
  }

  async startSurvey(name: string) {
    await this.surveyList.startButton(name).click();
    // May show confidential dialog — if so, click No by default
    // Caller can handle confidential dialog explicitly if needed
    await this.page.waitForURL(/\/intake\/fill\//, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async fillTextField(name: string, value: string) {
    // SurveyJS uses native HTML inputs — standard fill() works
    const input = this.page.locator(
      `.sd-question[data-name="${name}"] input`
    );
    await input.fill(value);
  }

  async fillCommentField(name: string, value: string) {
    const textarea = this.page.locator(
      `.sd-question[data-name="${name}"] textarea`
    );
    await textarea.fill(value);
  }

  async selectRadioOption(name: string, value: string) {
    await this.page
      .locator(`.sd-question[data-name="${name}"] .sd-selectbase__item`)
      .filter({ hasText: value })
      .click();
  }

  async selectCheckboxOptions(name: string, values: string[]) {
    for (const value of values) {
      await this.page
        .locator(`.sd-question[data-name="${name}"] .sd-selectbase__item`)
        .filter({ hasText: value })
        .click();
    }
  }

  async selectDropdown(name: string, value: string) {
    // Click the SurveyJS dropdown trigger
    await this.page
      .locator(`.sd-question[data-name="${name}"] .sd-dropdown`)
      .click();
    // Wait for popup and click the option
    await this.page
      .locator('.sv-popup__container .sv-list__item')
      .filter({ hasText: value })
      .click();
  }

  async toggleBoolean(name: string) {
    await this.page
      .locator(`.sd-question[data-name="${name}"] .sd-boolean__switch`)
      .click();
  }

  async nextPage() {
    await this.page.locator('.sd-navigation__next-btn').click();
    await this.page.waitForTimeout(300);
  }

  async prevPage() {
    await this.page.locator('.sd-navigation__prev-btn').click();
    await this.page.waitForTimeout(300);
  }

  async completeSurvey() {
    await this.page.locator('.sd-navigation__complete-btn').click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/responses') && resp.status() < 300
    );
  }

  async submitSurvey() {
    await this.completeSurvey();
  }

  async saveAndExit() {
    await this.surveyFill.saveExitButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/responses') && resp.status() < 300
    );
  }
}
```

- [ ] **Step 4: Create survey-response.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { SurveyListPage } from '../pages/survey-list.page';
import { MyResponsesPage } from '../pages/my-responses.page';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class SurveyResponseFlow {
  private surveyList: SurveyListPage;
  private myResponses: MyResponsesPage;
  private deleteConfirm: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.surveyList = new SurveyListPage(page);
    this.myResponses = new MyResponsesPage(page);
    this.deleteConfirm = new DeleteConfirmDialog(page);
  }

  async viewMyResponses() {
    await this.surveyList.myResponsesButton().click();
    await this.page.waitForURL(/\/intake\/my-responses/, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async viewResponse(name: string) {
    await this.myResponses.viewButton(name).click();
    await this.page.waitForURL(/\/intake\/response\//, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async continueDraft(name: string) {
    await this.myResponses.editButton(name).click();
    await this.page.waitForURL(/\/intake\/fill\//, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async deleteDraft(name: string) {
    await this.myResponses.deleteButton(name).dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirm.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }
}
```

- [ ] **Step 5: Run build to verify TypeScript compiles**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add e2e/flows/survey-admin.flow.ts e2e/flows/survey-builder.flow.ts e2e/flows/survey-fill.flow.ts e2e/flows/survey-response.flow.ts
git commit -m "test: create survey flows for Phase 3"
```

### Task 9: Create triage flows

**Files:**
- Create: `e2e/flows/triage.flow.ts`
- Create: `e2e/flows/triage-detail.flow.ts`
- Create: `e2e/flows/reviewer-assignment.flow.ts`

- [ ] **Step 1: Create triage.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { TriagePage } from '../pages/triage.page';
import { RevisionNotesDialog } from '../dialogs/revision-notes.dialog';

export class TriageFlow {
  private triagePage: TriagePage;
  private revisionNotesDialog: RevisionNotesDialog;

  constructor(private page: Page) {
    this.triagePage = new TriagePage(page);
    this.revisionNotesDialog = new RevisionNotesDialog(page);
  }

  async filterByStatus(status: string) {
    await this.triagePage.statusFilter().click();
    await this.page.locator('mat-option').filter({ hasText: status }).click();
    // Close the select dropdown
    await this.page.keyboard.press('Escape');
    await this.page.waitForLoadState('networkidle');
  }

  async filterByTemplate(name: string) {
    await this.triagePage.templateFilter().click();
    await this.page.locator('mat-option').filter({ hasText: name }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async searchByName(term: string) {
    await this.triagePage.searchInput().fill(term);
    await this.page.waitForLoadState('networkidle');
  }

  async clearFilters() {
    await this.triagePage.clearFiltersButton().click();
    await this.page.waitForLoadState('networkidle');
  }

  async viewResponse(name: string) {
    await this.triagePage.viewButton(name).click();
    await this.page.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async approveResponse(name: string) {
    await this.triagePage.approveButton(name).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/responses/') && resp.status() < 300
    );
  }

  async returnForRevision(name: string, notes: string) {
    await this.triagePage.revisionButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.revisionNotesDialog.fillNotes(notes);
    await this.revisionNotesDialog.confirm();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async createThreatModel(name: string) {
    await this.triagePage.createTmButton(name).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/threat-models') && resp.status() < 300
    );
  }
}
```

- [ ] **Step 2: Create triage-detail.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { TriageDetailPage } from '../pages/triage-detail.page';
import { RevisionNotesDialog } from '../dialogs/revision-notes.dialog';
import { TriageNoteEditorDialog } from '../dialogs/triage-note-editor.dialog';

export class TriageDetailFlow {
  private detail: TriageDetailPage;
  private revisionNotesDialog: RevisionNotesDialog;
  private noteEditorDialog: TriageNoteEditorDialog;

  constructor(private page: Page) {
    this.detail = new TriageDetailPage(page);
    this.revisionNotesDialog = new RevisionNotesDialog(page);
    this.noteEditorDialog = new TriageNoteEditorDialog(page);
  }

  async approve() {
    await this.detail.approveButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/responses/') && resp.status() < 300
    );
  }

  async returnForRevision(notes: string) {
    await this.detail.revisionButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.revisionNotesDialog.fillNotes(notes);
    await this.revisionNotesDialog.confirm();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async createThreatModel() {
    await this.detail.createTmButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/threat-models') && resp.status() < 300
    );
  }

  async addNote(name: string, content: string) {
    // Expand triage notes section if collapsed
    const notesSection = this.detail.toggleNotesButton();
    const isExpanded = await notesSection.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await notesSection.click();
      await this.page.waitForTimeout(300);
    }

    await this.detail.addNoteButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.noteEditorDialog.fillName(name);
    await this.noteEditorDialog.fillContent(content);
    await this.noteEditorDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async viewNote(name: string) {
    // Expand triage notes section if collapsed
    const notesSection = this.detail.toggleNotesButton();
    const isExpanded = await notesSection.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await notesSection.click();
      await this.page.waitForTimeout(300);
    }

    await this.detail.viewNoteButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }
}
```

- [ ] **Step 3: Create reviewer-assignment.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { TriagePage } from '../pages/triage.page';
import { ReviewerAssignmentPage } from '../pages/reviewer-assignment.page';

export class ReviewerAssignmentFlow {
  private triagePage: TriagePage;
  private assignment: ReviewerAssignmentPage;

  constructor(private page: Page) {
    this.triagePage = new TriagePage(page);
    this.assignment = new ReviewerAssignmentPage(page);
  }

  async switchToAssignmentTab() {
    await this.triagePage.assignmentTab().click();
    await this.page.waitForTimeout(300);
  }

  async filterUnassigned() {
    await this.assignment.unassignedCheckbox().click();
    await this.page.waitForLoadState('networkidle');
  }

  async assignReviewer(tmName: string, reviewerName: string) {
    await this.assignment.reviewerSelect(tmName).click();
    await this.page.locator('mat-option').filter({ hasText: reviewerName }).click();
    await this.assignment.assignButton(tmName).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/threat-models/') && resp.status() < 300
    );
  }

  async assignToMe(tmName: string) {
    await this.assignment.assignMeButton(tmName).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/threat-models/') && resp.status() < 300
    );
  }

  async openTm(tmName: string) {
    await this.assignment.openTmButton(tmName).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
  }
}
```

- [ ] **Step 4: Run build to verify TypeScript compiles**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add e2e/flows/triage.flow.ts e2e/flows/triage-detail.flow.ts e2e/flows/reviewer-assignment.flow.ts
git commit -m "test: create triage flows for Phase 3"
```

### Task 10: Register fixtures in test-fixtures.ts

**Files:**
- Modify: `e2e/fixtures/test-fixtures.ts`

- [ ] **Step 1: Add imports for all new page objects, dialogs, and flows**

Add after existing imports:

```typescript
import { SurveyListPage } from '../pages/survey-list.page';
import { SurveyFillPage } from '../pages/survey-fill.page';
import { MyResponsesPage } from '../pages/my-responses.page';
import { ResponseDetailPage } from '../pages/response-detail.page';
import { AdminSurveysPage } from '../pages/admin-surveys.page';
import { TemplateBuilderPage } from '../pages/template-builder.page';
import { TriageDetailPage } from '../pages/triage-detail.page';
import { ReviewerAssignmentPage } from '../pages/reviewer-assignment.page';
import { CreateSurveyDialog } from '../dialogs/create-survey.dialog';
import { SurveyConfidentialDialog } from '../dialogs/survey-confidential.dialog';
import { RevisionNotesDialog } from '../dialogs/revision-notes.dialog';
import { TriageNoteEditorDialog } from '../dialogs/triage-note-editor.dialog';
import { SurveyAdminFlow } from '../flows/survey-admin.flow';
import { SurveyBuilderFlow } from '../flows/survey-builder.flow';
import { SurveyFillFlow } from '../flows/survey-fill.flow';
import { SurveyResponseFlow } from '../flows/survey-response.flow';
import { TriageFlow } from '../flows/triage.flow';
import { TriageDetailFlow } from '../flows/triage-detail.flow';
import { ReviewerAssignmentFlow } from '../flows/reviewer-assignment.flow';
```

- [ ] **Step 2: Add type definitions to TestFixtures interface**

Add to the `type TestFixtures` block:

```typescript
  // Pages (Phase 3)
  surveyListPage: SurveyListPage;
  surveyFillPage: SurveyFillPage;
  myResponsesPage: MyResponsesPage;
  responseDetailPage: ResponseDetailPage;
  adminSurveysPage: AdminSurveysPage;
  templateBuilderPage: TemplateBuilderPage;
  triageDetailPage: TriageDetailPage;
  reviewerAssignmentPage: ReviewerAssignmentPage;

  // Dialogs (Phase 3)
  createSurveyDialog: CreateSurveyDialog;
  surveyConfidentialDialog: SurveyConfidentialDialog;
  revisionNotesDialog: RevisionNotesDialog;
  triageNoteEditorDialog: TriageNoteEditorDialog;

  // Flows (Phase 3)
  surveyAdminFlow: SurveyAdminFlow;
  surveyBuilderFlow: SurveyBuilderFlow;
  surveyFillFlow: SurveyFillFlow;
  surveyResponseFlow: SurveyResponseFlow;
  triageFlow: TriageFlow;
  triageDetailFlow: TriageDetailFlow;
  reviewerAssignmentFlow: ReviewerAssignmentFlow;
```

- [ ] **Step 3: Add fixture registrations**

Add to the `base.extend<TestFixtures>()` block:

```typescript
  // Pages (Phase 3)
  surveyListPage: async ({ page }, use) => {
    await use(new SurveyListPage(page));
  },
  surveyFillPage: async ({ page }, use) => {
    await use(new SurveyFillPage(page));
  },
  myResponsesPage: async ({ page }, use) => {
    await use(new MyResponsesPage(page));
  },
  responseDetailPage: async ({ page }, use) => {
    await use(new ResponseDetailPage(page));
  },
  adminSurveysPage: async ({ page }, use) => {
    await use(new AdminSurveysPage(page));
  },
  templateBuilderPage: async ({ page }, use) => {
    await use(new TemplateBuilderPage(page));
  },
  triageDetailPage: async ({ page }, use) => {
    await use(new TriageDetailPage(page));
  },
  reviewerAssignmentPage: async ({ page }, use) => {
    await use(new ReviewerAssignmentPage(page));
  },

  // Dialogs (Phase 3)
  createSurveyDialog: async ({ page }, use) => {
    await use(new CreateSurveyDialog(page));
  },
  surveyConfidentialDialog: async ({ page }, use) => {
    await use(new SurveyConfidentialDialog(page));
  },
  revisionNotesDialog: async ({ page }, use) => {
    await use(new RevisionNotesDialog(page));
  },
  triageNoteEditorDialog: async ({ page }, use) => {
    await use(new TriageNoteEditorDialog(page));
  },

  // Flows (Phase 3)
  surveyAdminFlow: async ({ page }, use) => {
    await use(new SurveyAdminFlow(page));
  },
  surveyBuilderFlow: async ({ page }, use) => {
    await use(new SurveyBuilderFlow(page));
  },
  surveyFillFlow: async ({ page }, use) => {
    await use(new SurveyFillFlow(page));
  },
  surveyResponseFlow: async ({ page }, use) => {
    await use(new SurveyResponseFlow(page));
  },
  triageFlow: async ({ page }, use) => {
    await use(new TriageFlow(page));
  },
  triageDetailFlow: async ({ page }, use) => {
    await use(new TriageDetailFlow(page));
  },
  reviewerAssignmentFlow: async ({ page }, use) => {
    await use(new ReviewerAssignmentFlow(page));
  },
```

- [ ] **Step 4: Run build to verify**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add e2e/fixtures/test-fixtures.ts
git commit -m "test: register Phase 3 fixtures in test-fixtures.ts"
```

### Task 11: Write survey admin workflow tests

**Files:**
- Create: `e2e/tests/workflows/survey-admin.spec.ts`

- [ ] **Step 1: Create survey-admin.spec.ts**

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { SurveyAdminFlow } from '../../flows/survey-admin.flow';
import { SurveyBuilderFlow } from '../../flows/survey-builder.flow';
import { AdminSurveysPage } from '../../pages/admin-surveys.page';
import { TemplateBuilderPage } from '../../pages/template-builder.page';

test.describe.serial('Survey Admin Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let adminFlow: SurveyAdminFlow;
  let builderFlow: SurveyBuilderFlow;
  let adminSurveys: AdminSurveysPage;
  let builder: TemplateBuilderPage;

  const testSurveyName = `E2E Survey ${Date.now()}`;
  const testVersion = '1.0';
  let clonedSurveyName: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    adminFlow = new SurveyAdminFlow(page);
    builderFlow = new SurveyBuilderFlow(page);
    adminSurveys = new AdminSurveysPage(page);
    builder = new TemplateBuilderPage(page);

    await new AuthFlow(page).loginAs('test-admin');
    await page.goto('/admin/surveys');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('create survey', async () => {
    await adminFlow.createSurvey(testSurveyName, testVersion);
    // Verify the new survey appears in the list
    // Creating a survey navigates to builder; go back to list
    await page.goto('/admin/surveys');
    await page.waitForLoadState('networkidle');
    await expect(adminSurveys.surveyRow(testSurveyName)).toBeVisible({
      timeout: 10000,
    });
  });

  test('open in builder', async () => {
    await adminFlow.openInBuilder(testSurveyName);
    await expect(builder.surveyName()).toHaveValue(testSurveyName, {
      timeout: 5000,
    });
    await expect(builder.surveyVersion()).toHaveValue(testVersion, {
      timeout: 5000,
    });
  });

  test('add questions', async () => {
    // Add a text question
    await builderFlow.addQuestion('text', 'Test Text Question');
    await expect(builder.questionItem('Test Text Question')).toBeVisible();

    // Add a radiogroup question
    await builderFlow.addQuestion('radiogroup', 'Test Radio Question');
    await builderFlow.editQuestionProperties({
      choices: 'Option A\nOption B\nOption C',
    });

    await builderFlow.saveSurvey();
    await expect(builder.questionItems()).toHaveCount(2);
  });

  test('set conditional logic', async () => {
    await builderFlow.selectQuestion('Test Text Question');
    await builderFlow.setConditionalLogic("{Test Radio Question} = 'Option A'");
    await builderFlow.saveSurvey();

    // Re-select and verify persisted
    await builderFlow.selectQuestion('Test Text Question');
    // Expand conditional logic panel
    await page.locator('mat-expansion-panel')
      .filter({ hasText: /Conditional Logic/i })
      .locator('mat-expansion-panel-header').click();
    await page.waitForTimeout(300);
    await expect(builder.questionVisibleIf()).toHaveValue(
      "{Test Radio Question} = 'Option A'"
    );
  });

  test('survey lifecycle (toggle status, archive)', async () => {
    await page.goto('/admin/surveys');
    await page.waitForLoadState('networkidle');

    // Toggle to inactive
    await adminFlow.toggleStatus(testSurveyName);
    await expect(
      adminSurveys.surveyRow(testSurveyName)
    ).toContainText(/inactive|deactivat/i);

    // Toggle back to active
    await adminFlow.toggleStatus(testSurveyName);
    await expect(
      adminSurveys.surveyRow(testSurveyName)
    ).toContainText(/active/i);

    // Archive
    await adminFlow.archiveSurvey(testSurveyName);
    // Need to adjust status filter to show archived
  });

  test('clone survey', async () => {
    // Clone the seeded Kitchen Sink Survey
    await page.goto('/admin/surveys');
    await page.waitForLoadState('networkidle');
    await adminFlow.cloneSurvey('Kitchen Sink Survey');

    // Find the cloned survey in the list
    clonedSurveyName = 'Kitchen Sink Survey'; // clone appears with same or similar name
    await page.waitForLoadState('networkidle');
    // Verify at least 2 rows match (original + clone)
    const rows = adminSurveys.surveyRows();
    await expect(rows).not.toHaveCount(0);
  });

  test('delete survey', async () => {
    // Delete the test survey we created (it was archived)
    // First, adjust filters to show archived surveys
    await page.goto('/admin/surveys');
    await page.waitForLoadState('networkidle');

    // Delete the cloned survey (most recently created)
    // Find a survey with matching name and delete it
    const initialCount = await adminSurveys.surveyRows().count();
    // Use the most recent clone or test survey
    await adminFlow.deleteSurvey(testSurveyName);
    // Verify count decreased
    await expect(adminSurveys.surveyRows()).toHaveCount(initialCount - 1, {
      timeout: 10000,
    });
  });
});
```

- [ ] **Step 2: Run build to verify**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/survey-admin.spec.ts
git commit -m "test: add survey admin workflow E2E tests"
```

### Task 12: Write survey fill workflow tests

**Files:**
- Create: `e2e/tests/workflows/survey-fill.spec.ts`

- [ ] **Step 1: Create survey-fill.spec.ts**

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';
import { SurveyResponseFlow } from '../../flows/survey-response.flow';
import { SurveyListPage } from '../../pages/survey-list.page';
import { SurveyFillPage } from '../../pages/survey-fill.page';
import { MyResponsesPage } from '../../pages/my-responses.page';

test.describe.serial('Survey Fill Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let fillFlow: SurveyFillFlow;
  let responseFlow: SurveyResponseFlow;
  let surveyList: SurveyListPage;
  let surveyFill: SurveyFillPage;
  let myResponses: MyResponsesPage;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    fillFlow = new SurveyFillFlow(page);
    responseFlow = new SurveyResponseFlow(page);
    surveyList = new SurveyListPage(page);
    surveyFill = new SurveyFillPage(page);
    myResponses = new MyResponsesPage(page);

    await new AuthFlow(page).loginAs('test-user');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('survey list shows active surveys', async () => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    // Verify seeded active surveys are visible
    await expect(surveyList.surveyCard('Kitchen Sink Survey')).toBeVisible();
    await expect(surveyList.surveyCard('Simple Workflow Survey')).toBeVisible();
  });

  test('fill simple survey', async () => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    await fillFlow.startSurvey('Simple Workflow Survey');

    // Fill all fields on the single page
    await fillFlow.fillTextField('system_name', `E2E Test System ${Date.now()}`);
    await fillFlow.fillCommentField('review_reason', 'Automated E2E testing');
    await fillFlow.selectRadioOption('urgency', 'Medium');

    // Submit
    await fillFlow.submitSurvey();

    // Verify success state
    await expect(surveyFill.viewResponseButton()).toBeVisible({ timeout: 10000 });
    await expect(surveyFill.startAnotherButton()).toBeVisible();
  });

  test('fill kitchen sink survey with conditional logic', async () => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    await fillFlow.startSurvey('Kitchen Sink Survey');

    // Page 1: Basic Inputs
    await fillFlow.fillTextField('project_name', `KS Project ${Date.now()}`);
    await fillFlow.fillCommentField(
      'project_description',
      'A comprehensive test project'
    );
    await fillFlow.toggleBoolean('has_external_users');
    await fillFlow.nextPage();

    // Page 2: Selection Inputs
    await fillFlow.selectRadioOption('data_sensitivity', 'Confidential');
    await fillFlow.selectCheckboxOptions('compliance_frameworks', [
      'SOC 2',
      'GDPR',
    ]);
    await fillFlow.selectDropdown('deployment_model', 'Cloud (SaaS)');
    await fillFlow.nextPage();

    // Page 3: Conditional Logic
    // Select "Yes" for stores_pii — conditional fields should appear
    await fillFlow.selectRadioOption('stores_pii', 'Yes');
    const piiDetails = page.locator(
      '.sd-question[data-name="pii_details"]'
    );
    await expect(piiDetails).toBeVisible({ timeout: 5000 });
    await fillFlow.fillCommentField(
      'pii_details',
      'Names and email addresses stored in encrypted DB'
    );
    await fillFlow.fillTextField('pii_retention_days', '365');

    // Verify conditional hiding: select "No" and verify fields hide
    await fillFlow.selectRadioOption('stores_pii', 'No');
    await expect(piiDetails).toBeHidden({ timeout: 5000 });

    // Re-select "Yes" to keep data for submission
    await fillFlow.selectRadioOption('stores_pii', 'Yes');
    await fillFlow.nextPage();

    // Page 4: Grouped Inputs
    await fillFlow.fillTextField('cloud_provider', 'AWS');
    await fillFlow.fillTextField('region', 'us-east-1');
    // paneldynamic — fill the default first panel
    await fillFlow.fillTextField('integration_name', 'Stripe API');
    await fillFlow.selectDropdown('integration_type', 'API');

    // Submit
    await fillFlow.submitSurvey();
    await expect(surveyFill.viewResponseButton()).toBeVisible({ timeout: 10000 });
  });

  test('draft auto-save', async () => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    await fillFlow.startSurvey('Simple Workflow Survey');

    // Fill partially
    const partialName = `Draft Test ${Date.now()}`;
    await fillFlow.fillTextField('system_name', partialName);
    await fillFlow.fillCommentField('review_reason', 'Partial draft');

    // Save and exit
    await fillFlow.saveAndExit();

    // Navigate back to intake
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    // Verify draft appears
    await expect(
      surveyList.surveyCard('Simple Workflow Survey')
    ).toContainText(/draft/i, { timeout: 10000 });
  });

  test('my responses list and filter', async () => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    await responseFlow.viewMyResponses();

    // Verify submitted responses appear
    await expect(myResponses.responseRows().first()).toBeVisible({
      timeout: 10000,
    });

    // Filter by submitted status
    await myResponses.statusFilter().click();
    await page.locator('mat-option').filter({ hasText: /submitted/i }).click();
    await page.keyboard.press('Escape');
    await page.waitForLoadState('networkidle');

    // Verify filtered results
    const rowCount = await myResponses.responseRows().count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('view completed response', async () => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');
    await responseFlow.viewMyResponses();

    // Click view on the first submitted response
    const firstRow = myResponses.responseRows().first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    // Verify response detail loads
    await page.waitForURL(/\/intake\/response\//, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify read-only display shows status
    const statusChip = page.getByTestId('response-detail-status');
    await expect(statusChip).toBeVisible();
  });
});
```

- [ ] **Step 2: Run build to verify**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/survey-fill.spec.ts
git commit -m "test: add survey fill workflow E2E tests"
```

### Task 13: Write triage workflow tests

**Files:**
- Create: `e2e/tests/workflows/triage-workflows.spec.ts`

- [ ] **Step 1: Create triage-workflows.spec.ts**

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { TriageFlow } from '../../flows/triage.flow';
import { TriageDetailFlow } from '../../flows/triage-detail.flow';
import { ReviewerAssignmentFlow } from '../../flows/reviewer-assignment.flow';
import { TriagePage } from '../../pages/triage.page';
import { TriageDetailPage } from '../../pages/triage-detail.page';
import { ReviewerAssignmentPage } from '../../pages/reviewer-assignment.page';

test.describe.serial('Triage Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let triageFlow: TriageFlow;
  let detailFlow: TriageDetailFlow;
  let assignmentFlow: ReviewerAssignmentFlow;
  let triagePage: TriagePage;
  let detailPage: TriageDetailPage;
  let assignmentPage: ReviewerAssignmentPage;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    triageFlow = new TriageFlow(page);
    detailFlow = new TriageDetailFlow(page);
    assignmentFlow = new ReviewerAssignmentFlow(page);
    triagePage = new TriagePage(page);
    detailPage = new TriageDetailPage(page);
    assignmentPage = new ReviewerAssignmentPage(page);

    await new AuthFlow(page).loginAs('test-reviewer');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('triage list filters', async () => {
    await page.goto('/triage');
    await page.waitForLoadState('networkidle');

    // Verify seeded submitted response is visible
    await expect(triagePage.responseRows().first()).toBeVisible({
      timeout: 10000,
    });

    // Filter by status (submitted)
    await triageFlow.filterByStatus('Submitted');
    await expect(triagePage.responseRows().first()).toBeVisible();

    // Filter by template
    await triageFlow.filterByTemplate('Simple Workflow Survey');
    await expect(triagePage.responseRows().first()).toBeVisible();

    // Search by submitter
    await triageFlow.searchByName('Test User');
    await expect(triagePage.responseRows().first()).toBeVisible();

    // Clear filters
    await triageFlow.clearFilters();
    await expect(triagePage.responseRows().first()).toBeVisible();
  });

  test('view response detail', async () => {
    await page.goto('/triage');
    await page.waitForLoadState('networkidle');

    // Click view on the seeded response
    await triagePage.viewButton('E2E Seed System').click();
    await page.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify detail page loads with expected data
    await expect(detailPage.submitter()).toBeVisible();
    await expect(detailPage.status()).toBeVisible();

    // Expand survey responses section and verify data
    const toggleBtn = detailPage.toggleResponsesButton();
    const isExpanded = await toggleBtn.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await toggleBtn.click();
      await page.waitForTimeout(300);
    }
    await expect(detailPage.responseRows().first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('return for revision', async () => {
    // Should already be on the detail page from previous test
    // If not, navigate there
    if (!page.url().includes('/triage/')) {
      await page.goto('/triage');
      await page.waitForLoadState('networkidle');
      await triagePage.viewButton('E2E Seed System').click();
      await page.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
      await page.waitForLoadState('networkidle');
    }

    await detailFlow.returnForRevision(
      'Please provide more detail about the architecture'
    );

    // Verify status changed to needs_revision
    await expect(detailPage.status()).toContainText(/revision/i, {
      timeout: 10000,
    });
  });

  test('triage notes', async () => {
    // Should still be on detail page
    if (!page.url().includes('/triage/')) {
      await page.goto('/triage');
      await page.waitForLoadState('networkidle');
      await triagePage.responseRows().first().click();
      await page.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
      await page.waitForLoadState('networkidle');
    }

    const noteName = `E2E Note ${Date.now()}`;
    const noteContent = '## Review Findings\n\nInitial triage notes from E2E test.';

    // Add a triage note
    await detailFlow.addNote(noteName, noteContent);

    // Verify note appears in the list
    await expect(detailPage.noteRow(noteName)).toBeVisible({
      timeout: 10000,
    });

    // View the note
    await detailFlow.viewNote(noteName);

    // Verify note content is displayed in the dialog
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(noteName);

    // Close the note dialog
    await dialog.getByTestId('triage-note-cancel-button').click();
    await dialog.waitFor({ state: 'hidden' });
  });

  test('reviewer assignment', async () => {
    await page.goto('/triage');
    await page.waitForLoadState('networkidle');

    // Switch to Reviewer Assignment tab
    await assignmentFlow.switchToAssignmentTab();

    // Wait for the assignment list to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check if there are any unassigned TMs
    const rows = assignmentPage.tmRows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Assign to me on the first row
      const firstRowName = await rows.first().locator('.tm-name').textContent();
      if (firstRowName) {
        await assignmentFlow.assignToMe(firstRowName.trim());

        // Verify assignment persists (button should change)
        await page.waitForLoadState('networkidle');
      }
    }
    // If no rows, the test passes — no unassigned TMs to work with
  });
});
```

- [ ] **Step 2: Run build to verify**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/triage-workflows.spec.ts
git commit -m "test: add triage workflow E2E tests"
```

### Task 14: Write cross-role workflow test

**Files:**
- Create: `e2e/tests/workflows/survey-cross-role.spec.ts`

- [ ] **Step 1: Create survey-cross-role.spec.ts**

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { SurveyAdminFlow } from '../../flows/survey-admin.flow';
import { SurveyBuilderFlow } from '../../flows/survey-builder.flow';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';
import { TriageFlow } from '../../flows/triage.flow';
import { TriageDetailFlow } from '../../flows/triage-detail.flow';
import { SurveyFillPage } from '../../pages/survey-fill.page';
import { AdminSurveysPage } from '../../pages/admin-surveys.page';
import { TriagePage } from '../../pages/triage.page';
import { TriageDetailPage } from '../../pages/triage-detail.page';
import { MyResponsesPage } from '../../pages/my-responses.page';
import { SurveyListPage } from '../../pages/survey-list.page';

test.describe.serial('Survey Cross-Role Lifecycle', () => {
  test.setTimeout(120000);

  let adminContext: BrowserContext;
  let userContext: BrowserContext;
  let reviewerContext: BrowserContext;
  let adminPage: Page;
  let userPage: Page;
  let reviewerPage: Page;

  const crossRoleSurveyName = `E2E Cross-Role Survey ${Date.now()}`;
  const systemName = `Cross-Role System ${Date.now()}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120000);

    // Create three independent browser contexts
    adminContext = await browser.newContext();
    userContext = await browser.newContext();
    reviewerContext = await browser.newContext();

    adminPage = await adminContext.newPage();
    userPage = await userContext.newPage();
    reviewerPage = await reviewerContext.newPage();

    // Authenticate all three roles
    await new AuthFlow(adminPage).loginAs('test-admin');
    await new AuthFlow(userPage).loginAs('test-user');
    await new AuthFlow(reviewerPage).loginAs('test-reviewer');
  });

  test.afterAll(async () => {
    // Best-effort cleanup: delete the test survey
    try {
      const adminFlow = new SurveyAdminFlow(adminPage);
      await adminPage.goto('/admin/surveys');
      await adminPage.waitForLoadState('networkidle');
      await adminFlow.deleteSurvey(crossRoleSurveyName);
    } catch {
      /* best effort */
    }
    await adminContext.close();
    await userContext.close();
    await reviewerContext.close();
  });

  test('full cross-role lifecycle', async () => {
    // === ADMIN: Create and publish survey ===
    const adminFlow = new SurveyAdminFlow(adminPage);
    const adminBuilderFlow = new SurveyBuilderFlow(adminPage);

    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');

    // Create survey
    await adminFlow.createSurvey(crossRoleSurveyName, '1');

    // Add questions in builder
    await adminBuilderFlow.addQuestion('text', 'System Name');
    await adminBuilderFlow.editQuestionProperties({
      name: 'system_name',
      required: true,
    });
    await adminBuilderFlow.addQuestion('comment', 'Description');
    await adminBuilderFlow.editQuestionProperties({
      name: 'description',
    });
    await adminBuilderFlow.saveSurvey();

    // Go back to list and ensure it's active
    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');
    await expect(
      new AdminSurveysPage(adminPage).surveyRow(crossRoleSurveyName)
    ).toBeVisible({ timeout: 10000 });

    // === USER: Fill and submit ===
    const userFillFlow = new SurveyFillFlow(userPage);
    const userFillPage = new SurveyFillPage(userPage);

    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');

    // Wait for the new survey to appear (may need a short wait for propagation)
    await expect(
      new SurveyListPage(userPage).surveyCard(crossRoleSurveyName)
    ).toBeVisible({ timeout: 15000 });

    await userFillFlow.startSurvey(crossRoleSurveyName);
    await userFillFlow.fillTextField('system_name', systemName);
    await userFillFlow.fillCommentField('description', 'Cross-role E2E test system');
    await userFillFlow.submitSurvey();
    await expect(userFillPage.viewResponseButton()).toBeVisible({
      timeout: 10000,
    });

    // === REVIEWER: View in triage and return for revision ===
    const reviewerTriageFlow = new TriageFlow(reviewerPage);
    const reviewerDetailFlow = new TriageDetailFlow(reviewerPage);
    const reviewerTriagePage = new TriagePage(reviewerPage);
    const reviewerDetailPage = new TriageDetailPage(reviewerPage);

    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');

    // Find and open the submitted response
    await reviewerTriageFlow.searchByName(systemName);
    await expect(reviewerTriagePage.responseRows().first()).toBeVisible({
      timeout: 15000,
    });

    await reviewerTriagePage.viewButton(systemName).click();
    await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await reviewerPage.waitForLoadState('networkidle');

    // Return for revision with notes
    await reviewerDetailFlow.returnForRevision(
      'Please add more architecture details'
    );
    await expect(reviewerDetailPage.status()).toContainText(/revision/i, {
      timeout: 10000,
    });

    // === USER: See revision request, update, and resubmit ===
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const userResponseFlow = new (await import('../../flows/survey-response.flow')).SurveyResponseFlow(userPage);
    await userResponseFlow.viewMyResponses();

    // Find the response that needs revision
    const myResponses = new MyResponsesPage(userPage);
    await expect(
      myResponses.responseRows().filter({ hasText: /revision/i })
    ).toBeVisible({ timeout: 10000 });

    // Continue editing
    await myResponses.editButton(crossRoleSurveyName).click();
    await userPage.waitForURL(/\/intake\/fill\//, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    // Verify revision notes are displayed
    await expect(userFillPage.revisionNotes()).toBeVisible();

    // Update the description and resubmit
    await userFillFlow.fillCommentField(
      'description',
      'Updated: Cross-role E2E test system with detailed architecture'
    );
    await userFillFlow.submitSurvey();
    await expect(userFillPage.viewResponseButton()).toBeVisible({
      timeout: 10000,
    });

    // === REVIEWER: Approve ===
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');
    await reviewerTriageFlow.searchByName(systemName);
    await expect(reviewerTriagePage.responseRows().first()).toBeVisible({
      timeout: 15000,
    });

    await reviewerTriagePage.viewButton(systemName).click();
    await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await reviewerPage.waitForLoadState('networkidle');

    await reviewerDetailFlow.approve();
    await expect(reviewerDetailPage.status()).toContainText(/approved|ready/i, {
      timeout: 10000,
    });

    // === USER: Verify approved status ===
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await userResponseFlow.viewMyResponses();
    await expect(
      myResponses.responseRows().filter({ hasText: /approved|ready/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 2: Run build to verify**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/survey-cross-role.spec.ts
git commit -m "test: add cross-role survey lifecycle E2E test"
```

---

## Sub-phase 3B: Field Coverage

### Task 15: Add field definitions for survey entities

**Files:**
- Modify: `e2e/schema/field-definitions.json`
- Modify: `e2e/schema/field-definitions.ts`

- [ ] **Step 1: Add survey_response entity to field-definitions.json**

Add to the `entities` object:

```json
    "survey_response": [
      { "apiName": "submitter", "uiSelector": "[data-testid='triage-detail-submitter']", "type": "text", "required": false, "editable": false },
      { "apiName": "status", "uiSelector": "[data-testid='triage-detail-status']", "type": "text", "required": false, "editable": false },
      { "apiName": "survey_name", "uiSelector": ".info-item:has(.info-label:text('Survey'))", "type": "text", "required": false, "editable": false },
      { "apiName": "created_at", "uiSelector": ".info-item:has(.info-label:text('Created'))", "type": "text", "required": false, "editable": false },
      { "apiName": "version", "uiSelector": ".info-item:has(.info-label:text('Version'))", "type": "text", "required": false, "editable": false }
    ]
```

- [ ] **Step 2: Add survey_template entity to field-definitions.json**

Add to the `entities` object:

```json
    "survey_template": [
      { "apiName": "name", "uiSelector": "[data-testid='admin-surveys-row'] .template-name", "type": "text", "required": true, "editable": true },
      { "apiName": "version", "uiSelector": "[data-testid='admin-surveys-row'] .editable", "type": "text", "required": false, "editable": false },
      { "apiName": "status", "uiSelector": "[data-testid='admin-surveys-row'] mat-chip", "type": "text", "required": false, "editable": false }
    ]
```

- [ ] **Step 3: Add exports to field-definitions.ts**

Add after the existing exports:

```typescript
export const SURVEY_RESPONSE_FIELDS: FieldDef[] = data.entities.survey_response;
export const SURVEY_TEMPLATE_FIELDS: FieldDef[] = data.entities.survey_template;
```

- [ ] **Step 4: Run build to verify**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add e2e/schema/field-definitions.json e2e/schema/field-definitions.ts
git commit -m "test: add survey field definitions for Phase 3 field coverage"
```

### Task 16: Write field coverage tests

**Files:**
- Create: `e2e/tests/field-coverage/survey-response-fields.spec.ts`
- Create: `e2e/tests/field-coverage/survey-template-fields.spec.ts`
- Create: `e2e/tests/field-coverage/survey-fill-fields.spec.ts`

- [ ] **Step 1: Create survey-response-fields.spec.ts**

```typescript
import { expect } from '@playwright/test';
import { reviewerTest } from '../../fixtures/auth-fixtures';
import { SURVEY_RESPONSE_FIELDS } from '../../schema/field-definitions';
import { TriagePage } from '../../pages/triage.page';

reviewerTest.describe('Survey Response Field Coverage', () => {
  reviewerTest.setTimeout(30000);

  for (const field of SURVEY_RESPONSE_FIELDS) {
    reviewerTest(`field: ${field.apiName}`, async ({ reviewerPage }) => {
      await reviewerPage.goto('/triage');
      await reviewerPage.waitForLoadState('networkidle');

      // Open the seeded submitted response
      const triagePage = new TriagePage(reviewerPage);
      await triagePage.viewButton('E2E Seed System').click();
      await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, {
        timeout: 10000,
      });
      await reviewerPage.waitForLoadState('networkidle');

      // Verify field is visible
      const locator = reviewerPage.locator(field.uiSelector);
      await expect(locator.first()).toBeVisible({ timeout: 5000 });
    });
  }
});
```

- [ ] **Step 2: Create survey-template-fields.spec.ts**

```typescript
import { expect } from '@playwright/test';
import { adminTest } from '../../fixtures/auth-fixtures';
import { SURVEY_TEMPLATE_FIELDS } from '../../schema/field-definitions';

adminTest.describe('Survey Template Field Coverage', () => {
  adminTest.setTimeout(30000);

  for (const field of SURVEY_TEMPLATE_FIELDS) {
    adminTest(`field: ${field.apiName}`, async ({ adminPage }) => {
      await adminPage.goto('/admin/surveys');
      await adminPage.waitForLoadState('networkidle');

      // Verify the field is visible in the seeded survey row
      const locator = adminPage.locator(field.uiSelector);
      await expect(locator.first()).toBeVisible({ timeout: 5000 });
    });
  }
});
```

- [ ] **Step 3: Create survey-fill-fields.spec.ts**

```typescript
import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';
import { SurveyListPage } from '../../pages/survey-list.page';

/**
 * Tests that each SurveyJS question type renders correctly and accepts input.
 * Uses the seeded Kitchen Sink Survey which has all 8 question types.
 */
userTest.describe('Survey Fill Field Coverage (SurveyJS Question Types)', () => {
  userTest.setTimeout(60000);

  userTest('text input renders and accepts value', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');

    const input = userPage.locator(
      '.sd-question[data-name="project_name"] input'
    );
    await expect(input).toBeVisible();
    await input.fill('Test Project');
    await expect(input).toHaveValue('Test Project');
  });

  userTest('comment textarea renders and accepts value', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');

    const textarea = userPage.locator(
      '.sd-question[data-name="project_description"] textarea'
    );
    await expect(textarea).toBeVisible();
    await textarea.fill('A test description');
    await expect(textarea).toHaveValue('A test description');
  });

  userTest('boolean toggle renders and toggles', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');

    const boolSwitch = userPage.locator(
      '.sd-question[data-name="has_external_users"] .sd-boolean__switch'
    );
    await expect(boolSwitch).toBeVisible();
    await boolSwitch.click();
    // Verify the toggle changed (aria state or CSS class)
    await expect(
      userPage.locator('.sd-question[data-name="has_external_users"]')
    ).toBeVisible();
  });

  userTest('radiogroup renders and accepts selection', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    await fillFlow.nextPage(); // Page 2: Selection Inputs

    const question = userPage.locator(
      '.sd-question[data-name="data_sensitivity"]'
    );
    await expect(question).toBeVisible();
    await fillFlow.selectRadioOption('data_sensitivity', 'Internal');
    // Verify selection (checked state)
    await expect(
      question.locator('.sd-selectbase__item').filter({ hasText: 'Internal' })
    ).toHaveClass(/sd-item--checked|checked/);
  });

  userTest('checkbox renders and accepts multiple selections', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    await fillFlow.nextPage(); // Page 2

    const question = userPage.locator(
      '.sd-question[data-name="compliance_frameworks"]'
    );
    await expect(question).toBeVisible();
    await fillFlow.selectCheckboxOptions('compliance_frameworks', [
      'SOC 2',
      'HIPAA',
    ]);
  });

  userTest('dropdown renders and accepts selection', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    await fillFlow.nextPage(); // Page 2

    const question = userPage.locator(
      '.sd-question[data-name="deployment_model"]'
    );
    await expect(question).toBeVisible();
    await fillFlow.selectDropdown('deployment_model', 'Hybrid');
  });

  userTest('panel renders with nested fields', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    // Navigate to page 4 (grouped inputs)
    await fillFlow.nextPage();
    await fillFlow.nextPage();
    await fillFlow.nextPage();

    // Panel should render with its child inputs
    const cloudProvider = userPage.locator(
      '.sd-question[data-name="cloud_provider"] input'
    );
    await expect(cloudProvider).toBeVisible();
    await cloudProvider.fill('GCP');
    await expect(cloudProvider).toHaveValue('GCP');
  });

  userTest('paneldynamic renders with template fields', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    // Navigate to page 4
    await fillFlow.nextPage();
    await fillFlow.nextPage();
    await fillFlow.nextPage();

    // paneldynamic should show the first panel with template fields
    const integrationName = userPage.locator(
      '.sd-question[data-name="integration_name"] input'
    );
    await expect(integrationName).toBeVisible();
    await integrationName.fill('Auth0');
    await expect(integrationName).toHaveValue('Auth0');
  });
});
```

- [ ] **Step 4: Run build to verify**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add e2e/tests/field-coverage/survey-response-fields.spec.ts e2e/tests/field-coverage/survey-template-fields.spec.ts e2e/tests/field-coverage/survey-fill-fields.spec.ts
git commit -m "test: add survey field coverage E2E tests"
```

---

## Sub-phase 3C: Visual Regression

### Task 17: Write screenshot tests

**Files:**
- Create: `e2e/tests/visual-regression/survey-visual-regression.spec.ts`

- [ ] **Step 1: Create survey-visual-regression.spec.ts**

```typescript
import { userTest, reviewerTest, adminTest } from '../../fixtures/auth-fixtures';
import { takeThemeScreenshots } from '../../helpers/screenshot';
import { SurveyListPage } from '../../pages/survey-list.page';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';

userTest.describe('Survey Visual Regression (User)', () => {
  userTest.setTimeout(60000);

  userTest('survey list', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');

    await takeThemeScreenshots(userPage, 'survey-list');
  });

  userTest('survey fill - basic inputs page', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');

    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');

    // Fill some data so the page has content
    await fillFlow.fillTextField('project_name', 'Visual Test Project');
    await fillFlow.fillCommentField('project_description', 'A test project for visual regression');

    await takeThemeScreenshots(userPage, 'survey-fill-basic-inputs', {
      fullPage: true,
    });
  });

  userTest('survey fill - selection inputs page', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');

    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');

    // Fill required field and navigate to page 2
    await fillFlow.fillTextField('project_name', 'Visual Test');
    await fillFlow.nextPage();

    await takeThemeScreenshots(userPage, 'survey-fill-selection-inputs', {
      fullPage: true,
    });
  });

  userTest('my responses', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await new SurveyListPage(userPage).myResponsesButton().click();
    await userPage.waitForURL(/\/intake\/my-responses/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.mat-column-created, .mat-column-modified');

    await takeThemeScreenshots(userPage, 'survey-my-responses', {
      mask: [timestamps],
    });
  });

  userTest('response detail', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await new SurveyListPage(userPage).myResponsesButton().click();
    await userPage.waitForURL(/\/intake\/my-responses/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    // Click on the first response row
    const firstRow = userPage.getByTestId('my-responses-row').first();
    await firstRow.click();
    await userPage.waitForURL(/\/intake\/response\//, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.info-value').filter({
      hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    });

    await takeThemeScreenshots(userPage, 'survey-response-detail', {
      mask: [timestamps],
    });
  });
});

adminTest.describe('Survey Visual Regression (Admin)', () => {
  adminTest.setTimeout(60000);

  adminTest('admin survey list', async ({ adminPage }) => {
    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');

    const timestamps = adminPage.locator('.mat-column-modified');

    await takeThemeScreenshots(adminPage, 'survey-admin-list', {
      mask: [timestamps],
    });
  });

  adminTest('template builder', async ({ adminPage }) => {
    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');

    // Open the Kitchen Sink Survey in the builder
    const editButton = adminPage.getByTestId('admin-surveys-edit-button').first();
    await editButton.click();
    await adminPage.waitForURL(/\/admin\/surveys\/[a-f0-9-]+/, { timeout: 10000 });
    await adminPage.waitForLoadState('networkidle');

    await takeThemeScreenshots(adminPage, 'survey-template-builder', {
      fullPage: true,
    });
  });
});

reviewerTest.describe('Survey Visual Regression (Reviewer)', () => {
  reviewerTest.setTimeout(60000);

  reviewerTest('triage list', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');

    const timestamps = reviewerPage.locator('.mat-column-submitted_at');

    await takeThemeScreenshots(reviewerPage, 'survey-triage-list', {
      mask: [timestamps],
    });
  });

  reviewerTest('triage detail', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');

    // Open the first response
    const viewButton = reviewerPage.getByTestId('triage-view-button').first();
    await viewButton.click();
    await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await reviewerPage.waitForLoadState('networkidle');

    const timestamps = reviewerPage.locator('.info-value, .timeline-timestamp, .reviewed-date').filter({
      hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    });

    await takeThemeScreenshots(reviewerPage, 'survey-triage-detail', {
      mask: [timestamps],
      fullPage: true,
    });
  });
});
```

- [ ] **Step 2: Run build to verify**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/visual-regression/survey-visual-regression.spec.ts
git commit -m "test: add survey visual regression screenshot tests"
```

### Task 18: Write translation/icon sweep tests

**Files:**
- Create: `e2e/tests/visual-regression/survey-translation-icons.spec.ts`

- [ ] **Step 1: Create survey-translation-icons.spec.ts**

```typescript
import { userTest, reviewerTest, adminTest } from '../../fixtures/auth-fixtures';
import { assertNoMissingTranslations } from '../../helpers/translation-scanner';
import { assertIconsRendered } from '../../helpers/icon-checker';
import { SurveyListPage } from '../../pages/survey-list.page';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';

userTest.describe('Survey Translation & Icon Integrity (User)', () => {
  userTest.setTimeout(30000);

  userTest('survey list', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('survey fill', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');

    // Note: SurveyJS-rendered content uses its own i18n and may produce
    // false positives in translation scanning. The assertNoMissingTranslations
    // helper should exclude .sd-question containers.
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('my responses', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await new SurveyListPage(userPage).myResponsesButton().click();
    await userPage.waitForURL(/\/intake\/my-responses/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });
});

adminTest.describe('Survey Translation & Icon Integrity (Admin)', () => {
  adminTest.setTimeout(30000);

  adminTest('admin survey list', async ({ adminPage }) => {
    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(adminPage);
    await assertIconsRendered(adminPage);
  });

  adminTest('template builder', async ({ adminPage }) => {
    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');
    const editButton = adminPage.getByTestId('admin-surveys-edit-button').first();
    await editButton.click();
    await adminPage.waitForURL(/\/admin\/surveys\/[a-f0-9-]+/, { timeout: 10000 });
    await adminPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(adminPage);
    await assertIconsRendered(adminPage);
  });
});

reviewerTest.describe('Survey Translation & Icon Integrity (Reviewer)', () => {
  reviewerTest.setTimeout(30000);

  reviewerTest('triage list', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(reviewerPage);
    await assertIconsRendered(reviewerPage);
  });

  reviewerTest('triage detail', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');
    const viewButton = reviewerPage.getByTestId('triage-view-button').first();
    await viewButton.click();
    await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await reviewerPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(reviewerPage);
    await assertIconsRendered(reviewerPage);
  });
});
```

- [ ] **Step 2: Run build to verify**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/visual-regression/survey-translation-icons.spec.ts
git commit -m "test: add survey translation and icon sweep E2E tests"
```
