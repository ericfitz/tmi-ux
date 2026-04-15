import { Locator, Page } from '@playwright/test';

export class TeamMembersDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly memberRows = () => this.dialog.getByTestId('team-members-row');
  readonly addButton = () => this.dialog.getByTestId('team-members-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('team-members-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('team-members-save-button');

  removeButton(index: number) {
    return this.memberRows().nth(index).getByTestId('team-members-remove-button');
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
