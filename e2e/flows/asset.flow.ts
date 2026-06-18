import { Page } from '@playwright/test';
import { TmEditPage } from '../pages/tm-edit.page';
import { AssetEditorDialog } from '../dialogs/asset-editor.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

// SEM@b040dc0c1400a4a5bfc238295aa021aa0a18c4a7: E2E flow for creating, editing, and deleting assets from the TM edit page
export class AssetFlow {
  private tmEditPage: TmEditPage;
  private assetEditorDialog: AssetEditorDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: initialize page object references for asset flow interactions
  constructor(private page: Page) {
    this.tmEditPage = new TmEditPage(page);
    this.assetEditorDialog = new AssetEditorDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: create an asset via the TM edit form and close the dialog
  async createFromTmEdit(fields: {
    name: string;
    type?: string;
    criticality?: string;
    classification?: string[];
    sensitivity?: string;
  }) {
    const addButton = this.page.getByTestId('add-asset-button');
    await addButton.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await addButton.click();
    await this.assetEditorDialog.fillName(fields.name);
    if (fields.type) {
      await this.assetEditorDialog.selectType(fields.type);
    }
    if (fields.criticality) {
      await this.assetEditorDialog.fillCriticality(fields.criticality);
    }
    if (fields.classification) {
      for (const cls of fields.classification) {
        await this.assetEditorDialog.addClassification(cls);
      }
    }
    if (fields.sensitivity) {
      await this.assetEditorDialog.fillSensitivity(fields.sensitivity);
    }
    await this.assetEditorDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  // SEM@40db4eb4f93af00d670423645c337e9dcf865845: update fields on an existing asset via the TM edit form
  async editFromTmEdit(name: string, updates: Record<string, string>) {
    const assetRow = this.page.getByTestId('asset-row').filter({ hasText: name });
    // Click the icon cell (first column) to trigger the row click handler
    // without hitting action buttons or chips in other columns
    await assetRow.locator('td').first().click();
    await this.assetEditorDialog.nameInput().waitFor({ state: 'visible', timeout: 5000 });
    if (updates['name']) {
      await this.assetEditorDialog.fillName(updates['name']);
    }
    if (updates['description']) {
      await this.assetEditorDialog.fillDescription(updates['description']);
    }
    if (updates['criticality']) {
      await this.assetEditorDialog.fillCriticality(updates['criticality']);
    }
    if (updates['sensitivity']) {
      await this.assetEditorDialog.fillSensitivity(updates['sensitivity']);
    }

    await this.assetEditorDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  // SEM@b040dc0c1400a4a5bfc238295aa021aa0a18c4a7: delete a named asset via the kebab menu and confirm dialog
  async deleteFromTmEdit(name: string) {
    const assetRow = this.page.getByTestId('asset-row').filter({ hasText: name });
    const kebabButton = assetRow.locator('button[mat-icon-button]').filter({
      has: this.page.locator('mat-icon:has-text("more_vert")'),
    });
    await kebabButton.click();
    const menuPanel = this.page.locator('.mat-mdc-menu-panel');
    await menuPanel.waitFor({ state: 'visible' });
    const deleteMenuItem = menuPanel.locator('button[mat-menu-item]').filter({ hasText: /delete/i });
    await deleteMenuItem.waitFor({ state: 'visible' });
    await deleteMenuItem.dispatchEvent('click');
    await this.deleteConfirmDialog.confirmDeletion();
  }
}
