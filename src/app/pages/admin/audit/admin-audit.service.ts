import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import { buildHttpParams } from '@app/shared/utils/http-params.util';
import {
  AuditEntry,
  AuditExportFormat,
  AuditPageRequest,
  ListSystemAuditResponse,
  ListTmAuditResponse,
  SystemAuditEntry,
  SystemAuditFilter,
  TmAuditFilter,
} from './models/admin-audit.model';

const SYSTEM_PATH = 'admin/audit/system';
const TM_PATH = 'admin/audit/threat_models';

/** Strip undefined, null, and empty-string values so blank filters don't become query params. */
// SEM@38e2613a41430b49e6261b3a1edfcd81623f8db0: strip null, undefined, and empty-string fields from an object before submission (pure)
function clean<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Partial<T>;
}

/**
 * Service for accessing the admin audit-log API endpoints.
 * Provides list, get, and export operations for both the system audit log
 * and the threat-model audit log.
 */
@Injectable({ providedIn: 'root' })
// SEM@38e2613a41430b49e6261b3a1edfcd81623f8db0: fetch, list, and export admin audit log entries for system and threat-model streams
export class AdminAuditService {
  // SEM@38e2613a41430b49e6261b3a1edfcd81623f8db0: inject API and logger dependencies (pure)
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  /**
   * List system audit entries with optional filters and cursor pagination.
   * @param filter Active filter values (empty strings are dropped)
   * @param page Pagination params (limit, cursor, or around)
   * @returns Observable of the paginated system audit response
   */
  // SEM@38e2613a41430b49e6261b3a1edfcd81623f8db0: fetch a paginated list of system audit entries with optional filters
  listSystem(
    filter: SystemAuditFilter,
    page: AuditPageRequest,
  ): Observable<ListSystemAuditResponse> {
    const params = buildHttpParams(clean({ ...filter, ...page }));
    return this.apiService.get<ListSystemAuditResponse>(SYSTEM_PATH, params).pipe(
      tap(r =>
        this.logger.debug('System audit entries loaded', {
          count: r.entries.length,
          total: r.total,
        }),
      ),
      catchError(error => {
        this.logger.error('Failed to list system audit entries', error);
        throw error;
      }),
    );
  }

  /**
   * Fetch a single system audit entry by id.
   * @param entryId The audit entry UUID
   * @returns Observable of the system audit entry
   */
  // SEM@38e2613a41430b49e6261b3a1edfcd81623f8db0: fetch a single system audit entry by ID
  getSystemEntry(entryId: string): Observable<SystemAuditEntry> {
    return this.apiService.get<SystemAuditEntry>(`${SYSTEM_PATH}/${entryId}`).pipe(
      catchError(error => {
        this.logger.error('Failed to get system audit entry', error);
        throw error;
      }),
    );
  }

  /**
   * List threat-model audit entries with optional filters and cursor pagination.
   * @param filter Active filter values (empty strings are dropped)
   * @param page Pagination params (limit, cursor, or around)
   * @returns Observable of the paginated TM audit response
   */
  // SEM@38e2613a41430b49e6261b3a1edfcd81623f8db0: fetch a paginated list of threat-model audit entries with optional filters
  listTm(filter: TmAuditFilter, page: AuditPageRequest): Observable<ListTmAuditResponse> {
    const params = buildHttpParams(clean({ ...filter, ...page }));
    return this.apiService.get<ListTmAuditResponse>(TM_PATH, params).pipe(
      tap(r =>
        this.logger.debug('TM audit entries loaded', { count: r.entries.length, total: r.total }),
      ),
      catchError(error => {
        this.logger.error('Failed to list threat-model audit entries', error);
        throw error;
      }),
    );
  }

  /**
   * Fetch a single threat-model audit entry by id.
   * @param entryId The audit entry UUID
   * @returns Observable of the TM audit entry
   */
  // SEM@38e2613a41430b49e6261b3a1edfcd81623f8db0: fetch a single threat-model audit entry by ID
  getTmEntry(entryId: string): Observable<AuditEntry> {
    return this.apiService.get<AuditEntry>(`${TM_PATH}/${entryId}`).pipe(
      catchError(error => {
        this.logger.error('Failed to get threat-model audit entry', error);
        throw error;
      }),
    );
  }

  /**
   * Export system audit entries as a downloadable blob (CSV or NDJSON).
   * @param filter Active filter values (empty strings are dropped)
   * @param format Export format: 'csv' or 'ndjson'
   * @returns Observable of the response Blob
   */
  // SEM@38e2613a41430b49e6261b3a1edfcd81623f8db0: fetch system audit entries as a downloadable blob in CSV or NDJSON format
  exportSystem(filter: SystemAuditFilter, format: AuditExportFormat): Observable<Blob> {
    const params = buildHttpParams(clean({ ...filter, format }));
    return this.apiService.getBlob(SYSTEM_PATH, params).pipe(
      tap(() => this.logger.info('System audit export downloaded', { format })),
      catchError(error => {
        this.logger.error('Failed to export system audit', error);
        throw error;
      }),
    );
  }
}
