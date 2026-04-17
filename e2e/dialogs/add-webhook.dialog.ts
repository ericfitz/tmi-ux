import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class AddWebhookDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('add-webhook-name-input');
  readonly urlInput = () => this.dialog.getByTestId('add-webhook-url-input');
  readonly eventsSelect = () => this.dialog.getByTestId('add-webhook-events-select');
  readonly secretInput = () => this.dialog.getByTestId('add-webhook-secret-input');
  readonly cancelButton = () => this.dialog.getByTestId('add-webhook-cancel-button');
  readonly submitButton = () => this.dialog.getByTestId('add-webhook-submit-button');

  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  async fillUrl(url: string) {
    await angularFill(this.urlInput(), url);
  }

  async submit() {
    await this.submitButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
