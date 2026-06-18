import { Locator, Page } from '@playwright/test';

// SEM@59474862db1ccee537e9baf62e9f21022290763f: page object for the team members dialog; add, remove, save, or cancel
export class TeamMembersDialog {
  private dialog: Locator;

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: bind the team members page object to the Playwright page (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly memberRows = () => this.dialog.getByTestId('team-members-row');
  readonly addButton = () => this.dialog.getByTestId('team-members-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('team-members-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('team-members-save-button');

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: fetch the remove locator for a team member row by index (pure)
  removeButton(index: number) {
    return this.memberRows().nth(index).getByTestId('team-members-remove-button');
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: submit the team-members dialog by clicking the save button
  async save() {
    await this.saveButton().click();
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: dismiss the team-members dialog by clicking the cancel button
  async cancel() {
    await this.cancelButton().click();
  }
}
