import { Component, DestroyRef, inject, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS, FORM_MATERIAL_IMPORTS } from '@app/shared/imports';
import { AddonService } from '@app/core/services/addon.service';
import { LoggerService } from '@app/core/services/logger.service';
import { Addon } from '@app/types/addon.types';

/** Form controls the host dialog must declare for {@link DirectWriteFieldsComponent}. */
export const DIRECT_WRITE_CONTROLS = { directWrite: [false], addonId: [null as string | null] };

/**
 * Build the `direct_write` / `addon_id` request fields from the host form.
 * Both fields are omitted unless direct writes are enabled, so older servers are unaffected.
 */
export function directWriteRequestFields(form: FormGroup): {
  direct_write?: boolean;
  addon_id?: string;
} {
  if (!form.get('directWrite')?.value) return {};
  const addonId = form.get('addonId')?.value as string | null;
  return { direct_write: true, ...(addonId && { addon_id: addonId }) };
}

/**
 * Opt-in "direct write" checkbox plus an addon link dropdown, shared by the
 * create-credential and create-automation-user dialogs.
 * Addons are loaded lazily the first time the checkbox is ticked.
 */
@Component({
  selector: 'app-direct-write-fields',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...FORM_MATERIAL_IMPORTS, TranslocoModule],
  template: `
    <div [formGroup]="form" class="direct-write-fields">
      <mat-checkbox formControlName="directWrite" data-testid="direct-write-checkbox">
        {{ 'userPreferences.credentials.createDialog.directWrite' | transloco }}
      </mat-checkbox>
      <p class="field-hint" [transloco]="'userPreferences.credentials.createDialog.directWriteHint'">
        Tokens from this credential can modify threat models the owner has writer or owner access
        to. Not allowed for credentials owned by an administrator.
      </p>
      @if (form.get('directWrite')?.value) {
        <mat-form-field class="full-width">
          <mat-label [transloco]="'userPreferences.credentials.createDialog.addon'">
            Linked addon
          </mat-label>
          <mat-select formControlName="addonId" data-testid="direct-write-addon-select">
            <mat-option [value]="null">
              {{ 'userPreferences.credentials.createDialog.addonNone' | transloco }}
            </mat-option>
            @for (addon of addons; track addon.id) {
              <mat-option [value]="addon.id">{{ addon.name }}</mat-option>
            }
          </mat-select>
          <mat-hint [transloco]="'userPreferences.credentials.createDialog.addonHint'">
            Optional: writes made with this credential are not echoed to the linked addon's webhook.
          </mat-hint>
        </mat-form-field>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      .direct-write-fields {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .field-hint {
        margin: 0 0 8px;
        font-size: 12px;
        color: var(--theme-text-secondary);
      }

      .full-width {
        width: 100%;
        margin-top: 8px;
      }
    `,
  ],
})
export class DirectWriteFieldsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  /** Host form containing `directWrite` and `addonId` controls (see DIRECT_WRITE_CONTROLS). */
  @Input({ required: true }) form!: FormGroup;

  addons: Addon[] = [];
  private addonsLoaded = false;

  constructor(
    private addonService: AddonService,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.form
      .get('directWrite')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled: boolean) => {
        if (enabled) {
          this.loadAddons();
        } else {
          this.form.get('addonId')?.setValue(null);
        }
      });
  }

  private loadAddons(): void {
    if (this.addonsLoaded) return;
    this.addonsLoaded = true;
    // ponytail: first page only; add paging if a deployment ever has more addons than the default page size
    this.addonService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => (this.addons = response.addons ?? []),
        error: (error: unknown) => {
          this.addonsLoaded = false;
          this.logger.error('Failed to load addons for direct-write link', error);
        },
      });
  }
}
