import { Locator, Page } from '@playwright/test';

// SEM@88e6a889c33276e0b9d96b4698fbf7d39d4a382b: page-object for the related-teams dialog; wraps locators and actions
export class RelatedTeamsDialog {
  private dialog: Locator;

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: bind a Playwright Page and locate the dialog container (pure)
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

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: locate the remove button for a related-team row by index (pure)
  removeButton(index: number) {
    return this.relatedRows().nth(index).getByTestId('related-teams-remove-button');
  }

  // SEM@88e6a889c33276e0b9d96b4698fbf7d39d4a382b: type a team name and select the matching autocomplete suggestion (mutates shared state)
  async searchTeam(name: string) {
    // Reactive form — type keystrokes so the valueChanges stream fires for
    // each character (the form uses a 300ms debounce). Autocomplete panel
    // opens on focus.
    await this.teamInput().click();
    await this.teamInput().fill('');
    await this.teamInput().pressSequentially(name, { delay: 30 });
    const option = this.page
      .locator('.cdk-overlay-pane .mat-mdc-autocomplete-panel mat-option')
      .filter({ hasText: name });
    await option.first().waitFor({ state: 'visible', timeout: 10000 });
    await option.first().click();
  }

  // SEM@bb65e02191d3f75c13fdb0a10b75f2837d573933: select a relationship type from the dropdown panel (mutates shared state)
  async selectRelationship(relationship: string) {
    await this.relationshipSelect().click();
    const panel = this.page.locator('.cdk-overlay-pane .mat-mdc-select-panel');
    await panel.first().waitFor({ state: 'visible', timeout: 5000 });
    const option = panel.locator('mat-option').filter({ hasText: relationship });
    await option.first().waitFor({ state: 'visible', timeout: 5000 });
    await option.first().click();
    await panel.first().waitFor({ state: 'hidden', timeout: 5000 });
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: confirm adding a related team entry in the dialog (mutates shared state)
  async confirmAdd() {
    await this.confirmAddButton().click();
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: submit the related-teams dialog by clicking save (mutates shared state)
  async save() {
    await this.saveButton().click();
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: dismiss the related-teams dialog without saving (mutates shared state)
  async cancel() {
    await this.cancelButton().click();
  }
}
