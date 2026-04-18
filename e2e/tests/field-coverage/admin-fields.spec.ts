import { expect } from '@playwright/test';
import { adminTest } from '../../fixtures/auth-fixtures';
import {
  ADMIN_USER_FIELDS,
  ADMIN_GROUP_FIELDS,
  ADMIN_QUOTA_FIELDS,
  ADMIN_WEBHOOK_FIELDS,
  ADMIN_ADDON_FIELDS,
  ADMIN_SETTING_FIELDS,
  FieldDef,
} from '../../schema/field-definitions';

// === Admin Entity Field Coverage ===
//
// Schema-driven per-field visibility tests for each admin sub-page.
// Mirrors the pattern in tm-fields.spec.ts — tests don't exercise full
// CRUD (the Phase 5 admin workflow specs already do that) but do verify
// each listed field renders once the page has loaded.

interface EntityCase {
  name: string;
  route: string;
  fields: FieldDef[];
}

const ENTITIES: EntityCase[] = [
  { name: 'admin_user', route: '/admin/users', fields: ADMIN_USER_FIELDS },
  { name: 'admin_group', route: '/admin/groups', fields: ADMIN_GROUP_FIELDS },
  { name: 'admin_quota', route: '/admin/quotas', fields: ADMIN_QUOTA_FIELDS },
  { name: 'admin_webhook', route: '/admin/webhooks', fields: ADMIN_WEBHOOK_FIELDS },
  { name: 'admin_addon', route: '/admin/addons', fields: ADMIN_ADDON_FIELDS },
  { name: 'admin_setting', route: '/admin/settings', fields: ADMIN_SETTING_FIELDS },
];

for (const entity of ENTITIES) {
  adminTest.describe(`Admin field coverage — ${entity.name}`, () => {
    adminTest.setTimeout(30000);

    for (const field of entity.fields) {
      adminTest(`${entity.name}: ${field.apiName}`, async ({ adminPage }) => {
        await adminPage.goto(entity.route);
        await adminPage.waitForLoadState('networkidle');

        const locator = adminPage.locator(field.uiSelector);
        await expect(locator.first()).toBeVisible({ timeout: 5000 });
      });
    }
  });
}
