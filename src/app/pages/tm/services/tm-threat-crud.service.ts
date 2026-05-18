import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import type { ApiThreatInput } from '@app/generated/api-type-helpers';

import { ThreatModelService, ThreatListParams } from './threat-model.service';
import { Threat, Metadata } from '../models/threat-model.model';
import { ThreatFilters } from '../models/threat-filter.model';

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
export class TmThreatCrudService {
  constructor(private threatModelService: ThreatModelService) {}

  /** Build the server-side ThreatListParams from page + sort + filter state. */
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
  createThreat(threatModelId: string, result: Partial<Threat>): Observable<Threat> {
    return this.threatModelService.createThreat(threatModelId, this.buildCreateThreatData(result));
  }

  /** Update a threat from a dialog result; emits the updated threat. */
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
  deleteThreat(threatModelId: string, threatId: string): Observable<boolean> {
    return this.threatModelService.deleteThreat(threatModelId, threatId);
  }

  /** Update a threat's metadata; emits the updated metadata array. */
  updateThreatMetadata(
    threatModelId: string,
    threatId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateThreatMetadata(threatModelId, threatId, metadata);
  }
}
