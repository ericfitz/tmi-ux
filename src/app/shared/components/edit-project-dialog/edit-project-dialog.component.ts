import { Component, DestroyRef, inject, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { ProjectService } from '@app/core/services/project.service';
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  Project,
  ProjectInput,
  PROJECT_STATUSES,
  ProjectNoteListItem,
  ListProjectNotesResponse,
  ProjectNote,
} from '@app/types/project.types';
import { TeamListItem } from '@app/types/team.types';
import {
  NoteEditorDialogComponent,
  NoteEditorDialogData,
  NoteEditorResult,
  NoteFormResult,
} from '../note-editor-dialog/note-editor-dialog.component';
import {
  DeleteConfirmationDialogComponent,
  DeleteConfirmationDialogResult,
} from '../delete-confirmation-dialog/delete-confirmation-dialog.component';

export interface EditProjectDialogData {
  project: Project;
}

@Component({
  selector: 'app-edit-project-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatTableModule,
    MatPaginatorModule,
    MatIconModule,
    MatTooltipModule,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'projects.editDialog.title'">Edit Project</h2>
    <mat-dialog-content>
      <mat-tab-group (selectedTabChange)="onTabChange($event)" [selectedIndex]="selectedTabIndex">
        <!-- Details Tab -->
        <mat-tab [label]="'projects.editDialog.detailsTab' | transloco">
          <div class="tab-content">
            <form [formGroup]="form" class="admin-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label [transloco]="'common.name'">Name</mat-label>
                <input matInput formControlName="name" />
                @if (form.get('name')?.hasError('required')) {
                  <mat-error>{{ 'common.validation.required' | transloco }}</mat-error>
                }
                @if (form.get('name')?.hasError('maxlength')) {
                  <mat-error>{{
                    'common.validation.maxLength' | transloco: { max: 256 }
                  }}</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label [transloco]="'common.description'">Description</mat-label>
                <textarea matInput formControlName="description" rows="3"></textarea>
                @if (form.get('description')?.hasError('maxlength')) {
                  <mat-error>{{
                    'common.validation.maxLength' | transloco: { max: 2048 }
                  }}</mat-error>
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
          </div>
        </mat-tab>

        <!-- Notes Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            {{
              (totalNotes > 0 ? 'notes.tabWithCount' : 'notes.tab')
                | transloco: { count: totalNotes }
            }}
          </ng-template>
          <div class="tab-content">
            <div class="notes-header">
              <button mat-raised-button color="primary" (click)="addNote()">
                <mat-icon fontSet="material-symbols-outlined">add</mat-icon>
                {{ 'notes.addNote' | transloco }}
              </button>
            </div>

            @if (notesLoading) {
              <div class="notes-loading"><mat-spinner diameter="32"></mat-spinner></div>
            } @else if (notes.length === 0) {
              <div class="notes-empty">{{ 'notes.noNotes' | transloco }}</div>
            } @else {
              <table mat-table [dataSource]="notes" class="notes-table">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>{{ 'notes.columns.name' | transloco }}</th>
                  <td mat-cell *matCellDef="let note" class="clickable" (click)="editNote(note)">
                    {{ note.name }}
                  </td>
                </ng-container>
                <ng-container matColumnDef="description">
                  <th mat-header-cell *matHeaderCellDef>
                    {{ 'notes.columns.description' | transloco }}
                  </th>
                  <td mat-cell *matCellDef="let note" class="clickable" (click)="editNote(note)">
                    {{ note.description }}
                  </td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let note">
                    <button
                      mat-icon-button
                      (click)="editNote(note); $event.stopPropagation()"
                      [matTooltip]="'common.edit' | transloco"
                    >
                      <mat-icon fontSet="material-symbols-outlined">edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      (click)="deleteNote(note); $event.stopPropagation()"
                      [matTooltip]="'common.delete' | transloco"
                    >
                      <mat-icon fontSet="material-symbols-outlined">delete</mat-icon>
                    </button>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="notesDisplayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: notesDisplayedColumns"></tr>
              </table>

              @if (totalNotes > notesPageSize) {
                <mat-paginator
                  [length]="totalNotes"
                  [pageSize]="notesPageSize"
                  [pageIndex]="notesPageIndex"
                  [pageSizeOptions]="[10, 25, 50]"
                  (page)="onNotesPageChange($event)"
                ></mat-paginator>
              }
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (selectedTabIndex === 0) {
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
      } @else {
        <button mat-button (click)="onCancel()">
          <span [transloco]="'common.close'">Close</span>
        </button>
      }
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
      .tab-content {
        padding-top: 16px;
        min-width: 400px;
      }
      .notes-header {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 12px;
      }
      .notes-table {
        width: 100%;
      }
      .notes-loading {
        display: flex;
        justify-content: center;
        padding: 32px 0;
      }
      .notes-empty {
        text-align: center;
        color: var(--theme-text-secondary);
        padding: 32px 0;
      }
      .clickable {
        cursor: pointer;
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

  selectedTabIndex = 0;
  notes: ProjectNoteListItem[] = [];
  totalNotes = 0;
  notesPageIndex = 0;
  notesPageSize = 10;
  notesDisplayedColumns = ['name', 'description', 'actions'];
  notesLoading = false;
  private notesLoaded = false;

  constructor(
    private dialogRef: MatDialogRef<EditProjectDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditProjectDialogData,
    private projectService: ProjectService,
    private teamService: TeamService,
    private fb: FormBuilder,
    private logger: LoggerService,
    private dialog: MatDialog,
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

    const formValue = this.form.value as {
      name: string;
      description: string;
      team_id: string;
      uri: string;
      status: string | null;
    };
    const input: ProjectInput = {
      ...formValue,
      name: formValue.name?.trim(),
      description: formValue.description?.trim() || undefined,
      uri: formValue.uri?.trim() || undefined,
      status: formValue.status || undefined,
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

  onTabChange(event: { index: number }): void {
    this.selectedTabIndex = event.index;
    if (event.index === 1 && !this.notesLoaded) {
      this.loadNotes();
    }
  }

  private loadNotes(): void {
    this.notesLoading = true;
    this.projectService
      .listNotes(this.data.project.id, this.notesPageSize, this.notesPageIndex * this.notesPageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ListProjectNotesResponse) => {
          this.notes = response.notes;
          this.totalNotes = response.total;
          this.notesLoading = false;
          this.notesLoaded = true;
        },
        error: (error: unknown) => {
          this.logger.error('Failed to load project notes', error);
          this.notesLoading = false;
        },
      });
  }

  onNotesPageChange(event: PageEvent): void {
    this.notesPageIndex = event.pageIndex;
    this.notesPageSize = event.pageSize;
    this.loadNotes();
  }

  addNote(): void {
    const dialogData: NoteEditorDialogData = {
      mode: 'create',
      entityType: 'project',
    };

    const dialogRef = this.dialog.open(NoteEditorDialogComponent, {
      width: '90vw',
      maxWidth: '900px',
      minWidth: '600px',
      maxHeight: '90vh',
      data: dialogData,
    });

    const saveSubscription = dialogRef.componentInstance.saveEvent.subscribe(
      (noteResult: NoteFormResult) => {
        this.projectService
          .createNote(this.data.project.id, noteResult)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (created: ProjectNote) => {
              dialogRef.componentInstance.setCreatedNoteId(created.id);
              this.loadNotes();
            },
            error: (error: unknown) => {
              this.logger.error('Failed to create project note', error);
            },
          });
      },
    );

    dialogRef.afterClosed().subscribe((result?: NoteEditorResult) => {
      saveSubscription.unsubscribe();
      if (result?.formValue && result.noteId) {
        this.projectService
          .updateNote(this.data.project.id, result.noteId, result.formValue)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => this.loadNotes(),
            error: (error: unknown) => {
              this.logger.error('Failed to update project note on close', error);
            },
          });
      } else if (result) {
        // Note was created; refresh list to reflect it
        this.loadNotes();
      }
    });
  }

  editNote(noteListItem: ProjectNoteListItem): void {
    this.projectService
      .getNoteById(this.data.project.id, noteListItem.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (note: ProjectNote | undefined) => {
          if (!note) {
            this.logger.error('Failed to load note for editing');
            return;
          }

          const dialogData: NoteEditorDialogData = {
            mode: 'edit',
            entityType: 'project',
            note,
          };

          const dialogRef = this.dialog.open(NoteEditorDialogComponent, {
            width: '90vw',
            maxWidth: '900px',
            minWidth: '600px',
            maxHeight: '90vh',
            data: dialogData,
          });

          const saveSubscription = dialogRef.componentInstance.saveEvent.subscribe(
            (noteResult: NoteFormResult) => {
              this.projectService
                .updateNote(this.data.project.id, noteListItem.id, noteResult)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                  next: () => this.loadNotes(),
                  error: (error: unknown) => {
                    this.logger.error('Failed to update project note', error);
                  },
                });
            },
          );

          dialogRef.afterClosed().subscribe(() => {
            saveSubscription.unsubscribe();
            // Saves are already handled by saveEvent; just refresh the list
            this.loadNotes();
          });
        },
      });
  }

  deleteNote(noteListItem: ProjectNoteListItem): void {
    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      data: {
        id: noteListItem.id,
        name: noteListItem.name,
        objectType: 'note',
      },
    });

    dialogRef.afterClosed().subscribe((result: DeleteConfirmationDialogResult | undefined) => {
      if (result?.confirmed) {
        this.projectService
          .deleteNote(this.data.project.id, noteListItem.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => this.loadNotes(),
            error: (error: unknown) => {
              this.logger.error('Failed to delete project note', error);
            },
          });
      }
    });
  }
}
