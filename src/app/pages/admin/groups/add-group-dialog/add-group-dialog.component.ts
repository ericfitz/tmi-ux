import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { CreateGroupRequest } from '@app/types/group.types';
import { GroupAdminService } from '@app/core/services/group-admin.service';
import { LoggerService } from '@app/core/services/logger.service';

/**
 * Add Group Dialog Component
 *
 * Dialog for creating new provider-independent groups (TMI provider).
 * Allows input of group name, display name, and description.
 */
@Component({
  selector: 'app-add-group-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'admin.groups.addDialog.title'">Add Group</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="admin-form">
        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.groups.addDialog.displayName'">Display Name</mat-label>
          <input
            matInput
            formControlName="name"
            [placeholder]="'admin.groups.addDialog.displayNamePlaceholder' | transloco"
            required
          />
          <mat-hint [transloco]="'admin.groups.addDialog.displayNameHint'"
            >Human-readable group name</mat-hint
          >
          <mat-error *ngIf="form.get('name')?.hasError('required')">
            <span [transloco]="'admin.groups.addDialog.displayNameRequired'"
              >Display name is required</span
            >
          </mat-error>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.groups.addDialog.groupName'">Group Identifier</mat-label>
          <input
            matInput
            formControlName="group_name"
            [placeholder]="'admin.groups.addDialog.groupNamePlaceholder' | transloco"
            (focus)="onGroupNameFocus()"
            required
          />
          <mat-hint [transloco]="'admin.groups.addDialog.groupNameHint'"
            >Alphanumeric, hyphens, and underscores only</mat-hint
          >
          <mat-error *ngIf="form.get('group_name')?.hasError('required')">
            <span [transloco]="'admin.groups.addDialog.groupNameRequired'"
              >Group identifier is required</span
            >
          </mat-error>
          <mat-error *ngIf="form.get('group_name')?.hasError('pattern')">
            <span [transloco]="'admin.groups.addDialog.groupNamePattern'"
              >Only alphanumeric, hyphens, and underscores allowed</span
            >
          </mat-error>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.groups.addDialog.description'"
            >Description (Optional)</mat-label
          >
          <textarea
            matInput
            formControlName="description"
            [placeholder]="'admin.groups.addDialog.descriptionPlaceholder' | transloco"
            rows="3"
          ></textarea>
          <mat-hint [transloco]="'admin.groups.addDialog.descriptionHint'"
            >Optional description of the group's purpose</mat-hint
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
        <span [transloco]="'admin.groups.addDialog.save'">Create Group</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .admin-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 400px;
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
        padding: 16px 24px;
        margin: 0;
      }
    `,
  ],
})
export class AddGroupDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private groupNameManuallyEdited = false;

  form!: FormGroup;
  saving = false;
  errorMessage = '';

  constructor(
    private dialogRef: MatDialogRef<AddGroupDialogComponent>,
    private groupAdminService: GroupAdminService,
    private fb: FormBuilder,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      group_name: [
        '',
        [Validators.required, Validators.pattern(/^[a-zA-Z0-9_-]+$/), Validators.maxLength(500)],
      ],
      name: ['', [Validators.required, Validators.maxLength(256)]],
      description: ['', Validators.maxLength(1000)],
    });

    // Auto-populate group_name from name until user manually edits it
    this.form
      .get('name')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name: unknown) => {
        if (!this.groupNameManuallyEdited) {
          const nameStr = typeof name === 'string' ? name : '';
          const sanitizedName = nameStr
            ? nameStr
                .toLowerCase()
                .replace(/[^a-z0-9-_\s]/g, '')
                .replace(/\s+/g, '-')
            : '';
          this.form.get('group_name')?.setValue(sanitizedName, { emitEvent: false });
        }
      });
  }

  onGroupNameFocus(): void {
    this.groupNameManuallyEdited = true;
  }

  onSave(): void {
    if (this.form.valid && !this.saving) {
      this.saving = true;
      this.errorMessage = '';

      const formValue = this.form.value as {
        group_name: string;
        name: string;
        description?: string;
      };

      const request: CreateGroupRequest = {
        group_name: formValue.group_name,
        name: formValue.name,
        ...(formValue.description && { description: formValue.description }),
      };

      this.groupAdminService
        .create(request)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('Group created successfully');
            this.dialogRef.close(true);
          },
          error: (error: { error?: { message?: string } }) => {
            this.logger.error('Failed to create group', error);
            this.errorMessage = error.error?.message || 'Failed to create group. Please try again.';
            this.saving = false;
          },
        });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
