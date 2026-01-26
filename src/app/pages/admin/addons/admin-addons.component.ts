import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
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
export class AdminAddonsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
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
    private transloco: TranslocoService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadAddons();

    this.filterSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.applyFilter();
      });
  }

  loadAddons(): void {
    this.loading = true;
    this.addonService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
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
            this.loadAddons();
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
