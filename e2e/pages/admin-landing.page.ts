import { Page } from '@playwright/test';

// SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: page object exposing locators for the admin landing section cards
export class AdminLandingPage {
  // SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: build page object bound to a Playwright page instance (pure)
  constructor(private page: Page) {}

  readonly closeButton = () => this.page.getByTestId('admin-close-button');
  readonly sectionCards = () => this.page.locator('[data-testid^="admin-section-card-"]');
  // SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: locate an admin section card by its action identifier (pure)
  sectionCard(action: string) {
    return this.page.getByTestId(`admin-section-card-${action}`);
  }
}
