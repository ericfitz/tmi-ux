import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: E2E page object wrapping the edit-project dialog
export class EditProjectDialog {
  private dialog: Locator;

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: bind page and locate dialog container locator (pure)
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

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: filter note rows to the row matching the given note name (pure)
  noteRow(name: string) {
    return this.noteRows().filter({ hasText: name });
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: locate the edit button within a named note row (pure)
  editNoteButton(name: string) {
    return this.noteRow(name).getByTestId('edit-project-edit-note-button');
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: locate the delete button within a named note row (pure)
  deleteNoteButton(name: string) {
    return this.noteRow(name).getByTestId('edit-project-delete-note-button');
  }

  // Dialog actions
  readonly cancelButton = () => this.dialog.getByTestId('edit-project-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('edit-project-save-button');

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: fill the project name field with the given value
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: fill the project description field with the given value
  async fillDescription(description: string) {
    await angularFill(this.descriptionInput(), description);
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: select a team by name from the team dropdown
  async selectTeam(teamName: string) {
    await this.teamSelect().click();
    await this.page.locator('mat-option').filter({ hasText: teamName }).click();
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: fill the project URI field with the given value
  async fillUri(uri: string) {
    await angularFill(this.uriInput(), uri);
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: select a project status by label from the status dropdown
  async selectStatus(status: string) {
    await this.statusSelect().click();
    await this.page.locator('mat-option').filter({ hasText: status }).click();
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: navigate to the Notes tab within the edit-project dialog
  async switchToNotesTab() {
    await this.notesTab().click();
    await this.page.waitForTimeout(300);
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: navigate to the Details tab within the edit-project dialog
  async switchToDetailsTab() {
    await this.detailsTab().click();
    await this.page.waitForTimeout(300);
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: click the save button to submit the edit-project dialog
  async save() {
    await this.saveButton().click();
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: click the cancel button to dismiss the edit-project dialog
  async cancel() {
    await this.cancelButton().click();
  }
}
