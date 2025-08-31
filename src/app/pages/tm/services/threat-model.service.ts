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
import { Observable, of, Subscription, BehaviorSubject, throwError, timer } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { catchError, switchMap, map, tap, retryWhen, mergeMap, take } from 'rxjs/operators';

import {
  ThreatModel,
  Document as TMDocument,
  Source,
  Metadata,
  Threat,
} from '../models/threat-model.model';
import { TMListItem } from '../models/tm-list-item.model';
import { Diagram, Cell } from '../models/diagram.model';

/**
 * Collaboration session interface matching the API specification
 */
interface CollaborationSession {
  session_id: string;
  threat_model_id: string;
  diagram_id: string;
  participants: Array<{
    user_id: string;
    joined_at: string;
    permissions?: 'reader' | 'writer';
  }>;
  websocket_url: string;
  host?: string;
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

@Injectable({
  providedIn: 'root',
})
export class ThreatModelService implements OnDestroy {
  private _threatModelList: TMListItem[] = [];
  private _cachedThreatModels = new Map<string, ThreatModel>();
  private _useMockData = false;
  private _subscription: Subscription | null = null;
  private _threatModelListSubject = new BehaviorSubject<TMListItem[]>([]);

  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
    private mockDataService: MockDataService,
    private authService: AuthService,
    private authorizationService: ThreatModelAuthorizationService,
  ) {
    // Subscribe to the mock data toggle
    this._subscription = this.mockDataService.useMockData$.subscribe(useMock => {
      this._useMockData = useMock;
      this.logger.debugComponent(
        'ThreatModelService',
        `ThreatModelService using mock data: ${useMock}`,
        {
          useMock,
          threatModelsCount: useMock ? this.mockDataService.getMockThreatModels().length : 0,
        },
      );

      // Initialize threat model list based on the mock data setting
      if (useMock) {
        // Convert full mock models to list items
        const mockModels = this.mockDataService.getMockThreatModels();
        this._threatModelList = mockModels.map(tm => this.convertToListItem(tm));
        this._threatModelListSubject.next(this._threatModelList);
        this.logger.debugComponent(
          'ThreatModelService',
          'ThreatModelService loaded mock threat model list',
          {
            count: this._threatModelList.length,
            models: this._threatModelList.map(tm => ({ id: tm.id, name: tm.name })),
          },
        );
      } else {
        this._threatModelList = []; // Will be populated from API when needed
        this._threatModelListSubject.next(this._threatModelList);
        this.logger.debugComponent(
          'ThreatModelService',
          'ThreatModelService using API mode (empty list)',
        );
      }
    });
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
        useMockData: this._useMockData,
        threatModelListCount: this._threatModelList.length,
        forceRefresh: forceRefresh,
        models: this._threatModelList.map(tm => ({ id: tm.id, name: tm.name })),
      },
    );

    if (this._useMockData) {
      this.logger.debugComponent('ThreatModelService', 'Returning reactive mock threat model list');
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
    if (!this._useMockData) {
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
    if (this._useMockData) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Returning mock threat model with ID: ${id}`,
      );
      const threatModel = this.mockDataService.getMockThreatModels().find(tm => tm.id === id);

      // Update authorization service with the mock threat model's authorization
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
    if (this._useMockData) {
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
    if (this._useMockData) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Returning mock diagrams for threat model with ID: ${threatModelId}`,
      );
      return of(this.mockDataService.getMockDiagramsForThreatModel(threatModelId));
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
    if (this._useMockData) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Returning mock diagram with ID: ${diagramId}`,
      );
      return of(this.mockDataService.getMockDiagramById(diagramId));
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
    if (this._useMockData) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Returning mock documents for threat model with ID: ${threatModelId}`,
      );
      return of(
        this.mockDataService.getMockThreatModels().find(tm => tm.id === threatModelId)?.documents ||
          [],
      );
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
   * Get source code references for a threat model
   */
  getSourceCodeForThreatModel(threatModelId: string): Observable<Source[]> {
    if (this._useMockData) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Returning mock source code for threat model with ID: ${threatModelId}`,
      );
      return of(
        this.mockDataService.getMockThreatModels().find(tm => tm.id === threatModelId)
          ?.sourceCode || [],
      );
    }

    this.logger.debugComponent(
      'ThreatModelService',
      `Fetching source code for threat model with ID: ${threatModelId} from API`,
    );
    return this.apiService.get<Source[]>(`threat_models/${threatModelId}/sources`).pipe(
      catchError(error => {
        this.logger.error(
          `Error fetching source code for threat model with ID: ${threatModelId}`,
          error,
        );
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
    if (this._useMockData) {
      this.logger.debugComponent('ThreatModelService', 'Creating mock threat model');

      const now = new Date().toISOString();
      const currentUser = this.authService.userEmail || 'anonymous@example.com';

      const newThreatModel = this.mockDataService.createThreatModel({
        id: uuidv4(),
        name,
        description,
        created_at: now,
        modified_at: now,
        owner: currentUser,
        created_by: currentUser,
        threat_model_framework: framework || 'STRIDE',
        issue_url: issueUrl,
        authorization: [
          {
            subject: currentUser,
            role: 'owner',
          },
        ],
        metadata: [],
        diagrams: [],
        threats: [],
      });

      // Add to both the list and cache the full model
      const listItem = this.convertToListItem(newThreatModel);
      this._threatModelList.push(listItem);
      this._threatModelListSubject.next([...this._threatModelList]);
      this._cachedThreatModels.set(newThreatModel.id, newThreatModel);
      return of(newThreatModel);
    }

    // In a real implementation, this would call the API
    this.logger.debugComponent('ThreatModelService', 'Creating threat model via API');
    const body = {
      name,
      description,
      threat_model_framework: framework || 'STRIDE',
      issue_url: issueUrl,
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
   * Import a threat model from external JSON data
   * In API mode, checks for existing model and handles conflicts
   * @param data Validated threat model data from desktop file
   * @param conflictResolution Optional resolution for conflicts ('discard' | 'overwrite')
   */
  importThreatModel(
    data: Partial<ThreatModel> & { id: string; name: string },
    conflictResolution?: 'discard' | 'overwrite',
  ): Observable<{
    model: ThreatModel;
    conflict?: { existingModel: ThreatModel; action: 'prompt' | 'resolved' };
  }> {
    this.logger.info('Importing threat model', { originalId: data.id, name: data.name });

    if (this._useMockData) {
      // Generate a new ID to avoid conflicts
      const importedModel: ThreatModel = {
        ...data,
        id: uuidv4(),
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        created_by: this.authService.userEmail || 'imported',
        owner: this.authService.userEmail || 'imported',
        threat_model_framework: data.threat_model_framework || 'STRIDE', // Provide default if missing
        authorization: data.authorization || [], // Provide default if missing
      };
      // Add to both the list and cache the full model
      const listItem = this.convertToListItem(importedModel);
      this._threatModelList.push(listItem);
      this._threatModelListSubject.next([...this._threatModelList]);
      this._cachedThreatModels.set(importedModel.id, importedModel);

      this.logger.debugComponent('ThreatModelService', 'Imported threat model to mock data', {
        newId: importedModel.id,
        name: importedModel.name,
        totalCount: this._threatModelList.length,
      });
      return of({ model: importedModel });
    } else {
      // For API mode, check if threat model already exists
      this.logger.debugComponent('ThreatModelService', 'Checking for existing threat model in API');

      return this.getThreatModelById(data.id).pipe(
        switchMap(existingModel => {
          if (existingModel) {
            this.logger.debugComponent('ThreatModelService', 'Found existing threat model', {
              id: existingModel.id,
              name: existingModel.name,
            });

            // Handle conflict resolution
            if (conflictResolution === 'discard') {
              this.logger.info('Discarding loaded threat model due to conflict');
              return of({
                model: existingModel,
                conflict: { existingModel, action: 'resolved' as const },
              });
            } else if (conflictResolution === 'overwrite') {
              this.logger.info('Overwriting existing threat model');
              return this.updateExistingThreatModel(data).pipe(
                map(updatedModel => ({
                  model: updatedModel,
                  conflict: { existingModel, action: 'resolved' as const },
                })),
              );
            } else {
              // No resolution provided - return conflict for user prompt
              return of({
                model: existingModel,
                conflict: { existingModel, action: 'prompt' as const },
              });
            }
          } else {
            // No existing model found - create new one
            this.logger.debugComponent(
              'ThreatModelService',
              'No existing threat model found, creating new one',
            );
            return this.createNewThreatModelFromImport(data).pipe(
              map(newModel => ({ model: newModel })),
            );
          }
        }),
        catchError(error => {
          this.logger.error('Failed to import threat model via API', error);
          throw error;
        }),
      );
    }
  }

  /**
   * Create a new threat model from imported data
   */
  private createNewThreatModelFromImport(
    data: Partial<ThreatModel> & { id: string; name: string },
  ): Observable<ThreatModel> {
    // Remove the original ID and server-managed timestamps, let the server assign new ones
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, modified_at, ...importData } = data;

    const body = {
      name: data.name,
      description: data.description || '',
      threat_model_framework: data.threat_model_framework || 'STRIDE',
      issue_url: data.issue_url,
      // Include other relevant fields from the imported data, but exclude fields we've already set above
      ...Object.fromEntries(
        Object.entries(importData).filter(
          ([key]) => !['name', 'description', 'threat_model_framework', 'issue_url'].includes(key),
        ),
      ),
    };

    return this.apiService.post<ThreatModel>('threat_models', body);
  }

  /**
   * Update existing threat model with imported data
   */
  private updateExistingThreatModel(
    data: Partial<ThreatModel> & { id: string; name: string },
  ): Observable<ThreatModel> {
    // Preserve server-managed fields, update with imported data
    const updateData = {
      ...data,
      // Preserve server timestamp management
      modified_at: new Date().toISOString(),
    };

    return this.apiService.put<ThreatModel>(
      `threat_models/${data.id}`,
      updateData as unknown as Record<string, unknown>,
    );
  }

  /**
   * Update a threat model
   */
  updateThreatModel(threatModel: ThreatModel): Observable<ThreatModel> {
    if (this._useMockData) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Updating mock threat model with ID: ${threatModel.id}`,
      );

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
    return this.apiService
      .put<ThreatModel>(
        `threat_models/${threatModel.id}`,
        threatModel as unknown as Record<string, unknown>,
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
        'name' | 'description' | 'threat_model_framework' | 'issue_url' | 'authorization'
      >
    >,
  ): Observable<ThreatModel> {
    if (this._useMockData) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Patching mock threat model with ID: ${threatModelId}`,
        updates,
      );

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
    if (this._useMockData) {
      this.logger.debugComponent('ThreatModelService', `Deleting mock threat model with ID: ${id}`);

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
   * Create a new threat in a threat model
   */
  createThreat(threatModelId: string, threat: Partial<Threat>): Observable<Threat> {
    if (this._useMockData) {
      const newThreat: Threat = {
        ...threat,
        id: uuidv4(),
        threat_model_id: threatModelId,
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
      } as Threat;

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        if (!threatModel.threats) {
          threatModel.threats = [];
        }
        threatModel.threats.push(newThreat);
        threatModel.modified_at = new Date().toISOString();
        this._cachedThreatModels.set(threatModelId, { ...threatModel });
      }
      return of(newThreat);
    }

    return this.apiService
      .post<Threat>(
        `threat_models/${threatModelId}/threats`,
        threat as unknown as Record<string, unknown>,
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
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.threats) {
        const index = threatModel.threats.findIndex(t => t.id === threatId);
        if (index !== -1) {
          threatModel.threats[index] = {
            ...threatModel.threats[index],
            ...threat,
            modified_at: new Date().toISOString(),
          };
          threatModel.modified_at = new Date().toISOString();
          this._cachedThreatModels.set(threatModelId, { ...threatModel });
          return of(threatModel.threats[index]);
        }
      }
      return of(threat as Threat);
    }

    return this.apiService
      .put<Threat>(
        `threat_models/${threatModelId}/threats/${threatId}`,
        threat as unknown as Record<string, unknown>,
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
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.threats) {
        const initialLength = threatModel.threats.length;
        threatModel.threats = threatModel.threats.filter(t => t.id !== threatId);
        const wasDeleted = threatModel.threats.length < initialLength;
        if (wasDeleted) {
          threatModel.modified_at = new Date().toISOString();
          this._cachedThreatModels.set(threatModelId, { ...threatModel });
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
    if (this._useMockData) {
      const newDocument: TMDocument = {
        ...document,
        id: uuidv4(),
        metadata: [],
      } as TMDocument;

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        if (!threatModel.documents) {
          threatModel.documents = [];
        }
        threatModel.documents.push(newDocument);
        threatModel.modified_at = new Date().toISOString();
        this._cachedThreatModels.set(threatModelId, { ...threatModel });
      }
      return of(newDocument);
    }

    return this.apiService
      .post<TMDocument>(
        `threat_models/${threatModelId}/documents`,
        document as unknown as Record<string, unknown>,
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
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.documents) {
        const index = threatModel.documents.findIndex(d => d.id === documentId);
        if (index !== -1) {
          threatModel.documents[index] = { ...threatModel.documents[index], ...document };
          threatModel.modified_at = new Date().toISOString();
          this._cachedThreatModels.set(threatModelId, { ...threatModel });
          return of(threatModel.documents[index]);
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
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.documents) {
        const initialLength = threatModel.documents.length;
        threatModel.documents = threatModel.documents.filter(d => d.id !== documentId);
        const wasDeleted = threatModel.documents.length < initialLength;
        if (wasDeleted) {
          threatModel.modified_at = new Date().toISOString();
          this._cachedThreatModels.set(threatModelId, { ...threatModel });
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
   * Create a new source in a threat model
   */
  createSource(threatModelId: string, source: Partial<Source>): Observable<Source> {
    if (this._useMockData) {
      const newSource: Source = {
        ...source,
        id: uuidv4(),
        metadata: [],
      } as Source;

      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        if (!threatModel.sourceCode) {
          threatModel.sourceCode = [];
        }
        threatModel.sourceCode.push(newSource);
        threatModel.modified_at = new Date().toISOString();
        this._cachedThreatModels.set(threatModelId, { ...threatModel });
      }
      return of(newSource);
    }

    return this.apiService
      .post<Source>(
        `threat_models/${threatModelId}/sources`,
        source as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error creating source in threat model ID: ${threatModelId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update a source in a threat model
   */
  updateSource(
    threatModelId: string,
    sourceId: string,
    source: Partial<Source>,
  ): Observable<Source> {
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.sourceCode) {
        const index = threatModel.sourceCode.findIndex(s => s.id === sourceId);
        if (index !== -1) {
          threatModel.sourceCode[index] = { ...threatModel.sourceCode[index], ...source };
          threatModel.modified_at = new Date().toISOString();
          this._cachedThreatModels.set(threatModelId, { ...threatModel });
          return of(threatModel.sourceCode[index]);
        }
      }
      return of(source as Source);
    }

    return this.apiService
      .put<Source>(
        `threat_models/${threatModelId}/sources/${sourceId}`,
        source as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating source ID: ${sourceId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Delete a source from a threat model
   */
  deleteSource(threatModelId: string, sourceId: string): Observable<boolean> {
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.sourceCode) {
        const initialLength = threatModel.sourceCode.length;
        threatModel.sourceCode = threatModel.sourceCode.filter(s => s.id !== sourceId);
        const wasDeleted = threatModel.sourceCode.length < initialLength;
        if (wasDeleted) {
          threatModel.modified_at = new Date().toISOString();
          this._cachedThreatModels.set(threatModelId, { ...threatModel });
        }
        return of(wasDeleted);
      }
      return of(false);
    }

    return this.apiService.delete(`threat_models/${threatModelId}/sources/${sourceId}`).pipe(
      map(() => true),
      catchError(error => {
        this.logger.error(`Error deleting source ID: ${sourceId}`, error);
        throw error;
      }),
    );
  }

  /**
   * Create a new diagram in a threat model
   */
  createDiagram(threatModelId: string, diagram: Partial<Diagram>): Observable<Diagram> {
    if (this._useMockData) {
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
        if (!threatModel.diagrams) {
          threatModel.diagrams = [];
        }
        (threatModel.diagrams as unknown as string[]).push(newDiagram.id);
        threatModel.modified_at = new Date().toISOString();
        this._cachedThreatModels.set(threatModelId, { ...threatModel });
      }
      return of(newDiagram);
    }

    return this.apiService
      .post<Diagram>(
        `threat_models/${threatModelId}/diagrams`,
        diagram as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error creating diagram in threat model ID: ${threatModelId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update a diagram in a threat model
   */
  updateDiagram(
    threatModelId: string,
    diagramId: string,
    diagram: Partial<Diagram>,
  ): Observable<Diagram> {
    if (this._useMockData) {
      // For mock mode, we'd need to update the diagram in the mock data service
      // This is more complex as diagrams are stored separately from threat models
      return of({ ...diagram, modified_at: new Date().toISOString() } as Diagram);
    }

    return this.apiService
      .put<Diagram>(
        `threat_models/${threatModelId}/diagrams/${diagramId}`,
        diagram as unknown as Record<string, unknown>,
      )
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating diagram ID: ${diagramId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Patch diagram cells using JSON Patch operations
   * This method uses the PATCH endpoint specifically for diagram updates
   * instead of updating the entire threat model
   */
  patchDiagramCells(threatModelId: string, diagramId: string, cells: Cell[]): Observable<Diagram> {
    if (this._useMockData) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Patching mock diagram cells for diagram ID: ${diagramId}`,
        { cellCount: cells.length },
      );

      // For mock mode, simulate the patch operation
      const mockDiagram: Diagram = {
        id: diagramId,
        name: 'Mock Diagram',
        type: 'DFD-1.0.0',
        cells: cells,
        metadata: [],
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
      };

      return of(mockDiagram);
    }

    // Create JSON Patch operations for the cells update
    const operations = [
      {
        op: 'replace' as const,
        path: '/cells',
        value: cells,
      },
      {
        op: 'replace' as const,
        path: '/modified_at',
        value: new Date().toISOString(),
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
   * Delete a diagram from a threat model
   */
  deleteDiagram(threatModelId: string, diagramId: string): Observable<boolean> {
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel && threatModel.diagrams) {
        const initialLength = threatModel.diagrams.length;
        const filteredDiagrams = (threatModel.diagrams as unknown as string[]).filter(
          d => d !== diagramId,
        );
        threatModel.diagrams = filteredDiagrams as unknown as Diagram[];
        const wasDeleted = filteredDiagrams.length < initialLength;
        if (wasDeleted) {
          threatModel.modified_at = new Date().toISOString();
          this._cachedThreatModels.set(threatModelId, { ...threatModel });
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
    if (this._useMockData) {
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
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        threatModel.metadata = [...metadata];
        threatModel.modified_at = new Date().toISOString();
        this._cachedThreatModels.set(threatModelId, { ...threatModel });
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
    if (this._useMockData) {
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
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        const diagram = threatModel.diagrams?.find(d => d.id === diagramId);
        if (diagram) {
          diagram.metadata = [...metadata];
          threatModel.modified_at = new Date().toISOString();
          this._cachedThreatModels.set(threatModelId, { ...threatModel });
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
    if (this._useMockData) {
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
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        const threat = threatModel.threats?.find(t => t.id === threatId);
        if (threat) {
          threat.metadata = [...metadata];
          threatModel.modified_at = new Date().toISOString();
          this._cachedThreatModels.set(threatModelId, { ...threatModel });
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
    if (this._useMockData) {
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
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        const document = threatModel.documents?.find(d => d.id === documentId);
        if (document) {
          document.metadata = [...metadata];
          threatModel.modified_at = new Date().toISOString();
          this._cachedThreatModels.set(threatModelId, { ...threatModel });
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
   * Get metadata for a source
   */
  getSourceMetadata(threatModelId: string, sourceId: string): Observable<Metadata[]> {
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      const source = threatModel?.sourceCode?.find(s => s.id === sourceId);
      return of(source?.metadata || []);
    }

    return this.apiService
      .get<Metadata[]>(`threat_models/${threatModelId}/sources/${sourceId}/metadata`)
      .pipe(
        catchError(error => {
          this.logger.error(`Error getting metadata for source ID: ${sourceId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Update metadata for a source
   */
  updateSourceMetadata(
    threatModelId: string,
    sourceId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    if (this._useMockData) {
      const threatModel = this._cachedThreatModels.get(threatModelId);
      if (threatModel) {
        const source = threatModel.sourceCode?.find(s => s.id === sourceId);
        if (source) {
          source.metadata = [...metadata];
          threatModel.modified_at = new Date().toISOString();
          this._cachedThreatModels.set(threatModelId, { ...threatModel });
        }
      }
      return of(metadata);
    }

    // If metadata is empty, skip the API call and return empty array
    if (!metadata || metadata.length === 0) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Skipping metadata update for source ${sourceId} - no valid metadata to save`,
        { threatModelId, sourceId, metadataCount: metadata?.length || 0 },
      );
      return of([]);
    }

    return this.apiService
      .post<
        Metadata[]
      >(`threat_models/${threatModelId}/sources/${sourceId}/metadata/bulk`, metadata as unknown as Record<string, unknown>)
      .pipe(
        catchError(error => {
          this.logger.error(`Error updating metadata for source ID: ${sourceId}`, error);
          throw error;
        }),
      );
  }

  /**
   * Clean up resources when the service is destroyed
   */
  ngOnDestroy(): void {
    if (this._subscription) {
      this._subscription.unsubscribe();
      this._subscription = null;
    }
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
      issue_url: threatModel.issue_url,
      document_count: threatModel.documents?.length || 0,
      source_count: threatModel.sourceCode?.length || 0,
      diagram_count: threatModel.diagrams?.length || 0,
      threat_count: threatModel.threats?.length || 0,
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
      useMockData: this._useMockData,
    });

    if (this._useMockData) {
      // For mock data, simulate a collaboration session
      const mockSession = {
        session_id: `session-${Date.now()}`,
        threat_model_id: threatModelId,
        diagram_id: diagramId,
        participants: [
          {
            user_id: this.authService.username || 'current-user',
            joined_at: new Date().toISOString(),
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
              id: p.user_id,
              permissions: p.permissions,
              joined_at: p.joined_at,
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

    if (this._useMockData) {
      // For mock data, just simulate success
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

    if (this._useMockData) {
      // For mock data, return null (no active session)
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
   * Join an existing collaboration session for a diagram (PUT method)
   * @param threatModelId The threat model ID
   * @param diagramId The diagram ID
   * @returns Observable<CollaborationSession>
   */
  joinDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<CollaborationSession> {
    this.logger.info('Joining existing diagram collaboration session', {
      threatModelId,
      diagramId,
      currentUser: this.authService.username,
      userEmail: this.authService.userEmail,
      isAuthenticated: !!this.authService.getStoredToken(),
      useMockData: this._useMockData,
    });

    if (this._useMockData) {
      // For mock data, simulate joining a collaboration session
      const mockSession = {
        session_id: `session-${Date.now()}`,
        threat_model_id: threatModelId,
        diagram_id: diagramId,
        participants: [
          {
            user_id: 'existing-user@example.com',
            joined_at: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
            permissions: 'writer' as const,
          },
          {
            user_id: this.authService.username || 'current-user',
            joined_at: new Date().toISOString(),
            permissions: 'writer' as const,
          },
        ],
        websocket_url: `wss://api.example.com/threat_models/${threatModelId}/diagrams/${diagramId}/ws`,
        host: 'existing-user@example.com',
      };
      return of(mockSession);
    }

    return this.apiService
      .put<CollaborationSession>(
        `threat_models/${threatModelId}/diagrams/${diagramId}/collaborate`,
        {},
      )
      .pipe(
        tap(session => {
          this.logger.info('Successfully joined collaboration session', {
            sessionId: session.session_id,
            threatModelId,
            diagramId,
            websocketUrl: session.websocket_url,
            host: session.host,
            participantCount: session.participants?.length || 0,
            participants: session.participants?.map(p => ({
              id: p.user_id,
              permissions: p.permissions,
              joined_at: p.joined_at,
            })),
          });
        }),
        catchError((error: unknown) => {
          if (isHttpErrorResponse(error)) {
            this.logger.error('Error joining collaboration session - detailed server error', {
              threatModelId,
              diagramId,
              error,
              errorStatus: error.status,
              errorMessage: error.message,
              errorBody: error.error as unknown,
              errorUrl: error.url,
            });
          } else {
            this.logger.error('Error joining collaboration session - unknown error', {
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
   * Smart session handler: Try to create a session, if it exists then join it
   * This implements the pattern recommended in CLIENT_INTEGRATION_GUIDE.md
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

    if (this._useMockData) {
      // For mock data, always simulate creating a new session
      return this.startDiagramCollaborationSession(threatModelId, diagramId).pipe(
        map(session => ({ session, isNewSession: true })),
      );
    }

    // First, check if a session already exists
    return this.getDiagramCollaborationSession(threatModelId, diagramId).pipe(
      switchMap((existingSession: CollaborationSession | null) => {
        if (existingSession) {
          // Session exists, join it
          this.logger.info('Found existing session, joining it', {
            sessionId: existingSession.session_id,
            threatModelId,
            diagramId,
          });

          return this.joinDiagramCollaborationSession(threatModelId, diagramId).pipe(
            map(session => {
              this.logger.info('Successfully joined existing session', {
                sessionId: session.session_id,
              });
              return { session, isNewSession: false };
            }),
          );
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
              // Keep the 409 fallback for race conditions where a session might be created
              // between our check and the POST request
              if (isHttpErrorResponse(error) && error.status === 409) {
                this.logger.info(
                  'Race condition detected: session created after our check, joining it',
                  {
                    threatModelId,
                    diagramId,
                    errorStatus: error.status,
                  },
                );

                return this.joinDiagramCollaborationSession(threatModelId, diagramId).pipe(
                  map(session => {
                    this.logger.info('Successfully joined session after race condition', {
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
