import { Page } from '@playwright/test';
import { TmEditPage } from '../pages/tm-edit.page';
import { ThreatPage } from '../pages/threat-page.page';
import { ThreatEditorDialog } from '../dialogs/threat-editor.dialog';
import { CvssCalculatorDialog } from '../dialogs/cvss-calculator.dialog';
import { CwePickerDialog } from '../dialogs/cwe-picker.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

// SEM@b040dc0c1400a4a5bfc238295aa021aa0a18c4a7: E2E page-object facade orchestrating threat entry CRUD and scoring flows
export class ThreatFlow {
  private tmEditPage: TmEditPage;
  private threatPage: ThreatPage;
  private threatEditorDialog: ThreatEditorDialog;
  private cvssDialog: CvssCalculatorDialog;
  private cwePickerDialog: CwePickerDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  // SEM@24593ac1fd9e4021fa8762c985f77832560c8ebb: build all page-object and dialog handles for the threat flow (pure)
  constructor(private page: Page) {
    this.tmEditPage = new TmEditPage(page);
    this.threatPage = new ThreatPage(page);
    this.threatEditorDialog = new ThreatEditorDialog(page);
    this.cvssDialog = new CvssCalculatorDialog(page);
    this.cwePickerDialog = new CwePickerDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  // SEM@24593ac1fd9e4021fa8762c985f77832560c8ebb: build a threat entry via the editor dialog from the threat model edit page
  async createFromTmEdit(name: string) {
    await this.tmEditPage.addThreatButton().scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await this.tmEditPage.addThreatButton().click();
    await this.threatEditorDialog.fillName(name);
    await this.threatEditorDialog.save();
    // Wait for dialog to close
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  // SEM@24593ac1fd9e4021fa8762c985f77832560c8ebb: navigate to a threat's detail page by clicking its row in the edit view
  async openFromTmEdit(name: string) {
    await this.tmEditPage.threatRow(name).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+\/threat\/[a-f0-9-]+/, { timeout: 10000 });
  }

  // SEM@24593ac1fd9e4021fa8762c985f77832560c8ebb: compute and apply a CVSS score to the current threat via the calculator dialog
  async scoreThreatWithCvss(version: '3.1' | '4.0', metrics: Record<string, string>) {
    await this.threatPage.openCvssButton().click();
    await this.cvssDialog.selectVersion(version);
    for (const [metric, value] of Object.entries(metrics)) {
      await this.cvssDialog.setMetric(metric, value);
    }
    await this.cvssDialog.apply();
    // Wait for dialog to close
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 5000 });
  }

  // SEM@6884451ded990cae6e08c4f8e04b7f06931da57b: search and register a CWE reference on the current threat via the picker dialog
  async addCweReference(searchTerm: string) {
    await this.threatPage.addCweButton().click();
    await this.cwePickerDialog.search(searchTerm);
    // If the search term looks like a CWE ID, select that specific entry;
    // otherwise select the first result
    if (/^CWE-\d+$/i.test(searchTerm)) {
      await this.cwePickerDialog.selectById(searchTerm);
    } else {
      await this.cwePickerDialog.selectFirst();
    }
    await this.cwePickerDialog.add();
    // Wait for dialog to close
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 5000 });
  }

  // SEM@b040dc0c1400a4a5bfc238295aa021aa0a18c4a7: delete a threat via the page header kebab menu and confirm (mutates shared state)
  async deleteThreatFromPage() {
    // Scope to the threat page's header action buttons
    const kebabButton = this.page
      .locator('.threat-page-container .page-header .action-buttons button[mat-icon-button]')
      .filter({ has: this.page.locator('mat-icon:has-text("more_vert")') });
    await kebabButton.click();
    const menuPanel = this.page.locator('.mat-mdc-menu-panel');
    await menuPanel.waitFor({ state: 'visible' });
    await this.threatPage.deleteButton().waitFor({ state: 'visible' });
    await this.threatPage.deleteButton().dispatchEvent('click');
    await this.deleteConfirmDialog.confirmDeletion();
  }
}
