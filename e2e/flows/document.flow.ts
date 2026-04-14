import { Page } from '@playwright/test';
import { DocumentEditorDialog } from '../dialogs/document-editor.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class DocumentFlow {
  private documentEditorDialog: DocumentEditorDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.documentEditorDialog = new DocumentEditorDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createFromTmEdit(fields: { name: string; uri: string; description?: string }) {
    const addButton = this.page.getByTestId('add-document-button');
    await addButton.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await addButton.click();
    await this.documentEditorDialog.fillName(fields.name);
    await this.documentEditorDialog.fillUri(fields.uri);
    if (fields.description) {
      await this.documentEditorDialog.fillDescription(fields.description);
    }
    await this.documentEditorDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async editFromTmEdit(name: string, updates: Record<string, string>) {
    const documentRow = this.page.getByTestId('document-row').filter({ hasText: name });
    await documentRow.click();
    await this.documentEditorDialog.nameInput().waitFor({ state: 'visible' });
    if (updates['name']) {
      await this.documentEditorDialog.nameInput().clear();
      await this.documentEditorDialog.fillName(updates['name']);
    }
    if (updates['uri']) {
      await this.documentEditorDialog.uriInput().clear();
      await this.documentEditorDialog.fillUri(updates['uri']);
    }
    if (updates['description']) {
      await this.documentEditorDialog.fillDescription(updates['description']);
    }
    await this.documentEditorDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async deleteFromTmEdit(name: string) {
    // Wait for any pending API saves to complete before interacting with the row
    await this.page.waitForLoadState('networkidle');
    const documentRow = this.page.getByTestId('document-row').filter({ hasText: name });
    await documentRow.waitFor({ state: 'visible', timeout: 10000 });
    const kebabButton = documentRow.locator('button[mat-icon-button]').filter({
      has: this.page.locator('mat-icon:has-text("more_vert")'),
    });
    await kebabButton.click();
    // Wait for the mat-menu overlay panel to appear and stabilize after animation.
    const menuPanel = this.page.locator('.mat-mdc-menu-panel');
    await menuPanel.waitFor({ state: 'visible' });
    const deleteMenuItem = menuPanel.locator('button[mat-menu-item]').filter({ hasText: /delete/i });
    await deleteMenuItem.waitFor({ state: 'visible' });
    // Use dispatchEvent('click') to trigger Angular's click handler directly,
    // avoiding Playwright's stability check which fails when Angular Material's
    // menu animation causes brief element detach/reattach cycles.
    await deleteMenuItem.dispatchEvent('click');
    await this.deleteConfirmDialog.confirmDeletion();
  }
}
