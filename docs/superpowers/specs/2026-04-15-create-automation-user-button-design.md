# Design: Add "Create Automation User" Button to Admin Users Page

**Issue:** #598
**Date:** 2026-04-15
**Status:** Approved

## Problem

The only way to create an automation user in the UI is through the webhook creation flow. Admins need a standalone way to create automation users directly from the admin users page.

## Solution

Move the existing `CreateAutomationUserDialogComponent` from the webhooks folder to a shared admin location, generalize it to remove webhook-specific coupling, and add a "Create Automation User" button to the admin users page header. Relocate localization keys to a neutral namespace.

## Changes

### 1. Relocate Dialog

**From:** `src/app/pages/admin/webhooks/create-automation-user-dialog/`
**To:** `src/app/pages/admin/shared/create-automation-user-dialog/`

### 2. Generalize the Dialog

- Rename `CreateAutomationUserDialogData.webhookName` to an optional `suggestedName?: string`
- When no suggested name is provided (standalone creation from users page), the name field starts empty and email is not pre-generated
- Remove the JSDoc reference to "webhook subscription"
- All other behavior unchanged: same form fields, same validators, same API call (`POST /admin/users/automation`), same `CreateAutomationAccountResponse` return type

### 3. Admin Users Page Template (`admin-users.component.html`)

Add a `mat-raised-button` with `add` icon and "Create Automation User" label in the header's `action-buttons` div, before the close button. Follows the same button pattern used on the groups and webhooks admin pages.

### 4. Admin Users Component (`admin-users.component.ts`)

Add `onCreateAutomationUser()` method:
1. Opens `CreateAutomationUserDialogComponent` with empty data (no suggested name)
2. On dialog close with a result: opens `CredentialSecretDialogComponent` to display the one-time client credentials
3. After credential dialog closes: calls `loadUsers()` to refresh the table

New imports: relocated `CreateAutomationUserDialogComponent` and `CredentialSecretDialogComponent`.

### 5. Update Webhooks Component (`admin-webhooks.component.ts`)

- Update import path to point to new shared location
- Pass `{ suggestedName: webhookName }` instead of `{ webhookName }`

### 6. Localization Keys

Move `admin.webhooks.createAutomationUserDialog.*` → `admin.createAutomationUserDialog.*` across all language files. Update all template references in the dialog.

## What Stays the Same

- Form fields, validators, API call, response handling — all identical
- `CredentialSecretDialogComponent` location and behavior — unchanged
- `UserAdminService.createAutomationUser()` — unchanged
- No new API endpoints or service methods required

## Files Affected

| File | Change |
|------|--------|
| `src/app/pages/admin/shared/create-automation-user-dialog/create-automation-user-dialog.component.ts` | New location, generalized interface |
| `src/app/pages/admin/webhooks/create-automation-user-dialog/` | Deleted (moved) |
| `src/app/pages/admin/users/admin-users.component.html` | Add button |
| `src/app/pages/admin/users/admin-users.component.ts` | Add method + imports |
| `src/app/pages/admin/webhooks/admin-webhooks.component.ts` | Update import path + dialog data |
| `src/assets/i18n/en-US.json` | Move localization keys |
| `src/assets/i18n/*.json` | Move localization keys (all languages) |
