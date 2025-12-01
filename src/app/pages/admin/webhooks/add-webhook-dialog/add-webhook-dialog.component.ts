import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatChipInputEvent } from '@angular/material/chips';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { WebhookSubscriptionInput } from '@app/types/webhook.types';
import { WebhookService } from '@app/core/services/webhook.service';
import { LoggerService } from '@app/core/services/logger.service';

/**
 * Add Webhook Dialog Component
 *
 * Dialog for creating new webhook subscriptions.
 * Collects webhook name, URL, events, and optional configuration.
 */
@Component({
  selector: 'app-add-webhook-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'admin.webhooks.addDialog.title'">Add Webhook</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="webhook-form">
        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.webhooks.addDialog.name'">Name</mat-label>
          <input
            matInput
            formControlName="name"
            [placeholder]="'admin.webhooks.addDialog.namePlaceholder' | transloco"
            required
          />
          <mat-hint [transloco]="'admin.webhooks.addDialog.nameHint'"
            >Descriptive name for this webhook</mat-hint
          >
          <mat-error *ngIf="form.get('name')?.hasError('required')">
            <span [transloco]="'admin.webhooks.addDialog.nameRequired'">Name is required</span>
          </mat-error>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.webhooks.addDialog.url'">Webhook URL</mat-label>
          <input
            matInput
            formControlName="url"
            type="url"
            [placeholder]="'admin.webhooks.addDialog.urlPlaceholder' | transloco"
            required
          />
          <mat-hint [transloco]="'admin.webhooks.addDialog.urlHint'">Must be HTTPS URL</mat-hint>
          <mat-error *ngIf="form.get('url')?.hasError('required')">
            <span [transloco]="'admin.webhooks.addDialog.urlRequired'">URL is required</span>
          </mat-error>
          <mat-error *ngIf="form.get('url')?.hasError('pattern')">
            <span [transloco]="'admin.webhooks.addDialog.urlInvalid'">URL must be HTTPS</span>
          </mat-error>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.webhooks.addDialog.events'">Events</mat-label>
          <mat-chip-grid #eventChipGrid formControlName="events" required>
            @for (event of selectedEvents; track event) {
              <mat-chip-row (removed)="removeEvent(event)">
                {{ event }}
                <button matChipRemove [attr.aria-label]="'Remove ' + event">
                  <mat-icon>cancel</mat-icon>
                </button>
              </mat-chip-row>
            }
          </mat-chip-grid>
          <input
            placeholder="Add event type..."
            [matChipInputFor]="eventChipGrid"
            (matChipInputTokenEnd)="addEvent($event)"
          />
          <mat-hint [transloco]="'admin.webhooks.addDialog.eventsHint'"
            >Event types to subscribe to (e.g., threat_model.created)</mat-hint
          >
          <mat-error *ngIf="form.get('events')?.hasError('required')">
            <span [transloco]="'admin.webhooks.addDialog.eventsRequired'"
              >At least one event is required</span
            >
          </mat-error>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.webhooks.addDialog.secret'">Secret (Optional)</mat-label>
          <input
            matInput
            formControlName="secret"
            type="password"
            [placeholder]="'admin.webhooks.addDialog.secretPlaceholder' | transloco"
          />
          <mat-hint [transloco]="'admin.webhooks.addDialog.secretHint'"
            >HMAC secret for signing payloads (auto-generated if empty)</mat-hint
          >
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
        <span [transloco]="'admin.webhooks.addDialog.save'">Create Webhook</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .webhook-form {
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
        padding: 16px 0 0;
        margin: 0;
      }
    `,
  ],
})
export class AddWebhookDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  form!: FormGroup;
  selectedEvents: string[] = [];
  saving = false;
  errorMessage = '';

  constructor(
    private dialogRef: MatDialogRef<AddWebhookDialogComponent>,
    private webhookService: WebhookService,
    private fb: FormBuilder,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', Validators.required],
      url: ['', [Validators.required, Validators.pattern(/^https:\/\/.+/)]],
      events: [[], Validators.required],
      secret: [''],
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  addEvent(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value) {
      this.selectedEvents.push(value);
      this.form.patchValue({ events: this.selectedEvents });
      event.chipInput?.clear();
    }
  }

  removeEvent(event: string): void {
    const index = this.selectedEvents.indexOf(event);
    if (index >= 0) {
      this.selectedEvents.splice(index, 1);
      this.form.patchValue({ events: this.selectedEvents });
    }
  }

  onSave(): void {
    if (this.form.valid && !this.saving) {
      this.saving = true;
      this.errorMessage = '';

      const formValue = this.form.value;
      const name = formValue['name'] as string;
      const url = formValue['url'] as string;
      const events = formValue['events'] as string[];
      const secret = formValue['secret'] as string;

      const input: WebhookSubscriptionInput = {
        name,
        url,
        events,
        ...(secret && { secret }),
      };

      this.webhookService
        .create(input)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.logger.info('Webhook created successfully');
            this.dialogRef.close(true);
          },
          error: (error: { error?: { message?: string } }) => {
            this.logger.error('Failed to create webhook', error);
            this.errorMessage =
              error.error?.message || 'Failed to create webhook. Please try again.';
            this.saving = false;
          },
        });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
