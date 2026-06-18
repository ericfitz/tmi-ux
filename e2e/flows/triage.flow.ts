import { Page } from '@playwright/test';
import { TriagePage } from '../pages/triage.page';
import { RevisionNotesDialog } from '../dialogs/revision-notes.dialog';

// SEM@7cbd1a4a9519eb72ea7f3f46e9a76e4e192159d2: E2E flow object for triage list page actions (pure)
export class TriageFlow {
  private triagePage: TriagePage;
  private revisionNotesDialog: RevisionNotesDialog;

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: build triage flow with page object and dialog references (pure)
  constructor(private page: Page) {
    this.triagePage = new TriagePage(page);
    this.revisionNotesDialog = new RevisionNotesDialog(page);
  }

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: filter triage list by review status and await reload (mutates shared state)
  async filterByStatus(status: string) {
    await this.triagePage.statusFilter().click();
    await this.page.locator('mat-option').filter({ hasText: status }).click();
    await this.page.keyboard.press('Escape');
    await this.page.waitForLoadState('networkidle');
  }

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: filter triage list by survey template name and await reload (mutates shared state)
  async filterByTemplate(name: string) {
    await this.triagePage.templateFilter().click();
    await this.page.locator('mat-option').filter({ hasText: name }).click();
    await this.page.waitForLoadState('networkidle');
  }

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: search triage list by name term and await reload (mutates shared state)
  async searchByName(term: string) {
    await this.triagePage.searchInput().fill(term);
    await this.page.waitForLoadState('networkidle');
  }

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: clear all triage list filters and await reload (mutates shared state)
  async clearFilters() {
    await this.triagePage.clearFiltersButton().click();
    await this.page.waitForLoadState('networkidle');
  }

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: navigate to a named survey response's triage detail page (mutates shared state)
  async viewResponse(name: string) {
    await this.triagePage.viewButton(name).click();
    await this.page.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await this.page.waitForLoadState('networkidle');
  }

  // SEM@7cbd1a4a9519eb72ea7f3f46e9a76e4e192159d2: approve a named survey response from the triage list (mutates shared state)
  async approveResponse(name: string) {
    await this.triagePage.approveButton(name).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/survey_responses/') && resp.status() < 300
    );
  }

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: return a named survey response for revision with reviewer notes (mutates shared state)
  async returnForRevision(name: string, notes: string) {
    await this.triagePage.revisionButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.revisionNotesDialog.fillNotes(notes);
    await this.revisionNotesDialog.confirm();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@7cbd1a4a9519eb72ea7f3f46e9a76e4e192159d2: build a threat model from a named triage list entry and await API confirmation (mutates shared state)
  async createThreatModel(name: string) {
    await this.triagePage.createTmButton(name).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/threat_models') && resp.status() < 300
    );
  }
}
