import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
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
import { AddAddonDialogComponent } from './add-addon-dialog/add-addon-dialog.component';

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
})
export class AdminAddonsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private filterSubject$ = new Subject<string>();

  addons: Addon[] = [];
  filteredAddons: Addon[] = [];
  filterText = '';
  loading = false;

  constructor(
    private addonService: AddonService,
    private router: Router,
    private dialog: MatDialog,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.loadAddons();

    this.filterSubject$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilter();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAddons(): void {
    this.loading = true;
    this.addonService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: addons => {
          this.addons = addons;
          this.applyFilter();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  onFilterChange(value: string): void {
    this.filterText = value;
    this.filterSubject$.next(value);
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
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          this.loadAddons();
        }
      });
  }

  onDeleteAddon(addon: Addon): void {
    const confirmed = confirm(`Are you sure you want to delete the addon "${addon.name}"?`);

    if (confirmed) {
      this.addonService
        .delete(addon.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.logger.info('Addon deleted', { id: addon.id });
            this.loadAddons();
          },
          error: error => {
            this.logger.error('Failed to delete addon', error);
          },
        });
    }
  }

  onClose(): void {
    void this.router.navigate(['/admin']);
  }
}
