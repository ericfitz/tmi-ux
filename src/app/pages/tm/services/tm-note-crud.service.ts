import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import { NoteFormResult } from '@app/shared/components/note-editor-dialog/note-editor-dialog.component';
import { ThreatModelService } from './threat-model.service';
import { Note, Metadata } from '../models/threat-model.model';

/** Notes loaded for one page of the notes sub-table. */
export interface NotesPage {
  notes: Note[];
  total: number;
}

/**
 * Note CRUD orchestration extracted from TmEditComponent. The two-phase
 * addNote flow (saveEvent + afterClosed) stays in the component because it
 * must touch the dialog's componentInstance; this service only owns the
 * API calls. Does NOT touch notesDataSource or pagination view state.
 */
@Injectable({ providedIn: 'root' })
export class TmNoteCrudService {
  constructor(private threatModelService: ThreatModelService) {}

  /** Load one page of notes for a threat model. */
  loadNotes(threatModelId: string, pageIndex: number, pageSize: number): Observable<NotesPage> {
    const offset = calculateOffset(pageIndex, pageSize);
    return this.threatModelService.getNotesForThreatModel(threatModelId, pageSize, offset).pipe(
      map(response => ({
        notes: response.notes ?? [],
        total: response.total ?? 0,
      })),
    );
  }

  /** Create a note from the note editor form value. */
  createNote(threatModelId: string, formValue: NoteFormResult): Observable<Note> {
    return this.threatModelService.createNote(threatModelId, formValue);
  }

  /** Update a note from the note editor form value; emits the updated note. */
  updateNote(threatModelId: string, noteId: string, formValue: NoteFormResult): Observable<Note> {
    return this.threatModelService.updateNote(threatModelId, noteId, formValue);
  }

  /** Delete a note; emits the success boolean. */
  deleteNote(threatModelId: string, noteId: string): Observable<boolean> {
    return this.threatModelService.deleteNote(threatModelId, noteId);
  }

  /** Update a note's metadata; emits the updated metadata array. */
  updateNoteMetadata(
    threatModelId: string,
    noteId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateNoteMetadata(threatModelId, noteId, metadata);
  }
}
