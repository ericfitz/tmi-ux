import { Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: Playwright page object exposing locators and actions for the note editor (pure)
export class NotePage {
  // SEM@f932ac504d5de8b835530e16f5421e320dee6e1c: bind Playwright page instance to the page object (pure)
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

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the note name field with a given value
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the note description field with a given value
  async fillDescription(desc: string) {
    await angularFill(this.descriptionInput(), desc);
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the note content textarea, switching to edit mode if needed
  async fillContent(content: string) {
    // Switch to edit mode if the content textarea is not visible (preview mode)
    if (!(await this.contentTextarea().isVisible())) {
      await this.page
        .locator('button')
        .filter({ has: this.page.locator('mat-icon:has-text("edit_note")') })
        .click();
      await this.contentTextarea().waitFor({ state: 'visible', timeout: 5000 });
    }
    await angularFill(this.contentTextarea(), content);
  }

  // SEM@f932ac504d5de8b835530e16f5421e320dee6e1c: click the save button to persist the note
  async save() {
    await this.saveButton().click();
  }

  // SEM@f932ac504d5de8b835530e16f5421e320dee6e1c: click the close button to dismiss the note editor
  async close() {
    await this.closeButton().click();
  }
}
