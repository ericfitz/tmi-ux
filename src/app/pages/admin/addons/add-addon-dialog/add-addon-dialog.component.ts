import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
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
    ...FEEDBACK_MATERIAL_IMPORTS, TranslocoModule],
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
          />
          <mat-hint [transloco]="'admin.addons.addDialog.iconHint'"
            >Material Symbols format (e.g., material-symbols:security)</mat-hint
          >
          <mat-error *ngIf="form.get('icon')?.hasError('pattern')">
            <span [transloco]="'admin.addons.addDialog.iconInvalid'">Invalid icon format</span>
          </mat-error>
        </mat-form-field>

        <div class="form-section">
          <label class="section-label" [transloco]="'admin.addons.addDialog.objects'"
            >Object Types (Optional)</label
          >
          <p class="section-hint" [transloco]="'admin.addons.addDialog.objectsHint'">
            Select TMI object types this addon can operate on
          </p>
          <div class="checkbox-group">
            @for (objType of objectTypes; track objType) {
              <mat-checkbox [formControlName]="'object_' + objType">
                {{ objType }}
              </mat-checkbox>
            }
          </div>
        </div>

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

      .form-section {
        margin-top: 8px;

        .section-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: var(--theme-text-primary);
          margin-bottom: 4px;
        }

        .section-hint {
          font-size: 12px;
          color: var(--theme-text-secondary);
          margin: 0 0 12px;
        }

        .checkbox-group {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;

          mat-checkbox {
            font-size: 14px;
          }
        }
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
        padding: 16px 0 0;
        margin: 0;
      }
    `,
  ],
})
export class AddAddonDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

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
  ) {}

  ngOnInit(): void {
    const formConfig: Record<string, unknown> = {
      name: ['', Validators.required],
      description: [''],
      webhook_id: ['', Validators.required],
      icon: [
        '',
        Validators.pattern(
          /^(material-symbols:[a-z]([a-z0-9_]*[a-z0-9])?|fa-[a-z]([a-z]*[a-z])?([-a-z]+)? fa-([a-z]+)([-a-z]+)*)$/,
        ),
      ],
    };

    this.objectTypes.forEach(objType => {
      formConfig[`object_${objType}`] = [false];
    });

    this.form = this.fb.group(formConfig);

    this.webhookService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: webhooks => {
          this.availableWebhooks = webhooks.filter(w => w.status === 'active');
        },
        error: error => {
          this.logger.error('Failed to load webhooks', error);
          this.errorMessage = 'Failed to load available webhooks';
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSave(): void {
    if (this.form.valid && !this.saving) {
      this.saving = true;
      this.errorMessage = '';

      const formValue = this.form.value;
      const name = formValue['name'] as string;
      const description = formValue['description'] as string;
      const webhook_id = formValue['webhook_id'] as string;
      const icon = formValue['icon'] as string;

      const selectedObjects: AddonObjectType[] = this.objectTypes.filter(
        objType => formValue[`object_${objType}`] as boolean,
      );

      const request: CreateAddonRequest = {
        name,
        webhook_id,
        ...(description && { description }),
        ...(icon && { icon }),
        ...(selectedObjects.length > 0 && { objects: selectedObjects }),
      };

      this.addonService
        .create(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.logger.info('Addon created successfully');
            this.dialogRef.close(true);
          },
          error: (error: { error?: { message?: string } }) => {
            this.logger.error('Failed to create addon', error);
            this.errorMessage = error.error?.message || 'Failed to create addon. Please try again.';
            this.saving = false;
          },
        });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
