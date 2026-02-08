import {
  Component,
  OnInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  ViewChild,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
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
export class AdminSurveysComponent implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);

  @ViewChild(MatSort) sort!: MatSort;

  templates: SurveyListItem[] = [];
  dataSource = new MatTableDataSource<SurveyListItem>([]);
  loading = true;
  error: string | null = null;

  statusFilter: SurveyStatus | 'all' = 'all';
  searchText = '';

  readonly statusOptions: { value: SurveyStatus | 'all'; labelKey: string }[] = [
    { value: 'all', labelKey: 'common.allStatuses' },
    { value: 'active', labelKey: 'surveys.templateStatus.active' },
    { value: 'inactive', labelKey: 'surveys.templateStatus.inactive' },
    { value: 'archived', labelKey: 'surveys.templateStatus.archived' },
  ];

  readonly displayedColumns = ['name', 'status', 'version', 'modified', 'actions'];

  constructor(
    private authService: AuthService,
    private surveyService: SurveyService,
    private router: Router,
    private dialog: MatDialog,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService,
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (
      item: SurveyListItem,
      property: string,
    ): string | number => {
      switch (property) {
        case 'name':
          return item.name.toLowerCase();
        case 'status':
          return item.status.toLowerCase();
        case 'version':
          return item.version.toLowerCase();
        case 'modified':
          return new Date(item.modified_at ?? item.created_at).getTime();
        default:
          return '';
      }
    };
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
          this.error = this.transloco.translate('adminSurveys.errorLoadingTemplates');
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

    this.dataSource.data = filtered;
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
    const newName = `${template.name} ${this.transloco.translate('adminSurveys.cloneSuffix')}`;

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
   * Get status icon
   */
  getStatusIcon(status: SurveyStatus): string {
    const iconMap: Record<SurveyStatus, string> = {
      active: 'check_circle',
      inactive: 'pause_circle',
      archived: 'archive',
    };
    return iconMap[status] ?? 'help';
  }

  /**
   * Navigate back to admin page
   */
  onClose(): void {
    if (this.authService.isAdmin) {
      void this.router.navigate(['/admin']);
    } else {
      void this.router.navigate([this.authService.getLandingPage()]);
    }
  }
}
