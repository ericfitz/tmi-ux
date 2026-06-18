import { Page } from '@playwright/test';
import { RepositoryEditorDialog } from '../dialogs/repository-editor.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

// SEM@b040dc0c1400a4a5bfc238295aa021aa0a18c4a7: E2E flow helper for CRUD actions on repositories from the TM edit page
export class RepositoryFlow {
  private repositoryEditorDialog: RepositoryEditorDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: build RepositoryFlow and initialize dialog wrappers (pure)
  constructor(private page: Page) {
    this.repositoryEditorDialog = new RepositoryEditorDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: create a repository via the TM edit add button and fill in its fields
  async createFromTmEdit(fields: {
    name: string;
    type: string;
    uri: string;
    refType?: string;
    refValue?: string;
    subPath?: string;
  }) {
    const addButton = this.page.getByTestId('add-repository-button');
    await addButton.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await addButton.click();
    await this.repositoryEditorDialog.fillName(fields.name);
    await this.repositoryEditorDialog.selectType(fields.type);
    await this.repositoryEditorDialog.fillUri(fields.uri);
    if (fields.refType) {
      await this.repositoryEditorDialog.selectRefType(fields.refType);
    }
    if (fields.refValue) {
      await this.repositoryEditorDialog.fillRefValue(fields.refValue);
    }
    if (fields.subPath) {
      await this.repositoryEditorDialog.fillSubPath(fields.subPath);
    }
    await this.repositoryEditorDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: open and update repository fields via the TM edit row click
  async editFromTmEdit(name: string, updates: Record<string, string>) {
    const repositoryRow = this.page.getByTestId('repository-row').filter({ hasText: name });
    await repositoryRow.click();
    await this.repositoryEditorDialog.nameInput().waitFor({ state: 'visible' });
    if (updates['name']) {
      await this.repositoryEditorDialog.nameInput().clear();
      await this.repositoryEditorDialog.fillName(updates['name']);
    }
    if (updates['description']) {
      await this.repositoryEditorDialog.fillDescription(updates['description']);
    }
    if (updates['uri']) {
      await this.repositoryEditorDialog.uriInput().clear();
      await this.repositoryEditorDialog.fillUri(updates['uri']);
    }
    if (updates['refValue']) {
      await this.repositoryEditorDialog.refValueInput().clear();
      await this.repositoryEditorDialog.fillRefValue(updates['refValue']);
    }
    if (updates['subPath']) {
      await this.repositoryEditorDialog.subPathInput().clear();
      await this.repositoryEditorDialog.fillSubPath(updates['subPath']);
    }
    await this.repositoryEditorDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  // SEM@b040dc0c1400a4a5bfc238295aa021aa0a18c4a7: delete a named repository entry via kebab menu and confirm dialog
  async deleteFromTmEdit(name: string) {
    const repositoryRow = this.page.getByTestId('repository-row').filter({ hasText: name });
    const kebabButton = repositoryRow.locator('button[mat-icon-button]').filter({
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
