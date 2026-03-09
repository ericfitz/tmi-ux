/**
 * Audit Trail Service
 *
 * Provides API methods for listing audit trail entries and invoking rollback
 * on eligible entries for threat models and their sub-entities.
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  AuditEntry,
  AuditObjectType,
  AuditTrailListParams,
  ListAuditTrailResponse,
} from '../models/audit-trail.model';

@Injectable({
  providedIn: 'root',
})
export class AuditTrailService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List audit trail entries for a threat model and all its sub-entities.
   */
  getAuditTrail(
    threatModelId: string,
    params?: AuditTrailListParams,
  ): Observable<ListAuditTrailResponse> {
    const queryParams = params ? this.buildQueryParams(params) : {};
    return this.apiService
      .get<ListAuditTrailResponse>(`threat_models/${threatModelId}/audit_trail`, queryParams)
      .pipe(
        catchError(error => {
          this.logger.error(`Error fetching audit trail for threat model: ${threatModelId}`, error);
          return of({ audit_entries: [], total: 0, limit: 0, offset: 0 });
        }),
      );
  }

  /**
   * List audit trail entries for a specific sub-entity.
   */
  getEntityAuditTrail(
    threatModelId: string,
    entityType: AuditObjectType,
    entityId: string,
    params?: AuditTrailListParams,
  ): Observable<ListAuditTrailResponse> {
    const endpoint = this.buildEntityEndpoint(threatModelId, entityType, entityId);
    const queryParams = params ? this.buildQueryParams(params) : {};
    return this.apiService.get<ListAuditTrailResponse>(endpoint, queryParams).pipe(
      catchError(error => {
        this.logger.error(`Error fetching audit trail for ${entityType} ${entityId}`, error);
        return of({ audit_entries: [], total: 0, limit: 0, offset: 0 });
      }),
    );
  }

  /**
   * Get a single audit trail entry by ID.
   */
  getAuditEntry(threatModelId: string, entryId: string): Observable<AuditEntry | undefined> {
    return this.apiService
      .get<AuditEntry>(`threat_models/${threatModelId}/audit_trail/${entryId}`)
      .pipe(
        catchError(error => {
          this.logger.error(`Error fetching audit entry: ${entryId}`, error);
          return of(undefined);
        }),
      );
  }

  /**
   * Rollback an entity to the state captured in the specified audit entry.
   * Returns the restored entity as the API response.
   */
  rollback(threatModelId: string, entryId: string): Observable<AuditEntry> {
    return this.apiService.post<AuditEntry>(
      `threat_models/${threatModelId}/audit_trail/${entryId}/rollback`,
      {},
    );
  }

  /** Build the entity-specific audit trail endpoint path */
  private buildEntityEndpoint(
    threatModelId: string,
    entityType: AuditObjectType,
    entityId: string,
  ): string {
    const typeToPath: Record<AuditObjectType, string> = {
      threat_model: '', // Not used for sub-entity endpoint
      diagram: 'diagrams',
      threat: 'threats',
      asset: 'assets',
      document: 'documents',
      note: 'notes',
      repository: 'repositories',
    };
    const pathSegment = typeToPath[entityType];
    return `threat_models/${threatModelId}/${pathSegment}/${entityId}/audit_trail`;
  }

  /** Convert AuditTrailListParams to query param record */
  private buildQueryParams(p: AuditTrailListParams): Record<string, string> {
    const params: Record<string, string> = {};
    if (p.limit !== undefined) params['limit'] = String(p.limit);
    if (p.offset !== undefined) params['offset'] = String(p.offset);
    if (p.object_type) params['object_type'] = p.object_type;
    if (p.change_type) params['change_type'] = p.change_type;
    if (p.actor_email) params['actor_email'] = p.actor_email;
    if (p.after) params['after'] = p.after;
    if (p.before) params['before'] = p.before;
    return params;
  }
}
