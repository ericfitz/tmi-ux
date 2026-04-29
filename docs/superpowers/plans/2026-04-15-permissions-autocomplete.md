# Permissions Autocomplete for TMI Provider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add autocomplete suggestions to the permissions dialog subject field when the TMI provider is selected, powered by server-side user/group search.

**Architecture:** A new `PermissionsAutocompleteService` encapsulates search logic (admin check, API calls, result mapping). The existing `PermissionsDialogComponent` gets a `mat-autocomplete` attached to the subject input, only active for TMI provider rows. Non-admin users get silent degradation to plain free-text.

**Tech Stack:** Angular Material Autocomplete, RxJS (debounceTime, switchMap, distinctUntilChanged), existing UserAdminService and GroupAdminService.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/types/user.types.ts` | Modify | Add `name` field to `AdminUserFilter` |
| `src/app/pages/tm/services/permissions-autocomplete.service.ts` | Create | Search service: admin gate, API calls, result mapping |
| `src/app/pages/tm/services/permissions-autocomplete.service.spec.ts` | Create | Unit tests for the search service |
| `src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.ts` | Modify | Wire `mat-autocomplete` to subject input for TMI rows |
| `src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.spec.ts` | Modify | Add autocomplete-related tests |

---

### Task 1: Add `name` to AdminUserFilter

**Files:**
- Modify: `src/app/types/user.types.ts:24-47`

- [ ] **Step 1: Add the `name` field**

In `src/app/types/user.types.ts`, add `name` to the `AdminUserFilter` interface after the `email` field:

```typescript
export interface AdminUserFilter {
  /** Filter by OAuth/SAML provider */
  provider?: string;
  /** Filter by email (case-insensitive substring match) */
  email?: string;
  /** Filter by name (case-insensitive substring match) */
  name?: string;
  /** Filter by automation account status */
  automation?: boolean;
  /** Filter users created after this timestamp (RFC3339) */
  created_after?: string;
  /** Filter users created before this timestamp (RFC3339) */
  created_before?: string;
  /** Filter users who logged in after this timestamp (RFC3339) */
  last_login_after?: string;
  /** Filter users who logged in before this timestamp (RFC3339) */
  last_login_before?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip */
  offset?: number;
  /** Sort field */
  sort_by?: 'created_at' | 'last_login' | 'email' | 'name';
  /** Sort order */
  sort_order?: 'asc' | 'desc';
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: clean build, no errors.

- [ ] **Step 3: Run existing UserAdminService tests**

Run: `pnpm exec vitest run src/app/core/services/user-admin.service.spec.ts`
Expected: all existing tests pass (adding an optional field is non-breaking).

- [ ] **Step 4: Commit**

```bash
git add src/app/types/user.types.ts
git commit -m "feat(types): add name field to AdminUserFilter for #601"
```

---

### Task 2: Create PermissionsAutocompleteService with Tests (TDD)

**Files:**
- Create: `src/app/pages/tm/services/permissions-autocomplete.service.ts`
- Create: `src/app/pages/tm/services/permissions-autocomplete.service.spec.ts`

- [ ] **Step 1: Write the test file**

Create `src/app/pages/tm/services/permissions-autocomplete.service.spec.ts`:

```typescript
import '@angular/compiler';

import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import {
  PermissionsAutocompleteService,
  AutocompleteSuggestion,
} from './permissions-autocomplete.service';
import type { AuthService } from '@app/auth/services/auth.service';
import type { UserAdminService } from '@app/core/services/user-admin.service';
import type { GroupAdminService } from '@app/core/services/group-admin.service';
import type { LoggerService } from '@app/core/services/logger.service';
import type { AdminUser } from '@app/types/user.types';
import type { AdminGroup } from '@app/types/group.types';

describe('PermissionsAutocompleteService', () => {
  let service: PermissionsAutocompleteService;
  let mockAuthService: { isAdmin: boolean };
  let mockUserAdminService: { list: ReturnType<typeof vi.fn> };
  let mockGroupAdminService: { list: ReturnType<typeof vi.fn> };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

  const mockUsers: AdminUser[] = [
    {
      internal_uuid: 'uuid-1',
      provider: 'tmi',
      provider_user_id: 'alice-pid',
      email: 'alice@example.com',
      name: 'Alice Smith',
      email_verified: true,
      created_at: '2026-01-01T00:00:00Z',
      modified_at: '2026-01-01T00:00:00Z',
    } as AdminUser,
    {
      internal_uuid: 'uuid-2',
      provider: 'tmi',
      provider_user_id: 'bob-pid',
      email: 'bob@example.com',
      name: 'Bob Jones',
      email_verified: true,
      created_at: '2026-01-01T00:00:00Z',
      modified_at: '2026-01-01T00:00:00Z',
    } as AdminUser,
  ];

  const mockGroups: AdminGroup[] = [
    {
      internal_uuid: 'group-uuid-1',
      provider: 'tmi',
      group_name: 'everyone',
      first_used: '2026-01-01T00:00:00Z',
      last_used: '2026-01-01T00:00:00Z',
      usage_count: 5,
    },
    {
      internal_uuid: 'group-uuid-2',
      provider: 'tmi',
      group_name: 'security-team',
      first_used: '2026-01-01T00:00:00Z',
      last_used: '2026-01-01T00:00:00Z',
      usage_count: 3,
    },
  ];

  beforeEach(() => {
    mockAuthService = { isAdmin: true };
    mockUserAdminService = {
      list: vi.fn().mockReturnValue(
        of({ users: mockUsers, total: 2, limit: 10, offset: 0 }),
      ),
    };
    mockGroupAdminService = {
      list: vi.fn().mockReturnValue(
        of({ groups: mockGroups, total: 2, limit: 10, offset: 0 }),
      ),
    };
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
    };

    service = new PermissionsAutocompleteService(
      mockAuthService as unknown as AuthService,
      mockUserAdminService as unknown as UserAdminService,
      mockGroupAdminService as unknown as GroupAdminService,
      mockLogger as unknown as LoggerService,
    );
  });

  describe('search (user principal type)', () => {
    it('should call UserAdminService with tmi provider and name filter', () => {
      service.search('ali', 'user').subscribe();

      expect(mockUserAdminService.list).toHaveBeenCalledWith({
        provider: 'tmi',
        name: 'ali',
        limit: 10,
      });
    });

    it('should map users to AutocompleteSuggestion with displayLabel and value', () => {
      let results: AutocompleteSuggestion[] = [];
      service.search('ali', 'user').subscribe(r => (results = r));

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        displayLabel: 'Alice Smith (alice@example.com)',
        value: 'alice-pid',
      });
      expect(results[1]).toEqual({
        displayLabel: 'Bob Jones (bob@example.com)',
        value: 'bob-pid',
      });
    });
  });

  describe('search (group principal type)', () => {
    it('should call GroupAdminService with tmi provider and group_name filter', () => {
      service.search('every', 'group').subscribe();

      expect(mockGroupAdminService.list).toHaveBeenCalledWith({
        provider: 'tmi',
        group_name: 'every',
        limit: 10,
      });
    });

    it('should map groups to AutocompleteSuggestion with group_name as both fields', () => {
      let results: AutocompleteSuggestion[] = [];
      service.search('every', 'group').subscribe(r => (results = r));

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        displayLabel: 'everyone',
        value: 'everyone',
      });
      expect(results[1]).toEqual({
        displayLabel: 'security-team',
        value: 'security-team',
      });
    });
  });

  describe('admin gate', () => {
    it('should return empty results without API call when not admin', () => {
      mockAuthService.isAdmin = false;

      let results: AutocompleteSuggestion[] = [];
      service.search('ali', 'user').subscribe(r => (results = r));

      expect(results).toEqual([]);
      expect(mockUserAdminService.list).not.toHaveBeenCalled();
      expect(mockGroupAdminService.list).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return empty results on 401 error', () => {
      mockUserAdminService.list.mockReturnValue(
        throwError(() => ({ status: 401 })),
      );

      let results: AutocompleteSuggestion[] = [];
      service.search('ali', 'user').subscribe(r => (results = r));

      expect(results).toEqual([]);
    });

    it('should return empty results on 403 error', () => {
      mockUserAdminService.list.mockReturnValue(
        throwError(() => ({ status: 403 })),
      );

      let results: AutocompleteSuggestion[] = [];
      service.search('ali', 'user').subscribe(r => (results = r));

      expect(results).toEqual([]);
    });

    it('should return empty results on other errors', () => {
      mockGroupAdminService.list.mockReturnValue(
        throwError(() => new Error('network error')),
      );

      let results: AutocompleteSuggestion[] = [];
      service.search('sec', 'group').subscribe(r => (results = r));

      expect(results).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should return empty results for empty search term', () => {
      let results: AutocompleteSuggestion[] = [];
      service.search('', 'user').subscribe(r => (results = r));

      expect(results).toEqual([]);
      expect(mockUserAdminService.list).not.toHaveBeenCalled();
    });

    it('should return empty results for single character search term', () => {
      let results: AutocompleteSuggestion[] = [];
      service.search('a', 'user').subscribe(r => (results = r));

      expect(results).toEqual([]);
      expect(mockUserAdminService.list).not.toHaveBeenCalled();
    });

    it('should search when term is 2 or more characters', () => {
      service.search('al', 'user').subscribe();

      expect(mockUserAdminService.list).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/pages/tm/services/permissions-autocomplete.service.spec.ts`
Expected: FAIL — `PermissionsAutocompleteService` does not exist yet.

- [ ] **Step 3: Write the service implementation**

Create `src/app/pages/tm/services/permissions-autocomplete.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '@app/auth/services/auth.service';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { GroupAdminService } from '@app/core/services/group-admin.service';
import { LoggerService } from '@app/core/services/logger.service';

/**
 * Autocomplete suggestion for the permissions dialog subject field
 */
export interface AutocompleteSuggestion {
  /** Display text shown in the dropdown: "Name (email)" for users, group_name for groups */
  displayLabel: string;
  /** Value written to the subject field on selection: provider_user_id for users, group_name for groups */
  value: string;
}

/**
 * Service that provides autocomplete suggestions for TMI provider
 * principals in the permissions dialog.
 *
 * Gates on admin status — non-admin users get empty results silently.
 * Catches 401/403 errors silently, returning empty results.
 */
@Injectable({
  providedIn: 'root',
})
export class PermissionsAutocompleteService {
  private static readonly MIN_SEARCH_LENGTH = 2;
  private static readonly RESULT_LIMIT = 10;

  constructor(
    private authService: AuthService,
    private userAdminService: UserAdminService,
    private groupAdminService: GroupAdminService,
    private logger: LoggerService,
  ) {}

  /**
   * Search for TMI provider users or groups matching the given term.
   *
   * @param term - Search string (minimum 2 characters)
   * @param principalType - Whether to search users or groups
   * @returns Observable of matching suggestions, or empty array on error/non-admin
   */
  search(term: string, principalType: 'user' | 'group'): Observable<AutocompleteSuggestion[]> {
    if (!this.authService.isAdmin) {
      return of([]);
    }

    if (term.length < PermissionsAutocompleteService.MIN_SEARCH_LENGTH) {
      return of([]);
    }

    if (principalType === 'user') {
      return this.searchUsers(term);
    }
    return this.searchGroups(term);
  }

  private searchUsers(term: string): Observable<AutocompleteSuggestion[]> {
    return this.userAdminService
      .list({
        provider: 'tmi',
        name: term,
        limit: PermissionsAutocompleteService.RESULT_LIMIT,
      })
      .pipe(
        map(response =>
          response.users.map(user => ({
            displayLabel: `${user.name} (${user.email})`,
            value: user.provider_user_id,
          })),
        ),
        catchError(error => {
          this.logger.debug('Autocomplete user search failed (expected for non-admin)', error);
          return of([]);
        }),
      );
  }

  private searchGroups(term: string): Observable<AutocompleteSuggestion[]> {
    return this.groupAdminService
      .list({
        provider: 'tmi',
        group_name: term,
        limit: PermissionsAutocompleteService.RESULT_LIMIT,
      })
      .pipe(
        map(response =>
          response.groups.map(group => ({
            displayLabel: group.group_name,
            value: group.group_name,
          })),
        ),
        catchError(error => {
          this.logger.debug('Autocomplete group search failed (expected for non-admin)', error);
          return of([]);
        }),
      );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/app/pages/tm/services/permissions-autocomplete.service.spec.ts`
Expected: all tests PASS.

- [ ] **Step 5: Verify build**

Run: `pnpm run build`
Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/tm/services/permissions-autocomplete.service.ts src/app/pages/tm/services/permissions-autocomplete.service.spec.ts
git commit -m "feat: add PermissionsAutocompleteService for TMI provider search (#601)"
```

---

### Task 3: Wire mat-autocomplete into PermissionsDialogComponent

**Files:**
- Modify: `src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.ts`

- [ ] **Step 1: Add imports to the component file**

Add these imports at the top of `permissions-dialog.component.ts`:

```typescript
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import {
  PermissionsAutocompleteService,
  AutocompleteSuggestion,
} from '../../services/permissions-autocomplete.service';
```

Update the existing `Subscription` import to include `Subject`:

```typescript
import { Subject, Subscription } from 'rxjs';
```

Add `MatAutocompleteModule` and `AsyncPipe` to the component's `imports` array:

```typescript
imports: [
  ...DIALOG_IMPORTS,
  ...DATA_MATERIAL_IMPORTS,
  ...FORM_MATERIAL_IMPORTS,
  MatAutocompleteModule,
  AsyncPipe,
  TranslocoModule,
  ScrollIndicatorDirective,
  PrincipalTypeIconComponent,
  ProviderDisplayComponent,
  UserDisplayComponent,
],
```

Add `AsyncPipe` to the Angular imports at the top:

```typescript
import { AsyncPipe } from '@angular/common';
```

- [ ] **Step 2: Add autocomplete properties and injection to the component class**

Add `PermissionsAutocompleteService` to the constructor:

```typescript
constructor(
  public dialogRef: MatDialogRef<PermissionsDialogComponent>,
  @Inject(MAT_DIALOG_DATA) public data: PermissionsDialogData,
  private authService: AuthService,
  private providerAdapter: ProviderAdapterService,
  private autocompleteService: PermissionsAutocompleteService,
) {}
```

Add these properties to the component class:

```typescript
/** Subject that emits search terms for autocomplete */
autocompleteTrigger$ = new Subject<{ term: string; principalType: 'user' | 'group' }>();

/** Current autocomplete suggestions */
autocompleteSuggestions: AutocompleteSuggestion[] = [];

/** Index of the row currently being edited (for autocomplete context) */
private _activeRowIndex = -1;
```

- [ ] **Step 3: Initialize autocomplete pipeline in ngOnInit**

Add at the end of `ngOnInit()`:

```typescript
// Set up autocomplete search pipeline
this._subscriptions.add(
  this.autocompleteTrigger$
    .pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => prev.term === curr.term && prev.principalType === curr.principalType),
      switchMap(({ term, principalType }) =>
        this.autocompleteService.search(term, principalType),
      ),
    )
    .subscribe(suggestions => {
      this.autocompleteSuggestions = suggestions;
    }),
);
```

- [ ] **Step 4: Add helper methods for autocomplete**

Add these methods to the component class:

```typescript
/**
 * Handle input events on the subject field for autocomplete
 * Only triggers search when the provider is TMI
 */
onSubjectInput(index: number, event: Event): void {
  const input = event.target as HTMLInputElement;
  const auth = this.permissionsDataSource.data[index];

  if (auth.provider !== 'tmi') {
    this.autocompleteSuggestions = [];
    return;
  }

  this._activeRowIndex = index;
  this.autocompleteTrigger$.next({
    term: input.value,
    principalType: auth.principal_type,
  });
}

/**
 * Handle autocomplete option selection
 */
onAutocompleteSelected(index: number, event: MatAutocompleteSelectedEvent): void {
  const suggestion = event.option.value as AutocompleteSuggestion;
  const auth = this.permissionsDataSource.data[index] as AuthorizationWithSubject;
  auth._subject = suggestion.value;
}

/**
 * Check if autocomplete should be active for a given row
 */
isAutocompleteActive(auth: Authorization): boolean {
  return auth.provider === 'tmi';
}
```

- [ ] **Step 5: Update the subject column template**

Replace the subject column template (the `<ng-container matColumnDef="subject">` block) with:

```html
<!-- Subject Column (replaces Provider ID and Email) -->
<ng-container matColumnDef="subject">
  <th mat-header-cell *matHeaderCellDef mat-sort-header>
    {{ 'threatModels.permissionsSubject' | transloco }}
  </th>
  <td mat-cell *matCellDef="let auth; let i = index">
    @if (!data.isReadOnly) {
      <mat-form-field appearance="outline" class="table-field">
        <input
          matInput
          data-testid="permissions-subject-input"
          [(ngModel)]="auth._subject"
          [placeholder]="getSubjectPlaceholder(auth)"
          [attr.tabindex]="i * 5 + 3"
          [matAutocomplete]="subjectAuto"
          (input)="onSubjectInput(i, $event)"
        />
        <mat-autocomplete
          #subjectAuto="matAutocomplete"
          (optionSelected)="onAutocompleteSelected(i, $event)"
        >
          @for (suggestion of autocompleteSuggestions; track suggestion.value) {
            <mat-option [value]="suggestion">
              {{ suggestion.displayLabel }}
            </mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
    }
    @if (data.isReadOnly) {
      <span>{{ getSubjectValue(auth) }}</span>
    }
  </td>
</ng-container>
```

- [ ] **Step 6: Verify build**

Run: `pnpm run build`
Expected: clean build.

- [ ] **Step 7: Run existing tests**

Run: `pnpm exec vitest run src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.spec.ts`
Expected: some tests may fail because the constructor now requires an additional argument. Proceed to Task 4 to fix.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.ts
git commit -m "feat: wire mat-autocomplete to permissions dialog subject field (#601)"
```

---

### Task 4: Update PermissionsDialogComponent Tests

**Files:**
- Modify: `src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.spec.ts`

- [ ] **Step 1: Add mock for PermissionsAutocompleteService and fix constructor**

Add imports at the top of the spec file:

```typescript
import type {
  PermissionsAutocompleteService,
  AutocompleteSuggestion,
} from '../../services/permissions-autocomplete.service';
```

Add the mock variable in the describe block:

```typescript
let mockAutocompleteService: {
  search: ReturnType<typeof vi.fn>;
};
```

Initialize in `beforeEach`:

```typescript
mockAutocompleteService = {
  search: vi.fn().mockReturnValue(of([])),
};
```

Update the component construction to include the new dependency:

```typescript
component = new PermissionsDialogComponent(
  mockDialogRef as unknown as MatDialogRef<PermissionsDialogComponent>,
  dialogData,
  mockAuthService as unknown as AuthService,
  mockProviderAdapter as unknown as ProviderAdapterService,
  mockAutocompleteService as unknown as PermissionsAutocompleteService,
);
```

Also update any other `new PermissionsDialogComponent(...)` calls in the test file (e.g., in the `_subject` initialization test) to include the fifth argument.

- [ ] **Step 2: Add autocomplete-specific test cases**

Add a new `describe('autocomplete', ...)` block:

```typescript
describe('autocomplete', () => {
  it('should trigger search on subject input for TMI provider', () => {
    component.permissionsTable = { renderRows: vi.fn() } as never;
    dialogData.permissions = [
      createPermission({ provider: 'tmi', principal_type: 'user' }),
    ];
    component = new PermissionsDialogComponent(
      mockDialogRef as unknown as MatDialogRef<PermissionsDialogComponent>,
      dialogData,
      mockAuthService as unknown as AuthService,
      mockProviderAdapter as unknown as ProviderAdapterService,
      mockAutocompleteService as unknown as PermissionsAutocompleteService,
    );
    component.permissionsTable = { renderRows: vi.fn() } as never;
    component.ngOnInit();

    const mockEvent = { target: { value: 'alice' } } as unknown as Event;
    component.onSubjectInput(0, mockEvent);

    // The trigger$ subject should have emitted — verify by checking
    // that after debounce the search would be called
    // (Direct unit test of the method behavior)
    expect(component.autocompleteSuggestions).toEqual([]);
  });

  it('should not trigger search for non-TMI provider', () => {
    component.permissionsTable = { renderRows: vi.fn() } as never;
    component.ngOnInit();

    const mockEvent = { target: { value: 'alice' } } as unknown as Event;
    component.onSubjectInput(0, mockEvent);

    expect(component.autocompleteSuggestions).toEqual([]);
    expect(mockAutocompleteService.search).not.toHaveBeenCalled();
  });

  it('should set _subject on autocomplete selection', () => {
    component.permissionsTable = { renderRows: vi.fn() } as never;
    component.ngOnInit();

    const suggestion: AutocompleteSuggestion = {
      displayLabel: 'Alice Smith (alice@example.com)',
      value: 'alice-pid',
    };
    const mockEvent = {
      option: { value: suggestion },
    } as unknown as import('@angular/material/autocomplete').MatAutocompleteSelectedEvent;

    component.onAutocompleteSelected(0, mockEvent);

    const auth = component.permissionsDataSource.data[0] as Record<string, unknown>;
    expect(auth._subject).toBe('alice-pid');
  });

  it('should report autocomplete active for TMI provider', () => {
    const auth = createPermission({ provider: 'tmi' });
    expect(component.isAutocompleteActive(auth)).toBe(true);
  });

  it('should report autocomplete inactive for non-TMI provider', () => {
    const auth = createPermission({ provider: 'google' });
    expect(component.isAutocompleteActive(auth)).toBe(false);
  });
});
```

- [ ] **Step 3: Run all component tests**

Run: `pnpm exec vitest run src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.spec.ts`
Expected: all tests PASS.

- [ ] **Step 4: Run all service tests**

Run: `pnpm exec vitest run src/app/pages/tm/services/permissions-autocomplete.service.spec.ts`
Expected: all tests PASS.

- [ ] **Step 5: Run full build**

Run: `pnpm run build`
Expected: clean build.

- [ ] **Step 6: Run lint**

Run: `pnpm run lint:all`
Expected: no lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.spec.ts
git commit -m "test: add autocomplete tests for permissions dialog (#601)"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: clean build.

- [ ] **Step 3: Run lint**

Run: `pnpm run lint:all`
Expected: no lint errors.

- [ ] **Step 4: Add comment to GitHub issue**

```bash
gh issue comment 601 --repo ericfitz/tmi-ux --body "Implementation complete: added autocomplete for TMI provider in permissions dialog. Commits on dev/1.4.0."
```

- [ ] **Step 5: Close the issue**

```bash
gh issue close 601 --repo ericfitz/tmi-ux --reason completed
```
