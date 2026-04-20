import { Page } from '@playwright/test';
import { SurveyListPage } from '../pages/survey-list.page';
import { SurveyFillPage } from '../pages/survey-fill.page';

export class SurveyFillFlow {
  private surveyList: SurveyListPage;
  private surveyFill: SurveyFillPage;

  constructor(private page: Page) {
    this.surveyList = new SurveyListPage(page);
    this.surveyFill = new SurveyFillPage(page);
  }

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

  async fillTextField(name: string, value: string) {
    const input = this.page.locator(`.sd-question[data-name="${name}"] input`);
    await input.fill(value);
  }

  async fillCommentField(name: string, value: string) {
    const textarea = this.page.locator(`.sd-question[data-name="${name}"] textarea`);
    await textarea.fill(value);
  }

  async selectRadioOption(name: string, value: string) {
    const item = this.page
      .locator(`.sd-question[data-name="${name}"] .sd-selectbase__item`)
      .filter({ hasText: new RegExp(`^\\s*${value}\\s*$`) });
    await item.first().scrollIntoViewIfNeeded();
    await item.first().click({ force: true });
  }

  async selectCheckboxOptions(name: string, values: string[]) {
    for (const value of values) {
      const item = this.page
        .locator(`.sd-question[data-name="${name}"] .sd-selectbase__item`)
        .filter({ hasText: new RegExp(`^\\s*${value}\\s*$`) });
      await item.first().scrollIntoViewIfNeeded();
      await item.first().click({ force: true });
    }
  }

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

  async nextPage() {
    await this.page.locator('.sd-navigation__next-btn').click();
    await this.page.waitForTimeout(300);
  }

  async prevPage() {
    await this.page.locator('.sd-navigation__prev-btn').click();
    await this.page.waitForTimeout(300);
  }

  async completeSurvey() {
    await this.page.locator('.sd-navigation__complete-btn').click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/survey_responses') && resp.status() < 300
    );
  }

  async submitSurvey() {
    await this.completeSurvey();
  }

  async saveAndExit() {
    await this.surveyFill.saveExitButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/survey_responses') && resp.status() < 300
    );
  }
}
