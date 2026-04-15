import { Page } from '@playwright/test';

export class TriageDetailPage {
  constructor(private page: Page) {}

  readonly approveButton = () =>
    this.page.getByTestId('triage-detail-approve-button');
  readonly revisionButton = () =>
    this.page.getByTestId('triage-detail-revision-button');
  readonly createTmButton = () =>
    this.page.getByTestId('triage-detail-create-tm-button');
  readonly closeButton = () =>
    this.page.getByTestId('triage-detail-close-button');
  readonly toggleNotesButton = () =>
    this.page.getByTestId('triage-detail-toggle-notes-button');
  readonly addNoteButton = () =>
    this.page.getByTestId('triage-detail-add-note-button');
  readonly noteRows = () =>
    this.page.getByTestId('triage-detail-note-row');
  readonly noteRow = (name: string) =>
    this.noteRows().filter({ hasText: name });
  readonly viewNoteButton = (name: string) =>
    this.noteRow(name).getByTestId('triage-detail-view-note-button');
  readonly toggleResponsesButton = () =>
    this.page.getByTestId('triage-detail-toggle-responses-button');
  readonly copyIdButton = () =>
    this.page.getByTestId('triage-detail-copy-id-button');
  readonly status = () =>
    this.page.getByTestId('triage-detail-status');
  readonly submitter = () =>
    this.page.getByTestId('triage-detail-submitter');
  readonly responseRows = () =>
    this.page.getByTestId('triage-detail-response-row');
}
