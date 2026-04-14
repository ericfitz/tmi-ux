import { Page } from '@playwright/test';
import { TmEditPage } from '../pages/tm-edit.page';
import { ThreatPage } from '../pages/threat-page.page';
import { ThreatEditorDialog } from '../dialogs/threat-editor.dialog';
import { CvssCalculatorDialog } from '../dialogs/cvss-calculator.dialog';
import { CwePickerDialog } from '../dialogs/cwe-picker.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class ThreatFlow {
  private tmEditPage: TmEditPage;
  private threatPage: ThreatPage;
  private threatEditorDialog: ThreatEditorDialog;
  private cvssDialog: CvssCalculatorDialog;
  private cwePickerDialog: CwePickerDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.tmEditPage = new TmEditPage(page);
    this.threatPage = new ThreatPage(page);
    this.threatEditorDialog = new ThreatEditorDialog(page);
    this.cvssDialog = new CvssCalculatorDialog(page);
    this.cwePickerDialog = new CwePickerDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createFromTmEdit(name: string) {
    await this.tmEditPage.addThreatButton().scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await this.tmEditPage.addThreatButton().click();
    await this.threatEditorDialog.fillName(name);
    await this.threatEditorDialog.save();
    // Wait for dialog to close
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async openFromTmEdit(name: string) {
    await this.tmEditPage.threatRow(name).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+\/threat\/[a-f0-9-]+/, { timeout: 10000 });
  }

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
