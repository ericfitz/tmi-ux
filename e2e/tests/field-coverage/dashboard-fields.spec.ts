import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { DASHBOARD_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';

userTest.describe('Dashboard Field Coverage', () => {
  userTest.setTimeout(30000);

  userTest.beforeEach(async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    // Switch to table view for column-based verification
    const dashboard = new DashboardPage(userPage);
    await dashboard.viewToggle().click();
    await userPage.waitForTimeout(300);
  });

  for (const field of DASHBOARD_FIELDS) {
    userTest(`column: ${field.apiName}`, async ({ userPage }) => {
      // Verify the column header exists.
      // mat-table columns use class-based selectors (.mat-column-name); the
      // header cell carries the column class directly (th.mat-column-name).
      const headerLocator = userPage.locator(`${field.uiSelector} th, th${field.uiSelector}`);
      await expect(headerLocator.first()).toBeVisible({ timeout: 5000 });

      // Verify the seeded TM row renders an actual value in this column, not
      // just an empty cell — visibility alone would still pass for a field
      // bound to the wrong (always-blank) API property (see #819).
      const dashboard = new DashboardPage(userPage);
      const tmRow = dashboard.tableRow(SEEDED_TM);
      const cellInRow = tmRow.locator(field.uiSelector);
      await expect(cellInRow).toBeVisible({ timeout: 5000 });
      await expect(cellInRow).not.toBeEmpty({ timeout: 5000 });
    });
  }
});
