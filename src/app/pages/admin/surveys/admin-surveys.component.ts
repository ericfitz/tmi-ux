import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { AuthService } from '@app/auth/services/auth.service';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveyService } from '@app/pages/surveys/services/survey.service';
import { SurveyListItem, SurveyStatus } from '@app/types/survey.types';

/**
 * Admin surveys component
 * Manages survey templates - list, create, edit, clone, archive
 */
@Component({
  selector: 'app-admin-surveys',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './admin-surveys.component.html',
  styleUrl: './admin-surveys.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSurveysComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  templates: SurveyListItem[] = [];
  filteredTemplates: SurveyListItem[] = [];
  loading = true;
  error: string | null = null;

  statusFilter: SurveyStatus | 'all' = 'all';
  searchText = '';

  readonly statusOptions: { value: SurveyStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'archived', label: 'Archived' },
  ];

  readonly displayedColumns = ['name', 'status', 'version', 'modified', 'actions'];

  constructor(
    private authService: AuthService,
    private surveyService: SurveyService,
    private router: Router,
    private dialog: MatDialog,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  /**
   * Load all templates
   */
  loadTemplates(): void {
    this.loading = true;
    this.error = null;

    this.surveyService
      .listAdmin()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.templates = response.surveys;
          this.applyFilters();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.error = 'Failed to load templates';
          this.loading = false;
          this.logger.error('Failed to load survey templates', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Apply filters
   */
  applyFilters(): void {
    let filtered = [...this.templates];

    // Status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === this.statusFilter);
    }

    // Search filter
    if (this.searchText) {
      const search = this.searchText.toLowerCase();
      filtered = filtered.filter(
        t => t.name.toLowerCase().includes(search) || t.description?.toLowerCase().includes(search),
      );
    }

    // Sort by modified date descending
    filtered.sort((a, b) => new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime());

    this.filteredTemplates = filtered;
  }

  /**
   * Handle filter change
   */
  onFilterChange(): void {
    this.applyFilters();
  }

  /**
   * Create a new template
   */
  createTemplate(): void {
    void this.router.navigate(['/admin', 'surveys', 'new']);
  }

  /**
   * Edit a template
   */
  editTemplate(template: SurveyListItem): void {
    void this.router.navigate(['/admin', 'surveys', template.id]);
  }

  /**
   * Clone a template
   */
  cloneTemplate(template: SurveyListItem): void {
    const newName = `${template.name} (Copy)`;

    this.surveyService
      .clone(template.id, newName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: cloned => {
          this.logger.info('Template cloned', { originalId: template.id, newId: cloned.id });
          this.loadTemplates();
        },
        error: error => {
          this.logger.error('Failed to clone template', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Toggle template status
   */
  toggleStatus(template: SurveyListItem): void {
    const newStatus: SurveyStatus = template.status === 'active' ? 'inactive' : 'active';

    this.surveyService
      .setStatus(template.id, newStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadTemplates();
        },
        error: error => {
          this.logger.error('Failed to update template status', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Archive a template
   */
  archiveTemplate(template: SurveyListItem): void {
    this.surveyService
      .archive(template.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadTemplates();
        },
        error: error => {
          this.logger.error('Failed to archive template', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Get status display info
   */
  getStatusInfo(status: SurveyStatus): { label: string; color: string; icon: string } {
    const statusMap: Record<SurveyStatus, { label: string; color: string; icon: string }> = {
      active: { label: 'Active', color: 'primary', icon: 'check_circle' },
      inactive: { label: 'Inactive', color: 'default', icon: 'pause_circle' },
      archived: { label: 'Archived', color: 'warn', icon: 'archive' },
    };
    return statusMap[status] ?? { label: status, color: 'default', icon: 'help' };
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Navigate back to admin page
   */
  onClose(): void {
    if (this.authService.isAdmin) {
      void this.router.navigate(['/admin']);
    } else {
      void this.router.navigate(['/dashboard']);
    }
  }
}
