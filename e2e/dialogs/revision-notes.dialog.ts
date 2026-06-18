import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: page object for the revision notes dialog; fill, confirm, or cancel
export class RevisionNotesDialog {
  private dialog: Locator;

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: bind the dialog page object to the Playwright page (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly notesTextarea = () =>
    this.dialog.getByTestId('revision-notes-textarea');
  readonly cancelButton = () =>
    this.dialog.getByTestId('revision-notes-cancel-button');
  readonly confirmButton = () =>
    this.dialog.getByTestId('revision-notes-confirm-button');

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: type revision notes text into the dialog textarea
  async fillNotes(notes: string) {
    await angularFill(this.notesTextarea(), notes);
  }

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: submit the revision notes dialog by clicking confirm
  async confirm() {
    await this.confirmButton().click();
  }

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: dismiss the revision notes dialog by clicking cancel
  async cancel() {
    await this.cancelButton().click();
  }
}
