import { describe, expect, it } from 'vitest';

import {
  NON_TERMINAL_TM_STATUSES,
  computeDefaultFilters,
  createDefaultFilters,
  hasActiveFilters,
  hasAdvancedFilters,
} from './dashboard-filter.model';

describe('dashboard-filter.model', () => {
  describe('createDefaultFilters', () => {
    it('returns all-empty state', () => {
      const f = createDefaultFilters();
      expect(f.name).toBe('');
      expect(f.description).toBe('');
      expect(f.owner).toBe('');
      expect(f.securityReviewer).toBe('');
      expect(f.issueUri).toBe('');
      expect(f.statuses).toEqual([]);
      expect(f.createdAfter).toBeNull();
      expect(f.createdBefore).toBeNull();
      expect(f.modifiedAfter).toBeNull();
      expect(f.modifiedBefore).toBeNull();
      expect(f.statusUpdatedAfter).toBeNull();
      expect(f.statusUpdatedBefore).toBeNull();
    });
  });

  describe('NON_TERMINAL_TM_STATUSES', () => {
    it('excludes terminal states (rejected, deferred, closed)', () => {
      expect(NON_TERMINAL_TM_STATUSES).not.toContain('rejected');
      expect(NON_TERMINAL_TM_STATUSES).not.toContain('deferred');
      expect(NON_TERMINAL_TM_STATUSES).not.toContain('closed');
    });

    it('includes all non-terminal statuses in canonical order', () => {
      expect(NON_TERMINAL_TM_STATUSES).toEqual([
        'not_started',
        'active',
        'in_progress',
        'pending_review',
        'remediation_required',
        'remediation_in_progress',
        'verification_pending',
        'approved',
      ]);
    });
  });

  describe('computeDefaultFilters', () => {
    it('sets owner=email for non-reviewer and leaves securityReviewer empty', () => {
      const f = computeDefaultFilters('user@example.com', false);
      expect(f.owner).toBe('user@example.com');
      expect(f.securityReviewer).toBe('');
      expect(f.statuses).toEqual([...NON_TERMINAL_TM_STATUSES]);
    });

    it('sets securityReviewer=email for security reviewer and leaves owner empty', () => {
      const f = computeDefaultFilters('reviewer@example.com', true);
      expect(f.owner).toBe('');
      expect(f.securityReviewer).toBe('reviewer@example.com');
      expect(f.statuses).toEqual([...NON_TERMINAL_TM_STATUSES]);
    });

    it('returns a fresh statuses array (not a shared reference to the constant)', () => {
      const f = computeDefaultFilters('user@example.com', false);
      f.statuses.push('tampered');
      expect(NON_TERMINAL_TM_STATUSES).not.toContain('tampered');
    });

    it('leaves all non-identity, non-status fields empty', () => {
      const f = computeDefaultFilters('user@example.com', false);
      expect(f.name).toBe('');
      expect(f.description).toBe('');
      expect(f.issueUri).toBe('');
      expect(f.createdAfter).toBeNull();
      expect(f.createdBefore).toBeNull();
      expect(f.modifiedAfter).toBeNull();
      expect(f.modifiedBefore).toBeNull();
      expect(f.statusUpdatedAfter).toBeNull();
      expect(f.statusUpdatedBefore).toBeNull();
    });
  });

  describe('hasActiveFilters', () => {
    it('returns false for defaults', () => {
      expect(hasActiveFilters(createDefaultFilters())).toBe(false);
    });

    it('returns true when securityReviewer is set', () => {
      const f = createDefaultFilters();
      f.securityReviewer = 'x@y.z';
      expect(hasActiveFilters(f)).toBe(true);
    });

    it('returns true when statuses is non-empty', () => {
      const f = createDefaultFilters();
      f.statuses = ['open'];
      expect(hasActiveFilters(f)).toBe(true);
    });
  });

  describe('hasAdvancedFilters', () => {
    it('returns false for defaults', () => {
      expect(hasAdvancedFilters(createDefaultFilters())).toBe(false);
    });

    it('returns false when only primary (name/status) filters are set', () => {
      const f = createDefaultFilters();
      f.name = 'foo';
      f.statuses = ['in_progress'];
      expect(hasAdvancedFilters(f)).toBe(false);
    });

    it('returns true when securityReviewer is set', () => {
      const f = createDefaultFilters();
      f.securityReviewer = 'x@y.z';
      expect(hasAdvancedFilters(f)).toBe(true);
    });

    it('returns true when owner is set', () => {
      const f = createDefaultFilters();
      f.owner = 'x@y.z';
      expect(hasAdvancedFilters(f)).toBe(true);
    });
  });
});
