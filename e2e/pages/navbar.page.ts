import { Page } from '@playwright/test';

// SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: Playwright page object exposing locators for the navigation bar (pure)
export class NavbarPage {
  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: bind Playwright page instance to the page object (pure)
  constructor(private page: Page) {}

  readonly homeMenu = () => this.page.getByTestId('navbar-home-menu');
  readonly dashboardLink = () => this.page.getByTestId('navbar-dashboard-link');
  readonly intakeLink = () => this.page.getByTestId('navbar-intake-link');
  readonly triageLink = () => this.page.getByTestId('navbar-triage-link');
  readonly adminLink = () => this.page.getByTestId('navbar-admin-link');
  readonly userMenu = () => this.page.getByTestId('navbar-user-menu');
  readonly logoutButton = () => this.page.getByTestId('navbar-logout-button');
}
