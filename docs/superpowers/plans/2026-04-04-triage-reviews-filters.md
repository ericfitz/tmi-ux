# Triage Reviews Tab Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side filter controls to the triage Reviews tab and fix tab-switch data persistence on both tabs.

**Architecture:** Add filter state, debounced text inputs, and server-side pagination to `ReviewerAssignmentListComponent`, following the dashboard's expandable filter pattern. Add `security_reviewer` to `ThreatModelListParams`. Remove the `matTabContent` lazy-loading directive so neither tab destroys its component on tab switch.

**Tech Stack:** Angular 19, Angular Material (form fields, select, checkbox, datepicker, paginator), Transloco i18n, RxJS (Subject, debounceTime, distinctUntilChanged, takeUntil), Vitest

**Spec:** `docs/superpowers/specs/2026-04-04-triage-reviews-filters-design.md`

**Server dependency:** [ericfitz/tmi#230](https://github.com/ericfitz/tmi/issues/230) — `security_reviewer` query parameter with `is:blank` operator

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/pages/tm/services/threat-model.service.ts` | Modify | Add `security_reviewer` to `ThreatModelListParams` and param-building |
| `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.ts` | Modify | Add filter state, debounced subjects, server-side load, filter methods |
| `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.html` | Modify | Add filter rows, update empty state |
| `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.scss` | Modify | Add filter-row and advanced-filters-row styles |
| `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.spec.ts` | Modify | Update tests for new filter-based loading |
| `src/app/pages/triage/components/triage-list/triage-list.component.html` | Modify | Remove `<ng-template matTabContent>` wrapper |
| `src/assets/i18n/en-US.json` | Modify | Add 4 new i18n keys |

---

### Task 1: Add `security_reviewer` to ThreatModelListParams

**Files:**
- Modify: `src/app/pages/tm/services/threat-model.service.ts:124-138` (interface) and `:197-209` (stringKeys array)

- [ ] **Step 1: Write the failing test**

No dedicated test needed — the param is a passthrough string. We'll validate it works via the component tests in Task 5.

- [ ] **Step 2: Add `security_reviewer` to the interface**

In `src/app/pages/tm/services/threat-model.service.ts`, add `security_reviewer` to `ThreatModelListParams` (after line 130, the `status` field):

```typescript
export interface ThreatModelListParams {
  limit?: number;
  offset?: number;
  name?: string;
  description?: string;
  owner?: string;
  status?: string;
  security_reviewer?: string;
  issue_uri?: string;
  created_after?: string;
  created_before?: string;
  modified_after?: string;
  modified_before?: string;
  status_updated_after?: string;
  status_updated_before?: string;
}
```

- [ ] **Step 3: Add `security_reviewer` to the stringKeys array**

In the `fetchThreatModels` method (around line 197), add `'security_reviewer'` to the `stringKeys` array:

```typescript
const stringKeys: (keyof Omit<ThreatModelListParams, 'limit' | 'offset'>)[] = [
  'name',
  'description',
  'owner',
  'status',
  'security_reviewer',
  'issue_uri',
  'created_after',
  'created_before',
  'modified_after',
  'modified_before',
  'status_updated_after',
  'status_updated_before',
];
```

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: Clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/services/threat-model.service.ts
git commit -m "feat(triage): add security_reviewer to ThreatModelListParams (#553)"
```

---

### Task 2: Add i18n keys

**Files:**
- Modify: `src/assets/i18n/en-US.json:1823-1832` (reviewerAssignment section)

- [ ] **Step 1: Add new keys to the reviewerAssignment section**

In `src/assets/i18n/en-US.json`, find the `triage.reviewerAssignment` object (line 1823) and add four new keys. The updated section should be:

```json
"reviewerAssignment": {
  "assign": "Assign",
  "assignToMe": "Assign to Me",
  "errorLoading": "Failed to load unassigned threat models",
  "loading": "Loading unassigned reviews...",
  "noUnassigned": "No Unassigned Reviews",
  "noUnassignedDescription": "All active threat models have a security reviewer assigned",
  "noUnassignedFiltered": "No threat models match your filters",
  "reviewer": "Security Reviewer",
  "reviewerPlaceholder": "Filter by reviewer...",
  "searchPlaceholder": "Search by name...",
  "selectReviewer": "Select reviewer...",
  "unassigned": "Unassigned"
},
```

Note: keys must be in alphabetical order within the section, consistent with the rest of the file.

- [ ] **Step 2: Verify i18n check passes**

Run: `pnpm run lint:all`
Expected: No i18n-related errors.

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "feat(triage): add i18n keys for reviewer filter controls (#553)"
```

---

### Task 3: Fix tab-switch behavior

**Files:**
- Modify: `src/app/pages/triage/components/triage-list/triage-list.component.html:253-264`

- [ ] **Step 1: Remove the `<ng-template matTabContent>` wrapper**

In `src/app/pages/triage/components/triage-list/triage-list.component.html`, replace the Reviews tab content (lines 253-264):

Current:
```html
<!-- Tab 2: Unassigned Reviews -->
<mat-tab>
  <ng-template mat-tab-label>
    {{ 'triage.tabs.unassignedReviews' | transloco }}
    @if (unassignedCount > 0) {
      <span class="tab-badge">{{ unassignedCount }}</span>
    }
  </ng-template>
  <ng-template matTabContent>
    <app-reviewer-assignment-list (countChange)="unassignedCount = $event" />
  </ng-template>
</mat-tab>
```

New:
```html
<!-- Tab 2: Unassigned Reviews -->
<mat-tab>
  <ng-template mat-tab-label>
    {{ 'triage.tabs.unassignedReviews' | transloco }}
    @if (unassignedCount > 0) {
      <span class="tab-badge">{{ unassignedCount }}</span>
    }
  </ng-template>
  <app-reviewer-assignment-list (countChange)="unassignedCount = $event" />
</mat-tab>
```

The change is removing the `<ng-template matTabContent>` wrapper so `ReviewerAssignmentListComponent` is rendered eagerly and persists across tab switches, matching the Survey Responses tab behavior.

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/triage/components/triage-list/triage-list.component.html
git commit -m "fix(triage): persist reviews tab state across tab switches (#553)"
```

---

### Task 4: Rewrite ReviewerAssignmentListComponent for server-side filtering

**Files:**
- Modify: `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.ts`

This is the core change. We're replacing the client-side fetch-all approach with server-side filtering and pagination, and adding filter state with debounced text inputs.

- [ ] **Step 1: Add imports**

Add these imports at the top of the file (some already exist, add only what's missing):

```typescript
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
```

Remove imports that are no longer needed after removing client-side fetching:
- Remove `EMPTY` and `forkJoin` from `rxjs` imports (no longer used)
- Remove `expand`, `map`, `reduce` from `rxjs/operators` imports (no longer used)

- [ ] **Step 2: Add animation and module imports to @Component decorator**

Add the `animations` property and additional module imports:

```typescript
@Component({
  selector: 'app-reviewer-assignment-list',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...ALL_MATERIAL_IMPORTS,
    TranslocoModule,
    UserDisplayComponent,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './reviewer-assignment-list.component.html',
  styleUrl: './reviewer-assignment-list.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
  animations: [
    trigger('detailExpand', [
      state('void', style({ height: '0', opacity: '0', overflow: 'hidden' })),
      state('*', style({ height: '*', opacity: '1' })),
      transition('void <=> *', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
```

Note: Check whether `MatCheckboxModule`, `MatDatepickerModule`, and `MatNativeDateModule` are already included in `ALL_MATERIAL_IMPORTS`. If they are, don't add them again. Look at `src/app/shared/imports.ts` to verify.

- [ ] **Step 3: Add filter interface and state**

Add the filter interface above the component class:

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

Replace the component's property declarations section. Remove:
- `private unassignedThreatModels: TMListItem[]` (no longer needed — server handles filtering)

Add these new properties:

```typescript
/** Filter state */
filters: ReviewerFilters = {
  searchTerm: '',
  status: 'all',
  unassigned: true,
  securityReviewer: '',
  owner: '',
  createdAfter: null,
  createdBefore: null,
  modifiedAfter: null,
  modifiedBefore: null,
};

/** Status filter options */
filterStatusOptions: { value: string; label: string }[] = [];

/** Advanced filters visibility */
showAdvancedFilters = false;

/** Debounced subjects for text inputs */
private searchChanged$ = new Subject<string>();
private securityReviewerChanged$ = new Subject<string>();
private ownerChanged$ = new Subject<string>();
```

Keep `totalUnassigned` but rename it to `totalItems` for clarity (it now represents filtered total, not just unassigned). Actually, keep it as `totalUnassigned` since that's what the `countChange` output uses and the parent references. The semantics change slightly (filtered count vs pure unassigned count) but the variable name stays.

- [ ] **Step 4: Build status options in ngOnInit**

Add status options initialization in `ngOnInit()`:

```typescript
ngOnInit(): void {
  // Build status filter options
  const statuses = getFieldKeysForFieldType('threatModels.status').filter(s => s !== 'closed');
  this.filterStatusOptions = [
    { value: 'all', label: this.transloco.translate('common.allStatuses') },
    ...statuses.map(s => ({
      value: s,
      label: getFieldLabel(s, 'threatModels.status', this.transloco),
    })),
  ];

  // Set up debounced text filters
  this.setupDebouncedFilter(this.searchChanged$, value => {
    this.filters.searchTerm = value;
  });
  this.setupDebouncedFilter(this.securityReviewerChanged$, value => {
    this.filters.securityReviewer = value;
  });
  this.setupDebouncedFilter(this.ownerChanged$, value => {
    this.filters.owner = value;
  });

  this.loadReviewerOptions();
  this.loadThreatModels();
}
```

- [ ] **Step 5: Add debounce helper**

Add the `setupDebouncedFilter` method (same pattern as dashboard):

```typescript
private setupDebouncedFilter(
  subject: Subject<string>,
  setter: (value: string) => void,
): void {
  subject
    .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
    .subscribe(value => {
      setter(value);
      this.pageIndex = 0;
      this.loadThreatModels();
    });
}
```

- [ ] **Step 6: Replace loadUnassignedThreatModels with server-side loadThreatModels**

Remove `loadUnassignedThreatModels()`, `fetchAllPages()`, `mergeAndDeduplicate()`, and `applyClientPagination()`. Replace with:

```typescript
/**
 * Load threat models with current filters via server-side filtering.
 */
loadThreatModels(): void {
  this.isLoading = true;
  this.error = null;

  const nonClosedStatuses = getFieldKeysForFieldType('threatModels.status')
    .filter(s => s !== 'closed')
    .join(',');

  const params: ThreatModelListParams = {
    limit: this.pageSize,
    offset: this.pageIndex * this.pageSize,
    status: this.filters.status === 'all' ? nonClosedStatuses : this.filters.status,
  };

  // Search by name
  if (this.filters.searchTerm.trim()) {
    params.name = this.filters.searchTerm.trim();
  }

  // Security reviewer filter
  if (this.filters.unassigned) {
    params.security_reviewer = 'is:blank';
  } else if (this.filters.securityReviewer.trim()) {
    params.security_reviewer = this.filters.securityReviewer.trim();
  }

  // Owner filter
  if (this.filters.owner.trim()) {
    params.owner = this.filters.owner.trim();
  }

  // Date range filters
  if (this.filters.createdAfter) params.created_after = this.filters.createdAfter;
  if (this.filters.createdBefore) params.created_before = this.filters.createdBefore;
  if (this.filters.modifiedAfter) params.modified_after = this.filters.modifiedAfter;
  if (this.filters.modifiedBefore) params.modified_before = this.filters.modifiedBefore;

  this.threatModelService
    .fetchThreatModels(params)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: response => {
        this.dataSource.data = response.threat_models;
        this.totalUnassigned = response.total;
        this.countChange.emit(this.totalUnassigned);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: err => {
        this.isLoading = false;
        this.error = this.transloco.translate('triage.reviewerAssignment.errorLoading');
        this.logger.error('Failed to load threat models', err);
        this.cdr.detectChanges();
      },
    });
}
```

- [ ] **Step 7: Add filter change handlers**

```typescript
/** Handle text input changes (debounced) */
onSearchChange(value: string): void {
  this.searchChanged$.next(value);
}

onSecurityReviewerChange(value: string): void {
  this.securityReviewerChanged$.next(value);
}

onOwnerChange(value: string): void {
  this.ownerChanged$.next(value);
}

/** Handle immediate filter changes (dropdowns, checkbox, datepickers) */
onFilterChange(): void {
  this.pageIndex = 0;
  this.loadThreatModels();
}

/** Handle unassigned checkbox change */
onUnassignedChange(checked: boolean): void {
  this.filters.unassigned = checked;
  if (checked) {
    this.filters.securityReviewer = '';
  }
  this.onFilterChange();
}

/** Clear all filters to defaults */
clearFilters(): void {
  this.filters = {
    searchTerm: '',
    status: 'all',
    unassigned: true,
    securityReviewer: '',
    owner: '',
    createdAfter: null,
    createdBefore: null,
    modifiedAfter: null,
    modifiedBefore: null,
  };
  this.showAdvancedFilters = false;
  this.pageIndex = 0;
  this.loadThreatModels();
}

/** Check if any filter differs from defaults */
get hasActiveFilters(): boolean {
  return (
    this.filters.searchTerm !== '' ||
    this.filters.status !== 'all' ||
    !this.filters.unassigned ||
    this.filters.securityReviewer !== '' ||
    this.filters.owner !== '' ||
    this.filters.createdAfter !== null ||
    this.filters.createdBefore !== null ||
    this.filters.modifiedAfter !== null ||
    this.filters.modifiedBefore !== null
  );
}

/** Check if any advanced filter is set (for toggle button highlight) */
get hasAdvancedFilters(): boolean {
  return (
    this.filters.owner !== '' ||
    this.filters.createdAfter !== null ||
    this.filters.createdBefore !== null ||
    this.filters.modifiedAfter !== null ||
    this.filters.modifiedBefore !== null
  );
}
```

- [ ] **Step 8: Update onPageChange to use server-side loading**

Replace the existing `onPageChange`:

```typescript
onPageChange(event: PageEvent): void {
  this.pageIndex = event.pageIndex;
  this.pageSize = event.pageSize;
  this.loadThreatModels();
}
```

- [ ] **Step 9: Update assignReviewer to use loadThreatModels**

In the `assignReviewer` method, replace the client-side removal logic with a server reload. The success handler should become:

```typescript
next: () => {
  this.isAssigning.delete(tmId);
  this.selectedReviewers.delete(tmId);
  // Reload from server to get updated list and count
  this.loadThreatModels();
  this.cdr.detectChanges();
},
```

Remove the manual array manipulation (`this.unassignedThreatModels.filter(...)`, `this.countChange.emit(...)`, page index adjustment, and `applyClientPagination()`).

- [ ] **Step 10: Import ThreatModelListParams**

Add the import for `ThreatModelListParams` at the top:

```typescript
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { ThreatModelListParams } from '../../../tm/services/threat-model.service';
```

Or combine with the existing import:

```typescript
import {
  ThreatModelService,
  ThreatModelListParams,
} from '../../../tm/services/threat-model.service';
```

- [ ] **Step 11: Verify build**

Run: `pnpm run build`
Expected: Clean build. Fix any type errors.

- [ ] **Step 12: Commit**

```bash
git add src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.ts
git commit -m "feat(triage): add server-side filters to reviews tab (#553)"
```

---

### Task 5: Update the component template with filter controls

**Files:**
- Modify: `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.html`

- [ ] **Step 1: Add filter rows before the loading/content block**

Replace the entire template. The new template wraps the existing content with filter rows at the top:

```html
<!-- Primary filters row -->
<div class="filters-row">
  <!-- Search field -->
  <mat-form-field appearance="outline" class="search-field">
    <mat-label>{{ 'common.search' | transloco }}</mat-label>
    <mat-icon matPrefix>search</mat-icon>
    <input
      matInput
      [value]="filters.searchTerm"
      (input)="onSearchChange($any($event.target).value)"
      [placeholder]="'triage.reviewerAssignment.searchPlaceholder' | transloco"
    />
    @if (filters.searchTerm) {
      <button matSuffix mat-icon-button (click)="filters.searchTerm = ''; onFilterChange()">
        <mat-icon>close</mat-icon>
      </button>
    }
  </mat-form-field>

  <!-- Status dropdown -->
  <mat-form-field appearance="outline" class="status-filter">
    <mat-label>{{ 'common.status' | transloco }}</mat-label>
    <mat-select [(ngModel)]="filters.status" (selectionChange)="onFilterChange()">
      @for (option of filterStatusOptions; track option.value) {
        <mat-option [value]="option.value">{{ option.label }}</mat-option>
      }
    </mat-select>
  </mat-form-field>

  <!-- Unassigned checkbox -->
  <mat-checkbox
    [checked]="filters.unassigned"
    (change)="onUnassignedChange($event.checked)"
    class="unassigned-checkbox"
  >
    {{ 'triage.reviewerAssignment.unassigned' | transloco }}
  </mat-checkbox>

  <!-- Security Reviewer text field -->
  <mat-form-field appearance="outline" class="reviewer-filter">
    <mat-label>{{ 'triage.reviewerAssignment.reviewer' | transloco }}</mat-label>
    <input
      matInput
      [value]="filters.securityReviewer"
      [disabled]="filters.unassigned"
      (input)="onSecurityReviewerChange($any($event.target).value)"
      [placeholder]="'triage.reviewerAssignment.reviewerPlaceholder' | transloco"
    />
  </mat-form-field>

  <!-- More Filters toggle -->
  <button
    mat-icon-button
    (click)="showAdvancedFilters = !showAdvancedFilters"
    [matTooltip]="
      showAdvancedFilters
        ? ('dashboard.lessFilters' | transloco)
        : ('dashboard.moreFilters' | transloco)
    "
    [class.filter-toggle-active]="showAdvancedFilters || hasAdvancedFilters"
  >
    <mat-icon>{{ showAdvancedFilters ? 'filter_list_off' : 'filter_list' }}</mat-icon>
  </button>

  <!-- Clear Filters button -->
  @if (hasActiveFilters) {
    <button mat-stroked-button (click)="clearFilters()" class="clear-filters-button">
      <mat-icon>filter_list_off</mat-icon>
      {{ 'triage.filters.clearFilters' | transloco }}
    </button>
  }
</div>

<!-- Advanced filters row (expandable) -->
@if (showAdvancedFilters) {
  <div class="advanced-filters-row" [@detailExpand]>
    <!-- Owner filter -->
    <mat-form-field appearance="outline" class="text-filter">
      <mat-label>{{ 'dashboard.ownerFilter' | transloco }}</mat-label>
      <input
        matInput
        [value]="filters.owner"
        (input)="onOwnerChange($any($event.target).value)"
        [placeholder]="'dashboard.ownerPlaceholder' | transloco"
      />
    </mat-form-field>

    <!-- Created After -->
    <mat-form-field appearance="outline" class="date-filter">
      <mat-label>{{ 'dashboard.createdAfter' | transloco }}</mat-label>
      <input
        matInput
        [matDatepicker]="createdAfterPicker"
        [value]="filters.createdAfter"
        (dateChange)="
          filters.createdAfter = $event.value?.toISOString() ?? null; onFilterChange()
        "
      />
      <mat-datepicker-toggle matSuffix [for]="createdAfterPicker"></mat-datepicker-toggle>
      <mat-datepicker #createdAfterPicker></mat-datepicker>
    </mat-form-field>

    <!-- Created Before -->
    <mat-form-field appearance="outline" class="date-filter">
      <mat-label>{{ 'dashboard.createdBefore' | transloco }}</mat-label>
      <input
        matInput
        [matDatepicker]="createdBeforePicker"
        [value]="filters.createdBefore"
        (dateChange)="
          filters.createdBefore = $event.value?.toISOString() ?? null; onFilterChange()
        "
      />
      <mat-datepicker-toggle matSuffix [for]="createdBeforePicker"></mat-datepicker-toggle>
      <mat-datepicker #createdBeforePicker></mat-datepicker>
    </mat-form-field>

    <!-- Modified After -->
    <mat-form-field appearance="outline" class="date-filter">
      <mat-label>{{ 'dashboard.modifiedAfter' | transloco }}</mat-label>
      <input
        matInput
        [matDatepicker]="modifiedAfterPicker"
        [value]="filters.modifiedAfter"
        (dateChange)="
          filters.modifiedAfter = $event.value?.toISOString() ?? null; onFilterChange()
        "
      />
      <mat-datepicker-toggle matSuffix [for]="modifiedAfterPicker"></mat-datepicker-toggle>
      <mat-datepicker #modifiedAfterPicker></mat-datepicker>
    </mat-form-field>

    <!-- Modified Before -->
    <mat-form-field appearance="outline" class="date-filter">
      <mat-label>{{ 'dashboard.modifiedBefore' | transloco }}</mat-label>
      <input
        matInput
        [matDatepicker]="modifiedBeforePicker"
        [value]="filters.modifiedBefore"
        (dateChange)="
          filters.modifiedBefore = $event.value?.toISOString() ?? null; onFilterChange()
        "
      />
      <mat-datepicker-toggle matSuffix [for]="modifiedBeforePicker"></mat-datepicker-toggle>
      <mat-datepicker #modifiedBeforePicker></mat-datepicker>
    </mat-form-field>
  </div>
}

<!-- Content area -->
@if (isLoading && dataSource.data.length === 0) {
  <div class="loading-container">
    <mat-spinner diameter="48"></mat-spinner>
    <p>{{ 'triage.reviewerAssignment.loading' | transloco }}</p>
  </div>
} @else if (error) {
  <div class="error-container">
    <mat-icon>error_outline</mat-icon>
    <h2>{{ 'common.error' | transloco }}</h2>
    <p>{{ error }}</p>
    <button mat-raised-button color="primary" (click)="loadThreatModels()">
      {{ 'common.retry' | transloco }}
    </button>
  </div>
} @else if (totalUnassigned === 0) {
  <div class="empty-state">
    <mat-icon>assignment_turned_in</mat-icon>
    @if (hasActiveFilters) {
      <h2>{{ 'triage.reviewerAssignment.noUnassignedFiltered' | transloco }}</h2>
      <button mat-raised-button color="primary" (click)="clearFilters()">
        {{ 'triage.filters.clearFilters' | transloco }}
      </button>
    } @else {
      <h2>{{ 'triage.reviewerAssignment.noUnassigned' | transloco }}</h2>
      <p>{{ 'triage.reviewerAssignment.noUnassignedDescription' | transloco }}</p>
    }
  </div>
} @else {
  <div class="assignment-table-container">
    <table mat-table [dataSource]="dataSource" matSort class="assignment-table">
      <!-- Name Column -->
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>
          {{ 'common.name' | transloco }}
        </th>
        <td mat-cell *matCellDef="let row">
          <span class="tm-name">{{ row.name }}</span>
        </td>
      </ng-container>

      <!-- Owner Column -->
      <ng-container matColumnDef="owner">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>
          {{ 'common.owner' | transloco }}
        </th>
        <td mat-cell *matCellDef="let row">
          <app-user-display [user]="row.owner" />
        </td>
      </ng-container>

      <!-- Status Column -->
      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>
          {{ 'common.status' | transloco }}
        </th>
        <td mat-cell *matCellDef="let row">
          @if (row.status) {
            <mat-chip [ngClass]="getStatusClass(row.status)">
              {{ getStatusLabel(row.status) }}
            </mat-chip>
          }
        </td>
      </ng-container>

      <!-- Created Date Column -->
      <ng-container matColumnDef="created_at">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>
          {{ 'common.created' | transloco }}
        </th>
        <td mat-cell *matCellDef="let row">
          {{ row.created_at | date: 'mediumDate' }}
        </td>
      </ng-container>

      <!-- Reviewer Selection Column -->
      <ng-container matColumnDef="reviewer_select">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'triage.reviewerAssignment.reviewer' | transloco }}
        </th>
        <td mat-cell *matCellDef="let row">
          @if (reviewerMode === 'loading') {
            <mat-spinner diameter="20"></mat-spinner>
          } @else if (reviewerMode === 'dropdown') {
            <mat-select
              [value]="selectedReviewers.get(row.id) ?? null"
              (selectionChange)="onReviewerSelected(row.id, $event.value)"
              [compareWith]="compareReviewers"
              [placeholder]="'triage.reviewerAssignment.selectReviewer' | transloco"
              class="reviewer-select"
            >
              <mat-option [value]="null">&mdash;</mat-option>
              @for (reviewer of reviewerOptions; track reviewer.provider_id) {
                <mat-option [value]="reviewer">
                  {{ reviewer.display_name || reviewer.email }}
                </mat-option>
              }
            </mat-select>
          } @else {
            <div class="picker-cell">
              @if (getSelectedReviewerDisplay(row.id); as displayName) {
                <span class="selected-reviewer">{{ displayName }}</span>
              }
              <button
                mat-icon-button
                (click)="openReviewerPicker(row.id); $event.stopPropagation()"
                [matTooltip]="'triage.reviewerAssignment.selectReviewer' | transloco"
              >
                <mat-icon>person_search</mat-icon>
              </button>
            </div>
          }
        </td>
      </ng-container>

      <!-- Actions Column -->
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef>{{ 'common.actions' | transloco }}</th>
        <td mat-cell *matCellDef="let row">
          <div class="row-actions">
            @if (selectedReviewers.get(row.id)) {
              <button
                mat-raised-button
                color="primary"
                [disabled]="isAssigning.has(row.id)"
                (click)="
                  assignReviewer(row.id, selectedReviewers.get(row.id)!); $event.stopPropagation()
                "
              >
                @if (isAssigning.has(row.id)) {
                  <mat-spinner diameter="16"></mat-spinner>
                } @else {
                  {{ 'triage.reviewerAssignment.assign' | transloco }}
                }
              </button>
            } @else {
              <button
                mat-raised-button
                [disabled]="isAssigning.has(row.id)"
                (click)="assignToMe(row.id); $event.stopPropagation()"
              >
                @if (isAssigning.has(row.id)) {
                  <mat-spinner diameter="16"></mat-spinner>
                } @else {
                  {{ 'triage.reviewerAssignment.assignToMe' | transloco }}
                }
              </button>
            }
            <button
              mat-icon-button
              (click)="viewThreatModel(row); $event.stopPropagation()"
              [matTooltip]="'triage.viewDetails' | transloco"
            >
              <mat-icon>open_in_new</mat-icon>
            </button>
          </div>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr
        mat-row
        *matRowDef="let row; columns: displayedColumns"
        class="tm-row"
        (click)="viewThreatModel(row)"
      ></tr>
    </table>

    <mat-paginator
      [length]="totalUnassigned"
      [pageSize]="pageSize"
      [pageIndex]="pageIndex"
      [pageSizeOptions]="[10, 25, 50, 100]"
      (page)="onPageChange($event)"
      showFirstLastButtons
    >
    </mat-paginator>
  </div>

  @if (isLoading) {
    <div class="loading-overlay">
      <mat-spinner diameter="32"></mat-spinner>
    </div>
  }
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.html
git commit -m "feat(triage): add filter controls to reviews tab template (#553)"
```

---

### Task 6: Add filter styles

**Files:**
- Modify: `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.scss`

- [ ] **Step 1: Add filter row styles**

Add these styles before the `.assignment-table-container` rule (after line 28):

```scss
.filters-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  margin-top: 16px;
  align-items: center;
  flex-wrap: wrap;

  .search-field {
    flex: 1;
    min-width: 200px;
  }

  .status-filter {
    width: 200px;
  }

  .unassigned-checkbox {
    white-space: nowrap;
  }

  .reviewer-filter {
    width: 200px;
  }

  .filter-toggle-active {
    color: var(--mdc-theme-primary);
  }

  .clear-filters-button {
    white-space: nowrap;
  }

  mat-form-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
    display: none;
  }
}

.advanced-filters-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;

  .text-filter {
    width: 200px;
  }

  .date-filter {
    min-width: 200px;
  }

  mat-form-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
    display: none;
  }
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.scss
git commit -m "feat(triage): add filter row styles for reviews tab (#553)"
```

---

### Task 7: Update unit tests

**Files:**
- Modify: `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.spec.ts`

The tests need significant updates because the loading mechanism changed from client-side fetch-all to server-side filtered single calls.

- [ ] **Step 1: Update mock setup and helpers**

The `makeApiResponse` helper stays the same. Update `beforeEach` — no changes needed to mock construction since `fetchThreatModels` is still called, just with different params.

- [ ] **Step 2: Replace the `loadUnassignedThreatModels()` test group**

Remove the entire `describe('loadUnassignedThreatModels()')` block and replace with:

```typescript
describe('loadThreatModels()', () => {
  beforeEach(() => {
    mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
      of({ mode: 'picker' } as SecurityReviewerResult),
    );
  });

  it('should send security_reviewer=is:blank by default (unassigned=true)', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));

    component.ngOnInit();

    expect(mockThreatModelService.fetchThreatModels).toHaveBeenCalledWith(
      expect.objectContaining({
        security_reviewer: 'is:blank',
        limit: 25,
        offset: 0,
      }),
    );
  });

  it('should send status filter as comma-separated non-closed statuses when status is all', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));

    component.ngOnInit();

    const call = mockThreatModelService.fetchThreatModels.mock.calls[0][0];
    expect(call.status).toContain('not_started');
    expect(call.status).toContain('in_progress');
    expect(call.status).not.toContain('closed');
  });

  it('should send single status value when a specific status is selected', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));

    component.ngOnInit();
    component.filters.status = 'in_progress';
    component.loadThreatModels();

    const lastCall =
      mockThreatModelService.fetchThreatModels.mock.calls[
        mockThreatModelService.fetchThreatModels.mock.calls.length - 1
      ][0];
    expect(lastCall.status).toBe('in_progress');
  });

  it('should send name param when searchTerm is set', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));

    component.ngOnInit();
    component.filters.searchTerm = 'Payment';
    component.loadThreatModels();

    const lastCall =
      mockThreatModelService.fetchThreatModels.mock.calls[
        mockThreatModelService.fetchThreatModels.mock.calls.length - 1
      ][0];
    expect(lastCall.name).toBe('Payment');
  });

  it('should send owner param when owner filter is set', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));

    component.ngOnInit();
    component.filters.owner = 'alice';
    component.loadThreatModels();

    const lastCall =
      mockThreatModelService.fetchThreatModels.mock.calls[
        mockThreatModelService.fetchThreatModels.mock.calls.length - 1
      ][0];
    expect(lastCall.owner).toBe('alice');
  });

  it('should send security_reviewer text when unassigned is false', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));

    component.ngOnInit();
    component.filters.unassigned = false;
    component.filters.securityReviewer = 'bob@example.com';
    component.loadThreatModels();

    const lastCall =
      mockThreatModelService.fetchThreatModels.mock.calls[
        mockThreatModelService.fetchThreatModels.mock.calls.length - 1
      ][0];
    expect(lastCall.security_reviewer).toBe('bob@example.com');
  });

  it('should not send security_reviewer when unassigned is false and field is empty', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));

    component.ngOnInit();
    component.filters.unassigned = false;
    component.filters.securityReviewer = '';
    component.loadThreatModels();

    const lastCall =
      mockThreatModelService.fetchThreatModels.mock.calls[
        mockThreatModelService.fetchThreatModels.mock.calls.length - 1
      ][0];
    expect(lastCall.security_reviewer).toBeUndefined();
  });

  it('should send date range params when set', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));

    component.ngOnInit();
    component.filters.createdAfter = '2026-01-01T00:00:00Z';
    component.filters.modifiedBefore = '2026-03-01T00:00:00Z';
    component.loadThreatModels();

    const lastCall =
      mockThreatModelService.fetchThreatModels.mock.calls[
        mockThreatModelService.fetchThreatModels.mock.calls.length - 1
      ][0];
    expect(lastCall.created_after).toBe('2026-01-01T00:00:00Z');
    expect(lastCall.modified_before).toBe('2026-03-01T00:00:00Z');
  });

  it('should use server-side pagination params', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(
      of(makeApiResponse([], 100)),
    );

    component.ngOnInit();
    component.onPageChange({ pageIndex: 2, pageSize: 25, length: 100, previousPageIndex: 1 });

    const lastCall =
      mockThreatModelService.fetchThreatModels.mock.calls[
        mockThreatModelService.fetchThreatModels.mock.calls.length - 1
      ][0];
    expect(lastCall.offset).toBe(50);
    expect(lastCall.limit).toBe(25);
  });

  it('should set totalUnassigned from API response total', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(
      of(makeApiResponse([makeTMListItem()], 42)),
    );

    component.ngOnInit();

    expect(component.totalUnassigned).toBe(42);
  });

  it('should handle API errors', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(
      throwError(() => new Error('API error')),
    );

    component.ngOnInit();

    expect(component.isLoading).toBe(false);
    expect(component.error).toBe('triage.reviewerAssignment.errorLoading');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should emit count via countChange', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(
      of(makeApiResponse([makeTMListItem()], 7)),
    );
    const emitSpy = vi.spyOn(component.countChange, 'emit');

    component.ngOnInit();

    expect(emitSpy).toHaveBeenCalledWith(7);
  });
});
```

- [ ] **Step 3: Add filter state tests**

Add a new describe block:

```typescript
describe('Filter state', () => {
  it('hasActiveFilters should be false with defaults', () => {
    expect(component.hasActiveFilters).toBe(false);
  });

  it('hasActiveFilters should be true when searchTerm is set', () => {
    component.filters.searchTerm = 'test';
    expect(component.hasActiveFilters).toBe(true);
  });

  it('hasActiveFilters should be true when unassigned is false', () => {
    component.filters.unassigned = false;
    expect(component.hasActiveFilters).toBe(true);
  });

  it('hasActiveFilters should be true when status is not all', () => {
    component.filters.status = 'in_progress';
    expect(component.hasActiveFilters).toBe(true);
  });

  it('hasAdvancedFilters should be false with defaults', () => {
    expect(component.hasAdvancedFilters).toBe(false);
  });

  it('hasAdvancedFilters should be true when owner is set', () => {
    component.filters.owner = 'alice';
    expect(component.hasAdvancedFilters).toBe(true);
  });

  it('hasAdvancedFilters should be true when a date filter is set', () => {
    component.filters.createdAfter = '2026-01-01T00:00:00Z';
    expect(component.hasAdvancedFilters).toBe(true);
  });

  it('clearFilters should reset all filters to defaults', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));
    mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
      of({ mode: 'picker' } as SecurityReviewerResult),
    );
    component.ngOnInit();

    component.filters.searchTerm = 'test';
    component.filters.status = 'in_progress';
    component.filters.unassigned = false;
    component.filters.owner = 'alice';
    component.showAdvancedFilters = true;

    component.clearFilters();

    expect(component.filters.searchTerm).toBe('');
    expect(component.filters.status).toBe('all');
    expect(component.filters.unassigned).toBe(true);
    expect(component.filters.owner).toBe('');
    expect(component.showAdvancedFilters).toBe(false);
    expect(component.pageIndex).toBe(0);
  });

  it('onUnassignedChange should clear securityReviewer when checked', () => {
    mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));
    mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
      of({ mode: 'picker' } as SecurityReviewerResult),
    );
    component.ngOnInit();

    component.filters.securityReviewer = 'bob@example.com';
    component.onUnassignedChange(true);

    expect(component.filters.unassigned).toBe(true);
    expect(component.filters.securityReviewer).toBe('');
  });
});
```

- [ ] **Step 4: Update the Client-side pagination tests**

Remove the `describe('Client-side pagination')` block entirely — pagination is now server-side and tested in the `loadThreatModels()` group.

- [ ] **Step 5: Update the assignReviewer tests**

Update the success test in `describe('assignReviewer()')` to verify it calls `loadThreatModels` (via `fetchThreatModels`) again after assignment:

```typescript
it('should patch threat model and reload list on success', () => {
  const tm = makeTMListItem({ id: 'tm-assign' });
  mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([tm])));
  mockThreatModelService.patchThreatModel.mockReturnValue(of({}));

  component.ngOnInit();
  const callCountAfterInit = mockThreatModelService.fetchThreatModels.mock.calls.length;

  component.assignReviewer('tm-assign', mockReviewer);

  expect(mockThreatModelService.patchThreatModel).toHaveBeenCalledWith('tm-assign', {
    security_reviewer: mockReviewer,
  });
  // Should have called fetchThreatModels again to reload
  expect(mockThreatModelService.fetchThreatModels.mock.calls.length).toBeGreaterThan(
    callCountAfterInit,
  );
  expect(component.selectedReviewers.has('tm-assign')).toBe(false);
});
```

Update the error test — the error handler no longer manipulates `totalUnassigned` directly, so just verify the error is logged and assigning state is cleared:

```typescript
it('should handle assignment errors', () => {
  const tm = makeTMListItem({ id: 'tm-error' });
  mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([tm])));
  mockThreatModelService.patchThreatModel.mockReturnValue(
    throwError(() => new Error('PATCH failed')),
  );

  component.ngOnInit();
  component.assignReviewer('tm-error', mockReviewer);

  expect(component.isAssigning.has('tm-error')).toBe(false);
  expect(mockLogger.error).toHaveBeenCalledWith('Failed to assign reviewer', expect.any(Error));
});
```

- [ ] **Step 6: Update the Initialization tests**

Update the default values test:

```typescript
it('should have default values', () => {
  expect(component.reviewerMode).toBe('loading');
  expect(component.totalUnassigned).toBe(0);
  expect(component.isLoading).toBe(false);
  expect(component.error).toBeNull();
  expect(component.filters.unassigned).toBe(true);
  expect(component.filters.status).toBe('all');
  expect(component.showAdvancedFilters).toBe(false);
});
```

- [ ] **Step 7: Run tests**

Run: `pnpm run test src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.spec.ts`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.spec.ts
git commit -m "test(triage): update reviewer assignment tests for server-side filtering (#553)"
```

---

### Task 8: Final verification

- [ ] **Step 1: Lint**

Run: `pnpm run lint:all`
Expected: No errors. Fix any that appear.

- [ ] **Step 2: Build**

Run: `pnpm run build`
Expected: Clean build.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 4: Final commit (if any lint/build fixes were needed)**

```bash
git add -A
git commit -m "fix(triage): lint and build fixes for reviews tab filters (#553)"
```

- [ ] **Step 5: Comment on the issue**

```bash
gh issue comment 553 --repo ericfitz/tmi-ux --body "Implementation committed on dev/1.4.0. Server-side filtering with search, status, unassigned checkbox, security reviewer, owner, and date range filters. Tab-switch state persistence fixed for both tabs."
```

- [ ] **Step 6: Close the issue**

```bash
gh issue close 553 --repo ericfitz/tmi-ux --reason completed
```
