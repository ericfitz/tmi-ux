import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';
import { SurveyResponseFlow } from '../../flows/survey-response.flow';
import { SurveyListPage } from '../../pages/survey-list.page';
import { SurveyFillPage } from '../../pages/survey-fill.page';
import { MyResponsesPage } from '../../pages/my-responses.page';

test.describe.serial('Survey Fill Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let fillFlow: SurveyFillFlow;
  let responseFlow: SurveyResponseFlow;
  let surveyList: SurveyListPage;
  let surveyFill: SurveyFillPage;
  let myResponses: MyResponsesPage;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    fillFlow = new SurveyFillFlow(page);
    responseFlow = new SurveyResponseFlow(page);
    surveyList = new SurveyListPage(page);
    surveyFill = new SurveyFillPage(page);
    myResponses = new MyResponsesPage(page);

    await new AuthFlow(page).loginAs('test-user');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('survey list shows active surveys', async () => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    // Verify seeded active surveys are visible
    await expect(surveyList.surveyCard('Kitchen Sink Survey')).toBeVisible();
    await expect(surveyList.surveyCard('Simple Workflow Survey')).toBeVisible();
  });

  test('fill simple survey', async () => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    await fillFlow.startSurvey('Simple Workflow Survey');

    // Fill all fields on the single page
    await fillFlow.fillTextField('system_name', `E2E Test System ${Date.now()}`);
    await fillFlow.fillCommentField('review_reason', 'Automated E2E testing');
    await fillFlow.selectRadioOption('urgency', 'Medium');

    // Submit
    await fillFlow.submitSurvey();

    // Verify success state
    await expect(surveyFill.viewResponseButton()).toBeVisible({ timeout: 10000 });
    await expect(surveyFill.startAnotherButton()).toBeVisible();
  });

  test('fill kitchen sink survey with conditional logic', async () => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    await fillFlow.startSurvey('Kitchen Sink Survey');

    // Page 1: Basic Inputs
    await fillFlow.fillTextField('project_name', `KS Project ${Date.now()}`);
    await fillFlow.fillCommentField(
      'project_description',
      'A comprehensive test project'
    );
    await fillFlow.toggleBoolean('has_external_users');
    await fillFlow.nextPage();

    // Page 2: Selection Inputs
    await fillFlow.selectRadioOption('data_sensitivity', 'Confidential');
    await fillFlow.selectCheckboxOptions('compliance_frameworks', [
      'SOC 2',
      'GDPR',
    ]);
    await fillFlow.selectDropdown('deployment_model', 'Cloud (SaaS)');
    await fillFlow.nextPage();

    // Page 3: Conditional Logic
    // Select "Yes" for stores_pii — conditional fields should appear
    await fillFlow.selectRadioOption('stores_pii', 'Yes');
    const piiDetails = page.locator(
      '.sd-question[data-name="pii_details"]'
    );
    await expect(piiDetails).toBeVisible({ timeout: 5000 });
    await fillFlow.fillCommentField(
      'pii_details',
      'Names and email addresses stored in encrypted DB'
    );
    await fillFlow.fillTextField('pii_retention_days', '365');

    // Verify conditional hiding: select "No" and verify fields hide
    await fillFlow.selectRadioOption('stores_pii', 'No');
    await expect(piiDetails).toBeHidden({ timeout: 5000 });

    // Re-select "Yes" to keep data for submission
    await fillFlow.selectRadioOption('stores_pii', 'Yes');
    await fillFlow.nextPage();

    // Page 4: Grouped Inputs
    await fillFlow.fillTextField('cloud_provider', 'AWS');
    await fillFlow.fillTextField('region', 'us-east-1');
    // paneldynamic — fill the default first panel
    await fillFlow.fillTextField('integration_name', 'Stripe API');
    await fillFlow.selectDropdown('integration_type', 'API');

    // Submit
    await fillFlow.submitSurvey();
    await expect(surveyFill.viewResponseButton()).toBeVisible({ timeout: 10000 });
  });

  test('draft auto-save', async () => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    await fillFlow.startSurvey('Simple Workflow Survey');

    // Fill partially
    const partialName = `Draft Test ${Date.now()}`;
    await fillFlow.fillTextField('system_name', partialName);
    await fillFlow.fillCommentField('review_reason', 'Partial draft');

    // Save and exit
    await fillFlow.saveAndExit();

    // Navigate back to intake
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    // Verify draft appears
    await expect(
      surveyList.surveyCard('Simple Workflow Survey')
    ).toContainText(/draft/i, { timeout: 10000 });
  });

  test('my responses list and filter', async () => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');

    await responseFlow.viewMyResponses();

    // Verify submitted responses appear
    await expect(myResponses.responseRows().first()).toBeVisible({
      timeout: 10000,
    });

    // Filter by submitted status
    await myResponses.statusFilter().click();
    await page.locator('mat-option').filter({ hasText: /submitted/i }).click();
    await page.keyboard.press('Escape');
    await page.waitForLoadState('networkidle');

    // Verify filtered results
    const rowCount = await myResponses.responseRows().count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('view completed response', async () => {
    await page.goto('/intake');
    await page.waitForLoadState('networkidle');
    await responseFlow.viewMyResponses();

    // Click view on the first submitted response
    const firstRow = myResponses.responseRows().first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();

    // Verify response detail loads
    await page.waitForURL(/\/intake\/response\//, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify read-only display shows status
    const statusChip = page.getByTestId('response-detail-status');
    await expect(statusChip).toBeVisible();
  });
});
