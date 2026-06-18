import { Page } from '@playwright/test';
import { TriageDetailPage } from '../pages/triage-detail.page';
import { RevisionNotesDialog } from '../dialogs/revision-notes.dialog';
import { TriageNoteEditorDialog } from '../dialogs/triage-note-editor.dialog';

// SEM@7cbd1a4a9519eb72ea7f3f46e9a76e4e192159d2: E2E flow object for triage detail page actions (pure)
export class TriageDetailFlow {
  private detail: TriageDetailPage;
  private revisionNotesDialog: RevisionNotesDialog;
  private noteEditorDialog: TriageNoteEditorDialog;

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: build triage detail flow with page object and dialog references (pure)
  constructor(private page: Page) {
    this.detail = new TriageDetailPage(page);
    this.revisionNotesDialog = new RevisionNotesDialog(page);
    this.noteEditorDialog = new TriageNoteEditorDialog(page);
  }

  // SEM@7cbd1a4a9519eb72ea7f3f46e9a76e4e192159d2: approve a survey response and await API confirmation (mutates shared state)
  async approve() {
    await this.detail.approveButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/survey_responses/') && resp.status() < 300
    );
  }

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: return a survey response for revision with reviewer notes (mutates shared state)
  async returnForRevision(notes: string) {
    await this.detail.revisionButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.revisionNotesDialog.fillNotes(notes);
    await this.revisionNotesDialog.confirm();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@7cbd1a4a9519eb72ea7f3f46e9a76e4e192159d2: build a threat model from a triage detail and await API confirmation (mutates shared state)
  async createThreatModel() {
    await this.detail.createTmButton().click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/threat_models') && resp.status() < 300
    );
  }

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: add a reviewer note to a triage detail via the note editor dialog (mutates shared state)
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

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: open the note viewer dialog for a named reviewer note (pure)
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
