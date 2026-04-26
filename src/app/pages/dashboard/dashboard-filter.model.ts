/**
 * Filter state for the dashboard threat model list.
 * Each field maps to a query parameter on GET /threat_models.
 */
export interface DashboardFilters {
  /** Name filter — partial match via API */
  name: string;

  /** Description filter — partial match via API */
  description: string;

  /** Owner name/email filter — partial match via API */
  owner: string;

  /** Security reviewer name/email filter — partial match via API */
  securityReviewer: string;

  /** Status filter — multi-select, sent as comma-separated values */
  statuses: string[];

  /** Issue URI filter — partial match via API */
  issueUri: string;

  /** Created date range */
  createdAfter: string | null;
  createdBefore: string | null;

  /** Modified date range */
  modifiedAfter: string | null;
  modifiedBefore: string | null;

  /** Status updated date range */
  statusUpdatedAfter: string | null;
  statusUpdatedBefore: string | null;
}

/**
 * Canonical ordered list of threat-model status keys.
 * Matches `getFieldKeysForFieldType('threatModels.status')` in field-value-helpers.ts.
 */
export const ALL_TM_STATUSES: readonly string[] = [
  'not_started',
  'active',
  'in_progress',
  'pending_review',
  'remediation_required',
  'remediation_in_progress',
  'verification_pending',
  'approved',
  'rejected',
  'deferred',
  'closed',
];

/**
 * Non-terminal threat-model statuses — used as the default status filter
 * on fresh dashboard visits. Excludes `rejected`, `deferred`, and `closed`.
 * `active` is included because seeded and server-default TMs sometimes use
 * it instead of `in_progress`; the server treats `status` as a free-form
 * string so we include common synonyms.
 */
export const NON_TERMINAL_TM_STATUSES: readonly string[] = [
  'not_started',
  'active',
  'in_progress',
  'pending_review',
  'remediation_required',
  'remediation_in_progress',
  'verification_pending',
  'approved',
];

/** Factory for a default (empty) filter state */
export function createDefaultFilters(): DashboardFilters {
  return {
    name: '',
    description: '',
    owner: '',
    securityReviewer: '',
    statuses: [],
    issueUri: '',
    createdAfter: null,
    createdBefore: null,
    modifiedAfter: null,
    modifiedBefore: null,
    statusUpdatedAfter: null,
    statusUpdatedBefore: null,
  };
}

/**
 * Compute the role-based default filters applied on a fresh dashboard visit.
 *
 * Rules:
 * - Non-reviewer: status in {non-terminal}, owner = userEmail
 * - Security reviewer: status in {non-terminal}, security_reviewer = userEmail
 *
 * Both cases use the same non-terminal status set; only the identity field differs.
 *
 * @param userEmail Current user's email (partial-match key for owner/reviewer filter)
 * @param isSecurityReviewer Whether the current user is a security reviewer
 */
export function computeDefaultFilters(
  userEmail: string,
  isSecurityReviewer: boolean,
): DashboardFilters {
  const base = createDefaultFilters();
  base.statuses = [...NON_TERMINAL_TM_STATUSES];
  if (isSecurityReviewer) {
    base.securityReviewer = userEmail;
  } else {
    base.owner = userEmail;
  }
  return base;
}

/** Check whether any server-side filters are active */
export function hasActiveFilters(filters: DashboardFilters): boolean {
  return (
    filters.name.trim() !== '' ||
    filters.description.trim() !== '' ||
    filters.owner.trim() !== '' ||
    filters.securityReviewer.trim() !== '' ||
    filters.statuses.length > 0 ||
    filters.issueUri.trim() !== '' ||
    filters.createdAfter !== null ||
    filters.createdBefore !== null ||
    filters.modifiedAfter !== null ||
    filters.modifiedBefore !== null ||
    filters.statusUpdatedAfter !== null ||
    filters.statusUpdatedBefore !== null
  );
}

/**
 * Check whether any advanced (non-primary) filters are active.
 *
 * Primary fields depend on user role:
 * - Non-reviewer: status + owner are primary; securityReviewer is advanced
 * - Security reviewer: status + securityReviewer are primary; owner is advanced
 *
 * `name` is always advanced (moved from primary in #640 — less frequently used).
 */
export function hasAdvancedFilters(
  filters: DashboardFilters,
  isSecurityReviewer: boolean,
): boolean {
  const offRoleIdentitySet = isSecurityReviewer
    ? filters.owner.trim() !== ''
    : filters.securityReviewer.trim() !== '';
  return (
    filters.name.trim() !== '' ||
    filters.description.trim() !== '' ||
    offRoleIdentitySet ||
    filters.issueUri.trim() !== '' ||
    filters.createdAfter !== null ||
    filters.createdBefore !== null ||
    filters.modifiedAfter !== null ||
    filters.modifiedBefore !== null ||
    filters.statusUpdatedAfter !== null ||
    filters.statusUpdatedBefore !== null
  );
}
