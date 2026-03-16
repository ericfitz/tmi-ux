import { Component, DestroyRef, inject, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { TranslocoModule } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  Team,
  RelatedTeam,
  RELATIONSHIP_TYPES,
  RelationshipType,
  TeamListItem,
} from '@app/types/team.types';

export interface RelatedTeamsDialogData {
  team: Team;
}

@Component({
  selector: 'app-related-teams-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatAutocompleteModule,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'teams.relatedTeamsDialog.title'">Manage Related Teams</h2>
    <mat-dialog-content>
      <div class="related-list">
        @if (relatedTeams.length === 0) {
          <div class="no-items">{{ 'teams.relatedTeamsDialog.noRelated' | transloco }}</div>
        }
        @for (related of relatedTeams; track related.related_team_id) {
          <div class="related-row">
            <div class="related-info">
              <span class="related-name">
                {{ teamNames.get(related.related_team_id) || related.related_team_id }}
              </span>
              <span class="related-type">
                {{ 'teams.relationships.' + related.relationship | transloco }}
                @if (related.custom_relationship) {
                  ({{ related.custom_relationship }})
                }
              </span>
            </div>
            <button
              mat-icon-button
              (click)="removeRelated(related)"
              [matTooltip]="'common.remove' | transloco"
            >
              <mat-icon>remove_circle_outline</mat-icon>
            </button>
          </div>
        }
      </div>

      @if (!showAddForm) {
        <div class="add-button">
          <button mat-stroked-button (click)="showAddForm = true">
            <mat-icon>group_add</mat-icon>
            <span [transloco]="'teams.relatedTeamsDialog.addRelated'">Add Related Team</span>
          </button>
        </div>
      }

      @if (showAddForm) {
        <div class="add-form" [formGroup]="addForm">
          <mat-form-field class="full-width">
            <mat-label [transloco]="'teams.relatedTeamsDialog.selectTeam'">Select Team</mat-label>
            <input matInput formControlName="teamSearch" [matAutocomplete]="teamAuto" />
            <mat-autocomplete
              #teamAuto="matAutocomplete"
              [displayWith]="displayTeam"
              (optionSelected)="onTeamSelected($event)"
            >
              @for (team of filteredTeams$ | async; track team.id) {
                <mat-option [value]="team">{{ team.name }}</mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label [transloco]="'teams.relatedTeamsDialog.relationship'">
              Relationship
            </mat-label>
            <mat-select formControlName="relationship">
              @for (type of relationshipTypes; track type) {
                <mat-option [value]="type">
                  {{ 'teams.relationships.' + type | transloco }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (addForm.get('relationship')?.value === 'other') {
            <mat-form-field class="full-width">
              <mat-label [transloco]="'teams.relatedTeamsDialog.customRelationship'">
                Custom Relationship
              </mat-label>
              <input matInput formControlName="customRelationship" />
            </mat-form-field>
          }

          <div class="add-form-actions">
            <button mat-button (click)="cancelAddForm()">
              <span [transloco]="'common.cancel'">Cancel</span>
            </button>
            <button
              mat-raised-button
              color="primary"
              (click)="addRelated()"
              [disabled]="!selectedTeam || !addForm.get('relationship')?.value"
            >
              <span [transloco]="'common.add'">Add</span>
            </button>
          </div>
        </div>
      }

      @if (errorMessage) {
        <div class="form-error">{{ errorMessage }}</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button mat-raised-button color="primary" (click)="onSave()" [disabled]="!dirty || saving">
        @if (saving) {
          <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
        }
        <span [transloco]="'common.save'">Save</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .related-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 400px;
      }
      .related-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--theme-surface-variant, rgba(0, 0, 0, 0.05));
        border-radius: 8px;
      }
      .related-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
      }
      .related-name {
        font-weight: 500;
      }
      .related-type {
        font-size: 12px;
        color: var(--theme-text-secondary);
      }
      .no-items {
        text-align: center;
        padding: 24px;
        color: var(--theme-text-secondary);
        font-style: italic;
      }
      .add-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 16px;
        padding: 16px;
        background: var(--theme-surface-variant, rgba(0, 0, 0, 0.03));
        border-radius: 8px;
      }
      .add-form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .add-button {
        margin-top: 16px;
      }
      .full-width {
        width: 100%;
      }
      .form-error {
        color: var(--theme-error);
        font-size: 12px;
        padding: 8px 0 0;
      }
      .button-spinner {
        display: inline-block;
        margin-right: 8px;
      }
    `,
  ],
})
export class RelatedTeamsDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  relatedTeams: RelatedTeam[];
  teamNames = new Map<string, string>();
  showAddForm = false;
  dirty = false;
  saving = false;
  errorMessage = '';
  selectedTeam: TeamListItem | null = null;
  filteredTeams$: Observable<TeamListItem[]> = of([]);
  readonly relationshipTypes = RELATIONSHIP_TYPES;
  addForm: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<RelatedTeamsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RelatedTeamsDialogData,
    private fb: FormBuilder,
    private teamService: TeamService,
    private logger: LoggerService,
  ) {
    this.relatedTeams = [...(data.team.related_teams || [])];
    this.addForm = this.fb.group({
      teamSearch: new FormControl<string | TeamListItem>(''),
      relationship: new FormControl<RelationshipType | null>(null, Validators.required),
      customRelationship: new FormControl<string>(''),
    });
  }

  ngOnInit(): void {
    this.filteredTeams$ = (
      this.addForm.get('teamSearch') as FormControl<string | TeamListItem>
    ).valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => {
        if (typeof value === 'string' && value.length >= 2) {
          return this.teamService
            .list({ name: value, limit: 10 })
            .pipe(map(response => response.teams.filter(t => t.id !== this.data.team.id)));
        }
        return of([]);
      }),
    );
  }

  /** Display function for the autocomplete input — arrow form preserves `this` for [displayWith]. */
  displayTeam = (team: TeamListItem): string => team?.name || '';

  onTeamSelected(event: MatAutocompleteSelectedEvent): void {
    this.selectedTeam = event.option.value as TeamListItem;
  }

  addRelated(): void {
    if (!this.selectedTeam) return;
    const relationship = this.addForm.get('relationship')?.value as RelationshipType;
    if (!relationship) return;

    const customRelationship =
      relationship === 'other'
        ? (this.addForm.get('customRelationship')?.value as string) || undefined
        : undefined;

    // Avoid duplicates
    if (this.relatedTeams.some(r => r.related_team_id === this.selectedTeam!.id)) {
      return;
    }

    this.teamNames.set(this.selectedTeam.id, this.selectedTeam.name);
    this.relatedTeams.push({
      related_team_id: this.selectedTeam.id,
      relationship,
      custom_relationship: customRelationship,
    });

    this.dirty = true;
    this.cancelAddForm();
  }

  cancelAddForm(): void {
    this.showAddForm = false;
    this.selectedTeam = null;
    this.addForm.reset();
  }

  removeRelated(related: RelatedTeam): void {
    this.relatedTeams = this.relatedTeams.filter(
      r => r.related_team_id !== related.related_team_id,
    );
    this.dirty = true;
  }

  onSave(): void {
    if (!this.dirty || this.saving) return;
    this.saving = true;
    this.errorMessage = '';

    this.teamService
      .patch(this.data.team.id, { related_teams: this.relatedTeams })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to update related teams', error);
          this.errorMessage =
            error.error?.message || 'Failed to update related teams. Please try again.';
          this.saving = false;
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
