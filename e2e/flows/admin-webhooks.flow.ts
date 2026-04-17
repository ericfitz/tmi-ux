import { Dialog, Page } from '@playwright/test';
import { AdminWebhooksPage } from '../pages/admin-webhooks.page';
import { AddWebhookDialog } from '../dialogs/add-webhook.dialog';

export class AdminWebhooksFlow {
  private adminWebhooksPage: AdminWebhooksPage;
  private addWebhookDialog: AddWebhookDialog;

  constructor(private page: Page) {
    this.adminWebhooksPage = new AdminWebhooksPage(page);
    this.addWebhookDialog = new AddWebhookDialog(page);
  }

  /**
   * Opens the add-webhook dialog, cancels it, and waits for it to close.
   * Full CRUD is not exercised here because the form requires a real backend
   * to accept the webhook URL and event types during create, and delete
   * requires an existing webhook to be present first.
   */
  async openAndCancelAddDialog() {
    await this.adminWebhooksPage.addButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.addWebhookDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async deleteWebhook(name: string) {
    await this.adminWebhooksPage.moreButton(name).click();
    const dialogHandler = (dialog: Dialog) => void dialog.accept();
    this.page.once('dialog', dialogHandler);
    await this.adminWebhooksPage.deleteItem().dispatchEvent('click');
  }
}
