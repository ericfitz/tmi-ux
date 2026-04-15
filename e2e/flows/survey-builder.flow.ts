import { Page } from '@playwright/test';
import { TemplateBuilderPage } from '../pages/template-builder.page';
import { angularFill } from '../helpers/angular-fill';

export class SurveyBuilderFlow {
  private builder: TemplateBuilderPage;

  constructor(private page: Page) {
    this.builder = new TemplateBuilderPage(page);
  }

  async addQuestion(type: string, title: string) {
    await this.builder.addQuestionButton(type).scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await this.builder.addQuestionButton(type).click();
    // New question is auto-selected; fill title
    await angularFill(this.builder.questionTitle(), title);
  }

  async selectQuestion(name: string) {
    await this.builder.questionItem(name).click();
  }

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

  async setConditionalLogic(visibleIf: string) {
    await this.editQuestionProperties({ visibleIf });
  }

  async deleteQuestion(name: string) {
    await this.selectQuestion(name);
    await this.builder.questionDelete().scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await this.builder.questionDelete().click();
  }

  async addPage() {
    await this.builder.pageAdd().click();
  }

  async deletePage() {
    await this.builder.pageDelete().click();
  }

  async saveSurvey() {
    await this.builder.saveButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/surveys') && resp.status() < 300
    );
  }
}
