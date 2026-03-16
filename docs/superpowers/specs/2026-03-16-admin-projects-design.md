# Admin Projects Page Design

**Issue:** [#501](https://github.com/ericfitz/tmi-ux/issues/501)
**Date:** 2026-03-16
**Status:** Approved

## Summary

Full-featured admin page for managing projects, modeled after the admin teams page (#479). Includes list view with API-backed filtering (name, team, status), pagination, and kebab menu actions for editing details, responsible parties, related projects, metadata, and deletion.

## API Surface

All endpoints confirmed in `tmi-openapi.json`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/projects` | List with filters: `name`, `status`, `team_id`, `limit`, `offset` |
| POST | `/projects` | Create |
| GET | `/projects/{id}` | Get full project |
| PUT | `/projects/{id}` | Full update |
| PATCH | `/projects/{id}` | JSON Patch |
| DELETE | `/projects/{id}` | Delete |
| GET | `/projects/{id}/metadata` | Get metadata |
| PUT | `/projects/{id}/metadata/bulk` | Bulk replace metadata |

**Note:** Project `status` is currently free-text. Server bug [ericfitz/tmi#184](https://github.com/ericfitz/tmi/issues/184) filed to change it to an enum. Client will hardcode `ProjectStatus` values in the interim.

## File Structure

```
src/app/pages/admin/projects/
  admin-projects.component.ts
  admin-projects.component.html
  admin-projects.component.scss
  edit-project-dialog/
    edit-project-dialog.component.ts
  related-projects-dialog/
    related-projects-dialog.component.ts

src/app/shared/components/responsible-parties-dialog/
  responsible-parties-dialog.component.ts    (refactored from teams, now entity-agnostic)
```

## Data Model Changes

### `src/app/types/project.types.ts`

**Replace** the existing minimal `Project` interface and add new types. The existing `ProjectListItem`, `ProjectInput`, `ProjectFilter`, and `ListProjectsResponse` remain unchanged. Imports: `ResponsibleParty`, `RelationshipType` from `team.types.ts`; `Metadata` from `@app/types/metadata.types`; `User` from threat-model model.

```typescript
// Interim client-side enum until server adds ProjectStatus enum (tmi#184)
export type ProjectStatus = 'active' | 'planning' | 'on_hold' | 'completed' | 'archived' | 'cancelled';
export const PROJECT_STATUSES: ProjectStatus[] = [
  'active', 'planning', 'on_hold', 'completed', 'archived', 'cancelled',
];

export interface RelatedProject {
  related_project_id: string;
  relationship: RelationshipType;
  custom_relationship?: string;
}

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

// Replaces the existing minimal Project interface
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

`ResponsibleParty` and `RelationshipType` are already defined in `team.types.ts` and documented as shared between teams and projects. `Metadata` is the canonical type from `@app/types/metadata.types` (same type re-exported by `threat-model.model.ts`). No duplication needed.

The existing `ProjectService` imports (`Project`, `ProjectInput`, `ProjectFilter`, `ListProjectsResponse`) must be updated to also import `ProjectPatch`.

## Service Changes

### `src/app/core/services/project.service.ts`

Add methods (existing `list` and `create` remain):

```typescript
get(id: string): Observable<Project>
update(id: string, input: ProjectInput): Observable<Project>
patch(id: string, changes: ProjectPatch): Observable<Project>
delete(id: string): Observable<void>
```

Same error handling pattern as `TeamService`: `catchError` with `LoggerService`.

## Component: AdminProjectsComponent

**Route:** `/admin/projects` (lazy-loaded, `adminGuard`)

### Table

Columns: `name`, `status`, `team`, `modified`, `actions`

| Column | Source | Display |
|--------|--------|---------|
| name | `ProjectListItem.name` | Text with description tooltip |
| status | `ProjectListItem.status` | Localized via `projects.status.<value>` |
| team | `ProjectListItem.team_name` | Team name text |
| modified | `ProjectListItem.modified_at` | `yyyy-MM-dd` format |
| actions | — | Kebab menu |

### Kebab Menu Actions

1. **Edit Details** (icon: `edit`) — opens `EditProjectDialogComponent`
2. **Responsible Parties** (icon: `supervisor_account`) — opens shared `ResponsiblePartiesDialogComponent`
3. **Related Projects** (icon: `link`) — opens `RelatedProjectsDialogComponent`
4. **Metadata** (icon: `list`) — opens existing `MetadataDialogComponent`; on dialog close, caller persists result via `projectService.patch(id, { metadata })` (same pattern as admin teams)
5. **Delete** (icon: `delete`, warn color) — confirm dialog, then `projectService.delete()`

### Filters

Three API-backed filters, all persisted in URL query params:

1. **Name** — text input, debounced 300ms, maps to `name` API param (partial match)
2. **Team** — autocomplete text input:
   - Searches teams by name via `TeamService.list({ name, limit: 10 })` (debounced 300ms, min 2 chars)
   - On selection, resolves to `team_id` UUID for API call
   - Shows "x" clear button when a team is selected
   - URL stores `team_id` UUID; resolved back to team name on page load via `TeamService.get()`
3. **Status** — single-select dropdown using `ProjectStatus` values with empty "All" option

**Clear Filters** button visible when any filter is active. Resets all filters and reloads.

All filter changes reset pagination to page 0.

### Pagination

Same pattern as admin teams: `MatPaginator` with `showFirstLastButtons`, page size options from shared constants.

**URL state persistence:** The existing `buildPaginationQueryParams()` only accepts a single `filterText` string. Since the projects page has three filters (name, team_id, status), the component will build query params directly (adding `team_id` and `status` params alongside the pagination params) rather than extending the shared utility. This keeps the utility simple for its current consumers.

## Add Project Flow

The "Add Project" button opens the existing `CreateProjectDialogComponent` (in `shared/components/create-project-dialog/`). On dialog close with a result, the component calls `projectService.create(result)` then reloads the list. This mirrors admin teams' use of `CreateTeamDialogComponent`.

## Dialog: EditProjectDialogComponent

Inline template, mirrors `EditTeamDialogComponent`. Used only for editing existing projects (not creating).

**Fields:**
- `name` (required, max 256)
- `description` (max 2048, textarea)
- `team_id` (required, dropdown populated from `TeamService.list()`)
- `uri` (URL format)
- `status` (dropdown from `PROJECT_STATUSES`)

Saves via `ProjectService.patch()` with only changed fields.

## Dialog: ResponsiblePartiesDialogComponent (Refactored)

Move from `pages/admin/teams/responsible-parties-dialog/` to `shared/components/responsible-parties-dialog/`.

**Changes from current implementation:**
- Remove `TeamService` dependency injection — the dialog no longer calls any service directly
- Remove `TranslocoService` injection (was only used for the user picker title, which can use the pipe instead)
- Save logic delegated to caller via `patchFn` callback
- Error handling remains in the dialog: the `patchFn` returns an Observable; the dialog subscribes with the same `error` handler pattern (extracts `error.error?.message` for display)

**New dialog data interface:**
```typescript
interface ResponsiblePartiesDialogData {
  entityId: string;
  entityType: 'team' | 'project';
  parties: ResponsibleParty[];
  patchFn: (id: string, parties: ResponsibleParty[]) => Observable<unknown>;
}
```

- `patchFn` callback lets each caller provide their own save logic
- Template uses `entityType` to select i18n key prefix (`teams.responsiblePartiesDialog.*` or `projects.responsiblePartiesDialog.*`)
- Admin teams component updated to pass `{ entityId: team.id, entityType: 'team', parties: team.responsible_parties, patchFn: (id, parties) => teamService.patch(id, { responsible_parties: parties }) }`
- Admin projects component passes equivalent with `projectService.patch`

## Dialog: RelatedProjectsDialogComponent

New component mirroring `RelatedTeamsDialogComponent`:

- Searches projects via `ProjectService.list({ name })` (autocomplete, debounced, min 2 chars)
- Excludes current project from search results
- Uses `RelatedProject` type (`related_project_id` field)
- Relationship type dropdown uses shared `RELATIONSHIP_TYPES` constant
- Saves via `ProjectService.patch(id, { related_projects })`
- i18n keys under `projects.relatedProjectsDialog.*`

## Routing

Add to `app.routes.ts` under admin children:

```typescript
{
  path: 'projects',
  loadComponent: () =>
    import('./pages/admin/projects/admin-projects.component')
    .then(c => c.AdminProjectsComponent),
  canActivate: [adminGuard],
}
```

## Admin Landing Page

Add "Projects" card to `adminSections` array in `admin.component.ts`, positioned after "Teams":

```typescript
{
  title: 'admin.sections.projects.title',
  description: 'admin.sections.projects.description',
  icon: 'folder',
  action: 'projects',
}
```

## i18n Keys

New keys under `projects.*`:

```
projects.title — "Manage Projects"
projects.subtitle — "Create, edit, and manage projects, relationships, and metadata"
projects.filterLabel — "Filter by Name"
projects.teamFilterLabel — "Filter by Team"
projects.statusFilterLabel — "Filter by Status"
projects.statusAll — "All Statuses"
projects.clearFilters — "Clear Filters"
projects.addButton — "Add Project"
projects.noProjects — "No projects found"

projects.columns.name — reference common.name
projects.columns.status — reference common.status
projects.columns.team — reference common.team
projects.columns.modified — "Modified"

projects.kebab.editDetails — "Edit Details"
projects.kebab.responsibleParties — reference projects.responsiblePartiesDialog.title
projects.kebab.relatedProjects — reference projects.relatedProjectsDialog.title
projects.kebab.metadata — reference common.metadata
projects.kebab.delete — reference common.delete

projects.editDialog.title — "Edit Project"

projects.deleteDialog.message — "Are you sure you want to delete project \"{{name}}\"?"

projects.responsiblePartiesDialog.title — "Responsible Parties"
projects.responsiblePartiesDialog.addParty — "Add Responsible Party"
projects.responsiblePartiesDialog.noParties — "No responsible parties"
projects.responsiblePartiesDialog.removeParty — "Remove Responsible Party"

projects.relatedProjectsDialog.title — "Related Projects"
projects.relatedProjectsDialog.addRelated — "Add Related Project"
projects.relatedProjectsDialog.noRelated — "No related projects"
projects.relatedProjectsDialog.selectProject — "Select Project"
projects.relatedProjectsDialog.relationship — "Relationship"
projects.relatedProjectsDialog.customRelationship — "Custom Relationship"

projects.status.active — reference common.active
projects.status.planning — "Planning"
projects.status.on_hold — "On Hold"
projects.status.completed — "Completed"
projects.status.archived — "Archived"
projects.status.cancelled — "Cancelled"

admin.sections.projects.title — "Projects"
admin.sections.projects.description — "Manage projects, relationships, and metadata"
```

Relationship type labels reuse existing `teams.relationships.*` keys (they are documented as shared).

## What This Design Does NOT Include

- `related_to`/`relationship`/`transitive` API filters (deferred to future project explorer)
- Multi-select team filter (API only accepts single `team_id`)
- Project members (projects inherit membership from their team)
- `reviewed_by`/`reviewed_at` editing (read-only server fields, no admin action needed)
