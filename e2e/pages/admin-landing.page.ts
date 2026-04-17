import { Page } from '@playwright/test';

export class AdminLandingPage {
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('admin-close-button');
  readonly sectionCards = () => this.page.locator('[data-testid^="admin-section-card-"]');
  sectionCard(action: string) {
    return this.page.getByTestId(`admin-section-card-${action}`);
  }
}
