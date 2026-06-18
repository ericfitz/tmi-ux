import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: E2E page object for the add-webhook dialog; wraps form locators and actions
export class AddWebhookDialog {
  private dialog: Locator;

  // SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: bind the Playwright page and locate the dialog container (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('add-webhook-name-input');
  readonly urlInput = () => this.dialog.getByTestId('add-webhook-url-input');
  readonly eventsSelect = () => this.dialog.getByTestId('add-webhook-events-select');
  readonly secretInput = () => this.dialog.getByTestId('add-webhook-secret-input');
  readonly cancelButton = () => this.dialog.getByTestId('add-webhook-cancel-button');
  readonly submitButton = () => this.dialog.getByTestId('add-webhook-submit-button');

  // SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: fill the webhook name field in the dialog
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: fill the webhook URL field in the dialog
  async fillUrl(url: string) {
    await angularFill(this.urlInput(), url);
  }

  // SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: click the dialog submit button to confirm webhook creation
  async submit() {
    await this.submitButton().click();
  }

  // SEM@b337814923ae2be9b7706ea2a73bf1e72dbc7de4: click the dialog cancel button to dismiss without saving
  async cancel() {
    await this.cancelButton().click();
  }
}
