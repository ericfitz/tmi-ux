import { Locator, Page } from '@playwright/test';

export class EditTeamDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  // Details tab fields
  readonly nameInput = () => this.dialog.getByTestId('edit-team-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('edit-team-description-input');
  readonly emailInput = () => this.dialog.getByTestId('edit-team-email-input');
  readonly uriInput = () => this.dialog.getByTestId('edit-team-uri-input');
  readonly statusSelect = () => this.dialog.getByTestId('edit-team-status-select');

  // Tab navigation
  readonly tabGroup = () => this.dialog.getByTestId('edit-team-tab-group');
  readonly detailsTab = () => this.dialog.getByTestId('edit-team-details-tab');
  readonly notesTab = () => this.dialog.getByTestId('edit-team-notes-tab');

  // Notes tab
  readonly addNoteButton = () => this.dialog.getByTestId('edit-team-add-note-button');
  readonly noteRows = () => this.dialog.getByTestId('edit-team-note-row');

  noteRow(name: string) {
    return this.noteRows().filter({ hasText: name });
  }

  editNoteButton(name: string) {
    return this.noteRow(name).getByTestId('edit-team-edit-note-button');
  }

  deleteNoteButton(name: string) {
    return this.noteRow(name).getByTestId('edit-team-delete-note-button');
  }

  // Dialog actions
  readonly cancelButton = () => this.dialog.getByTestId('edit-team-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('edit-team-save-button');

  async fillName(name: string) {
    await this.nameInput().clear();
    await this.nameInput().fill(name);
  }

  async fillDescription(description: string) {
    await this.descriptionInput().clear();
    await this.descriptionInput().fill(description);
  }

  async fillEmail(email: string) {
    await this.emailInput().clear();
    await this.emailInput().fill(email);
  }

  async fillUri(uri: string) {
    await this.uriInput().clear();
    await this.uriInput().fill(uri);
  }

  async selectStatus(status: string) {
    await this.statusSelect().click();
    await this.page.locator('mat-option').filter({ hasText: status }).click();
  }

  async switchToNotesTab() {
    await this.notesTab().click();
    await this.page.waitForTimeout(300);
  }

  async switchToDetailsTab() {
    await this.detailsTab().click();
    await this.page.waitForTimeout(300);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
