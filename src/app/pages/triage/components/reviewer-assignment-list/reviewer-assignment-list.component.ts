import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, EMPTY } from 'rxjs';
import { takeUntil, expand, map, reduce } from 'rxjs/operators';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { COMMON_IMPORTS, ALL_MATERIAL_IMPORTS } from '@app/shared/imports';
import { UserDisplayComponent } from '@app/shared/components/user-display/user-display.component';
import {
  UserPickerDialogComponent,
  UserPickerDialogData,
} from '@app/shared/components/user-picker-dialog/user-picker-dialog.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '@app/core/services/logger.service';
import {
  SecurityReviewerService,
  SecurityReviewerResult,
} from '@app/shared/services/security-reviewer.service';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { TMListItem } from '../../../tm/models/tm-list-item.model';
import { User } from '../../../tm/models/threat-model.model';
import { AdminUser } from '@app/types/user.types';
import { getFieldKeysForFieldType, getFieldLabel } from '@app/shared/utils/field-value-helpers';

/** Batch size for fetching threat models from the API */
const FETCH_PAGE_SIZE = 100;

/**
 * Component for displaying and assigning security reviewers to unassigned threat models.
 * Shows threat models where status != 'closed' and security_reviewer is null.
 */
@Component({
  selector: 'app-reviewer-assignment-list',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...ALL_MATERIAL_IMPORTS, TranslocoModule, UserDisplayComponent],
  templateUrl: './reviewer-assignment-list.component.html',
  styleUrl: './reviewer-assignment-list.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class ReviewerAssignmentListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  /** Emits the count of unassigned threat models for the parent tab badge */
  @Output() countChange = new EventEmitter<number>();

  /** Table data source */
  dataSource = new MatTableDataSource<TMListItem>([]);

  /** All unassigned threat models (filtered client-side) */
  private unassignedThreatModels: TMListItem[] = [];

  /** Displayed columns */
  displayedColumns = ['name', 'owner', 'status', 'created_at', 'reviewer_select', 'actions'];

  /** Security reviewer options */
  reviewerMode: 'dropdown' | 'picker' | 'loading' = 'loading';
  reviewerOptions: User[] = [];

  /** Per-row reviewer selection */
  selectedReviewers = new Map<string, User | null>();

  /** Pagination (client-side) */
  totalUnassigned = 0;
  pageSize = 25;
  pageIndex = 0;

  /** Loading state */
  isLoading = false;

  /** Set of TM IDs currently being assigned */
  isAssigning = new Set<string>();

  /** Error message */
  error: string | null = null;

  /** Bound compareReviewers for mat-select */
  compareReviewers: (a: User | null, b: User | null) => boolean;

  constructor(
    private router: Router,
    private threatModelService: ThreatModelService,
    private securityReviewerService: SecurityReviewerService,
    private logger: LoggerService,
    private transloco: TranslocoService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {
    this.compareReviewers = (a, b) => this.securityReviewerService.compareReviewers(a, b);
  }

  ngOnInit(): void {
    this.loadReviewerOptions();
    this.loadUnassignedThreatModels();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load security reviewer dropdown options via shared service.
   */
  private loadReviewerOptions(): void {
    this.securityReviewerService
      .loadReviewerOptions()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: SecurityReviewerResult) => {
        if (result.mode === 'dropdown') {
          this.reviewerOptions = result.reviewers;
          this.reviewerMode = 'dropdown';
        } else {
          this.reviewerMode = 'picker';
        }
        this.cdr.detectChanges();
      });
  }

  /**
   * Load all non-closed threat models, then filter client-side
   * for those with no security_reviewer assigned.
   */
  loadUnassignedThreatModels(): void {
    this.isLoading = true;
    this.error = null;

    const nonClosedStatuses = getFieldKeysForFieldType('threatModels.status')
      .filter(s => s !== 'closed')
      .join(',');

    this.fetchAllPages(nonClosedStatuses)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: allItems => {
          this.unassignedThreatModels = allItems.filter(tm => !tm.security_reviewer);
          this.totalUnassigned = this.unassignedThreatModels.length;
          this.countChange.emit(this.totalUnassigned);
          this.applyClientPagination();
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: err => {
          this.isLoading = false;
          this.error = this.transloco.translate('triage.reviewerAssignment.errorLoading');
          this.logger.error('Failed to load unassigned threat models', err);
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * Fetch all pages of threat models from the API.
   */
  private fetchAllPages(status: string): Observable<TMListItem[]> {
    return this.threatModelService
      .fetchThreatModels({ status, limit: FETCH_PAGE_SIZE, offset: 0 })
      .pipe(
        expand(response => {
          const fetched = response.offset + response.threat_models.length;
          if (fetched < response.total) {
            return this.threatModelService.fetchThreatModels({
              status,
              limit: FETCH_PAGE_SIZE,
              offset: fetched,
            });
          }
          return EMPTY;
        }),
        map(response => response.threat_models),
        reduce((acc, items) => [...acc, ...items], [] as TMListItem[]),
      );
  }

  /**
   * Apply client-side pagination to the filtered list.
   */
  private applyClientPagination(): void {
    const start = this.pageIndex * this.pageSize;
    const end = start + this.pageSize;
    this.dataSource.data = this.unassignedThreatModels.slice(start, end);
  }

  /**
   * Handle page change.
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.applyClientPagination();
  }

  /**
   * Handle reviewer selection from dropdown for a specific row.
   */
  onReviewerSelected(tmId: string, reviewer: User | null): void {
    this.selectedReviewers.set(tmId, reviewer);
  }

  /**
   * Open user picker dialog for a specific row (picker mode fallback).
   */
  openReviewerPicker(tmId: string): void {
    const dialogRef = this.dialog.open(UserPickerDialogComponent, {
      data: {
        title: this.transloco.translate('triage.reviewerAssignment.selectReviewer'),
      } as UserPickerDialogData,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((selectedAdminUser: AdminUser | undefined) => {
        if (selectedAdminUser) {
          const user: User = {
            principal_type: 'user',
            provider: selectedAdminUser.provider,
            provider_id: selectedAdminUser.provider_user_id,
            email: selectedAdminUser.email,
            display_name: selectedAdminUser.name,
          };
          this.selectedReviewers.set(tmId, user);
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Assign the selected reviewer to a threat model.
   */
  assignReviewer(tmId: string, reviewer: User): void {
    this.isAssigning.add(tmId);
    this.cdr.detectChanges();

    this.threatModelService
      .patchThreatModel(tmId, { security_reviewer: reviewer })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isAssigning.delete(tmId);
          this.unassignedThreatModels = this.unassignedThreatModels.filter(tm => tm.id !== tmId);
          this.totalUnassigned = this.unassignedThreatModels.length;
          this.selectedReviewers.delete(tmId);
          this.countChange.emit(this.totalUnassigned);

          // Adjust page index if current page is now empty
          const maxPage = Math.max(0, Math.ceil(this.totalUnassigned / this.pageSize) - 1);
          if (this.pageIndex > maxPage) {
            this.pageIndex = maxPage;
          }

          this.applyClientPagination();
          this.cdr.detectChanges();
        },
        error: err => {
          this.isAssigning.delete(tmId);
          this.logger.error('Failed to assign reviewer', err);
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * Assign the current user as reviewer ("Assign to Me").
   */
  assignToMe(tmId: string): void {
    const me = this.securityReviewerService.getCurrentUserAsReviewer();
    if (me) {
      this.assignReviewer(tmId, me);
    }
  }

  /**
   * Navigate to threat model detail/edit page.
   */
  viewThreatModel(tm: TMListItem): void {
    void this.router.navigate(['/tm', tm.id]);
  }

  /**
   * Get a localized label for a threat model status value.
   */
  getStatusLabel(status: string | null | undefined): string {
    if (!status) return '';
    return getFieldLabel(status, 'threatModels.status', this.transloco);
  }

  /**
   * Get CSS class for a threat model status chip.
   */
  getStatusClass(status: string | null | undefined): string {
    if (!status) return '';
    return `status-${status}`;
  }

  /**
   * Get the display text for a selected reviewer in picker mode.
   */
  getSelectedReviewerDisplay(tmId: string): string | null {
    const reviewer = this.selectedReviewers.get(tmId);
    if (!reviewer) return null;
    return reviewer.display_name || reviewer.email;
  }
}
