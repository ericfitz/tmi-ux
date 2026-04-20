import { Page } from '@playwright/test';
import { TriagePage } from '../pages/triage.page';
import { RevisionNotesDialog } from '../dialogs/revision-notes.dialog';

export class TriageFlow {
  private triagePage: TriagePage;
  private revisionNotesDialog: RevisionNotesDialog;

  constructor(private page: Page) {
    this.triagePage = new TriagePage(page);
    this.revisionNotesDialog = new RevisionNotesDialog(page);
  }

  async filterByStatus(status: string) {
    await this.triagePage.statusFilter().click();
    await this.page.locator('mat-option').filter({ hasText: status }).click();
    await this.page.keyboard.press('Escape');
    await this.page.waitForLoadState('networkidle');
  }

  async filterByTemplate(name: string) {
    await this.triagePage.templateFilter().click();
    await this.page.locator('mat-option').filter({ hasText: name }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async searchByName(term: string) {
    await this.triagePage.searchInput().fill(term);
    await this.page.waitForLoadState('networkidle');
  }

  async clearFilters() {
    await this.triagePage.clearFiltersButton().click();
    await this.page.waitForLoadState('networkidle');
  }

  async viewResponse(name: string) {
    await this.triagePage.viewButton(name).click();
    await this.page.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  async approveResponse(name: string) {
    await this.triagePage.approveButton(name).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/survey_responses/') && resp.status() < 300
    );
  }

  async returnForRevision(name: string, notes: string) {
    await this.triagePage.revisionButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.revisionNotesDialog.fillNotes(notes);
    await this.revisionNotesDialog.confirm();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async createThreatModel(name: string) {
    await this.triagePage.createTmButton(name).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/threat_models') && resp.status() < 300
    );
  }
}
