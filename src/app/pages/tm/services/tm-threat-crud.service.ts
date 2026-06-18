import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import type { components } from '@app/generated/api-types';

import { ThreatModelService, ThreatListParams } from './threat-model.service';
import { Threat, Metadata } from '../models/threat-model.model';
import { ThreatFilters } from '../models/threat-filter.model';

// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: type alias for the API threat input schema (pure)
type ApiThreatInput = components['schemas']['ThreatInput'];

/** Threats loaded for one page of the threats sub-table. */
export interface ThreatsPage {
  threats: Threat[];
  total: number;
}

/** Server-side query state for the threats list (page + sort + filters). */
export interface ThreatQueryState {
  pageIndex: number;
  pageSize: number;
  sortActive: string;
  sortDirection: 'asc' | 'desc' | '';
  filters: ThreatFilters;
}

/**
 * Threat CRUD orchestration extracted from TmEditComponent. Owns the
 * ThreatListParams construction and the create/update field mapping.
 * Does NOT own filter/sort UI state, ThreatFilterStateService, or the
 * formattingService.migrateThreatFieldValues view-mapping pass — those stay
 * in the component.
 */
@Injectable({ providedIn: 'root' })
// SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: orchestrate threat CRUD API calls and query parameter building for a threat model
export class TmThreatCrudService {
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: inject ThreatModelService dependency
  constructor(private threatModelService: ThreatModelService) {}

  /** Build the server-side ThreatListParams from page + sort + filter state. */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: build server-side threat list query params from page, sort, and filter state (pure)
  buildThreatListParams(state: ThreatQueryState): ThreatListParams {
    const params: ThreatListParams = {
      limit: state.pageSize,
      offset: calculateOffset(state.pageIndex, state.pageSize),
    };
    if (state.sortActive && state.sortDirection) {
      params.sort = `${state.sortActive}:${state.sortDirection}`;
    }
    const f = state.filters;
    if (f.name.trim()) params.name = f.name.trim();
    if (f.severities.length > 0) params.severity = f.severities;
    if (f.statuses.length > 0) params.status = f.statuses;
    if (f.priorities.length > 0) params.priority = f.priorities;
    if (f.threatTypes.length > 0) params.threat_type = f.threatTypes;
    if (f.mitigated !== null) params.mitigated = f.mitigated;
    return params;
  }

  /**
   * Load one page of threats. Returns raw threats — the component applies
   * migrateThreatFieldValues.
   */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: fetch one page of threats for a threat model with sort and filter state (reads DB)
  loadThreats(threatModelId: string, state: ThreatQueryState): Observable<ThreatsPage> {
    return this.threatModelService
      .getThreatsForThreatModel(threatModelId, this.buildThreatListParams(state))
      .pipe(
        map(response => ({
          threats: response.threats ?? [],
          total: response.total ?? 0,
        })),
      );
  }

  /** Copy only defined optional fields from source to target. */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: copy only defined optional fields from one object to another (pure)
  private copyDefinedFields<S, T>(
    source: Partial<S>,
    target: Partial<T>,
    fields: (keyof S & keyof T)[],
  ): void {
    for (const field of fields) {
      if (source[field] !== undefined) {
        Object.assign(target, { [field]: source[field] });
      }
    }
  }

  /** Build create-threat payload from the dialog result. */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: build a create-threat API payload from a dialog result with defaults (pure)
  buildCreateThreatData(result: Partial<Threat>): Partial<ApiThreatInput> {
    const data: Partial<ApiThreatInput> = {
      name: result.name,
      description: result.description,
      severity: result.severity || 'high',
      threat_type: result.threat_type || [],
      mitigated: result.mitigated || false,
      status: result.status || 'open',
      metadata: [],
    };
    this.copyDefinedFields(result, data, [
      'asset_id',
      'diagram_id',
      'cell_id',
      'score',
      'priority',
      'issue_uri',
      'include_in_report',
    ]);
    return data;
  }

  /** Build update-threat payload from the dialog result, falling back to the existing threat. */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: build API update payload for a threat, merging dialog result with existing data (pure)
  buildUpdateThreatData(existing: Threat, result: Partial<Threat>): Partial<ApiThreatInput> {
    const data: Partial<ApiThreatInput> = {
      name: result.name,
      description: result.description,
      severity: result.severity ?? existing.severity,
      threat_type: result.threat_type ?? existing.threat_type ?? [],
    };
    this.copyDefinedFields(result, data, [
      'asset_id',
      'diagram_id',
      'cell_id',
      'score',
      'priority',
      'mitigated',
      'status',
      'issue_uri',
      'include_in_report',
    ]);
    return data;
  }

  /** Create a threat from a dialog result. */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: store a new threat for a threat model via the API
  createThreat(threatModelId: string, result: Partial<Threat>): Observable<Threat> {
    return this.threatModelService.createThreat(threatModelId, this.buildCreateThreatData(result));
  }

  /** Update a threat from a dialog result; emits the updated threat. */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: update an existing threat from a dialog result via the API
  updateThreat(
    threatModelId: string,
    existing: Threat,
    result: Partial<Threat>,
  ): Observable<Threat> {
    return this.threatModelService.updateThreat(
      threatModelId,
      existing.id,
      this.buildUpdateThreatData(existing, result),
    );
  }

  /** Delete a threat; emits the success boolean. */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: delete a threat from a threat model via the API
  deleteThreat(threatModelId: string, threatId: string): Observable<boolean> {
    return this.threatModelService.deleteThreat(threatModelId, threatId);
  }

  /** Update a threat's metadata; emits the updated metadata array. */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: update metadata collection for a threat via the API
  updateThreatMetadata(
    threatModelId: string,
    threatId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateThreatMetadata(threatModelId, threatId, metadata);
  }
}
