import { Page } from '@playwright/test';
import { AdminSurveysPage } from '../pages/admin-surveys.page';
import { CreateSurveyDialog } from '../dialogs/create-survey.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

// SEM@a2b11c7450c617ac1ba0c8f95c47efc49d0635c3: E2E page-object flow for survey admin CRUD and lifecycle actions (pure)
export class SurveyAdminFlow {
  private adminSurveysPage: AdminSurveysPage;
  private createSurveyDialog: CreateSurveyDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: initialize admin surveys page and dialog objects for the flow (pure)
  constructor(private page: Page) {
    this.adminSurveysPage = new AdminSurveysPage(page);
    this.createSurveyDialog = new CreateSurveyDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  // SEM@bb65e02191d3f75c13fdb0a10b75f2837d573933: build a new survey via dialog and await redirect to the builder
  async createSurvey(name: string, version: string) {
    await this.adminSurveysPage.createButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.createSurveyDialog.fillName(name);
    await this.createSurveyDialog.fillVersion(version);
    const postPromise = this.page.waitForResponse(
      resp => resp.url().includes('/admin/surveys') && resp.request().method() === 'POST',
      { timeout: 15000 },
    );
    await this.createSurveyDialog.submit();
    await postPromise;
    // Successful create redirects to the builder — wait for that navigation,
    // which also closes the dialog.
    await this.page.waitForURL(/\/admin\/surveys\/[a-f0-9-]+/, { timeout: 15000 });
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: navigate to the survey builder for a named survey
  async openInBuilder(name: string) {
    await this.adminSurveysPage.editButton(name).click();
    await this.page.waitForURL(/\/admin\/surveys\/[a-f0-9-]+/, { timeout: 10000 });
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: toggle a survey's active/inactive status and await API confirmation
  async toggleStatus(name: string) {
    await this.adminSurveysPage.toggleStatusButton(name).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/surveys/') && resp.status() < 300
    );
  }

  // SEM@a2b11c7450c617ac1ba0c8f95c47efc49d0635c3: duplicate a survey via the more-menu and await API confirmation
  async cloneSurvey(name: string) {
    // Use the first matching row so "Kitchen Sink Survey" doesn't also pick
    // up a prior "Kitchen Sink Survey (Copy)" leftover from earlier runs.
    const row = this.adminSurveysPage.surveyRow(name).first();
    await row.getByTestId('admin-surveys-more-button').click();
    const cloneItem = this.adminSurveysPage.cloneItem();
    await cloneItem.waitFor({ state: 'visible', timeout: 5000 });
    await cloneItem.click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/surveys') && resp.status() < 300,
      { timeout: 10000 },
    );
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: archive a survey via the more-menu and await API confirmation
  async archiveSurvey(name: string) {
    await this.adminSurveysPage.moreButton(name).click();
    await this.adminSurveysPage.archiveItem().dispatchEvent('click');
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/surveys/') && resp.status() < 300
    );
  }

  // SEM@a2b11c7450c617ac1ba0c8f95c47efc49d0635c3: delete a survey via more-menu, accept native confirm, await row removal
  async deleteSurvey(name: string) {
    // The admin-surveys delete uses the browser's native confirm() — accept
    // it once. The dialog handler must be registered before the click.
    this.page.once('dialog', dialog => {
      void dialog.accept();
    });
    await this.adminSurveysPage.moreButton(name).click();
    const deleteItem = this.adminSurveysPage.deleteItem();
    await deleteItem.waitFor({ state: 'visible', timeout: 5000 });
    await deleteItem.click();
    // Wait for the row to disappear from the list
    await this.adminSurveysPage.surveyRow(name).first().waitFor({ state: 'hidden', timeout: 10000 });
  }
}
