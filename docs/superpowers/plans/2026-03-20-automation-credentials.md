# Automation User & Credential Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automation user creation to webhook dialog (#524) and credential management to admin users page (#526).

**Architecture:** Extend the existing admin service layer with automation account and credential CRUD methods. Add two new dialog components (ManageCredentialsDialog, CreateAutomationUserDialog) and modify the webhook creation dialog and admin users page. Regenerate API types first to avoid hand-writing duplicate interfaces.

**Tech Stack:** Angular 19, Angular Material, Transloco i18n, Vitest, RxJS

**Spec:** `docs/superpowers/specs/2026-03-20-automation-credentials-design.md`

---

## Task 0: Regenerate API Types

**Files:**
- Modify: `src/app/generated/api-types.d.ts` (regenerated)

- [ ] **Step 1: Regenerate types from local OpenAPI spec**

Run:
```bash
OPENAPI_SPEC=/Users/efitz/Projects/tmi/api-schema/tmi-openapi.json pnpm run generate:api-types
```

- [ ] **Step 2: Verify new types exist**

Run:
```bash
grep -c 'CreateAutomationAccountRequest\|CreateAutomationAccountResponse\|createAutomationAccount\|listAdminUserClientCredentials\|createAdminUserClientCredential\|deleteAdminUserClientCredential' src/app/generated/api-types.d.ts
```
Expected: 6+ matches

- [ ] **Step 3: Build to verify no breakage**

Run: `pnpm run build`
Expected: PASS (generated types are backward compatible)

- [ ] **Step 4: Run tests to verify no breakage**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/generated/api-types.d.ts
git commit -m "chore: regenerate api-types.d.ts from latest server OpenAPI spec"
```

---

## Task 1: Update Type Files to Re-export from Generated Types

**Files:**
- Modify: `src/app/types/user.types.ts`
- Modify: `src/app/types/client-credential.types.ts`

- [ ] **Step 1: Update `user.types.ts`**

Replace hand-written `AdminUser` and `ListAdminUsersResponse` with re-exports from generated types. Add `automation` filter to `AdminUserFilter`. Fix `sort_by` enum.

```typescript
/**
 * User type definitions
 * Re-exports generated types and defines client-side filter types
 */
import { components } from '@app/generated/api-types';

/** Admin user object with enriched data */
export type AdminUser = components['schemas']['AdminUser'];

/** Response from list admin users endpoint */
export type ListAdminUsersResponse = components['schemas']['AdminUserListResponse'];

/** Request to create an automation account */
export type CreateAutomationAccountRequest =
  components['schemas']['CreateAutomationAccountRequest'];

/** Response from creating an automation account (includes user + credential) */
export type CreateAutomationAccountResponse =
  components['schemas']['CreateAutomationAccountResponse'];

/**
 * Filter parameters for listing admin users (client-side convenience type)
 */
export interface AdminUserFilter {
  /** Filter by OAuth/SAML provider */
  provider?: string;
  /** Filter by email (case-insensitive substring match) */
  email?: string;
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

- [ ] **Step 2: Update `client-credential.types.ts`**

Replace hand-written types with re-exports from generated types.

```typescript
/**
 * Client credential type definitions
 * Re-exports generated types from the OpenAPI spec
 */
import { components } from '@app/generated/api-types';

/** Client credential info returned from list endpoint (no secret) */
export type ClientCredentialInfo = components['schemas']['ClientCredentialInfo'];

/** Client credential response from creation (includes secret, shown only once) */
export type ClientCredentialResponse = components['schemas']['ClientCredentialResponse'];

/** Input for creating a new client credential */
export type CreateClientCredentialRequest =
  components['schemas']['CreateClientCredentialRequest'];

/** Response from list client credentials endpoint (paginated) */
export type ListClientCredentialsResponse =
  components['schemas']['ListClientCredentialsResponse'];
```

- [ ] **Step 3: Build to verify all imports still resolve**

Run: `pnpm run build`
Expected: PASS. If there are field name mismatches between the old hand-written types and the generated types, fix the consuming code.

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/types/user.types.ts src/app/types/client-credential.types.ts
git commit -m "refactor: re-export user and credential types from generated api-types"
```

---

## Task 2: Add Service Methods to UserAdminService

**Files:**
- Modify: `src/app/core/services/user-admin.service.ts`
- Modify: `src/app/core/services/user-admin.service.spec.ts`

- [ ] **Step 1: Write failing tests for the 4 new methods**

Add to `src/app/core/services/user-admin.service.spec.ts`. Update the mock to include `post`:

```typescript
// Update mockApiService at the top of the describe block:
let mockApiService: {
  get: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

// Update beforeEach:
mockApiService = {
  get: vi.fn(),
  delete: vi.fn(),
  post: vi.fn(),
};

// Add these imports at the top:
import {
  CreateAutomationAccountRequest,
  CreateAutomationAccountResponse,
} from '@app/types/user.types';
import {
  ClientCredentialResponse,
  CreateClientCredentialRequest,
  ListClientCredentialsResponse,
} from '@app/types/client-credential.types';
```

Add new test blocks after the existing `describe('buildParams()')`:

```typescript
describe('createAutomationUser()', () => {
  const mockRequest: CreateAutomationAccountRequest = {
    name: 'webhook-analyzer',
  };

  const mockResponse: CreateAutomationAccountResponse = {
    user: { ...mockUser, automation: true, provider: 'tmi' },
    client_credential: {
      id: 'cred-123',
      client_id: 'tmi_cc_abc123',
      client_secret: 'secret-value',
      name: 'webhook-analyzer',
      created_at: '2024-01-01T00:00:00Z',
    },
  };

  it('should call POST admin/users/automation', () => {
    mockApiService.post.mockReturnValue(of(mockResponse));

    service.createAutomationUser(mockRequest).subscribe(response => {
      expect(mockApiService.post).toHaveBeenCalledWith(
        'admin/users/automation',
        mockRequest,
      );
      expect(response).toEqual(mockResponse);
    });
  });

  it('should log info on success', () => {
    mockApiService.post.mockReturnValue(of(mockResponse));

    service.createAutomationUser(mockRequest).subscribe(() => {
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Automation user created',
        { name: mockUser.name },
      );
    });
  });

  it('should handle errors', () => {
    const error = new Error('Conflict');
    mockApiService.post.mockReturnValue(throwError(() => error));

    service.createAutomationUser(mockRequest).subscribe({
      error: err => {
        expect(mockLoggerService.error).toHaveBeenCalledWith(
          'Failed to create automation user',
          error,
        );
        expect(err).toBe(error);
      },
    });
  });
});

describe('listUserCredentials()', () => {
  const testUuid = '123e4567-e89b-12d3-a456-426614174000';
  const mockCredListResponse: ListClientCredentialsResponse = {
    credentials: [
      {
        id: 'cred-1',
        client_id: 'tmi_cc_abc',
        name: 'test-cred',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        modified_at: '2024-01-01T00:00:00Z',
      },
    ],
    total: 1,
    limit: 100,
    offset: 0,
  };

  it('should call GET admin/users/{uuid}/client_credentials', () => {
    mockApiService.get.mockReturnValue(of(mockCredListResponse));

    service.listUserCredentials(testUuid).subscribe(response => {
      expect(mockApiService.get).toHaveBeenCalledWith(
        `admin/users/${testUuid}/client_credentials`,
        undefined,
      );
      expect(response).toEqual(mockCredListResponse);
    });
  });

  it('should handle errors', () => {
    const error = new Error('Forbidden');
    mockApiService.get.mockReturnValue(throwError(() => error));

    service.listUserCredentials(testUuid).subscribe({
      error: err => {
        expect(mockLoggerService.error).toHaveBeenCalledWith(
          'Failed to list user credentials',
          error,
        );
        expect(err).toBe(error);
      },
    });
  });
});

describe('createUserCredential()', () => {
  const testUuid = '123e4567-e89b-12d3-a456-426614174000';
  const mockInput: CreateClientCredentialRequest = {
    name: 'new-cred',
    description: 'A test credential',
  };
  const mockCredResponse: ClientCredentialResponse = {
    id: 'cred-new',
    client_id: 'tmi_cc_new',
    client_secret: 'new-secret',
    name: 'new-cred',
    created_at: '2024-01-01T00:00:00Z',
  };

  it('should call POST admin/users/{uuid}/client_credentials', () => {
    mockApiService.post.mockReturnValue(of(mockCredResponse));

    service.createUserCredential(testUuid, mockInput).subscribe(response => {
      expect(mockApiService.post).toHaveBeenCalledWith(
        `admin/users/${testUuid}/client_credentials`,
        mockInput,
      );
      expect(response).toEqual(mockCredResponse);
    });
  });

  it('should handle errors', () => {
    const error = new Error('Failed');
    mockApiService.post.mockReturnValue(throwError(() => error));

    service.createUserCredential(testUuid, mockInput).subscribe({
      error: err => {
        expect(mockLoggerService.error).toHaveBeenCalledWith(
          'Failed to create user credential',
          error,
        );
        expect(err).toBe(error);
      },
    });
  });
});

describe('deleteUserCredential()', () => {
  const testUuid = '123e4567-e89b-12d3-a456-426614174000';
  const credId = 'cred-to-delete';

  it('should call DELETE admin/users/{uuid}/client_credentials/{credId}', () => {
    mockApiService.delete.mockReturnValue(of(undefined));

    service.deleteUserCredential(testUuid, credId).subscribe(() => {
      expect(mockApiService.delete).toHaveBeenCalledWith(
        `admin/users/${testUuid}/client_credentials/${credId}`,
      );
    });
  });

  it('should log info on success', () => {
    mockApiService.delete.mockReturnValue(of(undefined));

    service.deleteUserCredential(testUuid, credId).subscribe(() => {
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'User credential deleted',
        { internalUuid: testUuid, credentialId: credId },
      );
    });
  });

  it('should handle errors', () => {
    const error = new Error('Failed');
    mockApiService.delete.mockReturnValue(throwError(() => error));

    service.deleteUserCredential(testUuid, credId).subscribe({
      error: err => {
        expect(mockLoggerService.error).toHaveBeenCalledWith(
          'Failed to delete user credential',
          error,
        );
        expect(err).toBe(error);
      },
    });
  });
});

describe('list() with automation filter', () => {
  it('should pass automation=true as query parameter', () => {
    mockApiService.get.mockReturnValue(of(mockListResponse));

    service.list({ automation: true }).subscribe(() => {
      expect(mockApiService.get).toHaveBeenCalledWith('admin/users', {
        automation: true,
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/app/core/services/user-admin.service.spec.ts`
Expected: FAIL — methods do not exist yet

- [ ] **Step 3: Implement the 4 new methods**

Update `src/app/core/services/user-admin.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  AdminUser,
  AdminUserFilter,
  CreateAutomationAccountRequest,
  CreateAutomationAccountResponse,
  ListAdminUsersResponse,
} from '@app/types/user.types';
import {
  ClientCredentialResponse,
  CreateClientCredentialRequest,
  ListClientCredentialsResponse,
} from '@app/types/client-credential.types';
import { TransferOwnershipResult } from '@app/types/transfer.types';
import { buildHttpParams } from '@app/shared/utils/http-params.util';

@Injectable({
  providedIn: 'root',
})
export class UserAdminService {
  private usersSubject$ = new BehaviorSubject<AdminUser[]>([]);
  public users$: Observable<AdminUser[]> = this.usersSubject$.asObservable();

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  public list(filter?: AdminUserFilter): Observable<ListAdminUsersResponse> {
    const params = buildHttpParams(filter);
    return this.apiService.get<ListAdminUsersResponse>('admin/users', params).pipe(
      tap(response => {
        this.usersSubject$.next(response.users);
        this.logger.debug('Users loaded', {
          count: response.users.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error('Failed to list users', error);
        throw error;
      }),
    );
  }

  public delete(internal_uuid: string): Observable<void> {
    return this.apiService.delete<void>(`admin/users/${internal_uuid}`).pipe(
      tap(() => {
        this.logger.info('User deleted', { internal_uuid });
        this.list().subscribe();
      }),
      catchError(error => {
        this.logger.error('Failed to delete user', error);
        throw error;
      }),
    );
  }

  public transferOwnership(
    sourceUserId: string,
    targetUserId: string,
  ): Observable<TransferOwnershipResult> {
    return this.apiService
      .post<TransferOwnershipResult>(`admin/users/${sourceUserId}/transfer`, {
        target_user_id: targetUserId,
      })
      .pipe(
        tap(result => {
          this.logger.info('Ownership transferred (admin)', {
            sourceUserId,
            targetUserId,
            tmCount: result.threat_models_transferred.count,
            responseCount: result.survey_responses_transferred.count,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to transfer ownership (admin)', error);
          throw error;
        }),
      );
  }

  public createAutomationUser(
    request: CreateAutomationAccountRequest,
  ): Observable<CreateAutomationAccountResponse> {
    return this.apiService
      .post<CreateAutomationAccountResponse>(
        'admin/users/automation',
        request as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(response => {
          this.logger.info('Automation user created', { name: response.user.name });
        }),
        catchError(error => {
          this.logger.error('Failed to create automation user', error);
          throw error;
        }),
      );
  }

  public listUserCredentials(
    internalUuid: string,
  ): Observable<ListClientCredentialsResponse> {
    return this.apiService
      .get<ListClientCredentialsResponse>(
        `admin/users/${internalUuid}/client_credentials`,
      )
      .pipe(
        tap(response => {
          this.logger.debug('User credentials loaded', {
            internalUuid,
            count: response.credentials.length,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to list user credentials', error);
          throw error;
        }),
      );
  }

  public createUserCredential(
    internalUuid: string,
    input: CreateClientCredentialRequest,
  ): Observable<ClientCredentialResponse> {
    return this.apiService
      .post<ClientCredentialResponse>(
        `admin/users/${internalUuid}/client_credentials`,
        input as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(credential => {
          this.logger.info('User credential created', {
            internalUuid,
            credentialId: credential.id,
          });
        }),
        catchError(error => {
          this.logger.error('Failed to create user credential', error);
          throw error;
        }),
      );
  }

  public deleteUserCredential(
    internalUuid: string,
    credentialId: string,
  ): Observable<void> {
    return this.apiService
      .delete<void>(
        `admin/users/${internalUuid}/client_credentials/${credentialId}`,
      )
      .pipe(
        tap(() => {
          this.logger.info('User credential deleted', { internalUuid, credentialId });
        }),
        catchError(error => {
          this.logger.error('Failed to delete user credential', error);
          throw error;
        }),
      );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/app/core/services/user-admin.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Build**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/core/services/user-admin.service.ts src/app/core/services/user-admin.service.spec.ts
git commit -m "feat: add automation user and credential management methods to UserAdminService (#524, #526)"
```

---

## Task 3: Modify CreateCredentialDialog to Support `returnFormOnly`

**Files:**
- Modify: `src/app/core/components/user-preferences-dialog/create-credential-dialog/create-credential-dialog.component.ts`
- Test: `src/app/core/components/user-preferences-dialog/create-credential-dialog/create-credential-dialog.component.spec.ts` (create if not exists)

- [ ] **Step 1: Check if spec file exists**

Run:
```bash
ls src/app/core/components/user-preferences-dialog/create-credential-dialog/create-credential-dialog.component.spec.ts 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

- [ ] **Step 2: Add dialog data interface and `MAT_DIALOG_DATA` injection**

In `create-credential-dialog.component.ts`, add:

1. Import `MAT_DIALOG_DATA, Inject` and `Optional`
2. Define the data interface
3. Inject it optionally
4. Branch `onSave()` based on `returnFormOnly`

```typescript
// Add to imports:
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Inject, Optional } from '@angular/core';

// Add interface before the @Component decorator:
export interface CreateCredentialDialogData {
  returnFormOnly?: boolean;
}

// Update constructor:
constructor(
  private dialogRef: MatDialogRef<CreateCredentialDialogComponent>,
  @Optional() @Inject(MAT_DIALOG_DATA) private data: CreateCredentialDialogData | null,
  private clientCredentialService: ClientCredentialService,
  private fb: FormBuilder,
  private logger: LoggerService,
) {}

// Update onSave():
onSave(): void {
  if (this.form.valid && !this.saving) {
    const formValue = this.form.value as {
      name: string;
      description: string;
      expiresAt: Date | null;
    };

    const input: CreateClientCredentialRequest = {
      name: formValue.name.trim(),
      ...(formValue.description && { description: formValue.description.trim() }),
      ...(formValue.expiresAt && { expires_at: formValue.expiresAt.toISOString() }),
    };

    // If returnFormOnly, just return the form data without calling the API
    if (this.data?.returnFormOnly) {
      this.dialogRef.close(input);
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    this.clientCredentialService
      .create(input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (credential: ClientCredentialResponse) => {
          this.logger.info('Client credential created successfully');
          this.dialogRef.close(credential);
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to create client credential', error);
          this.errorMessage =
            error.error?.message || 'Failed to create credential. Please try again.';
          this.saving = false;
        },
      });
  }
}
```

- [ ] **Step 3: Build to verify existing callers still work**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 4: Run all tests**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/core/components/user-preferences-dialog/create-credential-dialog/
git commit -m "feat: add returnFormOnly option to CreateCredentialDialog (#526)"
```

---

## Task 4: Add Automation Filter and Manage Credentials Button to Admin Users Page

**Files:**
- Modify: `src/app/pages/admin/users/admin-users.component.ts`
- Modify: `src/app/pages/admin/users/admin-users.component.html`
- Modify: `src/app/pages/admin/users/admin-users.component.scss`

- [ ] **Step 1: Add automation filter toggle to the HTML**

In `admin-users.component.html`, add a slide toggle inside the `filter-card` after the search field:

```html
<mat-card class="filter-card">
  <mat-card-content>
    <div class="filter-row">
      <mat-form-field class="filter-field" appearance="outline">
        <mat-label [transloco]="'admin.users.filterLabel'">Filter Users</mat-label>
        <input
          matInput
          [value]="filterText"
          (input)="onFilterChange($any($event.target).value)"
          [placeholder]="'admin.users.filterPlaceholder' | transloco"
        />
        <mat-icon matPrefix>search</mat-icon>
      </mat-form-field>
      <mat-slide-toggle
        [checked]="automationOnly"
        (change)="onAutomationFilterChange($event.checked)"
        class="automation-toggle"
      >
        <span [transloco]="'admin.users.filter.automationOnly'">
          Show automation accounts only
        </span>
      </mat-slide-toggle>
    </div>
  </mat-card-content>
</mat-card>
```

- [ ] **Step 2: Add "Manage Credentials" action button to each user row**

In the actions column of the HTML, add a new button before the kebab menu:

```html
<!-- Actions Column -->
<ng-container matColumnDef="actions">
  <th mat-header-cell *matHeaderCellDef class="column-actions">
    {{ 'common.actions' | transloco }}
  </th>
  <td mat-cell *matCellDef="let user" class="column-actions">
    <div class="action-buttons">
      <button
        mat-icon-button
        [matTooltip]="'admin.users.actions.manageCredentials' | transloco"
        [disabled]="user.automation !== true"
        (click)="onManageCredentials(user); $event.stopPropagation()"
      >
        <mat-icon>vpn_key</mat-icon>
      </button>
      <button
        mat-icon-button
        [matMenuTriggerFor]="userRowKebabMenu"
        [matTooltip]="'common.actions' | transloco"
        (click)="$event.stopPropagation()"
      >
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #userRowKebabMenu="matMenu">
        <button mat-menu-item (click)="onTransferOwnership(user)">
          <mat-icon>swap_horiz</mat-icon>
          <span [transloco]="'admin.users.transferOwnership.tooltip'"
            >Transfer Ownership</span
          >
        </button>
        <mat-divider></mat-divider>
        <button mat-menu-item (click)="onDeleteUser(user)">
          <mat-icon>delete</mat-icon>
          <span [transloco]="'admin.users.deleteTooltip'">Delete</span>
        </button>
      </mat-menu>
    </div>
  </td>
</ng-container>
```

- [ ] **Step 3: Add component logic**

In `admin-users.component.ts`, add:

```typescript
// Add to class properties:
automationOnly = false;

// Add methods:
onAutomationFilterChange(checked: boolean): void {
  this.automationOnly = checked;
  this.pageIndex = 0;
  this.loadUsers();
  this.updateUrl();
}

onManageCredentials(user: AdminUser): void {
  // Placeholder — dialog will be built in Task 5
  this.logger.debug('Manage credentials clicked', { user: user.internal_uuid });
}
```

Update `loadUsers()` to pass the automation filter:

```typescript
loadUsers(): void {
  this.loading = true;
  const offset = calculateOffset(this.pageIndex, this.pageSize);

  this.userAdminService
    .list({
      limit: this.pageSize,
      offset,
      ...(this.automationOnly && { automation: true }),
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      // ... existing handlers unchanged
    });
}
```

- [ ] **Step 4: Add filter row styling to SCSS**

Add to `admin-users.component.scss` inside `.filter-card`:

```scss
.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;

  .filter-field {
    flex: 1;
  }

  .automation-toggle {
    white-space: nowrap;
  }
}
```

- [ ] **Step 5: Build and test**

Run: `pnpm run build && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/admin/users/
git commit -m "feat: add automation filter and manage credentials button to admin users page (#526)"
```

---

## Task 5: Create ManageCredentialsDialog Component

**Files:**
- Create: `src/app/pages/admin/users/manage-credentials-dialog/manage-credentials-dialog.component.ts`

- [ ] **Step 1: Create the dialog component**

```typescript
import { Component, DestroyRef, Inject, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  ClientCredentialInfo,
  ClientCredentialResponse,
  CreateClientCredentialRequest,
} from '@app/types/client-credential.types';
import {
  CreateCredentialDialogComponent,
  CreateCredentialDialogData,
} from '@app/core/components/user-preferences-dialog/create-credential-dialog/create-credential-dialog.component';
import {
  CredentialSecretDialogComponent,
  CredentialSecretDialogData,
} from '@app/core/components/user-preferences-dialog/credential-secret-dialog/credential-secret-dialog.component';
import { getErrorMessage } from '@app/shared/utils/http-error.utils';

export interface ManageCredentialsDialogData {
  internalUuid: string;
  userName: string;
}

@Component({
  selector: 'app-manage-credentials-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <span [transloco]="'admin.users.manageCredentials.title'"
            [translocoParams]="{ name: data.userName }">
        Manage Credentials for {{ data.userName }}
      </span>
    </h2>
    <mat-dialog-content>
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (credentials.length === 0) {
        <p class="no-credentials" [transloco]="'admin.users.manageCredentials.noCredentials'">
          No credentials found
        </p>
      } @else {
        <table mat-table [dataSource]="credentials" class="credentials-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'admin.users.manageCredentials.columns.name' | transloco }}
            </th>
            <td mat-cell *matCellDef="let cred">{{ cred.name }}</td>
          </ng-container>

          <ng-container matColumnDef="client_id">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'admin.users.manageCredentials.columns.clientId' | transloco }}
            </th>
            <td mat-cell *matCellDef="let cred">
              <span class="monospace">{{ cred.client_id }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="created_at">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'admin.users.manageCredentials.columns.createdAt' | transloco }}
            </th>
            <td mat-cell *matCellDef="let cred">
              {{ cred.created_at | date: 'short' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="expires_at">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'admin.users.manageCredentials.columns.expiresAt' | transloco }}
            </th>
            <td mat-cell *matCellDef="let cred">
              @if (cred.expires_at) {
                {{ cred.expires_at | date: 'short' }}
              } @else {
                <span class="muted" [transloco]="'admin.users.never'">Never</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let cred">
              <button
                mat-icon-button
                color="warn"
                [matTooltip]="'common.delete' | transloco"
                (click)="onDeleteCredential(cred)"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      }

      @if (errorMessage) {
        <mat-error class="form-error">{{ errorMessage }}</mat-error>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onAddCredential()">
        <mat-icon>add</mat-icon>
        <span [transloco]="'admin.users.manageCredentials.addCredential'">
          Add Credential
        </span>
      </button>
      <button mat-raised-button (click)="onClose()" [transloco]="'common.close'">
        Close
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .loading-container {
        display: flex;
        justify-content: center;
        padding: 32px;
      }

      .no-credentials {
        text-align: center;
        color: var(--theme-text-secondary);
        padding: 32px;
        font-style: italic;
      }

      .credentials-table {
        width: 100%;
      }

      .monospace {
        font-family: monospace;
        font-size: 13px;
      }

      .muted {
        color: var(--theme-text-secondary);
        font-style: italic;
      }

      .form-error {
        color: var(--theme-error);
        font-size: 12px;
        margin-top: 8px;
      }

      mat-dialog-content {
        min-width: 600px;
        min-height: 200px;
      }

      mat-dialog-actions {
        padding: 16px 24px 16px 0;
        margin: 0;
      }
    `,
  ],
})
export class ManageCredentialsDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  credentials: ClientCredentialInfo[] = [];
  loading = false;
  errorMessage = '';
  displayedColumns = ['name', 'client_id', 'created_at', 'expires_at', 'actions'];

  constructor(
    public dialogRef: MatDialogRef<ManageCredentialsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ManageCredentialsDialogData,
    private userAdminService: UserAdminService,
    private dialog: MatDialog,
    private logger: LoggerService,
    private transloco: TranslocoService,
  ) {}

  ngOnInit(): void {
    this.loadCredentials();
  }

  loadCredentials(): void {
    this.loading = true;
    this.errorMessage = '';

    this.userAdminService
      .listUserCredentials(this.data.internalUuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.credentials = response.credentials;
          this.loading = false;
        },
        error: error => {
          this.logger.error('Failed to load credentials', error);
          this.errorMessage = getErrorMessage(error, 'Failed to load credentials');
          this.loading = false;
        },
      });
  }

  onAddCredential(): void {
    const dialogData: CreateCredentialDialogData = { returnFormOnly: true };
    const dialogRef = this.dialog.open(CreateCredentialDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: CreateClientCredentialRequest | null) => {
        if (!result) return;

        this.userAdminService
          .createUserCredential(this.data.internalUuid, result)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (credential: ClientCredentialResponse) => {
              const secretData: CredentialSecretDialogData = {
                clientId: credential.client_id,
                clientSecret: credential.client_secret,
              };
              this.dialog.open(CredentialSecretDialogComponent, {
                width: '600px',
                disableClose: true,
                data: secretData,
              });
              this.loadCredentials();
            },
            error: error => {
              this.logger.error('Failed to create credential', error);
              this.errorMessage = getErrorMessage(error, 'Failed to create credential');
            },
          });
      });
  }

  onDeleteCredential(credential: ClientCredentialInfo): void {
    const message = this.transloco.translate(
      'admin.users.manageCredentials.deleteConfirm',
      { name: credential.name },
    );
    if (!confirm(message)) return;

    this.userAdminService
      .deleteUserCredential(this.data.internalUuid, credential.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadCredentials();
        },
        error: error => {
          this.logger.error('Failed to delete credential', error);
          this.errorMessage = getErrorMessage(error, 'Failed to delete credential');
        },
      });
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
```

- [ ] **Step 2: Wire up the dialog in admin-users.component.ts**

Update the `onManageCredentials` method and add the import:

```typescript
// Add import:
import {
  ManageCredentialsDialogComponent,
  ManageCredentialsDialogData,
} from './manage-credentials-dialog/manage-credentials-dialog.component';

// Replace placeholder method:
onManageCredentials(user: AdminUser): void {
  const dialogData: ManageCredentialsDialogData = {
    internalUuid: user.internal_uuid,
    userName: user.name || user.email,
  };

  this.dialog.open(ManageCredentialsDialogComponent, {
    width: '800px',
    data: dialogData,
  });
}
```

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/users/
git commit -m "feat: add ManageCredentialsDialog for automation account credentials (#526)"
```

---

## Task 6: Modify Webhook Dialog and Create Automation User Dialog

**Files:**
- Modify: `src/app/pages/admin/webhooks/add-webhook-dialog/add-webhook-dialog.component.ts`
- Modify: `src/app/pages/admin/webhooks/admin-webhooks.component.ts`
- Create: `src/app/pages/admin/webhooks/create-automation-user-dialog/create-automation-user-dialog.component.ts`

- [ ] **Step 1: Add checkbox to webhook dialog**

In `add-webhook-dialog.component.ts`:

1. Add a `createAutomationUser` form control
2. Add the checkbox to the template (after the secret field, before the error message)
3. Change the close value to include the flag

Template addition (insert before the `@if (errorMessage)` block):

```html
<mat-checkbox formControlName="createAutomationUser" class="full-width">
  <span [transloco]="'admin.webhooks.addDialog.createAutomationUser'">
    Create automation user for this webhook
  </span>
</mat-checkbox>
```

Form update in `ngOnInit()`:

```typescript
this.form = this.fb.group({
  name: ['', Validators.required],
  url: ['', [Validators.required, Validators.pattern(/^https:\/\/.+/)]],
  events: [[], Validators.required],
  secret: [''],
  createAutomationUser: [false],
});
```

Update `onSave()` to include the flag in the close value:

```typescript
// Change this line in the next handler:
this.dialogRef.close(webhook);
// To:
this.dialogRef.close({
  webhook,
  createAutomationUser: this.form.value.createAutomationUser as boolean,
});
```

`MatCheckboxModule` is already included via `FORM_MATERIAL_IMPORTS`, which the webhook dialog already imports. No additional import needed.

- [ ] **Step 2: Create CreateAutomationUserDialog**

Create `src/app/pages/admin/webhooks/create-automation-user-dialog/create-automation-user-dialog.component.ts`:

```typescript
import { Component, DestroyRef, Inject, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { CreateAutomationAccountResponse } from '@app/types/user.types';
import { getErrorMessage } from '@app/shared/utils/http-error.utils';

export interface CreateAutomationUserDialogData {
  webhookName: string;
}

@Component({
  selector: 'app-create-automation-user-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'admin.webhooks.createAutomationUser.title'">
      Create Automation User
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="automation-user-form">
        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.webhooks.createAutomationUser.name'">
            Name
          </mat-label>
          <input
            matInput
            formControlName="name"
            required
            maxlength="64"
          />
          <mat-hint [transloco]="'admin.webhooks.createAutomationUser.nameHint'">
            2-64 characters, starts with letter
          </mat-hint>
          @if (form.get('name')?.hasError('required')) {
            <mat-error>
              <span [transloco]="'common.validation.required'">Required</span>
            </mat-error>
          }
          @if (form.get('name')?.hasError('pattern')) {
            <mat-error>
              <span [transloco]="'admin.webhooks.createAutomationUser.namePatternError'">
                Must start with a letter and end with a letter or digit
              </span>
            </mat-error>
          }
          @if (form.get('name')?.hasError('minlength')) {
            <mat-error>
              <span [transloco]="'admin.webhooks.createAutomationUser.nameTooShort'">
                Must be at least 2 characters
              </span>
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.webhooks.createAutomationUser.email'">
            Email
          </mat-label>
          <input
            matInput
            formControlName="email"
            type="email"
          />
          <mat-hint [transloco]="'admin.webhooks.createAutomationUser.emailHint'">
            Optional — defaults to auto-generated @tmi.local address
          </mat-hint>
        </mat-form-field>

        @if (errorMessage) {
          <mat-error class="form-error">
            {{ errorMessage }}
          </mat-error>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="onCreateUser()"
        [disabled]="!form.valid || saving"
      >
        @if (saving) {
          <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
        }
        <span [transloco]="'admin.webhooks.createAutomationUser.create'">
          Create User
        </span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .automation-user-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 400px;
        padding: 16px 0;
      }

      .full-width {
        width: 100%;
      }

      .form-error {
        color: var(--theme-error);
        font-size: 12px;
        margin-top: 8px;
      }

      .button-spinner {
        display: inline-block;
        margin-right: 8px;
      }

      mat-dialog-actions {
        padding: 16px 24px 16px 0;
        margin: 0;
      }
    `,
  ],
})
export class CreateAutomationUserDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  saving = false;
  errorMessage = '';

  constructor(
    private dialogRef: MatDialogRef<CreateAutomationUserDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CreateAutomationUserDialogData,
    private userAdminService: UserAdminService,
    private fb: FormBuilder,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    const processedEmail = this.processWebhookNameForEmail(this.data.webhookName);

    this.form = this.fb.group({
      name: [
        this.data.webhookName,
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(64),
          Validators.pattern(/^[a-zA-Z][a-zA-Z0-9 _.@-]*[a-zA-Z0-9]$/),
        ],
      ],
      email: [processedEmail ? `${processedEmail}@tmi.local` : ''],
    });
  }

  /** Convert webhook name to a valid email local part */
  private processWebhookNameForEmail(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  onCreateUser(): void {
    if (this.form.valid && !this.saving) {
      this.saving = true;
      this.errorMessage = '';

      const formValue = this.form.value as { name: string; email: string };
      const request = {
        name: formValue.name.trim(),
        ...(formValue.email && { email: formValue.email.trim() }),
      };

      this.userAdminService
        .createAutomationUser(request)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response: CreateAutomationAccountResponse) => {
            this.dialogRef.close(response);
          },
          error: error => {
            this.logger.error('Failed to create automation user', error);
            this.errorMessage = getErrorMessage(
              error,
              'Failed to create automation user. Please try again.',
            );
            this.saving = false;
          },
        });
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
```

- [ ] **Step 3: Update admin-webhooks.component.ts to handle the new dialog flow**

```typescript
// Add imports:
import { UserAdminService } from '@app/core/services/user-admin.service';
import {
  CreateAutomationUserDialogComponent,
  CreateAutomationUserDialogData,
} from './create-automation-user-dialog/create-automation-user-dialog.component';
import {
  CredentialSecretDialogComponent,
  CredentialSecretDialogData,
} from '@app/core/components/user-preferences-dialog/credential-secret-dialog/credential-secret-dialog.component';
import { CreateAutomationAccountResponse } from '@app/types/user.types';

// Add to constructor:
private userAdminService: UserAdminService,

// Update onAddWebhook():
onAddWebhook(): void {
  const dialogRef = this.dialog.open(AddWebhookDialogComponent, {
    width: '700px',
    disableClose: false,
  });

  dialogRef
    .afterClosed()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(
      (result: { webhook: WebhookSubscription; createAutomationUser: boolean } | undefined) => {
        if (!result) return;

        this.loadWebhooks();

        // Show HMAC secret dialog if secret was returned
        if (result.webhook.secret) {
          this.showHmacSecretDialog(result.webhook.secret);
        }

        // If user opted to create automation user, open that dialog
        if (result.createAutomationUser) {
          this.openCreateAutomationUserDialog(result.webhook.name);
        }
      },
    );
}

private openCreateAutomationUserDialog(webhookName: string): void {
  const dialogData: CreateAutomationUserDialogData = { webhookName };
  const dialogRef = this.dialog.open(CreateAutomationUserDialogComponent, {
    width: '500px',
    disableClose: false,
    data: dialogData,
  });

  dialogRef
    .afterClosed()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe((result: CreateAutomationAccountResponse | null) => {
      if (result) {
        const secretData: CredentialSecretDialogData = {
          clientId: result.client_credential.client_id,
          clientSecret: result.client_credential.client_secret,
        };
        this.dialog.open(CredentialSecretDialogComponent, {
          width: '600px',
          disableClose: true,
          data: secretData,
        });
      }
    });
}
```

- [ ] **Step 4: Build**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 5: Run tests**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/admin/webhooks/
git commit -m "feat: add automation user creation to webhook dialog (#524)"
```

---

## Task 7: Add Localization Keys

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Check which keys already exist**

Run:
```bash
grep -c '"admin.users.filter\|"admin.users.actions\|"admin.users.manageCredentials\|"admin.webhooks.addDialog.createAutomation\|"admin.webhooks.createAutomationUser\|"common.never\|"common.delete\|"common.close\|"common.done\|"common.validation.required' src/assets/i18n/en-US.json
```

Identify which keys already exist and only add the missing ones.

- [ ] **Step 2: Add missing locale keys**

Use the `update_json_localization_file` skill to add only the new keys to `src/assets/i18n/en-US.json`. The exact set of keys to add depends on Step 1 results, but the candidates are:

```json
{
  "admin.users.filter.automationOnly": "Show automation accounts only",
  "admin.users.actions.manageCredentials": "Manage Credentials",
  "admin.users.manageCredentials.title": "Manage Credentials for {{name}}",
  "admin.users.manageCredentials.addCredential": "Add Credential",
  "admin.users.manageCredentials.deleteConfirm": "Delete credential \"{{name}}\"?",
  "admin.users.manageCredentials.noCredentials": "No credentials found",
  "admin.users.manageCredentials.columns.name": "Name",
  "admin.users.manageCredentials.columns.clientId": "Client ID",
  "admin.users.manageCredentials.columns.createdAt": "Created",
  "admin.users.manageCredentials.columns.expiresAt": "Expires",
  "admin.webhooks.addDialog.createAutomationUser": "Create automation user for this webhook",
  "admin.webhooks.createAutomationUser.title": "Create Automation User",
  "admin.webhooks.createAutomationUser.name": "Name",
  "admin.webhooks.createAutomationUser.email": "Email",
  "admin.webhooks.createAutomationUser.nameHint": "2-64 characters, starts with letter",
  "admin.webhooks.createAutomationUser.namePatternError": "Must start with a letter and end with a letter or digit",
  "admin.webhooks.createAutomationUser.nameTooShort": "Must be at least 2 characters",
  "admin.webhooks.createAutomationUser.emailHint": "Optional — defaults to auto-generated @tmi.local address",
  "admin.webhooks.createAutomationUser.create": "Create User"
}
```

- [ ] **Step 3: Build and test**

Run: `pnpm run build && pnpm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "feat: add localization keys for automation user and credential management (#524, #526)"
```

---

## Task 8: Lint, Build, Final Test

- [ ] **Step 1: Lint**

Run: `pnpm run lint:all`
Expected: PASS (fix any issues)

- [ ] **Step 2: Build**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 3: Full test suite**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 4: Commit any lint fixes**

If lint produced auto-fixes:
```bash
git add -A
git commit -m "style: fix lint issues from automation credential features"
```

---

## Task 9: Localization Backfill

- [ ] **Step 1: Run localization backfill**

Use the `localization-backfill` skill to backfill the new English keys to all other language files.

- [ ] **Step 2: Commit**

```bash
git add src/assets/i18n/
git commit -m "chore: backfill localization for automation credential features (#524, #526)"
```

---

## Task 10: Comment on Issues and Close

- [ ] **Step 1: Comment on issue #524 with the commit references**

```bash
gh issue comment 524 --repo ericfitz/tmi-ux --body "Implemented in commits on release/1.3.0 branch."
```

- [ ] **Step 2: Close issue #524**

```bash
gh issue close 524 --repo ericfitz/tmi-ux --reason completed
```

- [ ] **Step 3: Comment on issue #526 with the commit references**

```bash
gh issue comment 526 --repo ericfitz/tmi-ux --body "Implemented in commits on release/1.3.0 branch."
```

- [ ] **Step 4: Close issue #526**

```bash
gh issue close 526 --repo ericfitz/tmi-ux --reason completed
```
