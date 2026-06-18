import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { TeamListItem } from '@app/types/team.types';
import { adjustPageAfterDeletion } from '@app/shared/utils/pagination.util';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import { TeamsListBase } from '@app/pages/teams/teams-list-base';

/**
 * Admin Teams Component
 *
 * Displays and manages teams. Supports listing, filtering, pagination,
 * and actions for editing details, members, responsible parties,
 * related teams, metadata, and deletion.
 */
@Component({
  selector: 'app-admin-teams',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
  templateUrl: './admin-teams.component.html',
  styleUrl: './admin-teams.component.scss',
})
// SEM@c90b77ccf2b99ab38c62a818460252f2a1a1073f: admin page component for listing, navigating, and deleting teams
export class AdminTeamsComponent extends TeamsListBase {
  private translocoService = inject(TranslocoService);

  /** Navigate back to admin landing page. */
  // SEM@7ff922e246a547db210c7210681afb5c1d4ba170: navigate back to the admin landing page
  onClose(): void {
    void this.router.navigate(['/admin']);
  }

  /** Confirm and delete the given team. */
  // SEM@7ff922e246a547db210c7210681afb5c1d4ba170: confirm and delete a team, then reload the team list
  onDelete(team: TeamListItem): void {
    const message = this.translocoService.translate('teams.deleteDialog.message', {
      name: team.name,
    });
    let fullMessage = message;

    if (team.project_count && team.project_count > 0) {
      const warning = this.translocoService.translate('teams.deleteDialog.projectWarning', {
        count: team.project_count,
      });
      fullMessage = `${message}\n\n${warning}`;
    }

    if (!confirm(fullMessage)) return;

    this.teamService
      .delete(team.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const adjusted = adjustPageAfterDeletion(
            this.pageIndex,
            this.dataSource.data.length - 1,
            this.totalTeams - 1,
          );
          this.pageIndex = adjusted;
          this.loadTeams();
        },
        error: error => {
          this.logger.error('Failed to delete team', error);
        },
      });
  }
}
