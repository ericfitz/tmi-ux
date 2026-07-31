import { expect, Page } from '@playwright/test';
import { reviewerTest } from '../../fixtures/auth-fixtures';
import { THREAT_MODEL_FIELDS } from '../../schema/field-definitions';
import { FieldSkip, byDesignSkips, withoutSkipped } from '../../schema/field-skips';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';

const SKIPS: FieldSkip[] = [
  {
    apiName: 'metadata',
    reason: 'covered-elsewhere',
    note: 'Tested via MetadataDialog in child-entity-crud.spec.ts ("metadata CRUD", tm-metadata-button).',
  },
  {
    apiName: 'owner',
    reason: 'known-gap',
    note:
      'No display element or input exists for owner anywhere in tm-edit.component.html — the ' +
      "field-definitions.json selector ('tm-owner-input') does not match anything in the DOM. " +
      "Owner is only mutated indirectly via the permissions dialog's set-owner action; no test " +
      'verifies the resulting value against the seeded/expected owner.',
  },
  {
    apiName: 'alias',
    reason: 'not-exposed-by-design',
    note:
      'Initial alias release (#305) is server-assigned with deliberately no UI to view or ' +
      'customize it. See the by-design-skip test below, which fails once that changes.',
    trackedBy: '#305',
  },
  {
    apiName: 'is_confidential',
    reason: 'known-gap',
    note:
      'Renders as a display-only badge (tm-confidential-badge) only when true. The seeded TM ' +
      `('${SEEDED_TM}') is not confidential, so the badge never appears for this test to find.`,
  },
  {
    apiName: 'project_id',
    reason: 'known-gap',
    note:
      "The app-project-picker host element does carry the recorded testid ('tm-project-select') " +
      'and only renders when canEdit is true, but no test has verified it exists/behaves correctly ' +
      'for this field yet — it is a custom component, not a standard input.',
  },
  {
    apiName: 'security_reviewer',
    reason: 'known-gap',
    note:
      "field-definitions.json records 'tm-reviewer-input', which does not exist. The template " +
      "actually branches on provider config into 'tm-reviewer-select' (dropdown mode) or " +
      "'tm-reviewer-display' (picker mode), so a single fixed selector can't represent it; no " +
      'test covers either mode.',
  },
];

/** Navigate to the seeded TM's edit page and expand the Review Process panel. */
async function openSeededTmReviewProcess(page: Page): Promise<void> {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await new DashboardPage(page).tmCard(SEEDED_TM).first().click();
  await page.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

  // Expand the Review Process panel so fields inside are visible
  const reviewProcessPanel = page
    .locator('mat-expansion-panel')
    .filter({ hasText: /Review Process/i });
  await reviewProcessPanel.locator('mat-expansion-panel-header').click();
  await page.waitForTimeout(300);
}

reviewerTest.describe('Threat Model Field Coverage', () => {
  reviewerTest.setTimeout(30000);

  for (const field of withoutSkipped(THREAT_MODEL_FIELDS, SKIPS)) {
    reviewerTest(`field: ${field.apiName}`, async ({ reviewerPage }) => {
      await openSeededTmReviewProcess(reviewerPage);

      const locator = reviewerPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });
    });
  }

  // A 'not-exposed-by-design' skip must expire the moment the field it
  // exempts actually appears in the UI — otherwise the exemption keeps
  // silently "passing" long after the design decision behind it changes.
  for (const skip of byDesignSkips(SKIPS)) {
    reviewerTest(`by-design skip stays absent: ${skip.apiName}`, async ({ reviewerPage }) => {
      const field = THREAT_MODEL_FIELDS.find(f => f.apiName === skip.apiName);
      if (!field) {
        throw new Error(`No FieldDef found for by-design skip '${skip.apiName}'`);
      }

      await openSeededTmReviewProcess(reviewerPage);

      await expect(reviewerPage.locator(field.uiSelector)).toHaveCount(0);
    });
  }
});
