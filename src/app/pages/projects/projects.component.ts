import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { ProjectListItem } from '@app/types/project.types';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import { DeleteConfirmationDialogComponent } from '@app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component';
import {
  DeleteConfirmationDialogData,
  DeleteConfirmationDialogResult,
} from '@app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.types';
import { ProjectsListBase } from './projects-list-base';

/**
 * User Projects Component
 *
 * Displays and manages projects for the current user. Supports listing, filtering by name/team/status,
 * pagination, and actions for editing details, responsible parties,
 * related projects, and metadata.
 *
 * Shared list/filter/CRUD behavior lives in {@link ProjectsListBase}; this component
 * only provides the user-specific close navigation and delete confirmation flow.
 */
@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatAutocompleteModule,
    TranslocoModule,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
// SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: list and delete review projects with pagination, filtering, and navigation
export class ProjectsComponent extends ProjectsListBase {
  private location = inject(Location);

  /** Navigate back to the previous page. */
  // SEM@8db6257476daf93c4ae175dacbecf11d2f5f2671: navigate back to the previous page in browser history (mutates shared state)
  onClose(): void {
    this.location.back();
  }

  /** Open the delete confirmation dialog and delete the project on confirm. */
  // SEM@6d9d66672763adecc482974841b300a67ef5a5ef: confirm and delete a review project, then reload the project list
  onDelete(project: ProjectListItem): void {
    const dialogData: DeleteConfirmationDialogData = {
      id: project.id,
      name: project.name,
      objectType: 'project',
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
        this.projectService
          .delete(project.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => this.loadProjects(),
            error: error => this.logger.error('Failed to delete project', error),
          });
      });
  }
}
