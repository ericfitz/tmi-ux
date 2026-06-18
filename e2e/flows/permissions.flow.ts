import { Page } from '@playwright/test';
import { PermissionsDialog } from '../dialogs/permissions.dialog';

// SEM@b8199819fceead93915fadf869c3a2ed425e042b: E2E flow helper for managing permissions via the permissions dialog
export class PermissionsFlow {
  private permissionsDialog: PermissionsDialog;

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: build PermissionsFlow and initialize the permissions dialog wrapper (pure)
  constructor(private page: Page) {
    this.permissionsDialog = new PermissionsDialog(page);
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: add a user or group permission entry with a given role
  async addPermission(
    type: 'user' | 'group',
    provider: string,
    subject: string,
    role: 'reader' | 'writer' | 'owner',
  ) {
    await this.permissionsDialog.addPermission(type, provider, subject, role);
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: delete the permission entry at the given index
  async deletePermission(index: number) {
    await this.permissionsDialog.deleteButton(index).click();
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: promote the permission entry at the given index to owner
  async setOwner(index: number) {
    await this.permissionsDialog.setOwnerButtons().nth(index).click();
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: save permissions and wait for the dialog to close
  async saveAndClose() {
    await this.permissionsDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }
}
