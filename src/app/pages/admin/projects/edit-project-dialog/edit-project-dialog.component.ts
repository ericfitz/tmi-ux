import { Component, DestroyRef, inject, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { ProjectService } from '@app/core/services/project.service';
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';
import { Project, PROJECT_STATUSES } from '@app/types/project.types';
import { TeamListItem } from '@app/types/team.types';

export interface EditProjectDialogData {
  project: Project;
}

@Component({
  selector: 'app-edit-project-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'projects.editDialog.title'">Edit Project</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="admin-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.name'">Name</mat-label>
          <input matInput formControlName="name" />
          @if (form.get('name')?.hasError('required')) {
            <mat-error>{{ 'common.validation.required' | transloco }}</mat-error>
          }
          @if (form.get('name')?.hasError('maxlength')) {
            <mat-error>{{ 'common.validation.maxLength' | transloco: { max: 256 } }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.description'">Description</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
          @if (form.get('description')?.hasError('maxlength')) {
            <mat-error>{{ 'common.validation.maxLength' | transloco: { max: 2048 } }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.team'">Team</mat-label>
          <mat-select formControlName="team_id">
            @if (loadingTeams) {
              <mat-option disabled>{{ 'common.loading' | transloco }}</mat-option>
            }
            @for (team of teams; track team.id) {
              <mat-option [value]="team.id">{{ team.name }}</mat-option>
            }
          </mat-select>
          @if (form.get('team_id')?.hasError('required')) {
            <mat-error>{{ 'common.validation.required' | transloco }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.uri'">URI</mat-label>
          <input matInput formControlName="uri" type="url" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.status'">Status</mat-label>
          <mat-select formControlName="status">
            <mat-option [value]="null">{{ 'common.none' | transloco }}</mat-option>
            @for (status of projectStatuses; track status) {
              <mat-option [value]="status">
                {{ 'projects.status.' + status | transloco }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (errorMessage) {
          <div class="form-error">{{ errorMessage }}</div>
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
        [disabled]="!form.valid || !form.dirty || saving"
      >
        @if (saving) {
          <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
        }
        <span [transloco]="'projects.editDialog.save'">Save</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .admin-form {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 400px;
      }
      .full-width {
        width: 100%;
      }
      .form-error {
        color: var(--theme-error);
        font-size: 12px;
        padding: 0 16px;
      }
      .button-spinner {
        display: inline-block;
        margin-right: 8px;
      }
    `,
  ],
})
export class EditProjectDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  form!: FormGroup;
  saving = false;
  errorMessage = '';
  projectStatuses = PROJECT_STATUSES;
  teams: TeamListItem[] = [];
  loadingTeams = false;

  constructor(
    private dialogRef: MatDialogRef<EditProjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditProjectDialogData,
    private projectService: ProjectService,
    private teamService: TeamService,
    private fb: FormBuilder,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    const project = this.data.project;
    this.form = this.fb.group({
      name: [project.name, [Validators.required, Validators.maxLength(256)]],
      description: [project.description || '', [Validators.maxLength(2048)]],
      team_id: [project.team_id, [Validators.required]],
      uri: [project.uri || ''],
      status: [project.status || null],
    });

    this.loadingTeams = true;
    this.teamService
      .list({ limit: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.teams = response.teams;
          this.loadingTeams = false;
        },
        error: (error: unknown) => {
          this.logger.error('Failed to load teams', error);
          this.loadingTeams = false;
        },
      });
  }

  onSave(): void {
    if (!this.form.valid || this.saving) return;
    this.saving = true;
    this.errorMessage = '';

    const input = {
      ...this.form.value,
      name: this.form.value.name?.trim(),
      description: this.form.value.description?.trim() || undefined,
      uri: this.form.value.uri?.trim() || undefined,
    };

    this.projectService
      .update(this.data.project.id, input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to update project', error);
          this.errorMessage = error.error?.message || 'Failed to update project. Please try again.';
          this.saving = false;
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
