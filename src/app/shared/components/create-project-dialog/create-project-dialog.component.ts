import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';
import { TeamListItem } from '@app/types/team.types';
import {
  CreateTeamDialogComponent,
  CreateTeamDialogResult,
} from '../create-team-dialog/create-team-dialog.component';

export interface CreateProjectDialogResult {
  name: string;
  description?: string;
  team_id: string;
  uri?: string;
  status?: string;
}

@Component({
  selector: 'app-create-project-dialog',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'projects.createDialog.title'">Create Project</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="create-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.name'">Name</mat-label>
          <input
            matInput
            formControlName="name"
            [placeholder]="'projects.createDialog.namePlaceholder' | transloco"
            maxlength="256"
            cdkFocusInitial
          />
          @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
            <mat-error [transloco]="'projects.createDialog.nameRequired'">
              Project name is required
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.description'">Description</mat-label>
          <textarea
            matInput
            formControlName="description"
            [placeholder]="'projects.createDialog.descriptionPlaceholder' | transloco"
            maxlength="1024"
            rows="3"
          ></textarea>
        </mat-form-field>

        <div class="team-picker-row">
          <mat-form-field appearance="outline" class="team-field">
            <mat-label [transloco]="'common.team'">Team</mat-label>
            @if (loadingTeams) {
              <mat-select formControlName="team_id" [disabled]="true">
                <mat-option>{{ 'common.loading' | transloco }}</mat-option>
              </mat-select>
            } @else {
              <mat-select formControlName="team_id">
                @for (team of teams; track team.id) {
                  <mat-option [value]="team.id">{{ team.name }}</mat-option>
                }
              </mat-select>
            }
            @if (form.get('team_id')?.hasError('required') && form.get('team_id')?.touched) {
              <mat-error [transloco]="'projects.createDialog.teamRequired'">
                Team is required
              </mat-error>
            }
          </mat-form-field>
          <button
            mat-icon-button
            type="button"
            (click)="openCreateTeam()"
            [matTooltip]="'teams.createNew' | transloco"
          >
            <mat-icon>add</mat-icon>
          </button>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.uri'">URI</mat-label>
          <input
            matInput
            formControlName="uri"
            type="url"
            [placeholder]="'projects.createDialog.uriPlaceholder' | transloco"
          />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.status'">Status</mat-label>
          <input
            matInput
            formControlName="status"
            [placeholder]="'projects.createDialog.statusPlaceholder' | transloco"
          />
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="onCreate()"
        [disabled]="form.invalid || !form.dirty"
      >
        <span [transloco]="'common.create'">Create</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .create-form {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 400px;
      }

      .full-width {
        width: 100%;
      }

      .team-picker-row {
        display: flex;
        align-items: flex-start;
        gap: 4px;

        > button {
          margin-top: 8px;
        }
      }

      .team-field {
        flex: 1;
      }
    `,
  ],
})
export class CreateProjectDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  form: FormGroup;
  teams: TeamListItem[] = [];
  loadingTeams = true;

  constructor(
    public dialogRef: MatDialogRef<CreateProjectDialogComponent>,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private teamService: TeamService,
    private logger: LoggerService,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(256)]],
      description: ['', [Validators.maxLength(1024)]],
      team_id: ['', [Validators.required]],
      uri: [''],
      status: [''],
    });
  }

  ngOnInit(): void {
    this.loadTeams();
  }

  private loadTeams(): void {
    this.loadingTeams = true;
    this.teamService
      .list({ limit: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.teams = response.teams;
          this.loadingTeams = false;
        },
        error: () => {
          this.loadingTeams = false;
        },
      });
  }

  openCreateTeam(): void {
    const teamDialogRef = this.dialog.open(CreateTeamDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
    });

    teamDialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: CreateTeamDialogResult | undefined) => {
        if (!result) return;

        this.teamService
          .create(result)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: newTeam => {
              this.teams = [
                ...this.teams,
                {
                  id: newTeam.id,
                  name: newTeam.name,
                  description: newTeam.description,
                  status: newTeam.status,
                  created_at: newTeam.created_at,
                },
              ];
              this.form.patchValue({ team_id: newTeam.id });
              this.form.markAsDirty();
            },
            error: error => {
              this.logger.error('Failed to create team', error);
            },
          });
      });
  }

  onCreate(): void {
    if (this.form.invalid) {
      return;
    }

    const value = this.form.value;
    const result: CreateProjectDialogResult = {
      name: value.name.trim(),
      team_id: value.team_id,
    };

    if (value.description?.trim()) {
      result.description = value.description.trim();
    }
    if (value.uri?.trim()) {
      result.uri = value.uri.trim();
    }
    if (value.status?.trim()) {
      result.status = value.status.trim();
    }

    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
