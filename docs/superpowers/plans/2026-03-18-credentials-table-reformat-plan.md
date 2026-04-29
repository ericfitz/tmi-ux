# Credentials Table Reformat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformat the credentials table in the user preferences dialog from 6 cramped columns to a 3-column layout with two-line rows and consistent date formatting.

**Architecture:** Replace the 6-column mat-table with a 3-column layout (Credential, Last Used, Actions). Each credential renders as two rows: a content row with name/description/clientId + last used + delete, and a metadata sub-row spanning all columns showing created/expires dates. Date formatting is standardized to absolute dates with year for Created/Expires and relative time for Last Used.

**Tech Stack:** Angular, Angular Material (mat-table), Transloco i18n, Vitest

**Spec:** `docs/superpowers/specs/2026-03-18-credentials-table-reformat-design.md`
**Issue:** [#519](https://github.com/ericfitz/tmi/issues/519)

---

## Chunk 1: Date Formatting and Column Changes

### Task 1: Fix date formatting methods

**Files:**
- Modify: `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts`

- [ ] **Step 1: Update `formatDate()` to include year**

In `user-preferences-dialog.component.ts`, find the `formatDate` method (around line 1010). Change the `toLocaleDateString` options from:

```typescript
return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
```

to:

```typescript
return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
```

- [ ] **Step 2: Update `formatLastUsed()` fallback to include year**

In the same file, find `formatLastUsed` (around line 1015). In the final `else` branch (the >7 days fallback, around line 1032), change:

```typescript
return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
```

to:

```typescript
return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
```

### Task 2: Rewrite the table template and update columns

**Files:**
- Modify: `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts` (template section)

- [ ] **Step 1: Update `credentialColumns` and add row type properties**

Change the `credentialColumns` property (around line 780) from:

```typescript
credentialColumns = ['name', 'clientId', 'created', 'lastUsed', 'expires', 'actions'];
```

to:

```typescript
credentialColumns = ['credential', 'lastUsed', 'actions'];
```

Also add a new property for the metadata sub-row columns, right after `credentialColumns`:

```typescript
credentialMetadataColumns = ['metadata'];
```

- [ ] **Step 2: Create a row type and flattened data source**

Add a type and a computed data source for the interleaved rows. In the component class, add this property after `credentialMetadataColumns`:

```typescript
credentialRows: Array<{type: 'content' | 'metadata'; credential: ClientCredentialInfo; isLast: boolean}> = [];
```

In the `loadCredentials` `next` handler (around line 948-951), after `this.credentials = credentials;`, add:

```typescript
this.credentialRows = credentials.flatMap((credential, index) => [
  { type: 'content' as const, credential, isLast: index === credentials.length - 1 },
  { type: 'metadata' as const, credential, isLast: index === credentials.length - 1 },
]);
```

- [ ] **Step 3: Replace the table column definitions and row definitions**

Replace the `<table mat-table>` element and its contents (lines 339-418). Keep the wrapping `<div class="credentials-table-container">` (line 338) intact. Replace the `<table>...</table>` inside it with:

```html
<table mat-table [dataSource]="credentialRows" class="credentials-table">
  <!-- Credential column (name + description + client ID) -->
  <ng-container matColumnDef="credential">
    <th
      mat-header-cell
      *matHeaderCellDef
      [transloco]="'userPreferences.credentials.credential'"
    >
      Credential
    </th>
    <td mat-cell *matCellDef="let row">
      <div class="credential-name">{{ row.credential.name }}</div>
      @if (row.credential.description) {
        <div class="credential-description">{{ row.credential.description }}</div>
      }
      <div class="client-id">{{ row.credential.client_id }}</div>
    </td>
  </ng-container>

  <!-- Last Used column -->
  <ng-container matColumnDef="lastUsed">
    <th
      mat-header-cell
      *matHeaderCellDef
      [transloco]="'userPreferences.credentials.lastUsed'"
    >
      Last Used
    </th>
    <td mat-cell *matCellDef="let row">
      {{ formatLastUsed(row.credential.last_used_at) }}
    </td>
  </ng-container>

  <!-- Actions column -->
  <ng-container matColumnDef="actions">
    <th mat-header-cell *matHeaderCellDef></th>
    <td mat-cell *matCellDef="let row">
      <button
        mat-icon-button
        (click)="onDeleteCredential(row.credential)"
        [matTooltip]="'common.delete' | transloco"
        color="warn"
      >
        <mat-icon>delete</mat-icon>
      </button>
    </td>
  </ng-container>

  <!-- Metadata column (spans full width) -->
  <ng-container matColumnDef="metadata">
    <td mat-cell *matCellDef="let row" [attr.colspan]="3">
      <div class="credential-metadata" [class.credential-metadata-last]="row.isLast">
        <span [transloco]="'userPreferences.credentials.createdOn'">Created</span>
        {{ formatDate(row.credential.created_at) }}
        · @if (row.credential.expires_at) {
          @if (isExpired(row.credential.expires_at)) {
            <span class="credential-expired" [transloco]="'userPreferences.credentials.expired'">Expired</span>
          } @else {
            <span [transloco]="'userPreferences.credentials.expiresOn'">Expires</span>
            {{ formatExpires(row.credential.expires_at) }}
          }
        } @else {
          <span [transloco]="'userPreferences.credentials.neverExpires'">Never expires</span>
        }
      </div>
    </td>
  </ng-container>

  <!-- Header row -->
  <tr mat-header-row *matHeaderRowDef="credentialColumns"></tr>
  <!-- Content row -->
  <tr mat-row *matRowDef="let row; columns: credentialColumns; when: isContentRow"></tr>
  <!-- Metadata row -->
  <tr mat-row *matRowDef="let row; columns: credentialMetadataColumns; when: isMetadataRow" class="metadata-row"></tr>
</table>
```

- [ ] **Step 4: Add row type predicates and `isExpired` helper**

Add these methods to the component class, near the other credential methods:

```typescript
isContentRow = (index: number, row: {type: string}): boolean => row.type === 'content';
isMetadataRow = (index: number, row: {type: string}): boolean => row.type === 'metadata';

isExpired(dateString: string): boolean {
  return new Date(dateString) < new Date();
}
```

Note: `isContentRow` and `isMetadataRow` must be arrow functions (not methods) so that `this` binding is not needed by the template.

- [ ] **Step 5: Simplify `formatExpires` to return only the formatted date**

**Spec deviation note:** The spec says `formatExpires()` needs no changes. However, since the new template handles "Expired" and "Never expires" display logic directly via `@if` blocks and `isExpired()`, the method's branching logic is now redundant. Simplify it to only format the date. Change `formatExpires` (around line 1036) to:

```typescript
formatExpires(dateString: string | null | undefined): string {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
```

- [ ] **Step 6: Build to verify template compiles**

Run: `pnpm run build`
Expected: Build succeeds.

### Task 3: Update styles

**Files:**
- Modify: `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts` (styles section)

- [ ] **Step 1: Add metadata row styles**

In the component's styles (around line 626-737), add these styles after the `.client-id` block (around line 721):

```css
.credential-metadata {
  font-size: 11px;
  color: var(--theme-text-secondary);
  padding: 2px 0 12px 0;
  border-bottom: 1px solid var(--theme-divider);
}

.credential-metadata-last {
  border-bottom: none;
}

.credential-expired {
  color: var(--mat-warn-color, #f44336);
}

.metadata-row td {
  padding-top: 0;
  padding-bottom: 0;
}
```

- [ ] **Step 2: Update content row cell vertical alignment**

In the existing `.credentials-table td` rule (around line 700), ensure `vertical-align: top` is set (it already is). No change needed if already present.

- [ ] **Step 3: Build and visually verify**

Run: `pnpm run build`
Expected: Build succeeds.

---

## Chunk 2: Localization

### Task 4: Update English locale file

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Add new keys and remove old ones**

In `src/assets/i18n/en-US.json`, find the `userPreferences.credentials` block (around line 1795).

Remove these keys:
- `"clientId": "Client ID"` (line 1797)
- `"created": "{{common.created}}"` (line 1814)
- `"expires": "Expires"` (line 1815)
- `"expires.comment": "This is the date..."` (line 1816)

Add these new keys in the `credentials` block (alphabetical order):
```json
"credential": "Credential",
"createdOn": "Created",
"expired": "Expired",
"expiresOn": "Expires",
"neverExpires": "Never expires",
```

- [ ] **Step 2: Verify JSON validity**

Run: `node -e "require('./src/assets/i18n/en-US.json')"` from project root.
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "feat: update English locale for credentials table reformat"
```

### Task 5: Update all non-English locale files

**Files:**
- Modify: All 15 locale files in `src/assets/i18n/` (ar-SA, bn-BD, de-DE, es-ES, fr-FR, he-IL, hi-IN, id-ID, ja-JP, ko-KR, pt-BR, ru-RU, th-TH, ur-PK, zh-CN)

- [ ] **Step 1: Use the `/localization-backfill` skill**

Run the `/localization-backfill` skill to propagate the new keys to all non-English locale files and remove the deleted keys. This skill handles translation and formatting preservation automatically.

- [ ] **Step 2: Commit locale updates**

```bash
git add src/assets/i18n/*.json
git commit -m "feat: backfill credentials table locale keys to all languages"
```

---

## Chunk 3: Testing

### Task 6: Create unit tests for credentials table formatting

**Files:**
- Create: `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.spec.ts`

- [ ] **Step 1: Write tests for date formatting methods**

Create `user-preferences-dialog.component.spec.ts` following the project's test pattern (see `delete-user-data-dialog.component.spec.ts` for reference). Use direct component instantiation with mocked dependencies:

```typescript
// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';

import { UserPreferencesDialogComponent } from './user-preferences-dialog.component';
import { LoggerService } from '../../services/logger.service';
import { IAuthService } from '../../interfaces';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../testing/mocks';

interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
}

describe('UserPreferencesDialogComponent', () => {
  let component: UserPreferencesDialogComponent;
  let dialogRef: MockDialogRef;
  let loggerService: MockLoggerService;

  beforeEach(() => {
    vi.clearAllMocks();

    dialogRef = { close: vi.fn() };
    loggerService = createTypedMockLoggerService();

    const authService = { getUser: vi.fn(), getUserProfile: vi.fn() };
    const dialog = { open: vi.fn() };
    const themeService = { currentTheme$: { subscribe: vi.fn() }, setTheme: vi.fn() };
    const userPreferencesService = {
      getPreferences: vi.fn().mockReturnValue({
        animations: true,
        themeMode: 'system',
        colorBlindMode: false,
        dashboardListView: false,
        hoverShowMetadata: true,
        pageSize: 'usLetter',
        marginSize: 'standard',
        showDeveloperTools: false,
      }),
    };
    const threatModelAuthService = { getCurrentRole: vi.fn() };
    const clientCredentialService = { list: vi.fn(), delete: vi.fn() };
    const userService = { requestDeleteChallenge: vi.fn(), confirmDeleteAccount: vi.fn() };
    const snackBar = { open: vi.fn() };
    const transloco = { translate: vi.fn((key: string) => key) };

    component = new UserPreferencesDialogComponent(
      dialogRef as any,
      {},
      authService as unknown as IAuthService,
      loggerService as unknown as LoggerService,
      dialog as any,
      themeService as any,
      userPreferencesService as any,
      threatModelAuthService as any,
      clientCredentialService as any,
      userService as any,
      snackBar as any,
      transloco as any,
    );
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('formatDate', () => {
    it('should format date with month, day, and year', () => {
      const result = component.formatDate('2026-03-15T10:00:00Z');
      expect(result).toContain('Mar');
      expect(result).toContain('15');
      expect(result).toContain('2026');
    });
  });

  describe('formatLastUsed', () => {
    it('should return "Never" for null input', () => {
      expect(component.formatLastUsed(null)).toBe('Never');
    });

    it('should return "Never" for undefined input', () => {
      expect(component.formatLastUsed(undefined)).toBe('Never');
    });

    it('should return "Just now" for recent timestamps', () => {
      const now = new Date();
      now.setMinutes(now.getMinutes() - 5);
      expect(component.formatLastUsed(now.toISOString())).toBe('Just now');
    });

    it('should return hours ago for timestamps within 24 hours', () => {
      const date = new Date();
      date.setHours(date.getHours() - 3);
      expect(component.formatLastUsed(date.toISOString())).toBe('3 hrs ago');
    });

    it('should return days ago for timestamps within 7 days', () => {
      const date = new Date();
      date.setDate(date.getDate() - 3);
      expect(component.formatLastUsed(date.toISOString())).toBe('3 days ago');
    });

    it('should return date with year for timestamps older than 7 days', () => {
      const result = component.formatLastUsed('2025-01-15T10:00:00Z');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });
  });

  describe('formatExpires', () => {
    it('should return empty string for null input', () => {
      expect(component.formatExpires(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(component.formatExpires(undefined)).toBe('');
    });

    it('should format future date with year', () => {
      const result = component.formatExpires('2027-12-31T00:00:00Z');
      expect(result).toContain('Dec');
      expect(result).toContain('31');
      expect(result).toContain('2027');
    });
  });

  describe('isExpired', () => {
    it('should return true for past dates', () => {
      expect(component.isExpired('2020-01-01T00:00:00Z')).toBe(true);
    });

    it('should return false for future dates', () => {
      expect(component.isExpired('2099-12-31T00:00:00Z')).toBe(false);
    });
  });

  describe('row type predicates', () => {
    it('should identify content rows', () => {
      expect(component.isContentRow(0, { type: 'content' })).toBe(true);
      expect(component.isContentRow(0, { type: 'metadata' })).toBe(false);
    });

    it('should identify metadata rows', () => {
      expect(component.isMetadataRow(0, { type: 'metadata' })).toBe(true);
      expect(component.isMetadataRow(0, { type: 'content' })).toBe(false);
    });
  });

  describe('credentialColumns', () => {
    it('should have 3 columns', () => {
      expect(component.credentialColumns).toEqual(['credential', 'lastUsed', 'actions']);
    });

    it('should have metadata columns', () => {
      expect(component.credentialMetadataColumns).toEqual(['metadata']);
    });
  });

  describe('credentialRows', () => {
    it('should start as empty array', () => {
      expect(component.credentialRows).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test -- --reporter=verbose src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.spec.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.spec.ts
git commit -m "test: add unit tests for credentials table formatting"
```

---

## Chunk 4: Final Verification

### Task 7: Full build, lint, and test

- [ ] **Step 1: Run full lint**

Run: `pnpm run lint:all`
Expected: No errors.

- [ ] **Step 2: Run full build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 4: Commit all remaining changes**

Stage and commit any remaining uncommitted files:

```bash
git add src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts
git commit -m "refactor: reformat credentials table to 3-column two-line layout

Resolves #519. Replaces the 6-column credentials table with a 3-column
layout (Credential, Last Used, Actions) using two-line rows. Metadata
(created date, expiration) shown on a sub-row. Date formatting standardized
to include year."
```
