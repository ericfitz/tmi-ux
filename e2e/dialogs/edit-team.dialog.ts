import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: E2E page object for the edit-team dialog with tabs and notes (pure)
export class EditTeamDialog {
  private dialog: Locator;

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: bind page and locate the dialog container (pure)
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

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: locate a note row in the team dialog by note text (pure)
  noteRow(name: string) {
    return this.noteRows().filter({ hasText: name });
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: locate the edit-note action button for a named note row (pure)
  editNoteButton(name: string) {
    return this.noteRow(name).getByTestId('edit-team-edit-note-button');
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: locate the delete-note action button for a named note row (pure)
  deleteNoteButton(name: string) {
    return this.noteRow(name).getByTestId('edit-team-delete-note-button');
  }

  // Dialog actions
  readonly cancelButton = () => this.dialog.getByTestId('edit-team-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('edit-team-save-button');

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: fill the team name input field with the given value
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: fill the team description input field with the given value
  async fillDescription(description: string) {
    await angularFill(this.descriptionInput(), description);
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: fill the team email input field with the given value
  async fillEmail(email: string) {
    await angularFill(this.emailInput(), email);
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: fill the team URI input field with the given value
  async fillUri(uri: string) {
    await angularFill(this.uriInput(), uri);
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: select a team status option from the status dropdown
  async selectStatus(status: string) {
    await this.statusSelect().click();
    await this.page.locator('mat-option').filter({ hasText: status }).click();
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: navigate to the Notes tab in the edit-team dialog
  async switchToNotesTab() {
    await this.notesTab().click();
    await this.page.waitForTimeout(300);
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: navigate to the Details tab in the edit-team dialog
  async switchToDetailsTab() {
    await this.detailsTab().click();
    await this.page.waitForTimeout(300);
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: submit the edit-team dialog by clicking the save button
  async save() {
    await this.saveButton().click();
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: dismiss the edit-team dialog by clicking the cancel button
  async cancel() {
    await this.cancelButton().click();
  }
}
