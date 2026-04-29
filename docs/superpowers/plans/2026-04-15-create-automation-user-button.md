# Create Automation User Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone "Create Automation User" button to the admin users page, decoupling automation user creation from the webhook flow.

**Architecture:** Move the existing `CreateAutomationUserDialogComponent` from the webhooks folder to a shared admin location, generalize it to accept an optional suggested name (instead of requiring a webhook name), add a button to the admin users page header that opens the dialog and shows credentials on success. Relocate i18n keys to a neutral `admin.createAutomationUserDialog` namespace.

**Tech Stack:** Angular 19, Angular Material, Transloco i18n, Vitest

**Spec:** `docs/superpowers/specs/2026-04-15-create-automation-user-button-design.md`

---

### Task 1: Move and Generalize the Dialog Component

Move the dialog from webhooks to shared admin location and generalize its interface.

**Files:**
- Create: `src/app/pages/admin/shared/create-automation-user-dialog/create-automation-user-dialog.component.ts` (moved + modified)
- Delete: `src/app/pages/admin/webhooks/create-automation-user-dialog/create-automation-user-dialog.component.ts`

- [ ] **Step 1: Create the shared directory and copy the file**

```bash
mkdir -p src/app/pages/admin/shared/create-automation-user-dialog
cp src/app/pages/admin/webhooks/create-automation-user-dialog/create-automation-user-dialog.component.ts \
   src/app/pages/admin/shared/create-automation-user-dialog/create-automation-user-dialog.component.ts
```

- [ ] **Step 2: Generalize the dialog interface and logic**

In `src/app/pages/admin/shared/create-automation-user-dialog/create-automation-user-dialog.component.ts`:

Replace the `CreateAutomationUserDialogData` interface:

```typescript
// Old
export interface CreateAutomationUserDialogData {
  webhookName: string;
}

// New
export interface CreateAutomationUserDialogData {
  suggestedName?: string;
}
```

Replace the JSDoc comment:

```typescript
// Old
/**
 * Create Automation User Dialog Component
 *
 * Dialog for creating an automation (machine) user account
 * associated with a webhook subscription.
 */

// New
/**
 * Create Automation User Dialog Component
 *
 * Dialog for creating an automation (machine) user account.
 */
```

Replace the `ngOnInit` method:

```typescript
// Old
ngOnInit(): void {
  const webhookName = this.data.webhookName;
  const generatedEmail = this.generateEmail(webhookName);

  this.form = this.fb.group({
    name: [
      webhookName,
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(64),
        Validators.pattern(/^[a-zA-Z][a-zA-Z0-9 _.@-]*[a-zA-Z0-9]$/),
      ],
    ],
    email: [generatedEmail],
  });
}

// New
ngOnInit(): void {
  const suggestedName = this.data?.suggestedName || '';
  const generatedEmail = suggestedName ? this.generateEmail(suggestedName) : '';

  this.form = this.fb.group({
    name: [
      suggestedName,
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(64),
        Validators.pattern(/^[a-zA-Z][a-zA-Z0-9 _.@-]*[a-zA-Z0-9]$/),
      ],
    ],
    email: [generatedEmail],
  });
}
```

- [ ] **Step 3: Update i18n key references in the dialog template**

In the same file, replace all occurrences of `admin.webhooks.createAutomationUserDialog` with `admin.createAutomationUserDialog` in transloco attributes. There are 12 references in the template:

```
admin.webhooks.createAutomationUserDialog.title     → admin.createAutomationUserDialog.title
admin.webhooks.createAutomationUserDialog.name      → admin.createAutomationUserDialog.name
admin.webhooks.createAutomationUserDialog.namePlaceholder → admin.createAutomationUserDialog.namePlaceholder
admin.webhooks.createAutomationUserDialog.nameHint  → admin.createAutomationUserDialog.nameHint
admin.webhooks.createAutomationUserDialog.nameRequired → admin.createAutomationUserDialog.nameRequired
admin.webhooks.createAutomationUserDialog.nameMinLength → admin.createAutomationUserDialog.nameMinLength
admin.webhooks.createAutomationUserDialog.nameMaxLength → admin.createAutomationUserDialog.nameMaxLength
admin.webhooks.createAutomationUserDialog.namePattern → admin.createAutomationUserDialog.namePattern
admin.webhooks.createAutomationUserDialog.email     → admin.createAutomationUserDialog.email
admin.webhooks.createAutomationUserDialog.emailPlaceholder → admin.createAutomationUserDialog.emailPlaceholder
admin.webhooks.createAutomationUserDialog.emailHint → admin.createAutomationUserDialog.emailHint
admin.webhooks.createAutomationUserDialog.save      → admin.createAutomationUserDialog.save
```

- [ ] **Step 4: Delete the old dialog file**

```bash
rm src/app/pages/admin/webhooks/create-automation-user-dialog/create-automation-user-dialog.component.ts
rmdir src/app/pages/admin/webhooks/create-automation-user-dialog
```

- [ ] **Step 5: Commit**

```bash
git add -A src/app/pages/admin/shared/create-automation-user-dialog/ \
  src/app/pages/admin/webhooks/create-automation-user-dialog/
git commit -m "refactor: move CreateAutomationUserDialog to shared admin location

Generalize interface from webhookName to optional suggestedName.
Update i18n key references to neutral admin namespace.
Part of #598."
```

---

### Task 2: Relocate Localization Keys

Move `createAutomationUserDialog` keys from `admin.webhooks` to `admin` namespace in all 16 language files.

**Files:**
- Modify: `src/assets/i18n/en-US.json`
- Modify: `src/assets/i18n/ar-SA.json`
- Modify: `src/assets/i18n/bn-BD.json`
- Modify: `src/assets/i18n/de-DE.json`
- Modify: `src/assets/i18n/es-ES.json`
- Modify: `src/assets/i18n/fr-FR.json`
- Modify: `src/assets/i18n/he-IL.json`
- Modify: `src/assets/i18n/hi-IN.json`
- Modify: `src/assets/i18n/id-ID.json`
- Modify: `src/assets/i18n/ja-JP.json`
- Modify: `src/assets/i18n/ko-KR.json`
- Modify: `src/assets/i18n/pt-BR.json`
- Modify: `src/assets/i18n/ru-RU.json`
- Modify: `src/assets/i18n/th-TH.json`
- Modify: `src/assets/i18n/ur-PK.json`
- Modify: `src/assets/i18n/zh-CN.json`

- [ ] **Step 1: In each of the 16 language files, perform these changes:**

**a)** Remove the `createAutomationUserDialog` object from inside `admin.webhooks`:

Find the `"createAutomationUserDialog": { ... }` block nested under `"webhooks"` and remove it entirely (including the trailing comma if needed to keep JSON valid).

**b)** Add the same block as a direct child of `"admin"`, at the same level as `"webhooks"`, `"users"`, `"groups"`, etc.

**c)** In en-US.json specifically, fix the self-referencing `title` key:

```json
// Old (under admin.webhooks.createAutomationUserDialog)
"title": "{{admin.webhooks.createAutomationUserDialog.save}}"

// New (under admin.createAutomationUserDialog)
"title": "{{admin.createAutomationUserDialog.save}}"
```

In all non-en-US files, check if the `title` key uses the same transloco reference pattern and update similarly. If a non-en-US file has a literal translated title string instead, leave it as-is.

**d)** Also add a new button label key under `admin.users`:

```json
"admin": {
  "users": {
    ...existing keys...,
    "createAutomationUser": "Create Automation User"
  }
}
```

This key needs localized values in each language file. Use the same translation as the dialog's `save` key for that language, since they carry the same meaning.

- [ ] **Step 2: Verify JSON validity**

```bash
for f in src/assets/i18n/*.json; do python3 -m json.tool "$f" > /dev/null && echo "OK: $f" || echo "FAIL: $f"; done
```

Expected: all OK.

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/
git commit -m "refactor(i18n): move createAutomationUserDialog keys to admin namespace

Relocate from admin.webhooks.createAutomationUserDialog to
admin.createAutomationUserDialog across all 16 language files.
Add admin.users.createAutomationUser button label.
Part of #598."
```

---

### Task 3: Update Webhooks Component

Update the webhooks component to use the relocated dialog and new interface.

**Files:**
- Modify: `src/app/pages/admin/webhooks/admin-webhooks.component.ts`

- [ ] **Step 1: Update the import path**

```typescript
// Old (lines 23-26)
import {
  CreateAutomationUserDialogComponent,
  CreateAutomationUserDialogData,
} from './create-automation-user-dialog/create-automation-user-dialog.component';

// New
import {
  CreateAutomationUserDialogComponent,
  CreateAutomationUserDialogData,
} from '../shared/create-automation-user-dialog/create-automation-user-dialog.component';
```

- [ ] **Step 2: Update the dialog data construction**

In the `openCreateAutomationUserDialog` method (around line 248):

```typescript
// Old
private openCreateAutomationUserDialog(webhookName: string): void {
  const dialogData: CreateAutomationUserDialogData = { webhookName };

// New
private openCreateAutomationUserDialog(webhookName: string): void {
  const dialogData: CreateAutomationUserDialogData = { suggestedName: webhookName };
```

- [ ] **Step 3: Build to verify no broken imports**

```bash
pnpm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/admin/webhooks/admin-webhooks.component.ts
git commit -m "refactor: update webhooks to use shared CreateAutomationUserDialog

Update import path and dialog data to match generalized interface.
Part of #598."
```

---

### Task 4: Write Failing Test for Admin Users Create Button

Write a test for the new `onCreateAutomationUser` method before implementing it.

**Files:**
- Create: `src/app/pages/admin/users/admin-users.component.spec.ts`

- [ ] **Step 1: Write the test file**

The test should verify:
1. The `onCreateAutomationUser` method opens `CreateAutomationUserDialogComponent`
2. When the dialog returns a result, `CredentialSecretDialogComponent` is opened with the correct data
3. After the credential dialog closes, `loadUsers()` is called to refresh the table
4. When the dialog is cancelled (returns null), no credential dialog opens and no reload happens

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminUsersComponent } from './admin-users.component';
import { of, EMPTY, Subject } from 'rxjs';
import { CreateAutomationAccountResponse } from '@app/types/user.types';

describe('AdminUsersComponent', () => {
  describe('onCreateAutomationUser', () => {
    let component: AdminUsersComponent;
    let mockDialog: { open: ReturnType<typeof vi.fn> };
    let mockUserAdminService: { list: ReturnType<typeof vi.fn>; createAutomationUser: ReturnType<typeof vi.fn> };
    let mockRouter: { navigate: ReturnType<typeof vi.fn> };
    let mockRoute: { queryParams: typeof EMPTY };
    let mockLogger: {
      info: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      debug: ReturnType<typeof vi.fn>;
      debugComponent: ReturnType<typeof vi.fn>;
    };
    let mockAuthService: { getAvailableProviders: ReturnType<typeof vi.fn>; isAdmin: boolean };
    let mockSnackBar: { open: ReturnType<typeof vi.fn> };
    let mockTransloco: { translate: ReturnType<typeof vi.fn> };
    let mockLanguageService: { currentLanguage$: typeof EMPTY };

    beforeEach(() => {
      mockDialog = { open: vi.fn() };
      mockUserAdminService = {
        list: vi.fn().mockReturnValue(of({ users: [], total: 0 })),
        createAutomationUser: vi.fn(),
      };
      mockRouter = { navigate: vi.fn().mockResolvedValue(true) };
      mockRoute = { queryParams: EMPTY };
      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        debugComponent: vi.fn(),
      };
      mockAuthService = {
        getAvailableProviders: vi.fn().mockReturnValue(of([])),
        isAdmin: true,
      };
      mockSnackBar = { open: vi.fn() };
      mockTransloco = { translate: vi.fn().mockImplementation((key: string) => key) };
      mockLanguageService = { currentLanguage$: of({ code: 'en-US', name: 'English' }) };

      component = new AdminUsersComponent(
        mockUserAdminService as never,
        mockRouter as never,
        mockRoute as never,
        mockLogger as never,
        mockAuthService as never,
        mockDialog as never,
        mockSnackBar as never,
        mockTransloco as never,
        mockLanguageService as never,
      );
    });

    it('should open CreateAutomationUserDialogComponent with no suggested name', () => {
      const afterClosedSubject = new Subject<null>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });

      component.onCreateAutomationUser();

      expect(mockDialog.open).toHaveBeenCalledTimes(1);
      const [dialogComponent, config] = mockDialog.open.mock.calls[0];
      expect(dialogComponent.name).toBe('CreateAutomationUserDialogComponent');
      expect(config.width).toBe('500px');
      expect(config.data).toEqual({});
    });

    it('should open CredentialSecretDialogComponent when automation user is created', () => {
      const mockResponse: CreateAutomationAccountResponse = {
        user: {
          internal_uuid: 'test-uuid',
          provider: 'tmi',
          provider_user_id: 'test',
          email: 'test@tmi.local',
          name: 'test-bot',
          is_admin: false,
          automation: true,
        },
        client_credential: {
          id: 'cred-id',
          client_id: 'client-123',
          client_secret: 'secret-456',
          name: 'test-bot',
          created_at: '2026-04-15T00:00:00Z',
        },
      };

      const credDialogAfterClosed = new Subject<void>();
      mockDialog.open
        .mockReturnValueOnce({ afterClosed: () => of(mockResponse) })
        .mockReturnValueOnce({ afterClosed: () => credDialogAfterClosed.asObservable() });

      component.onCreateAutomationUser();

      expect(mockDialog.open).toHaveBeenCalledTimes(2);
      const [credComponent, credConfig] = mockDialog.open.mock.calls[1];
      expect(credComponent.name).toBe('CredentialSecretDialogComponent');
      expect(credConfig.data).toEqual({
        clientId: 'client-123',
        clientSecret: 'secret-456',
      });
      expect(credConfig.disableClose).toBe(true);
    });

    it('should reload users after credential dialog closes', () => {
      const mockResponse: CreateAutomationAccountResponse = {
        user: {
          internal_uuid: 'test-uuid',
          provider: 'tmi',
          provider_user_id: 'test',
          email: 'test@tmi.local',
          name: 'test-bot',
          is_admin: false,
          automation: true,
        },
        client_credential: {
          id: 'cred-id',
          client_id: 'client-123',
          client_secret: 'secret-456',
          name: 'test-bot',
          created_at: '2026-04-15T00:00:00Z',
        },
      };

      mockDialog.open
        .mockReturnValueOnce({ afterClosed: () => of(mockResponse) })
        .mockReturnValueOnce({ afterClosed: () => of(undefined) });

      const listSpy = mockUserAdminService.list.mockReturnValue(of({ users: [], total: 0 }));

      component.onCreateAutomationUser();

      // loadUsers is called during init + once after credential dialog closes
      expect(listSpy).toHaveBeenCalled();
    });

    it('should not open credential dialog when creation dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(null) });

      component.onCreateAutomationUser();

      expect(mockDialog.open).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/app/pages/admin/users/admin-users.component.spec.ts
```

Expected: FAIL — `onCreateAutomationUser` is not a function.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/app/pages/admin/users/admin-users.component.spec.ts
git commit -m "test: add failing tests for onCreateAutomationUser method

Tests verify dialog opening, credential display, reload, and cancel.
Part of #598."
```

---

### Task 5: Implement the Admin Users Create Button

Add the button to the template and the handler to the component.

**Files:**
- Modify: `src/app/pages/admin/users/admin-users.component.html`
- Modify: `src/app/pages/admin/users/admin-users.component.ts`

- [ ] **Step 1: Add the button to the template**

In `src/app/pages/admin/users/admin-users.component.html`, add the button inside the `action-buttons` div, before the close button (between lines 7 and 8):

```html
    <div class="action-buttons">
      <button mat-raised-button color="primary" (click)="onCreateAutomationUser()">
        <mat-icon>add</mat-icon>
        <span [transloco]="'admin.users.createAutomationUser'">Create Automation User</span>
      </button>
      <button mat-icon-button (click)="onClose()" [attr.aria-label]="'common.close' | transloco">
        <mat-icon>close</mat-icon>
      </button>
    </div>
```

- [ ] **Step 2: Add imports to the component**

In `src/app/pages/admin/users/admin-users.component.ts`, add these imports:

```typescript
import {
  CreateAutomationUserDialogComponent,
  CreateAutomationUserDialogData,
} from '../shared/create-automation-user-dialog/create-automation-user-dialog.component';
import {
  CredentialSecretDialogComponent,
  CredentialSecretDialogData,
} from '@app/core/components/user-preferences-dialog/credential-secret-dialog/credential-secret-dialog.component';
import { CreateAutomationAccountResponse } from '@app/types/user.types';
```

Note: `CreateAutomationAccountResponse` may already be exported from `@app/types/user.types` — check that `AdminUser` import on line 22 can be extended to include it.

- [ ] **Step 3: Add the `onCreateAutomationUser` method**

Add this method to the `AdminUsersComponent` class, after the `onManageCredentials` method (after line 231):

```typescript
onCreateAutomationUser(): void {
  const dialogData: CreateAutomationUserDialogData = {};
  const dialogRef = this.dialog.open(CreateAutomationUserDialogComponent, {
    width: '500px',
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
        const credDialogRef = this.dialog.open(CredentialSecretDialogComponent, {
          width: '600px',
          disableClose: true,
          data: secretData,
        });

        credDialogRef
          .afterClosed()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => {
            this.loadUsers();
          });
      }
    });
}
```

- [ ] **Step 4: Run the tests**

```bash
pnpm vitest run src/app/pages/admin/users/admin-users.component.spec.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/users/admin-users.component.html \
  src/app/pages/admin/users/admin-users.component.ts
git commit -m "feat: add create automation user button to admin users page

Opens the shared CreateAutomationUserDialog, shows credentials on
success, and reloads the user list.
Closes #598."
```

---

### Task 6: Build, Lint, and Full Test

Run the complete validation suite.

**Files:** None (validation only)

- [ ] **Step 1: Lint**

```bash
pnpm run lint:all
```

Expected: no errors. Fix any that appear.

- [ ] **Step 2: Build**

```bash
pnpm run build
```

Expected: build succeeds. Fix any compilation errors.

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: all tests pass, including the new admin-users spec.

- [ ] **Step 4: Fix any issues found and commit fixes if needed**

If lint/build/test produced fixable issues, fix them and commit:

```bash
git add -A
git commit -m "fix: address lint/build/test issues from #598 implementation"
```
