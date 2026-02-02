import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { AddonObjectType, CreateAddonRequest } from '@app/types/addon.types';
import { WebhookSubscription } from '@app/types/webhook.types';
import { AddonService } from '@app/core/services/addon.service';
import { WebhookService } from '@app/core/services/webhook.service';
import { LoggerService } from '@app/core/services/logger.service';

/**
 * Custom validator for icon format
 * Validates Material Symbols and FontAwesome icon strings with length limits
 */
function iconFormatValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string;

  if (!value || value.trim() === '') {
    return null; // Empty is valid (icon is optional)
  }

  // Length validation first
  const MATERIAL_SYMBOLS_MAX_LENGTH = 64;
  const FONTAWESOME_MAX_LENGTH = 80;

  if (value.startsWith('material-symbols:')) {
    if (value.length > MATERIAL_SYMBOLS_MAX_LENGTH) {
      return { iconFormat: { message: 'Material Symbols icon must be 64 characters or less' } };
    }
    // Pattern: material-symbols:[a-z0-9]{1,16}(_[a-z0-9]{1,16}){0,6}
    const materialPattern = /^material-symbols:[a-z0-9]{1,16}(_[a-z0-9]{1,16}){0,6}$/;
    if (!materialPattern.test(value)) {
      return { iconFormat: { message: 'Invalid Material Symbols format' } };
    }
  } else if (value.startsWith('fa')) {
    if (value.length > FONTAWESOME_MAX_LENGTH) {
      return { iconFormat: { message: 'FontAwesome icon must be 80 characters or less' } };
    }
    // Pattern: fa[a-z]?(-[a-z0-9]{1,16})? fa(-[a-z0-9]{1,16}){0,8}
    const fontAwesomePattern = /^fa[a-z]?(-[a-z0-9]{1,16})? fa(-[a-z0-9]{1,16}){0,8}$/;
    if (!fontAwesomePattern.test(value)) {
      return { iconFormat: { message: 'Invalid FontAwesome format' } };
    }
  } else {
    return { iconFormat: { message: 'Icon must start with "material-symbols:" or "fa"' } };
  }

  return null;
}

/**
 * Add Addon Dialog Component
 *
 * Dialog for creating new addons.
 * Collects addon configuration including webhook association and object types.
 */
@Component({
  selector: 'app-add-addon-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'admin.addons.addDialog.title'">Add Addon</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="addon-form">
        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.addons.addDialog.name'">Name</mat-label>
          <input
            matInput
            formControlName="name"
            [placeholder]="'admin.addons.addDialog.namePlaceholder' | transloco"
            required
          />
          <mat-hint [transloco]="'admin.addons.addDialog.nameHint'"
            >Display name for this addon</mat-hint
          >
          <mat-error *ngIf="form.get('name')?.hasError('required')">
            <span [transloco]="'admin.addons.addDialog.nameRequired'">Name is required</span>
          </mat-error>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.addons.addDialog.description'">Description</mat-label>
          <textarea
            matInput
            formControlName="description"
            rows="3"
            [placeholder]="'admin.addons.addDialog.descriptionPlaceholder' | transloco"
          ></textarea>
          <mat-hint [transloco]="'admin.addons.addDialog.descriptionHint'"
            >What does this addon do?</mat-hint
          >
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.addons.addDialog.webhook'">Webhook</mat-label>
          <mat-select formControlName="webhook_id" required>
            @for (webhook of availableWebhooks; track webhook.id) {
              <mat-option [value]="webhook.id">
                {{ webhook.name }}
              </mat-option>
            }
          </mat-select>
          <mat-hint [transloco]="'admin.addons.addDialog.webhookHint'"
            >Associated webhook subscription</mat-hint
          >
          <mat-error *ngIf="form.get('webhook_id')?.hasError('required')">
            <span [transloco]="'admin.addons.addDialog.webhookRequired'">Webhook is required</span>
          </mat-error>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.addons.addDialog.icon'">Icon (Optional)</mat-label>
          <input
            matInput
            formControlName="icon"
            [placeholder]="'admin.addons.addDialog.iconPlaceholder' | transloco"
            (blur)="onIconBlur()"
          />
          <mat-hint class="icon-hint-with-links">
            <span [transloco]="'admin.addons.addDialog.iconHint'">
              UI Icon (examples: "material-symbols:security", "fa-regular fa-user-shield")
            </span>
            <a
              href="https://fonts.google.com/icons"
              target="_blank"
              rel="noopener noreferrer"
              class="icon-reference-link"
              title="Browse Material Symbols icons"
            >
              <span class="material-symbols-outlined">link</span>
            </a>
            <a
              href="https://fontawesome.com/search?ic=free-collection"
              target="_blank"
              rel="noopener noreferrer"
              class="icon-reference-link"
              title="Browse FontAwesome icons"
            >
              <span class="material-symbols-outlined">link</span>
            </a>
          </mat-hint>
          <mat-error *ngIf="form.get('icon')?.hasError('iconFormat')">
            {{
              form.get('icon')?.errors?.['iconFormat']?.message ||
                ('admin.addons.addDialog.iconInvalid' | transloco)
            }}
          </mat-error>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.addons.addDialog.objects'"
            >Object Types (Optional)</mat-label
          >
          <mat-select formControlName="objects" multiple>
            @for (objType of objectTypes; track objType) {
              <mat-option [value]="objType">
                {{ objType }}
              </mat-option>
            }
          </mat-select>
          <mat-hint [transloco]="'admin.addons.addDialog.objectsHint'">
            Select TMI object types this addon can operate on
          </mat-hint>
        </mat-form-field>

        @if (errorMessage) {
          <mat-error class="form-error">
            {{ errorMessage }}
          </mat-error>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSave()"
        [disabled]="!form.valid || saving"
      >
        @if (saving) {
          <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
        }
        <span [transloco]="'admin.addons.addDialog.save'">Create Addon</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .addon-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 500px;
        padding: 16px 0;
      }

      .full-width {
        width: 100%;
      }

      .form-error {
        color: var(--theme-error);
        font-size: 12px;
        margin-top: 8px;
      }

      .button-spinner {
        display: inline-block;
        margin-right: 8px;
      }

      mat-dialog-actions {
        padding: 16px 24px 16px 0;
        margin: 0;
      }

      .icon-hint-with-links {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .icon-reference-link {
        display: inline-flex;
        align-items: center;
        color: var(--theme-primary);
        text-decoration: none;
        transition: opacity 0.2s;
      }

      .icon-reference-link:hover {
        opacity: 0.7;
      }

      .icon-reference-link .material-symbols-outlined {
        font-size: 16px;
      }
    `,
  ],
})
export class AddAddonDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  availableWebhooks: WebhookSubscription[] = [];
  objectTypes: AddonObjectType[] = [
    'threat_model',
    'diagram',
    'asset',
    'threat',
    'document',
    'note',
    'repository',
    'metadata',
  ];
  saving = false;
  errorMessage = '';

  constructor(
    private dialogRef: MatDialogRef<AddAddonDialogComponent>,
    private addonService: AddonService,
    private webhookService: WebhookService,
    private fb: FormBuilder,
    private logger: LoggerService,
    private transloco: TranslocoService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      webhook_id: ['', Validators.required],
      icon: ['material-symbols:extension', iconFormatValidator],
      objects: [[]],
    });

    this.webhookService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.availableWebhooks = response.subscriptions.filter(w => w.status === 'active');
        },
        error: error => {
          this.logger.error('Failed to load webhooks', error);
          this.errorMessage = this.transloco.translate('admin.addons.errorLoadingWebhooks');
        },
      });
  }

  onSave(): void {
    if (this.form.valid && !this.saving) {
      this.saving = true;
      this.errorMessage = '';

      const name = this.form.get('name')?.value as string;
      const description = this.form.get('description')?.value as string;
      const webhook_id = this.form.get('webhook_id')?.value as string;
      const icon = this.form.get('icon')?.value as string;
      const selectedObjects = (this.form.get('objects')?.value as AddonObjectType[]) || [];

      const request: CreateAddonRequest = {
        name,
        webhook_id,
        ...(description && { description }),
        ...(icon && { icon }),
        ...(selectedObjects.length > 0 && { objects: selectedObjects }),
      };

      this.addonService
        .create(request)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('Addon created successfully');
            this.dialogRef.close(true);
          },
          error: (error: { error?: { message?: string } }) => {
            this.logger.error('Failed to create addon', error);
            this.errorMessage =
              error.error?.message || this.transloco.translate('admin.addons.errorCreatingAddon');
            this.saving = false;
          },
        });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  /**
   * Handles blur event on icon field to normalize and correct format
   */
  onIconBlur(): void {
    const iconControl = this.form.get('icon');
    if (!iconControl) {
      return;
    }

    let value = iconControl.value as string;

    // Step 1: Normalize whitespace
    // Remove leading/trailing spaces
    value = value.trim();
    // Replace any whitespace character with normal space
    value = value.replace(/\s/g, ' ');
    // Replace multiple spaces with single space
    value = value.replace(/\s{2,}/g, ' ');

    // Step 2: Handle empty value
    if (!value) {
      iconControl.setValue('material-symbols:extension');
      return;
    }

    // Step 3: Handle values containing colon
    if (value.includes(':')) {
      // Remove everything up to and including the colon
      const afterColon = value.substring(value.indexOf(':') + 1);
      // Replace hyphens or spaces with underscores
      const normalized = afterColon.replace(/[-\s]/g, '_');
      // Prepend material-symbols:
      value = `material-symbols:${normalized}`;
    }

    // Step 4: Handle FontAwesome values (starting with "fa")
    if (value.startsWith('fa')) {
      // Replace underscores with hyphens
      value = value.replace(/_/g, '-');
      // Replace spaces with hyphens, except before "fa"
      // Split by "fa" to preserve spacing before it
      const parts = value.split(/\bfa\b/);
      value = parts
        .map((part, index) => {
          if (index === 0) {
            // First part (before first "fa") - replace spaces with hyphens
            return part.replace(/\s/g, '-');
          } else {
            // Parts after "fa" - preserve the "fa" and handle spacing
            return 'fa' + part.replace(/\s/g, '-');
          }
        })
        .join('')
        .replace(/^-+/, ''); // Remove leading hyphens
    }

    // Set the corrected value back to the control
    iconControl.setValue(value);
  }
}
