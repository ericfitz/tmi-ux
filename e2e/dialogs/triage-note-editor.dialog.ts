import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class TriageNoteEditorDialog {
  private dialog: Locator;

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

  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  async fillContent(content: string) {
    await angularFill(this.contentTextarea(), content);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
