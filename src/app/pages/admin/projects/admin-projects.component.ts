import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { ProjectListItem } from '@app/types/project.types';
import { adjustPageAfterDeletion } from '@app/shared/utils/pagination.util';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import { ProjectsListBase } from '@app/pages/projects/projects-list-base';

/**
 * Admin Projects Component
 *
 * Displays and manages projects. Supports listing, filtering by name/team/status,
 * pagination, and actions for editing details, responsible parties,
 * related projects, metadata, and deletion.
 *
 * Shared list/filter/CRUD behavior lives in {@link ProjectsListBase}; this component
 * only provides the admin-specific close navigation and delete confirmation flow.
 */
@Component({
  selector: 'app-admin-projects',
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
  templateUrl: './admin-projects.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './admin-projects.component.scss',
})
// SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: admin page component for listing and managing review projects
export class AdminProjectsComponent extends ProjectsListBase {
  private translocoService = inject(TranslocoService);

  /** Navigate back to admin landing page. */
  // SEM@6b183fad0ddaa8ad841906d3ca3be67be6e15acc: navigate back to the admin landing page
  onClose(): void {
    void this.router.navigate(['/admin']);
  }

  /** Confirm and delete the given project. */
  // SEM@f8876a826b949da1079dc0fe9eb97ae85aee0a63: delete a project after confirmation and reload the project list (reads DB)
  onDelete(project: ProjectListItem): void {
    const message = this.translocoService.translate('projects.deleteDialog.message', {
      name: project.name,
    });
    if (!confirm(message)) return;

    this.projectService
      .delete(project.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const adjusted = adjustPageAfterDeletion(
            this.pageIndex,
            this.dataSource.data.length - 1,
            this.totalProjects - 1,
          );
          this.pageIndex = adjusted;
          this.loadProjects();
        },
        error: error => {
          this.logger.error('Failed to delete project', error);
        },
      });
  }
}
