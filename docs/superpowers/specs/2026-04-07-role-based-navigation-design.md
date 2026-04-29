# Role-Based Navigation Redesign

**Issue:** [#532 — refactor: change navigation model (buttons in nav bar)](https://github.com/ericfitz/tmi-ux/issues/532)
**Date:** 2026-04-07

## Problem

The current navbar shows all four navigation buttons (Intake, Triage, Dashboard, Admin) to every authenticated user. Triage and Admin are disabled when the user lacks the role, but they still clutter the toolbar with irrelevant options.

## Design

Two changes to the navbar:

1. **Home button becomes a navigation menu** — provides access to all destinations
2. **Toolbar buttons are filtered by role** — only primary actions for the user's role appear

### Home Button Menu

The TMI logo/home button becomes a `mat-menu` trigger with a dropdown indicator (`arrow_drop_down`). The menu is the same for all authenticated users:

| Item | Icon | Route | Behavior |
|---|---|---|---|
| Home | `home` | `/` | Always enabled |
| Intake | `assignment` | `/intake` | Always enabled |
| Dashboard | `dashboard` | `/dashboard` | Always enabled |
| Triage | `inbox` | `/triage` | Disabled if `!isSecurityReviewer` |
| Admin | `admin_panel_settings` | `/admin` | Disabled if `!isAdmin` |
| *divider* | — | — | — |
| Logout | `logout` | — | Calls `authService.logout()` |

Disabled items are visible but greyed out with no click action.

### Role-Based Toolbar Buttons

The center section of the toolbar shows only the primary buttons for the user's role:

| Role flags | Toolbar buttons (left to right) |
|---|---|
| Normal user (neither flag) | Intake, Dashboard |
| Security reviewer only | Dashboard, Triage |
| Admin only | Admin |
| Reviewer + Admin | Dashboard, Triage, Admin |

Visibility logic:

- **Intake**: shown if `!isAdmin && !isSecurityReviewer`
- **Dashboard**: shown if `!isAdmin || isSecurityReviewer` (hidden only for admin-only users)
- **Triage**: shown if `isSecurityReviewer`
- **Admin**: shown if `isAdmin`

### Toolbar Right Side

The logout button is removed from the toolbar — it moves exclusively into the home menu. The right side retains:

- Feedback menu
- WebSocket status indicator
- Server connection status
- User profile button (username — opens preferences)

### Unchanged Behaviors

- **Route guards**: `authGuard`, `adminGuard`, `reviewerGuard` remain as-is. Menu/toolbar changes are cosmetic; authorization is unchanged.
- **Landing page logic**: `getLandingPage()` continues to route reviewer to dashboard, admin to admin, normal user to intake.
- **Unauthenticated state**: No nav buttons or menu shown (existing `@if (isAuthenticated)` behavior).
- **Footer**: Unchanged. About, ToS, Privacy stay there.
- **User profile button**: Unchanged. Preferences remain under the username.
- **Language selector**: Unchanged position on the left.
- **Active route highlighting**: `routerLinkActive` continues to work on toolbar buttons.

## Roles

Roles are independent boolean flags (`is_admin`, `is_security_reviewer`), not a hierarchy. Admin does not imply reviewer access. Reviewer does not imply admin access. All authenticated users are also normal users.

## Implementation Scope

- Modify `navbar.component.html` — add `mat-menu` to home button, filter center nav buttons with `@if` directives
- Modify `navbar.component.ts` — no new properties needed; existing `isAdmin` and `isSecurityReviewer` flags are sufficient
- Modify `navbar.component.scss` — style the menu trigger indicator; menu item styling uses Material defaults
- Remove the standalone logout button from the toolbar right side
- Update navbar tests to cover role-based visibility
- Localization: menu item labels need i18n keys (Home, Logout are new; others reuse existing keys)
