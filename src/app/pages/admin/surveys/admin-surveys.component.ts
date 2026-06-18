import {
  Component,
  OnInit,
  AfterViewInit,
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
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
import { navigateFromAdminPage } from '../shared/admin-navigation.util';
import { SurveyListItem, SurveyStatus } from '@app/types/survey.types';
import {
  CreateSurveyDialogComponent,
  CreateSurveyDialogResult,
} from './components/create-survey-dialog/create-survey-dialog.component';
import { getErrorMessage } from '@app/shared/utils/http-error.utils';

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
// SEM@913973c2390b7180140950023b498e5c44ca2678: admin page for listing, filtering, and managing survey templates
export class AdminSurveysComponent implements OnInit, AfterViewInit, AfterViewChecked {
  private destroyRef = inject(DestroyRef);
  private elementRef = inject(ElementRef);

  @ViewChild(MatSort) sort!: MatSort;

  templates: SurveyListItem[] = [];
  dataSource = new MatTableDataSource<SurveyListItem>([]);
  loading = true;
  error: string | null = null;

  statusFilter: SurveyStatus[] = ['active', 'inactive'];
  searchText = '';

  readonly statusOptions: { value: SurveyStatus; labelKey: string }[] = [
    { value: 'active', labelKey: 'surveys.templateStatus.active' },
    { value: 'inactive', labelKey: 'surveys.templateStatus.inactive' },
    { value: 'archived', labelKey: 'surveys.templateStatus.archived' },
  ];

  readonly displayedColumns = ['name', 'status', 'version', 'modified', 'actions'];

  /** Tracks which cell is currently being inline-edited */
  editingCell: { id: string; field: 'name' | 'version' } | null = null;
  private editingOriginalValue = '';
  private pendingInlineEditFocus = false;

  // SEM@96c34d433bdf8694a9679b9d7e88dddcc1d5563f: inject auth, survey, router, dialog, logger, CDR, transloco, and snackbar services
  constructor(
    private authService: AuthService,
    private surveyService: SurveyService,
    private router: Router,
    private dialog: MatDialog,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService,
    private snackBar: MatSnackBar,
  ) {}

  // SEM@b54b9814f8416ab22896148fea0d97a28da8f795: fetch and populate the survey template list on component init
  ngOnInit(): void {
    this.loadTemplates();
  }

  // SEM@c50936627d50362a9daa41662314d8d0c41dd4b7: attach MatSort to the data source with field-appropriate sort accessors (mutates shared state)
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

  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: focus and select the inline edit input after Angular renders it (mutates shared state)
  ngAfterViewChecked(): void {
    if (this.pendingInlineEditFocus) {
      const el = this.elementRef.nativeElement as HTMLElement;
      const input = el.querySelector<HTMLInputElement>('.inline-edit-input');
      if (input) {
        input.focus();
        input.select();
        this.pendingInlineEditFocus = false;
      }
    }
  }

  /**
   * Load all templates
   */
  // SEM@9c800b8e11599d4cacaebf3db0b01bc0e8e5c25e: fetch all survey templates from the API and refresh the filtered list (mutates shared state)
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
  // SEM@04d758bd68efbdeec8b33cb295e7d6a135071f75: filter survey templates by status and search text, update the table data source (mutates shared state)
  applyFilters(): void {
    let filtered = [...this.templates];

    // Status filter
    if (this.statusFilter.length > 0) {
      filtered = filtered.filter(t => this.statusFilter.includes(t.status));
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
  // SEM@b54b9814f8416ab22896148fea0d97a28da8f795: handle filter control change and re-apply survey template filters (mutates shared state)
  onFilterChange(): void {
    this.applyFilters();
  }

  /**
   * Clear search text and re-apply filters
   */
  // SEM@96eab87df3a24aa21131b71c664b75174481b28d: reset the search text and re-apply survey template filters (mutates shared state)
  clearSearch(): void {
    this.searchText = '';
    this.applyFilters();
  }

  /**
   * Create a new template via dialog
   */
  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: open dialog to collect survey name and version, then create and navigate to the new survey template
  createTemplate(): void {
    const dialogRef = this.dialog.open<CreateSurveyDialogComponent, void, CreateSurveyDialogResult>(
      CreateSurveyDialogComponent,
      {
        width: '480px',
      },
    );

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (!result) return;

        this.surveyService
          .create({
            name: result.name,
            version: result.version,
            description: '',
            survey_json: {
              title: result.name,
              description: '',
              pages: [{ name: 'page1', title: 'Page 1', elements: [] }],
            },
          })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: survey => {
              this.logger.info('Survey created via dialog', { id: survey.id });
              void this.router.navigate(['/admin', 'surveys', survey.id]);
            },
            error: error => {
              this.logger.error('Failed to create survey', error);
              this.cdr.markForCheck();
            },
          });
      });
  }

  /**
   * Start inline editing of a cell
   */
  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: activate inline edit mode for a survey template field (mutates shared state)
  startInlineEdit(template: SurveyListItem, field: 'name' | 'version', event: Event): void {
    event.stopPropagation();
    this.editingOriginalValue = template[field];
    this.editingCell = { id: template.id, field };
    this.pendingInlineEditFocus = true;
    this.cdr.markForCheck();
  }

  /**
   * Save an inline edit
   */
  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: persist an inline-edited survey template field to the API; restore on failure (mutates shared state)
  saveInlineEdit(template: SurveyListItem, field: 'name' | 'version', newValue: string): void {
    const trimmed = newValue.trim();
    if (!trimmed || trimmed === this.editingOriginalValue) {
      this.cancelInlineEdit(template);
      return;
    }

    template[field] = trimmed;
    this.editingCell = null;

    this.surveyService
      .patchField(template.id, field, trimmed)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.logger.info('Survey field updated inline', { id: template.id, field });
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Failed to update survey field', error);
          template[field] = this.editingOriginalValue;
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Cancel an inline edit and restore original value
   */
  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: discard inline edit and restore the original survey template field value (mutates shared state)
  cancelInlineEdit(template: SurveyListItem): void {
    if (this.editingCell) {
      template[this.editingCell.field] = this.editingOriginalValue;
    }
    this.editingCell = null;
    this.cdr.markForCheck();
  }

  /**
   * Handle keydown in inline edit input
   */
  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: handle Enter/Escape keydown to save or cancel an inline survey template field edit (pure)
  onInlineEditKeydown(
    event: KeyboardEvent,
    template: SurveyListItem,
    field: 'name' | 'version',
  ): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveInlineEdit(template, field, (event.target as HTMLInputElement).value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelInlineEdit(template);
    }
  }

  /**
   * Check if a cell is currently being edited
   */
  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: return whether a specific survey template cell is currently in inline edit mode (pure)
  isEditing(templateId: string, field: 'name' | 'version'): boolean {
    return this.editingCell?.id === templateId && this.editingCell?.field === field;
  }

  /**
   * Edit a template
   */
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: navigate to the survey template editor for the given template
  editTemplate(template: SurveyListItem): void {
    void this.router.navigate(['/admin', 'surveys', template.id]);
  }

  /**
   * Clone a template
   */
  // SEM@9c800b8e11599d4cacaebf3db0b01bc0e8e5c25e: duplicate a survey template via the API and reload the template list
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: toggle a survey template between active and inactive status via the API
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: archive a survey template via the API and reload the template list
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
   * Unarchive a template, returning it to inactive status
   */
  // SEM@caa1041df66e2fa2f3c3e3ef2691199ec0930e66: restore an archived survey template to inactive status via the API and reload the list
  unarchiveTemplate(template: SurveyListItem): void {
    this.surveyService
      .unarchive(template.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadTemplates();
        },
        error: error => {
          this.logger.error('Failed to unarchive template', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Delete a template after confirmation
   */
  // SEM@db6437483ff55580244b295bca96d013abf4cb5a: delete a survey template after user confirmation; surface conflict or error via snack bar
  deleteTemplate(template: SurveyListItem): void {
    const item = this.transloco.translate('common.objectTypes.survey');
    const message = this.transloco.translate('common.confirmDelete', {
      item,
      name: template.name,
    });

    if (!confirm(message)) return;

    this.surveyService
      .deleteSurvey(template.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadTemplates();
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.logger.warn('Cannot delete survey with existing responses', error);
            this.snackBar.open(
              this.transloco.translate('adminSurveys.deleteConflict'),
              this.transloco.translate('common.dismiss'),
              { duration: 8000 },
            );
          } else {
            this.logger.error('Failed to delete survey', error);
            const errorMessage = getErrorMessage(error);
            this.snackBar.open(
              this.transloco.translate('adminSurveys.deleteError', { error: errorMessage }),
              this.transloco.translate('common.dismiss'),
              { duration: 5000 },
            );
          }
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Get status icon
   */
  // SEM@9c800b8e11599d4cacaebf3db0b01bc0e8e5c25e: map a survey status to its Material icon name (pure)
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
  // SEM@913973c2390b7180140950023b498e5c44ca2678: navigate away from the admin surveys page back to the admin root
  onClose(): void {
    navigateFromAdminPage(this.router, this.authService);
  }
}
