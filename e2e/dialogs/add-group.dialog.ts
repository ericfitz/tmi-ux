import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: E2E page object for the add-group dialog; wraps form locators and actions
export class AddGroupDialog {
  private dialog: Locator;

  // SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: bind the Playwright page and locate the dialog container (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('add-group-name-input');
  readonly identifierInput = () => this.dialog.getByTestId('add-group-identifier-input');
  readonly descriptionInput = () => this.dialog.getByTestId('add-group-description-input');
  readonly cancelButton = () => this.dialog.getByTestId('add-group-cancel-button');
  readonly submitButton = () => this.dialog.getByTestId('add-group-submit-button');

  // SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: fill the group name field in the dialog
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: fill the group description field in the dialog
  async fillDescription(description: string) {
    await angularFill(this.descriptionInput(), description);
  }

  // SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: click the dialog submit button to confirm group creation
  async submit() {
    await this.submitButton().click();
  }

  // SEM@8b364d8d1d4a8b0c8c877c426018225ce1a7ad74: click the dialog cancel button to dismiss without saving
  async cancel() {
    await this.cancelButton().click();
  }
}
