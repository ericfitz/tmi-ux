import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

export class PermissionsDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly addButton = () => this.dialog.getByTestId('permissions-add-button');
  readonly saveButton = () => this.dialog.getByTestId('permissions-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('permissions-cancel-button');
  readonly typeSelects = () => this.dialog.getByTestId('permissions-type-select');
  readonly providerSelects = () => this.dialog.getByTestId('permissions-provider-select');
  readonly subjectInputs = () => this.dialog.getByTestId('permissions-subject-input');
  readonly roleSelects = () => this.dialog.getByTestId('permissions-role-select');
  readonly deleteButtons = () => this.dialog.getByTestId('permissions-delete-button');
  readonly setOwnerButtons = () => this.dialog.getByTestId('permissions-set-owner-button');
  readonly rows = () => this.dialog.locator('tr.mat-mdc-row');

  typeSelect(index: number): Locator {
    return this.typeSelects().nth(index);
  }

  providerSelect(index: number): Locator {
    return this.providerSelects().nth(index);
  }

  subjectInput(index: number): Locator {
    return this.subjectInputs().nth(index);
  }

  roleSelect(index: number): Locator {
    return this.roleSelects().nth(index);
  }

  deleteButton(index: number): Locator {
    return this.deleteButtons().nth(index);
  }

  async addPermission(type: string, provider: string, subject: string, role: string) {
    const prevCount = await this.typeSelects().count();
    await this.addButton().click();
    // Wait for the new row to appear in the table rather than using a fixed delay
    await this.page.waitForFunction(
      expected => document.querySelectorAll('[data-testid="permissions-type-select"]').length >= expected,
      prevCount + 1,
      { timeout: 5000 },
    );
    const lastIndex = prevCount;

    // Select provider before type — provider selection may auto-constrain principal_type.
    // Match the provider display name case-sensitively at end of option text (icon may precede).
    await this.openSelectAndChoose(
      this.providerSelect(lastIndex),
      new RegExp(`${escapeRegex(provider)}\\s*$`),
    );

    await this.openSelectAndChoose(this.typeSelect(lastIndex), new RegExp(`\\b${escapeRegex(capitalize(type))}\\s*$`));

    // Fill the subject and blur so [(ngModel)] commits the value to the
    // backing row. The autocomplete panel may also be open; Escape closes
    // it so the following role select click isn't intercepted.
    await angularFill(this.subjectInput(lastIndex), subject);
    await this.subjectInput(lastIndex).evaluate((el: HTMLInputElement) => {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    await this.page.keyboard.press('Escape').catch(() => {});

    await this.openSelectAndChoose(this.roleSelect(lastIndex), new RegExp(`\\b${escapeRegex(capitalize(role))}\\s*$`));
  }

  private async openSelectAndChoose(select: Locator, match: string | RegExp) {
    await select.click();
    // Wait for the overlay panel to render options before filtering by text
    const panel = this.page.locator('.cdk-overlay-pane .mat-mdc-select-panel');
    await panel.first().waitFor({ state: 'visible', timeout: 5000 });
    const option = panel.locator('mat-option').filter({ hasText: match });
    await option.first().waitFor({ state: 'visible', timeout: 5000 });
    await option.first().click();
    // Wait for the overlay to close
    await panel.first().waitFor({ state: 'hidden', timeout: 5000 });
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
