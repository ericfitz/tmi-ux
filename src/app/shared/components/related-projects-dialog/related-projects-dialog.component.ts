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
import { ProjectService } from '@app/core/services/project.service';
import { LoggerService } from '@app/core/services/logger.service';
import { RELATIONSHIP_TYPES, RelationshipType } from '@app/types/team.types';
import { Project, RelatedProject, ProjectListItem } from '@app/types/project.types';

export interface RelatedProjectsDialogData {
  project: Project;
}

@Component({
  selector: 'app-related-projects-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatAutocompleteModule,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'projects.relatedProjectsDialog.title'">
      Manage Related Projects
    </h2>
    <mat-dialog-content>
      <div class="related-list">
        @if (relatedProjects.length === 0) {
          <div class="no-items">{{ 'projects.relatedProjectsDialog.noRelated' | transloco }}</div>
        }
        @for (related of relatedProjects; track related.related_project_id) {
          <div class="related-row">
            <div class="related-info">
              <span class="related-name">
                {{ projectNames.get(related.related_project_id) || related.related_project_id }}
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
            <span [transloco]="'projects.relatedProjectsDialog.addRelated'">
              Add Related Project
            </span>
          </button>
        </div>
      }

      @if (showAddForm) {
        <div class="add-form" [formGroup]="addForm">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label [transloco]="'projects.relatedProjectsDialog.selectProject'">
              Select Project
            </mat-label>
            <input matInput formControlName="projectSearch" [matAutocomplete]="projectAuto" />
            <mat-autocomplete
              #projectAuto="matAutocomplete"
              [displayWith]="displayProject"
              (optionSelected)="onProjectSelected($event)"
            >
              @for (project of filteredProjects$ | async; track project.id) {
                <mat-option [value]="project">{{ project.name }}</mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label [transloco]="'projects.relatedProjectsDialog.relationship'">
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
            <mat-form-field appearance="outline" class="full-width">
              <mat-label [transloco]="'projects.relatedProjectsDialog.customRelationship'">
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
              [disabled]="!selectedProject || !addForm.get('relationship')?.value"
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
export class RelatedProjectsDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  relatedProjects: RelatedProject[];
  projectNames = new Map<string, string>();
  showAddForm = false;
  dirty = false;
  saving = false;
  errorMessage = '';
  selectedProject: ProjectListItem | null = null;
  filteredProjects$: Observable<ProjectListItem[]> = of([]);
  readonly relationshipTypes = RELATIONSHIP_TYPES;
  addForm: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<RelatedProjectsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RelatedProjectsDialogData,
    private fb: FormBuilder,
    private projectService: ProjectService,
    private logger: LoggerService,
  ) {
    this.relatedProjects = [...(data.project.related_projects || [])];
    this.addForm = this.fb.group({
      projectSearch: new FormControl<string | ProjectListItem>(''),
      relationship: new FormControl<RelationshipType | null>(null, Validators.required),
      customRelationship: new FormControl<string>(''),
    });
  }

  ngOnInit(): void {
    this.filteredProjects$ = (
      this.addForm.get('projectSearch') as FormControl<string | ProjectListItem>
    ).valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => {
        if (typeof value === 'string' && value.length >= 2) {
          return this.projectService
            .list({ name: value, limit: 10 })
            .pipe(map(response => response.projects.filter(p => p.id !== this.data.project.id)));
        }
        return of([]);
      }),
    );
  }

  /** Display function for the autocomplete input — arrow form preserves `this` for [displayWith]. */
  displayProject = (project: ProjectListItem): string => project?.name || '';

  onProjectSelected(event: MatAutocompleteSelectedEvent): void {
    this.selectedProject = event.option.value as ProjectListItem;
  }

  addRelated(): void {
    if (!this.selectedProject) return;
    const relationship = this.addForm.get('relationship')?.value as RelationshipType;
    if (!relationship) return;

    const customRelationship =
      relationship === 'other'
        ? (this.addForm.get('customRelationship')?.value as string) || undefined
        : undefined;

    // Avoid duplicates
    if (this.relatedProjects.some(r => r.related_project_id === this.selectedProject!.id)) {
      return;
    }

    this.projectNames.set(this.selectedProject.id, this.selectedProject.name);
    this.relatedProjects.push({
      related_project_id: this.selectedProject.id,
      relationship,
      custom_relationship: customRelationship,
    });

    this.dirty = true;
    this.cancelAddForm();
  }

  cancelAddForm(): void {
    this.showAddForm = false;
    this.selectedProject = null;
    this.addForm.reset();
  }

  removeRelated(related: RelatedProject): void {
    this.relatedProjects = this.relatedProjects.filter(
      r => r.related_project_id !== related.related_project_id,
    );
    this.dirty = true;
  }

  onSave(): void {
    if (!this.dirty || this.saving) return;
    this.saving = true;
    this.errorMessage = '';

    this.projectService
      .patch(this.data.project.id, { related_projects: this.relatedProjects })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to update related projects', error);
          this.errorMessage =
            error.error?.message || 'Failed to update related projects. Please try again.';
          this.saving = false;
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
