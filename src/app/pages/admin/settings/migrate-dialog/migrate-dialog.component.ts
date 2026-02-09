import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { SettingsAdminService } from '@app/core/services/settings-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { MigrateSettingsResponse } from '@app/types/settings.types';

/**
 * Migrate Settings Dialog Component
 *
 * Confirmation dialog for migrating settings from server config to database.
 * Exposes overwrite option and displays migration results.
 */
@Component({
  selector: 'app-migrate-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'admin.settings.migrateDialog.title'">Migrate Settings</h2>
    <mat-dialog-content>
      @if (!result) {
        <div class="migrate-content">
          <p [transloco]="'admin.settings.migrateDialog.description'">
            Import settings from the server's configuration file or environment variables into the
            database.
          </p>

          <mat-checkbox [(ngModel)]="overwrite" [disabled]="migrating">
            <span [transloco]="'admin.settings.migrateDialog.overwriteLabel'">
              Overwrite existing settings
            </span>
          </mat-checkbox>

          @if (overwrite) {
            <p class="overwrite-warning">
              <mat-icon>warning</mat-icon>
              <span [transloco]="'admin.settings.migrateDialog.overwriteWarning'">
                Warning: This will replace any settings in the database that were previously
                customized.
              </span>
            </p>
          }

          @if (errorMessage) {
            <mat-error class="form-error">
              {{ errorMessage }}
            </mat-error>
          }
        </div>
      } @else {
        <div class="migrate-results">
          <p class="result-item">
            <mat-icon class="result-icon success">check_circle</mat-icon>
            <span
              [transloco]="'admin.settings.migrateDialog.resultMigrated'"
              [translocoParams]="{ count: result.migrated }"
            >
              {{ result.migrated }} settings migrated
            </span>
          </p>
          <p class="result-item">
            <mat-icon class="result-icon skipped">skip_next</mat-icon>
            <span
              [transloco]="'admin.settings.migrateDialog.resultSkipped'"
              [translocoParams]="{ count: result.skipped }"
            >
              {{ result.skipped }} settings skipped
            </span>
          </p>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (!result) {
        <button mat-button (click)="onCancel()" [disabled]="migrating">
          <span [transloco]="'common.cancel'">Cancel</span>
        </button>
        <button mat-raised-button color="primary" (click)="onMigrate()" [disabled]="migrating">
          @if (migrating) {
            <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
          }
          <span [transloco]="'admin.settings.migrateDialog.migrate'">Migrate</span>
        </button>
      } @else {
        <button mat-raised-button color="primary" (click)="onDone()">
          <span [transloco]="'common.close'">Close</span>
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [
    `
      .migrate-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 350px;
        padding: 8px 0;
      }

      .overwrite-warning {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        color: var(--theme-error);
        font-size: 13px;
        margin: 0;
        padding: 8px 12px;
        background: rgba(244, 67, 54, 0.08);
        border-radius: 4px;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          margin-top: 1px;
        }
      }

      .migrate-results {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 350px;
        padding: 16px 0;
      }

      .result-item {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        font-size: 14px;
      }

      .result-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;

        &.success {
          color: var(--theme-primary);
        }

        &.skipped {
          color: var(--theme-text-secondary);
        }
      }

      .form-error {
        color: var(--theme-error);
        font-size: 12px;
      }

      .button-spinner {
        display: inline-block;
        margin-right: 8px;
      }

      mat-dialog-actions {
        padding: 16px 24px;
        margin: 0;
      }
    `,
  ],
})
export class MigrateDialogComponent {
  private destroyRef = inject(DestroyRef);

  overwrite = false;
  migrating = false;
  errorMessage = '';
  result: MigrateSettingsResponse | null = null;

  constructor(
    private dialogRef: MatDialogRef<MigrateDialogComponent>,
    private settingsService: SettingsAdminService,
    private logger: LoggerService,
  ) {}

  onMigrate(): void {
    this.migrating = true;
    this.errorMessage = '';

    this.settingsService
      .migrateSettings(this.overwrite)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: MigrateSettingsResponse) => {
          this.result = response;
          this.migrating = false;
          this.logger.info('Settings migration completed', {
            migrated: response.migrated,
            skipped: response.skipped,
          });
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to migrate settings', error);
          this.errorMessage =
            error.error?.message || 'Failed to migrate settings. Please try again.';
          this.migrating = false;
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onDone(): void {
    this.dialogRef.close(true);
  }
}
