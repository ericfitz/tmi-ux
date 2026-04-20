import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class RelatedTeamsDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly relatedRows = () => this.dialog.getByTestId('related-teams-row');
  readonly addButton = () => this.dialog.getByTestId('related-teams-add-button');
  readonly teamInput = () => this.dialog.getByTestId('related-teams-team-input');
  readonly relationshipSelect = () =>
    this.dialog.getByTestId('related-teams-relationship-select');
  readonly customRelationshipInput = () =>
    this.dialog.getByTestId('related-teams-custom-relationship-input');
  readonly confirmAddButton = () => this.dialog.getByTestId('related-teams-confirm-add-button');
  readonly cancelAddButton = () => this.dialog.getByTestId('related-teams-cancel-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('related-teams-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('related-teams-save-button');

  removeButton(index: number) {
    return this.relatedRows().nth(index).getByTestId('related-teams-remove-button');
  }

  async searchTeam(name: string) {
    // Reactive form input — angularFill triggers the valueChanges stream that
    // feeds the team autocomplete (the form is debounced by 300ms). The
    // autocomplete panel only shows when the input has focus.
    await this.teamInput().click();
    await angularFill(this.teamInput(), name);
    const option = this.page
      .locator('mat-option:not(.mat-mdc-autocomplete-hidden mat-option)')
      .filter({ hasText: name });
    await option.first().waitFor({ state: 'visible', timeout: 10000 });
    await option.first().click();
  }

  async selectRelationship(relationship: string) {
    await this.relationshipSelect().click();
    const panel = this.page.locator('.cdk-overlay-pane .mat-mdc-select-panel');
    await panel.first().waitFor({ state: 'visible', timeout: 5000 });
    const option = panel.locator('mat-option').filter({ hasText: relationship });
    await option.first().waitFor({ state: 'visible', timeout: 5000 });
    await option.first().click();
    await panel.first().waitFor({ state: 'hidden', timeout: 5000 });
  }

  async confirmAdd() {
    await this.confirmAddButton().click();
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
