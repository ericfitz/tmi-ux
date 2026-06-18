import { Page } from '@playwright/test';
import { TeamsPage } from '../pages/teams.page';
import { CreateTeamDialog } from '../dialogs/create-team.dialog';
import { EditTeamDialog } from '../dialogs/edit-team.dialog';
import { TeamMembersDialog } from '../dialogs/team-members.dialog';
import { ResponsiblePartiesDialog } from '../dialogs/responsible-parties.dialog';
import { RelatedTeamsDialog } from '../dialogs/related-teams.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';
import { MetadataDialog } from '../dialogs/metadata.dialog';
import { UserPickerDialog } from '../dialogs/user-picker.dialog';

// SEM@bb65e02191d3f75c13fdb0a10b75f2837d573933: E2E page-object facade orchestrating team CRUD and sub-dialog flows
export class TeamFlow {
  private teamsPage: TeamsPage;
  private createTeamDialog: CreateTeamDialog;
  private editTeamDialog: EditTeamDialog;
  private teamMembersDialog: TeamMembersDialog;
  private responsiblePartiesDialog: ResponsiblePartiesDialog;
  private relatedTeamsDialog: RelatedTeamsDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;
  private metadataDialog: MetadataDialog;

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: build all page-object and dialog handles for the team flow (pure)
  constructor(private page: Page) {
    this.teamsPage = new TeamsPage(page);
    this.createTeamDialog = new CreateTeamDialog(page);
    this.editTeamDialog = new EditTeamDialog(page);
    this.teamMembersDialog = new TeamMembersDialog(page);
    this.responsiblePartiesDialog = new ResponsiblePartiesDialog(page);
    this.relatedTeamsDialog = new RelatedTeamsDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
    this.metadataDialog = new MetadataDialog(page);
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: build a team via the create dialog and await the POST response
  async createTeam(fields: { name: string; description?: string; status?: string }) {
    await this.teamsPage.addButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.createTeamDialog.fillName(fields.name);
    if (fields.description) {
      await this.createTeamDialog.fillDescription(fields.description);
    }
    if (fields.status) {
      await this.createTeamDialog.selectStatus(fields.status);
    }
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/teams') && resp.request().method() === 'POST',
    );
    await this.createTeamDialog.submit();
    await responsePromise;
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@0044214fdc57a3ef5cd64987b680cab157eedffc: update team fields via the edit dialog and await the PATCH response
  async editTeam(
    name: string,
    updates: {
      name?: string;
      description?: string;
      status?: string;
    },
  ) {
    await this.teamsPage.editButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    if (updates.name) {
      await this.editTeamDialog.fillName(updates.name);
    }
    if (updates.description) {
      await this.editTeamDialog.fillDescription(updates.description);
    }
    if (updates.status) {
      await this.editTeamDialog.selectStatus(updates.status);
    }
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PATCH',
    );
    await this.editTeamDialog.save();
    await responsePromise;
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: delete a team via the more menu and confirm the deletion dialog
  async deleteTeam(name: string) {
    await this.teamsPage.moreButton(name).click();
    await this.teamsPage.deleteItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirmDialog.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: navigate to the team members dialog for a named team
  async openMembers(name: string) {
    await this.teamsPage.membersButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  // SEM@bb65e02191d3f75c13fdb0a10b75f2837d573933: add a user to the team with a given role via the user picker
  async addMember(email: string, role: string) {
    await this.teamMembersDialog.addButton().click();
    const picker = new UserPickerDialog(this.page);
    await picker.pickUser(email, role);
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: remove a team member at the given index via the members dialog
  async removeMember(index: number) {
    await this.teamMembersDialog.removeButton(index).click();
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: navigate to the responsible parties dialog for a named team
  async openResponsibleParties(name: string) {
    await this.teamsPage.moreButton(name).click();
    await this.teamsPage.responsiblePartiesItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  // SEM@bb65e02191d3f75c13fdb0a10b75f2837d573933: add a responsible party with a role via the user picker
  async addResponsibleParty(email: string, role: string) {
    await this.responsiblePartiesDialog.addButton().click();
    const picker = new UserPickerDialog(this.page);
    await picker.pickUser(email, role);
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: navigate to the related teams dialog for a named team
  async openRelatedTeams(name: string) {
    await this.teamsPage.moreButton(name).click();
    await this.teamsPage.relatedTeamsItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: register a related team with a specified relationship type
  async addRelatedTeam(teamName: string, relationship: string) {
    await this.relatedTeamsDialog.addButton().click();
    await this.page.waitForTimeout(300);
    await this.relatedTeamsDialog.searchTeam(teamName);
    await this.relatedTeamsDialog.selectRelationship(relationship);
    await this.relatedTeamsDialog.confirmAdd();
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: navigate to the metadata dialog for a named team
  async openMetadata(name: string) {
    await this.teamsPage.moreButton(name).click();
    await this.teamsPage.metadataItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }
}
