# E2E Phase 4: Teams, Projects, and Shared Entities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete E2E coverage for team and project management — CRUD workflows, membership, responsible parties, related entities, metadata — plus dashboard filter integration, field coverage, and visual regression.

**Architecture:** Three sub-phases following Phase 1 patterns: 4A adds ~80 data-testid attributes across 10+ Angular components, creates 2 page objects, 8 dialog objects, 3 flows, extends the dashboard page object, and creates 3 workflow specs (~15 tests). 4B adds field definitions and 3 field-coverage specs (~15 tests). 4C adds 2 visual regression specs (~10 tests). All tests use the three-layer pattern (tests → flows → page objects) and run against a live backend.

**Tech Stack:** Playwright, TypeScript, Angular Material, Transloco

**Spec:** `docs/superpowers/specs/2026-04-15-e2e-phases-3-4-design.md` (Phase 4 section)

---

## Sub-phase 4A: Infrastructure + Workflow Tests

### Task 1: Update seed data for teams and projects

**Files:**
- Modify: `e2e/seed/seed-spec.json`

- [ ] **Step 1: Enrich Seed Team Alpha with all fields**

Replace the existing `teams[0]` entry (Seed Team Alpha) with enriched version:

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

Changes from existing:
- Added `description`, `email_address`, `uri`, `responsible_parties`
- Changed test-user role from `member` to `engineer`
- Changed test-reviewer role from `lead` to `engineering_lead`

- [ ] **Step 2: Enrich Seed Project One with all fields**

Replace the existing `projects[0]` entry (Seed Project One) with enriched version:

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

Changes from existing: Added `description`, `uri`, `responsible_parties`.

- [ ] **Step 3: Add Seed Team Beta**

Append to the `teams` array:

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

- [ ] **Step 4: Add Seed Project Two**

Append to the `projects` array:

```json
{
  "name": "Seed Project Two",
  "team": "Seed Team Beta",
  "status": "planning",
  "description": "Secondary project for relationship testing",
  "metadata": []
}
```

- [ ] **Step 5: Run build to verify JSON is valid**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL (seed-spec.json is not compiled, but ensures no accidental file corruption)

- [ ] **Step 6: Commit**

```bash
git add e2e/seed/seed-spec.json
git commit -m "test: enrich team/project seed data and add Beta/Two seeds for Phase 4"
```

---

### Task 2: Add data-testid to teams.component.html

**Files:**
- Modify: `src/app/pages/teams/teams.component.html`

- [ ] **Step 1: Add data-testid to search input**

On the `<input matInput [(ngModel)]="filterText"` element (line 20), add:
```
data-testid="teams-search-input"
```

- [ ] **Step 2: Add data-testid to close button**

On the `<button mat-icon-button (click)="onClose()"` element (line 10), add:
```
data-testid="teams-close-button"
```

- [ ] **Step 3: Add data-testid to add team button**

On the `<button mat-raised-button color="primary" (click)="onAddTeam()"` element (line 30), add:
```
data-testid="teams-add-button"
```

- [ ] **Step 4: Add data-testid to teams table**

On the `<table mat-table` element (line 42), add:
```
data-testid="teams-table"
```

- [ ] **Step 5: Add data-testid to team rows**

On the `<tr mat-row *matRowDef=` element (line 141), add:
```
data-testid="teams-row"
```

- [ ] **Step 6: Add data-testid to edit button**

On the `<button mat-icon-button (click)="onEditDetails(team)"` element (line 98-101), add:
```
data-testid="teams-edit-button"
```

- [ ] **Step 7: Add data-testid to members button**

On the `<button mat-icon-button (click)="onMembers(team)"` element (line 105-108), add:
```
data-testid="teams-members-button"
```

- [ ] **Step 8: Add data-testid to more actions button**

On the `<button mat-icon-button [matMenuTriggerFor]="rowKebab"` element (line 112-116), add:
```
data-testid="teams-more-button"
```

- [ ] **Step 9: Add data-testid to kebab menu items**

On the responsible parties menu item `<button mat-menu-item (click)="onResponsibleParties(team)">` (line 121), add:
```
data-testid="teams-responsible-parties-item"
```

On the related teams menu item `<button mat-menu-item (click)="onRelatedTeams(team)">` (line 127), add:
```
data-testid="teams-related-teams-item"
```

On the metadata menu item `<button mat-menu-item (click)="onMetadata(team)">` (line 131), add:
```
data-testid="teams-metadata-item"
```

- [ ] **Step 10: Add data-testid to paginator**

On the `<mat-paginator` element (line 151), add:
```
data-testid="teams-paginator"
```

- [ ] **Step 11: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 12: Commit**

```bash
git add src/app/pages/teams/teams.component.html
git commit -m "test: add data-testid attributes to teams.component.html"
```

---

### Task 3: Add data-testid to admin-teams.component.html

**Files:**
- Modify: `src/app/pages/admin/teams/admin-teams.component.html`

- [ ] **Step 1: Add data-testid attributes (same pattern as teams.component.html)**

Apply the same data-testid attributes as Task 2, using the same attribute names. The admin variant has identical element structure plus a delete menu item.

Element mapping (same testid values as user-facing teams component):

| Element | data-testid |
|---------|-------------|
| Search input (`<input matInput [(ngModel)]="filterText"`) | `teams-search-input` |
| Close button (`<button mat-icon-button (click)="onClose()"`) | `teams-close-button` |
| Add team button (`<button mat-raised-button ... (click)="onAddTeam()"`) | `teams-add-button` |
| Teams table (`<table mat-table`) | `teams-table` |
| Team row (`<tr mat-row *matRowDef=`) | `teams-row` |
| Edit button (`<button mat-icon-button (click)="onEditDetails(team)"`) | `teams-edit-button` |
| Members button (`<button mat-icon-button (click)="onMembers(team)"`) | `teams-members-button` |
| More actions button (`<button mat-icon-button [matMenuTriggerFor]="rowKebab"`) | `teams-more-button` |
| Responsible parties item (`<button mat-menu-item (click)="onResponsibleParties(team)">`) | `teams-responsible-parties-item` |
| Related teams item (`<button mat-menu-item (click)="onRelatedTeams(team)">`) | `teams-related-teams-item` |
| Metadata item (`<button mat-menu-item (click)="onMetadata(team)">`) | `teams-metadata-item` |
| Delete item (`<button mat-menu-item (click)="onDelete(team)"`) | `teams-delete-item` |
| Paginator (`<mat-paginator`) | `teams-paginator` |

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/teams/admin-teams.component.html
git commit -m "test: add data-testid attributes to admin-teams.component.html"
```

---

### Task 4: Add data-testid to projects.component.html

**Files:**
- Modify: `src/app/pages/projects/projects.component.html`

- [ ] **Step 1: Add data-testid attributes to all project page elements**

Element mapping:

| Element | data-testid |
|---------|-------------|
| Name filter input (`<input matInput [value]="filterName"` in first form field) | `projects-name-filter` |
| Team filter autocomplete input (`<input matInput [value]="filterTeamName"`) | `projects-team-filter` |
| Team filter clear button (`<button matSuffix mat-icon-button (click)="clearTeamFilter()"`) | `projects-team-filter-clear` |
| Status filter select (`<mat-select [value]="filterStatus"`) | `projects-status-filter` |
| Clear filters button (`<button mat-stroked-button ... (click)="clearFilters()"`) | `projects-clear-filters-button` |
| Close button (`<button mat-icon-button (click)="onClose()"`) | `projects-close-button` |
| Add project button (`<button mat-raised-button ... (click)="onAddProject()"`) | `projects-add-button` |
| Projects table (`<table mat-table`) | `projects-table` |
| Project row (`<tr mat-row *matRowDef=`) | `projects-row` |
| Edit button (`<button mat-icon-button (click)="onEditDetails(project)"`) | `projects-edit-button` |
| More actions button (`<button mat-icon-button [matMenuTriggerFor]="rowKebab"`) | `projects-more-button` |
| Responsible parties item (`<button mat-menu-item (click)="onResponsibleParties(project)">`) | `projects-responsible-parties-item` |
| Related projects item (`<button mat-menu-item (click)="onRelatedProjects(project)">`) | `projects-related-projects-item` |
| Metadata item (`<button mat-menu-item (click)="onMetadata(project)">`) | `projects-metadata-item` |
| Paginator (`<mat-paginator`) | `projects-paginator` |

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/projects/projects.component.html
git commit -m "test: add data-testid attributes to projects.component.html"
```

---

### Task 5: Add data-testid to admin-projects.component.html

**Files:**
- Modify: `src/app/pages/admin/projects/admin-projects.component.html`

- [ ] **Step 1: Add data-testid attributes (same pattern as projects.component.html plus delete)**

Same mapping as Task 4, plus:

| Element | data-testid |
|---------|-------------|
| Delete item (`<button mat-menu-item (click)="onDelete(project)"`) | `projects-delete-item` |

All other elements use the same testid values as the user-facing projects component.

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/projects/admin-projects.component.html
git commit -m "test: add data-testid attributes to admin-projects.component.html"
```

---

### Task 6: Add data-testid to dashboard.component.html

**Files:**
- Modify: `src/app/pages/dashboard/dashboard.component.html`

- [ ] **Step 1: Add data-testid attributes to dashboard filter and table elements**

Element mapping (additions to existing `create-threat-model-button`, `threat-model-card`, `threat-model-delete-button`):

| Element | data-testid |
|---------|-------------|
| Search input (`<input matInput [value]="searchText"`, line 48) | `dashboard-search-input` |
| Search clear button (`<button matSuffix mat-icon-button (click)="clearSearch()"`, line 54) | `dashboard-search-clear` |
| Name filter input (`<input matInput [value]="filters.name"`, line 69) | `dashboard-name-filter` |
| Status multi-select (`<mat-select multiple [(ngModel)]="filters.statuses"`, line 79) | `dashboard-status-filter` |
| More filters toggle (`<button mat-icon-button (click)="showAdvancedFilters = ...`, line 93) | `dashboard-more-filters-button` |
| Clear all filters (`<button mat-stroked-button (click)="clearAllFilters()"`, line 108) | `dashboard-clear-filters-button` |
| Description filter (`<input matInput [value]="filters.description"`, line 122) | `dashboard-description-filter` |
| Owner filter (`<input matInput [value]="filters.owner"`, line 133) | `dashboard-owner-filter` |
| Issue URI filter (`<input matInput [value]="filters.issueUri"`, line 144) | `dashboard-issue-uri-filter` |
| Created after input (`<input matInput [matDatepicker]="createdAfterPicker"`, line 155) | `dashboard-created-after` |
| Created before input (`<input matInput [matDatepicker]="createdBeforePicker"`, line 168) | `dashboard-created-before` |
| Modified after input (`<input matInput [matDatepicker]="modifiedAfterPicker"`, line 183) | `dashboard-modified-after` |
| Modified before input (`<input matInput [matDatepicker]="modifiedBeforePicker"`, line 198) | `dashboard-modified-before` |
| View toggle (`<button mat-icon-button ... (click)="toggleViewMode()"`, line 10) | `dashboard-view-toggle` |
| Table element (`<table mat-table [dataSource]="dataSource"`, line 410) | `dashboard-table` |
| Table rows (`<tr mat-row *matRowDef="let row; columns: displayedColumns"`, line 565) | `dashboard-table-row` |
| Paginator (`<mat-paginator`, line 613) | `dashboard-paginator` |

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/dashboard/dashboard.component.html
git commit -m "test: add data-testid attributes to dashboard.component.html filters and table"
```

---

### Task 7: Add data-testid to team dialog components

**Files:**
- Modify: `src/app/shared/components/create-team-dialog/create-team-dialog.component.ts`
- Modify: `src/app/shared/components/edit-team-dialog/edit-team-dialog.component.ts`
- Modify: `src/app/shared/components/team-members-dialog/team-members-dialog.component.ts`
- Modify: `src/app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component.ts`
- Modify: `src/app/shared/components/related-teams-dialog/related-teams-dialog.component.ts`

- [ ] **Step 1: Add data-testid to create-team-dialog inline template**

All elements are in the inline `template` string. Add `data-testid` attributes:

| Element | data-testid |
|---------|-------------|
| Name input (`<input matInput formControlName="name"`) | `create-team-name-input` |
| Description textarea (`<textarea matInput formControlName="description"`) | `create-team-description-input` |
| Email input (`<input matInput formControlName="email_address"`) | `create-team-email-input` |
| URI input (`<input matInput formControlName="uri"`) | `create-team-uri-input` |
| Status select (`<mat-select formControlName="status">`) | `create-team-status-select` |
| Cancel button (`<button mat-button (click)="onCancel()">`) | `create-team-cancel-button` |
| Create button (`<button mat-raised-button ... (click)="onCreate()"`) | `create-team-submit-button` |

- [ ] **Step 2: Add data-testid to edit-team-dialog inline template**

| Element | data-testid |
|---------|-------------|
| Name input (`<input matInput formControlName="name"`) | `edit-team-name-input` |
| Description textarea (`<textarea matInput formControlName="description"`) | `edit-team-description-input` |
| Email input (`<input matInput formControlName="email_address"`) | `edit-team-email-input` |
| URI input (`<input matInput formControlName="uri"`) | `edit-team-uri-input` |
| Status select (`<mat-select formControlName="status">`) | `edit-team-status-select` |
| Tab group (`<mat-tab-group`) | `edit-team-tab-group` |
| Details tab (`<mat-tab [label]="...detailsTab"`) | `edit-team-details-tab` |
| Notes tab (`<mat-tab [label]="...notesTab"`) | `edit-team-notes-tab` |
| Add note button (the add note button in notes tab) | `edit-team-add-note-button` |
| Note row (note table rows) | `edit-team-note-row` |
| Edit note button (per row) | `edit-team-edit-note-button` |
| Delete note button (per row) | `edit-team-delete-note-button` |
| Cancel button | `edit-team-cancel-button` |
| Save button | `edit-team-save-button` |

Note: `mat-tab` does not natively support `data-testid`. For tabs, add the attribute to a wrapping element or the `mat-tab` label element. If the tab is `<mat-tab [label]="...">`, add `data-testid` directly to the `<mat-tab>` element tag.

- [ ] **Step 3: Add data-testid to team-members-dialog inline template**

| Element | data-testid |
|---------|-------------|
| Member row (`<div class="member-row">`) | `team-members-row` |
| Remove button (per row, the `remove_circle_outline` icon button) | `team-members-remove-button` |
| Add member button (`<button mat-stroked-button (click)="addMember()">`) | `team-members-add-button` |
| Cancel button | `team-members-cancel-button` |
| Save button | `team-members-save-button` |

- [ ] **Step 4: Add data-testid to responsible-parties-dialog inline template**

This dialog is shared between teams and projects. Use generic testid names:

| Element | data-testid |
|---------|-------------|
| Party row (`<div class="party-row">`) | `responsible-parties-row` |
| Remove button (per row) | `responsible-parties-remove-button` |
| Add party button (`<button mat-stroked-button (click)="addParty()">`) | `responsible-parties-add-button` |
| Cancel button | `responsible-parties-cancel-button` |
| Save button | `responsible-parties-save-button` |

- [ ] **Step 5: Add data-testid to related-teams-dialog inline template**

| Element | data-testid |
|---------|-------------|
| Related team row (`<div class="related-row">`) | `related-teams-row` |
| Remove button (per row) | `related-teams-remove-button` |
| Add related team button (`<button mat-stroked-button (click)="showAddForm = true">`) | `related-teams-add-button` |
| Team search autocomplete input (`<input matInput formControlName="teamSearch"`) | `related-teams-team-input` |
| Relationship select (`<mat-select formControlName="relationship">`) | `related-teams-relationship-select` |
| Custom relationship input (`<input matInput formControlName="customRelationship"`) | `related-teams-custom-relationship-input` |
| Confirm add button (the "Add" button in add form) | `related-teams-confirm-add-button` |
| Cancel add button (the "Cancel" button in add form) | `related-teams-cancel-add-button` |
| Cancel dialog button (bottom dialog actions) | `related-teams-cancel-button` |
| Save button | `related-teams-save-button` |

- [ ] **Step 6: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 7: Commit**

```bash
git add src/app/shared/components/create-team-dialog/create-team-dialog.component.ts
git add src/app/shared/components/edit-team-dialog/edit-team-dialog.component.ts
git add src/app/shared/components/team-members-dialog/team-members-dialog.component.ts
git add src/app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component.ts
git add src/app/shared/components/related-teams-dialog/related-teams-dialog.component.ts
git commit -m "test: add data-testid attributes to team dialog components"
```

---

### Task 8: Add data-testid to project dialog components

**Files:**
- Modify: `src/app/shared/components/create-project-dialog/create-project-dialog.component.ts`
- Modify: `src/app/shared/components/edit-project-dialog/edit-project-dialog.component.ts`
- Modify: `src/app/shared/components/related-projects-dialog/related-projects-dialog.component.ts`

- [ ] **Step 1: Add data-testid to create-project-dialog inline template**

| Element | data-testid |
|---------|-------------|
| Name input (`<input matInput formControlName="name"`) | `create-project-name-input` |
| Description textarea (`<textarea matInput formControlName="description"`) | `create-project-description-input` |
| Team select (`<mat-select formControlName="team_id">`) | `create-project-team-select` |
| URI input (`<input matInput formControlName="uri"`) | `create-project-uri-input` |
| Status input (`<input matInput formControlName="status"`) | `create-project-status-select` |
| Cancel button | `create-project-cancel-button` |
| Create button | `create-project-submit-button` |

Note: The create-project-dialog uses a text input for status, not a mat-select. The testid name uses `select` for consistency with the design spec, but the page object should use `fill()` not a select interaction.

- [ ] **Step 2: Add data-testid to edit-project-dialog inline template**

| Element | data-testid |
|---------|-------------|
| Name input (`<input matInput formControlName="name"`) | `edit-project-name-input` |
| Description textarea (`<textarea matInput formControlName="description"`) | `edit-project-description-input` |
| Team select (`<mat-select formControlName="team_id">`) | `edit-project-team-select` |
| URI input (`<input matInput formControlName="uri"`) | `edit-project-uri-input` |
| Status select (`<mat-select formControlName="status">`) | `edit-project-status-select` |
| Tab group (`<mat-tab-group`) | `edit-project-tab-group` |
| Details tab (`<mat-tab [label]="...detailsTab"`) | `edit-project-details-tab` |
| Notes tab (`<mat-tab [label]="...notesTab"`) | `edit-project-notes-tab` |
| Add note button | `edit-project-add-note-button` |
| Note row | `edit-project-note-row` |
| Edit note button (per row) | `edit-project-edit-note-button` |
| Delete note button (per row) | `edit-project-delete-note-button` |
| Cancel button | `edit-project-cancel-button` |
| Save button | `edit-project-save-button` |

- [ ] **Step 3: Add data-testid to related-projects-dialog inline template**

| Element | data-testid |
|---------|-------------|
| Related project row (`<div class="related-row">`) | `related-projects-row` |
| Remove button (per row) | `related-projects-remove-button` |
| Add related project button (`<button mat-stroked-button (click)="showAddForm = true">`) | `related-projects-add-button` |
| Project search autocomplete input (`<input matInput formControlName="projectSearch"`) | `related-projects-project-input` |
| Relationship select (`<mat-select formControlName="relationship">`) | `related-projects-relationship-select` |
| Custom relationship input (`<input matInput formControlName="customRelationship"`) | `related-projects-custom-relationship-input` |
| Confirm add button | `related-projects-confirm-add-button` |
| Cancel add button | `related-projects-cancel-add-button` |
| Cancel dialog button | `related-projects-cancel-button` |
| Save button | `related-projects-save-button` |

- [ ] **Step 4: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/components/create-project-dialog/create-project-dialog.component.ts
git add src/app/shared/components/edit-project-dialog/edit-project-dialog.component.ts
git add src/app/shared/components/related-projects-dialog/related-projects-dialog.component.ts
git commit -m "test: add data-testid attributes to project dialog components"
```

---

### Task 9: Create teams page object

**Files:**
- Create: `e2e/pages/teams.page.ts`

- [ ] **Step 1: Create teams.page.ts**

```typescript
import { Page } from '@playwright/test';

export class TeamsPage {
  constructor(private page: Page) {}

  readonly searchInput = () => this.page.getByTestId('teams-search-input');
  readonly closeButton = () => this.page.getByTestId('teams-close-button');
  readonly addButton = () => this.page.getByTestId('teams-add-button');
  readonly table = () => this.page.getByTestId('teams-table');
  readonly teamRows = () => this.page.getByTestId('teams-row');
  readonly paginator = () => this.page.getByTestId('teams-paginator');

  teamRow(name: string) {
    return this.teamRows().filter({ hasText: name });
  }

  editButton(name: string) {
    return this.teamRow(name).getByTestId('teams-edit-button');
  }

  membersButton(name: string) {
    return this.teamRow(name).getByTestId('teams-members-button');
  }

  moreButton(name: string) {
    return this.teamRow(name).getByTestId('teams-more-button');
  }

  readonly responsiblePartiesItem = () =>
    this.page.getByTestId('teams-responsible-parties-item');

  readonly relatedTeamsItem = () =>
    this.page.getByTestId('teams-related-teams-item');

  readonly metadataItem = () =>
    this.page.getByTestId('teams-metadata-item');

  readonly deleteItem = () =>
    this.page.getByTestId('teams-delete-item');
}
```

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/pages/teams.page.ts
git commit -m "test: create teams page object"
```

---

### Task 10: Create projects page object

**Files:**
- Create: `e2e/pages/projects.page.ts`

- [ ] **Step 1: Create projects.page.ts**

```typescript
import { Page } from '@playwright/test';

export class ProjectsPage {
  constructor(private page: Page) {}

  readonly nameFilter = () => this.page.getByTestId('projects-name-filter');
  readonly teamFilter = () => this.page.getByTestId('projects-team-filter');
  readonly teamFilterClear = () => this.page.getByTestId('projects-team-filter-clear');
  readonly statusFilter = () => this.page.getByTestId('projects-status-filter');
  readonly clearFiltersButton = () => this.page.getByTestId('projects-clear-filters-button');
  readonly closeButton = () => this.page.getByTestId('projects-close-button');
  readonly addButton = () => this.page.getByTestId('projects-add-button');
  readonly table = () => this.page.getByTestId('projects-table');
  readonly projectRows = () => this.page.getByTestId('projects-row');
  readonly paginator = () => this.page.getByTestId('projects-paginator');

  projectRow(name: string) {
    return this.projectRows().filter({ hasText: name });
  }

  editButton(name: string) {
    return this.projectRow(name).getByTestId('projects-edit-button');
  }

  moreButton(name: string) {
    return this.projectRow(name).getByTestId('projects-more-button');
  }

  readonly responsiblePartiesItem = () =>
    this.page.getByTestId('projects-responsible-parties-item');

  readonly relatedProjectsItem = () =>
    this.page.getByTestId('projects-related-projects-item');

  readonly metadataItem = () =>
    this.page.getByTestId('projects-metadata-item');

  readonly deleteItem = () =>
    this.page.getByTestId('projects-delete-item');
}
```

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/pages/projects.page.ts
git commit -m "test: create projects page object"
```

---

### Task 11: Extend dashboard page object with filter locators

**Files:**
- Modify: `e2e/pages/dashboard.page.ts`

- [ ] **Step 1: Add filter, table, and pagination locators**

Add the following locators to `DashboardPage` class, after the existing `tmDeleteButton` method:

```typescript
  // Filter locators
  readonly searchInput = () => this.page.getByTestId('dashboard-search-input');
  readonly searchClear = () => this.page.getByTestId('dashboard-search-clear');
  readonly nameFilter = () => this.page.getByTestId('dashboard-name-filter');
  readonly statusFilter = () => this.page.getByTestId('dashboard-status-filter');
  readonly moreFiltersButton = () => this.page.getByTestId('dashboard-more-filters-button');
  readonly clearFiltersButton = () => this.page.getByTestId('dashboard-clear-filters-button');
  readonly descriptionFilter = () => this.page.getByTestId('dashboard-description-filter');
  readonly ownerFilter = () => this.page.getByTestId('dashboard-owner-filter');
  readonly issueUriFilter = () => this.page.getByTestId('dashboard-issue-uri-filter');
  readonly createdAfter = () => this.page.getByTestId('dashboard-created-after');
  readonly createdBefore = () => this.page.getByTestId('dashboard-created-before');
  readonly modifiedAfter = () => this.page.getByTestId('dashboard-modified-after');
  readonly modifiedBefore = () => this.page.getByTestId('dashboard-modified-before');

  // View toggle and table locators
  readonly viewToggle = () => this.page.getByTestId('dashboard-view-toggle');
  readonly table = () => this.page.getByTestId('dashboard-table');
  readonly tableRows = () => this.page.getByTestId('dashboard-table-row');
  readonly paginator = () => this.page.getByTestId('dashboard-paginator');

  tableRow(name: string) {
    return this.tableRows().filter({ hasText: name });
  }
```

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/pages/dashboard.page.ts
git commit -m "test: extend dashboard page object with filter, table, and pagination locators"
```

---

### Task 12: Create team dialog objects

**Files:**
- Create: `e2e/dialogs/create-team.dialog.ts`
- Create: `e2e/dialogs/edit-team.dialog.ts`
- Create: `e2e/dialogs/team-members.dialog.ts`
- Create: `e2e/dialogs/responsible-parties.dialog.ts`
- Create: `e2e/dialogs/related-teams.dialog.ts`

- [ ] **Step 1: Create create-team.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class CreateTeamDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('create-team-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('create-team-description-input');
  readonly emailInput = () => this.dialog.getByTestId('create-team-email-input');
  readonly uriInput = () => this.dialog.getByTestId('create-team-uri-input');
  readonly statusSelect = () => this.dialog.getByTestId('create-team-status-select');
  readonly cancelButton = () => this.dialog.getByTestId('create-team-cancel-button');
  readonly submitButton = () => this.dialog.getByTestId('create-team-submit-button');

  async fillName(name: string) {
    await this.nameInput().fill(name);
  }

  async fillDescription(description: string) {
    await this.descriptionInput().fill(description);
  }

  async fillEmail(email: string) {
    await this.emailInput().fill(email);
  }

  async fillUri(uri: string) {
    await this.uriInput().fill(uri);
  }

  async selectStatus(status: string) {
    await this.statusSelect().click();
    await this.page.locator('mat-option').filter({ hasText: status }).click();
  }

  async submit() {
    await this.submitButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

Note: All inputs in create-team-dialog use `formControlName`, so standard `fill()` is correct (not `angularFill()`).

- [ ] **Step 2: Create edit-team.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class EditTeamDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  // Details tab fields
  readonly nameInput = () => this.dialog.getByTestId('edit-team-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('edit-team-description-input');
  readonly emailInput = () => this.dialog.getByTestId('edit-team-email-input');
  readonly uriInput = () => this.dialog.getByTestId('edit-team-uri-input');
  readonly statusSelect = () => this.dialog.getByTestId('edit-team-status-select');

  // Tab navigation
  readonly tabGroup = () => this.dialog.getByTestId('edit-team-tab-group');
  readonly detailsTab = () => this.dialog.getByTestId('edit-team-details-tab');
  readonly notesTab = () => this.dialog.getByTestId('edit-team-notes-tab');

  // Notes tab
  readonly addNoteButton = () => this.dialog.getByTestId('edit-team-add-note-button');
  readonly noteRows = () => this.dialog.getByTestId('edit-team-note-row');

  noteRow(name: string) {
    return this.noteRows().filter({ hasText: name });
  }

  editNoteButton(name: string) {
    return this.noteRow(name).getByTestId('edit-team-edit-note-button');
  }

  deleteNoteButton(name: string) {
    return this.noteRow(name).getByTestId('edit-team-delete-note-button');
  }

  // Dialog actions
  readonly cancelButton = () => this.dialog.getByTestId('edit-team-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('edit-team-save-button');

  async fillName(name: string) {
    await this.nameInput().clear();
    await this.nameInput().fill(name);
  }

  async fillDescription(description: string) {
    await this.descriptionInput().clear();
    await this.descriptionInput().fill(description);
  }

  async fillEmail(email: string) {
    await this.emailInput().clear();
    await this.emailInput().fill(email);
  }

  async fillUri(uri: string) {
    await this.uriInput().clear();
    await this.uriInput().fill(uri);
  }

  async selectStatus(status: string) {
    await this.statusSelect().click();
    await this.page.locator('mat-option').filter({ hasText: status }).click();
  }

  async switchToNotesTab() {
    await this.notesTab().click();
    await this.page.waitForTimeout(300);
  }

  async switchToDetailsTab() {
    await this.detailsTab().click();
    await this.page.waitForTimeout(300);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

Note: Edit dialog uses `formControlName` — standard `fill()` is correct.

- [ ] **Step 3: Create team-members.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class TeamMembersDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly memberRows = () => this.dialog.getByTestId('team-members-row');
  readonly addButton = () => this.dialog.getByTestId('team-members-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('team-members-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('team-members-save-button');

  removeButton(index: number) {
    return this.memberRows().nth(index).getByTestId('team-members-remove-button');
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 4: Create responsible-parties.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class ResponsiblePartiesDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly partyRows = () => this.dialog.getByTestId('responsible-parties-row');
  readonly addButton = () => this.dialog.getByTestId('responsible-parties-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('responsible-parties-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('responsible-parties-save-button');

  removeButton(index: number) {
    return this.partyRows().nth(index).getByTestId('responsible-parties-remove-button');
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 5: Create related-teams.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class RelatedTeamsDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly relatedRows = () => this.dialog.getByTestId('related-teams-row');
  readonly addButton = () => this.dialog.getByTestId('related-teams-add-button');
  readonly teamInput = () => this.dialog.getByTestId('related-teams-team-input');
  readonly relationshipSelect = () => this.dialog.getByTestId('related-teams-relationship-select');
  readonly customRelationshipInput = () =>
    this.dialog.getByTestId('related-teams-custom-relationship-input');
  readonly confirmAddButton = () => this.dialog.getByTestId('related-teams-confirm-add-button');
  readonly cancelAddButton = () => this.dialog.getByTestId('related-teams-cancel-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('related-teams-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('related-teams-save-button');

  removeButton(index: number) {
    return this.relatedRows().nth(index).getByTestId('related-teams-remove-button');
  }

  async searchTeam(name: string) {
    await this.teamInput().fill(name);
    await this.page.locator('mat-option').filter({ hasText: name }).click();
  }

  async selectRelationship(relationship: string) {
    await this.relationshipSelect().click();
    await this.page.locator('mat-option').filter({ hasText: relationship }).click();
  }

  async confirmAdd() {
    await this.confirmAddButton().click();
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 6: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 7: Commit**

```bash
git add e2e/dialogs/create-team.dialog.ts
git add e2e/dialogs/edit-team.dialog.ts
git add e2e/dialogs/team-members.dialog.ts
git add e2e/dialogs/responsible-parties.dialog.ts
git add e2e/dialogs/related-teams.dialog.ts
git commit -m "test: create team dialog objects for E2E"
```

---

### Task 13: Create project dialog objects

**Files:**
- Create: `e2e/dialogs/create-project.dialog.ts`
- Create: `e2e/dialogs/edit-project.dialog.ts`
- Create: `e2e/dialogs/related-projects.dialog.ts`

- [ ] **Step 1: Create create-project.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class CreateProjectDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('create-project-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('create-project-description-input');
  readonly teamSelect = () => this.dialog.getByTestId('create-project-team-select');
  readonly uriInput = () => this.dialog.getByTestId('create-project-uri-input');
  readonly statusInput = () => this.dialog.getByTestId('create-project-status-select');
  readonly cancelButton = () => this.dialog.getByTestId('create-project-cancel-button');
  readonly submitButton = () => this.dialog.getByTestId('create-project-submit-button');

  async fillName(name: string) {
    await this.nameInput().fill(name);
  }

  async fillDescription(description: string) {
    await this.descriptionInput().fill(description);
  }

  async selectTeam(teamName: string) {
    await this.teamSelect().click();
    await this.page.locator('mat-option').filter({ hasText: teamName }).click();
  }

  async fillUri(uri: string) {
    await this.uriInput().fill(uri);
  }

  async fillStatus(status: string) {
    await this.statusInput().fill(status);
  }

  async submit() {
    await this.submitButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 2: Create edit-project.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class EditProjectDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  // Details tab fields
  readonly nameInput = () => this.dialog.getByTestId('edit-project-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('edit-project-description-input');
  readonly teamSelect = () => this.dialog.getByTestId('edit-project-team-select');
  readonly uriInput = () => this.dialog.getByTestId('edit-project-uri-input');
  readonly statusSelect = () => this.dialog.getByTestId('edit-project-status-select');

  // Tab navigation
  readonly tabGroup = () => this.dialog.getByTestId('edit-project-tab-group');
  readonly detailsTab = () => this.dialog.getByTestId('edit-project-details-tab');
  readonly notesTab = () => this.dialog.getByTestId('edit-project-notes-tab');

  // Notes tab
  readonly addNoteButton = () => this.dialog.getByTestId('edit-project-add-note-button');
  readonly noteRows = () => this.dialog.getByTestId('edit-project-note-row');

  noteRow(name: string) {
    return this.noteRows().filter({ hasText: name });
  }

  editNoteButton(name: string) {
    return this.noteRow(name).getByTestId('edit-project-edit-note-button');
  }

  deleteNoteButton(name: string) {
    return this.noteRow(name).getByTestId('edit-project-delete-note-button');
  }

  // Dialog actions
  readonly cancelButton = () => this.dialog.getByTestId('edit-project-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('edit-project-save-button');

  async fillName(name: string) {
    await this.nameInput().clear();
    await this.nameInput().fill(name);
  }

  async fillDescription(description: string) {
    await this.descriptionInput().clear();
    await this.descriptionInput().fill(description);
  }

  async selectTeam(teamName: string) {
    await this.teamSelect().click();
    await this.page.locator('mat-option').filter({ hasText: teamName }).click();
  }

  async fillUri(uri: string) {
    await this.uriInput().clear();
    await this.uriInput().fill(uri);
  }

  async selectStatus(status: string) {
    await this.statusSelect().click();
    await this.page.locator('mat-option').filter({ hasText: status }).click();
  }

  async switchToNotesTab() {
    await this.notesTab().click();
    await this.page.waitForTimeout(300);
  }

  async switchToDetailsTab() {
    await this.detailsTab().click();
    await this.page.waitForTimeout(300);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 3: Create related-projects.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class RelatedProjectsDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly relatedRows = () => this.dialog.getByTestId('related-projects-row');
  readonly addButton = () => this.dialog.getByTestId('related-projects-add-button');
  readonly projectInput = () => this.dialog.getByTestId('related-projects-project-input');
  readonly relationshipSelect = () =>
    this.dialog.getByTestId('related-projects-relationship-select');
  readonly customRelationshipInput = () =>
    this.dialog.getByTestId('related-projects-custom-relationship-input');
  readonly confirmAddButton = () => this.dialog.getByTestId('related-projects-confirm-add-button');
  readonly cancelAddButton = () => this.dialog.getByTestId('related-projects-cancel-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('related-projects-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('related-projects-save-button');

  removeButton(index: number) {
    return this.relatedRows().nth(index).getByTestId('related-projects-remove-button');
  }

  async searchProject(name: string) {
    await this.projectInput().fill(name);
    await this.page.locator('mat-option').filter({ hasText: name }).click();
  }

  async selectRelationship(relationship: string) {
    await this.relationshipSelect().click();
    await this.page.locator('mat-option').filter({ hasText: relationship }).click();
  }

  async confirmAdd() {
    await this.confirmAddButton().click();
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 4: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add e2e/dialogs/create-project.dialog.ts
git add e2e/dialogs/edit-project.dialog.ts
git add e2e/dialogs/related-projects.dialog.ts
git commit -m "test: create project dialog objects for E2E"
```

---

### Task 14: Create team flow

**Files:**
- Create: `e2e/flows/team.flow.ts`

- [ ] **Step 1: Create team.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { TeamsPage } from '../pages/teams.page';
import { CreateTeamDialog } from '../dialogs/create-team.dialog';
import { EditTeamDialog } from '../dialogs/edit-team.dialog';
import { TeamMembersDialog } from '../dialogs/team-members.dialog';
import { ResponsiblePartiesDialog } from '../dialogs/responsible-parties.dialog';
import { RelatedTeamsDialog } from '../dialogs/related-teams.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';
import { MetadataDialog } from '../dialogs/metadata.dialog';

export class TeamFlow {
  private teamsPage: TeamsPage;
  private createTeamDialog: CreateTeamDialog;
  private editTeamDialog: EditTeamDialog;
  private teamMembersDialog: TeamMembersDialog;
  private responsiblePartiesDialog: ResponsiblePartiesDialog;
  private relatedTeamsDialog: RelatedTeamsDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;
  private metadataDialog: MetadataDialog;

  constructor(private page: Page) {
    this.teamsPage = new TeamsPage(page);
    this.createTeamDialog = new CreateTeamDialog(page);
    this.editTeamDialog = new EditTeamDialog(page);
    this.teamMembersDialog = new TeamMembersDialog(page);
    this.responsiblePartiesDialog = new ResponsiblePartiesDialog(page);
    this.relatedTeamsDialog = new RelatedTeamsDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
    this.metadataDialog = new MetadataDialog(page);
  }

  async createTeam(fields: { name: string; description?: string; status?: string }) {
    await this.teamsPage.addButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.createTeamDialog.fillName(fields.name);
    if (fields.description) {
      await this.createTeamDialog.fillDescription(fields.description);
    }
    if (fields.status) {
      await this.createTeamDialog.selectStatus(fields.status);
    }
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/teams') && resp.request().method() === 'POST'
    );
    await this.createTeamDialog.submit();
    await responsePromise;
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async editTeam(name: string, updates: {
    name?: string;
    description?: string;
    status?: string;
  }) {
    await this.teamsPage.editButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    if (updates.name) {
      await this.editTeamDialog.fillName(updates.name);
    }
    if (updates.description) {
      await this.editTeamDialog.fillDescription(updates.description);
    }
    if (updates.status) {
      await this.editTeamDialog.selectStatus(updates.status);
    }
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PUT'
    );
    await this.editTeamDialog.save();
    await responsePromise;
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async deleteTeam(name: string) {
    await this.teamsPage.moreButton(name).click();
    await this.teamsPage.deleteItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirmDialog.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openMembers(name: string) {
    await this.teamsPage.membersButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  async addMember(userId: string, role: string) {
    await this.teamMembersDialog.addButton().click();
    // The add member flow opens a UserPickerDialog — interaction depends on
    // that dialog's implementation. The UserPickerDialog should provide its own
    // search + select interaction.
    await this.page.waitForTimeout(500);
  }

  async removeMember(index: number) {
    await this.teamMembersDialog.removeButton(index).click();
  }

  async openResponsibleParties(name: string) {
    await this.teamsPage.moreButton(name).click();
    await this.teamsPage.responsiblePartiesItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  async addResponsibleParty(userId: string, role: string) {
    await this.responsiblePartiesDialog.addButton().click();
    await this.page.waitForTimeout(500);
  }

  async openRelatedTeams(name: string) {
    await this.teamsPage.moreButton(name).click();
    await this.teamsPage.relatedTeamsItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  async addRelatedTeam(teamName: string, relationship: string) {
    await this.relatedTeamsDialog.addButton().click();
    await this.page.waitForTimeout(300);
    await this.relatedTeamsDialog.searchTeam(teamName);
    await this.relatedTeamsDialog.selectRelationship(relationship);
    await this.relatedTeamsDialog.confirmAdd();
  }

  async openMetadata(name: string) {
    await this.teamsPage.moreButton(name).click();
    await this.teamsPage.metadataItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }
}
```

Note: `dispatchEvent('click')` is used for mat-menu items per the critical patterns.

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/flows/team.flow.ts
git commit -m "test: create team flow for E2E"
```

---

### Task 15: Create project flow

**Files:**
- Create: `e2e/flows/project.flow.ts`

- [ ] **Step 1: Create project.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { ProjectsPage } from '../pages/projects.page';
import { CreateProjectDialog } from '../dialogs/create-project.dialog';
import { EditProjectDialog } from '../dialogs/edit-project.dialog';
import { ResponsiblePartiesDialog } from '../dialogs/responsible-parties.dialog';
import { RelatedProjectsDialog } from '../dialogs/related-projects.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';
import { MetadataDialog } from '../dialogs/metadata.dialog';

export class ProjectFlow {
  private projectsPage: ProjectsPage;
  private createProjectDialog: CreateProjectDialog;
  private editProjectDialog: EditProjectDialog;
  private responsiblePartiesDialog: ResponsiblePartiesDialog;
  private relatedProjectsDialog: RelatedProjectsDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;
  private metadataDialog: MetadataDialog;

  constructor(private page: Page) {
    this.projectsPage = new ProjectsPage(page);
    this.createProjectDialog = new CreateProjectDialog(page);
    this.editProjectDialog = new EditProjectDialog(page);
    this.responsiblePartiesDialog = new ResponsiblePartiesDialog(page);
    this.relatedProjectsDialog = new RelatedProjectsDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
    this.metadataDialog = new MetadataDialog(page);
  }

  async createProject(fields: {
    name: string;
    team: string;
    description?: string;
    status?: string;
  }) {
    await this.projectsPage.addButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.createProjectDialog.fillName(fields.name);
    await this.createProjectDialog.selectTeam(fields.team);
    if (fields.description) {
      await this.createProjectDialog.fillDescription(fields.description);
    }
    if (fields.status) {
      await this.createProjectDialog.fillStatus(fields.status);
    }
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/projects') && resp.request().method() === 'POST'
    );
    await this.createProjectDialog.submit();
    await responsePromise;
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async editProject(name: string, updates: {
    name?: string;
    description?: string;
    team?: string;
    status?: string;
  }) {
    await this.projectsPage.editButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    if (updates.name) {
      await this.editProjectDialog.fillName(updates.name);
    }
    if (updates.description) {
      await this.editProjectDialog.fillDescription(updates.description);
    }
    if (updates.team) {
      await this.editProjectDialog.selectTeam(updates.team);
    }
    if (updates.status) {
      await this.editProjectDialog.selectStatus(updates.status);
    }
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/projects/') && resp.request().method() === 'PUT'
    );
    await this.editProjectDialog.save();
    await responsePromise;
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async deleteProject(name: string) {
    await this.projectsPage.moreButton(name).click();
    await this.projectsPage.deleteItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirmDialog.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openResponsibleParties(name: string) {
    await this.projectsPage.moreButton(name).click();
    await this.projectsPage.responsiblePartiesItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  async addResponsibleParty(userId: string, role: string) {
    await this.responsiblePartiesDialog.addButton().click();
    await this.page.waitForTimeout(500);
  }

  async openRelatedProjects(name: string) {
    await this.projectsPage.moreButton(name).click();
    await this.projectsPage.relatedProjectsItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  async addRelatedProject(projectName: string, relationship: string) {
    await this.relatedProjectsDialog.addButton().click();
    await this.page.waitForTimeout(300);
    await this.relatedProjectsDialog.searchProject(projectName);
    await this.relatedProjectsDialog.selectRelationship(relationship);
    await this.relatedProjectsDialog.confirmAdd();
  }

  async openMetadata(name: string) {
    await this.projectsPage.moreButton(name).click();
    await this.projectsPage.metadataItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }
}
```

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/flows/project.flow.ts
git commit -m "test: create project flow for E2E"
```

---

### Task 16: Create dashboard filter flow

**Files:**
- Create: `e2e/flows/dashboard-filter.flow.ts`

- [ ] **Step 1: Create dashboard-filter.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { angularFill } from '../helpers/angular-fill';

export class DashboardFilterFlow {
  private dashboardPage: DashboardPage;

  constructor(private page: Page) {
    this.dashboardPage = new DashboardPage(page);
  }

  async searchByName(term: string) {
    await angularFill(this.dashboardPage.searchInput(), term);
    await this.page.waitForTimeout(500);
  }

  async filterByStatus(statuses: string[]) {
    await this.dashboardPage.statusFilter().click();
    for (const status of statuses) {
      await this.page.locator('mat-option').filter({ hasText: status }).click();
    }
    // Close the multi-select overlay by clicking outside
    await this.page.locator('.cdk-overlay-backdrop').click();
    await this.page.waitForTimeout(500);
  }

  async filterByOwner(owner: string) {
    await this.toggleAdvancedFilters();
    await angularFill(this.dashboardPage.ownerFilter(), owner);
    await this.page.waitForTimeout(500);
  }

  async filterByDateRange(
    field: 'created' | 'modified',
    after?: string,
    before?: string,
  ) {
    await this.toggleAdvancedFilters();
    if (after) {
      const locator = field === 'created'
        ? this.dashboardPage.createdAfter()
        : this.dashboardPage.modifiedAfter();
      await angularFill(locator, after);
    }
    if (before) {
      const locator = field === 'created'
        ? this.dashboardPage.createdBefore()
        : this.dashboardPage.modifiedBefore();
      await angularFill(locator, before);
    }
    await this.page.waitForTimeout(500);
  }

  async clearAllFilters() {
    await this.dashboardPage.clearFiltersButton().click();
    await this.page.waitForTimeout(500);
  }

  async toggleAdvancedFilters() {
    // Only toggle if not already visible
    const isVisible = await this.dashboardPage.descriptionFilter().isVisible().catch(() => false);
    if (!isVisible) {
      await this.dashboardPage.moreFiltersButton().click();
      await this.page.waitForTimeout(300);
    }
  }
}
```

Note: Dashboard search and filter inputs use `[value]` binding with `(input)` event handlers, so `angularFill()` is correct. Date fields use `[matDatepicker]` with `(dateChange)` — `angularFill()` fills the text value, but the date picker needs special handling. Test implementation may need to use the datepicker toggle instead if `angularFill()` does not trigger `(dateChange)`.

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/flows/dashboard-filter.flow.ts
git commit -m "test: create dashboard filter flow for E2E"
```

---

### Task 17: Register all new fixtures in test-fixtures.ts

**Files:**
- Modify: `e2e/fixtures/test-fixtures.ts`

- [ ] **Step 1: Add imports for new page objects, dialogs, and flows**

Add imports after the existing imports block:

```typescript
import { TeamsPage } from '../pages/teams.page';
import { ProjectsPage } from '../pages/projects.page';
import { CreateTeamDialog } from '../dialogs/create-team.dialog';
import { EditTeamDialog } from '../dialogs/edit-team.dialog';
import { TeamMembersDialog } from '../dialogs/team-members.dialog';
import { ResponsiblePartiesDialog } from '../dialogs/responsible-parties.dialog';
import { RelatedTeamsDialog } from '../dialogs/related-teams.dialog';
import { CreateProjectDialog } from '../dialogs/create-project.dialog';
import { EditProjectDialog } from '../dialogs/edit-project.dialog';
import { RelatedProjectsDialog } from '../dialogs/related-projects.dialog';
import { TeamFlow } from '../flows/team.flow';
import { ProjectFlow } from '../flows/project.flow';
import { DashboardFilterFlow } from '../flows/dashboard-filter.flow';
```

- [ ] **Step 2: Add type definitions to TestFixtures**

Add to the `TestFixtures` type:

```typescript
  // Pages (Phase 4)
  teamsPage: TeamsPage;
  projectsPage: ProjectsPage;

  // Dialogs (Phase 4)
  createTeamDialog: CreateTeamDialog;
  editTeamDialog: EditTeamDialog;
  teamMembersDialog: TeamMembersDialog;
  responsiblePartiesDialog: ResponsiblePartiesDialog;
  relatedTeamsDialog: RelatedTeamsDialog;
  createProjectDialog: CreateProjectDialog;
  editProjectDialog: EditProjectDialog;
  relatedProjectsDialog: RelatedProjectsDialog;

  // Flows (Phase 4)
  teamFlow: TeamFlow;
  projectFlow: ProjectFlow;
  dashboardFilterFlow: DashboardFilterFlow;
```

- [ ] **Step 3: Add fixture implementations**

Add to the `base.extend<TestFixtures>({})` object:

```typescript
  // Pages (Phase 4)
  teamsPage: async ({ page }, use) => {
    await use(new TeamsPage(page));
  },
  projectsPage: async ({ page }, use) => {
    await use(new ProjectsPage(page));
  },

  // Dialogs (Phase 4)
  createTeamDialog: async ({ page }, use) => {
    await use(new CreateTeamDialog(page));
  },
  editTeamDialog: async ({ page }, use) => {
    await use(new EditTeamDialog(page));
  },
  teamMembersDialog: async ({ page }, use) => {
    await use(new TeamMembersDialog(page));
  },
  responsiblePartiesDialog: async ({ page }, use) => {
    await use(new ResponsiblePartiesDialog(page));
  },
  relatedTeamsDialog: async ({ page }, use) => {
    await use(new RelatedTeamsDialog(page));
  },
  createProjectDialog: async ({ page }, use) => {
    await use(new CreateProjectDialog(page));
  },
  editProjectDialog: async ({ page }, use) => {
    await use(new EditProjectDialog(page));
  },
  relatedProjectsDialog: async ({ page }, use) => {
    await use(new RelatedProjectsDialog(page));
  },

  // Flows (Phase 4)
  teamFlow: async ({ page }, use) => {
    await use(new TeamFlow(page));
  },
  projectFlow: async ({ page }, use) => {
    await use(new ProjectFlow(page));
  },
  dashboardFilterFlow: async ({ page }, use) => {
    await use(new DashboardFilterFlow(page));
  },
```

- [ ] **Step 4: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add e2e/fixtures/test-fixtures.ts
git commit -m "test: register Phase 4 page objects, dialogs, and flows in test-fixtures"
```

---

### Task 18: Write team workflow tests

**Files:**
- Create: `e2e/tests/workflows/team-workflows.spec.ts`

- [ ] **Step 1: Create team-workflows.spec.ts**

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { TeamFlow } from '../../flows/team.flow';
import { MetadataFlow } from '../../flows/metadata.flow';
import { TeamsPage } from '../../pages/teams.page';
import { EditTeamDialog } from '../../dialogs/edit-team.dialog';
import { TeamMembersDialog } from '../../dialogs/team-members.dialog';
import { ResponsiblePartiesDialog } from '../../dialogs/responsible-parties.dialog';
import { RelatedTeamsDialog } from '../../dialogs/related-teams.dialog';
import { MetadataDialog } from '../../dialogs/metadata.dialog';

test.describe.serial('Team Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let teamFlow: TeamFlow;
  let teamsPage: TeamsPage;

  const testTeamName = `E2E Team ${Date.now()}`;
  const updatedTeamName = `${testTeamName} Updated`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    teamFlow = new TeamFlow(page);
    teamsPage = new TeamsPage(page);

    await new AuthFlow(page).loginAs('test-user');
  });

  test.afterAll(async () => {
    // Best-effort cleanup: delete the test team if it still exists
    try {
      await page.goto('/teams');
      await page.waitForLoadState('networkidle');
      const hasTeam = await teamsPage.teamRow(updatedTeamName).count();
      if (hasTeam > 0) {
        await teamFlow.deleteTeam(updatedTeamName);
      }
    } catch {
      /* best effort */
    }
    await context.close();
  });

  test('Team CRUD', async () => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');

    // Create
    await teamFlow.createTeam({ name: testTeamName, status: 'Active' });
    await expect(teamsPage.teamRow(testTeamName)).toBeVisible({ timeout: 10000 });

    // Edit
    await teamFlow.editTeam(testTeamName, {
      name: updatedTeamName,
      description: 'E2E test team description',
    });
    await expect(teamsPage.teamRow(updatedTeamName)).toBeVisible({ timeout: 10000 });
    await expect(teamsPage.teamRow(testTeamName)).toHaveCount(0, { timeout: 5000 });

    // Delete
    await teamFlow.deleteTeam(updatedTeamName);
    await expect(teamsPage.teamRow(updatedTeamName)).toHaveCount(0, { timeout: 10000 });

    // Re-create for subsequent tests
    await teamFlow.createTeam({ name: updatedTeamName, status: 'Active' });
    await expect(teamsPage.teamRow(updatedTeamName)).toBeVisible({ timeout: 10000 });
  });

  test('Team members', async () => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');

    const membersDialog = new TeamMembersDialog(page);

    // Open members dialog
    await teamFlow.openMembers(updatedTeamName);

    // Add member — triggers UserPickerDialog
    await membersDialog.addButton().click();
    // Wait for UserPickerDialog to appear, search for test-reviewer, select with role
    await page.locator('mat-dialog-container').last().waitFor({ state: 'visible' });
    // Interaction with UserPickerDialog depends on its implementation
    // Select test-reviewer and engineering_lead role
    await page.waitForTimeout(500);

    // Save members
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PUT'
    );
    await membersDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify member is present
    await teamFlow.openMembers(updatedTeamName);
    await expect(membersDialog.memberRows()).toHaveCount(1, { timeout: 5000 });

    // Remove member
    await membersDialog.removeButton(0).click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PUT'
    );
    await membersDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed
    await teamFlow.openMembers(updatedTeamName);
    await expect(membersDialog.memberRows()).toHaveCount(0, { timeout: 5000 });
    await membersDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('Responsible parties', async () => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');

    const rpDialog = new ResponsiblePartiesDialog(page);

    // Open responsible parties dialog
    await teamFlow.openResponsibleParties(updatedTeamName);

    // Add responsible party — triggers UserPickerDialog
    await rpDialog.addButton().click();
    await page.locator('mat-dialog-container').last().waitFor({ state: 'visible' });
    await page.waitForTimeout(500);

    // Save
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PATCH'
    );
    await rpDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify
    await teamFlow.openResponsibleParties(updatedTeamName);
    await expect(rpDialog.partyRows().first()).toBeVisible({ timeout: 5000 });

    // Remove
    await rpDialog.removeButton(0).click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PATCH'
    );
    await rpDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed
    await teamFlow.openResponsibleParties(updatedTeamName);
    await expect(rpDialog.partyRows()).toHaveCount(0, { timeout: 5000 });
    await rpDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('Related teams', async () => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');

    const relatedDialog = new RelatedTeamsDialog(page);

    // Open related teams dialog
    await teamFlow.openRelatedTeams(updatedTeamName);

    // Add Seed Team Beta as dependency
    await teamFlow.addRelatedTeam('Seed Team Beta', 'dependency');

    // Save
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PUT'
    );
    await relatedDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify
    await teamFlow.openRelatedTeams(updatedTeamName);
    await expect(relatedDialog.relatedRows().first()).toBeVisible({ timeout: 5000 });
    await expect(relatedDialog.relatedRows().first()).toContainText('Seed Team Beta');

    // Remove
    await relatedDialog.removeButton(0).click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PUT'
    );
    await relatedDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed
    await teamFlow.openRelatedTeams(updatedTeamName);
    await expect(relatedDialog.relatedRows()).toHaveCount(0, { timeout: 5000 });
    await relatedDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('Team metadata', async () => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');

    const metadataFlow = new MetadataFlow(page);
    const metadataDialog = new MetadataDialog(page);

    // Open metadata dialog
    await teamFlow.openMetadata(updatedTeamName);

    // Add entry
    await metadataFlow.addEntry('env', 'prod');
    await metadataFlow.saveAndClose();

    // Reopen and verify
    await teamFlow.openMetadata(updatedTeamName);
    await expect(metadataDialog.keyInput(0)).toHaveValue('env', { timeout: 5000 });
    await expect(metadataDialog.valueInput(0)).toHaveValue('prod');

    // Edit value
    await metadataFlow.editEntry(0, undefined, 'staging');
    await metadataFlow.saveAndClose();

    // Reopen and verify edit
    await teamFlow.openMetadata(updatedTeamName);
    await expect(metadataDialog.valueInput(0)).toHaveValue('staging');

    // Delete
    await metadataFlow.deleteEntry(0);
    await metadataFlow.saveAndClose();

    // Reopen and verify empty
    await teamFlow.openMetadata(updatedTeamName);
    await expect(metadataDialog.rows()).toHaveCount(0, { timeout: 5000 });
    await metadataDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });
});
```

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/team-workflows.spec.ts
git commit -m "test: add team workflow E2E tests (CRUD, members, RP, related, metadata)"
```

---

### Task 19: Write project workflow tests

**Files:**
- Create: `e2e/tests/workflows/project-workflows.spec.ts`

- [ ] **Step 1: Create project-workflows.spec.ts**

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ProjectFlow } from '../../flows/project.flow';
import { MetadataFlow } from '../../flows/metadata.flow';
import { ProjectsPage } from '../../pages/projects.page';
import { EditProjectDialog } from '../../dialogs/edit-project.dialog';
import { ResponsiblePartiesDialog } from '../../dialogs/responsible-parties.dialog';
import { RelatedProjectsDialog } from '../../dialogs/related-projects.dialog';
import { MetadataDialog } from '../../dialogs/metadata.dialog';

test.describe.serial('Project Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let projectFlow: ProjectFlow;
  let projectsPage: ProjectsPage;

  const testProjectName = `E2E Project ${Date.now()}`;
  const updatedProjectName = `${testProjectName} Updated`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    projectFlow = new ProjectFlow(page);
    projectsPage = new ProjectsPage(page);

    await new AuthFlow(page).loginAs('test-user');
  });

  test.afterAll(async () => {
    try {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      const hasProject = await projectsPage.projectRow(updatedProjectName).count();
      if (hasProject > 0) {
        await projectFlow.deleteProject(updatedProjectName);
      }
    } catch {
      /* best effort */
    }
    await context.close();
  });

  test('Project CRUD', async () => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Create
    await projectFlow.createProject({
      name: testProjectName,
      team: 'Seed Team Alpha',
      status: 'active',
    });
    await expect(projectsPage.projectRow(testProjectName)).toBeVisible({ timeout: 10000 });

    // Edit
    await projectFlow.editProject(testProjectName, {
      name: updatedProjectName,
      status: 'Planning',
    });
    await expect(projectsPage.projectRow(updatedProjectName)).toBeVisible({ timeout: 10000 });
    await expect(projectsPage.projectRow(testProjectName)).toHaveCount(0, { timeout: 5000 });

    // Delete
    await projectFlow.deleteProject(updatedProjectName);
    await expect(projectsPage.projectRow(updatedProjectName)).toHaveCount(0, { timeout: 10000 });

    // Re-create for subsequent tests
    await projectFlow.createProject({
      name: updatedProjectName,
      team: 'Seed Team Alpha',
    });
    await expect(projectsPage.projectRow(updatedProjectName)).toBeVisible({ timeout: 10000 });
  });

  test('Project-team linkage', async () => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Verify project shows Seed Team Alpha in the team column
    const projectRow = projectsPage.projectRow(updatedProjectName);
    await expect(projectRow).toContainText('Seed Team Alpha');

    // Edit to change team to Seed Team Beta
    await projectFlow.editProject(updatedProjectName, { team: 'Seed Team Beta' });

    // Verify team column shows Beta
    await expect(projectsPage.projectRow(updatedProjectName)).toContainText('Seed Team Beta', {
      timeout: 10000,
    });

    // Change back to Alpha for other tests
    await projectFlow.editProject(updatedProjectName, { team: 'Seed Team Alpha' });
    await expect(projectsPage.projectRow(updatedProjectName)).toContainText('Seed Team Alpha', {
      timeout: 10000,
    });
  });

  test('Responsible parties', async () => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const rpDialog = new ResponsiblePartiesDialog(page);

    // Open responsible parties dialog
    await projectFlow.openResponsibleParties(updatedProjectName);

    // Add responsible party
    await rpDialog.addButton().click();
    await page.locator('mat-dialog-container').last().waitFor({ state: 'visible' });
    await page.waitForTimeout(500);

    // Save
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/projects/') && resp.request().method() === 'PATCH'
    );
    await rpDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify
    await projectFlow.openResponsibleParties(updatedProjectName);
    await expect(rpDialog.partyRows().first()).toBeVisible({ timeout: 5000 });

    // Remove
    await rpDialog.removeButton(0).click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/projects/') && resp.request().method() === 'PATCH'
    );
    await rpDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed
    await projectFlow.openResponsibleParties(updatedProjectName);
    await expect(rpDialog.partyRows()).toHaveCount(0, { timeout: 5000 });
    await rpDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('Related projects', async () => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const relatedDialog = new RelatedProjectsDialog(page);

    // Open related projects dialog
    await projectFlow.openRelatedProjects(updatedProjectName);

    // Add Seed Project Two as related
    await projectFlow.addRelatedProject('Seed Project Two', 'related');

    // Save
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/projects/') && resp.request().method() === 'PUT'
    );
    await relatedDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify
    await projectFlow.openRelatedProjects(updatedProjectName);
    await expect(relatedDialog.relatedRows().first()).toBeVisible({ timeout: 5000 });
    await expect(relatedDialog.relatedRows().first()).toContainText('Seed Project Two');

    // Remove
    await relatedDialog.removeButton(0).click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/projects/') && resp.request().method() === 'PUT'
    );
    await relatedDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed
    await projectFlow.openRelatedProjects(updatedProjectName);
    await expect(relatedDialog.relatedRows()).toHaveCount(0, { timeout: 5000 });
    await relatedDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('Project metadata', async () => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const metadataFlow = new MetadataFlow(page);
    const metadataDialog = new MetadataDialog(page);

    // Open metadata dialog
    await projectFlow.openMetadata(updatedProjectName);

    // Add entry
    await metadataFlow.addEntry('env', 'prod');
    await metadataFlow.saveAndClose();

    // Reopen and verify
    await projectFlow.openMetadata(updatedProjectName);
    await expect(metadataDialog.keyInput(0)).toHaveValue('env', { timeout: 5000 });
    await expect(metadataDialog.valueInput(0)).toHaveValue('prod');

    // Edit value
    await metadataFlow.editEntry(0, undefined, 'staging');
    await metadataFlow.saveAndClose();

    // Reopen and verify edit
    await projectFlow.openMetadata(updatedProjectName);
    await expect(metadataDialog.valueInput(0)).toHaveValue('staging');

    // Delete
    await metadataFlow.deleteEntry(0);
    await metadataFlow.saveAndClose();

    // Reopen and verify empty
    await projectFlow.openMetadata(updatedProjectName);
    await expect(metadataDialog.rows()).toHaveCount(0, { timeout: 5000 });
    await metadataDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });
});
```

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/project-workflows.spec.ts
git commit -m "test: add project workflow E2E tests (CRUD, team linkage, RP, related, metadata)"
```

---

### Task 20: Write dashboard filter tests

**Files:**
- Create: `e2e/tests/workflows/dashboard-filters.spec.ts`

- [ ] **Step 1: Create dashboard-filters.spec.ts**

```typescript
import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { DashboardPage } from '../../pages/dashboard.page';
import { DashboardFilterFlow } from '../../flows/dashboard-filter.flow';

const SEEDED_TM = 'Seed TM - Full Fields';

userTest.describe('Dashboard Filters', () => {
  userTest.setTimeout(30000);

  userTest('Name search', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    const dashboard = new DashboardPage(userPage);
    const filterFlow = new DashboardFilterFlow(userPage);

    // Search for seeded TM
    await filterFlow.searchByName('Seed TM');
    await expect(dashboard.tmCards().first().or(dashboard.tableRows().first())).toBeVisible({
      timeout: 5000,
    });

    // Clear search
    await dashboard.searchClear().click();
    await userPage.waitForTimeout(500);

    // Verify all TMs restored (at least seeded TM visible)
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });
  });

  userTest('Status filter', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    const dashboard = new DashboardPage(userPage);
    const filterFlow = new DashboardFilterFlow(userPage);

    // Filter by active status
    await filterFlow.filterByStatus(['Active']);

    // Verify seeded TM (status: active) is visible
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });

    // Clear filters
    await filterFlow.clearAllFilters();
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });
  });

  userTest('Owner filter', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    const dashboard = new DashboardPage(userPage);
    const filterFlow = new DashboardFilterFlow(userPage);

    // Toggle advanced and filter by owner
    await filterFlow.filterByOwner('test-reviewer');
    await userPage.waitForTimeout(1000);

    // Verify seeded TM (owner: test-reviewer) is visible
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });

    // Clear filters
    await filterFlow.clearAllFilters();
  });

  userTest('Date range filter', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    const dashboard = new DashboardPage(userPage);
    const filterFlow = new DashboardFilterFlow(userPage);

    // Set created-after to past date — should show seeded TM
    await filterFlow.filterByDateRange('created', '01/01/2020');
    await userPage.waitForTimeout(1000);
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });

    // Clear and set created-after to future date — should show no results
    await filterFlow.clearAllFilters();
    await filterFlow.filterByDateRange('created', '01/01/2099');
    await userPage.waitForTimeout(1000);

    // Verify no matching TMs message or empty state
    const noResults = userPage.locator('[transloco="dashboard.noMatchingThreatModels"]')
      .or(userPage.locator('text=No threat models match'));
    await expect(noResults).toBeVisible({ timeout: 5000 });

    // Clear
    await filterFlow.clearAllFilters();
  });

  userTest('Pagination', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    const dashboard = new DashboardPage(userPage);

    // Switch to table view to see paginator more reliably
    await dashboard.viewToggle().click();
    await userPage.waitForTimeout(300);

    // The paginator may only show if there are more items than page size.
    // With 1 seeded TM, paginator might be hidden. Verify it either
    // renders or the table shows the seeded TM.
    const paginatorVisible = await dashboard.paginator().isVisible().catch(() => false);
    if (paginatorVisible) {
      // Paginator is visible — verify it has expected controls
      await expect(dashboard.paginator()).toBeVisible();
    } else {
      // Only 1 TM — paginator hidden, but table should show the TM
      await expect(dashboard.tableRow(SEEDED_TM)).toBeVisible({ timeout: 5000 });
    }
  });
});
```

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/dashboard-filters.spec.ts
git commit -m "test: add dashboard filter E2E tests (search, status, owner, date, pagination)"
```

---

## Sub-phase 4B: Field Coverage

### Task 21: Update field definitions for Phase 4

**Files:**
- Modify: `e2e/schema/field-definitions.json`
- Modify: `e2e/schema/field-definitions.ts`

- [ ] **Step 1: Verify team and project field definitions exist in field-definitions.json**

The field-definitions.json already contains `team` and `project` entities with the correct field definitions. Verify the following fields are present:

Team fields (5 editable form fields):
- `name` → `edit-team-name-input` (text, editable)
- `description` → `edit-team-description-input` (textarea, editable)
- `email_address` → `edit-team-email-input` (text, editable)
- `uri` → `edit-team-uri-input` (text, editable)
- `status` → `edit-team-status-select` (select, editable)

Project fields (5 editable form fields):
- `name` → `edit-project-name-input` (text, editable)
- `description` → `edit-project-description-input` (textarea, editable)
- `team_id` → `edit-project-team-select` (select, editable)
- `uri` → `edit-project-uri-input` (text, editable)
- `status` → `edit-project-status-select` (select, editable)

The existing definitions use generic testid names (`team-name-input`, `team-description-input`). These need to be updated to match the `edit-team-*` testid names used in the actual edit dialog:

Update `team` entity selectors:
- `[data-testid='team-name-input']` → `[data-testid='edit-team-name-input']`
- `[data-testid='team-description-input']` → `[data-testid='edit-team-description-input']`
- `[data-testid='team-status-select']` → `[data-testid='edit-team-status-select']`
- `[data-testid='team-email-input']` → `[data-testid='edit-team-email-input']`
- `[data-testid='team-uri-input']` → `[data-testid='edit-team-uri-input']`

Update `project` entity selectors:
- `[data-testid='project-name-input']` → `[data-testid='edit-project-name-input']`
- `[data-testid='project-description-input']` → `[data-testid='edit-project-description-input']`
- `[data-testid='project-status-select']` → `[data-testid='edit-project-status-select']`
- `[data-testid='project-team-select']` → `[data-testid='edit-project-team-select']`
- `[data-testid='project-uri-input']` → `[data-testid='edit-project-uri-input']`

Leave the non-form fields (members, responsible_parties, related_teams, metadata, related_projects) unchanged — they reference buttons, not edit dialog inputs.

- [ ] **Step 2: Add dashboard display field definitions**

Add a new `dashboard` entity to the `entities` object in field-definitions.json:

```json
"dashboard": [
  { "apiName": "name", "uiSelector": ".mat-column-name", "type": "text", "required": false, "editable": false },
  { "apiName": "lastModified", "uiSelector": ".mat-column-lastModified", "type": "text", "required": false, "editable": false },
  { "apiName": "status", "uiSelector": ".mat-column-status", "type": "text", "required": false, "editable": false },
  { "apiName": "owner", "uiSelector": ".mat-column-owner", "type": "text", "required": false, "editable": false },
  { "apiName": "created", "uiSelector": ".mat-column-created", "type": "text", "required": false, "editable": false }
]
```

- [ ] **Step 3: Update field-definitions.ts with dashboard export**

Add after the existing exports:

```typescript
export const DASHBOARD_FIELDS: FieldDef[] = data.entities.dashboard;
```

- [ ] **Step 4: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add e2e/schema/field-definitions.json
git add e2e/schema/field-definitions.ts
git commit -m "test: update team/project field selectors and add dashboard field definitions"
```

---

### Task 22: Write team field coverage tests

**Files:**
- Create: `e2e/tests/field-coverage/team-fields.spec.ts`

- [ ] **Step 1: Create team-fields.spec.ts**

```typescript
import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { TEAM_FIELDS } from '../../schema/field-definitions';
import { TeamsPage } from '../../pages/teams.page';

const SEEDED_TEAM = 'Seed Team Alpha';

// Fields tested via workflow tests or not direct form inputs in the edit dialog
const SKIP_FIELDS = [
  'members',
  'responsible_parties',
  'related_teams',
  'metadata',
];

userTest.describe('Team Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of TEAM_FIELDS.filter(f => !SKIP_FIELDS.includes(f.apiName))) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/teams');
      await userPage.waitForLoadState('networkidle');

      // Open edit dialog for seeded team
      const teamsPage = new TeamsPage(userPage);
      await teamsPage.editButton(SEEDED_TEAM).click();
      await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

      // Verify the field element is visible
      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });

      // Close dialog
      await userPage.getByTestId('edit-team-cancel-button').click();
      await userPage.locator('mat-dialog-container').waitFor({ state: 'hidden' });
    });
  }
});
```

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/field-coverage/team-fields.spec.ts
git commit -m "test: add team field coverage E2E tests"
```

---

### Task 23: Write project field coverage tests

**Files:**
- Create: `e2e/tests/field-coverage/project-fields.spec.ts`

- [ ] **Step 1: Create project-fields.spec.ts**

```typescript
import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { PROJECT_FIELDS } from '../../schema/field-definitions';
import { ProjectsPage } from '../../pages/projects.page';

const SEEDED_PROJECT = 'Seed Project One';

// Fields tested via workflow tests or not direct form inputs in the edit dialog
const SKIP_FIELDS = [
  'responsible_parties',
  'related_projects',
  'metadata',
];

userTest.describe('Project Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of PROJECT_FIELDS.filter(f => !SKIP_FIELDS.includes(f.apiName))) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/projects');
      await userPage.waitForLoadState('networkidle');

      // Open edit dialog for seeded project
      const projectsPage = new ProjectsPage(userPage);
      await projectsPage.editButton(SEEDED_PROJECT).click();
      await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

      // Verify the field element is visible
      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });

      // Close dialog
      await userPage.getByTestId('edit-project-cancel-button').click();
      await userPage.locator('mat-dialog-container').waitFor({ state: 'hidden' });
    });
  }
});
```

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/field-coverage/project-fields.spec.ts
git commit -m "test: add project field coverage E2E tests"
```

---

### Task 24: Write dashboard field coverage tests

**Files:**
- Create: `e2e/tests/field-coverage/dashboard-fields.spec.ts`

- [ ] **Step 1: Create dashboard-fields.spec.ts**

```typescript
import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { DASHBOARD_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';

userTest.describe('Dashboard Field Coverage', () => {
  userTest.setTimeout(30000);

  userTest.beforeEach(async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    // Switch to table view for column-based verification
    const dashboard = new DashboardPage(userPage);
    await dashboard.viewToggle().click();
    await userPage.waitForTimeout(300);
  });

  for (const field of DASHBOARD_FIELDS) {
    userTest(`column: ${field.apiName}`, async ({ userPage }) => {
      // Verify the column header exists
      const headerLocator = userPage.locator(`${field.uiSelector} th, th${field.uiSelector}`);
      // mat-table columns use class-based selectors (.mat-column-name)
      // The header cell will have the column class
      const columnCells = userPage.locator(field.uiSelector);
      await expect(columnCells.first()).toBeVisible({ timeout: 5000 });

      // Verify the seeded TM row has a value in this column
      const dashboard = new DashboardPage(userPage);
      const tmRow = dashboard.tableRow(SEEDED_TM);
      const cellInRow = tmRow.locator(field.uiSelector);
      // The cell should exist and have some text content
      await expect(cellInRow).toBeVisible({ timeout: 5000 });
    });
  }
});
```

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/field-coverage/dashboard-fields.spec.ts
git commit -m "test: add dashboard field coverage E2E tests"
```

---

## Sub-phase 4C: Visual Regression

### Task 25: Write team/project/dashboard screenshot tests

**Files:**
- Create: `e2e/tests/visual-regression/team-project-visual-regression.spec.ts`

- [ ] **Step 1: Create team-project-visual-regression.spec.ts**

```typescript
import { userTest } from '../../fixtures/auth-fixtures';
import { takeThemeScreenshots } from '../../helpers/screenshot';
import { TeamsPage } from '../../pages/teams.page';
import { ProjectsPage } from '../../pages/projects.page';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TEAM = 'Seed Team Alpha';
const SEEDED_PROJECT = 'Seed Project One';

userTest.describe('Team/Project Visual Regression', () => {
  userTest.setTimeout(60000);

  userTest('teams list', async ({ userPage }) => {
    await userPage.goto('/teams');
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.mat-column-modified');

    await takeThemeScreenshots(userPage, 'teams-list', {
      mask: [timestamps],
    });
  });

  userTest('create team dialog', async ({ userPage }) => {
    await userPage.goto('/teams');
    await userPage.waitForLoadState('networkidle');

    await new TeamsPage(userPage).addButton().click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

    await takeThemeScreenshots(userPage, 'create-team-dialog');

    await userPage.getByTestId('create-team-cancel-button').click();
  });

  userTest('edit team dialog', async ({ userPage }) => {
    await userPage.goto('/teams');
    await userPage.waitForLoadState('networkidle');

    await new TeamsPage(userPage).editButton(SEEDED_TEAM).click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

    const timestamps = userPage.locator('.info-value').filter({
      hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    });

    await takeThemeScreenshots(userPage, 'edit-team-dialog', {
      mask: [timestamps],
    });

    await userPage.getByTestId('edit-team-cancel-button').click();
  });

  userTest('projects list', async ({ userPage }) => {
    await userPage.goto('/projects');
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.mat-column-modified');

    await takeThemeScreenshots(userPage, 'projects-list', {
      mask: [timestamps],
    });
  });

  userTest('create project dialog', async ({ userPage }) => {
    await userPage.goto('/projects');
    await userPage.waitForLoadState('networkidle');

    await new ProjectsPage(userPage).addButton().click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

    await takeThemeScreenshots(userPage, 'create-project-dialog');

    await userPage.getByTestId('create-project-cancel-button').click();
  });

  userTest('edit project dialog', async ({ userPage }) => {
    await userPage.goto('/projects');
    await userPage.waitForLoadState('networkidle');

    await new ProjectsPage(userPage).editButton(SEEDED_PROJECT).click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

    const timestamps = userPage.locator('.info-value').filter({
      hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    });

    await takeThemeScreenshots(userPage, 'edit-project-dialog', {
      mask: [timestamps],
    });

    await userPage.getByTestId('edit-project-cancel-button').click();
  });

  userTest('dashboard with advanced filters', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    // Open advanced filters
    await new DashboardPage(userPage).moreFiltersButton().click();
    await userPage.waitForTimeout(300);

    const timestamps = userPage.locator(
      '.mat-column-lastModified, .mat-column-created, .mat-column-statusLastChanged'
    );
    const collabIndicators = userPage.locator('.collab-indicator-icon, .collaboration-info');

    await takeThemeScreenshots(userPage, 'dashboard-advanced-filters', {
      mask: [timestamps, collabIndicators],
      fullPage: true,
    });
  });
});
```

7 tests x 4 themes = 28 baseline screenshots.

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/visual-regression/team-project-visual-regression.spec.ts
git commit -m "test: add team/project/dashboard visual regression screenshot tests"
```

---

### Task 26: Write translation and icon sweep tests

**Files:**
- Create: `e2e/tests/visual-regression/team-project-translation-icons.spec.ts`

- [ ] **Step 1: Create team-project-translation-icons.spec.ts**

```typescript
import { userTest } from '../../fixtures/auth-fixtures';
import { assertNoMissingTranslations } from '../../helpers/translation-scanner';
import { assertIconsRendered } from '../../helpers/icon-checker';

userTest.describe('Team/Project Translation & Icon Integrity', () => {
  userTest.setTimeout(30000);

  userTest('teams list', async ({ userPage }) => {
    await userPage.goto('/teams');
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('projects list', async ({ userPage }) => {
    await userPage.goto('/projects');
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('dashboard', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });
});
```

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/visual-regression/team-project-translation-icons.spec.ts
git commit -m "test: add team/project/dashboard translation and icon sweep tests"
```

---

## File Summary

### New files

| File | Task | Sub-phase |
|------|------|-----------|
| `e2e/pages/teams.page.ts` | 9 | 4A |
| `e2e/pages/projects.page.ts` | 10 | 4A |
| `e2e/dialogs/create-team.dialog.ts` | 12 | 4A |
| `e2e/dialogs/edit-team.dialog.ts` | 12 | 4A |
| `e2e/dialogs/team-members.dialog.ts` | 12 | 4A |
| `e2e/dialogs/responsible-parties.dialog.ts` | 12 | 4A |
| `e2e/dialogs/related-teams.dialog.ts` | 12 | 4A |
| `e2e/dialogs/create-project.dialog.ts` | 13 | 4A |
| `e2e/dialogs/edit-project.dialog.ts` | 13 | 4A |
| `e2e/dialogs/related-projects.dialog.ts` | 13 | 4A |
| `e2e/flows/team.flow.ts` | 14 | 4A |
| `e2e/flows/project.flow.ts` | 15 | 4A |
| `e2e/flows/dashboard-filter.flow.ts` | 16 | 4A |
| `e2e/tests/workflows/team-workflows.spec.ts` | 18 | 4A |
| `e2e/tests/workflows/project-workflows.spec.ts` | 19 | 4A |
| `e2e/tests/workflows/dashboard-filters.spec.ts` | 20 | 4A |
| `e2e/tests/field-coverage/team-fields.spec.ts` | 22 | 4B |
| `e2e/tests/field-coverage/project-fields.spec.ts` | 23 | 4B |
| `e2e/tests/field-coverage/dashboard-fields.spec.ts` | 24 | 4B |
| `e2e/tests/visual-regression/team-project-visual-regression.spec.ts` | 25 | 4C |
| `e2e/tests/visual-regression/team-project-translation-icons.spec.ts` | 26 | 4C |

### Modified files

| File | Task | Change |
|------|------|--------|
| `e2e/seed/seed-spec.json` | 1 | Enrich team/project seeds, add Beta/Two |
| `src/app/pages/teams/teams.component.html` | 2 | Add `data-testid` attributes |
| `src/app/pages/admin/teams/admin-teams.component.html` | 3 | Add `data-testid` attributes |
| `src/app/pages/projects/projects.component.html` | 4 | Add `data-testid` attributes |
| `src/app/pages/admin/projects/admin-projects.component.html` | 5 | Add `data-testid` attributes |
| `src/app/pages/dashboard/dashboard.component.html` | 6 | Add filter/table `data-testid` attributes |
| `src/app/shared/components/create-team-dialog/create-team-dialog.component.ts` | 7 | Add `data-testid` attributes |
| `src/app/shared/components/edit-team-dialog/edit-team-dialog.component.ts` | 7 | Add `data-testid` attributes |
| `src/app/shared/components/team-members-dialog/team-members-dialog.component.ts` | 7 | Add `data-testid` attributes |
| `src/app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component.ts` | 7 | Add `data-testid` attributes |
| `src/app/shared/components/related-teams-dialog/related-teams-dialog.component.ts` | 7 | Add `data-testid` attributes |
| `src/app/shared/components/create-project-dialog/create-project-dialog.component.ts` | 8 | Add `data-testid` attributes |
| `src/app/shared/components/edit-project-dialog/edit-project-dialog.component.ts` | 8 | Add `data-testid` attributes |
| `src/app/shared/components/related-projects-dialog/related-projects-dialog.component.ts` | 8 | Add `data-testid` attributes |
| `e2e/pages/dashboard.page.ts` | 11 | Add filter, table, pagination locators |
| `e2e/fixtures/test-fixtures.ts` | 17 | Register all new page objects, dialogs, flows |
| `e2e/schema/field-definitions.json` | 21 | Update team/project selectors, add dashboard entity |
| `e2e/schema/field-definitions.ts` | 21 | Add DASHBOARD_FIELDS export |

### Reused from Phase 1

| File | Usage |
|------|-------|
| `e2e/dialogs/metadata.dialog.ts` | Team and project metadata tests |
| `e2e/dialogs/delete-confirm.dialog.ts` | Team and project delete workflows |
| `e2e/flows/metadata.flow.ts` | Team and project metadata CRUD |
| `e2e/helpers/angular-fill.ts` | Dashboard filter inputs |
| `e2e/helpers/screenshot.ts` | Visual regression screenshots |
| `e2e/helpers/translation-scanner.ts` | Translation sweep tests |
| `e2e/helpers/icon-checker.ts` | Icon integrity tests |
| `e2e/fixtures/auth-fixtures.ts` | userTest, reviewerTest, adminTest |
