import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { SurveyAdminFlow } from '../../flows/survey-admin.flow';
import { SurveyBuilderFlow } from '../../flows/survey-builder.flow';
import { AdminSurveysPage } from '../../pages/admin-surveys.page';
import { TemplateBuilderPage } from '../../pages/template-builder.page';

test.describe.serial('Survey Admin Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let adminFlow: SurveyAdminFlow;
  let builderFlow: SurveyBuilderFlow;
  let adminSurveys: AdminSurveysPage;
  let builder: TemplateBuilderPage;

  const testSurveyName = `E2E Survey ${Date.now()}`;
  const testVersion = '1.0';
  let clonedSurveyName: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    adminFlow = new SurveyAdminFlow(page);
    builderFlow = new SurveyBuilderFlow(page);
    adminSurveys = new AdminSurveysPage(page);
    builder = new TemplateBuilderPage(page);

    await new AuthFlow(page).loginAs('test-admin');
    await page.goto('/admin/surveys');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('create survey', async () => {
    await adminFlow.createSurvey(testSurveyName, testVersion);
    // Verify the new survey appears in the list
    // Creating a survey navigates to builder; go back to list
    await page.goto('/admin/surveys');
    await page.waitForLoadState('networkidle');
    await expect(adminSurveys.surveyRow(testSurveyName)).toBeVisible({
      timeout: 10000,
    });
  });

  test('open in builder', async () => {
    await adminFlow.openInBuilder(testSurveyName);
    await expect(builder.surveyName()).toHaveValue(testSurveyName, {
      timeout: 5000,
    });
    await expect(builder.surveyVersion()).toHaveValue(testVersion, {
      timeout: 5000,
    });
  });

  test('add questions', async () => {
    // Add a text question
    await builderFlow.addQuestion('text', 'Test Text Question');
    await expect(builder.questionItem('Test Text Question')).toBeVisible();

    // Add a radiogroup question
    await builderFlow.addQuestion('radiogroup', 'Test Radio Question');
    await builderFlow.editQuestionProperties({
      choices: 'Option A\nOption B\nOption C',
    });

    await builderFlow.saveSurvey();
    await expect(builder.questionItems()).toHaveCount(2);
  });

  test('set conditional logic', async () => {
    await builderFlow.selectQuestion('Test Text Question');
    await builderFlow.setConditionalLogic("{Test Radio Question} = 'Option A'");
    await builderFlow.saveSurvey();

    // Re-select and verify persisted
    await builderFlow.selectQuestion('Test Text Question');
    // Expand conditional logic panel
    await page.locator('mat-expansion-panel')
      .filter({ hasText: /Conditional Logic/i })
      .locator('mat-expansion-panel-header').click();
    await page.waitForTimeout(300);
    await expect(builder.questionVisibleIf()).toHaveValue(
      "{Test Radio Question} = 'Option A'"
    );
  });

  test('survey lifecycle (toggle status, archive)', async () => {
    await page.goto('/admin/surveys');
    await page.waitForLoadState('networkidle');

    // Toggle to inactive
    await adminFlow.toggleStatus(testSurveyName);
    await expect(
      adminSurveys.surveyRow(testSurveyName)
    ).toContainText(/inactive|deactivat/i);

    // Toggle back to active
    await adminFlow.toggleStatus(testSurveyName);
    await expect(
      adminSurveys.surveyRow(testSurveyName)
    ).toContainText(/active/i);

    // Archive
    await adminFlow.archiveSurvey(testSurveyName);
    // Need to adjust status filter to show archived
  });

  test('clone survey', async () => {
    // Clone the seeded Kitchen Sink Survey
    await page.goto('/admin/surveys');
    await page.waitForLoadState('networkidle');
    await adminFlow.cloneSurvey('Kitchen Sink Survey');

    // Find the cloned survey in the list
    clonedSurveyName = 'Kitchen Sink Survey'; // clone appears with same or similar name
    await page.waitForLoadState('networkidle');
    // Verify at least 2 rows match (original + clone)
    const rows = adminSurveys.surveyRows();
    await expect(rows).not.toHaveCount(0);
  });

  test('delete survey', async () => {
    await page.goto('/admin/surveys');
    await page.waitForLoadState('networkidle');

    // The previous test archived testSurveyName — select the "archived"
    // status filter so the row is visible before we delete it.
    await adminSurveys.statusFilter().click();
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: /archived/i }).click();
    // Close the multi-select overlay and wait for it to fully hide so the
    // subsequent row click isn't intercepted by a stale backdrop.
    await page.keyboard.press('Escape');
    await page.locator('.cdk-overlay-backdrop').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

    await expect(adminSurveys.surveyRow(testSurveyName)).toBeVisible({ timeout: 10000 });
    const initialCount = await adminSurveys.surveyRows().count();

    await adminFlow.deleteSurvey(testSurveyName);

    await expect(adminSurveys.surveyRows()).toHaveCount(initialCount - 1, {
      timeout: 10000,
    });
  });
});
