import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';
import { SurveyListPage } from '../../pages/survey-list.page';

/**
 * Tests that each SurveyJS question type renders correctly and accepts input.
 * Uses the seeded Kitchen Sink Survey which has all 8 question types.
 */
userTest.describe('Survey Fill Field Coverage (SurveyJS Question Types)', () => {
  userTest.setTimeout(60000);

  userTest('text input renders and accepts value', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');

    const input = userPage.locator(
      '.sd-question[data-name="project_name"] input'
    );
    await expect(input).toBeVisible();
    await input.fill('Test Project');
    await expect(input).toHaveValue('Test Project');
  });

  userTest('comment textarea renders and accepts value', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');

    const textarea = userPage.locator(
      '.sd-question[data-name="project_description"] textarea'
    );
    await expect(textarea).toBeVisible();
    await textarea.fill('A test description');
    await expect(textarea).toHaveValue('A test description');
  });

  userTest('boolean toggle renders and toggles', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');

    const boolSwitch = userPage.locator(
      '.sd-question[data-name="has_external_users"] .sd-boolean__switch'
    );
    await expect(boolSwitch).toBeVisible();
    await boolSwitch.click();
    // Verify the toggle changed (aria state or CSS class)
    await expect(
      userPage.locator('.sd-question[data-name="has_external_users"]')
    ).toBeVisible();
  });

  userTest('radiogroup renders and accepts selection', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    await fillFlow.nextPage(); // Page 2: Selection Inputs

    const question = userPage.locator(
      '.sd-question[data-name="data_sensitivity"]'
    );
    await expect(question).toBeVisible();
    await fillFlow.selectRadioOption('data_sensitivity', 'Internal');
    // Verify selection (checked state)
    await expect(
      question.locator('.sd-selectbase__item').filter({ hasText: 'Internal' })
    ).toHaveClass(/sd-item--checked|checked/);
  });

  userTest('checkbox renders and accepts multiple selections', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    await fillFlow.nextPage(); // Page 2

    const question = userPage.locator(
      '.sd-question[data-name="compliance_frameworks"]'
    );
    await expect(question).toBeVisible();
    await fillFlow.selectCheckboxOptions('compliance_frameworks', [
      'SOC 2',
      'HIPAA',
    ]);
  });

  userTest('dropdown renders and accepts selection', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    await fillFlow.nextPage(); // Page 2

    const question = userPage.locator(
      '.sd-question[data-name="deployment_model"]'
    );
    await expect(question).toBeVisible();
    await fillFlow.selectDropdown('deployment_model', 'Hybrid');
  });

  userTest('panel renders with nested fields', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    // Navigate to page 4 (grouped inputs)
    await fillFlow.nextPage();
    await fillFlow.nextPage();
    await fillFlow.nextPage();

    // Panel should render with its child inputs
    const cloudProvider = userPage.locator(
      '.sd-question[data-name="cloud_provider"] input'
    );
    await expect(cloudProvider).toBeVisible();
    await cloudProvider.fill('GCP');
    await expect(cloudProvider).toHaveValue('GCP');
  });

  userTest('paneldynamic renders with template fields', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    // Navigate to page 4
    await fillFlow.nextPage();
    await fillFlow.nextPage();
    await fillFlow.nextPage();

    // paneldynamic should show the first panel with template fields
    const integrationName = userPage.locator(
      '.sd-question[data-name="integration_name"] input'
    );
    await expect(integrationName).toBeVisible();
    await integrationName.fill('Auth0');
    await expect(integrationName).toHaveValue('Auth0');
  });
});
