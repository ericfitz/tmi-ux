# Admin Audit-Log UI — Design

- **Issue:** [tmi-ux#679](https://github.com/ericfitz/tmi-ux/issues/679)
- **Status:** Design approved 2026-06-11. **Implementation blocked** on server API ([tmi#398](https://github.com/ericfitz/tmi/issues/398)) — see [Server contract](#server-contract-proposed-pending-tmi398).
- **Related:** tmi-ux#680 (step-up retry) is soft-blocked on this issue; tmi#355 (server write path for system audit entries).

## Summary

An admin-only UI for reading two audit streams: the **system audit log** (every `/admin/*` write: actor, method/path, field path, redacted old/new values) and the **threat-model audit log** (cross-TM view of the existing per-TM history). Two tabbed views under one admin section, sharing a cursor-paged table, a config-driven filter bar, and a route-driven detail side panel. Read-only; no step-up required (per server design).

The existing per-TM audit trail page (`src/app/pages/tm/components/audit-trail-page/`) is **not modified**.

## Decisions made during design

| Decision | Choice | Rationale |
|---|---|---|
| Pagination | Cursor-based, ‹ Newer / Older › only; no total count, no page jumping | Offset pagination on an append-only log duplicates/skips rows under concurrent writes and degrades at deep offsets. Acceptance criteria require stability under concurrent writes. |
| Row detail | Route-driven side panel over the table (child route `:entryId`) | One detail UI serves both click-through and the required permalink. Child-route rendering keeps the table component alive, preserving list state. |
| Permalink positioning | "View in context" re-anchors the table centered on the entry via `around={entry_id}` | Investigators need events immediately before and after the event in question. |
| Export | Server-side streaming (`format=csv\|ndjson` on the list endpoint) | Only honest approach for an unbounded log; client-side assembly needs caps that silently truncate. Promoted to a hard server requirement. |
| Code structure | Self-contained feature in `src/app/pages/admin/audit/` with internals shared between the two views | The views are ~80% structurally identical. Zero blast radius for existing code; no offset/cursor duality forced into the per-TM page. |

## Routes & navigation

- New "Audit Logs" card in `AdminComponent.adminSections`.
- Routes (all under `adminGuard`; non-admins get the existing redirect with `error=admin_required`):
  - `/admin/audit` → redirect to `/admin/audit/system`
  - `/admin/audit/system` — system audit view
    - child `:entryId` → detail panel; `/admin/audit/system/{entry_id}` is the permalink
  - `/admin/audit/threat-models` — cross-TM audit view
    - child `:entryId` → detail panel; `/admin/audit/threat-models/{entry_id}` is the permalink
- Tab nav bar switches views; each tab is deep-linkable.
- Filters and current cursor mirror into query params so refresh/share restores the list view.

## Components (`src/app/pages/admin/audit/`)

| Unit | Purpose | Notes |
|---|---|---|
| `audit-logs-page.component` | Shell: tab nav + router outlet | |
| `system-audit-view.component` | System stream configuration | Composes filter bar + table + panel with system column/filter config |
| `tm-audit-view.component` | TM stream configuration | Same composition, TM config |
| `audit-filter-bar.component` | Config-driven filter controls; emits a filter object | Includes the export menu (enabled for system view) |
| `audit-table.component` | Cursor-paged `mat-table`; column defs passed per view | ‹ Newer / Older › buttons; anchor-row highlight in around mode |
| `audit-detail-panel.component` | Route-driven side panel | Copy-permalink, view-in-context actions |
| `admin-audit.service.ts` | API access | `listSystem(filters, page)`, `getSystemEntry(id)`, `listTmAudit(filters, page)`, `getTmEntry(id)`, `exportSystem(filters, format)` |

New cursor pagination types (`{ items, next_cursor, prev_cursor }`) live alongside the existing offset types; existing types are untouched.

All components are standalone with OnPush change detection, per project convention. Subscriptions use `takeUntil(destroy$)`.

## Pagination & data flow

- Default ordering: newest-first, stable on `(created_at, entry_id)`.
- `next_cursor` (older) / `prev_cursor` (newer) drive the two paging buttons; a `null` cursor disables its button.
- Any filter change resets the cursor (back to newest).
- Opening an entry fetches it by ID via the single-entry endpoint — independent of list pagination. A cold permalink renders the panel immediately with the table freshly loaded from newest.
- "View in context" requests the list with `around={entry_id}`: the page comes back centered on the entry (~half newer, ~half older), anchor row highlighted, both cursors usable from there.

## Filters

**System view:** actor (autocomplete against `/admin/users` search, debounced 300ms — same pattern as admin-users), date range (from/to), HTTP method (select), path prefix (text), field path (text).

**TM view:** actor (same autocomplete), date range, threat-model ID (free-form text in v1; a picker is deferred), change type (select), object type (select).

Clear-filters action on both views.

## Detail panel

**System entry:** timestamp (UTC, absolute), full actor identity (email, display name, provider, provider ID), HTTP method + full request path, field path, redacted old/new values rendered exactly as returned (redaction is server-side; **no client-side redaction logic**), change summary, copy-permalink, view-in-context.

**TM entry:** same, plus link to the threat model, object type/ID, change type, and a link to the rolled-back-to version where applicable.

## Export

- System view only (matches acceptance criteria; the shared filter bar makes later extension to the TM view trivial).
- Export menu offers CSV and NDJSON. The request hits the list endpoint with all active filters plus `format=`; the server streams the full filtered set.
- Because a plain `<a download>` cannot carry the Authorization header, the download goes through `HttpClient` with `responseType: 'blob'`, then the save-blob pattern from `mermaid-export.utils`. This buffers the export in browser memory — acceptable for filter-narrowed exports. UI copy should encourage narrowing by date range for large sets. A later streaming upgrade (`fetch` + File System Access API) needs no API change.

## Empty & error states

Distinct and localized:

- **No matches:** "no entries match these filters" + clear-filters action.
- **Query failed:** error banner + retry. Errors logged via `LoggerService` with `catchError`.

## Cross-reference affordance

On the admin settings page, each setting row gets a "view in audit log" action button linking to `/admin/audit/system?field_path={key}` — a pre-filtered link, no new machinery.

## i18n

All new user-facing strings added to the master locale and translated across all locale files per project convention.

## Testing

- **Service:** query-param construction (filters, cursor, around, format), response mapping, error propagation.
- **Filter bar:** emission shape, debounce, clear-filters.
- **Table:** cursor state transitions (next/prev/disabled), filter-change reset, anchor highlight.
- **Panel:** route binding (`:entryId` → fetch), cold-permalink render, copy-permalink, view-in-context navigation.
- All against mocked API responses shaped per the contract below (Vitest, existing mock patterns in `src/app/mocks/`).
- E2E deferred until the server ships tmi#398.

## Server contract (proposed, pending tmi#398)

> **Implementing agents:** this contract is *proposed*, not published. Before implementation, re-verify against the server's published OpenAPI spec (`api-schema/tmi-openapi.json` on the server repo) and reconcile any drift.

- `GET /admin/audit/system` — filters `actor_email`, `actor_provider`, `from`, `to`, `http_method`, `path_prefix`, `field_path`; pagination `cursor` (opaque) + `limit`, **or** `around={entry_id}` + `limit`; response `{ items, next_cursor, prev_cursor }`; ordering stable on `(created_at, entry_id)` descending.
- `GET /admin/audit/system/{entry_id}` — single entry.
- `GET /admin/audit/system?format=csv|ndjson&…filters` — streamed export honoring all filters, `Content-Disposition: attachment`. **Required** (promoted from nice-to-have; tmi-ux#679 acceptance criteria depend on it).
- `GET /admin/audit/threat_models` / `GET /admin/audit/threat_models/{entry_id}` — same shape; filters `actor_email`, `actor_provider`, `from`, `to`, `change_type`, `object_type`, `threat_model_id`.
- The optional unified view (`/admin/audit/unified`) is **out of scope** for this UI.

Feedback posted to tmi#398 on 2026-06-11.

## Out of scope

- Modifying the existing per-TM audit trail page.
- Threat-model picker for the TM-ID filter (free-form text in v1).
- Export on the TM view.
- Unified (joined) audit view.
- Client-side redaction of any kind.
