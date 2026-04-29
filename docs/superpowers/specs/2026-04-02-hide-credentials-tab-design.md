# Hide Client Credentials Tab for Normal Users

**Issue:** [#552](https://github.com/ericfitz/tmi-ux/issues/552) — Normal users should not be able to create client credentials

**Date:** 2026-04-02

## Problem

The Credentials tab in the User Preferences dialog is visible to all users. Only admins and security reviewers should see it.

## Design

### File: `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts`

1. Add a `canManageCredentials` boolean property, initialized to `false`.
2. In `ngOnInit`, after setting `userProfile` (both from the synchronous property and the async `refreshUserProfile` call), derive the flag: `canManageCredentials = profile.is_admin === true || profile.is_security_reviewer === true`.
3. Wrap the Credentials `<mat-tab>` block in `@if (canManageCredentials)`.
4. Only call `loadCredentials()` when `canManageCredentials` is true.

### File: `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.spec.ts`

Add test cases:
- Credentials tab is hidden when user is neither admin nor security reviewer.
- Credentials tab is visible when user is admin.
- Credentials tab is visible when user is security reviewer.

## Scope

- One component file + its spec. No new files, services, or architectural changes.
- Server-side enforcement is assumed to exist independently; this is a UI-only fix.
