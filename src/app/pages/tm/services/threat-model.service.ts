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
import { Observable, of, BehaviorSubject, throwError, timer } from 'rxjs';
import { catchError, switchMap, map, tap, retryWhen, mergeMap, take } from 'rxjs/operators';

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
  host: string;
  presenter?: string;
}
import { LoggerService } from '../../../core/services/logger.service';
import { ApiService } from '../../../core/services/api.service';

/**
 * Type guard to check if an error is an HttpErrorResponse
 */
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

@Injectable({
  providedIn: 'root',
})
export class ThreatModelService implements OnDestroy {
  private _threatModelList: TMListItem[] = [];
  private _cachedThreatModels = new Map<string, ThreatModel>();
  private _threatModelListSubject = new BehaviorSubject<TMListItem[]>([]);

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
   * Get threat model list items (lightweight data for dashboard)
   * Always fetches fresh data from API to minimize stale data issues
   */
  getThreatModelList(_forceRefresh: boolean = false): Observable<TMListItem[]> {
    // this.logger.debugComponent(
    //   'ThreatModelService',
    //   'ThreatModelService.getThreatModelList called',
    //   {
    //     threatModelListCount: this._threatModelList.length,
    //     forceRefresh: forceRefresh,
    //     models: this._threatModelList.map(tm => ({ id: tm.id, name: tm.name })),
    //   },
    // );

    // Always fetch fresh data to ensure up-to-date information
    // this.logger.debugComponent('ThreatModelService', 'Fetching fresh threat model list from API');
    this.fetchThreatModelListFromAPI();

    // Always return the reactive subject for consistent behavior
    return this._threatModelListSubject.asObservable();
  }

  /**
   * Force refresh the threat model list from the API
   */
  refreshThreatModelList(): void {
    // this.logger.debugComponent('ThreatModelService', 'Force refreshing threat model list');
    this.fetchThreatModelListFromAPI();
  }

  /**
   * Private method to fetch threat model list from API
   */
  private fetchThreatModelListFromAPI(): void {
    this.apiService
      .get<unknown>('threat_models')
      .pipe(
        tap(response => {
          let threatModelList: TMListItem[] = [];

          // Handle different possible response formats
          if (response && typeof response === 'object') {
            if ('data' in response && Array.isArray((response as { data: unknown }).data)) {
              // Paginated response with data property
              threatModelList = (response as { data: TMListItem[] }).data;
            } else if (Array.isArray(response)) {
              // Direct array response
              threatModelList = response as TMListItem[];
            }
          }

          this._threatModelList = threatModelList;
          this._threatModelListSubject.next(threatModelList);
          // this.logger.debugComponent('ThreatModelService', 'Updated threat model list from API', {
          //   count: threatModelList.length,
          //   items: threatModelList.map(tm => ({ id: tm.id, name: tm.name })),
          // });
        }),
        catchError(error => {
          this.logger.error('Error fetching threat model list', error);
          this._threatModelListSubject.next([]);
          return of([]);
        }),
      )
      .subscribe({
        next: () => {
          // this.logger.debugComponent('ThreatModelService', 'Threat model list fetch completed');
        },
        error: error => {
          this.logger.error('Unexpected error in threat model list subscription', error);
        },
      });
  }

  /**
   * Get a full threat model by ID (for editing)
   */
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
   * Get basic threat model info (name, id, etc.) without loading full data
   * This is more efficient than getThreatModelById when you only need basic info
   */
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
   * Get diagrams for a threat model
   */
  getDiagramsForThreatModel(threatModelId: string): Observable<Diagram[]> {
    // In a real implementation, this would call the API
    // this.logger.debugComponent(
    // 'ThreatModelService',
    // `Fetching diagrams for threat model with ID: ${threatModelId} from API`,
    // );
    return this.apiService.get<Diagram[]>(`threat_models/${threatModelId}/diagrams`).pipe(
      catchError(error => {
        this.logger.error(
          `Error fetching diagrams for threat model with ID: ${threatModelId}`,
          error,
        );
        return of([]);
      }),
    );
  }

  /**
   * Get a diagram by ID
   */
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
   * Get documents for a threat model
   */
  getDocumentsForThreatModel(threatModelId: string): Observable<TMDocument[]> {
    // this.logger.debugComponent(
    // 'ThreatModelService',
    // `Fetching documents for threat model with ID: ${threatModelId} from API`,
    // );
    return this.apiService.get<TMDocument[]>(`threat_models/${threatModelId}/documents`).pipe(
      catchError(error => {
        this.logger.error(
          `Error fetching documents for threat model with ID: ${threatModelId}`,
          error,
        );
        return of([]);
      }),
    );
  }

  /**
   * Get repository references for a threat model
   */
  getRepositoriesForThreatModel(threatModelId: string): Observable<Repository[]> {
    // this.logger.debugComponent(
    // 'ThreatModelService',
    // `Fetching repositories for threat model with ID: ${threatModelId} from API`,
    // );
    return this.apiService.get<Repository[]>(`threat_models/${threatModelId}/repositories`).pipe(
      catchError(error => {
        this.logger.error(
          `Error fetching repositories for threat model with ID: ${threatModelId}`,
          error,
        );
        return of([]);
      }),
    );
  }

  /**
   * Get notes for a threat model
   */
  getNotesForThreatModel(threatModelId: string): Observable<Note[]> {
    // this.logger.debugComponent(
    // 'ThreatModelService',
    // `Fetching notes for threat model with ID: ${threatModelId} from API`,
    // );
    return this.apiService.get<Note[]>(`threat_models/${threatModelId}/notes`).pipe(
      catchError(error => {
        this.logger.error(`Error fetching notes for threat model with ID: ${threatModelId}`, error);
        return of([]);
      }),
    );
  }

  /**
   * Create a new threat model
   */
  createThreatModel(
    name: string,
    description?: string,
    framework: 'STRIDE' | 'CIA' | 'LINDDUN' | 'DIE' | 'PLOT4ai' = 'STRIDE',
    issueUrl?: string,
  ): Observable<ThreatModel> {
    // Ensure framework is never empty - use STRIDE as default
    const validFramework = framework && framework.trim() !== '' ? framework : 'STRIDE';

    // this.logger.debugComponent('ThreatModelService', 'Creating threat model via API');
    const body = {
      name,
      description,
      threat_model_framework: validFramework,
      issue_uri: issueUrl,
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
  private createNewThreatModelFromImport(
    data: Partial<ThreatModel> & { id: string; name: string },
  ): Observable<ThreatModel> {
    this.logger.info('Starting orchestrated import of threat model with nested objects');

    // Use orchestrator to handle the complete import
    return this.importOrchestrator
      .orchestrateImport(data as Record<string, unknown>, {
        // Threat Model creation
        createThreatModel: tmData => {
          const { filtered } = this.fieldFilter.filterThreatModel(tmData);
          // Ensure required fields have defaults
          const body = {
            ...filtered,
            name: tmData['name'] || 'Untitled',
            description: (tmData['description'] as string) || '',
            threat_model_framework:
              tmData['threat_model_framework'] &&
              typeof tmData['threat_model_framework'] === 'string' &&
              tmData['threat_model_framework'].trim() !== ''
                ? tmData['threat_model_framework']
                : 'STRIDE',
          };
          return this.apiService.post<ThreatModel>('threat_models', body);
        },

        // Asset operations
        createAsset: (tmId, asset) => this.createAsset(tmId, asset as Partial<Asset>),

        // Note operations
        createNote: (tmId, note) => this.createNote(tmId, note as Partial<Note>),

        // Document operations
        createDocument: (tmId, document) =>
          this.createDocument(tmId, document as Partial<TMDocument>),

        // Repository operations
        createRepository: (tmId, repository) =>
          this.createRepository(tmId, repository as Partial<Repository>),

        // Diagram operations
        createDiagram: (tmId, diagram) => this.createDiagram(tmId, diagram as Partial<Diagram>),
        updateDiagram: (tmId, diagramId, diagram) =>
          this.updateDiagram(tmId, diagramId, diagram as Partial<Diagram>),

        // Threat operations
        createThreat: (tmId, threat) => this.createThreat(tmId, threat as Partial<Threat>),

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
  updateThreatModel(threatModel: ThreatModel): Observable<ThreatModel> {
    // In a real implementation, this would call the API
    // this.logger.debugComponent(
    // 'ThreatModelService',
    // `Updating threat model with ID: ${threatModel.id} via API`,
    // );
    // Remove server-managed fields from threat model data before sending to API
    const { created_at, modified_at, ...threatModelData } = threatModel;

    return this.apiService
      .put<ThreatModel>(
        `threat_models/${threatModel.id}`,
        threatModelData as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating threat model with ID: ${threatModel.id}`, error);
          throw error;
        }),
      );
  }

  /**
   * Partially update a threat model using PATCH with JSON Patch operations
   * @param threatModelId The threat model ID
   * @param updates Object containing the fields to update
   */
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
            updatedModel.authorization = updatedModel.authorization.map(auth => {
              const transformed = {
                ...auth,
                provider: this.providerAdapter.transformProviderForDisplay(auth.provider),
              };
              // Remove display_name which is a server-managed read-only field
              // This prevents it from being accidentally included in subsequent PATCH requests
              delete (transformed as { display_name?: string }).display_name;
              return transformed;
            });
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
   * Create a new threat in a threat model
   */
  createThreat(threatModelId: string, threat: Partial<Threat>): Observable<Threat> {
    // Remove id, created_at, and modified_at fields from threat data before sending to API
    const { id, created_at, modified_at, ...threatData } = threat as Threat;

    return this.apiService
      .post<Threat>(
        `threat_models/${threatModelId}/threats`,
        threatData as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error creating threat in threat model ID: ${threatModelId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update a threat in a threat model
   */
  updateThreat(
    threatModelId: string,
    threatId: string,
    threat: Partial<Threat>,
  ): Observable<Threat> {
    // Remove server-managed fields from threat data before sending to API
    const { created_at, modified_at, ...threatData } = threat as Threat;

    return this.apiService
      .put<Threat>(
        `threat_models/${threatModelId}/threats/${threatId}`,
        threatData as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating threat ID: ${threatId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Delete a threat from a threat model
   */
  deleteThreat(threatModelId: string, threatId: string): Observable<boolean> {
    return this.apiService.delete(`threat_models/${threatModelId}/threats/${threatId}`).pipe(
      map(() => true),
      catchError(error => {
        this.logger.error(`Error deleting threat ID: ${threatId}`, error);
        throw error;
      }),
    );
  }

  /**
   * Create a new document in a threat model
   */
  createDocument(threatModelId: string, document: Partial<TMDocument>): Observable<TMDocument> {
    // Remove id field from document data before sending to API (documents don't have timestamp fields)
    const { id, ...documentData } = document as TMDocument;

    return this.apiService
      .post<TMDocument>(
        `threat_models/${threatModelId}/documents`,
        documentData as unknown as Record<string, unknown>,
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
  updateDocument(
    threatModelId: string,
    documentId: string,
    document: Partial<TMDocument>,
  ): Observable<TMDocument> {
    return this.apiService
      .put<TMDocument>(
        `threat_models/${threatModelId}/documents/${documentId}`,
        document as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating document ID: ${documentId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Delete a document from a threat model
   */
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
  createRepository(threatModelId: string, repository: Partial<Repository>): Observable<Repository> {
    // Remove id field from repository data before sending to API (repositories don't have timestamp fields)
    const { id, ...repositoryData } = repository as Repository;

    return this.apiService
      .post<Repository>(
        `threat_models/${threatModelId}/repositories`,
        repositoryData as unknown as Record<string, unknown>,
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
  updateRepository(
    threatModelId: string,
    repositoryId: string,
    repository: Partial<Repository>,
  ): Observable<Repository> {
    return this.apiService
      .put<Repository>(
        `threat_models/${threatModelId}/repositories/${repositoryId}`,
        repository as unknown as Record<string, unknown>,
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
  createDiagram(threatModelId: string, diagram: Partial<Diagram>): Observable<Diagram> {
    // Remove id, created_at, and modified_at fields from diagram data before sending to API
    const { id, created_at, modified_at, ...diagramData } = diagram as Diagram;

    return this.apiService
      .post<Diagram>(
        `threat_models/${threatModelId}/diagrams`,
        diagramData as unknown as Record<string, unknown>,
      )
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
  updateDiagram(
    threatModelId: string,
    diagramId: string,
    diagram: Partial<Diagram>,
  ): Observable<Diagram> {
    return this.apiService
      .put<Diagram>(
        `threat_models/${threatModelId}/diagrams/${diagramId}`,
        diagram as unknown as Record<string, unknown>,
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
   * Delete a diagram from a threat model
   */
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
  updateThreatModelMetadata(threatModelId: string, metadata: Metadata[]): Observable<Metadata[]> {
    // If metadata is empty, skip the API call and return empty array
    if (!metadata || metadata.length === 0) {
      // this.logger.debugComponent(
      // 'ThreatModelService',
      // `Skipping metadata update for threat model ${threatModelId} - no valid metadata to save`,
      // { threatModelId, metadataCount: metadata?.length || 0 },
      // );
      return of([]);
    }

    return this.apiService
      .post<
        Metadata[]
      >(`threat_models/${threatModelId}/metadata/bulk`, metadata as unknown as Record<string, unknown>)
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
  updateDiagramMetadata(
    threatModelId: string,
    diagramId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    // If metadata is empty, skip the API call and return empty array
    if (!metadata || metadata.length === 0) {
      // this.logger.debugComponent(
      // 'ThreatModelService',
      // `Skipping metadata update for diagram ${diagramId} - no valid metadata to save`,
      // { threatModelId, diagramId, metadataCount: metadata?.length || 0 },
      // );
      return of([]);
    }

    return this.apiService
      .post<
        Metadata[]
      >(`threat_models/${threatModelId}/diagrams/${diagramId}/metadata/bulk`, metadata as unknown as Record<string, unknown>)
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating metadata for diagram ID: ${diagramId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Get metadata for a threat
   */
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
  updateThreatMetadata(
    threatModelId: string,
    threatId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    // If metadata is empty, skip the API call and return empty array
    if (!metadata || metadata.length === 0) {
      // this.logger.debugComponent(
      // 'ThreatModelService',
      // `Skipping metadata update for threat ${threatId} - no valid metadata to save`,
      // { threatModelId, threatId, metadataCount: metadata?.length || 0 },
      // );
      return of([]);
    }

    return this.apiService
      .post<
        Metadata[]
      >(`threat_models/${threatModelId}/threats/${threatId}/metadata/bulk`, metadata as unknown as Record<string, unknown>)
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
  updateDocumentMetadata(
    threatModelId: string,
    documentId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    // If metadata is empty, skip the API call and return empty array
    if (!metadata || metadata.length === 0) {
      // this.logger.debugComponent(
      // 'ThreatModelService',
      // `Skipping metadata update for document ${documentId} - no valid metadata to save`,
      // { threatModelId, documentId, metadataCount: metadata?.length || 0 },
      // );
      return of([]);
    }

    return this.apiService
      .post<
        Metadata[]
      >(`threat_models/${threatModelId}/documents/${documentId}/metadata/bulk`, metadata as unknown as Record<string, unknown>)
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
  updateRepositoryMetadata(
    threatModelId: string,
    repositoryId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    // If metadata is empty, skip the API call and return empty array
    if (!metadata || metadata.length === 0) {
      // this.logger.debugComponent(
      // 'ThreatModelService',
      // `Skipping metadata update for repository ${repositoryId} - no valid metadata to save`,
      // { threatModelId, repositoryId, metadataCount: metadata?.length || 0 },
      // );
      return of([]);
    }

    return this.apiService
      .post<
        Metadata[]
      >(`threat_models/${threatModelId}/repositories/${repositoryId}/metadata/bulk`, metadata as unknown as Record<string, unknown>)
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
  createNote(threatModelId: string, note: Partial<Note>): Observable<Note> {
    const { id, ...noteData } = note as Note;

    return this.apiService
      .post<Note>(
        `threat_models/${threatModelId}/notes`,
        noteData as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error creating note for threat model ID: ${threatModelId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update an existing note
   */
  updateNote(threatModelId: string, noteId: string, note: Partial<Note>): Observable<Note> {
    const { id, ...noteData } = note as Note;

    return this.apiService
      .put<Note>(
        `threat_models/${threatModelId}/notes/${noteId}`,
        noteData as unknown as Record<string, unknown>,
      )
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
  updateNoteMetadata(
    threatModelId: string,
    noteId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    if (!metadata || metadata.length === 0) {
      // this.logger.debugComponent(
      // 'ThreatModelService',
      // `Skipping metadata update for note ${noteId} - no valid metadata to save`,
      // { threatModelId, noteId, metadataCount: metadata?.length || 0 },
      // );
      return of([]);
    }

    return this.apiService
      .post<
        Metadata[]
      >(`threat_models/${threatModelId}/notes/${noteId}/metadata/bulk`, metadata as unknown as Record<string, unknown>)
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating metadata for note ID: ${noteId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Get assets for a threat model
   */
  getAssetsForThreatModel(threatModelId: string): Observable<Asset[]> {
    // this.logger.debugComponent(
    // 'ThreatModelService',
    // `Fetching assets for threat model with ID: ${threatModelId} from API`,
    // );
    return this.apiService.get<Asset[]>(`threat_models/${threatModelId}/assets`).pipe(
      catchError(error => {
        this.logger.error(
          `Error fetching assets for threat model with ID: ${threatModelId}`,
          error,
        );
        return of([]);
      }),
    );
  }

  /**
   * Create a new asset for a threat model
   */
  createAsset(threatModelId: string, asset: Partial<Asset>): Observable<Asset> {
    const { id, ...assetData } = asset as Asset;

    return this.apiService
      .post<Asset>(
        `threat_models/${threatModelId}/assets`,
        assetData as unknown as Record<string, unknown>,
      )
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
  updateAsset(threatModelId: string, assetId: string, asset: Partial<Asset>): Observable<Asset> {
    const { id, ...assetData } = asset as Asset;

    return this.apiService
      .put<Asset>(
        `threat_models/${threatModelId}/assets/${assetId}`,
        assetData as unknown as Record<string, unknown>,
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
  updateAssetMetadata(
    threatModelId: string,
    assetId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    if (!metadata || metadata.length === 0) {
      // this.logger.debugComponent(
      // 'ThreatModelService',
      // `Skipping metadata update for asset ${assetId} - no valid metadata to save`,
      // { threatModelId, assetId, metadataCount: metadata?.length || 0 },
      // );
      return of([]);
    }

    return this.apiService
      .post<
        Metadata[]
      >(`threat_models/${threatModelId}/assets/${assetId}/metadata/bulk`, metadata as unknown as Record<string, unknown>)
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
  ngOnDestroy(): void {
    this._threatModelListSubject.complete();
    this._cachedThreatModels.clear();
  }

  /**
   * Convert a full ThreatModel to a TMListItem
   */
  private convertToListItem(threatModel: ThreatModel): TMListItem {
    return {
      id: threatModel.id,
      name: threatModel.name,
      description: threatModel.description,
      created_at: threatModel.created_at,
      modified_at: threatModel.modified_at,
      owner: threatModel.owner,
      created_by: threatModel.created_by,
      threat_model_framework:
        threatModel.threat_model_framework as TMListItem['threat_model_framework'],
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
  startDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<CollaborationSession> {
    this.logger.debugComponent('ThreatModelService', 'Starting diagram collaboration session', {
      threatModelId,
      diagramId,
      currentUser: this.authService.username,
      userEmail: this.authService.userEmail,
      isAuthenticated: !!this.authService.getStoredToken(),
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
            error: error instanceof Error ? error.message : String(error),
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
