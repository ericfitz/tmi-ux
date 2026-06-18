import { Dialog, expect, Page } from '@playwright/test';
import { AdminGroupsPage } from '../pages/admin-groups.page';
import { AddGroupDialog } from '../dialogs/add-group.dialog';

// SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: E2E flow helper for creating and deleting admin groups (pure)
export class AdminGroupsFlow {
  private adminGroupsPage: AdminGroupsPage;
  private addGroupDialog: AddGroupDialog;

  // SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: instantiate page objects for admin groups page and add-group dialog (pure)
  constructor(private page: Page) {
    this.adminGroupsPage = new AdminGroupsPage(page);
    this.addGroupDialog = new AddGroupDialog(page);
  }

  // SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: create an admin group via the UI, filling name and optional description
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

  // SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: delete an admin group by name via the more-menu, accepting the confirm dialog
  async deleteGroup(name: string) {
    await this.adminGroupsPage.moreButton(name).click();
    // SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: accept a browser confirm dialog for group deletion (pure)
    const dialogHandler = (dialog: Dialog) => void dialog.accept();
    this.page.once('dialog', dialogHandler);
    await this.adminGroupsPage.deleteItem().dispatchEvent('click');
  }
}
