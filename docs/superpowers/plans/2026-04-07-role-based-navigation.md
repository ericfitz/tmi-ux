# Role-Based Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-visible 4-button navbar with a role-filtered toolbar + home button menu, so each role sees only their primary navigation.

**Architecture:** The home/logo button becomes a `mat-menu` trigger containing all nav destinations (with disabled state for unauthorized items) plus logout. The center toolbar buttons are filtered by `isAdmin` and `isSecurityReviewer` flags. No new components — this is a template and test change to the existing `NavbarComponent`.

**Tech Stack:** Angular Material `mat-menu`, existing `NavbarComponent`, Transloco i18n

---

### Task 1: Add i18n Keys for New Menu Items

**Files:**
- Modify: `src/assets/i18n/en-US.json:1106-1128` (navbar section)

- [ ] **Step 1: Add new i18n keys to the navbar section**

Add `navbar.menu.home` and `navbar.menu.logout` keys. The other menu items reuse existing keys (`navbar.intake`, `navbar.dashboard`, `triage.title`, `navbar.admin`).

In `src/assets/i18n/en-US.json`, inside the `"navbar"` object (after `"home": "Home"`), add a `"menu"` sub-object:

```json
"menu": {
  "home": "Home",
  "logout": "Sign Out"
},
```

This goes after the `"intake": "Intake"` line (line 1119) and before `"logoutButton": "Sign Out"` (line 1120).

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all`
Expected: PASS (no lint errors from JSON changes)

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "chore(i18n): add navbar menu i18n keys for home and logout"
```

---

### Task 2: Add Home Button Menu to Template

**Files:**
- Modify: `src/app/core/components/navbar/navbar.component.html:4-17` (home button section)

- [ ] **Step 1: Write the failing test — home menu renders for authenticated users**

In `src/app/core/components/navbar/navbar.component.spec.ts`, add a new `describe` block after the existing `describe('ngOnDestroy', ...)` block (after line 437):

```typescript
describe('home menu items', () => {
  it('should have logout method that calls authService.logout', () => {
    component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
  });
});
```

Note: The existing `logout` test already covers this, but this test validates the menu's logout action uses the same method. We'll add more substantive tests in Task 4.

- [ ] **Step 2: Run test to verify it passes (this is a sanity check)**

Run: `pnpm run test src/app/core/components/navbar/navbar.component.spec.ts`
Expected: PASS

- [ ] **Step 3: Replace the home button with a menu trigger**

In `navbar.component.html`, replace lines 4-17 (the current home button) with:

```html
    <div class="navbar-left">
      <!-- Home menu button -->
      @if (isAuthenticated) {
        <button
          mat-icon-button
          [matMenuTriggerFor]="homeMenu"
          class="logo-button home-menu-trigger"
          [matTooltip]="'navbar.home' | transloco"
          matTooltipPosition="below"
        >
          <img
            [src]="logoImageUrl$ | async"
            [alt]="(brandingOrgName$ | async) || 'TMI Logo'"
            class="tmi-logo"
          />
          <mat-icon class="menu-caret">arrow_drop_down</mat-icon>
        </button>

        <mat-menu #homeMenu="matMenu">
          <button mat-menu-item routerLink="/">
            <mat-icon>home</mat-icon>
            <span [transloco]="'navbar.menu.home'">Home</span>
          </button>
          <button mat-menu-item routerLink="/intake">
            <mat-icon>assignment</mat-icon>
            <span [transloco]="'navbar.intake'">Intake</span>
          </button>
          <button mat-menu-item routerLink="/dashboard">
            <mat-icon>dashboard</mat-icon>
            <span [transloco]="'navbar.dashboard'">Dashboard</span>
          </button>
          <button mat-menu-item routerLink="/triage" [disabled]="!isSecurityReviewer">
            <mat-icon>inbox</mat-icon>
            <span [transloco]="'triage.title'">Triage</span>
          </button>
          <button mat-menu-item routerLink="/admin" [disabled]="!isAdmin">
            <mat-icon>admin_panel_settings</mat-icon>
            <span [transloco]="'navbar.admin'">Admin</span>
          </button>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="logout()">
            <mat-icon>logout</mat-icon>
            <span [transloco]="'navbar.menu.logout'">Sign Out</span>
          </button>
        </mat-menu>
      } @else {
        <button
          mat-icon-button
          [routerLink]="homeLink"
          class="logo-button"
          [matTooltip]="'navbar.home' | transloco"
          matTooltipPosition="below"
        >
          <img
            [src]="logoImageUrl$ | async"
            [alt]="(brandingOrgName$ | async) || 'TMI Logo'"
            class="tmi-logo"
          />
        </button>
      }
```

- [ ] **Step 4: Run lint**

Run: `pnpm run lint:all`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/core/components/navbar/navbar.component.html
git commit -m "feat(navbar): add home button menu with all nav destinations and logout"
```

---

### Task 3: Filter Toolbar Buttons by Role

**Files:**
- Modify: `src/app/core/components/navbar/navbar.component.html:40-71` (center nav section)

- [ ] **Step 1: Write the failing tests — toolbar button visibility per role**

In `src/app/core/components/navbar/navbar.component.spec.ts`, add a new `describe` block after the `describe('home menu items', ...)` block:

```typescript
describe('toolbar button visibility', () => {
  beforeEach(() => {
    component.ngOnInit();
  });

  it('should show Intake for normal users', () => {
    mockAuthService.userProfile$.next({
      display_name: 'User',
      email: 'user@example.com',
      is_admin: false,
      is_security_reviewer: false,
    });
    expect(component.isAuthenticated).toBe(true);
    expect(component.showIntakeButton).toBe(true);
  });

  it('should show Dashboard for normal users', () => {
    mockAuthService.userProfile$.next({
      display_name: 'User',
      email: 'user@example.com',
      is_admin: false,
      is_security_reviewer: false,
    });
    expect(component.showDashboardButton).toBe(true);
  });

  it('should hide Intake and show Dashboard+Triage for reviewers', () => {
    mockAuthService.userProfile$.next({
      display_name: 'Reviewer',
      email: 'reviewer@example.com',
      is_admin: false,
      is_security_reviewer: true,
    });
    expect(component.showIntakeButton).toBe(false);
    expect(component.showDashboardButton).toBe(true);
    expect(component.showTriageButton).toBe(true);
  });

  it('should show only Admin for admin-only users', () => {
    mockAuthService.userProfile$.next({
      display_name: 'Admin',
      email: 'admin@example.com',
      is_admin: true,
      is_security_reviewer: false,
    });
    expect(component.showIntakeButton).toBe(false);
    expect(component.showDashboardButton).toBe(false);
    expect(component.showTriageButton).toBe(false);
    expect(component.showAdminButton).toBe(true);
  });

  it('should show Dashboard+Triage+Admin for reviewer+admin', () => {
    mockAuthService.userProfile$.next({
      display_name: 'SuperUser',
      email: 'super@example.com',
      is_admin: true,
      is_security_reviewer: true,
    });
    expect(component.showIntakeButton).toBe(false);
    expect(component.showDashboardButton).toBe(true);
    expect(component.showTriageButton).toBe(true);
    expect(component.showAdminButton).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test src/app/core/components/navbar/navbar.component.spec.ts`
Expected: FAIL — `showIntakeButton`, `showDashboardButton`, `showTriageButton`, `showAdminButton` do not exist

- [ ] **Step 3: Add computed properties to the component**

In `navbar.component.ts`, add these getters after the `homeLink` property (after line 59):

```typescript
/** Intake button: shown only for normal users (not admin, not reviewer) */
get showIntakeButton(): boolean {
  return !this.isAdmin && !this.isSecurityReviewer;
}

/** Dashboard button: shown for everyone except admin-only users */
get showDashboardButton(): boolean {
  return !this.isAdmin || this.isSecurityReviewer;
}

/** Triage button: shown for security reviewers */
get showTriageButton(): boolean {
  return this.isSecurityReviewer;
}

/** Admin button: shown for admins */
get showAdminButton(): boolean {
  return this.isAdmin;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test src/app/core/components/navbar/navbar.component.spec.ts`
Expected: PASS

- [ ] **Step 5: Update the template to use the new getters**

In `navbar.component.html`, replace the center nav section (the `@if (isAuthenticated)` block containing the 4 buttons, lines 40-71) with:

```html
    @if (isAuthenticated) {
      <div class="navbar-nav">
        @if (showIntakeButton) {
          <button mat-button routerLink="/intake" routerLinkActive="active-link" class="nav-link">
            <mat-icon>assignment</mat-icon>
            <span [transloco]="'navbar.intake'">Intake</span>
          </button>
        }
        @if (showDashboardButton) {
          <button mat-button routerLink="/dashboard" routerLinkActive="active-link" class="nav-link">
            <mat-icon>dashboard</mat-icon>
            <span [transloco]="'navbar.dashboard'">Dashboard</span>
          </button>
        }
        @if (showTriageButton) {
          <button mat-button routerLink="/triage" routerLinkActive="active-link" class="nav-link">
            <mat-icon>inbox</mat-icon>
            <span [transloco]="'triage.title'">Triage</span>
          </button>
        }
        @if (showAdminButton) {
          <button mat-button routerLink="/admin" routerLinkActive="active-link" class="nav-link">
            <mat-icon>admin_panel_settings</mat-icon>
            <span [transloco]="'navbar.admin'">Admin</span>
          </button>
        }
      </div>
    }
```

Note: The `[disabled]` attributes are removed from Triage and Admin — these buttons are now hidden instead of disabled. The `@if` guards replace the disabled logic.

- [ ] **Step 6: Run lint**

Run: `pnpm run lint:all`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/core/components/navbar/navbar.component.html src/app/core/components/navbar/navbar.component.ts src/app/core/components/navbar/navbar.component.spec.ts
git commit -m "feat(navbar): filter toolbar buttons by user role"
```

---

### Task 4: Remove Standalone Logout Button from Toolbar

**Files:**
- Modify: `src/app/core/components/navbar/navbar.component.html:173-176` (logout button in right side)

- [ ] **Step 1: Remove the standalone logout button**

In `navbar.component.html`, remove the standalone logout button from the right side of the toolbar. Delete these lines (currently lines 173-176 inside the `@if (isAuthenticated)` block in the navbar-right section):

```html
          <button mat-button (click)="logout()">
            <mat-icon>logout</mat-icon>
            <span [transloco]="'navbar.logoutButton'">Logout</span>
          </button>
```

Also remove the comment on line 178:
```html
          <!-- No additional navigation buttons needed as home button will navigate to threat models when authenticated -->
```

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all`
Expected: PASS

- [ ] **Step 3: Run all tests**

Run: `pnpm run test src/app/core/components/navbar/navbar.component.spec.ts`
Expected: PASS — logout is still tested via the `logout()` method, which is now triggered from the home menu

- [ ] **Step 4: Commit**

```bash
git add src/app/core/components/navbar/navbar.component.html
git commit -m "refactor(navbar): move logout button into home menu"
```

---

### Task 5: Style the Home Menu Trigger

**Files:**
- Modify: `src/app/core/components/navbar/navbar.component.scss`

- [ ] **Step 1: Add styles for the menu caret indicator**

In `navbar.component.scss`, add the following after the `.logo-button` block (after line 19):

```scss
.home-menu-trigger {
  display: flex;
  align-items: center;
  gap: 0;

  .menu-caret {
    font-size: 18px;
    width: 18px;
    height: 18px;
    margin-left: -4px;
    opacity: 0.7;
  }
}
```

And in the RTL section (inside `:host-context([dir='rtl'])`), add:

```scss
  .home-menu-trigger {
    .menu-caret {
      margin-left: 0;
      margin-right: -4px;
    }
  }
```

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/core/components/navbar/navbar.component.scss
git commit -m "style(navbar): add home menu trigger caret styling"
```

---

### Task 6: Build, Full Test, and Localization Backfill

**Files:**
- All i18n files in `src/assets/i18n/`

- [ ] **Step 1: Run the full build**

Run: `pnpm run build`
Expected: PASS — no build errors

- [ ] **Step 2: Run the full test suite**

Run: `pnpm run test`
Expected: PASS — all tests pass

- [ ] **Step 3: Run localization backfill**

Use the `/localization-backfill` skill to backfill the new `navbar.menu.home` and `navbar.menu.logout` keys across all non-English locale files.

- [ ] **Step 4: Commit localization changes**

```bash
git add src/assets/i18n/
git commit -m "chore(i18n): backfill navbar menu translations"
```
