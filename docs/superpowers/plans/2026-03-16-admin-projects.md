# Admin Projects Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-featured admin page for managing projects, modeled after the admin teams page, with API-backed filtering by name/team/status.

**Architecture:** Mirror the admin teams page structure with project-specific adaptations. Extend project types and service for full CRUD. Refactor the responsible parties dialog to be entity-agnostic (shared between teams and projects). Create project-specific dialogs for editing and related projects.

**Tech Stack:** Angular 19, Angular Material, Transloco i18n, Vitest, RxJS

**Spec:** `docs/superpowers/specs/2026-03-16-admin-projects-design.md`

---

## Chunk 1: Data Model and Service Layer

### Task 1: Extend project types

**Files:**
- Modify: `src/app/types/project.types.ts`

- [ ] **Step 1: Write test for new types**

Create: `src/app/types/project.types.spec.ts`

```typescript
// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest
import { describe, it, expect } from 'vitest';
import {
  PROJECT_STATUSES,
  ProjectStatus,
  RelatedProject,
  ProjectPatch,
  Project,
} from './project.types';
import { ResponsibleParty, RelationshipType } from './team.types';

describe('Project types', () => {
  it('should export PROJECT_STATUSES with all expected values', () => {
    expect(PROJECT_STATUSES).toEqual([
      'active', 'planning', 'on_hold', 'completed', 'archived', 'cancelled',
    ]);
  });

  it('should allow creating a RelatedProject', () => {
    const related: RelatedProject = {
      related_project_id: '550e8400-e29b-41d4-a716-446655440000',
      relationship: 'dependency' as RelationshipType,
    };
    expect(related.related_project_id).toBeDefined();
    expect(related.relationship).toBe('dependency');
  });

  it('should allow creating a ProjectPatch with all optional fields', () => {
    const patch: ProjectPatch = {
      name: 'Updated',
      status: 'active' as ProjectStatus,
      responsible_parties: [] as ResponsibleParty[],
      related_projects: [] as RelatedProject[],
      metadata: [{ key: 'k', value: 'v' }],
    };
    expect(patch.name).toBe('Updated');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/types/project.types.spec.ts`
Expected: FAIL — `PROJECT_STATUSES`, `RelatedProject`, `ProjectPatch` not exported

- [ ] **Step 3: Update project.types.ts**

Add imports and new types to `src/app/types/project.types.ts`. The existing `ProjectListItem`, `ProjectInput`, `ProjectFilter`, and `ListProjectsResponse` remain unchanged. **Replace** the existing minimal `Project` interface.

```typescript
import { User } from '@app/pages/tm/models/threat-model.model';
import { Metadata } from '@app/types/metadata.types';
import { ResponsibleParty, RelationshipType, Team } from '@app/types/team.types';

// After existing ProjectInput interface:

/** Interim client-side enum until server adds ProjectStatus enum (tmi#184) */
export type ProjectStatus = 'active' | 'planning' | 'on_hold' | 'completed' | 'archived' | 'cancelled';

/** All valid ProjectStatus values, for use in dropdowns */
export const PROJECT_STATUSES: ProjectStatus[] = [
  'active', 'planning', 'on_hold', 'completed', 'archived', 'cancelled',
];

/** A relationship entry linking to another project */
export interface RelatedProject {
  related_project_id: string;
  relationship: RelationshipType;
  custom_relationship?: string;
}

/** Patch input for partial project updates */
export interface ProjectPatch {
  name?: string;
  description?: string;
  team_id?: string;
  uri?: string;
  status?: ProjectStatus;
  responsible_parties?: ResponsibleParty[];
  related_projects?: RelatedProject[];
  metadata?: Metadata[];
}

/** Full project object returned from API (GET /projects/{id}) */
export interface Project extends ProjectInput {
  readonly id: string;
  readonly created_at: string;
  readonly modified_at?: string;
  readonly created_by?: User | null;
  readonly modified_by?: User | null;
  readonly team?: Team | null;
  reviewed_by?: User | null;
  reviewed_at?: string | null;
  responsible_parties?: ResponsibleParty[];
  related_projects?: RelatedProject[];
  metadata?: Metadata[];
}
```

Note: `Team` needs to be exported from `team.types.ts` if not already. Check and add export if needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/app/types/project.types.spec.ts`
Expected: PASS

- [ ] **Step 5: Run full build to verify no breakage**

Run: `pnpm run build`
Expected: Build succeeds. Existing consumers of the old `Project` interface should be compatible since the new interface is a superset.

- [ ] **Step 6: Commit**

```bash
git add src/app/types/project.types.ts src/app/types/project.types.spec.ts
git commit -m "feat: extend project types with status, related projects, patch (#501)"
```

---

### Task 2: Extend ProjectService with CRUD methods

**Files:**
- Modify: `src/app/core/services/project.service.ts`
- Modify: `src/app/core/services/project.service.spec.ts` (create if doesn't exist)

- [ ] **Step 1: Write tests for new service methods**

Create or update `src/app/core/services/project.service.spec.ts`:

```typescript
// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ProjectService } from './project.service';
import { Project } from '@app/types/project.types';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const mockProject: Project = {
    id: 'proj-1',
    name: 'Test Project',
    team_id: 'team-1',
    created_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiService = {
      get: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };
    service = new ProjectService(
      mockApiService as any,
      mockLogger as any,
    );
  });

  describe('get()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockProject));
      service.get('proj-1').subscribe(result => {
        expect(result).toEqual(mockProject);
      });
      expect(mockApiService.get).toHaveBeenCalledWith('projects/proj-1');
    });

    it('should handle errors', () => {
      const error = new Error('Failed');
      mockApiService.get.mockReturnValue(throwError(() => error));
      service.get('proj-1').subscribe({
        error: err => {
          expect(mockLogger.error).toHaveBeenCalledWith('Failed to load project', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('update()', () => {
    it('should call PUT with correct endpoint and body', () => {
      mockApiService.put.mockReturnValue(of(mockProject));
      const input = { name: 'Updated', team_id: 'team-1' };
      service.update('proj-1', input).subscribe(result => {
        expect(result).toEqual(mockProject);
      });
      expect(mockApiService.put).toHaveBeenCalledWith('projects/proj-1', input);
    });
  });

  describe('patch()', () => {
    it('should convert changes to JSON Patch operations', () => {
      mockApiService.patch.mockReturnValue(of(mockProject));
      service.patch('proj-1', { name: 'Patched' }).subscribe();
      expect(mockApiService.patch).toHaveBeenCalledWith('projects/proj-1', [
        { op: 'replace', path: '/name', value: 'Patched' },
      ]);
    });
  });

  describe('delete()', () => {
    it('should call DELETE with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      service.delete('proj-1').subscribe();
      expect(mockApiService.delete).toHaveBeenCalledWith('projects/proj-1');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/core/services/project.service.spec.ts`
Expected: FAIL — `get`, `update`, `patch`, `delete` methods not defined

- [ ] **Step 3: Add methods to ProjectService**

Add to `src/app/core/services/project.service.ts` (after existing `create` method), and add `ProjectPatch` to imports:

```typescript
  /**
   * Get a project by ID
   * @param id Project ID
   */
  get(id: string): Observable<Project> {
    return this.apiService.get<Project>(`projects/${id}`).pipe(
      tap(project => this.logger.debug('Project loaded', { id: project.id })),
      catchError(error => {
        this.logger.error('Failed to load project', error);
        throw error;
      }),
    );
  }

  /**
   * Update a project (full replacement)
   * @param id Project ID
   * @param input Project input data
   */
  update(id: string, input: ProjectInput): Observable<Project> {
    return this.apiService
      .put<Project>(`projects/${id}`, input as unknown as Record<string, unknown>)
      .pipe(
        tap(result => this.logger.info('Project updated', { id: result.id })),
        catchError(error => {
          this.logger.error('Failed to update project', error);
          throw error;
        }),
      );
  }

  /**
   * Patch a project (partial update using JSON Patch operations)
   * @param id Project ID
   * @param changes Partial project changes to apply as JSON Patch replace operations
   */
  patch(id: string, changes: ProjectPatch): Observable<Project> {
    const operations = Object.entries(changes).map(([key, value]) => ({
      op: 'replace' as const,
      path: `/${key}`,
      value,
    }));
    return this.apiService.patch<Project>(`projects/${id}`, operations).pipe(
      tap(result => this.logger.info('Project patched', { id: result.id })),
      catchError(error => {
        this.logger.error('Failed to patch project', error);
        throw error;
      }),
    );
  }

  /**
   * Delete a project
   * @param id Project ID
   */
  delete(id: string): Observable<void> {
    return this.apiService.delete<void>(`projects/${id}`).pipe(
      tap(() => this.logger.info('Project deleted', { id })),
      catchError(error => {
        this.logger.error('Failed to delete project', error);
        throw error;
      }),
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/app/core/services/project.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/project.service.ts src/app/core/services/project.service.spec.ts
git commit -m "feat: add get, update, patch, delete to ProjectService (#501)"
```

---

## Chunk 2: i18n Keys and Shared Dialog Refactoring

### Task 3: Add i18n keys for admin projects

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Add project admin i18n keys**

Add to the existing `projects` section in `src/assets/i18n/en-US.json`. Also add `admin.sections.projects`. Use the skill `/analyze_localization_files` or manually add keys.

Keys to add under `projects`:
```json
{
  "title": "Manage Projects",
  "subtitle": "Create, edit, and manage projects, relationships, and metadata",
  "listTitle": "{{admin.sections.projects.title}}",
  "filterLabel": "Filter by Name",
  "teamFilterLabel": "Filter by Team",
  "statusFilterLabel": "Filter by Status",
  "statusAll": "All Statuses",
  "clearFilters": "Clear Filters",
  "addButton": "Add Project",
  "noProjects": "No projects found",
  "columns": {
    "name": "{{common.name}}",
    "status": "{{common.status}}",
    "team": "{{common.team}}",
    "modified": "Modified"
  },
  "kebab": {
    "editDetails": "Edit Details",
    "responsibleParties": "{{projects.responsiblePartiesDialog.title}}",
    "relatedProjects": "{{projects.relatedProjectsDialog.title}}",
    "metadata": "{{common.metadata}}",
    "delete": "{{common.delete}}"
  },
  "editDialog": {
    "title": "Edit Project",
    "save": "{{common.save}}"
  },
  "deleteDialog": {
    "message": "Are you sure you want to delete project \"{{name}}\"?"
  },
  "responsiblePartiesDialog": {
    "title": "Responsible Parties",
    "addParty": "Add Responsible Party",
    "noParties": "No responsible parties",
    "removeParty": "Remove Responsible Party"
  },
  "relatedProjectsDialog": {
    "title": "Related Projects",
    "addRelated": "Add Related Project",
    "noRelated": "No related projects",
    "selectProject": "Select Project",
    "relationship": "Relationship",
    "customRelationship": "Custom Relationship"
  },
  "status": {
    "active": "{{common.active}}",
    "planning": "Planning",
    "on_hold": "On Hold",
    "completed": "Completed",
    "archived": "Archived",
    "cancelled": "Cancelled"
  }
}
```

Add under `admin.sections`:
```json
{
  "projects": {
    "title": "Projects",
    "description": "Manage projects, relationships, and metadata"
  }
}
```

- [ ] **Step 2: Build to verify JSON is valid**

Run: `pnpm run build`
Expected: Build succeeds (invalid JSON would fail)

- [ ] **Step 3: Run i18n linting**

Run: `pnpm run lint:all`
Expected: No i18n-related errors

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "feat: add i18n keys for admin projects management (#501)"
```

---

### Task 4: Refactor ResponsiblePartiesDialog to be entity-agnostic

**Files:**
- Move: `src/app/pages/admin/teams/responsible-parties-dialog/responsible-parties-dialog.component.ts` → `src/app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component.ts`
- Modify: `src/app/pages/admin/teams/admin-teams.component.ts` (update import path and dialog data)

- [ ] **Step 1: Create the refactored shared dialog**

Create `src/app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component.ts`.

Key changes from the teams version:
- Remove `TeamService` dependency — no service injected
- **Keep** `TranslocoService` — needed to programmatically translate the UserPickerDialog title string (the `UserPickerDialogData.title` field is a `string`, not an i18n key)
- Keep `LoggerService` for error logging in subscribe error handler
- Change `ResponsiblePartiesDialogData` to:
  ```typescript
  export interface ResponsiblePartiesDialogData {
    entityId: string;
    entityType: 'team' | 'project';
    parties: ResponsibleParty[];
    patchFn: (id: string, parties: ResponsibleParty[]) => Observable<unknown>;
  }
  ```
- In constructor, compute `i18nPrefix = data.entityType === 'team' ? 'teams' : 'projects'` and initialize `this.parties = [...(data.parties || [])]`
- In `onSave()`, call `this.data.patchFn(this.data.entityId, this.parties)` instead of `this.teamService.patch()`
- In template, use dynamic i18n prefix:
  - Title: `{{ i18nPrefix + '.responsiblePartiesDialog.title' | transloco }}`
  - No parties: `{{ i18nPrefix + '.responsiblePartiesDialog.noParties' | transloco }}`
  - Add party button: `{{ i18nPrefix + '.responsiblePartiesDialog.addParty' | transloco }}`
  - Remove tooltip: `{{ i18nPrefix + '.responsiblePartiesDialog.removeParty' | transloco }}`
- For the UserPickerDialog title, use `this.translocoService.translate(this.i18nPrefix + '.responsiblePartiesDialog.addParty')`

- [ ] **Step 2: Update admin teams component to use the new shared dialog**

In `src/app/pages/admin/teams/admin-teams.component.ts`:
- Change import from `'./responsible-parties-dialog/responsible-parties-dialog.component'` to `'@app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component'`
- Update `onResponsibleParties()` to pass the new data shape:
  ```typescript
  data: {
    entityId: fullTeam.id,
    entityType: 'team' as const,
    parties: fullTeam.responsible_parties || [],
    patchFn: (id: string, parties: ResponsibleParty[]) =>
      this.teamService.patch(id, { responsible_parties: parties }),
  }
  ```

- [ ] **Step 3: Delete the old teams-specific dialog**

Delete: `src/app/pages/admin/teams/responsible-parties-dialog/responsible-parties-dialog.component.ts`

- [ ] **Step 4: Run build and tests**

Run: `pnpm run build && pnpm test`
Expected: Build succeeds, tests pass. Admin teams responsible parties flow unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/components/responsible-parties-dialog/ \
  src/app/pages/admin/teams/admin-teams.component.ts
git rm src/app/pages/admin/teams/responsible-parties-dialog/responsible-parties-dialog.component.ts
git commit -m "refactor: make ResponsiblePartiesDialog entity-agnostic (#501)"
```

---

## Chunk 3: Admin Projects Page Component

### Task 5: Create AdminProjectsComponent with table and filters

**Files:**
- Create: `src/app/pages/admin/projects/admin-projects.component.ts`
- Create: `src/app/pages/admin/projects/admin-projects.component.html`
- Create: `src/app/pages/admin/projects/admin-projects.component.scss`

- [ ] **Step 1: Create the component TypeScript file**

Create `src/app/pages/admin/projects/admin-projects.component.ts`.

Mirror `AdminTeamsComponent` structure with these differences:
- Inject both `ProjectService` and `TeamService` (teams needed for team filter autocomplete)
- `displayedColumns = ['name', 'status', 'team', 'modified', 'actions']`
- Filter state: `filterName = ''`, `filterTeamId: string | null = null`, `filterTeamName = ''`, `filterStatus: string | null = null`
- `filterNameSubject$` for debounced name filter
- `teamSuggestions$: Observable<TeamListItem[]>` for autocomplete
- `selectedTeam: TeamListItem | null = null`
- `projectStatuses = PROJECT_STATUSES`
- `hasActiveFilters()` — returns true if any filter is set
- `clearFilters()` — resets all filters, reloads
- `onTeamFilterInput(value: string)` — triggers team search
- `onTeamSelected(event: MatAutocompleteSelectedEvent)` — sets team_id filter
- `clearTeamFilter()` — clears team filter
- `onStatusFilterChange(value: string | null)` — sets status filter
- `loadProjects()` — calls `projectService.list({ name, team_id, status, limit, offset })`
- `updateUrl()` — builds query params directly (page, size, name, team_id, status)
- `ngOnInit()` — parse URL params including `team_id` and `status`; if `team_id` present, resolve team name via `teamService.get()`
- All dialog methods follow the teams pattern: fetch full project, open dialog, reload on close

- [ ] **Step 2: Create the HTML template**

Create `src/app/pages/admin/projects/admin-projects.component.html`.

Structure (mirrors teams but with enhanced filters):
```html
<div class="admin-page-container">
  <!-- Header with title, subtitle, close button -->

  <!-- Filter card with 3 filters in a row + clear button -->
  <mat-card class="filter-card">
    <mat-card-content>
      <div class="filter-row">
        <!-- Name text input -->
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>{{ 'projects.filterLabel' | transloco }}</mat-label>
          <input matInput [value]="filterName" (input)="onNameFilterChange($any($event.target).value)" />
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>

        <!-- Team autocomplete -->
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>{{ 'projects.teamFilterLabel' | transloco }}</mat-label>
          <input matInput
            [value]="filterTeamName"
            (input)="onTeamFilterInput($any($event.target).value)"
            [matAutocomplete]="teamAuto" />
          <mat-autocomplete #teamAuto="matAutocomplete"
            [displayWith]="displayTeam"
            (optionSelected)="onTeamSelected($event)">
            @for (team of teamSuggestions$ | async; track team.id) {
              <mat-option [value]="team">{{ team.name }}</mat-option>
            }
          </mat-autocomplete>
          @if (filterTeamId) {
            <button matSuffix mat-icon-button (click)="clearTeamFilter()">
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>

        <!-- Status dropdown -->
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>{{ 'projects.statusFilterLabel' | transloco }}</mat-label>
          <mat-select [value]="filterStatus" (selectionChange)="onStatusFilterChange($event.value)">
            <mat-option [value]="null">{{ 'projects.statusAll' | transloco }}</mat-option>
            @for (status of projectStatuses; track status) {
              <mat-option [value]="status">{{ 'projects.status.' + status | transloco }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <!-- Clear filters button -->
        @if (hasActiveFilters()) {
          <button mat-stroked-button (click)="clearFilters()" class="clear-filters-btn">
            <mat-icon>filter_list_off</mat-icon>
            <span>{{ 'projects.clearFilters' | transloco }}</span>
          </button>
        }
      </div>
    </mat-card-content>
  </mat-card>

  <!-- Projects table card (same structure as teams) -->
  <!-- Columns: name (with description tooltip), status, team, modified, actions -->
  <!-- Kebab menu: Edit Details, Responsible Parties, Related Projects, Metadata, Delete -->
  <!-- Paginator -->
</div>
```

- [ ] **Step 3: Create the SCSS file**

Create `src/app/pages/admin/projects/admin-projects.component.scss`.

Copy from `admin-teams.component.scss`, rename `.teams-card` → `.projects-card`, `.teams-table` → `.projects-table`, and add:

```scss
.filter-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;

  .filter-field {
    flex: 1;
    min-width: 200px;
  }

  .clear-filters-btn {
    margin-top: 8px;
    white-space: nowrap;
  }
}
```

- [ ] **Step 4: Run build to verify component compiles**

Run: `pnpm run build`
Expected: Build succeeds (component not routed yet, but should compile)

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/projects/
git commit -m "feat: add AdminProjectsComponent with table and filters (#501)"
```

---

### Task 6: Add routing and admin landing page entry

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/pages/admin/admin.component.ts`

- [ ] **Step 1: Add route**

In `src/app/app.routes.ts`, add after the `teams` route in the admin children:

```typescript
{
  path: 'projects',
  loadComponent: () =>
    import(
      /* webpackChunkName: "admin-projects" */ './pages/admin/projects/admin-projects.component'
    ).then(c => c.AdminProjectsComponent),
  canActivate: [adminGuard],
},
```

- [ ] **Step 2: Add admin landing page card**

In `src/app/pages/admin/admin.component.ts`, insert at array index 3 (after "Teams", before "Quotas") in `adminSections`:

```typescript
{
  title: 'admin.sections.projects.title',
  description: 'admin.sections.projects.description',
  icon: 'folder',
  action: 'projects',
},
```

- [ ] **Step 3: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/app.routes.ts src/app/pages/admin/admin.component.ts
git commit -m "feat: add admin projects route and landing page card (#501)"
```

---

## Chunk 4: Dialogs

### Task 7: Create EditProjectDialogComponent

**Files:**
- Create: `src/app/pages/admin/projects/edit-project-dialog/edit-project-dialog.component.ts`

- [ ] **Step 1: Create the dialog component**

Mirror `EditTeamDialogComponent` with these changes:
- Dialog data: `{ project: Project }`
- Form fields: `name` (required, max 256), `description` (max 2048), `team_id` (required, dropdown), `uri`, `status` (dropdown from `PROJECT_STATUSES`)
- No `email_address` field
- Load teams list on init via `TeamService.list({ limit: 200 })`
- Save via `ProjectService.update(id, input)` — same pattern as teams edit dialog
- i18n keys: `projects.editDialog.title`, `projects.editDialog.save`

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/projects/edit-project-dialog/
git commit -m "feat: add EditProjectDialogComponent (#501)"
```

---

### Task 8: Create RelatedProjectsDialogComponent

**Files:**
- Create: `src/app/pages/admin/projects/related-projects-dialog/related-projects-dialog.component.ts`

- [ ] **Step 1: Create the dialog component**

Mirror `RelatedTeamsDialogComponent` with these changes:
- Dialog data: `{ project: Project }`
- Uses `RelatedProject` type (`related_project_id` instead of `related_team_id`)
- Searches projects via `ProjectService.list({ name, limit: 10 })` — excludes current project
- Saves via `ProjectService.patch(id, { related_projects })`
- `projectNames` Map instead of `teamNames`
- i18n keys under `projects.relatedProjectsDialog.*`
- Relationship types: same `RELATIONSHIP_TYPES` constant, same `teams.relationships.*` i18n keys

- [ ] **Step 2: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/projects/related-projects-dialog/
git commit -m "feat: add RelatedProjectsDialogComponent (#501)"
```

---

### Task 9: Wire up all dialog actions in AdminProjectsComponent

**Files:**
- Modify: `src/app/pages/admin/projects/admin-projects.component.ts`

- [ ] **Step 1: Import all dialog components**

Add imports for: `EditProjectDialogComponent`, `RelatedProjectsDialogComponent`, `ResponsiblePartiesDialogComponent` (shared), `MetadataDialogComponent`, `CreateProjectDialogComponent` (existing shared).

- [ ] **Step 2: Implement dialog action methods**

Add methods following the teams pattern:

- `onAddProject()` — opens `CreateProjectDialogComponent`, calls `projectService.create()` on result
- `onEditDetails(project)` — fetches full project, opens `EditProjectDialogComponent`
- `onResponsibleParties(project)` — fetches full project, opens shared `ResponsiblePartiesDialogComponent` with `entityType: 'project'` and `patchFn`
- `onRelatedProjects(project)` — fetches full project, opens `RelatedProjectsDialogComponent`
- `onMetadata(project)` — fetches full project, opens `MetadataDialogComponent`, persists via `projectService.patch(id, { metadata })`
- `onDelete(project)` — confirm with transloco, call `projectService.delete()`, adjust page

- [ ] **Step 3: Build and verify**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 4: Lint**

Run: `pnpm run lint:all`
Expected: No lint errors

- [ ] **Step 5: Run all tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/admin/projects/admin-projects.component.ts
git commit -m "feat: wire up all dialog actions in AdminProjectsComponent (#501)"
```

---

## Chunk 5: Finalization

### Task 10: Backfill i18n for other languages

- [ ] **Step 1: Run i18n analysis**

Use the `/analyze_localization_files` skill to identify missing keys in other language files.

- [ ] **Step 2: Backfill translations**

Use the `/localization-backfill` skill to add missing keys to all language files.

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/
git commit -m "feat: add i18n translations for admin projects (#501)"
```

---

### Task 11: Final verification and cleanup

- [ ] **Step 1: Full build**

Run: `pnpm run build`
Expected: Build succeeds with no errors or warnings

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 3: Full lint**

Run: `pnpm run lint:all`
Expected: No lint errors

- [ ] **Step 4: Manual smoke test checklist**

Verify in browser:
- [ ] Admin landing page shows "Projects" card after "Teams"
- [ ] Clicking "Projects" card navigates to `/admin/projects`
- [ ] Projects list loads with correct columns
- [ ] Name filter works (debounced, API-backed)
- [ ] Team autocomplete filter works (searches teams, filters projects by team_id)
- [ ] Status dropdown filter works
- [ ] Clear Filters button appears when filters active, clears all
- [ ] Pagination works, URL state persists
- [ ] Add Project button opens create dialog and creates project
- [ ] Edit Details kebab opens edit dialog and saves changes
- [ ] Responsible Parties kebab opens shared dialog with project context
- [ ] Related Projects kebab opens dialog, search works, saves
- [ ] Metadata kebab opens dialog, saves via patch
- [ ] Delete kebab confirms and deletes, page adjusts

- [ ] **Step 5: Code review**

Use the `superpowers:requesting-code-review` skill to review all changes.

- [ ] **Step 6: Final commit (if any fixes from review)**

- [ ] **Step 7: Comment on issue and close**

```bash
gh issue comment 501 --repo ericfitz/tmi-ux --body "Implemented in commits on release/1.3.0"
gh issue close 501 --repo ericfitz/tmi-ux --reason completed
```
