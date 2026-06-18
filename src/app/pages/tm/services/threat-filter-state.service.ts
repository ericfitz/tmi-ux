import { Injectable } from '@angular/core';
import { ThreatFilters, createDefaultThreatFilters } from '../models/threat-filter.model';

/**
 * Persisted state for the threats card filter, sort, and pagination.
 * Survives navigation to/from the threat editor page within the same
 * threat model session. Cleared when a different threat model is opened.
 */
interface ThreatCardState {
  threatModelId: string;
  filters: ThreatFilters;
  sortActive: string;
  sortDirection: 'asc' | 'desc' | '';
  pageIndex: number;
  pageSize: number;
  showAdvancedFilters: boolean;
}

/**
 * In-memory service that stores threat card filter/sort/pagination state
 * so it persists across navigation within a threat model session
 * (e.g., when opening a threat editor and returning).
 *
 * State is discarded when a different threat model is loaded or
 * when the user navigates to the dashboard (page refresh also clears it).
 */
@Injectable({ providedIn: 'root' })
// SEM@6e22d874fca2906477bada6894288c7d35ac6298: store and retrieve threat card filter, sort, and pagination state across navigation (mutates shared state)
export class ThreatFilterStateService {
  private state: ThreatCardState | null = null;

  /**
   * Retrieve stored state if it matches the given threat model ID.
   * Returns null if no state is stored or the ID doesn't match.
   */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: fetch stored threat card state if it matches the given threat model ID (pure)
  getState(threatModelId: string): ThreatCardState | null {
    if (this.state && this.state.threatModelId === threatModelId) {
      return this.state;
    }
    return null;
  }

  /** Save the current threat card state */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: store the current threat card filter and pagination state (mutates shared state)
  saveState(state: ThreatCardState): void {
    this.state = { ...state, filters: { ...state.filters } };
  }

  /** Clear all stored state */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: discard all stored threat card filter state (mutates shared state)
  clear(): void {
    this.state = null;
  }

  /** Create a default state for a given threat model ID and page size */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: build a default threat card state for a given threat model and page size (pure)
  static createDefault(threatModelId: string, defaultPageSize: number): ThreatCardState {
    return {
      threatModelId,
      filters: createDefaultThreatFilters(),
      sortActive: 'severity',
      sortDirection: 'asc',
      pageIndex: 0,
      pageSize: defaultPageSize,
      showAdvancedFilters: false,
    };
  }
}
