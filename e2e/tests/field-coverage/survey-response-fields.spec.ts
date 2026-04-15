import { expect } from '@playwright/test';
import { reviewerTest } from '../../fixtures/auth-fixtures';
import { SURVEY_RESPONSE_FIELDS } from '../../schema/field-definitions';
import { TriagePage } from '../../pages/triage.page';

reviewerTest.describe('Survey Response Field Coverage', () => {
  reviewerTest.setTimeout(30000);

  for (const field of SURVEY_RESPONSE_FIELDS) {
    reviewerTest(`field: ${field.apiName}`, async ({ reviewerPage }) => {
      await reviewerPage.goto('/triage');
      await reviewerPage.waitForLoadState('networkidle');

      // Open the seeded submitted response
      const triagePage = new TriagePage(reviewerPage);
      await triagePage.viewButton('E2E Seed System').click();
      await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, {
        timeout: 10000,
      });
      await reviewerPage.waitForLoadState('networkidle');

      // Verify field is visible
      const locator = reviewerPage.locator(field.uiSelector);
      await expect(locator.first()).toBeVisible({ timeout: 5000 });
    });
  }
});
