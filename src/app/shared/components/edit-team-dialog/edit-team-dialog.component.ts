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
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  Team,
  TeamPatch,
  TeamStatus,
  TEAM_STATUSES,
  TeamNoteListItem,
  ListTeamNotesResponse,
  TeamNote,
} from '@app/types/team.types';
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

export interface EditTeamDialogData {
  team: Team;
}

@Component({
  selector: 'app-edit-team-dialog',
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
    <h2 mat-dialog-title [transloco]="'teams.editDialog.title'">Edit Team</h2>
    <mat-dialog-content>
      <mat-tab-group
        (selectedTabChange)="onTabChange($event)"
        [selectedIndex]="selectedTabIndex"
        data-testid="edit-team-tab-group"
      >
        <!-- Details Tab -->
        <mat-tab
          [label]="'teams.editDialog.detailsTab' | transloco"
          data-testid="edit-team-details-tab"
        >
          <div class="tab-content">
            <form [formGroup]="form" class="admin-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label [transloco]="'common.name'">Name</mat-label>
                <input matInput formControlName="name" data-testid="edit-team-name-input" />
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
                <textarea
                  matInput
                  formControlName="description"
                  rows="3"
                  data-testid="edit-team-description-input"
                ></textarea>
                @if (form.get('description')?.hasError('maxlength')) {
                  <mat-error>{{
                    'common.validation.maxLength' | transloco: { max: 2048 }
                  }}</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Email</mat-label>
                <input
                  matInput
                  formControlName="email_address"
                  type="email"
                  data-testid="edit-team-email-input"
                />
                @if (form.get('email_address')?.hasError('email')) {
                  <mat-error>{{ 'common.validation.invalidEmail' | transloco }}</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>URI</mat-label>
                <input
                  matInput
                  formControlName="uri"
                  type="url"
                  data-testid="edit-team-uri-input"
                />
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label [transloco]="'common.status'">Status</mat-label>
                <mat-select formControlName="status" data-testid="edit-team-status-select">
                  <mat-option [value]="null">{{ 'common.none' | transloco }}</mat-option>
                  @for (status of teamStatuses; track status) {
                    <mat-option [value]="status">
                      {{ 'teams.status.' + status | transloco }}
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
        <mat-tab data-testid="edit-team-notes-tab">
          <ng-template mat-tab-label>
            {{
              (totalNotes > 0 ? 'notes.tabWithCount' : 'notes.tab')
                | transloco: { count: totalNotes }
            }}
          </ng-template>
          <div class="tab-content">
            <div class="notes-header">
              <button
                mat-raised-button
                color="primary"
                (click)="addNote()"
                data-testid="edit-team-add-note-button"
              >
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
                  <td
                    mat-cell
                    *matCellDef="let note"
                    class="clickable"
                    (click)="editNote(note)"
                    data-testid="edit-team-note-row"
                  >
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
                      data-testid="edit-team-edit-note-button"
                    >
                      <mat-icon fontSet="material-symbols-outlined">edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      (click)="deleteNote(note); $event.stopPropagation()"
                      [matTooltip]="'common.delete' | transloco"
                      data-testid="edit-team-delete-note-button"
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
        <button mat-button (click)="onCancel()" data-testid="edit-team-cancel-button">
          <span [transloco]="'common.cancel'">Cancel</span>
        </button>
        <button
          mat-raised-button
          color="primary"
          (click)="onSave()"
          [disabled]="!form.valid || !form.dirty || saving"
          data-testid="edit-team-save-button"
        >
          @if (saving) {
            <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
          }
          <span [transloco]="'teams.editDialog.save'">Save</span>
        </button>
      } @else {
        <button mat-button (click)="onCancel()" data-testid="edit-team-cancel-button">
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
export class EditTeamDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  form!: FormGroup;
  saving = false;
  errorMessage = '';
  teamStatuses = TEAM_STATUSES;

  selectedTabIndex = 0;
  notes: TeamNoteListItem[] = [];
  totalNotes = 0;
  notesPageIndex = 0;
  notesPageSize = 10;
  notesDisplayedColumns = ['name', 'description', 'actions'];
  notesLoading = false;
  private notesLoaded = false;

  constructor(
    private dialogRef: MatDialogRef<EditTeamDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditTeamDialogData,
    private teamService: TeamService,
    private fb: FormBuilder,
    private logger: LoggerService,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    const team = this.data.team;
    this.form = this.fb.group({
      name: [team.name, [Validators.required, Validators.maxLength(256)]],
      description: [team.description || '', [Validators.maxLength(2048)]],
      email_address: [team.email_address || '', [Validators.email]],
      uri: [team.uri || ''],
      status: [team.status || null],
    });
  }

  onSave(): void {
    if (!this.form.valid || this.saving) return;
    this.saving = true;
    this.errorMessage = '';

    const formValue = this.form.value as {
      name: string;
      description: string;
      email_address: string;
      uri: string;
      status: string | null;
    };
    const input: TeamPatch = {
      name: formValue.name?.trim(),
      description: formValue.description?.trim(),
      email_address: formValue.email_address?.trim() || undefined,
      uri: formValue.uri?.trim() || undefined,
      status: (formValue.status as TeamStatus | null) || undefined,
    };

    this.teamService
      .patch(this.data.team.id, input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to update team', error);
          this.errorMessage = error.error?.message || 'Failed to update team. Please try again.';
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
    this.teamService
      .listNotes(this.data.team.id, this.notesPageSize, this.notesPageIndex * this.notesPageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ListTeamNotesResponse) => {
          this.notes = response.notes;
          this.totalNotes = response.total;
          this.notesLoading = false;
          this.notesLoaded = true;
        },
        error: (error: unknown) => {
          this.logger.error('Failed to load team notes', error);
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
      entityType: 'team',
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
        this.teamService
          .createNote(this.data.team.id, noteResult)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (created: TeamNote) => {
              dialogRef.componentInstance.setCreatedNoteId(created.id);
              this.loadNotes();
            },
            error: (error: unknown) => {
              this.logger.error('Failed to create team note', error);
            },
          });
      },
    );

    dialogRef.afterClosed().subscribe((result?: NoteEditorResult) => {
      saveSubscription.unsubscribe();
      if (result?.formValue && result.noteId) {
        this.teamService
          .updateNote(this.data.team.id, result.noteId, result.formValue)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => this.loadNotes(),
            error: (error: unknown) => {
              this.logger.error('Failed to update team note on close', error);
            },
          });
      } else if (result) {
        // Note was created; refresh list to reflect it
        this.loadNotes();
      }
    });
  }

  editNote(noteListItem: TeamNoteListItem): void {
    this.teamService
      .getNoteById(this.data.team.id, noteListItem.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (note: TeamNote | undefined) => {
          if (!note) {
            this.logger.error('Failed to load note for editing');
            return;
          }

          const dialogData: NoteEditorDialogData = {
            mode: 'edit',
            entityType: 'team',
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
              this.teamService
                .updateNote(this.data.team.id, noteListItem.id, noteResult)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                  next: () => this.loadNotes(),
                  error: (error: unknown) => {
                    this.logger.error('Failed to update team note', error);
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

  deleteNote(noteListItem: TeamNoteListItem): void {
    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      data: {
        id: noteListItem.id,
        name: noteListItem.name,
        objectType: 'note',
      },
    });

    dialogRef.afterClosed().subscribe((result: DeleteConfirmationDialogResult | undefined) => {
      if (result?.confirmed) {
        this.teamService
          .deleteNote(this.data.team.id, noteListItem.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => this.loadNotes(),
            error: (error: unknown) => {
              this.logger.error('Failed to delete team note', error);
            },
          });
      }
    });
  }
}
