import { Dialog, expect, Page } from '@playwright/test';
import { AdminGroupsPage } from '../pages/admin-groups.page';
import { AddGroupDialog } from '../dialogs/add-group.dialog';

export class AdminGroupsFlow {
  private adminGroupsPage: AdminGroupsPage;
  private addGroupDialog: AddGroupDialog;

  constructor(private page: Page) {
    this.adminGroupsPage = new AdminGroupsPage(page);
    this.addGroupDialog = new AddGroupDialog(page);
  }

  async createGroup(name: string, description?: string) {
    await this.adminGroupsPage.addButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.addGroupDialog.fillName(name);
    if (description) {
      await this.addGroupDialog.fillDescription(description);
    }
    await this.addGroupDialog.submitButton().waitFor({ state: 'visible' });
    await expect(this.addGroupDialog.submitButton()).toBeEnabled({ timeout: 5000 });
    await this.addGroupDialog.submit();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async deleteGroup(name: string) {
    await this.adminGroupsPage.moreButton(name).click();
    const dialogHandler = (dialog: Dialog) => void dialog.accept();
    this.page.once('dialog', dialogHandler);
    await this.adminGroupsPage.deleteItem().dispatchEvent('click');
  }
}
