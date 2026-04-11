import { Page } from '@playwright/test';
import { PermissionsDialog } from '../dialogs/permissions.dialog';

export class PermissionsFlow {
  private permissionsDialog: PermissionsDialog;

  constructor(private page: Page) {
    this.permissionsDialog = new PermissionsDialog(page);
  }

  async addPermission(
    type: 'user' | 'group',
    provider: string,
    subject: string,
    role: 'reader' | 'writer' | 'owner',
  ) {
    await this.permissionsDialog.addPermission(type, provider, subject, role);
  }

  async deletePermission(index: number) {
    await this.permissionsDialog.deleteButton(index).click();
  }

  async setOwner(index: number) {
    await this.permissionsDialog.setOwnerButtons().nth(index).click();
  }

  async saveAndClose() {
    await this.permissionsDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }
}
