import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@b3ead44cf22347220a308a3b5d954272ebc12eb5: E2E page object wrapping the document editor dialog
export class DocumentEditorDialog {
  private dialog: Locator;

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: bind page and locate dialog container locator (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('document-name-input');
  readonly uriInput = () => this.dialog.getByTestId('document-uri-input');
  readonly descriptionInput = () => this.dialog.getByTestId('document-description-input');
  readonly includeReportCheckbox = () =>
    this.dialog.getByTestId('document-include-report-checkbox');
  readonly timmyCheckbox = () => this.dialog.getByTestId('document-timmy-checkbox');
  readonly saveButton = () => this.dialog.getByTestId('document-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('document-cancel-button');

  // Source selector + picker affordances (create mode, when picker providers exist).
  readonly sourceRadio = (value: string) =>
    this.dialog.getByTestId(`document-source-radio-${value}`);
  readonly pickButton = () => this.dialog.getByTestId('document-pick-button');
  readonly repickButton = () => this.dialog.getByTestId('document-repick-button');
  readonly pickedFileHint = () => this.dialog.getByTestId('document-picked-file-hint');
  readonly linkSourceButton = () => this.dialog.getByTestId('document-link-source-button');
  readonly pickerError = () => this.dialog.getByTestId('document-picker-error');
  readonly pickerErrorLinkCta = () => this.dialog.getByTestId('document-picker-error-link-cta');
  readonly pickerFinalizing = () => this.dialog.getByTestId('document-picker-finalizing');

  // Diagnostics panel selectors.
  readonly diagnosticsBanner = () => this.dialog.getByTestId('diagnostics-banner');
  readonly remediationButton = (action: string) =>
    this.dialog.getByTestId(`remediation-${action}`);
  readonly checkNowButton = () => this.dialog.getByTestId('check-now-btn');

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the document name field with the given value
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the document URI field with the given value
  async fillUri(uri: string) {
    await angularFill(this.uriInput(), uri);
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the document description field with the given value
  async fillDescription(desc: string) {
    await angularFill(this.descriptionInput(), desc);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: click the save button to submit the document editor dialog
  async save() {
    await this.saveButton().click();
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: click the cancel button to dismiss the document editor dialog
  async cancel() {
    await this.cancelButton().click();
  }

  /**
   * Selects the radio button for the given source value (e.g. 'url',
   * 'google_workspace', 'microsoft'). Matches the radio interaction
   * precedent in `survey-fill.flow.ts`.
   */
  // SEM@b3ead44cf22347220a308a3b5d954272ebc12eb5: select the document source radio button by provider value
  async selectSource(value: string) {
    await this.sourceRadio(value).locator('input[type="radio"]').check({ force: true });
  }
}
