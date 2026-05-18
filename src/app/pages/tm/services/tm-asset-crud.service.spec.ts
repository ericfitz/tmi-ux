import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmAssetCrudService } from './tm-asset-crud.service';
import type { Asset } from '../models/threat-model.model';

describe('TmAssetCrudService', () => {
  let service: TmAssetCrudService;
  let threatModelService: {
    getAssetsForThreatModel: ReturnType<typeof vi.fn>;
    createAsset: ReturnType<typeof vi.fn>;
    updateAsset: ReturnType<typeof vi.fn>;
    deleteAsset: ReturnType<typeof vi.fn>;
    updateAssetMetadata: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    threatModelService = {
      getAssetsForThreatModel: vi.fn().mockReturnValue(of({ assets: [{ id: 'a1' }], total: 1 })),
      createAsset: vi.fn().mockReturnValue(of({ id: 'a9' })),
      updateAsset: vi.fn().mockReturnValue(of({ id: 'a1', name: 'New' })),
      deleteAsset: vi.fn().mockReturnValue(of(true)),
      updateAssetMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v' }])),
    };
    service = new TmAssetCrudService(threatModelService as never);
  });

  describe('loadAssets', () => {
    it('calls getAssetsForThreatModel with the computed offset', () => {
      service.loadAssets('tm1', 2, 10).subscribe();
      expect(threatModelService.getAssetsForThreatModel).toHaveBeenCalledWith('tm1', 10, 20);
    });
    it('emits assets and total, defaulting both when omitted', () => {
      threatModelService.getAssetsForThreatModel.mockReturnValue(of({}));
      let result: { assets: Asset[]; total: number } | undefined;
      service.loadAssets('tm1', 0, 20).subscribe(r => (result = r));
      expect(result).toEqual({ assets: [], total: 0 });
    });
  });

  describe('createAsset / updateAsset / deleteAsset', () => {
    it('createAsset forwards the asset', () => {
      const asset = { name: 'A' } as never;
      service.createAsset('tm1', asset).subscribe();
      expect(threatModelService.createAsset).toHaveBeenCalledWith('tm1', asset);
    });
    it('updateAsset forwards id and asset, emits the updated asset', () => {
      let updated: Asset | undefined;
      service.updateAsset('tm1', 'a1', { name: 'New' }).subscribe(a => (updated = a));
      expect(threatModelService.updateAsset).toHaveBeenCalledWith('tm1', 'a1', { name: 'New' });
      expect(updated).toEqual({ id: 'a1', name: 'New' });
    });
    it('deleteAsset emits the success boolean', () => {
      let ok: boolean | undefined;
      service.deleteAsset('tm1', 'a1').subscribe(v => (ok = v));
      expect(threatModelService.deleteAsset).toHaveBeenCalledWith('tm1', 'a1');
      expect(ok).toBe(true);
    });
  });

  describe('updateAssetMetadata', () => {
    it('forwards updateAssetMetadata', () => {
      let meta: unknown;
      service.updateAssetMetadata('tm1', 'a1', []).subscribe(m => (meta = m));
      expect(threatModelService.updateAssetMetadata).toHaveBeenCalledWith('tm1', 'a1', []);
      expect(meta).toEqual([{ key: 'k', value: 'v' }]);
    });
  });
});
