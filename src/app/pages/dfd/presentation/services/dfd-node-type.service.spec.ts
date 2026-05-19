import { describe, it, expect, beforeEach } from 'vitest';
import { DfdNodeTypeService } from './dfd-node-type.service';

describe('DfdNodeTypeService', () => {
  let service: DfdNodeTypeService;

  beforeEach(() => {
    service = new DfdNodeTypeService();
  });

  describe('mapStringToNodeType', () => {
    it.each(['actor', 'process', 'store', 'security-boundary', 'text-box'] as const)(
      'maps %s to itself',
      value => {
        expect(service.mapStringToNodeType(value)).toBe(value);
      },
    );

    it('maps an unknown string to process', () => {
      expect(service.mapStringToNodeType('not-a-shape')).toBe('process');
    });
  });

  describe('getCellDataAssets', () => {
    it('returns the data_assets array when present', () => {
      const cell = { getData: () => ({ data_assets: ['a', 'b'] }) } as any;
      expect(service.getCellDataAssets(cell)).toEqual(['a', 'b']);
    });

    it('returns the legacy dataAssetId as a single-element array', () => {
      const cell = { getData: () => ({ dataAssetId: 'legacy' }) } as any;
      expect(service.getCellDataAssets(cell)).toEqual(['legacy']);
    });

    it('returns an empty array when the cell has no asset data', () => {
      const cell = { getData: () => ({}) } as any;
      expect(service.getCellDataAssets(cell)).toEqual([]);
    });

    it('prefers data_assets over the legacy dataAssetId when both are present', () => {
      const cell = { getData: () => ({ data_assets: ['new'], dataAssetId: 'old' }) } as any;
      expect(service.getCellDataAssets(cell)).toEqual(['new']);
    });
  });

  describe('setCellDataAssets', () => {
    it('writes data_assets and strips the legacy key when ids are non-empty', () => {
      let written: Record<string, unknown> | undefined;
      const cell = {
        getData: () => ({ dataAssetId: 'legacy', other: 1 }),
        setData: (d: Record<string, unknown>) => {
          written = d;
        },
      } as any;
      service.setCellDataAssets(cell, ['x']);
      expect(written).toEqual({ other: 1, data_assets: ['x'] });
    });

    it('removes data_assets when the id list is empty', () => {
      let written: Record<string, unknown> | undefined;
      const cell = {
        getData: () => ({ data_assets: ['x'], other: 1 }),
        setData: (d: Record<string, unknown>) => {
          written = d;
        },
      } as any;
      service.setCellDataAssets(cell, []);
      expect(written).toEqual({ other: 1 });
    });
  });

  describe('isDataAssetChecked', () => {
    it('is false when the map is empty', () => {
      expect(service.isDataAssetChecked(new Map(), 'a')).toBe(false);
    });

    it('is true only when every cell set contains the asset', () => {
      const map = new Map([
        ['c1', new Set(['a', 'b'])],
        ['c2', new Set(['a'])],
      ]);
      expect(service.isDataAssetChecked(map, 'a')).toBe(true);
      expect(service.isDataAssetChecked(map, 'b')).toBe(false);
    });

    it('is true when a single cell contains the asset', () => {
      expect(service.isDataAssetChecked(new Map([['c1', new Set(['a'])]]), 'a')).toBe(true);
    });
  });

  describe('isDataAssetIndeterminate', () => {
    it('is false when one or zero cells are selected', () => {
      expect(service.isDataAssetIndeterminate(new Map([['c1', new Set(['a'])]]), 'a')).toBe(false);
    });

    it('is false when one cell is selected but does not have the asset', () => {
      expect(service.isDataAssetIndeterminate(new Map([['c1', new Set<string>()]]), 'a')).toBe(
        false,
      );
    });

    it('is true when some but not all cell sets contain the asset', () => {
      const map = new Map([
        ['c1', new Set(['a'])],
        ['c2', new Set<string>()],
      ]);
      expect(service.isDataAssetIndeterminate(map, 'a')).toBe(true);
    });

    it('is false when every cell set contains the asset', () => {
      const map = new Map([
        ['c1', new Set(['a'])],
        ['c2', new Set(['a'])],
      ]);
      expect(service.isDataAssetIndeterminate(map, 'a')).toBe(false);
    });
  });
});
