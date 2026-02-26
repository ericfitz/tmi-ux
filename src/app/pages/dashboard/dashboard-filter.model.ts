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

/** Factory for a default (empty) filter state */
export function createDefaultFilters(): DashboardFilters {
  return {
    name: '',
    description: '',
    owner: '',
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

/** Check whether any server-side filters are active */
export function hasActiveFilters(filters: DashboardFilters): boolean {
  return (
    filters.name.trim() !== '' ||
    filters.description.trim() !== '' ||
    filters.owner.trim() !== '' ||
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

/** Check whether any advanced (non-primary) filters are active */
export function hasAdvancedFilters(filters: DashboardFilters): boolean {
  return (
    filters.description.trim() !== '' ||
    filters.owner.trim() !== '' ||
    filters.issueUri.trim() !== '' ||
    filters.createdAfter !== null ||
    filters.createdBefore !== null ||
    filters.modifiedAfter !== null ||
    filters.modifiedBefore !== null ||
    filters.statusUpdatedAfter !== null ||
    filters.statusUpdatedBefore !== null
  );
}
