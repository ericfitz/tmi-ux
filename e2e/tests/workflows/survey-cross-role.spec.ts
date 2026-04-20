import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { SurveyAdminFlow } from '../../flows/survey-admin.flow';
import { SurveyBuilderFlow } from '../../flows/survey-builder.flow';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';
import { TriageFlow } from '../../flows/triage.flow';
import { TriageDetailFlow } from '../../flows/triage-detail.flow';
import { SurveyFillPage } from '../../pages/survey-fill.page';
import { AdminSurveysPage } from '../../pages/admin-surveys.page';
import { TriagePage } from '../../pages/triage.page';
import { TriageDetailPage } from '../../pages/triage-detail.page';
import { MyResponsesPage } from '../../pages/my-responses.page';
import { SurveyListPage } from '../../pages/survey-list.page';

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
    // fill-user can see it on /intake.
    const statusCell = adminSurveysPage.surveyRow(crossRoleSurveyName);
    const statusText = (await statusCell.textContent()) ?? '';
    if (!/active/i.test(statusText)) {
      await adminFlow.toggleStatus(crossRoleSurveyName);
      await expect(adminSurveysPage.surveyRow(crossRoleSurveyName)).toContainText(/active/i, {
        timeout: 10000,
      });
    }

    // === USER: Fill and submit ===
    const userFillFlow = new SurveyFillFlow(userPage);
    const userFillPage = new SurveyFillPage(userPage);

    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');

    // Wait for the new survey to appear (may need a short wait for propagation)
    await expect(
      new SurveyListPage(userPage).surveyCard(crossRoleSurveyName)
    ).toBeVisible({ timeout: 15000 });

    await userFillFlow.startSurvey(crossRoleSurveyName);
    await userFillFlow.fillTextField('system_name', systemName);
    await userFillFlow.fillCommentField('description', 'Cross-role E2E test system');
    await userFillFlow.submitSurvey();
    await expect(userFillPage.viewResponseButton()).toBeVisible({
      timeout: 10000,
    });

    // === REVIEWER: View in triage and return for revision ===
    const reviewerTriageFlow = new TriageFlow(reviewerPage);
    const reviewerDetailFlow = new TriageDetailFlow(reviewerPage);
    const reviewerTriagePage = new TriagePage(reviewerPage);
    const reviewerDetailPage = new TriageDetailPage(reviewerPage);

    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');

    // Find and open the submitted response
    await reviewerTriageFlow.searchByName(systemName);
    await expect(reviewerTriagePage.responseRows().first()).toBeVisible({
      timeout: 15000,
    });

    await reviewerTriagePage.viewButton(systemName).click();
    await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await reviewerPage.waitForLoadState('networkidle');

    // Return for revision with notes
    await reviewerDetailFlow.returnForRevision(
      'Please add more architecture details'
    );
    await expect(reviewerDetailPage.status()).toContainText(/revision/i, {
      timeout: 10000,
    });

    // === USER: See revision request, update, and resubmit ===
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const userResponseFlow = new (await import('../../flows/survey-response.flow')).SurveyResponseFlow(userPage);
    await userResponseFlow.viewMyResponses();

    // Find the response that needs revision
    const myResponses = new MyResponsesPage(userPage);
    await expect(
      myResponses.responseRows().filter({ hasText: /revision/i })
    ).toBeVisible({ timeout: 10000 });

    // Continue editing
    await myResponses.editButton(crossRoleSurveyName).click();
    await userPage.waitForURL(/\/intake\/fill\//, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    // Verify revision notes are displayed
    await expect(userFillPage.revisionNotes()).toBeVisible();

    // Update the description and resubmit
    await userFillFlow.fillCommentField(
      'description',
      'Updated: Cross-role E2E test system with detailed architecture'
    );
    await userFillFlow.submitSurvey();
    await expect(userFillPage.viewResponseButton()).toBeVisible({
      timeout: 10000,
    });

    // === REVIEWER: Approve ===
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');
    await reviewerTriageFlow.searchByName(systemName);
    await expect(reviewerTriagePage.responseRows().first()).toBeVisible({
      timeout: 15000,
    });

    await reviewerTriagePage.viewButton(systemName).click();
    await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await reviewerPage.waitForLoadState('networkidle');

    await reviewerDetailFlow.approve();
    await expect(reviewerDetailPage.status()).toContainText(/approved|ready/i, {
      timeout: 10000,
    });

    // === USER: Verify approved status ===
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await userResponseFlow.viewMyResponses();
    await expect(
      myResponses.responseRows().filter({ hasText: /approved|ready/i })
    ).toBeVisible({ timeout: 10000 });
  });
});
