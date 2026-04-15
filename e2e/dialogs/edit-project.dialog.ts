import { Locator, Page } from '@playwright/test';

export class EditProjectDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  // Details tab fields
  readonly nameInput = () => this.dialog.getByTestId('edit-project-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('edit-project-description-input');
  readonly teamSelect = () => this.dialog.getByTestId('edit-project-team-select');
  readonly uriInput = () => this.dialog.getByTestId('edit-project-uri-input');
  readonly statusSelect = () => this.dialog.getByTestId('edit-project-status-select');

  // Tab navigation
  readonly tabGroup = () => this.dialog.getByTestId('edit-project-tab-group');
  readonly detailsTab = () => this.dialog.getByTestId('edit-project-details-tab');
  readonly notesTab = () => this.dialog.getByTestId('edit-project-notes-tab');

  // Notes tab
  readonly addNoteButton = () => this.dialog.getByTestId('edit-project-add-note-button');
  readonly noteRows = () => this.dialog.getByTestId('edit-project-note-row');

  noteRow(name: string) {
    return this.noteRows().filter({ hasText: name });
  }

  editNoteButton(name: string) {
    return this.noteRow(name).getByTestId('edit-project-edit-note-button');
  }

  deleteNoteButton(name: string) {
    return this.noteRow(name).getByTestId('edit-project-delete-note-button');
  }

  // Dialog actions
  readonly cancelButton = () => this.dialog.getByTestId('edit-project-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('edit-project-save-button');

  async fillName(name: string) {
    await this.nameInput().clear();
    await this.nameInput().fill(name);
  }

  async fillDescription(description: string) {
    await this.descriptionInput().clear();
    await this.descriptionInput().fill(description);
  }

  async selectTeam(teamName: string) {
    await this.teamSelect().click();
    await this.page.locator('mat-option').filter({ hasText: teamName }).click();
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
