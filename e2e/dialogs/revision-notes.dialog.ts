import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class RevisionNotesDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly notesTextarea = () =>
    this.dialog.getByTestId('revision-notes-textarea');
  readonly cancelButton = () =>
    this.dialog.getByTestId('revision-notes-cancel-button');
  readonly confirmButton = () =>
    this.dialog.getByTestId('revision-notes-confirm-button');

  async fillNotes(notes: string) {
    await angularFill(this.notesTextarea(), notes);
  }

  async confirm() {
    await this.confirmButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
