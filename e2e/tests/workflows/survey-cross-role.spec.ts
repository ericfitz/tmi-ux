import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { SurveyAdminFlow } from '../../flows/survey-admin.flow';
import { SurveyBuilderFlow } from '../../flows/survey-builder.flow';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';
import { SurveyResponseFlow } from '../../flows/survey-response.flow';
import { TriageFlow } from '../../flows/triage.flow';
import { TriageDetailFlow } from '../../flows/triage-detail.flow';
import { SurveyFillPage } from '../../pages/survey-fill.page';
import { AdminSurveysPage } from '../../pages/admin-surveys.page';
import { TriagePage } from '../../pages/triage.page';
import { TriageDetailPage } from '../../pages/triage-detail.page';
import { MyResponsesPage } from '../../pages/my-responses.page';
import { SurveyListPage } from '../../pages/survey-list.page';
import { testConfig } from '../../config/test.config';

/**
 * Look up the survey response this run created by its (uniquely timestamped)
 * survey name, scoping every subsequent status check to this run instead of
 * to any response matching a status regex.
 */
// SEM@2c9a1f0e3b7d4e6a8c5f7d9b1e3a5c7d9f1b3d5e: fetch this run's survey response by survey name via the intake API (pure)
async function fetchResponseByName(
  page: Page,
  apiUrl: string,
  surveyName: string,
): Promise<{ id: string; status: string } | null> {
  return page.evaluate(
    async ({ api, name }: { api: string; name: string }) => {
      const res = await fetch(`${api}/intake/survey_responses?limit=100`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      const list = await res.json();
      const match = (list.survey_responses || []).find(
        (r: { survey_name?: string }) => r.survey_name === name,
      );
      return match ? { id: match.id as string, status: match.status as string } : null;
    },
    { api: apiUrl, name: surveyName },
  );
}

// SEM@2c9a1f0e3b7d4e6a8c5f7d9b1e3a5c7d9f1b3d5e: fetch a survey response's current status by id via the intake API (pure)
async function fetchResponseStatus(
  page: Page,
  apiUrl: string,
  responseId: string,
): Promise<string | null> {
  return page.evaluate(
    async ({ api, id }: { api: string; id: string }) => {
      const res = await fetch(`${api}/intake/survey_responses/${id}`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      const body = await res.json();
      return (body.status as string) ?? null;
    },
    { api: apiUrl, id: responseId },
  );
}

test.describe.serial('Survey Cross-Role Lifecycle', () => {
  test.setTimeout(120000);

  let adminContext: BrowserContext;
  let userContext: BrowserContext;
  let reviewerContext: BrowserContext;
  let adminPage: Page;
  let userPage: Page;
  let reviewerPage: Page;

  const crossRoleSurveyName = `E2E Cross-Role Survey ${Date.now()}`;
  const systemName = `Cross-Role System ${Date.now()}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120000);

    // Create three independent browser contexts
    adminContext = await browser.newContext();
    userContext = await browser.newContext();
    reviewerContext = await browser.newContext();

    adminPage = await adminContext.newPage();
    userPage = await userContext.newPage();
    reviewerPage = await reviewerContext.newPage();

    // Authenticate all three roles
    await new AuthFlow(adminPage).loginAs('test-admin');
    await new AuthFlow(userPage).loginAs('test-user');
    await new AuthFlow(reviewerPage).loginAs('test-reviewer');
  });

  test.afterAll(async () => {
    // Best-effort cleanup: delete the test survey
    try {
      const adminFlow = new SurveyAdminFlow(adminPage);
      await adminPage.goto('/admin/surveys');
      await adminPage.waitForLoadState('networkidle');
      await adminFlow.deleteSurvey(crossRoleSurveyName);
    } catch {
      /* best effort */
    }
    await adminContext.close();
    await userContext.close();
    await reviewerContext.close();
  });

  test('full cross-role lifecycle', async () => {
    // === ADMIN: Create and publish survey ===
    const adminFlow = new SurveyAdminFlow(adminPage);
    const adminBuilderFlow = new SurveyBuilderFlow(adminPage);

    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');

    // Create survey
    await adminFlow.createSurvey(crossRoleSurveyName, '1');

    // Add questions in builder
    await adminBuilderFlow.addQuestion('text', 'System Name');
    await adminBuilderFlow.editQuestionProperties({
      name: 'system_name',
      required: true,
    });
    await adminBuilderFlow.addQuestion('comment', 'Description');
    await adminBuilderFlow.editQuestionProperties({
      name: 'description',
    });
    await adminBuilderFlow.saveSurvey();

    // Go back to list and ensure it's active
    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');
    const adminSurveysPage = new AdminSurveysPage(adminPage);
    await expect(adminSurveysPage.surveyRow(crossRoleSurveyName)).toBeVisible({ timeout: 10000 });

    // Surveys default to inactive after creation — toggle to active so the
    // fill-user can see it on /intake. The row always contains the word
    // "active" (Active or Inactive), so check for the exact "Inactive" label.
    const statusText = (await adminSurveysPage.surveyRow(crossRoleSurveyName).textContent()) ?? '';
    if (/inactive/i.test(statusText)) {
      await adminFlow.toggleStatus(crossRoleSurveyName);
      await expect(adminSurveysPage.surveyRow(crossRoleSurveyName)).not.toContainText(/inactive/i, {
        timeout: 10000,
      });
    }

    // === USER: Fill and submit ===
    const userFillFlow = new SurveyFillFlow(userPage);
    const userFillPage = new SurveyFillPage(userPage);

    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');

    // The active-surveys list may be cached on the user session; reload once
    // to pick up the freshly-activated template if it isn't visible yet.
    const userSurveyList = new SurveyListPage(userPage);
    const newSurveyCard = userSurveyList.surveyCard(crossRoleSurveyName);
    if (!(await newSurveyCard.isVisible({ timeout: 5000 }).catch(() => false))) {
      await userPage.reload();
      await userPage.waitForLoadState('networkidle');
    }
    await expect(newSurveyCard).toBeVisible({ timeout: 15000 });

    await userFillFlow.startSurvey(crossRoleSurveyName);
    await userFillFlow.fillTextField('system_name', systemName);
    await userFillFlow.fillCommentField('description', 'Cross-role E2E test system');
    await userFillFlow.submitSurvey();
    await expect(userFillPage.viewResponseButton()).toBeVisible({
      timeout: 10000,
    });

    // Confirm the submission landed via the API payload, scoped to this
    // run's survey by name, and capture the response id for later API
    // status checks.
    const apiUrl = testConfig.apiUrl;
    await expect
      .poll(
        async () => {
          const response = await fetchResponseByName(userPage, apiUrl, crossRoleSurveyName);
          return response?.status ?? null;
        },
        {
          message: `expected a submitted survey_response for survey "${crossRoleSurveyName}"`,
          timeout: 15000,
        },
      )
      .toBe('submitted');
    // The response is now confirmed present and submitted; fetch it once
    // more to capture its id for the later API status checks.
    const seededResponse = await fetchResponseByName(userPage, apiUrl, crossRoleSurveyName);
    if (!seededResponse) {
      throw new Error(`No survey_response found for survey "${crossRoleSurveyName}" after submit`);
    }
    const responseId: string = seededResponse.id;

    // === REVIEWER: View in triage and return for revision ===
    const reviewerTriageFlow = new TriageFlow(reviewerPage);
    const reviewerDetailFlow = new TriageDetailFlow(reviewerPage);
    const reviewerTriagePage = new TriagePage(reviewerPage);
    const reviewerDetailPage = new TriageDetailPage(reviewerPage);

    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');

    // The triage row doesn't display the response's system_name. Use the
    // template-name filter (the cross-role survey name uniquely identifies
    // this submission) so we open the right response.
    await reviewerTriageFlow.filterByTemplate(crossRoleSurveyName);
    await expect(reviewerTriagePage.responseRows().first()).toBeVisible({
      timeout: 15000,
    });
    await reviewerTriagePage.responseRows().first().getByTestId('triage-view-button').click();
    await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await reviewerPage.waitForLoadState('networkidle');

    // Return for revision with notes
    await reviewerDetailFlow.returnForRevision('Please add more architecture details');
    await expect(reviewerDetailPage.status()).toContainText(/revision/i, {
      timeout: 10000,
    });

    // Assert the transition to needs-revision from the API payload as well
    // as the reviewer-side UI, scoped to the response id captured above.
    await expect
      .poll(() => fetchResponseStatus(userPage, apiUrl, responseId), {
        message: `expected survey_response ${responseId} to reach needs-revision`,
        timeout: 15000,
      })
      .toMatch(/revision/i);

    // === USER: See revision request, update, and resubmit ===
    const userResponseFlow = new SurveyResponseFlow(userPage);
    const myResponses = new MyResponsesPage(userPage);
    const revisionRow = myResponses
      .responseRows()
      .filter({ hasText: crossRoleSurveyName })
      .filter({ hasText: /revision/i });

    // The server's triage -> my-responses propagation can lag the reviewer's
    // PATCH by a few seconds. Poll with reloads up to ~30s; if the row never
    // appears within that window this is a real failure, not a truncation.
    await expect(async () => {
      await userPage.goto('/intake', { waitUntil: 'domcontentloaded' });
      await userPage.waitForLoadState('networkidle');
      await userResponseFlow.viewMyResponses();
      await expect(revisionRow.first()).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 30000, intervals: [2000, 5000] });

    await revisionRow.first().getByTestId('my-responses-edit-button').click();
    await userPage.waitForURL(/\/intake\/fill\//, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    // Verify revision notes are displayed
    await expect(userFillPage.revisionNotes()).toBeVisible();

    // Update the description and resubmit
    await userFillFlow.fillCommentField(
      'description',
      'Updated: Cross-role E2E test system with detailed architecture',
    );
    await userFillFlow.submitSurvey();
    await expect(userFillPage.viewResponseButton()).toBeVisible({
      timeout: 10000,
    });

    // Confirm the resubmission via the API payload, scoped to this run's
    // response id.
    await expect
      .poll(() => fetchResponseStatus(userPage, apiUrl, responseId), {
        message: `expected survey_response ${responseId} to be resubmitted`,
        timeout: 15000,
      })
      .toBe('submitted');

    // === REVIEWER: Approve ===
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');
    await reviewerTriageFlow.filterByTemplate(crossRoleSurveyName);
    await expect(reviewerTriagePage.responseRows().first()).toBeVisible({
      timeout: 15000,
    });
    await reviewerTriagePage.responseRows().first().getByTestId('triage-view-button').click();
    await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await reviewerPage.waitForLoadState('networkidle');

    await reviewerDetailFlow.approve();
    await expect(reviewerDetailPage.status()).toContainText(/approved|ready/i, {
      timeout: 10000,
    });

    // Assert the approval from the API payload as well as the UI, scoped to
    // this run's response id.
    await expect
      .poll(() => fetchResponseStatus(userPage, apiUrl, responseId), {
        message: `expected survey_response ${responseId} to be approved`,
        timeout: 15000,
      })
      .toMatch(/approved|ready/i);

    // === USER: Verify approved status ===
    // Scope to this run's survey by name — an unrelated prior response must
    // not be able to satisfy this assertion.
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await userResponseFlow.viewMyResponses();
    const approvedRow = myResponses
      .responseRows()
      .filter({ hasText: crossRoleSurveyName })
      .filter({ hasText: /approved|ready/i });
    await expect(approvedRow).toBeVisible({ timeout: 10000 });
  });
});
