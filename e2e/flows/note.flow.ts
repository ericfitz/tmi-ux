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

  async createFromTmEdit(name: string) {
    const addButton = this.page.getByTestId('add-note-button');
    await addButton.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await addButton.click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+\/note\/[a-f0-9-]+/, { timeout: 10000 });
    await this.notePage.fillName(name);
    await this.notePage.save();
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
    const kebabButton = this.page.locator('button[mat-icon-button]').filter({
      has: this.page.locator('mat-icon:has-text("more_vert")'),
    });
    await kebabButton.click();
    await this.notePage.deleteButton().waitFor({ state: 'visible' });
    await this.notePage.deleteButton().click();
    await this.deleteConfirmDialog.confirmDeletion();
  }

  async closeNote() {
    await this.notePage.close();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }
}
