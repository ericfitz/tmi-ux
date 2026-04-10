import { Page } from '@playwright/test';

export class DfdEditorPage {
  constructor(private page: Page) {}

  readonly graphContainer = () => this.page.getByTestId('graph-container');
  readonly addActorButton = () => this.page.getByTestId('add-actor-button');
  readonly addProcessButton = () => this.page.getByTestId('add-process-button');
  readonly addStoreButton = () => this.page.getByTestId('add-store-button');
  readonly closeButton = () => this.page.getByTestId('close-diagram-button');

  readonly nodes = () => this.page.locator('.x6-node');
}
