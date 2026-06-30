import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { TeamListItem } from '@app/types/team.types';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import { DeleteConfirmationDialogComponent } from '@app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component';
import {
  DeleteConfirmationDialogData,
  DeleteConfirmationDialogResult,
} from '@app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.types';
import { TeamsListBase } from './teams-list-base';

/**
 * User Teams Component
 *
 * Displays and manages teams for the current user. Supports listing, filtering, pagination,
 * and actions for editing details, members, responsible parties, related teams, and metadata.
 */
@Component({
  selector: 'app-teams',
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
  templateUrl: './teams.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './teams.component.scss',
})
// SEM@c90b77ccf2b99ab38c62a818460252f2a1a1073f: display and manage the team list with delete and navigation actions
export class TeamsComponent extends TeamsListBase {
  private location = inject(Location);

  /** Navigate back to the previous page. */
  // SEM@f59ab5d251cf1610042058cdc7053c6e1ca38986: navigate back to the previous page in browser history (mutates shared state)
  onClose(): void {
    this.location.back();
  }

  /** Open the delete confirmation dialog and delete the team on confirm. */
  // SEM@6d9d66672763adecc482974841b300a67ef5a5ef: confirm team deletion via dialog then delete the team and reload the list
  onDelete(team: TeamListItem): void {
    const dialogData: DeleteConfirmationDialogData = {
      id: team.id,
      name: team.name,
      objectType: 'team',
    };

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '700px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: DeleteConfirmationDialogResult | undefined) => {
        if (!result?.confirmed) return;
        this.teamService
          .delete(team.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => this.loadTeams(),
            error: error => this.logger.error('Failed to delete team', error),
          });
      });
  }
}
