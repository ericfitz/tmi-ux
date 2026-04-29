# TMI Provider Login Hint Dialog Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When clicking "Sign in with TMI Provider", show a dialog where the user can optionally enter a username (letters/digits, 3-20 chars) that gets passed as `login_hint` to the OAuth authorize URL.

**Architecture:** A new `TmiLoginDialogComponent` opens via `MatDialog` from the login page. The dialog returns the entered username (or empty string). The login hint flows through query params to auth-callback, then into `AuthService.initiateLogin()`, which appends `&login_hint=<value>` to the OAuth authorize URL when provided.

**Tech Stack:** Angular standalone component, Angular Material Dialog, Reactive Forms, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/auth/components/login/tmi-login-dialog.component.ts` | Create | Dialog component with form, validation, template, and styles |
| `src/app/auth/components/login/login.component.ts` | Modify | Open dialog on TMI button click instead of navigating directly |
| `src/app/auth/components/login/login.component.spec.ts` | Modify | Add tests for dialog integration |
| `src/app/auth/components/login/tmi-login-dialog.component.spec.ts` | Create | Unit tests for dialog component |
| `src/app/auth/components/auth-callback/auth-callback.component.ts` | Modify | Thread `loginHint` query param to `initiateLogin` |
| `src/app/auth/components/auth-callback/auth-callback.component.spec.ts` | Modify | Add tests for `loginHint` passthrough |
| `src/app/auth/services/auth.service.ts` | Modify | Accept `loginHint` param, append to OAuth URL |
| `src/assets/i18n/en-US.json` | Modify | Add i18n keys for dialog |

---

## Chunk 1: Dialog Component + Tests

### Task 1: Create the TMI Login Dialog Component

**Files:**
- Create: `src/app/auth/components/login/tmi-login-dialog.component.ts`

The dialog is a single-file standalone component (inline template + styles). It uses `DIALOG_IMPORTS` from `src/app/shared/imports.ts` plus `TranslocoModule`. The dialog data receives the provider name. The dialog result is `{ loginHint: string }` or `undefined` (cancelled).

- [ ] **Step 1: Write the failing test for the dialog component**

Create `src/app/auth/components/login/tmi-login-dialog.component.spec.ts`:

```typescript
import '@angular/compiler';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TmiLoginDialogComponent } from './tmi-login-dialog.component';

describe('TmiLoginDialogComponent', () => {
  let component: TmiLoginDialogComponent;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockData: { providerName: string };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockData = { providerName: 'TMI Provider' };
    component = new TmiLoginDialogComponent(mockDialogRef as any, mockData);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty username', () => {
    expect(component.usernameControl.value).toBe('');
  });

  it('should accept valid alphanumeric username (3-20 chars)', () => {
    component.usernameControl.setValue('testuser1');
    expect(component.usernameControl.valid).toBe(true);
  });

  it('should accept empty username (field is optional)', () => {
    component.usernameControl.setValue('');
    expect(component.usernameControl.valid).toBe(true);
  });

  it('should reject username shorter than 3 chars', () => {
    component.usernameControl.setValue('ab');
    expect(component.usernameControl.valid).toBe(false);
  });

  it('should reject username longer than 20 chars', () => {
    component.usernameControl.setValue('a'.repeat(21));
    expect(component.usernameControl.valid).toBe(false);
  });

  it('should reject username with special characters', () => {
    component.usernameControl.setValue('user@name');
    expect(component.usernameControl.valid).toBe(false);
  });

  it('should reject username with spaces', () => {
    component.usernameControl.setValue('user name');
    expect(component.usernameControl.valid).toBe(false);
  });

  it('should accept username with exactly 3 chars', () => {
    component.usernameControl.setValue('abc');
    expect(component.usernameControl.valid).toBe(true);
  });

  it('should accept username with exactly 20 chars', () => {
    component.usernameControl.setValue('a'.repeat(20));
    expect(component.usernameControl.valid).toBe(true);
  });

  describe('onSignIn', () => {
    it('should close dialog with loginHint when username is valid', () => {
      component.usernameControl.setValue('testuser');
      component.onSignIn();
      expect(mockDialogRef.close).toHaveBeenCalledWith({ loginHint: 'testuser' });
    });

    it('should close dialog with empty loginHint when username is empty', () => {
      component.usernameControl.setValue('');
      component.onSignIn();
      expect(mockDialogRef.close).toHaveBeenCalledWith({ loginHint: '' });
    });

    it('should not close dialog when username is invalid', () => {
      component.usernameControl.setValue('ab');
      component.onSignIn();
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('should mark control as touched when invalid', () => {
      component.usernameControl.setValue('ab');
      component.onSignIn();
      expect(component.usernameControl.touched).toBe(true);
    });
  });

  describe('onCancel', () => {
    it('should close dialog with undefined', () => {
      component.onCancel();
      expect(mockDialogRef.close).toHaveBeenCalledWith(undefined);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm run test src/app/auth/components/login/tmi-login-dialog.component.spec.ts`
Expected: FAIL - cannot find module `./tmi-login-dialog.component`

- [ ] **Step 3: Create the dialog component**

Create `src/app/auth/components/login/tmi-login-dialog.component.ts`:

```typescript
import { Component, Inject } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

import { DIALOG_IMPORTS } from '../../../shared/imports';

export interface TmiLoginDialogData {
  providerName: string;
}

export interface TmiLoginDialogResult {
  loginHint: string;
}

@Component({
  selector: 'app-tmi-login-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, TranslocoModule],
  template: `
    <h2 mat-dialog-title>{{ 'login.tmiDialog.title' | transloco }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ 'login.tmiDialog.usernameLabel' | transloco }}</mat-label>
        <input
          matInput
          [formControl]="usernameControl"
          [placeholder]="'login.tmiDialog.usernamePlaceholder' | transloco"
          autocomplete="username"
          cdkFocusInitial
        />
        @if (usernameControl.hasError('pattern')) {
          <mat-error>{{ 'login.tmiDialog.errorPattern' | transloco }}</mat-error>
        } @else if (usernameControl.hasError('minlength')) {
          <mat-error>{{ 'login.tmiDialog.errorMinLength' | transloco }}</mat-error>
        } @else if (usernameControl.hasError('maxlength')) {
          <mat-error>{{ 'login.tmiDialog.errorMaxLength' | transloco }}</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button mat-flat-button color="primary" (click)="onSignIn()">
        {{ 'login.tmiDialog.signIn' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class TmiLoginDialogComponent {
  usernameControl = new FormControl('', [
    Validators.pattern(/^[a-zA-Z0-9]*$/),
    Validators.minLength(3),
    Validators.maxLength(20),
  ]);

  constructor(
    private _dialogRef: MatDialogRef<TmiLoginDialogComponent, TmiLoginDialogResult | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: TmiLoginDialogData,
  ) {}

  onSignIn(): void {
    if (this.usernameControl.invalid) {
      this.usernameControl.markAsTouched();
      return;
    }
    this._dialogRef.close({ loginHint: this.usernameControl.value || '' });
  }

  onCancel(): void {
    this._dialogRef.close(undefined);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test src/app/auth/components/login/tmi-login-dialog.component.spec.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/components/login/tmi-login-dialog.component.ts src/app/auth/components/login/tmi-login-dialog.component.spec.ts
git commit -m "feat: add TMI login hint dialog component with validation"
```

---

### Task 2: Integrate Dialog into Login Component

**Files:**
- Modify: `src/app/auth/components/login/login.component.ts`
- Modify: `src/app/auth/components/login/login.component.spec.ts`

When `loginWithOAuth` is called with `providerId === 'tmi'`, open the `TmiLoginDialogComponent` instead of navigating immediately. On dialog close, if result is not `undefined` (i.e., not cancelled), navigate to auth-callback with the additional `loginHint` query param.

- [ ] **Step 1: Write the failing tests for dialog integration**

Add to `src/app/auth/components/login/login.component.spec.ts`:

The test file needs a `mockDialog` added to the setup. The component constructor needs `MatDialog` injected. Add these tests:

```typescript
// In the describe('loginWithOAuth') block, add:

it('should open TMI login dialog when provider is tmi', () => {
  component.loginWithOAuth('tmi');
  expect(mockDialog.open).toHaveBeenCalled();
});

it('should navigate with loginHint when dialog returns a value', () => {
  mockDialog.open.mockReturnValue({
    afterClosed: () => of({ loginHint: 'testuser' }),
  });

  component.loginWithOAuth('tmi');

  expect(mockRouter.navigate).toHaveBeenCalledWith(['/oauth2/callback'], {
    queryParams: expect.objectContaining({
      loginHint: 'testuser',
    }),
  });
});

it('should navigate without loginHint when dialog returns empty string', () => {
  mockDialog.open.mockReturnValue({
    afterClosed: () => of({ loginHint: '' }),
  });

  component.loginWithOAuth('tmi');

  expect(mockRouter.navigate).toHaveBeenCalledWith(['/oauth2/callback'], {
    queryParams: expect.objectContaining({
      providerId: 'tmi',
    }),
  });
  // loginHint should be undefined (omitted) when empty
  const queryParams = mockRouter.navigate.mock.calls[0][1].queryParams;
  expect(queryParams.loginHint).toBeUndefined();
});

it('should not navigate when dialog is cancelled', () => {
  mockDialog.open.mockReturnValue({
    afterClosed: () => of(undefined),
  });

  component.loginWithOAuth('tmi');

  expect(mockRouter.navigate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test src/app/auth/components/login/login.component.spec.ts`
Expected: FAIL - mockDialog not defined / dialog.open not called

- [ ] **Step 3: Update LoginComponent to use dialog for TMI provider**

Modify `src/app/auth/components/login/login.component.ts`:

1. Add `MatDialog` import and inject it in the constructor
2. Import `TmiLoginDialogComponent` and its types
3. In `loginWithOAuth`, when `providerId === 'tmi'`, open the dialog and handle the result

Key changes to `loginWithOAuth`:

```typescript
loginWithOAuth(providerId: string): void {
  const provider = this.oauthProviders.find(p => p.id === providerId);
  if (!provider) return;

  if (providerId === 'tmi') {
    this.openTmiLoginDialog(provider);
    return;
  }

  this.navigateToOAuth(provider);
}

private openTmiLoginDialog(provider: OAuthProviderInfo): void {
  const dialogRef = this.dialog.open(TmiLoginDialogComponent, {
    width: '400px',
    data: { providerName: provider.name },
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result === undefined) return;
    this.navigateToOAuth(provider, result.loginHint || undefined);
  });
}

private navigateToOAuth(provider: OAuthProviderInfo, loginHint?: string): void {
  void this.router.navigate(['/oauth2/callback'], {
    queryParams: {
      action: 'login',
      providerId: provider.id,
      providerName: provider.name,
      providerType: 'oauth',
      returnUrl: this.returnUrl || undefined,
      loginHint: loginHint || undefined,
    },
  });
}
```

Also update the test setup to add `mockDialog` and pass it to the constructor.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test src/app/auth/components/login/login.component.spec.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/components/login/login.component.ts src/app/auth/components/login/login.component.spec.ts
git commit -m "feat: open TMI login dialog on TMI provider button click"
```

---

## Chunk 2: Thread login_hint Through Auth Flow

### Task 3: Thread loginHint Through Auth Callback

**Files:**
- Modify: `src/app/auth/components/auth-callback/auth-callback.component.ts`
- Modify: `src/app/auth/components/auth-callback/auth-callback.component.spec.ts`

The auth-callback component reads `loginHint` from query params and passes it to `AuthService.initiateLogin`.

- [ ] **Step 1: Write the failing tests**

Add to `src/app/auth/components/auth-callback/auth-callback.component.spec.ts`, in the `Mode 1: Initiating OAuth Login` describe block:

```typescript
it('should pass loginHint to initiateLogin when provided', () => {
  queryParamsSubject.next({
    action: 'login',
    providerId: 'tmi',
    providerName: 'TMI Provider',
    providerType: 'oauth',
    returnUrl: '/dashboard',
    loginHint: 'testuser',
  });

  component = createComponent();
  component.ngOnInit();

  expect(mockAuthService.initiateLogin).toHaveBeenCalledWith(
    'tmi',
    '/dashboard',
    'testuser',
  );
});

it('should pass undefined loginHint when not provided', () => {
  queryParamsSubject.next({
    action: 'login',
    providerId: 'google',
    providerName: 'Google',
    providerType: 'oauth',
  });

  component = createComponent();
  component.ngOnInit();

  expect(mockAuthService.initiateLogin).toHaveBeenCalledWith(
    'google',
    undefined,
    undefined,
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test src/app/auth/components/auth-callback/auth-callback.component.spec.ts`
Expected: FAIL - initiateLogin called with 2 args, not 3

- [ ] **Step 3: Update existing test assertions for 3-arg `initiateLogin`**

Vitest's `toHaveBeenCalledWith` performs exact arity matching. After this change, `initiateLogin` is called with 3 args (the third being `undefined` when no `loginHint` is present). Update all existing assertions in the spec file:

- `expect(mockAuthService.initiateLogin).toHaveBeenCalledWith('google', '/dashboard')` → `expect(mockAuthService.initiateLogin).toHaveBeenCalledWith('google', '/dashboard', undefined)`
- `expect(mockAuthService.initiateLogin).toHaveBeenCalledWith('google', undefined)` → `expect(mockAuthService.initiateLogin).toHaveBeenCalledWith('google', undefined, undefined)`

- [ ] **Step 4: Update auth-callback to pass loginHint**

Modify `src/app/auth/components/auth-callback/auth-callback.component.ts`:

In `ngOnInit`, read `loginHint` from query params and pass to `initiateLogin`:

```typescript
const loginHint = queryParams['loginHint'] as string | undefined;

// In Mode 1 block:
if (action === 'login' && providerId && providerType) {
  this.initiateLogin(providerId, providerType, returnUrl, loginHint);
  return;
}
```

Update `initiateLogin` method signature:

```typescript
private initiateLogin(
  providerId: string,
  providerType: 'oauth' | 'saml',
  returnUrl?: string,
  loginHint?: string,
): void {
  if (providerType === 'saml') {
    this.authService.initiateSAMLLogin(providerId, returnUrl);
  } else {
    this.authService.initiateLogin(providerId, returnUrl, loginHint);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm run test src/app/auth/components/auth-callback/auth-callback.component.spec.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/auth/components/auth-callback/auth-callback.component.ts src/app/auth/components/auth-callback/auth-callback.component.spec.ts
git commit -m "feat: thread loginHint through auth callback to auth service"
```

---

### Task 4: Add login_hint to OAuth Authorize URL

**Files:**
- Modify: `src/app/auth/services/auth.service.ts`

`initiateLogin` and `initiateTMIOAuthLogin` accept an optional `loginHint` parameter. When provided, it is appended as `&login_hint=<encoded-value>` (using `encodeURIComponent`) to the OAuth authorize URL.

Note: The auth service test file is large and uses TestBed. The new `loginHint` parameter is optional and backward-compatible, so existing auth service tests should still pass without modification. The actual `login_hint` URL parameter will be verified via integration/manual testing since `initiateTMIOAuthLogin` sets `window.location.href` directly. (This is distinct from the auth-callback tests updated in Task 3, which needed assertion changes because the call site changed.)

- [ ] **Step 1: Update `initiateLogin` to accept `loginHint`**

In `src/app/auth/services/auth.service.ts`, modify the `initiateLogin` method at line ~627:

```typescript
initiateLogin(providerId?: string, returnUrl?: string, loginHint?: string): void {
  // ... existing provider discovery logic ...
  void this.initiateTMIOAuthLogin(provider, returnUrl, loginHint);
  // ...
}
```

- [ ] **Step 2: Update `initiateTMIOAuthLogin` to append login_hint**

Modify the method at line ~738:

```typescript
private async initiateTMIOAuthLogin(
  provider: OAuthProviderInfo,
  returnUrl?: string,
  loginHint?: string,
): Promise<void> {
  // ... existing PKCE + URL construction ...

  const authUrl =
    `${provider.auth_url}${separator}` +
    `state=${state}` +
    `&client_callback=${encodeURIComponent(clientCallbackUrl)}` +
    `&scope=${scope}` +
    `&code_challenge=${encodeURIComponent(pkceParams.codeChallenge)}` +
    `&code_challenge_method=${pkceParams.codeChallengeMethod}` +
    (loginHint ? `&login_hint=${encodeURIComponent(loginHint)}` : '');

  window.location.href = authUrl;
  // ...
}
```

- [ ] **Step 3: Run existing auth service tests to ensure no regressions**

Run: `pnpm run test src/app/auth/services/auth.service.spec.ts`
Expected: All existing tests PASS (the new optional parameter is backward-compatible)

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/services/auth.service.ts
git commit -m "feat: append login_hint to OAuth authorize URL when provided"
```

---

## Chunk 3: Localization

### Task 5: Add i18n Keys

**Files:**
- Modify: `src/assets/i18n/en-US.json`

Add the following keys under the `login` section:

```json
"tmiDialog": {
  "title": "Sign In with TMI Provider",
  "usernameLabel": "Username",
  "usernamePlaceholder": "Enter username (optional)",
  "signIn": "Sign In",
  "errorPattern": "Username must contain only letters and digits",
  "errorMinLength": "Username must be at least 3 characters",
  "errorMaxLength": "Username must be at most 20 characters"
}
```

- [ ] **Step 1: Add the i18n keys to en-US.json**

Add the `tmiDialog` object inside the `login` object in `src/assets/i18n/en-US.json`, after the existing `login.local` key block.

- [ ] **Step 2: Run the localization backfill**

Use the `/localization-backfill` skill to propagate new keys to all other locale files.

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/
git commit -m "chore: add i18n keys for TMI login hint dialog"
```

---

## Chunk 4: Build, Lint, and Final Verification

### Task 6: Format, Lint, Build, and Test

- [ ] **Step 1: Format**

Run: `pnpm run format`

- [ ] **Step 2: Lint**

Run: `pnpm run lint:all`
Fix any issues.

- [ ] **Step 3: Build**

Run: `pnpm run build`
Fix any build errors.

- [ ] **Step 4: Run all tests**

Run: `pnpm test`
Fix any failures.

- [ ] **Step 5: Commit any formatting/lint fixes**

```bash
git add -A
git commit -m "style: format and lint fixes for TMI login hint dialog"
```

- [ ] **Step 6: Code review**

Use the `superpowers:requesting-code-review` skill to review the implementation.
