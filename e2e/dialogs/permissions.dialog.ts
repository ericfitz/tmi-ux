import { Locator, Page } from '@playwright/test';

export class PermissionsDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly addButton = () => this.dialog.getByTestId('permissions-add-button');
  readonly saveButton = () => this.dialog.getByTestId('permissions-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('permissions-cancel-button');
  readonly typeSelects = () => this.dialog.getByTestId('permissions-type-select');
  readonly providerSelects = () => this.dialog.getByTestId('permissions-provider-select');
  readonly subjectInputs = () => this.dialog.getByTestId('permissions-subject-input');
  readonly roleSelects = () => this.dialog.getByTestId('permissions-role-select');
  readonly deleteButtons = () => this.dialog.getByTestId('permissions-delete-button');
  readonly setOwnerButtons = () => this.dialog.getByTestId('permissions-set-owner-button');
  readonly rows = () => this.dialog.locator('tr.mat-mdc-row');

  typeSelect(index: number): Locator {
    return this.typeSelects().nth(index);
  }

  providerSelect(index: number): Locator {
    return this.providerSelects().nth(index);
  }

  subjectInput(index: number): Locator {
    return this.subjectInputs().nth(index);
  }

  roleSelect(index: number): Locator {
    return this.roleSelects().nth(index);
  }

  deleteButton(index: number): Locator {
    return this.deleteButtons().nth(index);
  }

  async addPermission(type: string, provider: string, subject: string, role: string) {
    await this.addButton().click();
    const lastIndex = (await this.typeSelects().count()) - 1;

    await this.typeSelect(lastIndex).click();
    await this.page.locator('mat-option').filter({ hasText: type }).click();

    await this.providerSelect(lastIndex).click();
    await this.page.locator('mat-option').filter({ hasText: new RegExp(`^.*${provider}$`) }).click();

    await this.subjectInput(lastIndex).fill(subject);
    // Dispatch blur event to trigger updatePermissionSubject handler
    await this.subjectInput(lastIndex).dispatchEvent('blur');

    await this.roleSelect(lastIndex).click();
    await this.page.locator('mat-option').filter({ hasText: role }).click();
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
