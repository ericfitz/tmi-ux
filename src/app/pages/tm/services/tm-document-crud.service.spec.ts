import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmDocumentCrudService } from './tm-document-crud.service';
import type { Document } from '../models/threat-model.model';

describe('TmDocumentCrudService', () => {
  let service: TmDocumentCrudService;
  let threatModelService: {
    createDocument: ReturnType<typeof vi.fn>;
    updateDocument: ReturnType<typeof vi.fn>;
    deleteDocument: ReturnType<typeof vi.fn>;
    updateDocumentMetadata: ReturnType<typeof vi.fn>;
    getDocumentsForThreatModel: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    threatModelService = {
      createDocument: vi.fn().mockReturnValue(of({ id: 'd9' })),
      updateDocument: vi.fn().mockReturnValue(of({ id: 'd1', name: 'New' })),
      deleteDocument: vi.fn().mockReturnValue(of(true)),
      updateDocumentMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v' }])),
      getDocumentsForThreatModel: vi
        .fn()
        .mockReturnValue(of({ documents: [{ id: 'd1' }], total: 1, limit: 20, offset: 0 })),
    };
    service = new TmDocumentCrudService(threatModelService as never);
  });

  describe('buildDocumentData', () => {
    it('maps editor values and coerces empty description to undefined', () => {
      const data = service.buildDocumentData({
        name: 'N',
        uri: 'U',
        description: '',
        include_in_report: true,
      });
      expect(data).toEqual({
        name: 'N',
        uri: 'U',
        description: undefined,
        include_in_report: true,
      });
    });
    it('includes picker_registration when present', () => {
      const data = service.buildDocumentData({
        name: 'N',
        uri: 'U',
        description: 'd',
        include_in_report: false,
        picker_registration: { provider: 'google' },
      } as never);
      expect(data).toMatchObject({ picker_registration: { provider: 'google' } });
    });
  });

  describe('loadDocuments', () => {
    it('calls getDocumentsForThreatModel with the computed offset', () => {
      service.loadDocuments('tm1', 2, 10).subscribe();
      expect(threatModelService.getDocumentsForThreatModel).toHaveBeenCalledWith('tm1', 10, 20);
    });
    it('emits documents and total from the response', () => {
      let result: { documents: Document[]; total: number } | undefined;
      service.loadDocuments('tm1', 0, 20).subscribe(r => (result = r));
      expect(result).toEqual({ documents: [{ id: 'd1' }], total: 1 });
    });
    it('defaults documents to [] and total to 0 when the response omits them', () => {
      // Cast to never to simulate a malformed/empty server response at runtime
      threatModelService.getDocumentsForThreatModel.mockReturnValue(of({} as never));
      let result: { documents: Document[]; total: number } | undefined;
      service.loadDocuments('tm1', 0, 20).subscribe(r => (result = r));
      expect(result).toEqual({ documents: [], total: 0 });
    });
  });

  describe('createDocument', () => {
    it('calls createDocument with the built data', () => {
      service
        .createDocument('tm1', {
          name: 'N',
          uri: 'U',
          description: '',
          include_in_report: true,
        })
        .subscribe();
      expect(threatModelService.createDocument).toHaveBeenCalledWith('tm1', {
        name: 'N',
        uri: 'U',
        description: undefined,
        include_in_report: true,
      });
    });
  });

  describe('updateDocument', () => {
    it('calls updateDocument with id and built data, emits the updated document', () => {
      let updated: Document | undefined;
      service
        .updateDocument('tm1', 'd1', {
          name: 'New',
          uri: 'U',
          description: 'd',
          include_in_report: true,
        })
        .subscribe(d => (updated = d));
      expect(threatModelService.updateDocument).toHaveBeenCalledWith('tm1', 'd1', {
        name: 'New',
        uri: 'U',
        description: 'd',
        include_in_report: true,
      });
      expect(updated).toEqual({ id: 'd1', name: 'New' });
    });
  });

  describe('deleteDocument', () => {
    it('calls deleteDocument and emits the success boolean', () => {
      let ok: boolean | undefined;
      service.deleteDocument('tm1', 'd1').subscribe(v => (ok = v));
      expect(threatModelService.deleteDocument).toHaveBeenCalledWith('tm1', 'd1');
      expect(ok).toBe(true);
    });
  });

  describe('updateDocumentMetadata', () => {
    it('calls updateDocumentMetadata and emits the updated metadata', () => {
      let meta: unknown;
      service.updateDocumentMetadata('tm1', 'd1', []).subscribe(m => (meta = m));
      expect(threatModelService.updateDocumentMetadata).toHaveBeenCalledWith('tm1', 'd1', []);
      expect(meta).toEqual([{ key: 'k', value: 'v' }]);
    });
  });
});
