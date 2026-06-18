import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@a2b11c7450c617ac1ba0c8f95c47efc49d0635c3: page object wrapping the triage note editor dialog for E2E tests (pure)
export class TriageNoteEditorDialog {
  private dialog: Locator;

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: bind the dialog locator to the mat-dialog-container element (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () =>
    this.dialog.getByTestId('triage-note-name-input');
  readonly contentTextarea = () =>
    this.dialog.getByTestId('triage-note-content-textarea');
  readonly editToggle = () =>
    this.dialog.getByTestId('triage-note-edit-toggle');
  readonly previewToggle = () =>
    this.dialog.getByTestId('triage-note-preview-toggle');
  readonly cancelButton = () =>
    this.dialog.getByTestId('triage-note-cancel-button');
  readonly saveButton = () =>
    this.dialog.getByTestId('triage-note-save-button');

  // SEM@a2b11c7450c617ac1ba0c8f95c47efc49d0635c3: populate the triage note name input with the given value
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@a2b11c7450c617ac1ba0c8f95c47efc49d0635c3: populate the triage note content textarea with the given value
  async fillContent(content: string) {
    await angularFill(this.contentTextarea(), content);
  }

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: submit the triage note editor dialog by clicking the save button
  async save() {
    await this.saveButton().click();
  }

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: dismiss the triage note editor dialog by clicking the cancel button
  async cancel() {
    await this.cancelButton().click();
  }
}
