import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmRepositoryCrudService } from './tm-repository-crud.service';
import type { Repository } from '../models/threat-model.model';

describe('TmRepositoryCrudService', () => {
  let service: TmRepositoryCrudService;
  let threatModelService: {
    getRepositoriesForThreatModel: ReturnType<typeof vi.fn>;
    createRepository: ReturnType<typeof vi.fn>;
    updateRepository: ReturnType<typeof vi.fn>;
    deleteRepository: ReturnType<typeof vi.fn>;
    updateRepositoryMetadata: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    threatModelService = {
      getRepositoriesForThreatModel: vi
        .fn()
        .mockReturnValue(of({ repositories: [{ id: 'r1' }], total: 1 })),
      createRepository: vi.fn().mockReturnValue(of({ id: 'r9' })),
      updateRepository: vi.fn().mockReturnValue(of({ id: 'r1', name: 'New' })),
      deleteRepository: vi.fn().mockReturnValue(of(true)),
      updateRepositoryMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v' }])),
    };
    service = new TmRepositoryCrudService(threatModelService as never);
  });

  describe('buildRepositoryData', () => {
    it('maps form values and coerces empty description to undefined', () => {
      const data = service.buildRepositoryData({
        name: 'N',
        description: '',
        type: 'git',
        uri: 'U',
        include_in_report: true,
      } as never);
      expect(data).toEqual({
        name: 'N',
        description: undefined,
        type: 'git',
        uri: 'U',
        parameters: undefined,
        include_in_report: true,
      });
    });
  });

  describe('loadRepositories', () => {
    it('calls getRepositoriesForThreatModel with the computed offset', () => {
      service.loadRepositories('tm1', 2, 10).subscribe();
      expect(threatModelService.getRepositoriesForThreatModel).toHaveBeenCalledWith('tm1', 10, 20);
    });
    it('emits repositories and total, defaulting both when omitted', () => {
      threatModelService.getRepositoriesForThreatModel.mockReturnValue(of({}));
      let result: { repositories: Repository[]; total: number } | undefined;
      service.loadRepositories('tm1', 0, 20).subscribe(r => (result = r));
      expect(result).toEqual({ repositories: [], total: 0 });
    });
  });

  describe('createRepository / updateRepository / deleteRepository', () => {
    it('createRepository calls createRepository with the built data', () => {
      service.createRepository('tm1', { name: 'N', type: 'git', uri: 'U' } as never).subscribe();
      expect(threatModelService.createRepository).toHaveBeenCalledTimes(1);
    });
    it('updateRepository calls updateRepository with id and built data', () => {
      let updated: Repository | undefined;
      service
        .updateRepository('tm1', 'r1', { name: 'New', type: 'git', uri: 'U' } as never)
        .subscribe(r => (updated = r));
      expect(threatModelService.updateRepository).toHaveBeenCalledWith(
        'tm1',
        'r1',
        expect.objectContaining({ name: 'New' }),
      );
      expect(updated).toEqual({ id: 'r1', name: 'New' });
    });
    it('deleteRepository emits the success boolean', () => {
      let ok: boolean | undefined;
      service.deleteRepository('tm1', 'r1').subscribe(v => (ok = v));
      expect(threatModelService.deleteRepository).toHaveBeenCalledWith('tm1', 'r1');
      expect(ok).toBe(true);
    });
  });

  describe('updateRepositoryMetadata', () => {
    it('forwards updateRepositoryMetadata', () => {
      let meta: unknown;
      service.updateRepositoryMetadata('tm1', 'r1', []).subscribe(m => (meta = m));
      expect(threatModelService.updateRepositoryMetadata).toHaveBeenCalledWith('tm1', 'r1', []);
      expect(meta).toEqual([{ key: 'k', value: 'v' }]);
    });
  });
});
