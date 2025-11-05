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
import { v4 as uuidv4 } from 'uuid';
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
 * User information from the API
 */
interface ApiUser {
  user_id: string;
  email: string;
  displayName: string;
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
import { MockDataService } from '../../../mocks/mock-data.service';

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
    private mockDataService: MockDataService,
    private authService: AuthService,
    private authorizationService: ThreatModelAuthorizationService,
    private importOrchestrator: ImportOrchestratorService,
    private fieldFilter: ReadonlyFieldFilterService,
  ) {
    this.logger.debugComponent('ThreatModelService', 'ThreatModelService initialized');
  }

  /**
   * Check if we're in offline mode (standalone with no server)
   * In offline mode: local provider only, mock data, no API calls, no collaboration
   */
  private get isOfflineMode(): boolean {
    return this.authService.isUsingLocalProvider;
  }

  /**
   * Get threat model list items (lightweight data for dashboard)
   * Always fetches fresh data from API to minimize stale data issues
   */
  getThreatModelList(forceRefresh: boolean = false): Observable<TMListItem[]> {
    this.logger.debugComponent(
      'ThreatModelService',
      'ThreatModelService.getThreatModelList called',
      {
        isOfflineMode: this.isOfflineMode,
        threatModelListCount: this._threatModelList.length,
        forceRefresh: forceRefresh,
        models: this._threatModelList.map(tm => ({ id: tm.id, name: tm.name })),
      },
    );

    if (this.isOfflineMode) {
      this.logger.info('Offline mode - returning mock threat model list');
      // Load mock threat models from MockDataService
      const mockModels = this.mockDataService.getMockThreatModels();
      this._threatModelList = mockModels.map(tm => this.convertToListItem(tm));
      this._threatModelListSubject.next(this._threatModelList);
      return this._threatModelListSubject.asObservable();
    }

    // For API mode, always fetch fresh data to ensure up-to-date information
    this.logger.debugComponent(
      'ThreatModelService',
      'API mode - fetching fresh threat model list from API',
    );
    this.fetchThreatModelListFromAPI();

    // Always return the reactive subject for consistent behavior
    return this._threatModelListSubject.asObservable();
  }

  /**
   * Force refresh the threat model list from the API
   */
  refreshThreatModelList(): void {
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - skipping threat model list refresh');
    } else {
      this.logger.debugComponent('ThreatModelService', 'Force refreshing threat model list');
      this.fetchThreatModelListFromAPI();
    }
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
          this.logger.debugComponent('ThreatModelService', 'Updated threat model list from API', {
            count: threatModelList.length,
            items: threatModelList.map(tm => ({ id: tm.id, name: tm.name })),
          });
        }),
        catchError(error => {
          this.logger.error('Error fetching threat model list', error);
          this._threatModelListSubject.next([]);
          return of([]);
        }),
      )
      .subscribe({
        next: () => {
          this.logger.debugComponent('ThreatModelService', 'Threat model list fetch completed');
        },
        error: error => {
          this.logger.error('Unexpected error in threat model list subscription', error);
        },
      });
  }

  /**
   * @deprecated Use getThreatModelList() for dashboard, getThreatModelById() for editing
   * Get all threat models (backwards compatibility)
   */
  getThreatModels(): Observable<ThreatModel[]> {
    this.logger.warn(
      'getThreatModels() is deprecated. Use getThreatModelList() for dashboard or getThreatModelById() for editing.',
    );

    // Return empty array to encourage migration to new methods
    return of([]);
  }

  /**
   * Get a full threat model by ID (for editing)
   */
  getThreatModelById(
    id: string,
    forceRefresh: boolean = false,
  ): Observable<ThreatModel | undefined> {
    // In offline mode, use cache or load from MockDataService
    if (this.isOfflineMode) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Offline mode - returning threat model with ID: ${id}`,
      );

      // Check cache first
      let threatModel = this._cachedThreatModels.get(id);

      // If not in cache, load from MockDataService
      if (!threatModel) {
        threatModel = this.mockDataService.getMockThreatModels().find(tm => tm.id === id);
        if (threatModel) {
          this._cachedThreatModels.set(id, threatModel);
        }
      }

      // Update authorization service with the threat model's authorization
      if (threatModel) {
        this.authorizationService.setAuthorization(threatModel.id, threatModel.authorization);
      }

      return of(threatModel);
    }

    // Check cache first unless force refresh is requested
    if (this._cachedThreatModels.has(id) && !forceRefresh) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Returning cached threat model with ID: ${id}`,
      );
      const cachedModel = this._cachedThreatModels.get(id);

      // Update authorization service with the cached threat model's authorization
      if (cachedModel) {
        this.authorizationService.setAuthorization(cachedModel.id, cachedModel.authorization);
      }

      return of(cachedModel);
    }

    // Fetch from API and cache the result
    this.logger.debugComponent(
      'ThreatModelService',
      `Fetching threat model with ID: ${id} from API`,
      { forceRefresh },
    );
    return this.apiService.get<ThreatModel>(`threat_models/${id}`).pipe(
      map(threatModel => {
        if (threatModel) {
          // Migrate legacy field values in all threats
          if (threatModel.threats) {
            threatModel.threats = threatModel.threats.map(threat =>
              this.migrateLegacyThreatFieldValues(threat),
            );
          }
        }
        return threatModel;
      }),
      tap(threatModel => {
        if (threatModel) {
          // Cache the full model and expire all other cached models
          this.expireAllCachedModelsExcept(id);
          this._cachedThreatModels.set(id, threatModel);
          this.logger.debugComponent(
            'ThreatModelService',
            `Cached threat model ${id} and expired others`,
            { cacheSize: this._cachedThreatModels.size },
          );

          // Update authorization service with the loaded threat model's authorization
          this.authorizationService.setAuthorization(threatModel.id, threatModel.authorization);
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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        return of({
          id: threatModel.id,
          name: threatModel.name,
          description: threatModel.description,
          owner: threatModel.owner,
          created_at: threatModel.created_at,
          modified_at: threatModel.modified_at,
        });
      }
      return of(undefined);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - returning diagrams from cache');
      const cachedModel = this._cachedThreatModels.get(threatModelId);
      return of(cachedModel?.diagrams || []);
    }

    // In a real implementation, this would call the API
    this.logger.debugComponent(
      'ThreatModelService',
      `Fetching diagrams for threat model with ID: ${threatModelId} from API`,
    );
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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - returning diagram from cache');
      const cachedModel = this._cachedThreatModels.get(threatModelId);
      const diagram = cachedModel?.diagrams?.find(d => d.id === diagramId);
      return of(diagram);
    }

    // In a real implementation, this would call the API
    this.logger.debugComponent(
      'ThreatModelService',
      `Fetching diagram with ID: ${diagramId} from API`,
    );
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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - returning documents from cache');
      const cachedModel = this._cachedThreatModels.get(threatModelId);
      return of(cachedModel?.documents || []);
    }

    this.logger.debugComponent(
      'ThreatModelService',
      `Fetching documents for threat model with ID: ${threatModelId} from API`,
    );
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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - returning repositories from cache');
      const cachedModel = this._cachedThreatModels.get(threatModelId);
      return of(cachedModel?.repositories || []);
    }

    this.logger.debugComponent(
      'ThreatModelService',
      `Fetching repositories for threat model with ID: ${threatModelId} from API`,
    );
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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - returning notes from cache');
      const cachedModel = this._cachedThreatModels.get(threatModelId);
      return of(cachedModel?.notes || []);
    }

    this.logger.debugComponent(
      'ThreatModelService',
      `Fetching notes for threat model with ID: ${threatModelId} from API`,
    );
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

    if (this.isOfflineMode) {
      this.logger.info('Offline mode - creating threat model with mock data');

      const now = new Date().toISOString();
      const currentUser = this.authService.userEmail || 'anonymous@example.com';

      // Use MockDataService to create threat model with proper mock data structure
      const newThreatModel = this.mockDataService.createThreatModel({
        id: uuidv4(),
        name,
        description,
        created_at: now,
        modified_at: now,
        owner: currentUser,
        created_by: currentUser,
        threat_model_framework: validFramework,
        issue_uri: issueUrl,
        authorization: [
          {
            subject: currentUser,
            subject_type: 'user',
            role: 'owner',
          },
        ],
        metadata: [],
        diagrams: [],
        threats: [],
      });

      // Add to both the list and cache
      const listItem = this.convertToListItem(newThreatModel);
      this._threatModelList.push(listItem);
      this._threatModelListSubject.next([...this._threatModelList]);
      this._cachedThreatModels.set(newThreatModel.id, newThreatModel);

      this.logger.debugComponent('ThreatModelService', 'Created in-memory threat model', {
        id: newThreatModel.id,
        name: newThreatModel.name,
        totalInList: this._threatModelList.length,
      });

      return of(newThreatModel);
    }

    // In a real implementation, this would call the API
    this.logger.debugComponent('ThreatModelService', 'Creating threat model via API');
    const body = {
      name,
      description,
      threat_model_framework: validFramework,
      issue_uri: issueUrl,
    };

    return this.apiService.post<ThreatModel>('threat_models', body).pipe(
      tap(newThreatModel => {
        if (newThreatModel) {
          // Add the new threat model to the list cache and notify subscribers
          const listItem = this.convertToListItem(newThreatModel);
          this._threatModelList.push(listItem);
          this._threatModelListSubject.next([...this._threatModelList]);

          // Cache the full model
          this._cachedThreatModels.set(newThreatModel.id, newThreatModel);

          this.logger.debugComponent('ThreatModelService', 'Added new threat model to cache', {
            id: newThreatModel.id,
            name: newThreatModel.name,
            totalInList: this._threatModelList.length,
          });
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

    if (this.isOfflineMode) {
      // Generate a new ID to avoid conflicts
      const importedModel: ThreatModel = {
        ...data,
        id: uuidv4(),
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        created_by: this.authService.userEmail || 'imported',
        owner: this.authService.userEmail || 'imported',
        threat_model_framework:
          data.threat_model_framework && data.threat_model_framework.trim() !== ''
            ? data.threat_model_framework
            : 'STRIDE', // Provide default if missing or empty
        authorization: data.authorization || [], // Provide default if missing
      };
      // Add to both the list and cache the full model
      const listItem = this.convertToListItem(importedModel);
      this._threatModelList.push(listItem);
      this._threatModelListSubject.next([...this._threatModelList]);
      this._cachedThreatModels.set(importedModel.id, importedModel);

      this.logger.debugComponent('ThreatModelService', 'Imported threat model to offline cache', {
        newId: importedModel.id,
        name: importedModel.name,
        totalCount: this._threatModelList.length,
      });
      return of({ model: importedModel });
    } else {
      // For API mode, always create a new threat model
      this.logger.debugComponent('ThreatModelService', 'Creating new threat model via API');

      return this.createNewThreatModelFromImport(data).pipe(
        map(newModel => ({ model: newModel })),
        catchError(error => {
          this.logger.error('Failed to import threat model via API', error);
          throw error;
        }),
      );
    }
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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - updating threat model in cache only');

      // Update in cache
      threatModel.modified_at = new Date().toISOString();
      this._cachedThreatModels.set(threatModel.id, { ...threatModel });

      // Update in list
      const listIndex = this._threatModelList.findIndex(tm => tm.id === threatModel.id);
      if (listIndex !== -1) {
        this._threatModelList[listIndex] = this.convertToListItem(threatModel);
        this._threatModelListSubject.next([...this._threatModelList]);
      }

      return of(this._cachedThreatModels.get(threatModel.id)!);
    }

    // In a real implementation, this would call the API
    this.logger.debugComponent(
      'ThreatModelService',
      `Updating threat model with ID: ${threatModel.id} via API`,
    );
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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - patching threat model in cache only');

      const cachedModel = this._cachedThreatModels.get(threatModelId);
      if (cachedModel) {
        // Apply updates to cached model
        const updatedModel = {
          ...cachedModel,
          ...updates,
          modified_at: new Date().toISOString(),
        };
        this._cachedThreatModels.set(threatModelId, updatedModel);

        // Update in list
        const listIndex = this._threatModelList.findIndex(tm => tm.id === threatModelId);
        if (listIndex !== -1) {
          this._threatModelList[listIndex] = this.convertToListItem(updatedModel);
          this._threatModelListSubject.next([...this._threatModelList]);
        }

        // Notify authorization service if authorization was updated
        if (updates.authorization) {
          this.authorizationService.updateAuthorization(updatedModel.authorization);
        }

        return of(updatedModel);
      } else {
        throw new Error(`Threat model with ID ${threatModelId} not found in cache`);
      }
    }

    // Convert updates to JSON Patch operations
    // Note: Do not include modified_at - the server manages timestamps automatically
    const operations = Object.entries(updates).map(([key, value]) => ({
      op: 'replace' as const,
      path: `/${key}`,
      value,
    }));

    this.logger.debugComponent(
      'ThreatModelService',
      `Patching threat model with ID: ${threatModelId} via API`,
      { updates, operations },
    );

    return this.apiService.patch<ThreatModel>(`threat_models/${threatModelId}`, operations).pipe(
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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - deleting threat model from cache only');

      const initialLength = this._threatModelList.length;
      this._threatModelList = this._threatModelList.filter(tm => tm.id !== id);
      const wasDeleted = this._threatModelList.length < initialLength;

      if (wasDeleted) {
        // Remove from cache
        this._cachedThreatModels.delete(id);

        // Notify all subscribers of the updated threat model list
        this._threatModelListSubject.next([...this._threatModelList]);
        this.logger.debugComponent(
          'ThreatModelService',
          'Updated threat model list after deletion',
          {
            remainingCount: this._threatModelList.length,
            deletedId: id,
          },
        );
      }

      return of(wasDeleted);
    }

    // In a real implementation, this would call the API
    this.logger.debugComponent(
      'ThreatModelService',
      `Deleting threat model with ID: ${id} via API`,
    );
    return this.apiService.delete<void>(`threat_models/${id}`).pipe(
      tap(() => {
        // Successful delete (204 No Content) - remove from local cache and notify subscribers
        this._threatModelList = this._threatModelList.filter(tm => tm.id !== id);
        this._cachedThreatModels.delete(id);
        this._threatModelListSubject.next([...this._threatModelList]);
        this.logger.debugComponent(
          'ThreatModelService',
          'Updated threat model list after API deletion',
          {
            remainingCount: this._threatModelList.length,
            deletedId: id,
          },
        );
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
   * Convert numeric field keys back to legacy string values for API compatibility
   * The frontend uses numeric keys (0-5 for severity, etc.) but the backend expects
   * the old string values ('low', 'medium', 'high', etc.)
   * Mapping: Critical=0, High=1, Medium=2, Low=3, Informational=4, Unknown=5
   */
  private convertToLegacyFieldValues(threat: Partial<Threat>): Partial<Threat> {
    const converted = { ...threat };

    // Severity: numeric key to lowercase string
    if (converted.severity) {
      const severityMap: Record<string, string> = {
        '0': 'critical',
        '1': 'high',
        '2': 'medium',
        '3': 'low',
        '4': 'informational',
        '5': 'unknown',
      };
      converted.severity = severityMap[converted.severity] || converted.severity;
    }

    // Priority: numeric key to lowercase string
    if (converted.priority) {
      const priorityMap: Record<string, string> = {
        '0': 'immediate',
        '1': 'high',
        '2': 'medium',
        '3': 'low',
        '4': 'deferred',
      };
      converted.priority = priorityMap[converted.priority] || converted.priority;
    }

    // Status: numeric key to lowercase string
    if (converted.status) {
      const statusMap: Record<string, string> = {
        '0': 'open',
        '1': 'confirmed',
        '2': 'mitigation planned',
        '3': 'mitigation in progress',
        '4': 'verification pending',
        '5': 'resolved',
        '6': 'accepted',
        '7': 'false positive',
        '8': 'deferred',
        '9': 'closed',
      };
      converted.status = statusMap[converted.status] || converted.status;
    }

    return converted;
  }

  /**
   * Create a new threat in a threat model
   */
  createThreat(threatModelId: string, threat: Partial<Threat>): Observable<Threat> {
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - creating threat in cache only');

      const newThreat: Threat = {
        ...threat,
        id: uuidv4(),
        threat_model_id: threatModelId,
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
      } as Threat;

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        // Create a deep copy of the threats array to avoid mutating mock data
        const updatedThreats = [...(threatModel.threats || []), newThreat];
        const updatedThreatModel = {
          ...threatModel,
          threats: updatedThreats,
          modified_at: new Date().toISOString(),
        };
        this._cachedThreatModels.set(threatModelId, updatedThreatModel);
      }
      return of(newThreat);
    }

    // Remove id, created_at, and modified_at fields from threat data before sending to API
    const { id, created_at, modified_at, ...threatData } = threat as Threat;

    // Convert numeric field keys to legacy string values for API
    const convertedThreatData = this.convertToLegacyFieldValues(threatData);

    return this.apiService
      .post<Threat>(
        `threat_models/${threatModelId}/threats`,
        convertedThreatData as unknown as Record<string, unknown>,
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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - updating threat in cache only');
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.threats) {
        const index = threatModel.threats.findIndex(t => t.id === threatId);
        if (index !== -1) {
          // Create a deep copy of the threats array to avoid mutating mock data
          const updatedThreat = {
            ...threatModel.threats[index],
            ...threat,
            modified_at: new Date().toISOString(),
          };
          const updatedThreats = [
            ...threatModel.threats.slice(0, index),
            updatedThreat,
            ...threatModel.threats.slice(index + 1),
          ];
          const updatedThreatModel = {
            ...threatModel,
            threats: updatedThreats,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
          return of(updatedThreat);
        }
      }
      return of(threat as Threat);
    }

    // Remove server-managed fields from threat data before sending to API
    const { created_at, modified_at, ...threatData } = threat as Threat;

    // Convert numeric field keys to legacy string values for API
    const convertedThreatData = this.convertToLegacyFieldValues(threatData);

    return this.apiService
      .put<Threat>(
        `threat_models/${threatModelId}/threats/${threatId}`,
        convertedThreatData as unknown as Record<string, unknown>,
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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - deleting threat from cache only');

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.threats) {
        const initialLength = threatModel.threats.length;
        // Create a deep copy of the threats array to avoid mutating mock data
        const filteredThreats = threatModel.threats.filter(t => t.id !== threatId);
        const wasDeleted = filteredThreats.length < initialLength;
        if (wasDeleted) {
          const updatedThreatModel = {
            ...threatModel,
            threats: filteredThreats,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
        }
        return of(wasDeleted);
      }
      return of(false);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - creating document in cache only');

      const newDocument: TMDocument = {
        ...document,
        id: uuidv4(),
        metadata: [],
      } as TMDocument;

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        // Create a deep copy of the documents array to avoid mutating mock data
        const updatedDocuments = [...(threatModel.documents || []), newDocument];
        const updatedThreatModel = {
          ...threatModel,
          documents: updatedDocuments,
          modified_at: new Date().toISOString(),
        };
        this._cachedThreatModels.set(threatModelId, updatedThreatModel);
      }
      return of(newDocument);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - updating document in cache only');

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.documents) {
        const index = threatModel.documents.findIndex(d => d.id === documentId);
        if (index !== -1) {
          // Create a deep copy of the documents array to avoid mutating mock data
          const updatedDocument = { ...threatModel.documents[index], ...document };
          const updatedDocuments = [
            ...threatModel.documents.slice(0, index),
            updatedDocument,
            ...threatModel.documents.slice(index + 1),
          ];
          const updatedThreatModel = {
            ...threatModel,
            documents: updatedDocuments,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
          return of(updatedDocument);
        }
      }
      return of(document as TMDocument);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - deleting document from cache only');

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.documents) {
        const initialLength = threatModel.documents.length;
        // Create a deep copy of the documents array to avoid mutating mock data
        const filteredDocuments = threatModel.documents.filter(d => d.id !== documentId);
        const wasDeleted = filteredDocuments.length < initialLength;
        if (wasDeleted) {
          const updatedThreatModel = {
            ...threatModel,
            documents: filteredDocuments,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
        }
        return of(wasDeleted);
      }
      return of(false);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - creating repository in cache only');

      const newRepository: Repository = {
        ...repository,
        id: uuidv4(),
        metadata: [],
      } as Repository;

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        // Create a deep copy of the repositories array to avoid mutating mock data
        const updatedRepositories = [...(threatModel.repositories || []), newRepository];
        const updatedThreatModel = {
          ...threatModel,
          repositories: updatedRepositories,
          modified_at: new Date().toISOString(),
        };
        this._cachedThreatModels.set(threatModelId, updatedThreatModel);
      }
      return of(newRepository);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - updating repository in cache only');

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.repositories) {
        const index = threatModel.repositories.findIndex(r => r.id === repositoryId);
        if (index !== -1) {
          // Create a deep copy of the repositories array to avoid mutating mock data
          const updatedRepository = { ...threatModel.repositories[index], ...repository };
          const updatedRepositories = [
            ...threatModel.repositories.slice(0, index),
            updatedRepository,
            ...threatModel.repositories.slice(index + 1),
          ];
          const updatedThreatModel = {
            ...threatModel,
            repositories: updatedRepositories,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
          return of(updatedRepository);
        }
      }
      return of(repository as Repository);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - deleting repository from cache only');

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.repositories) {
        const initialLength = threatModel.repositories.length;
        // Create a deep copy of the repositories array to avoid mutating mock data
        const filteredRepositories = threatModel.repositories.filter(r => r.id !== repositoryId);
        const wasDeleted = filteredRepositories.length < initialLength;
        if (wasDeleted) {
          const updatedThreatModel = {
            ...threatModel,
            repositories: filteredRepositories,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
        }
        return of(wasDeleted);
      }
      return of(false);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - creating diagram in cache only');

      const newDiagram: Diagram = {
        ...diagram,
        id: uuidv4(),
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        metadata: [],
        cells: [],
      } as Diagram;

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        // Create a deep copy of the diagrams array to avoid mutating mock data
        const updatedDiagrams = [...(threatModel.diagrams || []), newDiagram];
        const updatedThreatModel = {
          ...threatModel,
          diagrams: updatedDiagrams,
          modified_at: new Date().toISOString(),
        };
        this._cachedThreatModels.set(threatModelId, updatedThreatModel);
      }
      return of(newDiagram);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - updating diagram in cache only');

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.diagrams) {
        const diagramIndex = threatModel.diagrams.findIndex(d => d.id === diagramId);
        if (diagramIndex !== -1) {
          const updatedDiagram: Diagram = {
            ...threatModel.diagrams[diagramIndex],
            ...diagram,
            id: diagramId,
            modified_at: new Date().toISOString(),
          } as Diagram;

          const updatedDiagrams = [...threatModel.diagrams];
          updatedDiagrams[diagramIndex] = updatedDiagram;

          const updatedThreatModel = {
            ...threatModel,
            diagrams: updatedDiagrams,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);

          return of(updatedDiagram);
        }
      }
      return throwError(() => new Error(`Diagram ${diagramId} not found in offline cache`));
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - patching diagram cells in memory only');

      // For local provider, simulate the patch operation (diagram is stored in localStorage via DFD service)
      const mockDiagram: Diagram = {
        id: diagramId,
        name: 'Local Diagram',
        type: 'DFD-1.0.0',
        cells: cells,
        metadata: [],
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
      };

      return of(mockDiagram);
    }

    // Create JSON Patch operations for the cells update
    // Note: Do not include modified_at - the server manages timestamps automatically
    const operations = [
      {
        op: 'replace' as const,
        path: '/cells',
        value: cells,
      },
    ];

    this.logger.debugComponent(
      'ThreatModelService',
      `Patching diagram cells for diagram ID: ${diagramId} via API`,
      { threatModelId, diagramId, cellCount: cells.length },
    );

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - patching diagram with image in memory only');

      // For offline mode, simulate the patch operation
      const mockDiagram: Diagram = {
        id: diagramId,
        name: 'Local Diagram',
        type: 'DFD-1.0.0',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        cells,
        image: imageData,
      };

      return of(mockDiagram);
    }

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

    this.logger.debugComponent(
      'ThreatModelService',
      `Patching diagram cells and image for diagram ID: ${diagramId} via API`,
      { threatModelId, diagramId, cellCount: cells.length, hasImageData: !!imageData.svg },
    );

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - deleting diagram from cache only');

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.diagrams) {
        const initialLength = threatModel.diagrams.length;
        // Create a deep copy of the diagrams array to avoid mutating mock data
        const filteredDiagrams = threatModel.diagrams.filter(d => d.id !== diagramId);
        const wasDeleted = filteredDiagrams.length < initialLength;
        if (wasDeleted) {
          const updatedThreatModel = {
            ...threatModel,
            diagrams: filteredDiagrams,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
        }
        return of(wasDeleted);
      }
      return of(false);
    }

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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      return of(threatModel?.metadata || []);
    }

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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        const updatedThreatModel = {
          ...threatModel,
          metadata: [...metadata],
          modified_at: new Date().toISOString(),
        };
        this._cachedThreatModels.set(threatModelId, updatedThreatModel);
      }
      return of(metadata);
    }

    // If metadata is empty, skip the API call and return empty array
    if (!metadata || metadata.length === 0) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Skipping metadata update for threat model ${threatModelId} - no valid metadata to save`,
        { threatModelId, metadataCount: metadata?.length || 0 },
      );
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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      const diagram = threatModel?.diagrams?.find(d => d.id === diagramId);
      return of(diagram?.metadata || []);
    }

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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.diagrams) {
        const diagramIndex = threatModel.diagrams.findIndex(d => d.id === diagramId);
        if (diagramIndex !== -1) {
          // Create deep copies to avoid mutating mock data
          const updatedDiagram = {
            ...threatModel.diagrams[diagramIndex],
            metadata: [...metadata],
          };
          const updatedDiagrams = [
            ...threatModel.diagrams.slice(0, diagramIndex),
            updatedDiagram,
            ...threatModel.diagrams.slice(diagramIndex + 1),
          ];
          const updatedThreatModel = {
            ...threatModel,
            diagrams: updatedDiagrams,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
        }
      }
      return of(metadata);
    }

    // If metadata is empty, skip the API call and return empty array
    if (!metadata || metadata.length === 0) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Skipping metadata update for diagram ${diagramId} - no valid metadata to save`,
        { threatModelId, diagramId, metadataCount: metadata?.length || 0 },
      );
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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      const threat = threatModel?.threats?.find(t => t.id === threatId);
      return of(threat?.metadata || []);
    }

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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.threats) {
        const threatIndex = threatModel.threats.findIndex(t => t.id === threatId);
        if (threatIndex !== -1) {
          // Create deep copies to avoid mutating mock data
          const updatedThreat = {
            ...threatModel.threats[threatIndex],
            metadata: [...metadata],
          };
          const updatedThreats = [
            ...threatModel.threats.slice(0, threatIndex),
            updatedThreat,
            ...threatModel.threats.slice(threatIndex + 1),
          ];
          const updatedThreatModel = {
            ...threatModel,
            threats: updatedThreats,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
        }
      }
      return of(metadata);
    }

    // If metadata is empty, skip the API call and return empty array
    if (!metadata || metadata.length === 0) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Skipping metadata update for threat ${threatId} - no valid metadata to save`,
        { threatModelId, threatId, metadataCount: metadata?.length || 0 },
      );
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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      const document = threatModel?.documents?.find(d => d.id === documentId);
      return of(document?.metadata || []);
    }

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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.documents) {
        const documentIndex = threatModel.documents.findIndex(d => d.id === documentId);
        if (documentIndex !== -1) {
          // Create deep copies to avoid mutating mock data
          const updatedDocument = {
            ...threatModel.documents[documentIndex],
            metadata: [...metadata],
          };
          const updatedDocuments = [
            ...threatModel.documents.slice(0, documentIndex),
            updatedDocument,
            ...threatModel.documents.slice(documentIndex + 1),
          ];
          const updatedThreatModel = {
            ...threatModel,
            documents: updatedDocuments,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
        }
      }
      return of(metadata);
    }

    // If metadata is empty, skip the API call and return empty array
    if (!metadata || metadata.length === 0) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Skipping metadata update for document ${documentId} - no valid metadata to save`,
        { threatModelId, documentId, metadataCount: metadata?.length || 0 },
      );
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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      const repository = threatModel?.repositories?.find(r => r.id === repositoryId);
      return of(repository?.metadata || []);
    }

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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.repositories) {
        const repositoryIndex = threatModel.repositories.findIndex(r => r.id === repositoryId);
        if (repositoryIndex !== -1) {
          // Create deep copies to avoid mutating mock data
          const updatedRepository = {
            ...threatModel.repositories[repositoryIndex],
            metadata: [...metadata],
          };
          const updatedRepositories = [
            ...threatModel.repositories.slice(0, repositoryIndex),
            updatedRepository,
            ...threatModel.repositories.slice(repositoryIndex + 1),
          ];
          const updatedThreatModel = {
            ...threatModel,
            repositories: updatedRepositories,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
        }
      }
      return of(metadata);
    }

    // If metadata is empty, skip the API call and return empty array
    if (!metadata || metadata.length === 0) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Skipping metadata update for repository ${repositoryId} - no valid metadata to save`,
        { threatModelId, repositoryId, metadataCount: metadata?.length || 0 },
      );
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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - creating note in cache only');

      const newNote: Note = {
        ...note,
        id: uuidv4(),
        metadata: [],
      } as Note;

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        const updatedNotes = [...(threatModel.notes || []), newNote];
        const updatedThreatModel = {
          ...threatModel,
          notes: updatedNotes,
          modified_at: new Date().toISOString(),
        };
        this._cachedThreatModels.set(threatModelId, updatedThreatModel);
      }
      return of(newNote);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - updating note in cache only');

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.notes) {
        const index = threatModel.notes.findIndex(n => n.id === noteId);
        if (index !== -1) {
          const updatedNote = { ...threatModel.notes[index], ...note };
          const updatedNotes = [
            ...threatModel.notes.slice(0, index),
            updatedNote,
            ...threatModel.notes.slice(index + 1),
          ];
          const updatedThreatModel = {
            ...threatModel,
            notes: updatedNotes,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
          return of(updatedNote);
        }
      }
      return of(note as Note);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - deleting note from cache only');

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.notes) {
        const initialLength = threatModel.notes.length;
        const filteredNotes = threatModel.notes.filter(n => n.id !== noteId);
        const wasDeleted = filteredNotes.length < initialLength;
        if (wasDeleted) {
          const updatedThreatModel = {
            ...threatModel,
            notes: filteredNotes,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
        }
        return of(wasDeleted);
      }
      return of(false);
    }

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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      const note = threatModel?.notes?.find(n => n.id === noteId);
      return of(note?.metadata || []);
    }

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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.notes) {
        const noteIndex = threatModel.notes.findIndex(n => n.id === noteId);
        if (noteIndex !== -1) {
          const updatedNote = {
            ...threatModel.notes[noteIndex],
            metadata: [...metadata],
          };
          const updatedNotes = [
            ...threatModel.notes.slice(0, noteIndex),
            updatedNote,
            ...threatModel.notes.slice(noteIndex + 1),
          ];
          const updatedThreatModel = {
            ...threatModel,
            notes: updatedNotes,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
        }
      }
      return of(metadata);
    }

    if (!metadata || metadata.length === 0) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Skipping metadata update for note ${noteId} - no valid metadata to save`,
        { threatModelId, noteId, metadataCount: metadata?.length || 0 },
      );
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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - returning assets from cache');
      const cachedModel = this._cachedThreatModels.get(threatModelId);
      return of(cachedModel?.assets || []);
    }

    this.logger.debugComponent(
      'ThreatModelService',
      `Fetching assets for threat model with ID: ${threatModelId} from API`,
    );
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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - creating asset in cache only');

      const newAsset: Asset = {
        ...asset,
        id: uuidv4(),
        metadata: [],
      } as Asset;

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        const updatedAssets = [...(threatModel.assets || []), newAsset];
        const updatedThreatModel = {
          ...threatModel,
          assets: updatedAssets,
          modified_at: new Date().toISOString(),
        };
        this._cachedThreatModels.set(threatModelId, updatedThreatModel);
      }
      return of(newAsset);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - updating asset in cache only');

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.assets) {
        const index = threatModel.assets.findIndex(a => a.id === assetId);
        if (index !== -1) {
          const updatedAsset = { ...threatModel.assets[index], ...asset };
          const updatedAssets = [
            ...threatModel.assets.slice(0, index),
            updatedAsset,
            ...threatModel.assets.slice(index + 1),
          ];
          const updatedThreatModel = {
            ...threatModel,
            assets: updatedAssets,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
          return of(updatedAsset);
        }
      }
      return of(asset as Asset);
    }

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
    if (this.isOfflineMode) {
      this.logger.info('Offline mode - deleting asset from cache only');

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.assets) {
        const initialLength = threatModel.assets.length;
        const filteredAssets = threatModel.assets.filter(a => a.id !== assetId);
        const wasDeleted = filteredAssets.length < initialLength;
        if (wasDeleted) {
          const updatedThreatModel = {
            ...threatModel,
            assets: filteredAssets,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
        }
        return of(wasDeleted);
      }
      return of(false);
    }

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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      const asset = threatModel?.assets?.find(a => a.id === assetId);
      return of(asset?.metadata || []);
    }

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
    if (this.isOfflineMode) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.assets) {
        const assetIndex = threatModel.assets.findIndex(a => a.id === assetId);
        if (assetIndex !== -1) {
          const updatedAsset = {
            ...threatModel.assets[assetIndex],
            metadata,
          };
          const updatedAssets = [
            ...threatModel.assets.slice(0, assetIndex),
            updatedAsset,
            ...threatModel.assets.slice(assetIndex + 1),
          ];
          const updatedThreatModel = {
            ...threatModel,
            assets: updatedAssets,
            modified_at: new Date().toISOString(),
          };
          this._cachedThreatModels.set(threatModelId, updatedThreatModel);
        }
      }
      return of(metadata);
    }

    if (!metadata || metadata.length === 0) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Skipping metadata update for asset ${assetId} - no valid metadata to save`,
        { threatModelId, assetId, metadataCount: metadata?.length || 0 },
      );
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
      this.logger.debugComponent('ThreatModelService', 'Expired cached threat models', {
        expiredCount: keysToDelete.length,
        keptId: keepId,
      });
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
    this.logger.info('Starting diagram collaboration session', {
      threatModelId,
      diagramId,
      currentUser: this.authService.username,
      userEmail: this.authService.userEmail,
      isAuthenticated: !!this.authService.getStoredToken(),
      isOfflineMode: this.isOfflineMode,
    });

    if (this.isOfflineMode) {
      // For offline mode, simulate a collaboration session
      const mockSession: CollaborationSession = {
        session_id: `session-${Date.now()}`,
        threat_model_id: threatModelId,
        threat_model_name: 'Mock Threat Model',
        diagram_id: diagramId,
        diagram_name: 'Mock Diagram',
        participants: [
          {
            user: {
              user_id: this.authService.username || 'current-user',
              email: this.authService.userEmail || 'current@example.com',
              displayName: this.authService.username || 'Current User',
            },
            last_activity: new Date().toISOString(),
            permissions: 'writer' as const,
          },
        ],
        websocket_url: `wss://api.example.com/threat_models/${threatModelId}/diagrams/${diagramId}/ws`,
        host: this.authService.username || 'current-user',
      };
      return of(mockSession);
    }

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
              id: p.user.user_id,
              email: p.user.email,
              displayName: p.user.displayName,
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

    if (this.isOfflineMode) {
      // For offline mode, just simulate success
      return of(undefined);
    }

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
    this.logger.info('Getting diagram collaboration session', { threatModelId, diagramId });

    if (this.isOfflineMode) {
      // For offline mode, return null (no active session)
      return of(null);
    }

    return this.apiService
      .get<CollaborationSession>(`threat_models/${threatModelId}/diagrams/${diagramId}/collaborate`)
      .pipe(
        map((response: CollaborationSession) => {
          // Validate that the response is a valid collaboration session
          // An empty object {} should be treated as no session
          if (!response || !response.session_id) {
            this.logger.debug('No active collaboration session exists', response);
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
    this.logger.info('Smart session handler: checking for existing session before creating', {
      threatModelId,
      diagramId,
    });

    if (this.isOfflineMode) {
      // For offline mode, always simulate creating a new session
      return this.startDiagramCollaborationSession(threatModelId, diagramId).pipe(
        map(session => ({ session, isNewSession: true })),
      );
    }

    // First, check if a session already exists
    return this.getDiagramCollaborationSession(threatModelId, diagramId).pipe(
      switchMap((existingSession: CollaborationSession | null) => {
        if (existingSession) {
          // Session exists, return it (participants connect via WebSocket)
          this.logger.info('Found existing session, returning it for WebSocket connection', {
            sessionId: existingSession.session_id,
            threatModelId,
            diagramId,
          });

          return of({ session: existingSession, isNewSession: false });
        } else {
          // No session exists, create a new one
          this.logger.info('No existing session found, creating new session', {
            threatModelId,
            diagramId,
          });

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
