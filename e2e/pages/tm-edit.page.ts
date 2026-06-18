import { Page } from '@playwright/test';

// SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: Playwright page object exposing threat model edit view locators and actions (pure)
export class TmEditPage {
  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: bind the Playwright page for the threat model edit page object (pure)
  constructor(private page: Page) {}

  readonly tmName = () => this.page.getByTestId('threat-model-name');
  readonly addDiagramButton = () => this.page.getByTestId('add-diagram-button');
  readonly addThreatButton = () => this.page.getByTestId('add-threat-button');

  readonly diagramRows = () => this.page.getByTestId('diagram-row');
  readonly threatRows = () => this.page.getByTestId('threat-row');

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: filter diagram rows to those matching the given name (pure)
  diagramRow(name: string) {
    return this.diagramRows().filter({ hasText: name });
  }

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: filter threat rows to those matching the given name (pure)
  threatRow(name: string) {
    return this.threatRows().filter({ hasText: name });
  }

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: locate the overflow menu button in a named diagram row (pure)
  diagramKebabButton(name: string) {
    return this.diagramRow(name).locator('button[mat-icon-button]').filter({
      has: this.page.locator('mat-icon:has-text("more_vert")'),
    });
  }

  readonly diagramDeleteButton = () =>
    this.page.getByTestId('diagram-delete-button');
}
