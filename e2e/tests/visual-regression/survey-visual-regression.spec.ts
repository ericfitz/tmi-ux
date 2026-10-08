import { expect, Page } from '@playwright/test';
import { userTest, reviewerTest, adminTest } from '../../fixtures/auth-fixtures';
import { takeThemeScreenshots, DATE_TEXT } from '../../helpers/screenshot';
import { SurveyListPage } from '../../pages/survey-list.page';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';
import { SurveyResponseFlow } from '../../flows/survey-response.flow';
import { testConfig } from '../../config/test.config';

/** The seeded submitted response (seed-spec.json survey_responses[0]). */
const SEEDED_RESPONSE_SURVEY = 'Simple Workflow Survey';

/** Extracts the response id from a /intake/fill/<surveyId>/<responseId> URL. */
function draftIdFromFillUrl(url: string): string {
  const match = /\/intake\/fill\/[^/]+\/([^/?#]+)/.exec(url);
  if (!match) throw new Error(`not a survey fill URL: ${url}`);
  return match[1];
}

/**
 * Hides the autosave status ("Saved at <time>"). Whether it is showing depends on
 * autosave timing, and its text on the clock, so a mask is not enough.
 */
async function hideSaveStatus(page: Page): Promise<void> {
  await page.addStyleTag({
    content: '[data-testid="survey-fill-status"] { visibility: hidden !important; }',
  });
}

/** Deletes a draft survey response and asserts the delete succeeded. */
async function deleteDraftViaApi(page: Page, id: string): Promise<void> {
  const ok = await page.evaluate(
    async ({ api, responseId }) => {
      const res = await fetch(`${api}/intake/survey_responses/${responseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.ok || res.status === 404;
    },
    { api: testConfig.apiUrl, responseId: id },
  );
  expect(ok, `cleanup: failed to delete draft survey response ${id}`).toBe(true);
}

userTest.describe('Survey Visual Regression (User)', () => {
  userTest.setTimeout(60000);

  // Fill tests create drafts; delete them so the my-responses baselines and
  // the response-detail lookup see only the seeded submitted response.
  let draftId: string | undefined;

  userTest.afterEach(async ({ userPage }) => {
    if (!draftId) return;
    const id = draftId;
    draftId = undefined;
    await deleteDraftViaApi(userPage, id);
  });

  userTest('survey list', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');

    await takeThemeScreenshots(userPage, 'survey-list', { freezeVolatileText: true });
  });

  userTest('survey fill - basic inputs page', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');

    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    draftId = draftIdFromFillUrl(userPage.url());

    // Fill some data so the page has content
    await fillFlow.fillTextField('project_name', 'Visual Test Project');
    await fillFlow.fillCommentField('project_description', 'A test project for visual regression');

    await hideSaveStatus(userPage);
    await takeThemeScreenshots(userPage, 'survey-fill-basic-inputs', {
      freezeVolatileText: true,
      fullPage: true,
    });
  });

  userTest('survey fill - selection inputs page', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');

    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    draftId = draftIdFromFillUrl(userPage.url());

    // Fill required field and navigate to page 2
    await fillFlow.fillTextField('project_name', 'Visual Test');
    await fillFlow.nextPage();

    await hideSaveStatus(userPage);
    await takeThemeScreenshots(userPage, 'survey-fill-selection-inputs', {
      freezeVolatileText: true,
      fullPage: true,
    });
  });

  userTest('my responses', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await new SurveyListPage(userPage).myResponsesButton().click();
    await userPage.waitForURL(/\/intake\/my-responses/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.mat-column-created, .mat-column-modified');

    await takeThemeScreenshots(userPage, 'survey-my-responses', {
      freezeVolatileText: true,
      mask: [timestamps],
    });
  });

  userTest('response detail', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await new SurveyListPage(userPage).myResponsesButton().click();
    await userPage.waitForURL(/\/intake\/my-responses/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    await new SurveyResponseFlow(userPage).viewResponse(SEEDED_RESPONSE_SURVEY);

    const timestamps = userPage.locator('.info-value').filter({
      hasText: DATE_TEXT,
    });

    await takeThemeScreenshots(userPage, 'survey-response-detail', {
      freezeVolatileText: true,
      mask: [timestamps],
    });
  });
});

adminTest.describe('Survey Visual Regression (Admin)', () => {
  adminTest.setTimeout(60000);

  adminTest('admin survey list', async ({ adminPage }) => {
    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');

    const timestamps = adminPage.locator('.mat-column-modified');

    await takeThemeScreenshots(adminPage, 'survey-admin-list', {
      freezeVolatileText: true,
      mask: [timestamps],
    });
  });

  adminTest('template builder', async ({ adminPage }) => {
    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');

    // Open the Kitchen Sink Survey in the builder
    const editButton = adminPage.getByTestId('admin-surveys-edit-button').first();
    await editButton.click();
    await adminPage.waitForURL(/\/admin\/surveys\/[a-f0-9-]+/, { timeout: 10000 });
    await adminPage.waitForLoadState('networkidle');

    await takeThemeScreenshots(adminPage, 'survey-template-builder', {
      freezeVolatileText: true,
      fullPage: true,
    });
  });
});

reviewerTest.describe('Survey Visual Regression (Reviewer)', () => {
  reviewerTest.setTimeout(60000);

  reviewerTest('triage list', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');

    const timestamps = reviewerPage.locator('.mat-column-submitted_at');

    // The unassigned-reviews count depends on every TM on the bed, not on seed data.
    // The badge renders only when the count is > 0, which a seeded bed always has
    // (seed TMs have no security reviewer); replaceText fails if it is missing.
    await takeThemeScreenshots(reviewerPage, 'survey-triage-list', {
      freezeVolatileText: true,
      mask: [timestamps],
      replaceText: [{ selector: '.mat-mdc-tab:last-of-type .tab-badge', text: '0' }],
    });
  });

  reviewerTest('triage detail', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');

    // Open the first response
    const viewButton = reviewerPage.getByTestId('triage-view-button').first();
    await viewButton.click();
    await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await reviewerPage.waitForLoadState('networkidle');

    const timestamps = reviewerPage
      .locator('.info-value, .timeline-timestamp, .reviewed-date')
      .filter({
        hasText: DATE_TEXT,
      });

    // The response id changes with every seed.
    const responseId = reviewerPage.locator('.id-row .info-value');

    await takeThemeScreenshots(reviewerPage, 'survey-triage-detail', {
      freezeVolatileText: true,
      mask: [timestamps, responseId],
      fullPage: true,
    });
  });
});
