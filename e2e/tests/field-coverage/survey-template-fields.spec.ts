import { expect } from '@playwright/test';
import { adminTest } from '../../fixtures/auth-fixtures';
import { SURVEY_TEMPLATE_FIELDS } from '../../schema/field-definitions';

adminTest.describe('Survey Template Field Coverage', () => {
  adminTest.setTimeout(30000);

  for (const field of SURVEY_TEMPLATE_FIELDS) {
    adminTest(`field: ${field.apiName}`, async ({ adminPage }) => {
      await adminPage.goto('/admin/surveys');
      await adminPage.waitForLoadState('networkidle');

      // Verify the field is visible in the seeded survey row
      const locator = adminPage.locator(field.uiSelector);
      await expect(locator.first()).toBeVisible({ timeout: 5000 });
    });
  }
});
