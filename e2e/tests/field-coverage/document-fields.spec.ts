import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { DOCUMENT_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_DOC = 'Architecture Doc';

userTest.describe('Document Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of DOCUMENT_FIELDS.filter(f => f.editable)) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await new DashboardPage(userPage).tmCard(SEEDED_TM).first().click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      await userPage.getByTestId('document-row').filter({ hasText: SEEDED_DOC }).click();

      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });

      await userPage.getByTestId('document-cancel-button').click();
    });
  }
});
