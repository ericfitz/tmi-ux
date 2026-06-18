import { Page } from '@playwright/test';
import { TemplateBuilderPage } from '../pages/template-builder.page';
import { angularFill } from '../helpers/angular-fill';

// SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: E2E page-object flow for survey builder question and page actions (pure)
export class SurveyBuilderFlow {
  private builder: TemplateBuilderPage;

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: initialize the template builder page object for the flow (pure)
  constructor(private page: Page) {
    this.builder = new TemplateBuilderPage(page);
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: add a question of a given type with the specified title to the survey
  async addQuestion(type: string, title: string) {
    await this.builder.addQuestionButton(type).scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await this.builder.addQuestionButton(type).click();
    // New question is auto-selected; fill title
    await angularFill(this.builder.questionTitle(), title);
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: select a question by name in the survey builder panel
  async selectQuestion(name: string) {
    await this.builder.questionItem(name).click();
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: update one or more question property fields in the builder editor
  async editQuestionProperties(fields: {
    name?: string;
    title?: string;
    description?: string;
    required?: boolean;
    choices?: string;
    visibleIf?: string;
    enableIf?: string;
    requiredIf?: string;
  }) {
    if (fields.name !== undefined) {
      await angularFill(this.builder.questionName(), fields.name);
    }
    if (fields.title !== undefined) {
      await angularFill(this.builder.questionTitle(), fields.title);
    }
    if (fields.description !== undefined) {
      await angularFill(this.builder.questionDescription(), fields.description);
    }
    if (fields.required !== undefined) {
      const checkbox = this.builder.questionRequired();
      const input = checkbox.locator('input[type="checkbox"]');
      const isChecked = await input.isChecked();
      if (isChecked !== fields.required) {
        await checkbox.click();
      }
    }
    if (fields.choices !== undefined) {
      await angularFill(this.builder.questionChoices(), fields.choices);
    }
    if (fields.visibleIf !== undefined) {
      // Expand conditional logic panel first
      await this.page
        .locator('mat-expansion-panel')
        .filter({ hasText: /Conditional Logic/i })
        .locator('mat-expansion-panel-header')
        .click();
      await this.page.waitForTimeout(300);
      await angularFill(this.builder.questionVisibleIf(), fields.visibleIf);
    }
    if (fields.enableIf !== undefined) {
      await angularFill(this.builder.questionEnableIf(), fields.enableIf);
    }
    if (fields.requiredIf !== undefined) {
      await angularFill(this.builder.questionRequiredIf(), fields.requiredIf);
    }
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: set conditional visibility rule on the current survey question (pure)
  async setConditionalLogic(visibleIf: string) {
    await this.editQuestionProperties({ visibleIf });
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: select and delete a survey question by name via the builder UI
  async deleteQuestion(name: string) {
    await this.selectQuestion(name);
    await this.builder.questionDelete().scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await this.builder.questionDelete().click();
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: add a new page to the survey via the builder UI
  async addPage() {
    await this.builder.pageAdd().click();
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: delete the current page from the survey via the builder UI
  async deletePage() {
    await this.builder.pageDelete().click();
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: save the survey and wait for a successful API response
  async saveSurvey() {
    await this.builder.saveButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/surveys') && resp.status() < 300
    );
  }
}
