import { Page } from '@playwright/test';
import { SurveyListPage } from '../pages/survey-list.page';
import { MyResponsesPage } from '../pages/my-responses.page';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

// SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: E2E flow helper for viewing and managing submitted survey responses
export class SurveyResponseFlow {
  private surveyList: SurveyListPage;
  private myResponses: MyResponsesPage;
  private deleteConfirm: DeleteConfirmDialog;

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: initialize survey list, responses, and delete-confirm page objects (pure)
  constructor(private page: Page) {
    this.surveyList = new SurveyListPage(page);
    this.myResponses = new MyResponsesPage(page);
    this.deleteConfirm = new DeleteConfirmDialog(page);
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: navigate to the user's survey responses list page
  async viewMyResponses() {
    await this.surveyList.myResponsesButton().click();
    await this.page.waitForURL(/\/intake\/my-responses/, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: navigate to a specific submitted survey response by name
  async viewResponse(name: string) {
    await this.myResponses.viewButton(name).click();
    await this.page.waitForURL(/\/intake\/response\//, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: resume editing a saved draft survey response by name
  async continueDraft(name: string) {
    await this.myResponses.editButton(name).click();
    await this.page.waitForURL(/\/intake\/fill\//, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  // SEM@8f4bc8b208830c08587730fd41c0e3df7e687005: delete a draft survey response by name and confirm deletion dialog
  async deleteDraft(name: string) {
    await this.myResponses.deleteButton(name).dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirm.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }
}
