import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class DocumentEditorDialog {
  private dialog: Locator;

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

  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  async fillUri(uri: string) {
    await angularFill(this.uriInput(), uri);
  }

  async fillDescription(desc: string) {
    await angularFill(this.descriptionInput(), desc);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }

  /**
   * Selects the radio button for the given source value (e.g. 'url',
   * 'google_workspace', 'microsoft'). Matches the radio interaction
   * precedent in `survey-fill.flow.ts`.
   */
  async selectSource(value: string) {
    await this.sourceRadio(value).locator('input[type="radio"]').check({ force: true });
  }
}
