import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmDiagramCrudService } from './tm-diagram-crud.service';
import type { Diagram } from '../models/diagram.model';

describe('TmDiagramCrudService', () => {
  let service: TmDiagramCrudService;
  let threatModelService: {
    getDiagramsForThreatModel: ReturnType<typeof vi.fn>;
    createDiagram: ReturnType<typeof vi.fn>;
    deleteDiagram: ReturnType<typeof vi.fn>;
    getDiagramMetadata: ReturnType<typeof vi.fn>;
    updateDiagramMetadata: ReturnType<typeof vi.fn>;
    getDiagramModel: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    threatModelService = {
      getDiagramsForThreatModel: vi
        .fn()
        .mockReturnValue(of({ diagrams: [{ id: 'g1' }], total: 1 })),
      createDiagram: vi.fn().mockReturnValue(of({ id: 'g9' })),
      deleteDiagram: vi.fn().mockReturnValue(of(true)),
      getDiagramMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v' }])),
      updateDiagramMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v2' }])),
      getDiagramModel: vi.fn().mockReturnValue(of('MODEL')),
    };
    service = new TmDiagramCrudService(threatModelService as never);
  });

  describe('loadDiagrams', () => {
    it('calls getDiagramsForThreatModel with the computed offset', () => {
      service.loadDiagrams('tm1', 2, 10).subscribe();
      expect(threatModelService.getDiagramsForThreatModel).toHaveBeenCalledWith('tm1', 10, 20);
    });
    it('emits diagrams and total, defaulting both when omitted', () => {
      threatModelService.getDiagramsForThreatModel.mockReturnValue(of({}));
      let result: { diagrams: Diagram[]; total: number } | undefined;
      service.loadDiagrams('tm1', 0, 20).subscribe(r => (result = r));
      expect(result).toEqual({ diagrams: [], total: 0 });
    });
  });

  describe('createDiagram', () => {
    it('calls createDiagram with name and type', () => {
      service.createDiagram('tm1', { name: 'D', type: 'DFD-1.0.0' }).subscribe();
      expect(threatModelService.createDiagram).toHaveBeenCalledWith('tm1', {
        name: 'D',
        type: 'DFD-1.0.0',
      });
    });
  });

  describe('deleteDiagram', () => {
    it('calls deleteDiagram and emits the success boolean', () => {
      let ok: boolean | undefined;
      service.deleteDiagram('tm1', 'g1').subscribe(v => (ok = v));
      expect(threatModelService.deleteDiagram).toHaveBeenCalledWith('tm1', 'g1');
      expect(ok).toBe(true);
    });
  });

  describe('getDiagramMetadata / updateDiagramMetadata', () => {
    it('forwards getDiagramMetadata', () => {
      let meta: unknown;
      service.getDiagramMetadata('tm1', 'g1').subscribe(m => (meta = m));
      expect(threatModelService.getDiagramMetadata).toHaveBeenCalledWith('tm1', 'g1');
      expect(meta).toEqual([{ key: 'k', value: 'v' }]);
    });
    it('forwards updateDiagramMetadata', () => {
      let meta: unknown;
      service.updateDiagramMetadata('tm1', 'g1', []).subscribe(m => (meta = m));
      expect(threatModelService.updateDiagramMetadata).toHaveBeenCalledWith('tm1', 'g1', []);
      expect(meta).toEqual([{ key: 'k', value: 'v2' }]);
    });
  });

  describe('getDiagramModel', () => {
    it('forwards getDiagramModel with the format', () => {
      let content: string | undefined;
      service.getDiagramModel('tm1', 'g1', 'yaml').subscribe(c => (content = c));
      expect(threatModelService.getDiagramModel).toHaveBeenCalledWith('tm1', 'g1', 'yaml');
      expect(content).toBe('MODEL');
    });
  });
});
