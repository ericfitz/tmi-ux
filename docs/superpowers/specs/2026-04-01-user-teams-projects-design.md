# User Teams & Projects Pages

**Issue:** [#480](https://github.com/ericfitz/tmi-ux/issues/480)
**Date:** 2026-04-01

## Problem

Users have no UI to view or edit teams and projects they've created or belong to. The only team/project management UI is in the admin section, which requires admin privileges.

## Solution

Create user-facing `/teams` and `/projects` pages that mirror the admin team/project pages, minus the delete action. Relocate five dialog components from `admin/` to `shared/components/` so both admin and user pages can reuse them.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Edit scope | Full mirror of admin (minus delete) | API enforces authorization; less duplication; fewer future feature requests |
| Route location | Top-level `/teams` and `/projects` | First-class entities; clean URLs; aligns with nav model refactor (#532) |
| Page layout | Table-based, matching admin | Consistency; handles growing lists; fastest to implement |
| Data scoping | API decides visibility | No frontend authorization logic; server controls what users see |
| Delete action | Excluded from user pages | Safer UX; avoids showing actions that will likely fail |
| Close/back navigation | `Location.back()` | Users may arrive from various pages; should return to previous context |

## File Structure

### New Files

```
src/app/pages/teams/
  teams.component.ts        # User teams list page
  teams.component.html
  teams.component.scss

src/app/pages/projects/
  projects.component.ts     # User projects list page
  projects.component.html
  projects.component.scss
```

### Dialogs Relocated to Shared

These dialogs move from their current admin locations to `src/app/shared/components/`. No behavioral changes — pure relocation. Admin components update their import paths.

| Dialog | Current Location | New Location |
|--------|-----------------|--------------|
| `EditTeamDialogComponent` | `pages/admin/teams/edit-team-dialog/` | `shared/components/edit-team-dialog/` |
| `TeamMembersDialogComponent` | `pages/admin/teams/team-members-dialog/` | `shared/components/team-members-dialog/` |
| `RelatedTeamsDialogComponent` | `pages/admin/teams/related-teams-dialog/` | `shared/components/related-teams-dialog/` |
| `EditProjectDialogComponent` | `pages/admin/projects/edit-project-dialog/` | `shared/components/edit-project-dialog/` |
| `RelatedProjectsDialogComponent` | `pages/admin/projects/related-projects-dialog/` | `shared/components/related-projects-dialog/` |

### Dialogs Already in Shared (No Change)

- `CreateTeamDialogComponent`
- `CreateProjectDialogComponent`
- `ResponsiblePartiesDialogComponent`
- `MetadataDialogComponent`

## Routing

Two new top-level routes in `app.routes.ts`, protected by `authGuard`:

```typescript
{
  path: 'teams',
  loadComponent: () =>
    import('./pages/teams/teams.component').then(c => c.TeamsComponent),
  canActivate: [authGuard],
},
{
  path: 'projects',
  loadComponent: () =>
    import('./pages/projects/projects.component').then(c => c.ProjectsComponent),
  canActivate: [authGuard],
},
```

## Component Behavior

### TeamsComponent

Clone of `AdminTeamsComponent` with these differences:

- **Header:** "My Teams" with user-oriented subtitle (not "Manage Teams")
- **Close button:** `Location.back()` instead of `router.navigate(['/admin'])`
- **No delete action** in the kebab menu
- **Same features:** table columns (name, status, members, projects, modified, actions), filter with debounce, pagination, sorting, all dialog interactions (create, edit details, members, responsible parties, related teams, metadata)

### ProjectsComponent

Clone of `AdminProjectsComponent` with these differences:

- **Header:** "My Projects" with user-oriented subtitle (not "Manage Projects")
- **Close button:** `Location.back()`
- **No delete action** in the kebab menu
- **Same features:** table columns (name, status, team, modified, actions), filters (name, team autocomplete, status dropdown), pagination, sorting, all dialog interactions (create, edit details, responsible parties, related projects, metadata)

## Localization

New i18n keys for the changed header/subtitle text:

- `userTeams.title` — "My Teams"
- `userTeams.subtitle` — "View and edit your teams, members, and relationships"
- `userProjects.title` — "My Projects"
- `userProjects.subtitle` — "View and edit your projects, teams, and relationships"

All other i18n keys (column headers, dialog text, status labels, pagination) reuse existing `teams.*` and `projects.*` keys.

## Testing

- Unit tests for `TeamsComponent` and `ProjectsComponent` following the same patterns as admin component tests
- Verify dialog relocation doesn't break admin pages (admin tests should still pass with updated imports)
- Verify `Location.back()` navigation behavior

## Dependencies

- **Blocks:** #539 (ui updates for team and project notes) — notes UI needs these user pages to exist first
- **Related:** #532 (nav model refactor) — these routes will need navigation entries when the nav refactor lands
