import { Page } from '@playwright/test';

export class NavbarPage {
  constructor(private page: Page) {}

  readonly homeMenu = () => this.page.getByTestId('navbar-home-menu');
  readonly dashboardLink = () => this.page.getByTestId('navbar-dashboard-link');
  readonly intakeLink = () => this.page.getByTestId('navbar-intake-link');
  readonly triageLink = () => this.page.getByTestId('navbar-triage-link');
  readonly adminLink = () => this.page.getByTestId('navbar-admin-link');
  readonly userMenu = () => this.page.getByTestId('navbar-user-menu');
  readonly logoutButton = () => this.page.getByTestId('navbar-logout-button');
}
