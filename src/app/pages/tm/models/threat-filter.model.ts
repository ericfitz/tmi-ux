/**
 * Filter state for the threats card on the tm-edit page.
 * Follows the same pattern as DashboardFilters in dashboard-filter.model.ts.
 */
export interface ThreatFilters {
  /** Name filter — partial match via API */
  name: string;

  /** Status filter — multi-select, sent as repeated query params */
  statuses: string[];

  /** Severity filter — multi-select, sent as repeated query params */
  severities: string[];

  /** Mitigated filter — true/false/null (null = no filter) */
  mitigated: boolean | null;

  /** Threat type filter — multi-select, sent as repeated query params */
  threatTypes: string[];

  /** Priority filter — multi-select, sent as repeated query params */
  priorities: string[];
}

/** Creates a default (empty) ThreatFilters object */
export function createDefaultThreatFilters(): ThreatFilters {
  return {
    name: '',
    statuses: [],
    severities: [],
    mitigated: null,
    threatTypes: [],
    priorities: [],
  };
}

/**
 * Returns true if any primary (non-advanced) server-side filter is active
 * @public
 */
export function hasActiveThreatFilters(filters: ThreatFilters): boolean {
  return (
    filters.name.trim() !== '' ||
    filters.statuses.length > 0 ||
    filters.severities.length > 0 ||
    filters.mitigated !== null
  );
}

/** Returns true if any advanced filter is active */
export function hasAdvancedThreatFilters(filters: ThreatFilters): boolean {
  return filters.threatTypes.length > 0 || filters.priorities.length > 0;
}

/** Returns true if any filter (primary or advanced) is active */
export function hasAnyThreatFilters(filters: ThreatFilters): boolean {
  return hasActiveThreatFilters(filters) || hasAdvancedThreatFilters(filters);
}
