import { test, expect, BrowserContext, Page, chromium } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';
import { SurveyResponseFlow } from '../../flows/survey-response.flow';
import { SurveyListPage } from '../../pages/survey-list.page';
import { SurveyFillPage } from '../../pages/survey-fill.page';
import { MyResponsesPage } from '../../pages/my-responses.page';
import { testConfig } from '../../config/test.config';

const SIMPLE_WORKFLOW_JSON = {
  title: 'Quick Security Review Request',
  description: 'Submit a request for security review',
  pages: [
    {
      name: 'request',
      title: 'Review Request',
      elements: [
        { type: 'text', name: 'system_name', title: 'System Name', isRequired: true },
        { type: 'comment', name: 'review_reason', title: 'Reason for Review Request' },
        {
          type: 'radiogroup',
          name: 'urgency',
          title: 'Urgency',
          choices: [
            { value: 'low', text: 'Low' },
            { value: 'medium', text: 'Medium' },
            { value: 'high', text: 'High' },
          ],
        },
      ],
    },
  ],
};

const KITCHEN_SINK_JSON = {
  title: 'Kitchen Sink Survey',
  description: 'Comprehensive survey for E2E testing',
  pages: [
    {
      name: 'basicInputs',
      title: 'Basic Inputs',
      elements: [
        { type: 'text', name: 'project_name', title: 'Project Name', isRequired: true },
        { type: 'comment', name: 'project_description', title: 'Describe Your Project' },
        {
          type: 'boolean',
          name: 'has_external_users',
          title: 'Does this project have external users?',
          labelTrue: 'Yes',
          labelFalse: 'No',
        },
      ],
    },
    {
      name: 'selectionInputs',
      title: 'Selection Inputs',
      elements: [
        {
          type: 'radiogroup',
          name: 'data_sensitivity',
          title: 'Data Sensitivity Level',
          choices: [
            { value: 'public', text: 'Public' },
            { value: 'internal', text: 'Internal' },
            { value: 'confidential', text: 'Confidential' },
            { value: 'restricted', text: 'Restricted' },
          ],
        },
        {
          type: 'checkbox',
          name: 'compliance_frameworks',
          title: 'Applicable Compliance Frameworks',
          choices: [
            { value: 'soc2', text: 'SOC 2' },
            { value: 'hipaa', text: 'HIPAA' },
            { value: 'pci', text: 'PCI DSS' },
            { value: 'gdpr', text: 'GDPR' },
          ],
        },
        {
          type: 'dropdown',
          name: 'deployment_model',
          title: 'Deployment Model',
          choices: [
            { value: 'cloud', text: 'Cloud (SaaS)' },
            { value: 'on_prem', text: 'On-Premises' },
            { value: 'hybrid', text: 'Hybrid' },
          ],
        },
      ],
    },
    {
      name: 'conditionalLogic',
      title: 'Conditional Logic',
      elements: [
        {
          type: 'radiogroup',
          name: 'stores_pii',
          title: 'Does this system store PII?',
          choices: [
            { value: 'yes', text: 'Yes' },
            { value: 'no', text: 'No' },
          ],
        },
        {
          type: 'comment',
          name: 'pii_details',
          title: 'Describe what PII is stored and how it is protected',
          visibleIf: "{stores_pii} = 'yes'",
        },
        {
          type: 'text',
          name: 'pii_retention_days',
          title: 'PII retention period (days)',
          inputType: 'number',
          visibleIf: "{stores_pii} = 'yes'",
        },
      ],
    },
    {
      name: 'groupedInputs',
      title: 'Grouped Inputs',
      elements: [
        {
          type: 'panel',
          name: 'infrastructure_panel',
          title: 'Infrastructure Details',
          elements: [
            { type: 'text', name: 'cloud_provider', title: 'Cloud Provider' },
            { type: 'text', name: 'region', title: 'Primary Region' },
          ],
        },
        {
          type: 'paneldynamic',
          name: 'integrations',
          title: 'Third-Party Integrations',
          templateTitle: 'Integration #{panelIndex}',
          templateElements: [
            { type: 'text', name: 'integration_name', title: 'Integration Name' },
            {
              type: 'dropdown',
              name: 'integration_type',
              title: 'Integration Type',
              choices: [
                { value: 'api', text: 'API' },
                { value: 'sdk', text: 'SDK' },
                { value: 'webhook', text: 'Webhook' },
              ],
            },
          ],
          panelCount: 1,
          minPanelCount: 0,
          maxPanelCount: 5,
        },
      ],
    },
  ],
};

/**
 * Populate the seeded fill-test surveys with their expected schemas if the
 * server's copy is missing questions (the deployment seed doesn't always
 * apply survey_json). Runs in a throwaway test-admin context so the main
 * test-user session isn't disturbed.
 */
async function ensureSeededSurveySchemas(): Promise<void> {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await new AuthFlow(page).loginAs('test-admin');
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      async (args: {
        api: string;
        targets: { name: string; survey_json: unknown }[];
      }) => {
        const listRes = await fetch(`${args.api}/admin/surveys?limit=100`, {
          credentials: 'include',
        });
        if (!listRes.ok) return;
        const list = await listRes.json();
        for (const target of args.targets) {
          const match = (list.surveys || []).find(
            (s: { name: string; survey_json?: { pages?: { elements?: unknown[] }[] } }) =>
              s.name === target.name,
          );
          if (!match) continue;
          const pages = match.survey_json?.pages ?? [];
          const hasQuestions = pages.some(
            (p: { elements?: unknown[] }) => (p.elements ?? []).length > 0,
          );
          if (hasQuestions) continue;
          await fetch(`${args.api}/admin/surveys/${match.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              name: target.name,
              version: match.version ?? 'v1-seed',
              description: match.description,
              status: 'active',
              survey_json: target.survey_json,
            }),
          });
        }
      },
      {
        api: testConfig.apiUrl,
        targets: [
          { name: 'Simple Workflow Survey', survey_json: SIMPLE_WORKFLOW_JSON },
          { name: 'Kitchen Sink Survey', survey_json: KITCHEN_SINK_JSON },
        ],
      },
    );
    await ctx.close();
  } finally {
    await browser.close();
  }
}

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

    await ensureSeededSurveySchemas();

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
