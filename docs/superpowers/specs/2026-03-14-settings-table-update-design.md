# Design: Update Settings Table on Admin/Settings Page

**Issue:** [#486](https://github.com/ericfitz/tmi-ux/issues/486)
**Date:** 2026-03-14
**Branch:** release/1.3.0

## Summary

Refactor the admin settings table to remove the "type", "description", and "last modified" columns, add a "Source" column showing where each setting's effective value comes from, and disable edit/delete controls for read-only settings. The description moves to a tooltip on the key cell, and the type moves to a tooltip on the value cell. The API schema on the server's `release/1.3.0` branch has been updated with two new fields: `source` (enum) and `read_only` (boolean).

## API Schema Changes

The `SystemSetting` schema on the server's `release/1.3.0` branch adds:

```json
"source": {
  "type": "string",
  "enum": ["database", "config", "environment", "vault"],
  "readOnly": true
},
"read_only": {
  "type": "boolean",
  "readOnly": true
}
```

Both fields are server-managed and not writable by the client.

## Changes

### 1. Type Definitions (`src/app/types/settings.types.ts`)

- Add `SettingSource` type: `'database' | 'config' | 'environment' | 'vault'`
- Add `source?: SettingSource` and `read_only?: boolean` to `SystemSetting`
- `SystemSettingUpdate` remains unchanged — `source` and `read_only` are server-managed and never sent by the client

### 2. Table Column Changes (`admin-settings.component.ts` / `.html`)

- **Remove columns:** `type`, `description`, `modified_at`
- **Add column:** `source` (between `value` and `actions`)
- **Displayed columns:** `key`, `value`, `source`, `actions`
- **Description tooltip:** Show the setting's description as a `matTooltip` on the key cell, so admins can see it on hover
- **Type tooltip:** Show the setting's type as a `matTooltip` on the value cell in both view and edit modes, so admins can always identify the type even though the column is removed

### 3. Source Column Display

Plain localized text via Transloco. New i18n keys:

```json
"admin.settings.sources": {
  "database": "Database",
  "config": "Configuration File",
  "environment": "Environment",
  "vault": "Vault",
  "vault.comment": "Vault refers to a secure IT secret storage technology (e.g. HashiCorp Vault), not a physical vault."
}
```

### 4. Read-Only Behavior

When `read_only` is `true`:
- Disable the edit button (pencil icon) with a tooltip indicating the setting is read-only
- Disable the delete option in the kebab menu (greyed out but visible, not hidden)
- Add guard checks in `onEditSetting()` and `onDeleteSetting()` methods as a defensive measure
- No visual change to the row itself — the source column signals provenance

New i18n key: `admin.settings.readOnlyTooltip` — English: `"This setting is read-only and cannot be modified here"`

### 4a. `onSaveSetting` Response Handling

Update the `onSaveSetting()` method to also copy `source` and `read_only` from the API response back to the local setting object, alongside the existing `value`, `description`, `modified_at`, and `modified_by` fields.

### 4b. Add Setting Dialog

No changes needed — the `AddSettingDialogComponent` creates settings via POST, and `source`/`read_only` are server-assigned in the response. The dialog doesn't reference these fields.

### 5. Sorting

- Remove sort matColumnDef entries for `type`, `description`, and `modified_at`
- Add sort on `source`
- Update sorting accessor to handle `source`

### 6. Filter

- Filter predicate currently covers key, value, description. Replace with key, value, description, source (description stays in the filter even though the column is removed — it's still useful to search by)
- Update `admin.settings.filterPlaceholder` — English: `"Filter by key, value, description, or source"`

### 7. Styles (`admin-settings.component.scss`)

- Remove `.setting-type` badge styles (column removed)
- No special styling needed for source column (inherits default cell styling)

### 8. Column Header i18n

- Remove `admin.settings.columns.type`, `admin.settings.columns.description`, and `admin.settings.columns.modified` references
- Add `admin.settings.columns.source` key

### 9. Localization

- Add new English keys to `en-US.json`
- Backfill all other locale files with translations for new keys
