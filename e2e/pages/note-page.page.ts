import { Page } from '@playwright/test';

export class NotePage {
  constructor(private page: Page) {}

  readonly nameInput = () => this.page.getByTestId('note-name-input');
  readonly descriptionInput = () => this.page.getByTestId('note-description-input');
  readonly contentTextarea = () => this.page.getByTestId('note-content-textarea');
  readonly includeReportCheckbox = () => this.page.getByTestId('note-include-report-checkbox');
  readonly timmyCheckbox = () => this.page.getByTestId('note-timmy-checkbox');
  readonly saveButton = () => this.page.getByTestId('note-save-button');
  readonly deleteButton = () => this.page.getByTestId('note-delete-button');
  readonly metadataButton = () => this.page.getByTestId('note-metadata-button');
  readonly closeButton = () => this.page.getByTestId('note-close-button');

  async fillName(name: string) {
    await this.nameInput().clear();
    await this.nameInput().pressSequentially(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().clear();
    await this.descriptionInput().pressSequentially(desc);
  }

  async fillContent(content: string) {
    // Switch to edit mode if the content textarea is not visible (preview mode)
    if (!(await this.contentTextarea().isVisible())) {
      await this.page
        .locator('button')
        .filter({ has: this.page.locator('mat-icon:has-text("edit_note")') })
        .click();
      await this.contentTextarea().waitFor({ state: 'visible', timeout: 5000 });
    }
    await this.contentTextarea().clear();
    await this.contentTextarea().pressSequentially(content);
  }

  async save() {
    await this.saveButton().click();
  }

  async close() {
    await this.closeButton().click();
  }
}
