import { AfterViewInit, Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
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
import { MigrateDialogComponent } from './migrate-dialog/migrate-dialog.component';
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
 * Supports listing, inline editing, creating, deleting, and migrating settings.
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
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
export class AdminSettingsComponent implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);
  private filterSubject$ = new Subject<string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns = ['key', 'value', 'type', 'description', 'modified_at', 'actions'];

  settings: EditableSystemSetting[] = [];
  dataSource = new MatTableDataSource<EditableSystemSetting>([]);
  totalSettings = 0;

  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  filterText = '';
  loading = false;

  constructor(
    private settingsService: SettingsAdminService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private logger: LoggerService,
    private authService: AuthService,
    private transloco: TranslocoService,
  ) {}

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
        case 'type':
          return item.type.toLowerCase();
        case 'description':
          return (item.description || '').toLowerCase();
        case 'modified_at':
          return item.modified_at ? new Date(item.modified_at).getTime() : 0;
        default:
          return '';
      }
    };
  }

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

  onFilterChange(value: string): void {
    this.filterSubject$.next(value);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updateUrl();
  }

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
        (setting.description || '').toLowerCase().includes(filter),
    );
  }

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

  onMigrateSettings(): void {
    const dialogRef = this.dialog.open(MigrateDialogComponent, {
      width: '500px',
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

  onEditSetting(setting: EditableSystemSetting): void {
    setting.editing = true;
    setting.editValues = {
      value: setting.value,
      description: setting.description || '',
    };
  }

  onCancelEditSetting(setting: EditableSystemSetting): void {
    setting.editing = false;
    setting.editValues = undefined;
  }

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

  onDeleteSetting(setting: EditableSystemSetting): void {
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

  getBoolValue(setting: EditableSystemSetting): boolean {
    const val = setting.editing ? setting.editValues?.value : setting.value;
    return val === 'true';
  }

  onBoolToggle(setting: EditableSystemSetting, checked: boolean): void {
    if (setting.editValues) {
      setting.editValues.value = checked ? 'true' : 'false';
    }
  }

  onClose(): void {
    if (this.authService.isAdmin) {
      void this.router.navigate(['/admin']);
    } else {
      void this.router.navigate([this.authService.getLandingPage()]);
    }
  }
}
