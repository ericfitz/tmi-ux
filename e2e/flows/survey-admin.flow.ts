import { Page } from '@playwright/test';
import { AdminSurveysPage } from '../pages/admin-surveys.page';
import { CreateSurveyDialog } from '../dialogs/create-survey.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class SurveyAdminFlow {
  private adminSurveysPage: AdminSurveysPage;
  private createSurveyDialog: CreateSurveyDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.adminSurveysPage = new AdminSurveysPage(page);
    this.createSurveyDialog = new CreateSurveyDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createSurvey(name: string, version: string) {
    await this.adminSurveysPage.createButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.createSurveyDialog.fillName(name);
    await this.createSurveyDialog.fillVersion(version);
    await this.createSurveyDialog.submit();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openInBuilder(name: string) {
    await this.adminSurveysPage.editButton(name).click();
    await this.page.waitForURL(/\/admin\/surveys\/[a-f0-9-]+/, { timeout: 10000 });
  }

  async toggleStatus(name: string) {
    await this.adminSurveysPage.toggleStatusButton(name).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/surveys/') && resp.status() < 300
    );
  }

  async cloneSurvey(name: string) {
    await this.adminSurveysPage.moreButton(name).click();
    await this.adminSurveysPage.cloneItem().dispatchEvent('click');
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/surveys') && resp.status() < 300
    );
  }

  async archiveSurvey(name: string) {
    await this.adminSurveysPage.moreButton(name).click();
    await this.adminSurveysPage.archiveItem().dispatchEvent('click');
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/surveys/') && resp.status() < 300
    );
  }

  async deleteSurvey(name: string) {
    await this.adminSurveysPage.moreButton(name).click();
    await this.adminSurveysPage.deleteItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirmDialog.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }
}
