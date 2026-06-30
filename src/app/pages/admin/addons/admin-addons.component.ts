import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
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
import { navigateFromAdminPage } from '../shared/admin-navigation.util';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
// SEM@913973c2390b7180140950023b498e5c44ca2678: list, filter, add, and delete addons with paginated API-backed data
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

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: inject addon, router, dialog, logger, translation, and auth dependencies (pure)
  constructor(
    private addonService: AddonService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private logger: LoggerService,
    private transloco: TranslocoService,
    private authService: AuthService,
  ) {}

  // SEM@bfb60b51b1f44fb69eb7f7fbac7656849e9750be: restore pagination state from URL and subscribe to debounced filter changes (mutates shared state)
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

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: fetch a paginated addon list from the API and apply the current filter (reads DB)
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

  // SEM@36c98b471f199ad07ab7f890bf1fd25427d95e56: push a new filter value into the debounced filter stream (mutates shared state)
  onFilterChange(value: string): void {
    this.filterSubject$.next(value);
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: update page state and reload addons when the paginator changes (mutates shared state)
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadAddons();
    this.updateUrl();
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: sync current pagination and filter state into the URL query params (mutates shared state)
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

  // SEM@36c98b471f199ad07ab7f890bf1fd25427d95e56: filter the loaded addon list by name or description against filterText (mutates shared state)
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

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: open the add-addon dialog and reload the list if an addon was created (mutates shared state)
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

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: confirm and delete an addon via the API, adjusting pagination afterward (mutates shared state)
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

  // SEM@913973c2390b7180140950023b498e5c44ca2678: navigate away from the addons page to the user's landing page (pure)
  onClose(): void {
    navigateFromAdminPage(this.router, this.authService);
  }

  /**
   * Returns the translation key for an object type.
   * Falls back to the raw value for unknown types.
   */
  // SEM@296348f9accb29fe5c44ef260ea24805f292a868: map an object-type string to its i18n translation key (pure)
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
