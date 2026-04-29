# Credentials Table Reformat Design

**Issue:** [#519](https://github.com/ericfitz/tmi/issues/519) — Credentials table in user preferences dialog needs reformatting
**Date:** 2026-03-18
**Status:** Approved

## Problem

The credentials table in the user preferences dialog has 6 columns (name, clientId, created, lastUsed, expires, actions) in an 800px-wide dialog. Columns are too narrow to hold their values — even headers wrap. The `clientId` column is especially problematic since credential IDs are long and monospaced.

## Design

### Layout: Reduced-column table with two-line rows

Replace the 6-column table with a 3-column table where each credential occupies two visual rows:

**Columns:** `credential`, `lastUsed`, `actions`

| Column | Header | Content |
|--------|--------|---------|
| credential | "Credential" | Row 1: name (bold), optional description (secondary text), client_id (monospace) — stacked vertically |
| lastUsed | "Last Used" | Relative time display (unchanged logic) |
| actions | (no header) | Delete icon button |

**Metadata sub-row:** A second row per credential spans all 3 columns, displaying "Created {date} · Expires {date}" in secondary text with a bottom border separator.

### Date formatting

Standardize on two patterns:

| Field | Format | Examples |
|-------|--------|---------|
| Created | Absolute with year | "Mar 15, 2026" |
| Last Used | Relative time, falling back to absolute | "Never", "Just now", "2 hrs ago", "3 days ago", "Mar 15, 2026" |
| Expires | Absolute with year, or state | "Mar 15, 2026", "Never", "Expired" (red) |

**Changes to formatting methods:**

- `formatDate()` — add `year: 'numeric'` to the `toLocaleDateString` options so it produces "Mar 15, 2026" instead of "Mar 15"
- `formatLastUsed()` — update the fallback branch (for dates older than 7 days) to also include `year: 'numeric'`
- `formatExpires()` — no change needed, already uses year

### Credential column structure

Within the "Credential" cell, content stacks vertically:

1. **Name** — font-weight 500 (existing `.credential-name` style)
2. **Description** (optional) — secondary color, smaller font (existing `.credential-description` style)
3. **Client ID** — monospace, smaller font, secondary color (existing `.client-id` style)

### Metadata sub-row structure

The metadata row is a `<tr>` with a single `<td colspan="3">` containing:

- "Created {formatDate(created_at)} · Expires {formatExpires(expires_at)}"
- "Created {formatDate(created_at)} · Never expires" (when expires_at is null)
- "Expired" text in warn/red color

Separator: bottom border on the metadata row's `<td>` (using existing divider variable), except on the last credential.

### Implementation approach

**Use mat-table with interleaved rows.** The current template uses `<table mat-table>` (native table rendering), which supports `colspan` on `<td>` elements. This form must be preserved — do not switch to `<mat-table>` (flex rendering), which does not support `colspan`.

Flatten the data source so that each credential produces two entries — a "content" row and a "metadata" row. Use `matRowDef` with a `when` predicate to render different templates for each row type.

Alternatively, if mat-table's row model makes interleaving awkward, replace with a plain `<table>` using `*ngFor` — the current styling is all custom CSS anyway, so the mat-table abstraction provides minimal value here.

### Column definition update

```typescript
// Before
credentialColumns = ['name', 'clientId', 'created', 'lastUsed', 'expires', 'actions'];

// After
credentialColumns = ['credential', 'lastUsed', 'actions'];
```

### Localization

New/updated translation keys needed:

- `userPreferences.credentials.credential` — "Credential" (new column header)
- `userPreferences.credentials.lastUsed` — "Last Used" (existing, unchanged)
- `userPreferences.credentials.createdOn` — "Created" (metadata prefix label)
- `userPreferences.credentials.expired` — "Expired" (metadata expired state)
- `userPreferences.credentials.expiresOn` — "Expires" (metadata expires label)
- `userPreferences.credentials.neverExpires` — "Never expires" (metadata text)

Keys to remove (columns no longer exist):

- `userPreferences.credentials.clientId`
- `userPreferences.credentials.created`
- `userPreferences.credentials.expires`

**All 16 non-English i18n locale files** (ar-SA, bn-BD, de-DE, es-ES, fr-FR, he-IL, hi-IN, id-ID, ja-JP, ko-KR, pt-BR, ru-RU, th-TH, ur-PK, zh-CN) must also have these keys added/removed.

### Styles

Update the credentials table styles:

- Remove unused column-specific styles if any columns are fully eliminated
- Add `.credential-metadata` class for the sub-row: smaller font, secondary color, padding adjustments
- Ensure the metadata row has no top padding (tight coupling with content row above)
- Add `.credential-client-id` or reuse `.client-id` for the monospace ID within the credential cell

### Testing

- Create unit tests for the credentials table (no existing test file for this component)
- Verify two-line row rendering with mock credential data
- Test edge cases: no description, null expires_at, null last_used_at, expired credential
- Test empty state and loading state remain unchanged
