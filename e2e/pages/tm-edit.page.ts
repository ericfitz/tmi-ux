import { Page } from '@playwright/test';

export class TmEditPage {
  constructor(private page: Page) {}

  readonly tmName = () => this.page.getByTestId('threat-model-name');
  readonly addDiagramButton = () => this.page.getByTestId('add-diagram-button');
  readonly addThreatButton = () => this.page.getByTestId('add-threat-button');

  readonly diagramRows = () => this.page.getByTestId('diagram-row');
  readonly threatRows = () => this.page.getByTestId('threat-row');

  diagramRow(name: string) {
    return this.diagramRows().filter({ hasText: name });
  }

  threatRow(name: string) {
    return this.threatRows().filter({ hasText: name });
  }

  diagramKebabButton(name: string) {
    return this.diagramRow(name).locator('button[mat-icon-button]').filter({
      has: this.page.locator('mat-icon:has-text("more_vert")'),
    });
  }

  readonly diagramDeleteButton = () =>
    this.page.getByTestId('diagram-delete-button');
}
