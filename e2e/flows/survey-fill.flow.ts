import { Page } from '@playwright/test';
import { SurveyListPage } from '../pages/survey-list.page';
import { SurveyFillPage } from '../pages/survey-fill.page';

// SEM@4d1ae8d848f8dafdf34112b217e749ce577b2a74: E2E flow helper for filling and submitting a survey response
export class SurveyFillFlow {
  private surveyList: SurveyListPage;
  private surveyFill: SurveyFillPage;

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: initialize survey list and fill page objects for the flow (pure)
  constructor(private page: Page) {
    this.surveyList = new SurveyListPage(page);
    this.surveyFill = new SurveyFillPage(page);
  }

  // SEM@bb65e02191d3f75c13fdb0a10b75f2837d573933: navigate to the survey fill page, handling the confidential-model dialog if shown
  async startSurvey(name: string, confidential = false) {
    await this.surveyList.startButton(name).click();
    // If the confidential-threat-models feature flag is on, a yes/no dialog
    // appears before navigation. Answer it if present.
    const confidentialNo = this.page.getByTestId('confidential-no-button');
    if (await confidentialNo.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (confidential) {
        await this.page.getByTestId('confidential-yes-button').click();
      } else {
        await confidentialNo.click();
      }
    }
    await this.page.waitForURL(/\/intake\/fill\//, { timeout: 10000 });
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: fill a text input survey question with the given value
  async fillTextField(name: string, value: string) {
    const input = this.page.locator(`.sd-question[data-name="${name}"] input`);
    await input.fill(value);
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: fill a textarea comment survey question with the given value
  async fillCommentField(name: string, value: string) {
    const textarea = this.page.locator(`.sd-question[data-name="${name}"] textarea`);
    await textarea.fill(value);
  }

  // SEM@4d1ae8d848f8dafdf34112b217e749ce577b2a74: select a radio option on a survey question by label text
  async selectRadioOption(name: string, value: string) {
    // Click the underlying input directly so SurveyJS registers the change
    // even if label elements intercept clicks.
    const item = this.page
      .locator(`.sd-question[data-name="${name}"] .sd-selectbase__item`)
      .filter({ hasText: value });
    await item.first().scrollIntoViewIfNeeded();
    const input = item.first().locator('input[type="radio"]');
    if (await input.count()) {
      await input.check({ force: true });
    } else {
      await item.first().click({ force: true });
    }
  }

  // SEM@4d1ae8d848f8dafdf34112b217e749ce577b2a74: check one or more checkbox options on a survey question by label text
  async selectCheckboxOptions(name: string, values: string[]) {
    for (const value of values) {
      const item = this.page
        .locator(`.sd-question[data-name="${name}"] .sd-selectbase__item`)
        .filter({ hasText: value });
      await item.first().scrollIntoViewIfNeeded();
      const input = item.first().locator('input[type="checkbox"]');
      if (await input.count()) {
        await input.check({ force: true });
      } else {
        await item.first().click({ force: true });
      }
    }
  }

  // SEM@94e422a4581c6682cbbb082af50f5ab97a4bb739: open a dropdown survey question and select an option by exact label
  async selectDropdown(name: string, value: string) {
    const trigger = this.page.locator(`.sd-question[data-name="${name}"] .sd-dropdown`);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const option = this.page
      .locator('.sv-popup__container .sv-list__item')
      .filter({ hasText: new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) });
    await option.first().waitFor({ state: 'visible', timeout: 5000 });
    await option.first().click({ force: true });
  }

  // SEM@94e422a4581c6682cbbb082af50f5ab97a4bb739: toggle a boolean yes/no survey question to the affirmative value
  async toggleBoolean(name: string) {
    // Click the "Yes" text inside the boolean toggle. The centered switch
    // knob sometimes intercepts clicks, so target the visible label.
    const question = this.page.locator(`.sd-question[data-name="${name}"]`);
    const yesText = question.getByText(/^Yes$/).first();
    if (await yesText.isVisible({ timeout: 1000 }).catch(() => false)) {
      await yesText.click();
      return;
    }
    await question.locator('.sd-boolean__switch').click({ force: true });
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: advance to the next survey page via the navigation button
  async nextPage() {
    await this.page.locator('.sd-navigation__next-btn').click();
    await this.page.waitForTimeout(300);
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: navigate back to the previous survey page via the navigation button
  async prevPage() {
    await this.page.locator('.sd-navigation__prev-btn').click();
    await this.page.waitForTimeout(300);
  }

  // SEM@7cbd1a4a9519eb72ea7f3f46e9a76e4e192159d2: submit the completed survey and wait for a successful API response
  async completeSurvey() {
    await this.page.locator('.sd-navigation__complete-btn').click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/survey_responses') && resp.status() < 300
    );
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: submit the completed survey response (delegates to completeSurvey)
  async submitSurvey() {
    await this.completeSurvey();
  }

  // SEM@7cbd1a4a9519eb72ea7f3f46e9a76e4e192159d2: save a draft survey response and wait for a successful API response
  async saveAndExit() {
    await this.surveyFill.saveExitButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/survey_responses') && resp.status() < 300
    );
  }
}
