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
});
