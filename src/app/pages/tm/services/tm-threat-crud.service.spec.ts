import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmThreatCrudService } from './tm-threat-crud.service';
import type { Threat } from '../models/threat-model.model';

describe('TmThreatCrudService', () => {
  let service: TmThreatCrudService;
  let threatModelService: {
    getThreatsForThreatModel: ReturnType<typeof vi.fn>;
    createThreat: ReturnType<typeof vi.fn>;
    updateThreat: ReturnType<typeof vi.fn>;
    deleteThreat: ReturnType<typeof vi.fn>;
    updateThreatMetadata: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    threatModelService = {
      getThreatsForThreatModel: vi.fn().mockReturnValue(of({ threats: [{ id: 't1' }], total: 1 })),
      createThreat: vi.fn().mockReturnValue(of({ id: 't9' })),
      updateThreat: vi.fn().mockReturnValue(of({ id: 't1', name: 'New' })),
      deleteThreat: vi.fn().mockReturnValue(of(true)),
      updateThreatMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v' }])),
    };
    service = new TmThreatCrudService(threatModelService as never);
  });

  describe('buildThreatListParams', () => {
    it('builds limit/offset only when there is no sort or filter', () => {
      const params = service.buildThreatListParams({
        pageIndex: 1,
        pageSize: 20,
        sortActive: '',
        sortDirection: '',
        filters: {
          name: '',
          severities: [],
          statuses: [],
          priorities: [],
          threatTypes: [],
          mitigated: null,
        },
      });
      expect(params).toEqual({ limit: 20, offset: 20 });
    });

    it('adds sort as "active:direction" and trims the name filter', () => {
      const params = service.buildThreatListParams({
        pageIndex: 0,
        pageSize: 10,
        sortActive: 'severity',
        sortDirection: 'desc',
        filters: {
          name: '  sql  ',
          severities: ['high'],
          statuses: [],
          priorities: [],
          threatTypes: [],
          mitigated: false,
        },
      });
      expect(params).toMatchObject({
        limit: 10,
        offset: 0,
        sort: 'severity:desc',
        name: 'sql',
        severity: ['high'],
        mitigated: false,
      });
    });
  });

  describe('loadThreats', () => {
    it('passes the built params to getThreatsForThreatModel', () => {
      service
        .loadThreats('tm1', {
          pageIndex: 0,
          pageSize: 20,
          sortActive: '',
          sortDirection: '',
          filters: {
            name: '',
            severities: [],
            statuses: [],
            priorities: [],
            threatTypes: [],
            mitigated: null,
          },
        })
        .subscribe();
      expect(threatModelService.getThreatsForThreatModel).toHaveBeenCalledWith('tm1', {
        limit: 20,
        offset: 0,
      });
    });

    it('emits threats and total, defaulting both when omitted', () => {
      threatModelService.getThreatsForThreatModel.mockReturnValue(of({}));
      let result: { threats: Threat[]; total: number } | undefined;
      service
        .loadThreats('tm1', {
          pageIndex: 0,
          pageSize: 20,
          sortActive: '',
          sortDirection: '',
          filters: {
            name: '',
            severities: [],
            statuses: [],
            priorities: [],
            threatTypes: [],
            mitigated: null,
          },
        })
        .subscribe(r => (result = r));
      expect(result).toEqual({ threats: [], total: 0 });
    });
  });

  describe('createThreat', () => {
    it('defaults severity/status/mitigated and copies defined optional fields', () => {
      service.createThreat('tm1', { name: 'N', score: 5 }).subscribe();
      expect(threatModelService.createThreat).toHaveBeenCalledWith('tm1', {
        name: 'N',
        description: undefined,
        severity: 'high',
        threat_type: [],
        mitigated: false,
        status: 'open',
        metadata: [],
        score: 5,
      });
    });
  });

  describe('updateThreat', () => {
    it('falls back to the existing threat severity/threat_type and emits the updated threat', () => {
      let updated: Threat | undefined;
      service
        .updateThreat(
          'tm1',
          { id: 't1', severity: 'low', threat_type: ['Spoofing'] } as never,
          { name: 'New' },
        )
        .subscribe(t => (updated = t));
      expect(threatModelService.updateThreat).toHaveBeenCalledWith('tm1', 't1', {
        name: 'New',
        description: undefined,
        severity: 'low',
        threat_type: ['Spoofing'],
      });
      expect(updated).toEqual({ id: 't1', name: 'New' });
    });
  });

  describe('deleteThreat', () => {
    it('calls deleteThreat and emits the success boolean', () => {
      let ok: boolean | undefined;
      service.deleteThreat('tm1', 't1').subscribe(v => (ok = v));
      expect(threatModelService.deleteThreat).toHaveBeenCalledWith('tm1', 't1');
      expect(ok).toBe(true);
    });
  });

  describe('updateThreatMetadata', () => {
    it('forwards updateThreatMetadata', () => {
      let meta: unknown;
      service.updateThreatMetadata('tm1', 't1', []).subscribe(m => (meta = m));
      expect(threatModelService.updateThreatMetadata).toHaveBeenCalledWith('tm1', 't1', []);
      expect(meta).toEqual([{ key: 'k', value: 'v' }]);
    });
  });
});
