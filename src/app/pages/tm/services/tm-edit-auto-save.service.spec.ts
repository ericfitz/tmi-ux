import '@angular/compiler';

import { describe, it, expect, beforeEach } from 'vitest';

import { TmEditAutoSaveService, ThreatModelFormValues } from './tm-edit-auto-save.service';

describe('TmEditAutoSaveService', () => {
  let service: TmEditAutoSaveService;

  const baseline: ThreatModelFormValues = {
    name: 'TM',
    description: 'desc',
    threat_model_framework: 'STRIDE',
    issue_uri: '',
    status: null,
  };

  beforeEach(() => {
    service = new TmEditAutoSaveService({ warn: () => {} } as never);
  });

  describe('hasFormChanged', () => {
    it('returns false when there are no original values', () => {
      expect(service.hasFormChanged(baseline, undefined)).toBe(false);
    });
    it('returns false when current equals original', () => {
      expect(service.hasFormChanged({ ...baseline }, baseline)).toBe(false);
    });
    it('returns true when name changes', () => {
      expect(service.hasFormChanged({ ...baseline, name: 'New' }, baseline)).toBe(true);
    });
    it('returns true when description changes', () => {
      expect(service.hasFormChanged({ ...baseline, description: 'x' }, baseline)).toBe(true);
    });
    it('returns true when framework changes', () => {
      expect(
        service.hasFormChanged({ ...baseline, threat_model_framework: 'LINDDUN' }, baseline),
      ).toBe(true);
    });
    it('returns true when issue_uri changes', () => {
      expect(service.hasFormChanged({ ...baseline, issue_uri: 'http://x' }, baseline)).toBe(true);
    });
    it('treats undefined and null status as equal', () => {
      expect(service.hasFormChanged({ ...baseline, status: undefined }, baseline)).toBe(false);
    });
    it('returns true when status changes from null to a value', () => {
      expect(service.hasFormChanged({ ...baseline, status: 'active' }, baseline)).toBe(true);
    });
  });

  describe('buildUpdates', () => {
    it('returns an empty object when nothing changed', () => {
      expect(service.buildUpdates({ ...baseline }, baseline)).toEqual({});
    });
    it('includes only the changed name field', () => {
      expect(service.buildUpdates({ ...baseline, name: 'New' }, baseline)).toEqual({ name: 'New' });
    });
    it('includes multiple changed fields', () => {
      const updates = service.buildUpdates(
        { ...baseline, name: 'New', issue_uri: 'http://x' },
        baseline,
      );
      expect(updates).toEqual({ name: 'New', issue_uri: 'http://x' });
    });
    it('includes a status change', () => {
      expect(service.buildUpdates({ ...baseline, status: 'active' }, baseline)).toEqual({
        status: 'active',
      });
    });
    it('strips an authorization field if one is somehow present', () => {
      const current = { ...baseline, name: 'New' } as ThreatModelFormValues &
        Record<string, unknown>;
      current['authorization'] = [{}];
      const updates = service.buildUpdates(current, baseline) as Record<string, unknown>;
      expect('authorization' in updates).toBe(false);
      expect(updates['name']).toBe('New');
    });
    it('strips an owner field if one is somehow present', () => {
      const current = { ...baseline, name: 'New' } as ThreatModelFormValues &
        Record<string, unknown>;
      current['owner'] = 'someone';
      const updates = service.buildUpdates(current, baseline) as Record<string, unknown>;
      expect('owner' in updates).toBe(false);
    });
  });
});
