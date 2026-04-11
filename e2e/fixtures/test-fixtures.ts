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
import { NotePage } from '../pages/note-page.page';
import { AssetEditorDialog } from '../dialogs/asset-editor.dialog';
import { DocumentEditorDialog } from '../dialogs/document-editor.dialog';
import { RepositoryEditorDialog } from '../dialogs/repository-editor.dialog';
import { MetadataDialog } from '../dialogs/metadata.dialog';
import { PermissionsDialog } from '../dialogs/permissions.dialog';
import { SsvcCalculatorDialog } from '../dialogs/ssvc-calculator.dialog';
import { ExportDialog } from '../dialogs/export.dialog';
import { FrameworkMappingPickerDialog } from '../dialogs/framework-mapping-picker.dialog';
import { AuthFlow } from '../flows/auth.flow';
import { ThreatModelFlow } from '../flows/threat-model.flow';
import { ThreatFlow } from '../flows/threat.flow';
import { DiagramFlow } from '../flows/diagram.flow';
import { AssetFlow } from '../flows/asset.flow';
import { DocumentFlow } from '../flows/document.flow';
import { RepositoryFlow } from '../flows/repository.flow';
import { NoteFlow } from '../flows/note.flow';
import { MetadataFlow } from '../flows/metadata.flow';
import { PermissionsFlow } from '../flows/permissions.flow';
import { ScoringFlow } from '../flows/scoring.flow';

type TestFixtures = {
  // Pages
  dashboardPage: DashboardPage;
  tmEditPage: TmEditPage;
  threatPage: ThreatPage;
  dfdEditorPage: DfdEditorPage;
  triagePage: TriagePage;
  loginPage: LoginPage;
  navbarPage: NavbarPage;
  notePage: NotePage;

  // Dialogs
  createTmDialog: CreateTmDialog;
  createDiagramDialog: CreateDiagramDialog;
  deleteConfirmDialog: DeleteConfirmDialog;
  threatEditorDialog: ThreatEditorDialog;
  cvssCalculatorDialog: CvssCalculatorDialog;
  cwePickerDialog: CwePickerDialog;
  assetEditorDialog: AssetEditorDialog;
  documentEditorDialog: DocumentEditorDialog;
  repositoryEditorDialog: RepositoryEditorDialog;
  metadataDialog: MetadataDialog;
  permissionsDialog: PermissionsDialog;
  ssvcCalculatorDialog: SsvcCalculatorDialog;
  exportDialog: ExportDialog;
  frameworkMappingPickerDialog: FrameworkMappingPickerDialog;

  // Flows
  authFlow: AuthFlow;
  threatModelFlow: ThreatModelFlow;
  threatFlow: ThreatFlow;
  diagramFlow: DiagramFlow;
  assetFlow: AssetFlow;
  documentFlow: DocumentFlow;
  repositoryFlow: RepositoryFlow;
  noteFlow: NoteFlow;
  metadataFlow: MetadataFlow;
  permissionsFlow: PermissionsFlow;
  scoringFlow: ScoringFlow;
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
  notePage: async ({ page }, use) => {
    await use(new NotePage(page));
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
  assetEditorDialog: async ({ page }, use) => {
    await use(new AssetEditorDialog(page));
  },
  documentEditorDialog: async ({ page }, use) => {
    await use(new DocumentEditorDialog(page));
  },
  repositoryEditorDialog: async ({ page }, use) => {
    await use(new RepositoryEditorDialog(page));
  },
  metadataDialog: async ({ page }, use) => {
    await use(new MetadataDialog(page));
  },
  permissionsDialog: async ({ page }, use) => {
    await use(new PermissionsDialog(page));
  },
  ssvcCalculatorDialog: async ({ page }, use) => {
    await use(new SsvcCalculatorDialog(page));
  },
  exportDialog: async ({ page }, use) => {
    await use(new ExportDialog(page));
  },
  frameworkMappingPickerDialog: async ({ page }, use) => {
    await use(new FrameworkMappingPickerDialog(page));
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
  assetFlow: async ({ page }, use) => {
    await use(new AssetFlow(page));
  },
  documentFlow: async ({ page }, use) => {
    await use(new DocumentFlow(page));
  },
  repositoryFlow: async ({ page }, use) => {
    await use(new RepositoryFlow(page));
  },
  noteFlow: async ({ page }, use) => {
    await use(new NoteFlow(page));
  },
  metadataFlow: async ({ page }, use) => {
    await use(new MetadataFlow(page));
  },
  permissionsFlow: async ({ page }, use) => {
    await use(new PermissionsFlow(page));
  },
  scoringFlow: async ({ page }, use) => {
    await use(new ScoringFlow(page));
  },
});

export { expect } from '@playwright/test';
