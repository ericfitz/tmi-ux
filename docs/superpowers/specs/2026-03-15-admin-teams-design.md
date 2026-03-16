# Design: Admin Teams Management

**Issue:** [#479](https://github.com/ericfitz/tmi-ux/issues/479) — Admin UX to manage teams
**Date:** 2026-03-15
**Related:** [#501](https://github.com/ericfitz/tmi-ux/issues/501) (admin projects, depends on this), [ericfitz/tmi#181](https://github.com/ericfitz/tmi/issues/181) (server: team status enum)

## Problem

There is no admin UX for managing teams. Teams are a core organizational unit — projects belong to teams, and teams have members, responsible parties, and relationships to other teams. Admins need to list, create, edit, delete, and manage all aspects of teams.

## Solution

A new admin page at `/admin/teams` following the established admin groups pattern: table with filtering/pagination/sorting, dialog-based CRUD, and kebab menu actions for sub-entity management (members, responsible parties, related teams, metadata).

## Page Structure

Follows the exact admin groups layout:

1. **Header** — "Teams" title, subtitle, close button (returns to admin dashboard)
2. **Filter card** — Text input with 300ms debounced search filtering by team name via API. Resets to page 0 on change.
3. **Data card** — "Teams" title + "Add Team" button in header. Table with sorting and pagination. Loading spinner. Empty state message.

**Routing:** Lazy-loaded route `/admin/teams` protected by `adminGuard`. New card on admin dashboard grid (icon: `groups`, title: "Teams", description: "Manage teams and team membership").

## Table

| Column | Field | Sortable | Notes |
|--------|-------|----------|-------|
| Name | `name` | Yes | `matTooltip` shows `description` |
| Status | `status` | Yes | Localized via `teams.status.<value>` transloco key |
| Members | `member_count` | Yes | Numeric count |
| Projects | `project_count` | Yes | Numeric count |
| Modified | `modified_at` | Yes | ISO 8601 date only (`yyyy-MM-dd` via `date:'yyyy-MM-dd'` pipe) |
| Actions | — | No | Kebab menu |

**Default sort:** Name ascending.

**Pagination:** `DEFAULT_PAGE_SIZE`, `PAGE_SIZE_OPTIONS`, offset from page index/size, pagination state synced to URL query params. Same pattern as admin groups.

**Sorting:** Client-side via `MatSort` on the current page of data, consistent with the admin groups pattern. Server-side sorting is not used.

## Status Values

Team status is displayed as a localized dropdown/label. Values:

| Key | i18n key |
|-----|----------|
| `active` | `teams.status.active` |
| `on_hold` | `teams.status.on_hold` |
| `winding_down` | `teams.status.winding_down` |
| `archived` | `teams.status.archived` |
| `forming` | `teams.status.forming` |
| `merging` | `teams.status.merging` |
| `splitting` | `teams.status.splitting` |

Currently the server accepts freeform strings ([ericfitz/tmi#181](https://github.com/ericfitz/tmi/issues/181) filed to change to enum). The client enforces these values via a dropdown.

## Kebab Menu Actions

Each table row has a kebab menu (`mat-icon-button` with `more_vert`) containing:

1. **Edit Details** — opens Edit Team dialog
2. **Members** — opens Team Members dialog
3. **Responsible Parties** — opens Responsible Parties dialog
4. **Related Teams** — opens Related Teams dialog
5. **Metadata** — opens existing MetadataDialog
6. **Delete** — opens delete confirmation dialog

## Dialogs

### Create Team Dialog

Update the existing `CreateTeamDialog` (`src/app/shared/components/create-team-dialog/`):
- Replace the freeform `status` text input with a dropdown using the team status enum values (localized)
- Update description `maxlength` from 1024 to 2048 (to match the API schema limit)

### Edit Team Dialog

New dialog. Same fields as create but pre-populated:
- Name (required, max 256 chars)
- Description (max 2048 chars, textarea)
- Email (optional, email validation)
- URI (optional, URL type)
- Status (dropdown with localized enum values)

Saves via `TeamService.update()`. Opens with the full `Team` object fetched via `TeamService.get()`.

### Team Members Dialog

New dialog showing the team's `members` array.

**List view:** Each row displays:
- User display name and email (via `<app-user-display>`)
- Role (localized via `teams.roles.<value>` transloco key)
- Remove button (icon button with `close` icon)

**Add Member flow:**
1. "Add Member" button opens the existing `UserPickerDialog` (`src/app/shared/components/user-picker-dialog/`) as a nested dialog
2. The `UserPickerDialog` already provides debounced server-side search via `GET /admin/users?email=<query>&limit=20` with results showing display name and email
3. The `UserPickerDialog` needs to be extended with an optional role selector — a `TeamMemberRole` dropdown (localized) shown when the caller requests it via an input parameter
4. On user selection, the dialog returns the selected user + role
5. The member is added to the list in the parent Members dialog

**Save:** Changes are collected and saved via `TeamService.patch()` with the updated `members` array.

### Responsible Parties Dialog

Structurally identical to Team Members dialog — same list view, same role enum (`TeamMemberRole`). Manages the `responsible_parties` array instead of `members`. Opens the same `UserPickerDialog` (with role selector enabled) to add responsible parties.

### Related Teams Dialog

New dialog showing the team's `related_teams` array.

**List view:** Each row displays:
- Related team name
- Relationship type (localized via `teams.relationships.<value>` transloco key)
- Remove button

**Add Related Team flow:**
1. "Add" button opens an inline form
2. Team search input — searchable dropdown of teams via `TeamService.list({ name: query })`, excluding the current team
3. Relationship type dropdown with localized `RelationshipType` values
4. "Add" button adds the relationship

**Save:** Via `TeamService.patch()` with updated `related_teams` array.

### Metadata Dialog

Reuses the existing `MetadataDialog` component. Wired up with the team's `metadata` array. No new work on the dialog itself.

## Delete Confirmation

Standard confirmation dialog: "Are you sure you want to delete team [name]?"

If `project_count > 0`, the dialog shows a warning: "This team has [N] project(s). Deleting the team may affect these projects."

Calls `TeamService.delete()`. On server error (e.g., team cannot be deleted due to dependencies), shows an alert dialog with the error message.

## Localized Enums

Three enums need i18n keys across all 16 locale files:

### TeamStatus
Keys under `teams.status.*`:
`active`, `on_hold`, `winding_down`, `archived`, `forming`, `merging`, `splitting`

### TeamMemberRole
Keys under `teams.roles.*`:
`engineering_lead`, `engineer`, `product_manager`, `business_leader`, `security_specialist`, `other`

### RelationshipType
Keys under `teams.relationships.*`:
`parent`, `child`, `dependency`, `dependent`, `supersedes`, `superseded_by`, `related`, `other`

## Service Layer

### TeamService Extensions

Extend `src/app/core/services/team.service.ts` with:

- `get(id: string): Observable<Team>` — `GET /teams/{team_id}`
- `update(id: string, team: TeamInput): Observable<Team>` — `PUT /teams/{team_id}`
- `patch(id: string, changes: TeamPatch): Observable<Team>` — `PATCH /teams/{team_id}`
- `delete(id: string): Observable<void>` — `DELETE /teams/{team_id}`

### User Search

For the user picker, use the existing admin users endpoint:
`GET /admin/users?email=<query>&limit=20`

This supports case-insensitive substring match on email. The existing `AdminUserService` or a new utility can handle this.

### Type Extensions

Extend `src/app/types/team.types.ts` with:

```typescript
interface TeamMember {
  user_id: string;
  readonly user?: User | null;
  role?: TeamMemberRole;
  custom_role?: string;
}

interface ResponsibleParty {
  user_id: string;
  readonly user?: User | null;
  role?: TeamMemberRole;
  custom_role?: string;
}

interface RelatedTeam {
  related_team_id: string;
  relationship: RelationshipType;
  custom_relationship?: string;
}

type TeamMemberRole = 'engineering_lead' | 'engineer' | 'product_manager' | 'business_leader' | 'security_specialist' | 'other';

type RelationshipType = 'parent' | 'child' | 'dependency' | 'dependent' | 'supersedes' | 'superseded_by' | 'related' | 'other';

type TeamStatus = 'active' | 'on_hold' | 'winding_down' | 'archived' | 'forming' | 'merging' | 'splitting';

/** Patch input — writable scalar fields plus sub-entity arrays */
interface TeamPatch {
  name?: string;
  description?: string;
  uri?: string;
  email_address?: string;
  status?: TeamStatus;
  members?: TeamMember[];
  responsible_parties?: ResponsibleParty[];
  related_teams?: RelatedTeam[];
}
```

The `Team` interface needs to be extended to include sub-entity arrays:

```typescript
interface Team extends TeamInput {
  readonly id: string;
  readonly created_at: string;
  readonly modified_at?: string;
  readonly created_by?: User | null;
  readonly modified_by?: User | null;
  members?: TeamMember[];
  responsible_parties?: ResponsibleParty[];
  related_teams?: RelatedTeam[];
  metadata?: Metadata[];
}
```

`Metadata` is imported from `src/app/pages/tm/models/threat-model.model.ts`. If other entities also need `Metadata`, it should be moved to a shared location (e.g., `src/app/types/metadata.types.ts`).

## Components Summary

| Component | Location | New/Modify |
|-----------|----------|------------|
| AdminTeamsComponent | `src/app/pages/admin/teams/` | New |
| EditTeamDialog | `src/app/pages/admin/teams/edit-team-dialog/` | New |
| TeamMembersDialog | `src/app/pages/admin/teams/team-members-dialog/` | New |
| ResponsiblePartiesDialog | `src/app/pages/admin/teams/responsible-parties-dialog/` | New |
| RelatedTeamsDialog | `src/app/pages/admin/teams/related-teams-dialog/` | New |
| UserPickerDialog | `src/app/shared/components/user-picker-dialog/` | Modify (add optional role selector) |
| CreateTeamDialog | `src/app/shared/components/create-team-dialog/` | Modify (status dropdown) |
| MetadataDialog | `src/app/pages/tm/components/metadata-dialog/` | Reuse (no changes) |
| AdminComponent | `src/app/pages/admin/admin.component.html` | Modify (add Teams card) |

## Files Affected

- `src/app/app.routes.ts` — add `/admin/teams` route
- `src/app/pages/admin/admin.component.html` — add Teams card to dashboard
- `src/app/core/services/team.service.ts` — add get/update/patch/delete methods
- `src/app/types/team.types.ts` — add TeamMember, ResponsibleParty, RelatedTeam, enum types, extend Team
- `src/app/shared/components/create-team-dialog/` — update status to dropdown
- `src/assets/i18n/*.json` — add i18n keys for page, enums, dialogs
- New component files listed in Components Summary above

## What This Does NOT Change

- Project management (separate issue #501)
- Non-admin team views (separate issue #480)
- The MetadataDialog component itself
- Any existing admin pages
