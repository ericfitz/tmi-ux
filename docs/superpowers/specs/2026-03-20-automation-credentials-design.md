# Automation User & Credential Management Design

**Issues**: #524, #526
**Date**: 2026-03-20
**Milestone**: release/1.3.0

## Overview

Add automation user creation to the webhook dialog (#524) and credential management to the admin users page (#526). Both features share a service layer for automation account and credential CRUD operations against the TMI server API.

## Implementation Order

0. Regenerate API types from latest OpenAPI spec
1. Types & service layer (shared foundation)
2. #526: Admin users page — automation filter, manage credentials dialog
3. #524: Webhook dialog — automation user checkbox, creation dialog

## 0. Regenerate API Types

The generated types in `src/app/generated/api-types.d.ts` are stale — they predate the automation user and admin credential management endpoints in the server API. Regenerate from the local spec:

```bash
OPENAPI_SPEC=/Users/efitz/Projects/tmi/api-schema/tmi-openapi.json pnpm run generate:api-types
```

This will produce generated types for:
- `AdminUser` (now includes `automation?: boolean | null`)
- `CreateAutomationAccountRequest`, `CreateAutomationAccountResponse`
- `ListClientCredentialsResponse` (paginated credential list)
- `ClientCredentialInfo`, `ClientCredentialResponse`, `CreateClientCredentialRequest` (existing but refreshed)
- Operation types for all admin credential endpoints
- `AutomationQueryParam` for user list filtering

After regeneration, update hand-written types in `src/app/types/user.types.ts` and `src/app/types/client-credential.types.ts` to re-export from the generated types instead of duplicating definitions. Keep `AdminUserFilter` hand-written since it's a client-side convenience type not in the OpenAPI schema.

## 1. Types & Service Layer

### Type Changes

**`src/app/types/user.types.ts`**:
- Re-export `AdminUser` from generated types (removes hand-written duplicate; gains `automation` field automatically)
- Re-export `CreateAutomationAccountRequest` and `CreateAutomationAccountResponse` from generated types
- Keep `AdminUserFilter` hand-written; add `automation?: boolean`
- Fix pre-existing bug: `AdminUserFilter.sort_by` includes `'modified_at'` but the API enum is `['created_at', 'last_login', 'email', 'name']`. Remove `'modified_at'`, add `'name'`.

**`src/app/types/client-credential.types.ts`**:
- Re-export `ClientCredentialInfo`, `ClientCredentialResponse`, `CreateClientCredentialRequest`, `ListClientCredentialsResponse` from generated types (removes hand-written duplicates)

### Service Changes

**`src/app/core/services/user-admin.service.ts`**:

Add `automation?: boolean` to `AdminUserFilter`.

New methods:
- `createAutomationUser(request: CreateAutomationAccountRequest): Observable<CreateAutomationAccountResponse>` — `POST admin/users/automation`
- `listUserCredentials(internalUuid: string): Observable<ListClientCredentialsResponse>` — `GET admin/users/{internalUuid}/client_credentials` (returns paginated response; caller extracts `.credentials`)
- `createUserCredential(internalUuid: string, input: CreateClientCredentialRequest): Observable<ClientCredentialResponse>` — `POST admin/users/{internalUuid}/client_credentials`
- `deleteUserCredential(internalUuid: string, credentialId: string): Observable<void>` — `DELETE admin/users/{internalUuid}/client_credentials/{credentialId}`

## 2. Issue #526: Admin Users Page — Manage Credentials

### Filter Changes

**`admin-users.component.html` / `.ts`**:
- Add `mat-slide-toggle` or `mat-checkbox`: "Show automation accounts only"
- When toggled on: pass `automation: true` to `UserAdminService.list()`
- When toggled off: remove `automation` param (show all users)

### Action Button

- Add "Manage Credentials" `mat-icon-button` (action button with `matTooltip`) to each user row
- Icon: `key` or `vpn_key`
- Enabled only when `user.automation === true` (strict equality — `null` and `false` both disable)
- On click: open `ManageCredentialsDialog` with user's `internal_uuid` and `name`

### ManageCredentialsDialog (new component)

**Location**: `src/app/pages/admin/users/manage-credentials-dialog/`

**Dialog data interface**:
```typescript
interface ManageCredentialsDialogData {
  internalUuid: string;
  userName: string;
}
```

**Structure**:
- Title: "Manage Credentials for {userName}"
- Table of existing credentials: name, client_id, created_at, expires_at, last_used_at, is_active
- Delete button per row (with confirmation)
- "Add Credential" button outside the list
- Loading spinner while fetching

**Behavior**:
- On open: `UserAdminService.listUserCredentials(userId)` — extract `.credentials` from paginated response. Request high limit (e.g., 100) since pagination UI is not needed for credentials.
- "Add Credential": open existing `CreateCredentialDialogComponent` with `returnFormOnly: true` — dialog returns form values (`CreateClientCredentialRequest`) without calling API. `ManageCredentialsDialog` calls `UserAdminService.createUserCredential()`, then shows `CredentialSecretDialogComponent` on success, refreshes list.
- Delete: confirmation prompt, `UserAdminService.deleteUserCredential()`, refresh list

### CreateCredentialDialog Modification

The existing `CreateCredentialDialogComponent` does not currently inject `MAT_DIALOG_DATA` — it has no input data interface. Changes:
1. Create a dialog data interface: `CreateCredentialDialogData { returnFormOnly?: boolean }`
2. Add `MAT_DIALOG_DATA` injection (optional, defaulting to `{ returnFormOnly: false }`)
3. When `returnFormOnly` is `true`, the dialog returns the form values (`CreateClientCredentialRequest`) on submit instead of calling `ClientCredentialService.create()`
4. Existing callers pass no data and get the current behavior unchanged

## 3. Issue #524: Webhook Dialog — Create Automation User

### Webhook Dialog Changes

**`add-webhook-dialog.component.ts`**:
- Add `mat-checkbox`: "Create automation user for this webhook"
- Stored as boolean form control `createAutomationUser`, not sent to webhook API
- Dialog return value changes: currently returns `WebhookSubscription` on success. Change to return `{ webhook: WebhookSubscription; createAutomationUser: boolean }`. Update parent to destructure accordingly.

### Parent Flow (admin-webhooks.component.ts)

After webhook creation succeeds, if `createAutomationUser` is true:

1. Open `CreateAutomationUserDialog` with pre-populated values derived from webhook name
2. User edits name/email and clicks "Create User" or "Cancel"
3. The dialog calls `UserAdminService.createAutomationUser()` itself and handles errors inline (e.g., 409 Conflict: "An automation account with this name already exists")
4. On success: dialog returns `CreateAutomationAccountResponse`. Parent opens `CredentialSecretDialogComponent` with `client_id` + `client_secret` from the response.
5. On cancel: dismiss, return to webhooks list (webhook was already created successfully)

### CreateAutomationUserDialog (new component)

**Location**: `src/app/pages/admin/webhooks/create-automation-user-dialog/`

**Dialog data interface**:
```typescript
interface CreateAutomationUserDialogData {
  webhookName: string;
}
```

**Structure**:
- Title: "Create Automation User"
- Fields: name (text, required), email (text, pre-populated)
- Buttons: "Cancel", "Create User"
- Name validation: API pattern `^[a-zA-Z][a-zA-Z0-9 _.@-]*[a-zA-Z0-9]$`, 2-64 chars
- Inline error message area for API errors (especially 409 Conflict)

**Pre-population logic**:
- Short name: webhook name used as-is for the name field (user can edit)
- Email local part processing:
  1. Lowercase the webhook name
  2. Replace any sequence of non-alphanumeric characters with a single hyphen
  3. Trim leading/trailing hyphens
  4. Result becomes `{processed}@tmi.local`

**The dialog calls the API itself** (`UserAdminService.createAutomationUser()`) and returns `CreateAutomationAccountResponse` on success. On error, it displays the error inline and lets the user retry or cancel.

## 4. Localization

Before adding new keys to the English locale file, check for existing keys that can be reused (e.g., common labels like "Name", "Email", "Cancel", "Delete", "Created", "Status").

Add only keys that don't already exist. After implementation, backfill to other languages via the localization skill.

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/users` | GET | List users (with `?automation=true` filter) |
| `/admin/users/automation` | POST | Create automation account (returns user + credential) |
| `/admin/users/{internal_uuid}/client_credentials` | GET | List credentials for automation user |
| `/admin/users/{internal_uuid}/client_credentials` | POST | Create credential for automation user |
| `/admin/users/{internal_uuid}/client_credentials/{credential_id}` | DELETE | Delete credential |

## New Components

| Component | Location |
|-----------|----------|
| ManageCredentialsDialog | `src/app/pages/admin/users/manage-credentials-dialog/` |
| CreateAutomationUserDialog | `src/app/pages/admin/webhooks/create-automation-user-dialog/` |

## Modified Files

| File | Changes |
|------|---------|
| `src/app/generated/api-types.d.ts` | Regenerated from latest OpenAPI spec |
| `src/app/types/user.types.ts` | Re-export from generated types, keep `AdminUserFilter`, add `automation` filter, fix `sort_by` |
| `src/app/types/client-credential.types.ts` | Re-export from generated types |
| `src/app/core/services/user-admin.service.ts` | Add `automation` filter, 4 new methods |
| `src/app/pages/admin/users/admin-users.component.ts` | Automation filter toggle, manage credentials button |
| `src/app/pages/admin/users/admin-users.component.html` | Filter UI, action button |
| `src/app/pages/admin/webhooks/add-webhook-dialog/add-webhook-dialog.component.ts` | Checkbox, change return type |
| `src/app/pages/admin/webhooks/admin-webhooks.component.ts` | Handle automation user creation flow after webhook |
| `src/app/core/components/user-preferences-dialog/create-credential-dialog/create-credential-dialog.component.ts` | Add dialog data interface, `MAT_DIALOG_DATA` injection, `returnFormOnly` option |
| `src/assets/i18n/en.json` | New locale keys (only those not already existing) |
