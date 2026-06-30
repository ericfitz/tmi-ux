import {
  AfterViewInit,
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
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { SettingsAdminService } from '@app/core/services/settings-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AuthService } from '@app/auth/services/auth.service';
import { EditableSystemSetting, SystemSetting } from '@app/types/settings.types';
import { AddSettingDialogComponent } from './add-setting-dialog/add-setting-dialog.component';
import { navigateFromAdminPage } from '../shared/admin-navigation.util';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  PAGINATION_QUERY_PARAMS,
} from '@app/types/pagination.types';
import {
  parsePaginationFromUrl,
  buildPaginationQueryParams,
  adjustPageAfterDeletion,
} from '@app/shared/utils/pagination.util';

/**
 * Admin Settings Component
 *
 * Displays and manages system settings via the /admin/settings API.
 * Supports listing, inline editing, creating, and deleting settings.
 */
@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
// SEM@913973c2390b7180140950023b498e5c44ca2678: admin page component for listing, filtering, editing, and deleting system settings
export class AdminSettingsComponent implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);
  private filterSubject$ = new Subject<string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns = ['key', 'value', 'source', 'actions'];

  settings: EditableSystemSetting[] = [];
  dataSource = new MatTableDataSource<EditableSystemSetting>([]);
  totalSettings = 0;

  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  filterText = '';
  loading = false;

  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: inject settings, routing, dialog, logger, auth, and translation dependencies (pure)
  constructor(
    private settingsService: SettingsAdminService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private logger: LoggerService,
    private authService: AuthService,
    private transloco: TranslocoService,
  ) {}

  // SEM@0c7f78eabc5e5a9eff8f9c5b0075722122ac3806: wire paginator sort and custom sort accessor to the settings data source (mutates shared state)
  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (
      item: EditableSystemSetting,
      property: string,
    ): string | number => {
      switch (property) {
        case 'key':
          return item.key.toLowerCase();
        case 'value':
          return item.value.toLowerCase();
        case 'source':
          return (item.source || '').toLowerCase();
        default:
          return '';
      }
    };
  }

  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: restore pagination state from URL params and subscribe to debounced filter changes (mutates shared state)
  ngOnInit(): void {
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const paginationState = parsePaginationFromUrl(params, DEFAULT_PAGE_SIZE);
      this.pageIndex = paginationState.pageIndex;
      this.pageSize = paginationState.pageSize;
      this.filterText = (params[PAGINATION_QUERY_PARAMS.FILTER] as string | undefined) || '';
      this.loadSettings();
    });

    this.filterSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(filterValue => {
        this.filterText = filterValue;
        this.pageIndex = 0;
        this.applyFilter();
        this.updateUrl();
      });
  }

  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: fetch all system settings from the API and populate the table data source (reads DB)
  loadSettings(): void {
    this.loading = true;

    this.settingsService
      .listSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (settings: SystemSetting[]) => {
          this.settings = settings.map(setting => ({
            ...setting,
            editing: false,
            saving: false,
          }));
          this.totalSettings = settings.length;
          this.applyFilter();
          this.loading = false;
          this.logger.info('System settings loaded', { count: settings.length });
        },
        error: error => {
          this.logger.error('Failed to load system settings', error);
          this.loading = false;
        },
      });
  }

  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: dispatch a filter value change to the debounced filter subject (mutates shared state)
  onFilterChange(value: string): void {
    this.filterSubject$.next(value);
  }

  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: update pagination state and sync URL on paginator page change (mutates shared state)
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updateUrl();
  }

  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: sync current pagination and filter state into the route query params (mutates shared state)
  private updateUrl(): void {
    const queryParams = buildPaginationQueryParams(
      {
        pageIndex: this.pageIndex,
        pageSize: this.pageSize,
        total: this.totalSettings,
      },
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

  // SEM@0c7f78eabc5e5a9eff8f9c5b0075722122ac3806: filter the settings table by key, value, description, or source text (mutates shared state)
  applyFilter(): void {
    const filter = this.filterText.toLowerCase().trim();
    if (!filter) {
      this.dataSource.data = [...this.settings];
      return;
    }

    this.dataSource.data = this.settings.filter(
      setting =>
        setting.key.toLowerCase().includes(filter) ||
        setting.value.toLowerCase().includes(filter) ||
        (setting.description || '').toLowerCase().includes(filter) ||
        (setting.source || '').toLowerCase().includes(filter),
    );
  }

  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: open add-setting dialog and reload settings list on confirmation
  onAddSetting(): void {
    const dialogRef = this.dialog.open(AddSettingDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) {
          this.loadSettings();
        }
      });
  }

  // SEM@0c7f78eabc5e5a9eff8f9c5b0075722122ac3806: enter inline-edit mode for a system setting row (mutates shared state)
  onEditSetting(setting: EditableSystemSetting): void {
    if (setting.read_only) return;
    setting.editing = true;
    setting.editValues = {
      value: setting.value,
      description: setting.description || '',
    };
  }

  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: discard pending edits and exit inline-edit mode for a setting row (mutates shared state)
  onCancelEditSetting(setting: EditableSystemSetting): void {
    setting.editing = false;
    setting.editValues = undefined;
  }

  // SEM@0c7f78eabc5e5a9eff8f9c5b0075722122ac3806: persist inline-edited system setting value and description to the API (mutates shared state)
  onSaveSetting(setting: EditableSystemSetting): void {
    if (!setting.editValues) return;

    setting.saving = true;
    const update = {
      value: setting.editValues.value,
      type: setting.type,
      ...(setting.editValues.description && { description: setting.editValues.description }),
    };

    this.settingsService
      .updateSetting(setting.key, update)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          setting.value = updated.value;
          setting.description = updated.description;
          setting.modified_at = updated.modified_at;
          setting.modified_by = updated.modified_by;
          setting.source = updated.source;
          setting.read_only = updated.read_only;
          setting.editing = false;
          setting.editValues = undefined;
          setting.saving = false;
          this.logger.info('System setting updated', { key: setting.key });
        },
        error: error => {
          setting.saving = false;
          this.logger.error('Failed to update system setting', error);
        },
      });
  }

  // SEM@0c7f78eabc5e5a9eff8f9c5b0075722122ac3806: confirm and delete a system setting via the API, then refresh the list (mutates shared state)
  onDeleteSetting(setting: EditableSystemSetting): void {
    if (setting.read_only) return;
    const message = this.transloco.translate('admin.settings.confirmDelete', {
      key: setting.key,
    });
    const confirmed = confirm(message);

    if (confirmed) {
      this.settingsService
        .deleteSetting(setting.key)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('System setting deleted', { key: setting.key });

            const itemsOnPageAfterDelete = this.dataSource.data.length - 1;
            const newTotal = this.totalSettings - 1;
            this.pageIndex = adjustPageAfterDeletion(
              this.pageIndex,
              itemsOnPageAfterDelete,
              newTotal,
            );

            this.loadSettings();
            this.updateUrl();
          },
          error: error => {
            this.logger.error('Failed to delete system setting', error);
          },
        });
    }
  }

  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: convert a system setting's string value to boolean for the current edit state (pure)
  getBoolValue(setting: EditableSystemSetting): boolean {
    const val = setting.editing ? setting.editValues?.value : setting.value;
    return val === 'true';
  }

  // SEM@d1e52bd6d3a360bc27bbec029ce4c7b716b7f787: update a boolean setting's draft value when its toggle changes (mutates shared state)
  onBoolToggle(setting: EditableSystemSetting, checked: boolean): void {
    if (setting.editValues) {
      setting.editValues.value = checked ? 'true' : 'false';
    }
  }

  // SEM@913973c2390b7180140950023b498e5c44ca2678: navigate away from the settings page to the role-appropriate landing page
  onClose(): void {
    navigateFromAdminPage(this.router, this.authService);
  }
}
