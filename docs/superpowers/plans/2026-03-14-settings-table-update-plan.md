# Settings Table Update Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the admin settings table to show only key, value, source, and actions columns — with description and type surfaced as tooltips — and disable edit/delete for read-only settings.

**Architecture:** Update `SystemSetting` type with new API fields (`source`, `read_only`), restructure the table template to remove three columns and add one, add tooltip-based display for description and type, add read-only guards in both template and component logic.

**Tech Stack:** Angular, Angular Material, Transloco i18n, Vitest

**Spec:** `docs/superpowers/specs/2026-03-14-settings-table-update-design.md`
**Issue:** [#486](https://github.com/ericfitz/tmi-ux/issues/486)

---

## Chunk 1: Types, Component, and Template

### Task 1: Update type definitions

**Files:**
- Modify: `src/app/types/settings.types.ts`

- [ ] **Step 1: Add `SettingSource` type and new fields to `SystemSetting`**

In `src/app/types/settings.types.ts`, add after the `SettingType` declaration (line 7):

```typescript
export type SettingSource = 'database' | 'config' | 'environment' | 'vault';
```

Add two new fields to the `SystemSetting` interface (after `modified_by` on line 18):

```typescript
  source?: SettingSource;
  read_only?: boolean;
```

Do NOT modify `SystemSettingUpdate` — `source` and `read_only` are server-managed.

- [ ] **Step 2: Update mock data in service tests**

In `src/app/core/services/settings-admin.service.spec.ts`, update `mockSetting` (line 35-42) to include the new fields:

```typescript
  const mockSetting: SystemSetting = {
    key: 'rate_limit.requests_per_minute',
    value: '100',
    type: 'int',
    description: 'Maximum API requests per minute per user',
    modified_at: '2026-01-15T10:30:00Z',
    modified_by: '550e8400-e29b-41d4-a716-446655440000',
    source: 'database',
    read_only: false,
  };
```

Update the second mock setting in `mockSettings` (line 46-52) similarly:

```typescript
    {
      key: 'feature.websocket_enabled',
      value: 'true',
      type: 'bool',
      description: 'Whether WebSocket collaboration is enabled',
      modified_at: '2026-01-10T08:00:00Z',
      source: 'config',
      read_only: true,
    },
```

- [ ] **Step 3: Run tests to verify mock data changes compile**

Run: `pnpm run test src/app/core/services/settings-admin.service.spec.ts`
Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/types/settings.types.ts src/app/core/services/settings-admin.service.spec.ts
git commit -m "refactor: add source and read_only fields to SystemSetting type (#486)"
```

### Task 2: Update component logic

**Files:**
- Modify: `src/app/pages/admin/settings/admin-settings.component.ts:64,89-107,190-195,232-238,259-263,276-306`

- [ ] **Step 1: Update `displayedColumns`**

In `admin-settings.component.ts`, change line 64 from:

```typescript
  displayedColumns = ['key', 'value', 'type', 'description', 'modified_at', 'actions'];
```

to:

```typescript
  displayedColumns = ['key', 'value', 'source', 'actions'];
```

- [ ] **Step 2: Update `sortingDataAccessor`**

Replace the `switch` body in `sortingDataAccessor` (lines 93-106) with:

```typescript
      switch (property) {
        case 'key':
          return item.key.toLowerCase();
        case 'value':
          return item.value.toLowerCase();
        case 'source':
          return (item.source || '').toLowerCase();
        default:
          return '';
      }
```

- [ ] **Step 3: Update `applyFilter` to include source**

Replace the filter predicate in `applyFilter()` (lines 190-195) with:

```typescript
    this.dataSource.data = this.settings.filter(
      setting =>
        setting.key.toLowerCase().includes(filter) ||
        setting.value.toLowerCase().includes(filter) ||
        (setting.description || '').toLowerCase().includes(filter) ||
        (setting.source || '').toLowerCase().includes(filter),
    );
```

- [ ] **Step 4: Add read-only guard to `onEditSetting`**

In `onEditSetting()` (line 232), add a guard at the top of the method:

```typescript
  onEditSetting(setting: EditableSystemSetting): void {
    if (setting.read_only) return;
    setting.editing = true;
    setting.editValues = {
      value: setting.value,
      description: setting.description || '',
    };
  }
```

- [ ] **Step 5: Add read-only guard to `onDeleteSetting`**

In `onDeleteSetting()` (line 276), add a guard at the top of the method:

```typescript
  onDeleteSetting(setting: EditableSystemSetting): void {
    if (setting.read_only) return;
    const message = this.transloco.translate('admin.settings.confirmDelete', {
```

(Rest of method unchanged.)

- [ ] **Step 6: Update `onSaveSetting` response handling**

In `onSaveSetting()`, update the `next` handler (lines 259-267) to also copy `source` and `read_only`:

```typescript
        next: updated => {
          setting.value = updated.value;
          setting.description = updated.description;
          setting.modified_at = updated.modified_at;
          setting.modified_by = updated.modified_by;
          setting.source = updated.source;
          setting.read_only = updated.read_only;
          setting.editing = false;
          setting.editValues = undefined;
          setting.saving = false;
          this.logger.info('System setting updated', { key: setting.key });
        },
```

- [ ] **Step 7: Update template — add description tooltip to key column**

In `admin-settings.component.html`, replace the key column `<td>` (lines 63-65) with:

```html
              <td mat-cell *matCellDef="let setting">
                <span
                  class="setting-key"
                  [matTooltip]="setting.description || ''"
                >{{ setting.key }}</span>
              </td>
```

- [ ] **Step 8: Update template — add type tooltip to value column**

On the value column `<td>` (line 73), add a `matTooltip` attribute:

```html
              <td
                mat-cell
                *matCellDef="let setting"
                [matTooltip]="'admin.settings.types.' + setting.type | transloco"
              >
```

(The inner content — the `@if (setting.editing)` / `@else` blocks — remains unchanged.)

- [ ] **Step 9: Remove type, description, and modified_at columns from template**

Delete these three blocks from the template:

The "Type Column" block (lines 121-131):
```html
            <!-- Type Column -->
            <ng-container matColumnDef="type">
              ...
            </ng-container>
```

The "Description Column" block (lines 133-147):
```html
            <!-- Description Column -->
            <ng-container matColumnDef="description">
              ...
            </ng-container>
```

The "Modified Column" block (lines 149-157):
```html
            <!-- Modified Column -->
            <ng-container matColumnDef="modified_at">
              ...
            </ng-container>
```

- [ ] **Step 10: Add source column to template**

Insert the source column before the actions column (before line 159):

```html
            <!-- Source Column -->
            <ng-container matColumnDef="source">
              <th mat-header-cell *matHeaderCellDef mat-sort-header>
                {{ 'admin.settings.columns.source' | transloco }}
              </th>
              <td mat-cell *matCellDef="let setting">
                @if (setting.source) {
                  {{ 'admin.settings.sources.' + setting.source | transloco }}
                }
              </td>
            </ng-container>
```

- [ ] **Step 11: Update actions column for read-only**

In the actions column non-editing block (lines 184-207), update the edit button to be conditionally disabled with a read-only tooltip, and disable the delete menu item:

```html
                } @else {
                  <div class="action-buttons">
                    <button
                      mat-icon-button
                      (click)="onEditSetting(setting)"
                      [disabled]="setting.read_only"
                      [matTooltip]="(setting.read_only ? 'admin.settings.readOnlyTooltip' : 'admin.settings.editTooltip') | transloco"
                    >
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      [matMenuTriggerFor]="settingRowKebabMenu"
                      [matTooltip]="'common.actions' | transloco"
                      [attr.aria-label]="'common.actions' | transloco"
                      (click)="$event.stopPropagation()"
                    >
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #settingRowKebabMenu="matMenu">
                      <button
                        mat-menu-item
                        (click)="onDeleteSetting(setting)"
                        [disabled]="setting.read_only"
                      >
                        <mat-icon>delete</mat-icon>
                        <span [transloco]="'admin.settings.deleteTooltip'">Delete</span>
                      </button>
                    </mat-menu>
                  </div>
                }
```

- [ ] **Step 12: Commit component and template together**

```bash
git add src/app/pages/admin/settings/admin-settings.component.ts src/app/pages/admin/settings/admin-settings.component.html
git commit -m "refactor: update settings table columns, add source and read-only support (#486)"
```

## Chunk 2: Styles, i18n, and Finalization

### Task 3: Update styles

**Files:**
- Modify: `src/app/pages/admin/settings/admin-settings.component.scss:106-147`

- [ ] **Step 1: Remove unused styles**

Delete the `.type-badge` block (lines 136-142):

```scss
  .type-badge {
    font-size: 12px;
    font-weight: 500;
    color: var(--theme-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
```

Delete the `.setting-description` block (lines 144-147):

```scss
  .setting-description {
    font-size: 13px;
    color: var(--theme-text-secondary);
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/pages/admin/settings/admin-settings.component.scss
git commit -m "refactor: remove unused type-badge and description styles from settings table (#486)"
```

### Task 4: Update i18n

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Add new keys, remove dead keys, and update existing keys in en-US.json**

In the `admin.settings` section, make these changes:

Add the `sources` object after `types`:

```json
    "sources": {
      "database": "Database",
      "config": "Configuration File",
      "environment": "Environment",
      "vault": "Vault",
      "vault.comment": "Vault refers to a secure IT secret storage technology (e.g. HashiCorp Vault), not a physical vault."
    },
```

Add `readOnlyTooltip` (alongside the other tooltip keys):

```json
    "readOnlyTooltip": "This setting is read-only and cannot be modified here",
```

Add `source` to `admin.settings.columns`:

```json
      "source": "Source",
```

Remove dead column keys from `admin.settings.columns`:
- `"type"` (was `"admin.settings.columns.type"`)
- `"description"` (was `"admin.settings.columns.description"`)
- `"modified"` (was `"admin.settings.columns.modified"`)

Update `admin.settings.filterPlaceholder`:

```json
    "filterPlaceholder": "Filter by key, value, description, or source",
```

- [ ] **Step 2: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "refactor: add settings source and read-only i18n keys (#486)"
```

### Task 5: Build, lint, and test

- [ ] **Step 1: Run format and lint**

Run: `pnpm run format && pnpm run lint:all`
Fix any issues.

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run tests**

Run: `pnpm run test`
Expected: All tests pass.

- [ ] **Step 4: Commit any formatting fixes**

```bash
git add -A
git commit -m "style: format settings table changes (#486)"
```

(Skip this step if no formatting changes were needed.)

### Task 6: Localization backfill

- [ ] **Step 1: Run localization backfill**

Use the `/localization-backfill` skill to translate the new English keys into all other locale files (`ar-SA`, `bn-BD`, `de-DE`, `es-ES`, `fr-FR`, `he-IL`, `hi-IN`, `id-ID`, `ja-JP`, `ko-KR`, `pt-BR`, `ru-RU`, `th-TH`, `ur-PK`, `zh-CN`).

New keys to backfill:
- `admin.settings.sources.database`
- `admin.settings.sources.config`
- `admin.settings.sources.environment`
- `admin.settings.sources.vault`
- `admin.settings.sources.vault.comment`
- `admin.settings.readOnlyTooltip`
- `admin.settings.columns.source`
- `admin.settings.filterPlaceholder` (updated value)

Dead keys to remove from all locale files:
- `admin.settings.columns.type`
- `admin.settings.columns.description`
- `admin.settings.columns.modified`

- [ ] **Step 2: Run format and lint after backfill**

Run: `pnpm run format && pnpm run lint:all`

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n/
git commit -m "chore: backfill localization for settings table source and read-only keys (#486)"
```

### Task 7: Code review and issue cleanup

- [ ] **Step 1: Run code review**

Use the `superpowers:requesting-code-review` skill.

- [ ] **Step 2: Add commit reference to issue**

```bash
gh issue comment 486 --repo ericfitz/tmi-ux --body "Implemented in commits on release/1.3.0 branch."
```

- [ ] **Step 3: Close the issue**

```bash
gh issue close 486 --repo ericfitz/tmi-ux --reason completed
```
