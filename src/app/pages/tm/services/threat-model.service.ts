/**
 * Threat Model Service
 *
 * This service manages all threat model data operations including CRUD operations,
 * diagram management, and coordination between mock and real API data sources.
 *
 * Key functionality:
 * - Provides comprehensive threat model CRUD operations (create, read, update, delete)
 * - Manages diagram operations within threat models (create, rename, delete diagrams)
 * - Supports both mock data (for development/testing) and real API integration
 * - Handles threat model validation and business rule enforcement
 * - Manages threat model metadata and authorization information
 * - Provides reactive data access through observables for component integration
 * - Implements error handling and logging for all operations
 * - Supports threat model collaboration and sharing features
 * - Manages threat model persistence and synchronization
 * - Provides search and filtering capabilities for threat model discovery
 */

import { Injectable, OnDestroy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, BehaviorSubject, throwError, timer, forkJoin, EMPTY } from 'rxjs';
import {
  catchError,
  switchMap,
  map,
  tap,
  retryWhen,
  mergeMap,
  take,
  expand,
  reduce,
} from 'rxjs/operators';

import {
  ThreatModel,
  Document as TMDocument,
  Repository,
  Note,
  Asset,
  Metadata,
  Threat,
} from '../models/threat-model.model';
import { TMListItem } from '../models/tm-list-item.model';
import { Diagram, Cell } from '../models/diagram.model';
import {
  ListThreatModelsResponse,
  ListDiagramsResponse,
  ListDocumentsResponse,
  ListRepositoriesResponse,
  ListNotesResponse,
  ListAssetsResponse,
  ListThreatsResponse,
} from '../models/api-responses.model';
import type { components } from '@app/generated/api-types';
import { PaginationMetadata } from '@app/types/api-responses.types';
import { getErrorMessage } from '@app/shared/utils/http-error.utils';

// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: API schema type alias for threat model create/update input payload (pure)
type ApiThreatModelInput = components['schemas']['ThreatModelInput'];
// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: API schema type alias for threat create/update input payload (pure)
type ApiThreatInput = components['schemas']['ThreatInput'];
// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: API schema type alias for document create/update input payload (pure)
type ApiDocumentInput = components['schemas']['DocumentInput'];
// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: API schema type alias for repository create/update input payload (pure)
type ApiRepositoryInput = components['schemas']['RepositoryInput'];
// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: API schema type alias for base diagram create/update input payload (pure)
type ApiBaseDiagramInput = components['schemas']['BaseDiagramInput'];
// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: API schema type alias for DFD diagram create/update input payload (pure)
type ApiDfdDiagramInput = components['schemas']['DfdDiagramInput'];
// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: API schema type alias for note create/update input payload (pure)
type ApiNoteInput = components['schemas']['NoteInput'];
// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: API schema type alias for asset create/update input payload (pure)
type ApiAssetInput = components['schemas']['AssetInput'];

/**
 * User information from the API (Principal-based)
 * Note: This matches the User type from threat-model.model.ts
 */
interface ApiUser {
  principal_type: 'user';
  provider: string;
  provider_id: string;
  display_name: string;
  email?: string;
}

/**
 * Participant from the API
 */
interface ApiParticipant {
  user: ApiUser;
  last_activity: string;
  permissions: 'reader' | 'writer' | 'owner';
}

/**
 * Collaboration session interface matching the API specification
 */
interface CollaborationSession {
  session_id: string;
  threat_model_id: string;
  threat_model_name: string;
  diagram_id: string;
  diagram_name: string;
  participants: ApiParticipant[];
  websocket_url: string;
  host: ApiUser;
  presenter?: ApiUser;
}
import { LoggerService } from '../../../core/services/logger.service';
import { ApiService } from '../../../core/services/api.service';

/**
 * Type guard to check if an error is an HttpErrorResponse
 */
// SEM@eba2c85b929c638b42c9013e63a10373be57ac39: validate that an unknown error value is an HttpErrorResponse (pure)
function isHttpErrorResponse(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse;
}
import { AuthService } from '../../../auth/services/auth.service';
import { ThreatModelAuthorizationService } from './threat-model-authorization.service';
import {
  ImportOrchestratorService,
  type ImportSummary,
} from './import/import-orchestrator.service';
import { ReadonlyFieldFilterService } from './import/readonly-field-filter.service';
import { ProviderAdapterService } from './providers/provider-adapter.service';

/**
 * Parameters for listing and filtering threat models via GET /threat_models.
 */
export interface ThreatModelListParams {
  limit?: number;
  offset?: number;
  name?: string;
  description?: string;
  owner?: string;
  status?: string;
  security_reviewer?: string;
  issue_uri?: string;
  created_after?: string;
  created_before?: string;
  modified_after?: string;
  modified_before?: string;
  status_updated_after?: string;
  status_updated_before?: string;
}

/**
 * Parameters for listing and filtering threats via
 * GET /threat_models/{threat_model_id}/threats.
 */
export interface ThreatListParams {
  limit?: number;
  offset?: number;
  sort?: string;
  name?: string;
  description?: string;
  threat_type?: string[];
  severity?: string[];
  priority?: string[];
  status?: string[];
  mitigated?: boolean;
  diagram_id?: string;
  cell_id?: string;
  score_gt?: number;
  score_lt?: number;
  score_eq?: number;
  score_ge?: number;
  score_le?: number;
  created_after?: string;
  created_before?: string;
  modified_after?: string;
  modified_before?: string;
}

@Injectable({
  providedIn: 'root',
})
// SEM@414984dadc9232b9a98bc7dcc3c927eb0d907dfe: fetch, cache, and mutate threat models and their nested resources via the API (reads DB)
export class ThreatModelService implements OnDestroy {
  private _threatModelList: TMListItem[] = [];
  private _cachedThreatModels = new Map<string, ThreatModel>();
  private _threatModelListSubject = new BehaviorSubject<TMListItem[]>([]);

  // SEM@4898e0c966e5d38f3e8cf220acb5b62397a33fee: inject dependencies for API access, authorization, import orchestration, and provider adaptation
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
    private authService: AuthService,
    private authorizationService: ThreatModelAuthorizationService,
    private importOrchestrator: ImportOrchestratorService,
    private fieldFilter: ReadonlyFieldFilterService,
    private providerAdapter: ProviderAdapterService,
  ) {
    // this.logger.debugComponent('ThreatModelService', 'ThreatModelService initialized');
  }

  /**
   * Fetch threat models with pagination and filtering support.
   * Returns the full API response including pagination metadata.
   */
  // SEM@8e6da6d9a0b8a933bcb0885eccc9a3306ddfb569: fetch a filtered, paginated list of threat models from the API (reads DB)
  fetchThreatModels(listParams?: ThreatModelListParams): Observable<ListThreatModelsResponse> {
    const params: Record<string, string> = {};
    if (listParams) {
      if (listParams.limit !== undefined) params['limit'] = listParams.limit.toString();
      if (listParams.offset !== undefined) params['offset'] = listParams.offset.toString();
      const stringKeys: (keyof Omit<ThreatModelListParams, 'limit' | 'offset'>)[] = [
        'name',
        'description',
        'owner',
        'status',
        'security_reviewer',
        'issue_uri',
        'created_after',
        'created_before',
        'modified_after',
        'modified_before',
        'status_updated_after',
        'status_updated_before',
      ];
      for (const key of stringKeys) {
        if (listParams[key]) params[key] = listParams[key];
      }
    }

    return this.apiService.get<ListThreatModelsResponse>('threat_models', params).pipe(
      tap(response => {
        // Update internal cache with fetched items
        const threatModelList = response.threat_models || [];
        this._threatModelList = threatModelList;
        this._threatModelListSubject.next(threatModelList);
      }),
      catchError(error => {
        this.logger.error('Error fetching threat model list', error);
        return of({ threat_models: [], total: 0, limit: 0, offset: 0 });
      }),
    );
  }

  /**
   * Get threat model list items (lightweight data for dashboard)
   * Always fetches fresh data from API to minimize stale data issues
   * @deprecated Use fetchThreatModels() for pagination support
   */
  // SEM@54e7d611dc1f2c8ef1c351a57a5968d8be72defc: fetch the reactive threat model list, triggering an API refresh (reads DB)
  getThreatModelList(_forceRefresh: boolean = false): Observable<TMListItem[]> {
    // Trigger a fetch and update the internal subject
    this.fetchThreatModels().subscribe();
    // Return the reactive subject for backward compatibility
    return this._threatModelListSubject.asObservable();
  }

  /**
   * Force refresh the threat model list from the API
   */
  // SEM@54e7d611dc1f2c8ef1c351a57a5968d8be72defc: fetch the threat model list from the API and notify subscribers (reads DB)
  refreshThreatModelList(): void {
    this.fetchThreatModels().subscribe();
  }

  /**
   * Get a full threat model by ID (for editing)
   */
  // SEM@7fa283733048fe57c2b273455f32e8cf97ad4702: fetch a threat model by ID from cache or API, setting authorization (reads DB)
  getThreatModelById(
    id: string,
    forceRefresh: boolean = false,
  ): Observable<ThreatModel | undefined> {
    // Check cache first unless force refresh is requested
    if (this._cachedThreatModels.has(id) && !forceRefresh) {
      // this.logger.debugComponent(
      //   'ThreatModelService',
      //   `Returning cached threat model with ID: ${id}`,
      // );
      const cachedModel = this._cachedThreatModels.get(id);

      // Update authorization service with the cached threat model's authorization
      if (cachedModel) {
        this.authorizationService.setAuthorization(
          cachedModel.id,
          cachedModel.authorization,
          cachedModel.owner,
        );
      }

      return of(cachedModel);
    }

    // Fetch from API and cache the result
    // this.logger.debugComponent(
    //   'ThreatModelService',
    //   `Fetching threat model with ID: ${id} from API`,
    //   { forceRefresh },
    // );
    return this.apiService.get<ThreatModel>(`threat_models/${id}`).pipe(
      map(threatModel => {
        if (threatModel) {
          // Migrate legacy field values in all threats
          if (threatModel.threats) {
            threatModel.threats = threatModel.threats.map(threat =>
              this.migrateLegacyThreatFieldValues(threat),
            );
          }

          // Transform providers for display (* → tmi) and remove read-only fields
          if (threatModel.authorization) {
            threatModel.authorization = threatModel.authorization.map(auth => {
              const transformed = {
                ...auth,
                provider: this.providerAdapter.transformProviderForDisplay(auth.provider),
              };
              // Remove display_name which is a server-managed read-only field
              // This prevents it from being accidentally included in PATCH requests
              delete (transformed as { display_name?: string }).display_name;
              return transformed;
            });
          }
        }
        return threatModel;
      }),
      tap(threatModel => {
        if (threatModel) {
          // Cache the full model and expire all other cached models
          this.expireAllCachedModelsExcept(id);
          this._cachedThreatModels.set(id, threatModel);
          // this.logger.debugComponent(
          //   'ThreatModelService',
          //   `Cached threat model ${id} and expired others`,
          //   { cacheSize: this._cachedThreatModels.size },
          // );

          // Update authorization service with the loaded threat model's authorization
          this.authorizationService.setAuthorization(
            threatModel.id,
            threatModel.authorization,
            threatModel.owner,
          );
        }
      }),
      catchError(error => {
        this.logger.error(`Error fetching threat model with ID: ${id}`, error);
        return of(undefined);
      }),
    );
  }

  /**
   * Fetch a complete threat model with all sub-entities for export.
   *
   * GET /threat_models/{id} only includes diagrams and threats inline.
   * Notes, documents, repositories, and assets require separate paginated
   * endpoint calls. This method fetches everything and assembles a complete
   * ThreatModel object suitable for JSON serialization.
   */
  // SEM@303ce38bb1f256e2e3464d90115ce8485ba862b2: fetch a complete threat model with all sub-entities for export (reads DB)
  exportThreatModel(id: string): Observable<ThreatModel | undefined> {
    return this.getThreatModelById(id, true).pipe(
      switchMap(threatModel => {
        if (!threatModel) {
          return of(undefined);
        }

        return forkJoin({
          notes: this.fetchAllNotes(id),
          documents: this.fetchAllPages<TMDocument>(`threat_models/${id}/documents`, 'documents'),
          repositories: this.fetchAllPages<Repository>(
            `threat_models/${id}/repositories`,
            'repositories',
          ),
          assets: this.fetchAllPages<Asset>(`threat_models/${id}/assets`, 'assets'),
          diagrams: this.fetchAllDiagrams(id),
          // fetchAllThreats delegates to getThreatsForThreatModel which
          // already applies migrateLegacyThreatFieldValues per-threat
          threats: this.fetchAllThreats(id),
        }).pipe(
          map(subEntities => ({
            ...threatModel,
            ...subEntities,
          })),
        );
      }),
      catchError(error => {
        this.logger.error(`Error exporting threat model with ID: ${id}`, error);
        return of(undefined);
      }),
    );
  }

  /**
   * Fetch all pages of a paginated list endpoint, accumulating results.
   * @param endpoint API path (e.g. `threat_models/{id}/notes`)
   * @param itemsKey The key in the response that holds the array of items
   * @param pageSize Number of items to request per page
   * @param maxPages Safety bound to prevent infinite loops from broken pagination metadata
   */
  // SEM@90a9e82c7ca17df97eb7890a53a8f0ba75cb4d92: fetch all pages of a paginated API endpoint into a single array (reads DB)
  private fetchAllPages<T>(
    endpoint: string,
    itemsKey: string,
    pageSize = 100,
    maxPages = 100,
  ): Observable<T[]> {
    let pageCount = 1; // counts the initial request
    return this.apiService
      .get<PaginationMetadata & Record<string, unknown>>(endpoint, {
        limit: pageSize.toString(),
        offset: '0',
      })
      .pipe(
        expand(response => {
          const items = (response[itemsKey] as T[]) || [];
          if (items.length === 0) {
            return EMPTY;
          }
          if (pageCount >= maxPages) {
            this.logger.warn(`fetchAllPages: hit max page limit (${maxPages}) for ${endpoint}`);
            return EMPTY;
          }
          pageCount++;
          const nextOffset = (response.offset ?? 0) + items.length;
          if (response.total != null && nextOffset >= response.total) {
            return EMPTY;
          }
          return this.apiService.get<PaginationMetadata & Record<string, unknown>>(endpoint, {
            limit: pageSize.toString(),
            offset: nextOffset.toString(),
          });
        }),
        map(response => (response[itemsKey] as T[]) || []),
        reduce((all: T[], page: T[]) => all.concat(page), []),
        catchError(error => {
          this.logger.error(`Error fetching all pages from ${endpoint}`, error);
          return of([] as T[]);
        }),
      );
  }

  /**
   * Fetch all notes with full content.
   * The list endpoint returns NoteListItem which excludes content for
   * performance. We fetch the list to get all IDs, then fetch each note
   * individually via getNoteById to get complete data including content.
   */
  // SEM@303ce38bb1f256e2e3464d90115ce8485ba862b2: fetch all notes with full content for a threat model (reads DB)
  private fetchAllNotes(threatModelId: string): Observable<Note[]> {
    return this.fetchAllPages<{ id: string }>(`threat_models/${threatModelId}/notes`, 'notes').pipe(
      switchMap(listItems => {
        if (listItems.length === 0) {
          return of([] as Note[]);
        }
        return forkJoin(listItems.map(item => this.getNoteById(threatModelId, item.id))).pipe(
          map(notes => notes.filter((n): n is Note => n !== undefined)),
        );
      }),
      catchError(error => {
        this.logger.error(`Error fetching all notes for threat model ID: ${threatModelId}`, error);
        return of([] as Note[]);
      }),
    );
  }

  /**
   * Fetch all diagrams with full cell data.
   * The list endpoint returns DiagramListItem which excludes cells for
   * performance. We fetch the list to get all IDs, then fetch each diagram
   * individually via getDiagramById to get complete data including cells.
   */
  // SEM@c17e73f2fd93d69a5bc5c49749a2a0bdf45426b6: fetch all diagrams with full cell data for a threat model (reads DB)
  private fetchAllDiagrams(threatModelId: string): Observable<Diagram[]> {
    return this.fetchAllPages<{ id: string }>(
      `threat_models/${threatModelId}/diagrams`,
      'diagrams',
    ).pipe(
      switchMap(listItems => {
        if (listItems.length === 0) {
          return of([] as Diagram[]);
        }
        return forkJoin(listItems.map(item => this.getDiagramById(threatModelId, item.id))).pipe(
          map(diagrams => diagrams.filter((d): d is Diagram => d !== undefined)),
        );
      }),
      catchError(error => {
        this.logger.error(
          `Error fetching all diagrams for threat model ID: ${threatModelId}`,
          error,
        );
        return of([] as Diagram[]);
      }),
    );
  }

  /**
   * Fetch all threats across all pages.
   * Threats use a different query-param shape (ThreatListParams) so they
   * cannot go through the generic fetchAllPages helper.
   * @param threatModelId ID of the threat model
   * @param pageSize Number of items to request per page
   * @param maxPages Safety bound to prevent infinite loops from broken pagination metadata
   */
  // SEM@90a9e82c7ca17df97eb7890a53a8f0ba75cb4d92: fetch all threat pages for a threat model, accumulating results (reads DB)
  private fetchAllThreats(
    threatModelId: string,
    pageSize = 100,
    maxPages = 100,
  ): Observable<Threat[]> {
    let pageCount = 1; // counts the initial request
    return this.getThreatsForThreatModel(threatModelId, { limit: pageSize, offset: 0 }).pipe(
      expand(response => {
        if (response.threats.length === 0) {
          return EMPTY;
        }
        if (pageCount >= maxPages) {
          this.logger.warn(
            `fetchAllThreats: hit max page limit (${maxPages}) for threat model ${threatModelId}`,
          );
          return EMPTY;
        }
        pageCount++;
        const nextOffset = (response.offset ?? 0) + response.threats.length;
        if (response.total != null && nextOffset >= response.total) {
          return EMPTY;
        }
        return this.getThreatsForThreatModel(threatModelId, {
          limit: pageSize,
          offset: nextOffset,
        });
      }),
      map(response => response.threats),
      reduce((all: Threat[], page: Threat[]) => all.concat(page), []),
      catchError(error => {
        this.logger.error(
          `Error fetching all threats for threat model ID: ${threatModelId}`,
          error,
        );
        return of([] as Threat[]);
      }),
    );
  }

  /**
   * Get basic threat model info (name, id, etc.) without loading full data
   * This is more efficient than getThreatModelById when you only need basic info
   */
  // Note: This method is currently unused but kept for potential future use
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: fetch lightweight threat model identity fields without loading full data (reads DB)
  getThreatModelBasicInfo(
    threatModelId: string,
  ): Observable<
    | Pick<ThreatModel, 'id' | 'name' | 'description' | 'owner' | 'created_at' | 'modified_at'>
    | undefined
  > {
    // For real API, we could use a dedicated lightweight endpoint if available
    // For now, fall back to the list endpoint and find the specific threat model
    return this.getThreatModelList().pipe(
      map(threatModels => {
        const listItem = threatModels.find(tm => tm.id === threatModelId);
        if (!listItem) {
          return undefined;
        }
        return {
          id: listItem.id,
          name: listItem.name,
          description: listItem.description,
          owner: listItem.owner,
          created_at: listItem.created_at,
          modified_at: listItem.modified_at,
        };
      }),
      catchError(error => {
        this.logger.error(`Error getting basic info for threat model ID: ${threatModelId}`, error);
        // Fallback to full getThreatModelById if list approach fails
        return this.getThreatModelById(threatModelId).pipe(
          map(threatModel => {
            if (!threatModel) return undefined;
            return {
              id: threatModel.id,
              name: threatModel.name,
              description: threatModel.description,
              owner: threatModel.owner,
              created_at: threatModel.created_at,
              modified_at: threatModel.modified_at,
            };
          }),
        );
      }),
    );
  }

  /**
   * Get diagrams for a threat model with optional pagination
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: fetch a paginated list of diagrams for a threat model (reads DB)
  getDiagramsForThreatModel(
    threatModelId: string,
    limit?: number,
    offset?: number,
  ): Observable<ListDiagramsResponse> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params['limit'] = limit.toString();
    if (offset !== undefined) params['offset'] = offset.toString();

    return this.apiService
      .get<ListDiagramsResponse>(`threat_models/${threatModelId}/diagrams`, params)
      .pipe(
        catchError(error => {
          this.logger.error(
            `Error fetching diagrams for threat model with ID: ${threatModelId}`,
            error,
          );
          return of({ diagrams: [], total: 0, limit: 0, offset: 0 });
        }),
      );
  }

  /**
   * Get a diagram by ID
   */
  // SEM@a130f0a1556ca72349c607e4b63c8fc829d1ee3c: fetch a single diagram by ID including cell data (reads DB)
  getDiagramById(threatModelId: string, diagramId: string): Observable<Diagram | undefined> {
    // In a real implementation, this would call the API
    // this.logger.debugComponent(
    // 'ThreatModelService',
    // `Fetching diagram with ID: ${diagramId} from API`,
    // );
    return this.apiService
      .get<Diagram>(`threat_models/${threatModelId}/diagrams/${diagramId}`)
      .pipe(
        catchError(error => {
          this.logger.error(`Error fetching diagram with ID: ${diagramId}`, error);
          return of(undefined);
        }),
      );
  }

  /**
   * Get documents for a threat model with optional pagination
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: fetch a paginated list of documents for a threat model (reads DB)
  getDocumentsForThreatModel(
    threatModelId: string,
    limit?: number,
    offset?: number,
  ): Observable<ListDocumentsResponse> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params['limit'] = limit.toString();
    if (offset !== undefined) params['offset'] = offset.toString();

    return this.apiService
      .get<ListDocumentsResponse>(`threat_models/${threatModelId}/documents`, params)
      .pipe(
        catchError(error => {
          this.logger.error(
            `Error fetching documents for threat model with ID: ${threatModelId}`,
            error,
          );
          return of({ documents: [], total: 0, limit: 0, offset: 0 });
        }),
      );
  }

  /**
   * Get repository references for a threat model with optional pagination
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: fetch a paginated list of repository references for a threat model (reads DB)
  getRepositoriesForThreatModel(
    threatModelId: string,
    limit?: number,
    offset?: number,
  ): Observable<ListRepositoriesResponse> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params['limit'] = limit.toString();
    if (offset !== undefined) params['offset'] = offset.toString();

    return this.apiService
      .get<ListRepositoriesResponse>(`threat_models/${threatModelId}/repositories`, params)
      .pipe(
        catchError(error => {
          this.logger.error(
            `Error fetching repositories for threat model with ID: ${threatModelId}`,
            error,
          );
          return of({ repositories: [], total: 0, limit: 0, offset: 0 });
        }),
      );
  }

  /**
   * Get notes for a threat model with optional pagination
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: fetch a paginated list of notes for a threat model (reads DB)
  getNotesForThreatModel(
    threatModelId: string,
    limit?: number,
    offset?: number,
  ): Observable<ListNotesResponse> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params['limit'] = limit.toString();
    if (offset !== undefined) params['offset'] = offset.toString();

    return this.apiService
      .get<ListNotesResponse>(`threat_models/${threatModelId}/notes`, params)
      .pipe(
        catchError(error => {
          this.logger.error(
            `Error fetching notes for threat model with ID: ${threatModelId}`,
            error,
          );
          return of({ notes: [], total: 0, limit: 0, offset: 0 });
        }),
      );
  }

  /**
   * Create a new threat model
   */
  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: create a new threat model via API and update the local list cache (mutates shared state)
  createThreatModel(
    name: string,
    description?: string,
    framework: 'STRIDE' | 'CIA' | 'LINDDUN' | 'DIE' | 'PLOT4ai' = 'STRIDE',
    issueUrl?: string,
    isConfidential?: boolean,
  ): Observable<ThreatModel> {
    // Ensure framework is never empty - use STRIDE as default
    const validFramework = framework && framework.trim() !== '' ? framework : 'STRIDE';

    // this.logger.debugComponent('ThreatModelService', 'Creating threat model via API');
    const body: Record<string, unknown> = {
      name,
      description,
      threat_model_framework: validFramework,
      issue_uri: issueUrl,
      is_confidential: isConfidential ?? false,
    };

    return this.apiService.post<ThreatModel>('threat_models', body).pipe(
      map(newThreatModel => {
        if (newThreatModel) {
          // Remove display_name from authorization entries (server-managed read-only field)
          if (newThreatModel.authorization) {
            newThreatModel.authorization = newThreatModel.authorization.map(auth => {
              const cleaned = { ...auth };
              delete (cleaned as { display_name?: string }).display_name;
              return cleaned;
            });
          }
        }
        return newThreatModel;
      }),
      tap(newThreatModel => {
        if (newThreatModel) {
          // Log the API response to diagnose permission issues
          this.logger.info('Created new threat model - API response:', {
            id: newThreatModel.id,
            name: newThreatModel.name,
            owner: newThreatModel.owner,
            created_by: newThreatModel.created_by,
            authorization: newThreatModel.authorization,
          });

          // Set authorization for the newly created threat model
          this.authorizationService.setAuthorization(
            newThreatModel.id,
            newThreatModel.authorization,
            newThreatModel.owner,
          );

          // Add the new threat model to the list cache and notify subscribers
          const listItem = this.convertToListItem(newThreatModel);
          this._threatModelList.push(listItem);
          this._threatModelListSubject.next([...this._threatModelList]);

          // Cache the full model
          this._cachedThreatModels.set(newThreatModel.id, newThreatModel);

          // this.logger.debugComponent('ThreatModelService', 'Added new threat model to cache', {
          // id: newThreatModel.id,
          // name: newThreatModel.name,
          // totalInList: this._threatModelList.length,
          // });
        }
      }),
      catchError(error => {
        this.logger.error('Error creating threat model', error);
        throw error;
      }),
    );
  }

  /**
   * Import a threat model from external JSON data.
   * Always creates a new threat model with a server-assigned ID.
   * The original ID from the exported file is preserved in the ID translation map
   * for reference mapping of nested objects (threats, diagrams, etc.).
   *
   * @param data Validated threat model data from exported JSON file
   */
  // SEM@e2a977f3ac5871495f1b0d8d71c426f0b109bbc8: import exported threat model data as a new API-assigned instance (mutates shared state)
  importThreatModel(data: Partial<ThreatModel> & { id: string; name: string }): Observable<{
    model: ThreatModel;
  }> {
    this.logger.info('Importing threat model as new instance', {
      originalId: data.id,
      name: data.name,
    });

    // For API mode, always create a new threat model
    // this.logger.debugComponent('ThreatModelService', 'Creating new threat model via API');

    return this.createNewThreatModelFromImport(data).pipe(
      map(newModel => ({ model: newModel })),
      catchError(error => {
        this.logger.error('Failed to import threat model via API', error);
        throw error;
      }),
    );
  }

  /**
   * Create a new threat model from imported data.
   * Uses the import orchestrator to handle nested objects and ID translation.
   */
  // SEM@49590bd79bc6fb53c9853f6850b5a5113fafa37a: orchestrate creation of a threat model and all nested sub-entities from import data (mutates shared state)
  private createNewThreatModelFromImport(
    data: Partial<ThreatModel> & { id: string; name: string },
  ): Observable<ThreatModel> {
    this.logger.info('Starting orchestrated import of threat model with nested objects');

    // Use orchestrator to handle the complete import
    return this.importOrchestrator
      .orchestrateImport(data as Record<string, unknown>, {
        // Threat Model creation — tmData is typed as ApiThreatModelInput
        // For import, we exclude authorization (server sets current user as owner)
        // and metadata (imported separately via metadata endpoint)
        createThreatModel: tmData => {
          const body: Record<string, unknown> = {
            name: tmData.name || 'Untitled',
            is_confidential: tmData.is_confidential ?? false,
          };
          if (tmData.description) {
            body['description'] = tmData.description;
          }
          if (tmData.threat_model_framework?.trim()) {
            body['threat_model_framework'] = tmData.threat_model_framework;
          } else {
            body['threat_model_framework'] = 'STRIDE';
          }
          if (tmData.issue_uri) {
            body['issue_uri'] = tmData.issue_uri;
          }
          return this.apiService.post<ThreatModel>('threat_models', body);
        },

        // Asset operations
        createAsset: (tmId, asset) => this.createAsset(tmId, asset),

        // Note operations
        createNote: (tmId, note) => this.createNote(tmId, note),

        // Document operations
        createDocument: (tmId, document) => this.createDocument(tmId, document),

        // Repository operations
        createRepository: (tmId, repository) => this.createRepository(tmId, repository),

        // Diagram operations
        createDiagram: (tmId, diagram) => this.createDiagram(tmId, diagram),
        updateDiagram: (tmId, diagramId, diagram) => this.updateDiagram(tmId, diagramId, diagram),

        // Threat operations
        createThreat: (tmId, threat) => this.createThreat(tmId, threat),

        // Metadata operations
        updateThreatModelMetadata: (tmId, metadata) =>
          this.updateThreatModelMetadata(tmId, metadata),
        updateAssetMetadata: (tmId, assetId, metadata) =>
          this.updateAssetMetadata(tmId, assetId, metadata),
        updateNoteMetadata: (tmId, noteId, metadata) =>
          this.updateNoteMetadata(tmId, noteId, metadata),
        updateDiagramMetadata: (tmId, diagramId, metadata) =>
          this.updateDiagramMetadata(tmId, diagramId, metadata),
        updateThreatMetadata: (tmId, threatId, metadata) =>
          this.updateThreatMetadata(tmId, threatId, metadata),
        updateDocumentMetadata: (tmId, documentId, metadata) =>
          this.updateDocumentMetadata(tmId, documentId, metadata),
        updateRepositoryMetadata: (tmId, repositoryId, metadata) =>
          this.updateRepositoryMetadata(tmId, repositoryId, metadata),
      })
      .pipe(
        map((summary: ImportSummary) => {
          if (!summary.success || !summary.threatModel) {
            throw new Error(`Import failed: ${summary.errors.join(', ') || 'Unknown error'}`);
          }

          // Log import summary
          this.logger.info('Import completed', {
            threatModelId: summary.threatModel.id,
            counts: summary.counts,
            errors: summary.errors,
          });

          // Warn about any errors
          if (summary.errors.length > 0) {
            this.logger.warn('Import completed with warnings', summary.errors);
          }

          return summary.threatModel;
        }),
      );
  }

  /**
   * Update a threat model
   */
  // SEM@49590bd79bc6fb53c9853f6850b5a5113fafa37a: replace a threat model via full PUT update (mutates shared state)
  updateThreatModel(
    threatModelId: string,
    data: Partial<ApiThreatModelInput>,
  ): Observable<ThreatModel> {
    return this.apiService
      .put<ThreatModel>(`threat_models/${threatModelId}`, data as Record<string, unknown>)
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating threat model with ID: ${threatModelId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Partially update a threat model using PATCH with JSON Patch operations
   * @param threatModelId The threat model ID
   * @param updates Object containing the fields to update
   */
  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: partially update a threat model via JSON Patch and sync cache and authorization (mutates shared state)
  patchThreatModel(
    threatModelId: string,
    updates: Partial<
      Pick<
        ThreatModel,
        | 'name'
        | 'description'
        | 'threat_model_framework'
        | 'issue_uri'
        | 'authorization'
        | 'owner'
        | 'status'
        | 'security_reviewer'
        | 'project_id'
      >
    >,
  ): Observable<ThreatModel> {
    // Create a clean copy of updates to prevent prototype pollution or accidental property inclusion
    const filteredUpdates = { ...updates };

    // Filter authorization entries to remove read-only fields like display_name
    if (filteredUpdates.authorization) {
      filteredUpdates.authorization = this.fieldFilter.filterAuthorizations(
        filteredUpdates.authorization,
      ) as typeof filteredUpdates.authorization;
    }

    // Convert updates to JSON Patch operations
    // Note: Do not include modified_at - the server manages timestamps automatically
    const operations = Object.entries(filteredUpdates).map(([key, value]) => ({
      op: 'replace' as const,
      path: `/${key}`,
      value,
    }));

    // Log the PATCH operations for debugging (helps identify unauthorized fields being sent)
    this.logger.info(
      `PATCH threat model ${threatModelId}: ${Object.keys(filteredUpdates).join(', ')}`,
      { updateKeys: Object.keys(filteredUpdates), operationCount: operations.length },
    );

    return this.apiService.patch<ThreatModel>(`threat_models/${threatModelId}`, operations).pipe(
      map(updatedModel => {
        if (updatedModel) {
          // Transform providers for display (* → tmi) and remove read-only fields
          if (updatedModel.authorization) {
            const beforeFilter = updatedModel.authorization.length;
            updatedModel.authorization = updatedModel.authorization.map(auth => {
              const hasDisplayName = 'display_name' in auth;
              const transformed = {
                ...auth,
                provider: this.providerAdapter.transformProviderForDisplay(auth.provider),
              };
              // Remove display_name which is a server-managed read-only field
              // This prevents it from being accidentally included in subsequent PATCH requests
              delete (transformed as { display_name?: string }).display_name;
              if (hasDisplayName) {
                this.logger.debugComponent(
                  'ThreatModel',
                  'Filtered display_name from PATCH response authorization entry',
                  { threatModelId },
                );
              }
              return transformed;
            });
            if (beforeFilter > 0) {
              this.logger.debugComponent(
                'ThreatModel',
                'PATCH response authorization filtering complete',
                {
                  threatModelId,
                  authCount: beforeFilter,
                  hasDisplayName: updatedModel.authorization.some(
                    a => 'display_name' in (a as object),
                  ),
                },
              );
            }
          }
        }
        return updatedModel;
      }),
      tap(updatedModel => {
        // Update cache with the server response
        if (updatedModel) {
          this._cachedThreatModels.set(threatModelId, updatedModel);

          // Update in list
          const listIndex = this._threatModelList.findIndex(tm => tm.id === threatModelId);
          if (listIndex !== -1) {
            this._threatModelList[listIndex] = this.convertToListItem(updatedModel);
            this._threatModelListSubject.next([...this._threatModelList]);
          }

          // Notify authorization service if authorization was updated
          if (updates.authorization && updatedModel.authorization) {
            this.authorizationService.updateAuthorization(updatedModel.authorization);
          }
        }
      }),
      retryWhen(errors => this.getRetryStrategy(errors, `patch threat model ${threatModelId}`)),
      catchError(error => {
        this.logger.error(`Error patching threat model with ID: ${threatModelId}`, error, {
          updates,
        });
        throw error;
      }),
    );
  }

  /**
   * Delete a threat model
   */
  // SEM@a130f0a1556ca72349c607e4b63c8fc829d1ee3c: delete a threat model via API and remove it from the local list cache (mutates shared state)
  deleteThreatModel(id: string): Observable<boolean> {
    // In a real implementation, this would call the API
    // this.logger.debugComponent(
    // 'ThreatModelService',
    // `Deleting threat model with ID: ${id} via API`,
    // );
    return this.apiService.delete<void>(`threat_models/${id}`).pipe(
      tap(() => {
        // Successful delete (204 No Content) - remove from local cache and notify subscribers
        this._threatModelList = this._threatModelList.filter(tm => tm.id !== id);
        this._cachedThreatModels.delete(id);
        this._threatModelListSubject.next([...this._threatModelList]);
        // this.logger.debugComponent(
        // 'ThreatModelService',
        // 'Updated threat model list after API deletion',
        // {
        // remainingCount: this._threatModelList.length,
        // deletedId: id,
        // },
        // );
      }),
      map(() => true), // Convert successful response to boolean true
      catchError(error => {
        this.logger.error(`Error deleting threat model with ID: ${id}`, error);
        throw error;
      }),
    );
  }

  /**
   * Migrate legacy string field values from API to numeric keys for frontend
   * The backend returns string values like 'critical', 'high', 'low', etc.
   * The frontend uses numeric keys: Critical=0, High=1, Medium=2, Low=3, Informational=4, Unknown=5
   */
  // SEM@750f4a1335b6c8222b9e2bc6c90915fba450dca8: convert legacy string severity/priority/status values to numeric keys (pure)
  private migrateLegacyThreatFieldValues(threat: Threat): Threat {
    const migratedThreat = { ...threat };

    // Severity: string to numeric key
    if (migratedThreat.severity && !/^\d+$/.test(migratedThreat.severity)) {
      const severityMap: Record<string, string> = {
        critical: '0',
        high: '1',
        medium: '2',
        low: '3',
        informational: '4',
        info: '4',
        unknown: '5',
        none: '5',
      };
      const key = migratedThreat.severity.toLowerCase();
      if (severityMap[key]) {
        migratedThreat.severity = severityMap[key];
      }
    }

    // Priority: string to numeric key
    if (migratedThreat.priority && !/^\d+$/.test(migratedThreat.priority)) {
      const priorityMap: Record<string, string> = {
        immediate: '0',
        high: '1',
        medium: '2',
        low: '3',
        deferred: '4',
      };
      const key = migratedThreat.priority.toLowerCase();
      if (priorityMap[key]) {
        migratedThreat.priority = priorityMap[key];
      }
    }

    // Status: string to numeric key
    if (migratedThreat.status && !/^\d+$/.test(migratedThreat.status)) {
      const statusMap: Record<string, string> = {
        open: '0',
        confirmed: '1',
        'mitigation planned': '2',
        'mitigation in progress': '3',
        'verification pending': '4',
        resolved: '5',
        accepted: '6',
        'false positive': '7',
        deferred: '8',
        closed: '9',
      };
      const key = migratedThreat.status.toLowerCase();
      if (statusMap[key]) {
        migratedThreat.status = statusMap[key];
      }
    }

    return migratedThreat;
  }

  /**
   * Get threats for a threat model with optional filtering, sorting, and pagination
   */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: fetch a filtered, sorted, paginated list of threats for a threat model (reads DB)
  getThreatsForThreatModel(
    threatModelId: string,
    listParams?: ThreatListParams,
  ): Observable<ListThreatsResponse> {
    const params = listParams ? this.buildThreatQueryParams(listParams) : {};

    return this.apiService
      .get<ListThreatsResponse>(`threat_models/${threatModelId}/threats`, params)
      .pipe(
        map(response => ({
          ...response,
          threats: response.threats.map(threat => this.migrateLegacyThreatFieldValues(threat)),
        })),
        catchError(error => {
          this.logger.error(`Error fetching threats for threat model ID: ${threatModelId}`, error);
          return of({ threats: [], total: 0, limit: 0, offset: 0 });
        }),
      );
  }

  /** Build query parameter record from ThreatListParams */
  // SEM@1cd05fb52ad1628a779738433156c42bb9c818a0: convert ThreatListParams to an API query parameter record (pure)
  private buildThreatQueryParams(p: ThreatListParams): Record<string, string | boolean | string[]> {
    const params: Record<string, string | boolean | string[]> = {};

    // Numeric fields — convert to string
    const numericFields: (keyof ThreatListParams)[] = [
      'limit',
      'offset',
      'score_gt',
      'score_lt',
      'score_eq',
      'score_ge',
      'score_le',
    ];
    for (const key of numericFields) {
      if (p[key] !== undefined) params[key] = String(p[key]);
    }

    // String fields — include if truthy
    const stringFields: (keyof ThreatListParams)[] = [
      'sort',
      'diagram_id',
      'cell_id',
      'created_after',
      'created_before',
      'modified_after',
      'modified_before',
    ];
    for (const key of stringFields) {
      if (p[key]) params[key] = p[key] as string;
    }

    // Text search fields — trim before sending
    const textFields: (keyof ThreatListParams)[] = ['name', 'description'];
    for (const key of textFields) {
      const val = p[key] as string | undefined;
      if (val?.trim()) params[key] = val.trim();
    }

    // Boolean field
    if (p.mitigated !== undefined) params['mitigated'] = p.mitigated;

    // Array fields — pass as arrays for repeated query params (style: form, explode: true)
    const arrayFields: (keyof ThreatListParams)[] = [
      'threat_type',
      'severity',
      'priority',
      'status',
    ];
    for (const key of arrayFields) {
      const val = p[key] as string[] | undefined;
      if (val?.length) params[key] = val;
    }

    return params;
  }

  /**
   * Create a new threat in a threat model
   */
  // SEM@49590bd79bc6fb53c9853f6850b5a5113fafa37a: create a new threat in a threat model and update the local cache (mutates shared state)
  createThreat(threatModelId: string, threat: Partial<ApiThreatInput>): Observable<Threat> {
    return this.apiService
      .post<Threat>(`threat_models/${threatModelId}/threats`, threat as Record<string, unknown>)
      .pipe(
        tap(newThreat => {
          const cached = this._cachedThreatModels.get(threatModelId);
          if (cached) {
            cached.threats = [
              ...(cached.threats || []),
              this.migrateLegacyThreatFieldValues(newThreat),
            ];
            this._cachedThreatModels.set(threatModelId, cached);
          }
        }),
        catchError(error => {
          this.logger.error(`Error creating threat in threat model ID: ${threatModelId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update a threat in a threat model
   */
  // SEM@927891249844e3e7afb3d58ade16df953f84bbdb: replace a threat via full PUT update and sync the local cache entry (mutates shared state)
  updateThreat(
    threatModelId: string,
    threatId: string,
    threat: Partial<ApiThreatInput>,
  ): Observable<Threat> {
    return this.apiService
      .put<Threat>(
        `threat_models/${threatModelId}/threats/${threatId}`,
        threat as Record<string, unknown>,
      )
      .pipe(
        tap(updatedThreat => {
          const cached = this._cachedThreatModels.get(threatModelId);
          if (cached?.threats) {
            const index = cached.threats.findIndex(t => t.id === threatId);
            if (index !== -1) {
              cached.threats[index] = this.migrateLegacyThreatFieldValues(updatedThreat);
              this._cachedThreatModels.set(threatModelId, cached);
            }
          }
        }),
        catchError(error => {
          this.logger.error(`Error updating threat ID: ${threatId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Delete a threat from a threat model
   */
  // SEM@1b06f54a4dfc3c06e46a9e215d93c5772c365178: delete a threat from the API and evict it from the local cache (mutates shared state)
  deleteThreat(threatModelId: string, threatId: string): Observable<boolean> {
    return this.apiService.delete(`threat_models/${threatModelId}/threats/${threatId}`).pipe(
      map(() => true),
      tap(() => {
        const cached = this._cachedThreatModels.get(threatModelId);
        if (cached?.threats) {
          cached.threats = cached.threats.filter(t => t.id !== threatId);
          this._cachedThreatModels.set(threatModelId, cached);
        }
      }),
      catchError(error => {
        this.logger.error(`Error deleting threat ID: ${threatId}`, error);
        throw error;
      }),
    );
  }

  /**
   * Create a new document in a threat model
   */
  // SEM@927891249844e3e7afb3d58ade16df953f84bbdb: create a new document within a threat model via the API
  createDocument(
    threatModelId: string,
    document: Partial<ApiDocumentInput>,
  ): Observable<TMDocument> {
    return this.apiService
      .post<TMDocument>(
        `threat_models/${threatModelId}/documents`,
        document as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error creating document in threat model ID: ${threatModelId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update a document in a threat model
   */
  // SEM@927891249844e3e7afb3d58ade16df953f84bbdb: update an existing document in a threat model via the API
  updateDocument(
    threatModelId: string,
    documentId: string,
    document: Partial<ApiDocumentInput>,
  ): Observable<TMDocument> {
    return this.apiService
      .put<TMDocument>(
        `threat_models/${threatModelId}/documents/${documentId}`,
        document as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating document ID: ${documentId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Get a single document by ID. Useful for refreshing access diagnostics
   * without reloading the whole threat model.
   */
  // SEM@414984dadc9232b9a98bc7dcc3c927eb0d907dfe: fetch a single document by ID from the API
  getDocument(threatModelId: string, documentId: string): Observable<TMDocument> {
    return this.apiService
      .get<TMDocument>(`threat_models/${threatModelId}/documents/${documentId}`)
      .pipe(
        catchError(error => {
          this.logger.error(`Error fetching document ID: ${documentId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Re-send the access request for a document with pending_access status.
   * Server returns {status, message}; callers should follow up with getDocument
   * to read the new access state.
   */
  // SEM@414984dadc9232b9a98bc7dcc3c927eb0d907dfe: re-send an access request for a document with pending_access status
  requestDocumentAccess(
    threatModelId: string,
    documentId: string,
  ): Observable<{ status?: string; message?: string }> {
    return this.apiService
      .post<{
        status?: string;
        message?: string;
      }>(`threat_models/${threatModelId}/documents/${documentId}/request_access`, {})
      .pipe(
        catchError(error => {
          this.logger.error(`Error requesting access for document ID: ${documentId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Delete a document from a threat model
   */
  // SEM@f00078975a399e34498cd79dfc36d65d7f68c4a9: delete a document from a threat model via the API
  deleteDocument(threatModelId: string, documentId: string): Observable<boolean> {
    return this.apiService.delete(`threat_models/${threatModelId}/documents/${documentId}`).pipe(
      map(() => true),
      catchError(error => {
        this.logger.error(`Error deleting document ID: ${documentId}`, error);
        throw error;
      }),
    );
  }

  /**
   * Create a new repository in a threat model
   */
  // SEM@927891249844e3e7afb3d58ade16df953f84bbdb: create a new repository within a threat model via the API
  createRepository(
    threatModelId: string,
    repository: Partial<ApiRepositoryInput>,
  ): Observable<Repository> {
    return this.apiService
      .post<Repository>(
        `threat_models/${threatModelId}/repositories`,
        repository as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(
            `Error creating repository in threat model ID: ${threatModelId}`,
            error,
          );
          throw error;
        }),
      );
  }

  /**
   * Update a repository in a threat model
   */
  // SEM@927891249844e3e7afb3d58ade16df953f84bbdb: update an existing repository in a threat model via the API
  updateRepository(
    threatModelId: string,
    repositoryId: string,
    repository: Partial<ApiRepositoryInput>,
  ): Observable<Repository> {
    return this.apiService
      .put<Repository>(
        `threat_models/${threatModelId}/repositories/${repositoryId}`,
        repository as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating repository ID: ${repositoryId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Delete a repository from a threat model
   */
  // SEM@49eb7e7e833ee0ab440b0ac33b2873d626065d8e: delete a repository from a threat model via the API
  deleteRepository(threatModelId: string, repositoryId: string): Observable<boolean> {
    return this.apiService
      .delete(`threat_models/${threatModelId}/repositories/${repositoryId}`)
      .pipe(
        map(() => true),
        catchError(error => {
          this.logger.error(`Error deleting repository ID: ${repositoryId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Create a new diagram in a threat model
   */
  // SEM@49590bd79bc6fb53c9853f6850b5a5113fafa37a: create a new diagram within a threat model via the API
  createDiagram(threatModelId: string, diagram: Partial<ApiBaseDiagramInput>): Observable<Diagram> {
    return this.apiService
      .post<Diagram>(`threat_models/${threatModelId}/diagrams`, diagram as Record<string, unknown>)
      .pipe(
        catchError(error => {
          this.logger.error(`Error creating diagram in threat model ID: ${threatModelId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update a diagram using PUT (full replacement).
   * Used during import to add cells after initial diagram creation.
   */
  // SEM@927891249844e3e7afb3d58ade16df953f84bbdb: replace a diagram in full (PUT) within a threat model via the API
  updateDiagram(
    threatModelId: string,
    diagramId: string,
    diagram: Partial<ApiDfdDiagramInput>,
  ): Observable<Diagram> {
    return this.apiService
      .put<Diagram>(
        `threat_models/${threatModelId}/diagrams/${diagramId}`,
        diagram as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(
            `Error updating diagram ${diagramId} in threat model ID: ${threatModelId}`,
            error,
          );
          throw error;
        }),
      );
  }

  /**
   * Patch diagram cells using JSON Patch operations
   * This method uses the PATCH endpoint specifically for diagram updates
   * instead of updating the entire threat model
   * NOTE: This should ONLY be called from the DFD editor
   */
  // SEM@a130f0a1556ca72349c607e4b63c8fc829d1ee3c: patch the cells collection of a diagram via JSON Patch on the API
  patchDiagramCells(threatModelId: string, diagramId: string, cells: Cell[]): Observable<Diagram> {
    // Create JSON Patch operations for the cells update
    // Note: Do not include modified_at - the server manages timestamps automatically
    const operations = [
      {
        op: 'replace' as const,
        path: '/cells',
        value: cells,
      },
    ];

    // this.logger.debugComponent(
    // 'ThreatModelService',
    // `Patching diagram cells for diagram ID: ${diagramId} via API`,
    // { threatModelId, diagramId, cellCount: cells.length },
    // );

    return this.apiService
      .patch<Diagram>(`threat_models/${threatModelId}/diagrams/${diagramId}`, operations)
      .pipe(
        catchError(error => {
          this.logger.error(`Error patching diagram cells for diagram ID: ${diagramId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Patch diagram cells and image data for a specific diagram
   * This method updates both cells and image data using JSON Patch operations
   * NOTE: This should ONLY be called from the DFD editor
   */
  // SEM@a130f0a1556ca72349c607e4b63c8fc829d1ee3c: patch diagram cells and SVG image together via JSON Patch on the API
  patchDiagramWithImage(
    threatModelId: string,
    diagramId: string,
    cells: Cell[],
    imageData: { svg?: string; update_vector?: number },
  ): Observable<Diagram> {
    // Build operations array for both cells and image
    // Exclude update_vector from image data when sending PATCH request
    const { update_vector, ...imageDataForPatch } = imageData;

    const operations = [
      {
        op: 'replace' as const,
        path: '/cells',
        value: cells,
      },
      {
        op: 'replace' as const,
        path: '/image',
        value: imageDataForPatch,
      },
    ];

    // this.logger.debugComponent(
    // 'ThreatModelService',
    // `Patching diagram cells and image for diagram ID: ${diagramId} via API`,
    // { threatModelId, diagramId, cellCount: cells.length, hasImageData: !!imageData.svg },
    // );

    return this.apiService
      .patch<Diagram>(`threat_models/${threatModelId}/diagrams/${diagramId}`, operations)
      .pipe(
        catchError(error => {
          this.logger.error(
            `Error patching diagram with image for diagram ID: ${diagramId}`,
            error,
          );
          throw error;
        }),
      );
  }

  /**
   * Patch diagram properties (name, description) using JSON Patch operations.
   * Used to update diagram metadata from the DFD editor header.
   */
  // SEM@a5d47afbe751f0027d056ced66949574212e626e: patch diagram metadata fields (name, description, flags) via JSON Patch on the API
  patchDiagramProperties(
    threatModelId: string,
    diagramId: string,
    properties: {
      name?: string;
      description?: string;
      include_in_report?: boolean;
      timmy_enabled?: boolean;
    },
  ): Observable<Diagram> {
    const operations: { op: 'replace'; path: string; value: string | boolean }[] = [];

    if (properties.name !== undefined) {
      operations.push({
        op: 'replace' as const,
        path: '/name',
        value: properties.name,
      });
    }

    if (properties.description !== undefined) {
      operations.push({
        op: 'replace' as const,
        path: '/description',
        value: properties.description,
      });
    }

    if (properties.include_in_report !== undefined) {
      operations.push({
        op: 'replace' as const,
        path: '/include_in_report',
        value: properties.include_in_report,
      });
    }

    if (properties.timmy_enabled !== undefined) {
      operations.push({
        op: 'replace' as const,
        path: '/timmy_enabled',
        value: properties.timmy_enabled,
      });
    }

    if (operations.length === 0) {
      return throwError(() => new Error('No properties to update'));
    }

    return this.apiService
      .patch<Diagram>(`threat_models/${threatModelId}/diagrams/${diagramId}`, operations)
      .pipe(
        catchError(error => {
          this.logger.error(
            `Error patching diagram properties for diagram ID: ${diagramId}`,
            error,
          );
          throw error;
        }),
      );
  }

  /**
   * Delete a diagram from a threat model
   */
  // SEM@f00078975a399e34498cd79dfc36d65d7f68c4a9: delete a diagram from a threat model via the API
  deleteDiagram(threatModelId: string, diagramId: string): Observable<boolean> {
    return this.apiService.delete(`threat_models/${threatModelId}/diagrams/${diagramId}`).pipe(
      map(() => true),
      catchError(error => {
        this.logger.error(`Error deleting diagram ID: ${diagramId}`, error);
        throw error;
      }),
    );
  }

  /**
   * Get metadata for a threat model
   */
  // SEM@f14fec6272b6f26ecf3a67156a44b8adf5c11b9e: fetch all metadata entries for a threat model from the API
  getThreatModelMetadata(threatModelId: string): Observable<Metadata[]> {
    return this.apiService.get<Metadata[]>(`threat_models/${threatModelId}/metadata`).pipe(
      catchError(error => {
        this.logger.error(`Error getting metadata for threat model ID: ${threatModelId}`, error);
        throw error;
      }),
    );
  }

  /**
   * Update metadata for a threat model
   */
  // SEM@f13ec757be108a4f5d813a807a4438208391aaa5: bulk-replace all metadata entries for a threat model via the API
  updateThreatModelMetadata(threatModelId: string, metadata: Metadata[]): Observable<Metadata[]> {
    return this.apiService
      .put<Metadata[]>(
        `threat_models/${threatModelId}/metadata/bulk`,
        (metadata || []) as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating metadata for threat model ID: ${threatModelId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Get metadata for a diagram
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: fetch all metadata entries for a diagram from the API
  getDiagramMetadata(threatModelId: string, diagramId: string): Observable<Metadata[]> {
    return this.apiService
      .get<Metadata[]>(`threat_models/${threatModelId}/diagrams/${diagramId}/metadata`)
      .pipe(
        catchError(error => {
          this.logger.error(`Error getting metadata for diagram ID: ${diagramId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update metadata for a diagram
   */
  // SEM@f13ec757be108a4f5d813a807a4438208391aaa5: bulk-replace all metadata entries for a diagram via the API
  updateDiagramMetadata(
    threatModelId: string,
    diagramId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.apiService
      .put<Metadata[]>(
        `threat_models/${threatModelId}/diagrams/${diagramId}/metadata/bulk`,
        (metadata || []) as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating metadata for diagram ID: ${diagramId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Get the minimal diagram model for automated analysis
   * Returns content in the specified format (json, yaml, or graphml)
   * @param threatModelId The threat model ID
   * @param diagramId The diagram ID
   * @param format Output format: 'json', 'yaml', or 'graphml'
   * @returns Observable containing the model content as a string
   */
  // SEM@c8b44d53aa73c272895d22bee4b90d835c0dcba0: fetch the diagram model for automated analysis in json, yaml, or graphml format
  getDiagramModel(
    threatModelId: string,
    diagramId: string,
    format: 'json' | 'yaml' | 'graphml',
  ): Observable<string> {
    const endpoint = `threat_models/${threatModelId}/diagrams/${diagramId}/model`;

    // For JSON, use the standard get method and stringify the response
    // For YAML and GraphML, use getText to avoid JSON parsing
    if (format === 'json') {
      return this.apiService.get<object>(endpoint, { format }).pipe(
        map(response => JSON.stringify(response, null, 2)),
        catchError(error => {
          this.logger.error(
            `Error getting diagram model for diagram ID: ${diagramId} in format: ${format}`,
            error,
          );
          throw error;
        }),
      );
    }

    // YAML and GraphML return text content
    return this.apiService.getText(endpoint, { format }).pipe(
      catchError(error => {
        this.logger.error(
          `Error getting diagram model for diagram ID: ${diagramId} in format: ${format}`,
          error,
        );
        throw error;
      }),
    );
  }

  /**
   * Get metadata for a threat
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: fetch all metadata entries for a threat from the API
  getThreatMetadata(threatModelId: string, threatId: string): Observable<Metadata[]> {
    return this.apiService
      .get<Metadata[]>(`threat_models/${threatModelId}/threats/${threatId}/metadata`)
      .pipe(
        catchError(error => {
          this.logger.error(`Error getting metadata for threat ID: ${threatId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update metadata for a threat
   */
  // SEM@f13ec757be108a4f5d813a807a4438208391aaa5: bulk-replace all metadata entries for a threat via the API
  updateThreatMetadata(
    threatModelId: string,
    threatId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.apiService
      .put<Metadata[]>(
        `threat_models/${threatModelId}/threats/${threatId}/metadata/bulk`,
        (metadata || []) as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating metadata for threat ID: ${threatId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Get metadata for a document
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: fetch all metadata entries for a document from the API
  getDocumentMetadata(threatModelId: string, documentId: string): Observable<Metadata[]> {
    return this.apiService
      .get<Metadata[]>(`threat_models/${threatModelId}/documents/${documentId}/metadata`)
      .pipe(
        catchError(error => {
          this.logger.error(`Error getting metadata for document ID: ${documentId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update metadata for a document
   */
  // SEM@f13ec757be108a4f5d813a807a4438208391aaa5: bulk-replace all metadata entries for a document via the API
  updateDocumentMetadata(
    threatModelId: string,
    documentId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.apiService
      .put<Metadata[]>(
        `threat_models/${threatModelId}/documents/${documentId}/metadata/bulk`,
        (metadata || []) as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating metadata for document ID: ${documentId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Get metadata for a repository
   */
  // SEM@49eb7e7e833ee0ab440b0ac33b2873d626065d8e: fetch all metadata entries for a repository from the API
  getRepositoryMetadata(threatModelId: string, repositoryId: string): Observable<Metadata[]> {
    return this.apiService
      .get<Metadata[]>(`threat_models/${threatModelId}/repositories/${repositoryId}/metadata`)
      .pipe(
        catchError(error => {
          this.logger.error(`Error getting metadata for repository ID: ${repositoryId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update metadata for a repository
   */
  // SEM@f13ec757be108a4f5d813a807a4438208391aaa5: update bulk metadata for a threat model repository via the API
  updateRepositoryMetadata(
    threatModelId: string,
    repositoryId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.apiService
      .put<Metadata[]>(
        `threat_models/${threatModelId}/repositories/${repositoryId}/metadata/bulk`,
        (metadata || []) as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating metadata for repository ID: ${repositoryId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Create a new note for a threat model
   */
  // SEM@49590bd79bc6fb53c9853f6850b5a5113fafa37a: create a new note on a threat model via the API
  createNote(threatModelId: string, note: Partial<ApiNoteInput>): Observable<Note> {
    return this.apiService
      .post<Note>(`threat_models/${threatModelId}/notes`, note as Record<string, unknown>)
      .pipe(
        catchError(error => {
          this.logger.error(`Error creating note for threat model ID: ${threatModelId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Get a single note by ID with full content
   */
  // SEM@3f2ef70d50160b7e609c1ffc5884f66ac1ce3264: fetch a single threat model note by ID; returns undefined on error
  getNoteById(threatModelId: string, noteId: string): Observable<Note | undefined> {
    return this.apiService.get<Note>(`threat_models/${threatModelId}/notes/${noteId}`).pipe(
      catchError(error => {
        this.logger.error(`Error fetching note with ID: ${noteId}`, error);
        return of(undefined);
      }),
    );
  }

  /**
   * Update an existing note
   */
  // SEM@49590bd79bc6fb53c9853f6850b5a5113fafa37a: update an existing threat model note via the API
  updateNote(threatModelId: string, noteId: string, note: Partial<ApiNoteInput>): Observable<Note> {
    return this.apiService
      .put<Note>(`threat_models/${threatModelId}/notes/${noteId}`, note as Record<string, unknown>)
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating note ID: ${noteId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Delete a note
   */
  // SEM@21283931c91448ecb7cf01ca0b545369c3e2c20d: delete a threat model note via the API; emits true on success
  deleteNote(threatModelId: string, noteId: string): Observable<boolean> {
    return this.apiService.delete(`threat_models/${threatModelId}/notes/${noteId}`).pipe(
      map(() => true),
      catchError(error => {
        this.logger.error(`Error deleting note ID: ${noteId}`, error);
        throw error;
      }),
    );
  }

  /**
   * Get metadata for a note
   */
  // SEM@21283931c91448ecb7cf01ca0b545369c3e2c20d: fetch metadata entries for a threat model note via the API
  getNoteMetadata(threatModelId: string, noteId: string): Observable<Metadata[]> {
    return this.apiService
      .get<Metadata[]>(`threat_models/${threatModelId}/notes/${noteId}/metadata`)
      .pipe(
        catchError(error => {
          this.logger.error(`Error getting metadata for note ID: ${noteId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update metadata for a note
   */
  // SEM@f13ec757be108a4f5d813a807a4438208391aaa5: update bulk metadata for a threat model note via the API
  updateNoteMetadata(
    threatModelId: string,
    noteId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.apiService
      .put<Metadata[]>(
        `threat_models/${threatModelId}/notes/${noteId}/metadata/bulk`,
        (metadata || []) as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating metadata for note ID: ${noteId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Get assets for a threat model with optional pagination
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: fetch a paginated asset list for a threat model; returns empty list on error
  getAssetsForThreatModel(
    threatModelId: string,
    limit?: number,
    offset?: number,
  ): Observable<ListAssetsResponse> {
    const params: Record<string, string> = {};
    if (limit !== undefined) params['limit'] = limit.toString();
    if (offset !== undefined) params['offset'] = offset.toString();

    return this.apiService
      .get<ListAssetsResponse>(`threat_models/${threatModelId}/assets`, params)
      .pipe(
        catchError(error => {
          this.logger.error(
            `Error fetching assets for threat model with ID: ${threatModelId}`,
            error,
          );
          return of({ assets: [], total: 0, limit: 0, offset: 0 });
        }),
      );
  }

  /**
   * Create a new asset for a threat model
   */
  // SEM@49590bd79bc6fb53c9853f6850b5a5113fafa37a: create a new asset on a threat model via the API
  createAsset(threatModelId: string, asset: Partial<ApiAssetInput>): Observable<Asset> {
    return this.apiService
      .post<Asset>(`threat_models/${threatModelId}/assets`, asset as Record<string, unknown>)
      .pipe(
        catchError(error => {
          this.logger.error(`Error creating asset for threat model ID: ${threatModelId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update an existing asset
   */
  // SEM@49590bd79bc6fb53c9853f6850b5a5113fafa37a: update an existing threat model asset via the API
  updateAsset(
    threatModelId: string,
    assetId: string,
    asset: Partial<ApiAssetInput>,
  ): Observable<Asset> {
    return this.apiService
      .put<Asset>(
        `threat_models/${threatModelId}/assets/${assetId}`,
        asset as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating asset ID: ${assetId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Delete an asset
   */
  // SEM@54d0f3a2232e51902c498754f4e3f3b790df794e: delete a threat model asset via the API; emits true on success
  deleteAsset(threatModelId: string, assetId: string): Observable<boolean> {
    return this.apiService.delete(`threat_models/${threatModelId}/assets/${assetId}`).pipe(
      map(() => true),
      catchError(error => {
        this.logger.error(`Error deleting asset ID: ${assetId}`, error);
        throw error;
      }),
    );
  }

  /**
   * Get metadata for an asset
   */
  // SEM@54d0f3a2232e51902c498754f4e3f3b790df794e: fetch metadata entries for a threat model asset; returns empty list on error
  getAssetMetadata(threatModelId: string, assetId: string): Observable<Metadata[]> {
    return this.apiService
      .get<Metadata[]>(`threat_models/${threatModelId}/assets/${assetId}/metadata`)
      .pipe(
        catchError(error => {
          this.logger.error(`Error fetching metadata for asset ID: ${assetId}`, error);
          return of([]);
        }),
      );
  }

  /**
   * Update metadata for an asset
   */
  // SEM@f13ec757be108a4f5d813a807a4438208391aaa5: update bulk metadata for a threat model asset via the API
  updateAssetMetadata(
    threatModelId: string,
    assetId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.apiService
      .put<Metadata[]>(
        `threat_models/${threatModelId}/assets/${assetId}/metadata/bulk`,
        (metadata || []) as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating metadata for asset ID: ${assetId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Clean up resources when the service is destroyed
   */
  // SEM@e76f8b25fc95148874fb5211bdbe3450854792e0: complete subjects and clear cache on service destruction (mutates shared state)
  ngOnDestroy(): void {
    this._threatModelListSubject.complete();
    this._cachedThreatModels.clear();
  }

  /**
   * Convert a full ThreatModel to a TMListItem
   * Note: TMListItem uses string for owner/created_by (email addresses),
   * Both ThreatModel and TMListItem now use User objects for owner/created_by.
   */
  // SEM@85c97d704e5197f893d6e6ce1a6b8a0763d47d21: convert a full ThreatModel to a summary list item with counts (pure)
  private convertToListItem(threatModel: ThreatModel): TMListItem {
    return {
      id: threatModel.id,
      name: threatModel.name,
      description: threatModel.description,
      created_at: threatModel.created_at,
      modified_at: threatModel.modified_at,
      owner: threatModel.owner,
      created_by: threatModel.created_by,
      threat_model_framework: threatModel.threat_model_framework,
      issue_uri: threatModel.issue_uri,
      status: threatModel.status,
      status_updated: threatModel.status_updated,
      document_count: threatModel.documents?.length || 0,
      repo_count: threatModel.repositories?.length || 0,
      diagram_count: threatModel.diagrams?.length || 0,
      threat_count: threatModel.threats?.length || 0,
      asset_count: threatModel.assets?.length || 0,
      note_count: threatModel.notes?.length || 0,
    };
  }

  /**
   * Expire all cached threat models except the specified one
   */
  // SEM@e2a977f3ac5871495f1b0d8d71c426f0b109bbc8: evict all cached threat models except one from the in-memory cache (mutates shared state)
  private expireAllCachedModelsExcept(keepId: string): void {
    const keysToDelete = Array.from(this._cachedThreatModels.keys()).filter(id => id !== keepId);
    keysToDelete.forEach(id => this._cachedThreatModels.delete(id));

    if (keysToDelete.length > 0) {
      // this.logger.debugComponent('ThreatModelService', 'Expired cached threat models', {
      //   expiredCount: keysToDelete.length,
      //   keptId: keepId,
      // });
    }
  }

  /**
   * Start a collaboration session for a diagram
   * @param threatModelId The threat model ID
   * @param diagramId The diagram ID
   * @returns Observable<CollaborationSession>
   */
  // SEM@a7d070cec042b44aeb8938d8dbe3942da8ee7dcf: start a new diagram collaboration session via the API; emits the session
  startDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<CollaborationSession> {
    this.logger.debugComponent('ThreatModelService', 'Starting diagram collaboration session', {
      threatModelId,
      diagramId,
      currentUser: this.authService.username,
      userEmail: this.authService.userEmail,
      isAuthenticated: this.authService.isAuthenticated,
    });

    return this.apiService
      .post<CollaborationSession>(
        `threat_models/${threatModelId}/diagrams/${diagramId}/collaborate`,
        {},
      )
      .pipe(
        tap(session => {
          this.logger.info('Collaboration session started', {
            sessionId: session.session_id,
            threatModelId,
            diagramId,
            websocketUrl: session.websocket_url,
            host: session.host,
            participantCount: session.participants?.length || 0,
            participants: session.participants?.map(p => ({
              id: `${p.user.provider}:${p.user.provider_id}`, // Use composite key as ID
              email: p.user.email || '',
              displayName: p.user.display_name,
              permissions: p.permissions,
              last_activity: p.last_activity,
            })),
          });
        }),
        catchError((error: unknown) => {
          if (isHttpErrorResponse(error)) {
            this.logger.error('Error starting collaboration session - detailed server error', {
              threatModelId,
              diagramId,
              error,
              errorStatus: error.status,
              errorMessage: error.message,
              errorBody: error.error as unknown,
              errorUrl: error.url,
            });
          } else {
            this.logger.error('Error starting collaboration session - unknown error', {
              threatModelId,
              diagramId,
              error,
            });
          }
          return throwError(() => (error instanceof Error ? error : new Error(String(error))));
        }),
      );
  }

  /**
   * End a collaboration session for a diagram
   * @param threatModelId The threat model ID
   * @param diagramId The diagram ID
   * @returns Observable<void>
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: delete the active diagram collaboration session via the API
  endDiagramCollaborationSession(threatModelId: string, diagramId: string): Observable<void> {
    this.logger.info('Ending diagram collaboration session', { threatModelId, diagramId });

    return this.apiService
      .delete<void>(`threat_models/${threatModelId}/diagrams/${diagramId}/collaborate`)
      .pipe(
        tap(() => {
          this.logger.info('Collaboration session ended', { threatModelId, diagramId });
        }),
        catchError((error: unknown) => {
          this.logger.error('Error ending collaboration session', error);
          return throwError(() => (error instanceof Error ? error : new Error(String(error))));
        }),
      );
  }

  /**
   * Get current collaboration session for a diagram
   * @param threatModelId The threat model ID
   * @param diagramId The diagram ID
   * @returns Observable<CollaborationSession | null>
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: fetch the active diagram collaboration session; returns null if none exists
  getDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<CollaborationSession | null> {
    this.logger.debugComponent('ThreatModelService', 'Getting diagram collaboration session', {
      threatModelId,
      diagramId,
    });

    return this.apiService
      .get<CollaborationSession>(`threat_models/${threatModelId}/diagrams/${diagramId}/collaborate`)
      .pipe(
        map((response: CollaborationSession) => {
          // Validate that the response is a valid collaboration session
          // An empty object {} should be treated as no session
          if (!response || !response.session_id) {
            this.logger.debugComponent(
              'ThreatModelService',
              'No active collaboration session exists',
              response,
            );
            return null;
          }
          return response;
        }),
        catchError((error: { status: number }) => {
          if (error.status === 404) {
            // No active session
            return of(null);
          }
          this.logger.error('Error getting collaboration session', error);
          return throwError(() => error);
        }),
      );
  }

  /**
   * Smart session handler: Try to create a session, if it exists then return it
   * This implements the proper collaboration flow without PUT calls
   * @param threatModelId The threat model ID
   * @param diagramId The diagram ID
   * @returns Observable<CollaborationSession> with isNewSession flag
   */
  // SEM@100c6575bc9479b3c50fbce4efb07771c02e68cb: fetch or create a diagram collaboration session, handling race conditions (reads API)
  startOrJoinDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<{ session: CollaborationSession; isNewSession: boolean }> {
    this.logger.debugComponent(
      'ThreatModelService',
      'Smart session handler: checking for existing session before creating',
      {
        threatModelId,
        diagramId,
      },
    );

    // First, check if a session already exists
    return this.getDiagramCollaborationSession(threatModelId, diagramId).pipe(
      switchMap((existingSession: CollaborationSession | null) => {
        if (existingSession) {
          // Session exists, return it (participants connect via WebSocket)
          this.logger.debugComponent(
            'ThreatModelService',
            'Found existing session, returning it for WebSocket connection',
            {
              sessionId: existingSession.session_id,
              threatModelId,
              diagramId,
            },
          );

          return of({ session: existingSession, isNewSession: false });
        } else {
          // No session exists, create a new one
          this.logger.debugComponent(
            'ThreatModelService',
            'No existing session found, creating new session',
            {
              threatModelId,
              diagramId,
            },
          );

          return this.startDiagramCollaborationSession(threatModelId, diagramId).pipe(
            map(session => {
              this.logger.info('Session created successfully', { sessionId: session.session_id });
              return { session, isNewSession: true };
            }),
            catchError((error: unknown) => {
              // Handle 409 for race conditions where a session might be created
              // between our check and the POST request
              if (isHttpErrorResponse(error) && error.status === 409) {
                this.logger.info(
                  'Race condition detected: session created after our check, fetching it',
                  {
                    threatModelId,
                    diagramId,
                    errorStatus: error.status,
                  },
                );

                return this.getDiagramCollaborationSession(threatModelId, diagramId).pipe(
                  map(session => {
                    if (!session) {
                      throw new Error('Session should exist after 409 but GET returned null');
                    }
                    this.logger.info('Successfully fetched session after race condition', {
                      sessionId: session.session_id,
                    });
                    return { session, isNewSession: false };
                  }),
                );
              }

              // For other errors, re-throw
              this.logger.error('Smart session handler failed during session creation', {
                threatModelId,
                diagramId,
                error,
              });
              return throwError(() => error);
            }),
          );
        }
      }),
    );
  }

  /**
   * Retry strategy with exponential backoff for transient failures
   * @param errors Observable of errors
   * @param operation Description of the operation for logging
   * @returns Observable for retry logic
   */
  // SEM@199afb71dcd141f16d7dad3caaa1b7a3d6c17ce5: build an exponential-backoff retry strategy for transient API failures (pure)
  private getRetryStrategy<T>(errors: Observable<T>, operation: string): Observable<unknown> {
    return errors.pipe(
      mergeMap((error, retryAttempt) => {
        const isRetryableError = this.isRetryableError(error);
        const maxRetries = 3;

        if (!isRetryableError || retryAttempt >= maxRetries) {
          // Don't retry for non-retryable errors or if max attempts reached
          this.logger.error(`No more retries for ${operation}`, {
            error,
            retryAttempt,
            isRetryableError,
            maxRetries,
          });
          return throwError(() => error);
        }

        // Calculate exponential backoff delay: 1s, 2s, 4s
        const delayMs = Math.pow(2, retryAttempt) * 1000;

        this.logger.warn(
          `Retrying ${operation} (attempt ${retryAttempt + 1}/${maxRetries}) after ${delayMs}ms delay`,
          {
            error: getErrorMessage(error),
            delayMs,
          },
        );

        return timer(delayMs);
      }),
      take(3), // Maximum 3 retry attempts
    );
  }

  /**
   * Determine if an error is retryable (network issues, server errors, timeouts)
   * @param error The error to check
   * @returns true if error is retryable, false otherwise
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: classify an API error as retryable (5xx, network, timeout) or not (pure)
  private isRetryableError(error: unknown): boolean {
    if (error instanceof HttpErrorResponse) {
      // Retry for server errors (5xx), timeout errors, or network errors
      if (error.status >= 500 && error.status < 600) {
        return true; // Server errors
      }
      if (error.status === 0) {
        return true; // Network error (no connection)
      }
      if (error.status === 408) {
        return true; // Request timeout
      }
      // Don't retry for client errors (4xx) like validation, auth, not found, etc.
      return false;
    }

    if (error instanceof Error) {
      // Retry for timeout errors from RxJS timeout operator
      if (error.name === 'TimeoutError') {
        return true;
      }
      // Retry for network-related errors
      if (error.message.includes('timeout') || error.message.includes('network')) {
        return true;
      }
    }

    // Don't retry for unknown error types
    return false;
  }
}
