import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: page-object for the repository editor dialog; wraps locators and form actions
export class RepositoryEditorDialog {
  private dialog: Locator;

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: bind a Playwright Page and locate the dialog container (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('repository-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('repository-description-input');
  readonly typeSelect = () => this.dialog.getByTestId('repository-type-select');
  readonly uriInput = () => this.dialog.getByTestId('repository-uri-input');
  readonly refTypeSelect = () => this.dialog.getByTestId('repository-ref-type-select');
  readonly refValueInput = () => this.dialog.getByTestId('repository-ref-value-input');
  readonly subPathInput = () => this.dialog.getByTestId('repository-sub-path-input');
  readonly includeReportCheckbox = () =>
    this.dialog.getByTestId('repository-include-report-checkbox');
  readonly timmyCheckbox = () => this.dialog.getByTestId('repository-timmy-checkbox');
  readonly saveButton = () => this.dialog.getByTestId('repository-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('repository-cancel-button');

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the repository name field with the given value (mutates shared state)
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the repository description field with the given value (mutates shared state)
  async fillDescription(desc: string) {
    await angularFill(this.descriptionInput(), desc);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: select a repository type from the dropdown (mutates shared state)
  async selectType(type: string) {
    await this.typeSelect().click();
    await this.page.locator('mat-option').filter({ hasText: type }).click();
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the repository URI field with the given value (mutates shared state)
  async fillUri(uri: string) {
    await angularFill(this.uriInput(), uri);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: select a repository ref type from the dropdown (mutates shared state)
  async selectRefType(refType: string) {
    await this.refTypeSelect().click();
    await this.page.locator('mat-option').filter({ hasText: refType }).click();
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the repository ref value field with the given value (mutates shared state)
  async fillRefValue(value: string) {
    await angularFill(this.refValueInput(), value);
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the repository sub-path field with the given value (mutates shared state)
  async fillSubPath(path: string) {
    await angularFill(this.subPathInput(), path);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: submit the repository editor dialog by clicking save (mutates shared state)
  async save() {
    await this.saveButton().click();
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: dismiss the repository editor dialog without saving (mutates shared state)
  async cancel() {
    await this.cancelButton().click();
  }
}
