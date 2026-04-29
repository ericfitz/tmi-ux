# Permissions Autocomplete for TMI Provider

**Issue:** #601 — feat: auto-complete/auto-match user or group names for tmi provider in permissions dialog
**Date:** 2026-04-15
**Approach:** Option B — Dedicated PermissionsAutocompleteService

## Problem

The permissions dialog subject field is free-text only. When the TMI provider is selected, users must know and type exact `provider_user_id` or group name values. The TMI server already supports substring-matching search on `/admin/users` (by `name`) and `/admin/groups` (by `group_name`), so we can offer autocomplete suggestions for TMI provider entries.

## Constraints

- Only TMI provider rows get autocomplete — other providers remain plain free-text.
- The `/admin/users` and `/admin/groups` endpoints require admin privileges. Non-admin users must not see errors; autocomplete silently degrades to plain free-text.
- Free-form typing is always allowed — the user is not forced to pick from suggestions.

## Design

### 1. AutocompleteSuggestion Interface

New type in `src/app/pages/tm/services/permissions-autocomplete.service.ts`:

```typescript
interface AutocompleteSuggestion {
  displayLabel: string; // "Name (email)" for users, "group_name" for groups
  value: string;        // provider_user_id for users, group_name for groups
}
```

### 2. PermissionsAutocompleteService

New service at `src/app/pages/tm/services/permissions-autocomplete.service.ts`.

**Inputs:** search term (string), principal type (`'user' | 'group'`).

**Behavior:**
- Check `AuthService.isAdmin` — if false, return `of([])` immediately.
- For `user` principal type: call `UserAdminService.list({ provider: 'tmi', name: searchTerm, limit: 10 })`. Map each `AdminUser` to `{ displayLabel: "name (email)", value: provider_user_id }`.
- For `group` principal type: call `GroupAdminService.list({ provider: 'tmi', group_name: searchTerm, limit: 10 })`. Map each `AdminGroup` to `{ displayLabel: group_name, value: group_name }`.
- Catch 401/403 errors silently, returning empty array.
- Does **not** handle debouncing — that is the component's responsibility.

### 3. AdminUserFilter Update

Add `name?: string` to the `AdminUserFilter` interface in `src/app/types/user.types.ts`. The API supports `name` as a case-insensitive substring match query parameter, but the client-side filter type currently lacks it.

### 4. PermissionsDialogComponent Changes

**Template (subject column, lines ~188-208):**
- Attach `[matAutocomplete]` to the existing subject input for TMI provider rows.
- Add a `<mat-autocomplete>` panel that renders `AutocompleteSuggestion` options showing `displayLabel`.
- On selection, write `suggestion.value` into `auth._subject`.
- For non-TMI providers, no autocomplete panel — input behaves exactly as today.

**Component class:**
- Inject `PermissionsAutocompleteService`.
- Add `MatAutocompleteModule` to component imports.
- On input events for TMI provider rows, pipe through `debounceTime(300)`, `distinctUntilChanged()`, minimum 2 characters, then `switchMap` to `PermissionsAutocompleteService.search()`.
- Track suggestions as an observable. A single shared suggestions observable is sufficient since only one input can be active at a time.
- When the user selects a suggestion: `auth._subject = suggestion.value`.
- When the user types free-form (no selection): `auth._subject` retains whatever they typed.

**What doesn't change:**
- Read-only mode (no autocomplete).
- Non-TMI providers (subject input unchanged).
- Save flow, `AuthorizationPrepareService`, owner logic.

### 5. Testing

**PermissionsAutocompleteService spec:**
- User search calls `UserAdminService.list` with `{ provider: 'tmi', name: term, limit: 10 }`.
- Group search calls `GroupAdminService.list` with `{ provider: 'tmi', group_name: term, limit: 10 }`.
- Non-admin returns empty results without API calls.
- 401/403 errors return empty results silently.
- Results are mapped to correct `AutocompleteSuggestion` shape.

**PermissionsDialogComponent spec updates:**
- Autocomplete panel appears for TMI provider rows.
- Autocomplete panel does not appear for non-TMI provider rows.
- Selecting a suggestion populates `_subject` with the suggestion's value.
- Free-form typing is accepted without error.

No E2E tests — admin endpoints require real server state not available in the E2E mock environment.

## Files Changed

| File | Change |
|------|--------|
| `src/app/types/user.types.ts` | Add `name` to `AdminUserFilter` |
| `src/app/pages/tm/services/permissions-autocomplete.service.ts` | **New** — autocomplete search service |
| `src/app/pages/tm/services/permissions-autocomplete.service.spec.ts` | **New** — service tests |
| `src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.ts` | Add `mat-autocomplete` to subject input, inject service |
| `src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.spec.ts` | Add autocomplete-related tests |
