import { expect } from '@playwright/test';
import { reviewerTest } from '../../fixtures/auth-fixtures';
import { THREAT_MODEL_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';

// Fields that can't be tested via simple visibility check:
// - metadata: tested separately via MetadataDialog in workflow tests
// - owner: display-only, managed via permissions dialog (no input testid)
// - alias: not exposed in the TM edit template
// - is_confidential: display-only badge, only visible when true (seeded TM may not be confidential)
// - project_id: rendered by app-project-picker component (custom element, not a standard input)
// - security_reviewer: rendered by complex picker/dropdown (depends on provider config)
const SKIP_FIELDS = [
  'metadata',
  'owner',
  'alias',
  'is_confidential',
  'project_id',
  'security_reviewer',
];

reviewerTest.describe('Threat Model Field Coverage', () => {
  reviewerTest.setTimeout(30000);

  for (const field of THREAT_MODEL_FIELDS.filter(f => !SKIP_FIELDS.includes(f.apiName))) {
    reviewerTest(`field: ${field.apiName}`, async ({ reviewerPage }) => {
      await reviewerPage.goto('/dashboard');
      await reviewerPage.waitForLoadState('networkidle');
      await new DashboardPage(reviewerPage).tmCard(SEEDED_TM).first().click();
      await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      // Expand the Review Process panel so fields inside are visible
      const reviewProcessPanel = reviewerPage
        .locator('mat-expansion-panel')
        .filter({ hasText: /Review Process/i });
      await reviewProcessPanel.locator('mat-expansion-panel-header').click();
      await reviewerPage.waitForTimeout(300);

      const locator = reviewerPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });
    });
  }
});
