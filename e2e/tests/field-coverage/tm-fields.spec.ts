import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { THREAT_MODEL_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SKIP_FIELDS = ['metadata'];

userTest.describe('Threat Model Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of THREAT_MODEL_FIELDS.filter(f => !SKIP_FIELDS.includes(f.apiName))) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await new DashboardPage(userPage).tmCard(SEEDED_TM).first().click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      // Expand the Review Process panel so fields inside are visible
      const reviewProcessPanel = userPage
        .locator('mat-expansion-panel')
        .filter({ hasText: /Review Process/i });
      await reviewProcessPanel.locator('mat-expansion-panel-header').click();
      await userPage.waitForTimeout(300); // wait for animation

      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });
    });
  }
});
