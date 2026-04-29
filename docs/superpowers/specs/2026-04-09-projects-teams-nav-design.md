# Add Navigation to My Projects and My Teams

**Issue:** [#569](https://github.com/ericfitz/tmi-ux/issues/569)
**Date:** 2026-04-09

## Problem

The `/projects` and `/teams` routes exist with fully implemented pages (`ProjectsComponent`, `TeamsComponent`), but there are no navigation controls anywhere in the app to reach them. Users can only access these pages by typing the URL directly.

## Decision

Add "My Projects" and "My Teams" as menu items in the home menu dropdown (the logo/caret button in the navbar). No changes to the center navbar buttons.

### Why home menu only

Projects and Teams are "manage my organizational structure" pages — secondary to the primary workflow (Intake → Dashboard for normal users, Triage for reviewers). They don't warrant top-level navbar buttons, but the home menu is a natural place for navigation discovery.

## Menu Structure

Restructure the home menu with dividers to create four logical groups:

```
Home
─────────────────
Intake
Dashboard
─────────────────
My Projects
My Teams
─────────────────
Triage (disabled if not reviewer)
Admin (disabled if not admin)
─────────────────
Sign Out
```

**Group rationale:**
1. Home — landing page
2. Primary actions for all users — intake requests and threat model dashboard
3. Secondary actions for all users — organizational management
4. Specialist actions — role-gated (reviewer, admin)
5. Sign Out — session control

## Specification

### Menu Items

| Item | Icon | Route | i18n Key | Visibility | Disabled |
|------|------|-------|----------|------------|----------|
| My Projects | `folder` | `/projects` | `userProjects.title` | All authenticated | Never |
| My Teams | `groups` | `/teams` | `userTeams.title` | All authenticated | Never |

### Existing Menu Changes

- Add `mat-divider` after Home (new)
- Add `mat-divider` after Dashboard (new)
- Add My Projects and My Teams items (new)
- Add `mat-divider` after My Teams (new)
- Triage and Admin remain as-is (with existing disabled logic)
- Existing `mat-divider` before Sign Out remains

### Files Changed

| File | Change |
|------|--------|
| `src/app/core/components/navbar/navbar.component.html` | Restructure `homeMenu`: add dividers, add two new menu items, reorder Triage/Admin to below Projects/Teams |

### No Changes Needed

- **Routing** — `/projects` and `/teams` routes already exist in `app.routes.ts`
- **Components** — `ProjectsComponent` and `TeamsComponent` already exist
- **i18n** — `userProjects.title` ("My Projects") and `userTeams.title` ("My Teams") already exist in `en-US.json`
- **Navbar TS** — no new getters or logic needed; items are visible to all authenticated users
- **Center navbar** — no changes
