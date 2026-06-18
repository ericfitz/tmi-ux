/**
 * Triage status utilities.
 *
 * Pure helpers for mapping a survey {@link ResponseStatus} to its
 * camelCase i18n key and its status-chip CSS class. Shared by the
 * triage list and triage detail components.
 */

import { ResponseStatus } from '@app/types/survey.types';

/**
 * Convert a snake_case {@link ResponseStatus} to its camelCase i18n key.
 *
 * @param status - The response status to map
 * @returns The camelCase i18n key, or the original status if unmapped
 */
// SEM@28965fbbc1cc05c2313c3368f6409ec77d7ae535: convert a survey response status to its camelCase i18n key (pure)
export function getStatusKey(status: ResponseStatus): string {
  const keyMap: Record<ResponseStatus, string> = {
    draft: 'draft',
    submitted: 'submitted',
    needs_revision: 'needsRevision',
    ready_for_review: 'readyForReview',
    review_created: 'reviewCreated',
  };
  return keyMap[status] ?? status;
}

/**
 * Get the status-chip CSS class for a {@link ResponseStatus}.
 *
 * @param status - The response status to map
 * @returns The CSS class name, or an empty string if unmapped
 */
// SEM@28965fbbc1cc05c2313c3368f6409ec77d7ae535: map a survey response status to its status-chip CSS class name (pure)
export function getStatusClass(status: ResponseStatus): string {
  const statusClasses: Record<ResponseStatus, string> = {
    draft: 'status-draft',
    submitted: 'status-submitted',
    needs_revision: 'status-needs-revision',
    ready_for_review: 'status-ready-for-review',
    review_created: 'status-review-created',
  };
  return statusClasses[status] ?? '';
}
