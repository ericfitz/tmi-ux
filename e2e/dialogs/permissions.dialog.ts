import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@81a32062eea63fd38be41293a7faaafddd14eef1: escape special regex characters in a string for safe pattern matching (pure)
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// SEM@81a32062eea63fd38be41293a7faaafddd14eef1: capitalize the first character of a string (pure)
function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

// SEM@94cbcab524fa83399b721d909b7dc4843b81e54a: Playwright page object for the permissions management dialog
export class PermissionsDialog {
  private dialog: Locator;

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: bind Playwright page and locate the permissions dialog container (pure)
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

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: fetch the principal-type select at the given row index (pure)
  typeSelect(index: number): Locator {
    return this.typeSelects().nth(index);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: fetch the identity-provider select at the given row index (pure)
  providerSelect(index: number): Locator {
    return this.providerSelects().nth(index);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: fetch the subject input field at the given row index (pure)
  subjectInput(index: number): Locator {
    return this.subjectInputs().nth(index);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: fetch the role select at the given row index (pure)
  roleSelect(index: number): Locator {
    return this.roleSelects().nth(index);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: fetch the delete button for the permission row at the given index (pure)
  deleteButton(index: number): Locator {
    return this.deleteButtons().nth(index);
  }

  // SEM@94cbcab524fa83399b721d909b7dc4843b81e54a: add a permission entry with type, provider, subject, and role via the dialog
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

    // Type keystrokes one-by-one with pressSequentially and wait for the
    // bound input value to match before moving on. The atomic setter in
    // angularFill() sometimes left ngModel stale in the full-suite run,
    // producing a server validation error about missing provider_id.
    await this.subjectInput(lastIndex).click();
    await this.subjectInput(lastIndex).fill('');
    await this.subjectInput(lastIndex).pressSequentially(subject, { delay: 20 });
    await this.page.waitForFunction(
      ({ idx, expected }) => {
        const inputs = document.querySelectorAll<HTMLInputElement>(
          '[data-testid="permissions-subject-input"]',
        );
        return inputs[idx]?.value === expected;
      },
      { idx: lastIndex, expected: subject },
      { timeout: 3000 },
    ).catch(() => {
      /* continue; next assertion will catch a truly empty field */
    });

    await this.openSelectAndChoose(this.roleSelect(lastIndex), new RegExp(`\\b${escapeRegex(capitalize(role))}\\s*$`));
  }

  // SEM@81a32062eea63fd38be41293a7faaafddd14eef1: open a Material select overlay and choose the matching option
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

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: submit the permissions dialog by clicking the save button
  async save() {
    await this.saveButton().click();
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: dismiss the permissions dialog by clicking the cancel button
  async cancel() {
    await this.cancelButton().click();
  }
}
