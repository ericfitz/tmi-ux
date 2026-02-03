import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, take } from 'rxjs/operators';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MatPaginator, MatPaginatorIntl, PageEvent } from '@angular/material/paginator';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { Addon } from '@app/types/addon.types';
import { AddonService } from '@app/core/services/addon.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AuthService } from '@app/auth/services/auth.service';
import { AddAddonDialogComponent } from './add-addon-dialog/add-addon-dialog.component';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  PAGINATION_QUERY_PARAMS,
} from '@app/types/pagination.types';
import {
  calculateOffset,
  parsePaginationFromUrl,
  buildPaginationQueryParams,
  adjustPageAfterDeletion,
} from '@app/shared/utils/pagination.util';

/**
 * Addons Management Component
 *
 * Displays and manages system addons.
 * Allows adding and removing addons for extending TMI functionality.
 */
@Component({
  selector: 'app-admin-addons',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './admin-addons.component.html',
  styleUrl: './admin-addons.component.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
export class AdminAddonsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private filterSubject$ = new Subject<string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  addons: Addon[] = [];
  filteredAddons: Addon[] = [];
  totalAddons = 0;

  // Pagination state
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  filterText = '';
  loading = false;

  constructor(
    private addonService: AddonService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private logger: LoggerService,
    private transloco: TranslocoService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Initialize pagination state from URL query params
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const paginationState = parsePaginationFromUrl(params, DEFAULT_PAGE_SIZE);
      this.pageIndex = paginationState.pageIndex;
      this.pageSize = paginationState.pageSize;
      this.filterText = (params[PAGINATION_QUERY_PARAMS.FILTER] as string | undefined) || '';
      this.loadAddons();
    });

    // Set up debounced filter changes
    this.filterSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(filterValue => {
        this.filterText = filterValue;
        this.pageIndex = 0;
        this.loadAddons();
        this.updateUrl();
      });
  }

  loadAddons(): void {
    this.loading = true;
    const offset = calculateOffset(this.pageIndex, this.pageSize);

    this.addonService
      .list({ limit: this.pageSize, offset })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.addons = response.addons;
          this.totalAddons = response.total;
          this.applyFilter();
          this.loading = false;
          this.logger.debug('Addons loaded', {
            count: response.addons.length,
            total: response.total,
            page: this.pageIndex,
          });
        },
        error: error => {
          this.logger.error('Failed to load addons', error);
          this.loading = false;
        },
      });
  }

  onFilterChange(value: string): void {
    this.filterSubject$.next(value);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadAddons();
    this.updateUrl();
  }

  private updateUrl(): void {
    const queryParams = buildPaginationQueryParams(
      { pageIndex: this.pageIndex, pageSize: this.pageSize, total: this.totalAddons },
      this.filterText,
      DEFAULT_PAGE_SIZE,
    );

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }

  applyFilter(): void {
    const filter = this.filterText.toLowerCase().trim();
    if (!filter) {
      this.filteredAddons = [...this.addons];
      return;
    }

    this.filteredAddons = this.addons.filter(
      addon =>
        addon.name.toLowerCase().includes(filter) ||
        addon.description?.toLowerCase().includes(filter),
    );
  }

  onAddAddon(): void {
    const dialogRef = this.dialog.open(AddAddonDialogComponent, {
      width: '700px',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) {
          this.loadAddons();
        }
      });
  }

  onDeleteAddon(addon: Addon): void {
    const message = this.transloco.translate('admin.addons.confirmDelete', { name: addon.name });
    const confirmed = confirm(message);

    if (confirmed) {
      this.addonService
        .delete(addon.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('Addon deleted', { id: addon.id });

            // Adjust page if we deleted the last item on the current page
            const itemsOnPageAfterDelete = this.addons.length - 1;
            const newTotal = this.totalAddons - 1;
            this.pageIndex = adjustPageAfterDeletion(
              this.pageIndex,
              itemsOnPageAfterDelete,
              newTotal,
            );

            this.loadAddons();
            this.updateUrl();
          },
          error: error => {
            this.logger.error('Failed to delete addon', error);
          },
        });
    }
  }

  onClose(): void {
    if (this.authService.isAdmin) {
      void this.router.navigate(['/admin']);
    } else {
      void this.router.navigate(['/dashboard']);
    }
  }

  /**
   * Returns the translation key for an object type.
   * Falls back to the raw value for unknown types.
   */
  getObjectTypeKey(objectType: string): string {
    const keyMap: Record<string, string> = {
      threat_model: 'common.objectTypes.threatModel',
      diagram: 'common.objectTypes.diagram',
      asset: 'common.objectTypes.asset',
      threat: 'common.objectTypes.threat',
      document: 'common.objectTypes.document',
      note: 'common.objectTypes.note',
      repository: 'common.objectTypes.repository',
      metadata: 'common.metadata',
    };
    return keyMap[objectType] || objectType;
  }
}
