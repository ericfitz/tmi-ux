import { test as base } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { TmEditPage } from '../pages/tm-edit.page';
import { ThreatPage } from '../pages/threat-page.page';
import { DfdEditorPage } from '../pages/dfd-editor.page';
import { TriagePage } from '../pages/triage.page';
import { LoginPage } from '../pages/login.page';
import { NavbarPage } from '../pages/navbar.page';
import { CreateTmDialog } from '../dialogs/create-tm.dialog';
import { CreateDiagramDialog } from '../dialogs/create-diagram.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';
import { ThreatEditorDialog } from '../dialogs/threat-editor.dialog';
import { CvssCalculatorDialog } from '../dialogs/cvss-calculator.dialog';
import { CwePickerDialog } from '../dialogs/cwe-picker.dialog';
import { AuthFlow } from '../flows/auth.flow';
import { ThreatModelFlow } from '../flows/threat-model.flow';
import { ThreatFlow } from '../flows/threat.flow';
import { DiagramFlow } from '../flows/diagram.flow';

type TestFixtures = {
  // Pages
  dashboardPage: DashboardPage;
  tmEditPage: TmEditPage;
  threatPage: ThreatPage;
  dfdEditorPage: DfdEditorPage;
  triagePage: TriagePage;
  loginPage: LoginPage;
  navbarPage: NavbarPage;

  // Dialogs
  createTmDialog: CreateTmDialog;
  createDiagramDialog: CreateDiagramDialog;
  deleteConfirmDialog: DeleteConfirmDialog;
  threatEditorDialog: ThreatEditorDialog;
  cvssCalculatorDialog: CvssCalculatorDialog;
  cwePickerDialog: CwePickerDialog;

  // Flows
  authFlow: AuthFlow;
  threatModelFlow: ThreatModelFlow;
  threatFlow: ThreatFlow;
  diagramFlow: DiagramFlow;
};

export const test = base.extend<TestFixtures>({
  // Pages
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  tmEditPage: async ({ page }, use) => {
    await use(new TmEditPage(page));
  },
  threatPage: async ({ page }, use) => {
    await use(new ThreatPage(page));
  },
  dfdEditorPage: async ({ page }, use) => {
    await use(new DfdEditorPage(page));
  },
  triagePage: async ({ page }, use) => {
    await use(new TriagePage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  navbarPage: async ({ page }, use) => {
    await use(new NavbarPage(page));
  },

  // Dialogs
  createTmDialog: async ({ page }, use) => {
    await use(new CreateTmDialog(page));
  },
  createDiagramDialog: async ({ page }, use) => {
    await use(new CreateDiagramDialog(page));
  },
  deleteConfirmDialog: async ({ page }, use) => {
    await use(new DeleteConfirmDialog(page));
  },
  threatEditorDialog: async ({ page }, use) => {
    await use(new ThreatEditorDialog(page));
  },
  cvssCalculatorDialog: async ({ page }, use) => {
    await use(new CvssCalculatorDialog(page));
  },
  cwePickerDialog: async ({ page }, use) => {
    await use(new CwePickerDialog(page));
  },

  // Flows
  authFlow: async ({ page }, use) => {
    await use(new AuthFlow(page));
  },
  threatModelFlow: async ({ page }, use) => {
    await use(new ThreatModelFlow(page));
  },
  threatFlow: async ({ page }, use) => {
    await use(new ThreatFlow(page));
  },
  diagramFlow: async ({ page }, use) => {
    await use(new DiagramFlow(page));
  },
});

export { expect } from '@playwright/test';
