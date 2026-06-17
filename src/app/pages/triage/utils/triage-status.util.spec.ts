import { describe, it, expect } from 'vitest';
import { ResponseStatus } from '@app/types/survey.types';
import { getStatusClass, getStatusKey } from './triage-status.util';

describe('triage-status.util', () => {
  describe('getStatusKey', () => {
    it('maps each status to its camelCase i18n key', () => {
      const cases: [ResponseStatus, string][] = [
        ['draft', 'draft'],
        ['submitted', 'submitted'],
        ['needs_revision', 'needsRevision'],
        ['ready_for_review', 'readyForReview'],
        ['review_created', 'reviewCreated'],
      ];
      for (const [status, key] of cases) {
        expect(getStatusKey(status)).toBe(key);
      }
    });

    it('returns the original status when unmapped', () => {
      expect(getStatusKey('unknown' as ResponseStatus)).toBe('unknown');
    });
  });

  describe('getStatusClass', () => {
    it('maps each status to its chip CSS class', () => {
      const cases: [ResponseStatus, string][] = [
        ['draft', 'status-draft'],
        ['submitted', 'status-submitted'],
        ['needs_revision', 'status-needs-revision'],
        ['ready_for_review', 'status-ready-for-review'],
        ['review_created', 'status-review-created'],
      ];
      for (const [status, cssClass] of cases) {
        expect(getStatusClass(status)).toBe(cssClass);
      }
    });

    it('returns an empty string when unmapped', () => {
      expect(getStatusClass('unknown' as ResponseStatus)).toBe('');
    });
  });
});
