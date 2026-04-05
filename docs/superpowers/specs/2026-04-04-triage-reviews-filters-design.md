# Triage Reviews Tab Filters

**Issue:** [#553](https://github.com/ericfitz/tmi-ux/issues/553) — feat: add filter fields to triage page threat models tab
**Server dependency:** [ericfitz/tmi#230](https://github.com/ericfitz/tmi/issues/230) — `security_reviewer` query parameter with `is:blank` operator

## Overview

Add filter controls to the Reviews tab (`ReviewerAssignmentListComponent`) on the triage page, following the dashboard's expandable filter pattern. Replace the current client-side fetch-all-and-filter approach with server-side filtering and pagination. Also fix tab-switch behavior so neither tab reloads data or resets filters when the user switches between tabs.

## Scope

Two changes in one issue:

1. **Add filters to Reviews tab** — search, status, unassigned checkbox, security reviewer, owner, created date range, modified date range
2. **Fix tab-switch behavior** — remove lazy content directive so the Reviews tab component persists across tab switches

## Filter Design

### Filter Interface

```typescript
interface ReviewerFilters {
  searchTerm: string;
  status: string | 'all';
  unassigned: boolean;
  securityReviewer: string;
  owner: string;
  createdAfter: string | null;
  createdBefore: string | null;
  modifiedAfter: string | null;
  modifiedBefore: string | null;
}
```

### Default State

| Field | Default |
|-------|---------|
| searchTerm | `''` |
| status | `'all'` (all non-closed) |
| unassigned | `true` |
| securityReviewer | `''` |
| owner | `''` |
| createdAfter | `null` |
| createdBefore | `null` |
| modifiedAfter | `null` |
| modifiedBefore | `null` |

### Layout

**Primary filters row** (always visible):

1. **Search** — `mat-form-field` text input with search icon prefix and clear button. Maps to API `name` param (partial match).
2. **Status** — `mat-form-field` with `mat-select`, single-select. Options: "All Statuses" (sends all non-closed as comma-separated), plus each individual non-closed status from `getFieldKeysForFieldType('threatModels.status')`. Uses `getFieldLabel()` for translated labels.
3. **Unassigned** — `mat-checkbox`, checked by default. When checked: sends `security_reviewer=is:blank` and disables the Security Reviewer text field. When unchecked: enables the Security Reviewer field and sends its value instead.
4. **Security Reviewer** — `mat-form-field` text input, partial match. Disabled when Unassigned is checked. Maps to API `security_reviewer` param.
5. **More Filters** toggle — `mat-icon-button` with `filter_list` / `filter_list_off` icon, same pattern as dashboard.
6. **Clear Filters** — `mat-stroked-button`, conditionally shown when `hasActiveFilters` is true.

**Advanced filters row** (expandable, toggled by More Filters button):

1. **Owner** — `mat-form-field` text input, partial match. Maps to API `owner` param.
2. **Created After** — `mat-datepicker`. Maps to API `created_after` param (ISO 8601).
3. **Created Before** — `mat-datepicker`. Maps to API `created_before` param (ISO 8601).
4. **Modified After** — `mat-datepicker`. Maps to API `modified_after` param (ISO 8601).
5. **Modified Before** — `mat-datepicker`. Maps to API `modified_before` param (ISO 8601).

### Unassigned / Security Reviewer Interaction

- When `unassigned` is `true` (default): the Security Reviewer text field is cleared and disabled. The API call includes `security_reviewer=is:blank`.
- When `unassigned` is `false`: the Security Reviewer text field is enabled. If the user types a value, it is sent as `security_reviewer=<value>`. If the field is empty, no `security_reviewer` param is sent.
- Toggling the Unassigned checkbox triggers `onFilterChange()`.

### hasActiveFilters

Returns `true` when any filter differs from its default value. Since `unassigned: true` is the default, unchecking it counts as an active filter.

### Text Input Debounce

Text inputs (search, security reviewer, owner) use debounced change handlers matching the dashboard pattern — filter changes fire after the user stops typing, not on every keystroke.

### Clear Filters

Resets all filters to defaults (including `unassigned: true`), resets pagination to page 0, and reloads.

## Server-Side Filtering and Pagination

### Current Approach (being replaced)

The Reviews tab currently:
1. Fetches all non-closed threat models via paginated `expand()` calls (`fetchAllPages`)
2. Also fetches all unfiltered to catch null-status items
3. Deduplicates via `mergeAndDeduplicate()`
4. Filters client-side for `security_reviewer === null`
5. Paginates client-side via `applyClientPagination()`

### New Approach

Single `fetchThreatModels()` call per load with server-side filters and server-side pagination. The `expand()` / `fetchAllPages()` / `mergeAndDeduplicate()` / `applyClientPagination()` methods are removed.

### API Parameter Mapping

| Filter | Condition | API param | Value |
|--------|-----------|-----------|-------|
| Search | non-empty | `name` | trimmed string |
| Status | `'all'` | `status` | all non-closed, comma-separated |
| Status | specific value | `status` | single value |
| Unassigned | `true` | `security_reviewer` | `is:blank` |
| Security Reviewer | non-empty, unassigned=false | `security_reviewer` | trimmed string |
| Owner | non-empty | `owner` | trimmed string |
| Created After | non-null | `created_after` | ISO 8601 string |
| Created Before | non-null | `created_before` | ISO 8601 string |
| Modified After | non-null | `modified_after` | ISO 8601 string |
| Modified Before | non-null | `modified_before` | ISO 8601 string |
| (always) | — | `limit` | page size |
| (always) | — | `offset` | pageIndex * pageSize |

### Tab Badge (`countChange`)

The `countChange` output emits the `total` from the API response. This means the badge reflects the filtered count, consistent with how the Survey Responses tab badge works.

### ThreatModelListParams Change

Add `security_reviewer?: string` to the `ThreatModelListParams` interface in `threat-model.service.ts` and include it in the parameter-building logic within `fetchThreatModels()`.

## Tab-Switch Behavior Fix

**Problem:** The Reviews tab wraps its content in `<ng-template matTabContent>`, which lazy-loads and destroys `ReviewerAssignmentListComponent` on every tab switch, causing full reload and filter reset.

**Fix:** Remove the `<ng-template matTabContent>` wrapper in `triage-list.component.html`. Render `<app-reviewer-assignment-list>` directly inside the `<mat-tab>`, matching how the Survey Responses tab renders its content.

Both tabs will then:
- Load data once on init
- Retain component instance, filter state, and loaded data across tab switches
- Only reload when the user explicitly changes a filter or page

## i18n

### Reuse Existing Keys

| Key | Value |
|-----|-------|
| `common.search` | "Search" |
| `common.status` | "Status" |
| `common.allStatuses` | "All Statuses" |
| `dashboard.ownerFilter` | references `common.roles.owner` |
| `dashboard.ownerPlaceholder` | "Filter by owner name or email" |
| `dashboard.createdAfter` | "Created After" |
| `dashboard.createdBefore` | "Created Before" |
| `dashboard.modifiedAfter` | "Modified After" |
| `dashboard.modifiedBefore` | "Modified Before" |
| `dashboard.moreFilters` | "More Filters" |
| `dashboard.lessFilters` | "Fewer Filters" |
| `triage.filters.clearFilters` | references `auditTrail.filters.clear` → "Clear Filters" |
| `triage.reviewerAssignment.reviewer` | "Security Reviewer" |

### New Keys

| Key | Value |
|-----|-------|
| `triage.reviewerAssignment.searchPlaceholder` | "Search by name..." |
| `triage.reviewerAssignment.unassigned` | "Unassigned" |
| `triage.reviewerAssignment.reviewerPlaceholder` | "Filter by reviewer..." |
| `triage.reviewerAssignment.noUnassignedFiltered` | "No threat models match your filters" |

## Files Modified

| File | Change |
|------|--------|
| `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.ts` | Add filter interface, state, filter methods; replace fetch-all with single server-side filtered call; remove `fetchAllPages`, `mergeAndDeduplicate`, `applyClientPagination`; add `hasActiveFilters`, `clearFilters`, `onFilterChange`; add `showAdvancedFilters` toggle |
| `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.html` | Add primary filters row and expandable advanced filters row above table; update empty state to distinguish filtered vs unfiltered |
| `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.scss` | Add `.filters-row` and `.advanced-filters-row` styles matching dashboard pattern |
| `src/app/pages/triage/components/triage-list/triage-list.component.html` | Remove `<ng-template matTabContent>` wrapper from Reviews tab |
| `src/app/pages/tm/services/threat-model.service.ts` | Add `security_reviewer` to `ThreatModelListParams`; add to param building in `fetchThreatModels()` |
| `src/assets/i18n/en-US.json` | Add 4 new i18n keys under `triage.reviewerAssignment` |

## Testing

- Unit tests for the new filter logic in `reviewer-assignment-list.component.spec.ts`
- Verify `hasActiveFilters` correctly detects non-default state
- Verify `clearFilters` resets to defaults
- Verify Unassigned checkbox enables/disables the Security Reviewer field
- Verify API params are constructed correctly for each filter combination
- Verify tab switching preserves filter state and data on both tabs
- Verify pagination works with server-side total
