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

      // Open the seeded submitted response. The triage table has no
      // system_name column -- its columns are confidential, submitter,
      // template, submitted_at, status and actions -- and viewButton()
      // filters rows by rendered text, so the response's system_name value
      // ('E2E Seed System') can never match. Match the template column
      // instead, which is the survey the seeded response was submitted
      // against. See #886.
      //
      // Earlier runs leave their own submissions behind, so several rows can
      // match; these specs only assert that each field renders, so any
      // submitted response will do.
      const triagePage = new TriagePage(reviewerPage);
      await triagePage.viewButton('Simple Workflow Survey').first().click();
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
