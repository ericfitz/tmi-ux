import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmNoteCrudService } from './tm-note-crud.service';
import type { Note } from '../models/threat-model.model';

describe('TmNoteCrudService', () => {
  let service: TmNoteCrudService;
  let threatModelService: {
    getNotesForThreatModel: ReturnType<typeof vi.fn>;
    createNote: ReturnType<typeof vi.fn>;
    updateNote: ReturnType<typeof vi.fn>;
    deleteNote: ReturnType<typeof vi.fn>;
    updateNoteMetadata: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    threatModelService = {
      getNotesForThreatModel: vi.fn().mockReturnValue(of({ notes: [{ id: 'n1' }], total: 1 })),
      createNote: vi.fn().mockReturnValue(of({ id: 'n9' })),
      updateNote: vi.fn().mockReturnValue(of({ id: 'n1', name: 'New' })),
      deleteNote: vi.fn().mockReturnValue(of(true)),
      updateNoteMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v' }])),
    };
    service = new TmNoteCrudService(threatModelService as never);
  });

  describe('loadNotes', () => {
    it('calls getNotesForThreatModel with the computed offset', () => {
      service.loadNotes('tm1', 2, 10).subscribe();
      expect(threatModelService.getNotesForThreatModel).toHaveBeenCalledWith('tm1', 10, 20);
    });
    it('emits notes and total, defaulting both when omitted', () => {
      threatModelService.getNotesForThreatModel.mockReturnValue(of({}));
      let result: { notes: Note[]; total: number } | undefined;
      service.loadNotes('tm1', 0, 20).subscribe(r => (result = r));
      expect(result).toEqual({ notes: [], total: 0 });
    });
  });

  describe('createNote / updateNote / deleteNote', () => {
    it('createNote forwards the form value', () => {
      const form = { name: 'N', content: 'C' } as never;
      let created: Note | undefined;
      service.createNote('tm1', form).subscribe(n => (created = n));
      expect(threatModelService.createNote).toHaveBeenCalledWith('tm1', form);
      expect(created).toEqual({ id: 'n9' });
    });
    it('updateNote forwards id and form value', () => {
      const form = { name: 'New', content: 'C' } as never;
      let updated: Note | undefined;
      service.updateNote('tm1', 'n1', form).subscribe(n => (updated = n));
      expect(threatModelService.updateNote).toHaveBeenCalledWith('tm1', 'n1', form);
      expect(updated).toEqual({ id: 'n1', name: 'New' });
    });
    it('deleteNote emits the success boolean', () => {
      let ok: boolean | undefined;
      service.deleteNote('tm1', 'n1').subscribe(v => (ok = v));
      expect(threatModelService.deleteNote).toHaveBeenCalledWith('tm1', 'n1');
      expect(ok).toBe(true);
    });
  });

  describe('updateNoteMetadata', () => {
    it('forwards updateNoteMetadata', () => {
      let meta: unknown;
      service.updateNoteMetadata('tm1', 'n1', []).subscribe(m => (meta = m));
      expect(threatModelService.updateNoteMetadata).toHaveBeenCalledWith('tm1', 'n1', []);
      expect(meta).toEqual([{ key: 'k', value: 'v' }]);
    });
  });
});
