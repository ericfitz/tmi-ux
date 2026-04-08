import { describe, it, expect } from 'vitest';

import {
  SsvcExploitation,
  getSupplierDecision,
  buildSsvcVector,
  parseSsvcVector,
  SSVC_DECISION_POINTS,
} from './ssvc-decision-tree';

describe('ssvc-decision-tree', () => {
  describe('getSupplierDecision', () => {
    it('should return Defer for None/Laborious/Partial/Minimal', () => {
      expect(getSupplierDecision('N', 'L', 'P', 'M')).toBe('Defer');
    });

    it('should return Scheduled for None/Laborious/Partial/Significant', () => {
      expect(getSupplierDecision('N', 'L', 'P', 'S')).toBe('Scheduled');
    });

    it('should return Out-of-Cycle for None/Laborious/Total/Significant', () => {
      expect(getSupplierDecision('N', 'L', 'T', 'S')).toBe('Out-of-Cycle');
    });

    it('should return Immediate for Active/Super Effective/Total/Significant', () => {
      expect(getSupplierDecision('A', 'S', 'T', 'S')).toBe('Immediate');
    });

    it('should return Immediate for Active/Super Effective/Partial/Minimal', () => {
      expect(getSupplierDecision('A', 'S', 'P', 'M')).toBe('Immediate');
    });

    it('should return Out-of-Cycle for Active/Laborious/Partial/Minimal', () => {
      expect(getSupplierDecision('A', 'L', 'P', 'M')).toBe('Out-of-Cycle');
    });

    it('should return Immediate for PoC/Efficient/Total/Significant', () => {
      expect(getSupplierDecision('P', 'E', 'T', 'S')).toBe('Immediate');
    });

    it('should return Scheduled for PoC/Laborious/Partial/Minimal', () => {
      expect(getSupplierDecision('P', 'L', 'P', 'M')).toBe('Scheduled');
    });

    it('should return null for invalid inputs', () => {
      expect(getSupplierDecision('X' as SsvcExploitation, 'L', 'P', 'M')).toBeNull();
    });
  });

  describe('buildSsvcVector', () => {
    it('should build a valid vector string with date', () => {
      const vector = buildSsvcVector('A', 'S', 'T', 'S');
      expect(vector).toMatch(/^SSVCv2\/E:A\/U:S\/T:T\/P:S\/\d{4}-\d{2}-\d{2}\/$/);
    });

    it('should use provided date', () => {
      const vector = buildSsvcVector('N', 'L', 'P', 'M', '2026-04-08');
      expect(vector).toBe('SSVCv2/E:N/U:L/T:P/P:M/2026-04-08/');
    });
  });

  describe('parseSsvcVector', () => {
    it('should parse a valid vector string', () => {
      const result = parseSsvcVector('SSVCv2/E:A/U:S/T:T/P:S/2026-04-08/');
      expect(result).toEqual({
        exploitation: 'A',
        utility: 'S',
        technicalImpact: 'T',
        publicSafetyImpact: 'S',
        date: '2026-04-08',
      });
    });

    it('should return null for invalid vector string', () => {
      expect(parseSsvcVector('invalid')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseSsvcVector('')).toBeNull();
    });

    it('should return null for wrong version prefix', () => {
      expect(parseSsvcVector('SSVCv1/E:A/U:S/T:T/P:S/2026-04-08/')).toBeNull();
    });

    it('should return null for invalid decision point values', () => {
      expect(parseSsvcVector('SSVCv2/E:X/U:S/T:T/P:S/2026-04-08/')).toBeNull();
    });
  });

  describe('SSVC_DECISION_POINTS', () => {
    it('should have 4 decision points', () => {
      expect(SSVC_DECISION_POINTS).toHaveLength(4);
    });

    it('should have exploitation with 3 values', () => {
      const exploitation = SSVC_DECISION_POINTS[0];
      expect(exploitation.key).toBe('exploitation');
      expect(exploitation.values).toHaveLength(3);
    });

    it('should have technicalImpact with 2 values', () => {
      const ti = SSVC_DECISION_POINTS[2];
      expect(ti.key).toBe('technicalImpact');
      expect(ti.values).toHaveLength(2);
    });
  });
});
