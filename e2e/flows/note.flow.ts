import { Page } from '@playwright/test';
import { NotePage } from '../pages/note-page.page';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class NoteFlow {
  private notePage: NotePage;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.notePage = new NotePage(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createFromTmEdit(name: string, content = 'E2E test note content') {
    const addButton = this.page.getByTestId('add-note-button');
    await addButton.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await addButton.click();
    // Note creation opens a dialog (not a route navigation)
    const dialog = this.page.locator('mat-dialog-container');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    const nameInput = dialog.locator('input[formcontrolname="name"]');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    // Use click + clear + type to ensure reliable Angular reactive form input
    await nameInput.click();
    await nameInput.clear();
    await nameInput.pressSequentially(name, { delay: 10 });
    // Content is required
    const contentInput = dialog.locator('textarea[formcontrolname="content"]');
    await contentInput.click();
    await contentInput.pressSequentially(content, { delay: 10 });
    // Click "Save and Close" to create and dismiss the dialog
    const saveButton = dialog.locator('button').filter({ hasText: 'Save and Close' });
    await saveButton.click();
    await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  }

  async openFromTmEdit(name: string) {
    const noteRow = this.page.getByTestId('note-row').filter({ hasText: name });
    await noteRow.click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+\/note\/[a-f0-9-]+/, { timeout: 10000 });
  }

  async editNote(fields: { name?: string; description?: string; content?: string }) {
    if (fields.name) {
      await this.notePage.fillName(fields.name);
    }
    if (fields.description) {
      await this.notePage.fillDescription(fields.description);
    }
    if (fields.content) {
      await this.notePage.fillContent(fields.content);
    }
    await this.notePage.save();
  }

  async deleteNote() {
    // Verify we're on the note page before attempting delete
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+\/note\/[a-f0-9-]+/, { timeout: 10000 });
    // Scope to the note page's header action buttons
    const kebabButton = this.page
      .locator('.note-page-container .page-header .action-buttons button[mat-icon-button]')
      .filter({ has: this.page.locator('mat-icon:has-text("more_vert")') });
    await kebabButton.click();
    const menuPanel = this.page.locator('.mat-mdc-menu-panel');
    await menuPanel.waitFor({ state: 'visible' });
    await this.notePage.deleteButton().waitFor({ state: 'visible' });
    await this.notePage.deleteButton().dispatchEvent('click');
    await this.deleteConfirmDialog.confirmDeletion();
  }

  async closeNote() {
    await this.notePage.close();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }
}
