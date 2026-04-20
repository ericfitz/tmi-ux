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
    await this.page
      .locator(`.sd-question[data-name="${name}"] .sd-selectbase__item`)
      .filter({ hasText: value })
      .click();
  }

  async selectCheckboxOptions(name: string, values: string[]) {
    for (const value of values) {
      await this.page
        .locator(`.sd-question[data-name="${name}"] .sd-selectbase__item`)
        .filter({ hasText: value })
        .click();
    }
  }

  async selectDropdown(name: string, value: string) {
    await this.page.locator(`.sd-question[data-name="${name}"] .sd-dropdown`).click();
    await this.page
      .locator('.sv-popup__container .sv-list__item')
      .filter({ hasText: value })
      .click();
  }

  async toggleBoolean(name: string) {
    await this.page
      .locator(`.sd-question[data-name="${name}"] .sd-boolean__switch`)
      .click();
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
      (resp) => resp.url().includes('/responses') && resp.status() < 300
    );
  }

  async submitSurvey() {
    await this.completeSurvey();
  }

  async saveAndExit() {
    await this.surveyFill.saveExitButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/responses') && resp.status() < 300
    );
  }
}
