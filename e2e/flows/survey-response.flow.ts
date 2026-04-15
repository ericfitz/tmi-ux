import { Page } from '@playwright/test';
import { SurveyListPage } from '../pages/survey-list.page';
import { MyResponsesPage } from '../pages/my-responses.page';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class SurveyResponseFlow {
  private surveyList: SurveyListPage;
  private myResponses: MyResponsesPage;
  private deleteConfirm: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.surveyList = new SurveyListPage(page);
    this.myResponses = new MyResponsesPage(page);
    this.deleteConfirm = new DeleteConfirmDialog(page);
  }

  async viewMyResponses() {
    await this.surveyList.myResponsesButton().click();
    await this.page.waitForURL(/\/intake\/my-responses/, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async viewResponse(name: string) {
    await this.myResponses.viewButton(name).click();
    await this.page.waitForURL(/\/intake\/response\//, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async continueDraft(name: string) {
    await this.myResponses.editButton(name).click();
    await this.page.waitForURL(/\/intake\/fill\//, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async deleteDraft(name: string) {
    await this.myResponses.deleteButton(name).dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirm.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }
}
