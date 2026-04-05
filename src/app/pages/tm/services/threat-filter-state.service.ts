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
export class ThreatFilterStateService {
  private state: ThreatCardState | null = null;

  /**
   * Retrieve stored state if it matches the given threat model ID.
   * Returns null if no state is stored or the ID doesn't match.
   */
  getState(threatModelId: string): ThreatCardState | null {
    if (this.state && this.state.threatModelId === threatModelId) {
      return this.state;
    }
    return null;
  }

  /** Save the current threat card state */
  saveState(state: ThreatCardState): void {
    this.state = { ...state, filters: { ...state.filters } };
  }

  /** Clear all stored state */
  clear(): void {
    this.state = null;
  }

  /** Create a default state for a given threat model ID and page size */
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
