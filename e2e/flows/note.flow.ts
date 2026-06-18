import { Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';
import { NotePage } from '../pages/note-page.page';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

// SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: E2E page-object flow for note create, open, edit, delete, and close actions
export class NoteFlow {
  private notePage: NotePage;
  private deleteConfirmDialog: DeleteConfirmDialog;

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: initialize note page and delete-confirm dialog page objects (pure)
  constructor(private page: Page) {
    this.notePage = new NotePage(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: create a note via the TM edit page dialog and save it
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
    await angularFill(nameInput, name);
    // Content is required
    const contentInput = dialog.locator('textarea[formcontrolname="content"]');
    await angularFill(contentInput, content);
    // Click "Save and Close" to create and dismiss the dialog
    const saveButton = dialog.locator('button').filter({ hasText: 'Save and Close' });
    await saveButton.click();
    await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: navigate to the note detail page by clicking its row
  async openFromTmEdit(name: string) {
    const noteRow = this.page.getByTestId('note-row').filter({ hasText: name });
    await noteRow.click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+\/note\/[a-f0-9-]+/, { timeout: 10000 });
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: update note fields and save on the note detail page
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

  // SEM@b040dc0c1400a4a5bfc238295aa021aa0a18c4a7: delete a note via the kebab menu and confirm deletion dialog
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

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: close the note page and return to the TM edit page
  async closeNote() {
    await this.notePage.close();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }
}
