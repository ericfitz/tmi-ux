import { Page } from '@playwright/test';
import { TmEditPage } from '../pages/tm-edit.page';
import { AssetEditorDialog } from '../dialogs/asset-editor.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class AssetFlow {
  private tmEditPage: TmEditPage;
  private assetEditorDialog: AssetEditorDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.tmEditPage = new TmEditPage(page);
    this.assetEditorDialog = new AssetEditorDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

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

  async editFromTmEdit(name: string, updates: Record<string, string>) {
    const assetRow = this.page.getByTestId('asset-row').filter({ hasText: name });
    await assetRow.click();
    await this.assetEditorDialog.nameInput().waitFor({ state: 'visible' });
    if (updates['name']) {
      await this.assetEditorDialog.nameInput().clear();
      await this.assetEditorDialog.fillName(updates['name']);
    }
    if (updates['description']) {
      await this.assetEditorDialog.fillDescription(updates['description']);
    }
    if (updates['criticality']) {
      await this.assetEditorDialog.criticalityInput().clear();
      await this.assetEditorDialog.fillCriticality(updates['criticality']);
    }
    if (updates['sensitivity']) {
      await this.assetEditorDialog.sensitivityInput().clear();
      await this.assetEditorDialog.fillSensitivity(updates['sensitivity']);
    }
    await this.assetEditorDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async deleteFromTmEdit(name: string) {
    const assetRow = this.page.getByTestId('asset-row').filter({ hasText: name });
    const kebabButton = assetRow.locator('button[mat-icon-button]').filter({
      has: this.page.locator('mat-icon:has-text("more_vert")'),
    });
    await kebabButton.click();
    const deleteMenuItem = this.page.locator('button[mat-menu-item]').filter({ hasText: /delete/i });
    await deleteMenuItem.waitFor({ state: 'visible' });
    await deleteMenuItem.click();
    await this.deleteConfirmDialog.confirmDeletion();
  }
}
