import { Page } from '@playwright/test';
import { TriageDetailPage } from '../pages/triage-detail.page';
import { RevisionNotesDialog } from '../dialogs/revision-notes.dialog';
import { TriageNoteEditorDialog } from '../dialogs/triage-note-editor.dialog';

export class TriageDetailFlow {
  private detail: TriageDetailPage;
  private revisionNotesDialog: RevisionNotesDialog;
  private noteEditorDialog: TriageNoteEditorDialog;

  constructor(private page: Page) {
    this.detail = new TriageDetailPage(page);
    this.revisionNotesDialog = new RevisionNotesDialog(page);
    this.noteEditorDialog = new TriageNoteEditorDialog(page);
  }

  async approve() {
    await this.detail.approveButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/survey_responses/') && resp.status() < 300
    );
  }

  async returnForRevision(notes: string) {
    await this.detail.revisionButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.revisionNotesDialog.fillNotes(notes);
    await this.revisionNotesDialog.confirm();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async createThreatModel() {
    await this.detail.createTmButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/threat_models') && resp.status() < 300
    );
  }

  async addNote(name: string, content: string) {
    const notesSection = this.detail.toggleNotesButton();
    const isExpanded = await notesSection.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await notesSection.click();
      await this.page.waitForTimeout(300);
    }

    await this.detail.addNoteButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.noteEditorDialog.fillName(name);
    await this.noteEditorDialog.fillContent(content);
    await this.noteEditorDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async viewNote(name: string) {
    const notesSection = this.detail.toggleNotesButton();
    const isExpanded = await notesSection.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await notesSection.click();
      await this.page.waitForTimeout(300);
    }

    await this.detail.viewNoteButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }
}
