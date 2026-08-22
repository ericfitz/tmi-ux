import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';

/**
 * Tests that each SurveyJS question type renders correctly and accepts input.
 * Uses the seeded Kitchen Sink Survey which has all 8 question types.
 */
userTest.describe('Survey Fill Field Coverage (SurveyJS Question Types)', () => {
  userTest.setTimeout(60000);

  /**
   * Advance `pages` pages past the first one.
   *
   * Page 1 (basicInputs) declares `project_name` as `isRequired`, so SurveyJS
   * refuses to leave it while that field is empty -- clicking Next just
   * re-renders page 1 with a validation error. Every question on pages 2-4
   * then resolves to "element(s) not found". Fill the required field first so
   * navigation actually happens.
   */
  async function advancePages(fillFlow: SurveyFillFlow, pages: number): Promise<void> {
    await fillFlow.fillTextField('project_name', 'E2E Field Coverage Project');
    for (let i = 0; i < pages; i++) {
      await fillFlow.nextPage();
    }
  }

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

    // Assert on the rendered question, not on `.sd-boolean__switch`: that is
    // the decorative track, present in the DOM but never visible, so the
    // original visibility assert could only ever fail.
    const question = userPage.locator('.sd-question[data-name="has_external_users"]');
    await expect(question).toBeVisible();

    // The control itself is an <input type="checkbox" role="switch"> that
    // SurveyJS renders `sd-visuallyhidden` behind the styled track, so assert
    // its state rather than its box. It starts indeterminate (neither
    // Yes nor No), which reads as unchecked.
    const boolSwitch = question.getByRole('switch');
    await expect(boolSwitch).toBeEnabled();
    await expect(boolSwitch).not.toBeChecked();

    await fillFlow.toggleBoolean('has_external_users');

    // Verify the toggle actually took. The original assertion here only
    // re-checked that the question was visible, which can never fail, so a
    // silent no-op toggle would have passed.
    await expect(boolSwitch).toBeChecked();
  });

  userTest('radiogroup renders and accepts selection', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');
    await advancePages(fillFlow, 1); // Page 2: Selection Inputs

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
    await advancePages(fillFlow, 1); // Page 2

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
    await advancePages(fillFlow, 1); // Page 2

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
    await advancePages(fillFlow, 3); // Page 4: Grouped Inputs

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
    await advancePages(fillFlow, 3); // Page 4: Grouped Inputs

    // paneldynamic should show the first panel with template fields
    const integrationName = userPage.locator(
      '.sd-question[data-name="integration_name"] input'
    );
    await expect(integrationName).toBeVisible();
    await integrationName.fill('Auth0');
    await expect(integrationName).toHaveValue('Auth0');
  });
});
