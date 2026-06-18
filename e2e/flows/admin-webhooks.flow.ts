import { Dialog, Page } from '@playwright/test';
import { AdminWebhooksPage } from '../pages/admin-webhooks.page';
import { AddWebhookDialog } from '../dialogs/add-webhook.dialog';

// SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: E2E flow helper for admin webhook UI; open/cancel dialog and delete webhook
export class AdminWebhooksFlow {
  private adminWebhooksPage: AdminWebhooksPage;
  private addWebhookDialog: AddWebhookDialog;

  // SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: initialize page object references for webhook admin flow
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
  // SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: open add-webhook dialog and cancel without submitting
  async openAndCancelAddDialog() {
    await this.adminWebhooksPage.addButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.addWebhookDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: delete a named webhook via the more menu and browser confirm dialog
  async deleteWebhook(name: string) {
    await this.adminWebhooksPage.moreButton(name).click();
    // SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: accept the browser confirm dialog for webhook deletion (pure)
    const dialogHandler = (dialog: Dialog) => void dialog.accept();
    this.page.once('dialog', dialogHandler);
    await this.adminWebhooksPage.deleteItem().dispatchEvent('click');
  }
}
