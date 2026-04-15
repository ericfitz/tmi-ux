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
import { SurveyListPage } from '../pages/survey-list.page';
import { SurveyFillPage } from '../pages/survey-fill.page';
import { MyResponsesPage } from '../pages/my-responses.page';
import { ResponseDetailPage } from '../pages/response-detail.page';
import { AdminSurveysPage } from '../pages/admin-surveys.page';
import { TemplateBuilderPage } from '../pages/template-builder.page';
import { TriageDetailPage } from '../pages/triage-detail.page';
import { ReviewerAssignmentPage } from '../pages/reviewer-assignment.page';
import { CreateSurveyDialog } from '../dialogs/create-survey.dialog';
import { SurveyConfidentialDialog } from '../dialogs/survey-confidential.dialog';
import { RevisionNotesDialog } from '../dialogs/revision-notes.dialog';
import { TriageNoteEditorDialog } from '../dialogs/triage-note-editor.dialog';
import { SurveyAdminFlow } from '../flows/survey-admin.flow';
import { SurveyBuilderFlow } from '../flows/survey-builder.flow';
import { SurveyFillFlow } from '../flows/survey-fill.flow';
import { SurveyResponseFlow } from '../flows/survey-response.flow';
import { TriageFlow } from '../flows/triage.flow';
import { TriageDetailFlow } from '../flows/triage-detail.flow';
import { ReviewerAssignmentFlow } from '../flows/reviewer-assignment.flow';
import { TeamsPage } from '../pages/teams.page';
import { ProjectsPage } from '../pages/projects.page';
import { CreateTeamDialog } from '../dialogs/create-team.dialog';
import { EditTeamDialog } from '../dialogs/edit-team.dialog';
import { TeamMembersDialog } from '../dialogs/team-members.dialog';
import { ResponsiblePartiesDialog } from '../dialogs/responsible-parties.dialog';
import { RelatedTeamsDialog } from '../dialogs/related-teams.dialog';
import { CreateProjectDialog } from '../dialogs/create-project.dialog';
import { EditProjectDialog } from '../dialogs/edit-project.dialog';
import { RelatedProjectsDialog } from '../dialogs/related-projects.dialog';
import { TeamFlow } from '../flows/team.flow';
import { ProjectFlow } from '../flows/project.flow';
import { DashboardFilterFlow } from '../flows/dashboard-filter.flow';

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

  // Pages (Phase 3)
  surveyListPage: SurveyListPage;
  surveyFillPage: SurveyFillPage;
  myResponsesPage: MyResponsesPage;
  responseDetailPage: ResponseDetailPage;
  adminSurveysPage: AdminSurveysPage;
  templateBuilderPage: TemplateBuilderPage;
  triageDetailPage: TriageDetailPage;
  reviewerAssignmentPage: ReviewerAssignmentPage;

  // Dialogs (Phase 3)
  createSurveyDialog: CreateSurveyDialog;
  surveyConfidentialDialog: SurveyConfidentialDialog;
  revisionNotesDialog: RevisionNotesDialog;
  triageNoteEditorDialog: TriageNoteEditorDialog;

  // Pages (Phase 4)
  teamsPage: TeamsPage;
  projectsPage: ProjectsPage;

  // Dialogs (Phase 4)
  createTeamDialog: CreateTeamDialog;
  editTeamDialog: EditTeamDialog;
  teamMembersDialog: TeamMembersDialog;
  responsiblePartiesDialog: ResponsiblePartiesDialog;
  relatedTeamsDialog: RelatedTeamsDialog;
  createProjectDialog: CreateProjectDialog;
  editProjectDialog: EditProjectDialog;
  relatedProjectsDialog: RelatedProjectsDialog;

  // Flows (Phase 4)
  teamFlow: TeamFlow;
  projectFlow: ProjectFlow;
  dashboardFilterFlow: DashboardFilterFlow;

  // Flows (Phase 3)
  surveyAdminFlow: SurveyAdminFlow;
  surveyBuilderFlow: SurveyBuilderFlow;
  surveyFillFlow: SurveyFillFlow;
  surveyResponseFlow: SurveyResponseFlow;
  triageFlow: TriageFlow;
  triageDetailFlow: TriageDetailFlow;
  reviewerAssignmentFlow: ReviewerAssignmentFlow;
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

  // Pages (Phase 4)
  teamsPage: async ({ page }, use) => {
    await use(new TeamsPage(page));
  },
  projectsPage: async ({ page }, use) => {
    await use(new ProjectsPage(page));
  },

  // Dialogs (Phase 4)
  createTeamDialog: async ({ page }, use) => {
    await use(new CreateTeamDialog(page));
  },
  editTeamDialog: async ({ page }, use) => {
    await use(new EditTeamDialog(page));
  },
  teamMembersDialog: async ({ page }, use) => {
    await use(new TeamMembersDialog(page));
  },
  responsiblePartiesDialog: async ({ page }, use) => {
    await use(new ResponsiblePartiesDialog(page));
  },
  relatedTeamsDialog: async ({ page }, use) => {
    await use(new RelatedTeamsDialog(page));
  },
  createProjectDialog: async ({ page }, use) => {
    await use(new CreateProjectDialog(page));
  },
  editProjectDialog: async ({ page }, use) => {
    await use(new EditProjectDialog(page));
  },
  relatedProjectsDialog: async ({ page }, use) => {
    await use(new RelatedProjectsDialog(page));
  },

  // Flows (Phase 4)
  teamFlow: async ({ page }, use) => {
    await use(new TeamFlow(page));
  },
  projectFlow: async ({ page }, use) => {
    await use(new ProjectFlow(page));
  },
  dashboardFilterFlow: async ({ page }, use) => {
    await use(new DashboardFilterFlow(page));
  },

  // Pages (Phase 3)
  surveyListPage: async ({ page }, use) => {
    await use(new SurveyListPage(page));
  },
  surveyFillPage: async ({ page }, use) => {
    await use(new SurveyFillPage(page));
  },
  myResponsesPage: async ({ page }, use) => {
    await use(new MyResponsesPage(page));
  },
  responseDetailPage: async ({ page }, use) => {
    await use(new ResponseDetailPage(page));
  },
  adminSurveysPage: async ({ page }, use) => {
    await use(new AdminSurveysPage(page));
  },
  templateBuilderPage: async ({ page }, use) => {
    await use(new TemplateBuilderPage(page));
  },
  triageDetailPage: async ({ page }, use) => {
    await use(new TriageDetailPage(page));
  },
  reviewerAssignmentPage: async ({ page }, use) => {
    await use(new ReviewerAssignmentPage(page));
  },

  // Dialogs (Phase 3)
  createSurveyDialog: async ({ page }, use) => {
    await use(new CreateSurveyDialog(page));
  },
  surveyConfidentialDialog: async ({ page }, use) => {
    await use(new SurveyConfidentialDialog(page));
  },
  revisionNotesDialog: async ({ page }, use) => {
    await use(new RevisionNotesDialog(page));
  },
  triageNoteEditorDialog: async ({ page }, use) => {
    await use(new TriageNoteEditorDialog(page));
  },

  // Flows (Phase 3)
  surveyAdminFlow: async ({ page }, use) => {
    await use(new SurveyAdminFlow(page));
  },
  surveyBuilderFlow: async ({ page }, use) => {
    await use(new SurveyBuilderFlow(page));
  },
  surveyFillFlow: async ({ page }, use) => {
    await use(new SurveyFillFlow(page));
  },
  surveyResponseFlow: async ({ page }, use) => {
    await use(new SurveyResponseFlow(page));
  },
  triageFlow: async ({ page }, use) => {
    await use(new TriageFlow(page));
  },
  triageDetailFlow: async ({ page }, use) => {
    await use(new TriageDetailFlow(page));
  },
  reviewerAssignmentFlow: async ({ page }, use) => {
    await use(new ReviewerAssignmentFlow(page));
  },
});

export { expect } from '@playwright/test';
