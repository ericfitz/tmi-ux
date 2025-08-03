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
import { Observable, of, Subscription, BehaviorSubject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { catchError, switchMap, map, tap } from 'rxjs/operators';

import { ThreatModel } from '../models/threat-model.model';
import { TMListItem } from '../models/tm-list-item.model';
import { Diagram } from '../models/diagram.model';
import { LoggerService } from '../../../core/services/logger.service';
import { ApiService } from '../../../core/services/api.service';
import { MockDataService } from '../../../mocks/mock-data.service';
import { AuthService } from '../../../auth/services/auth.service';

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
   */
  getThreatModelList(): Observable<TMListItem[]> {
    this.logger.debugComponent('ThreatModelService', 'ThreatModelService.getThreatModelList called', {
      useMockData: this._useMockData,
      threatModelListCount: this._threatModelList.length,
      models: this._threatModelList.map(tm => ({ id: tm.id, name: tm.name })),
    });

    if (this._useMockData) {
      this.logger.debugComponent('ThreatModelService', 'Returning reactive mock threat model list');
      return this._threatModelListSubject.asObservable();
    }

    // For API mode, return reactive subject but fetch initial data if cache is empty
    this.logger.debugComponent('ThreatModelService', 'API mode - checking if initial fetch needed');
    if (this._threatModelList.length === 0) {
      this.logger.debugComponent('ThreatModelService', 'Cache empty, fetching threat model list from API');
      this.apiService.get<{ data: TMListItem[] }>('threat_models').pipe(
        tap(response => {
          // Update the subject with API data so subscribers get notified
          // Handle case where response.data might be undefined or null
          const threatModelList = response?.data || [];
          this._threatModelList = threatModelList;
          this._threatModelListSubject.next(threatModelList);
          this.logger.debugComponent('ThreatModelService', 'Updated threat model list from API', {
            count: threatModelList.length,
            response: response
          });
        }),
        catchError(error => {
          this.logger.error('Error fetching threat model list', error);
          this._threatModelListSubject.next([]);
          return of({ data: [] });
        }),
      ).subscribe();
    }

    // Always return the reactive subject for consistent behavior
    return this._threatModelListSubject.asObservable();
  }

  /**
   * @deprecated Use getThreatModelList() for dashboard, getThreatModelById() for editing
   * Get all threat models (backwards compatibility)
   */
  getThreatModels(): Observable<ThreatModel[]> {
    this.logger.warn('getThreatModels() is deprecated. Use getThreatModelList() for dashboard or getThreatModelById() for editing.');
    
    // Return empty array to encourage migration to new methods
    return of([]);
  }

  /**
   * Get a full threat model by ID (for editing)
   */
  getThreatModelById(id: string): Observable<ThreatModel | undefined> {
    if (this._useMockData) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Returning mock threat model with ID: ${id}`,
      );
      const threatModel = this.mockDataService.getMockThreatModels().find(tm => tm.id === id);
      return of(threatModel);
    }

    // Check cache first
    if (this._cachedThreatModels.has(id)) {
      this.logger.debugComponent(
        'ThreatModelService',
        `Returning cached threat model with ID: ${id}`,
      );
      return of(this._cachedThreatModels.get(id));
    }

    // Fetch from API and cache the result
    this.logger.debugComponent(
      'ThreatModelService',
      `Fetching threat model with ID: ${id} from API`,
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
            { cacheSize: this._cachedThreatModels.size }
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
        threat_model_framework: framework,
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
      threat_model_framework: framework,
      issue_url: issueUrl,
    };

    return this.apiService.post<ThreatModel>('threat_models', body).pipe(
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
        this.logger.debugComponent('ThreatModelService', 'Updated threat model list after deletion', {
          remainingCount: this._threatModelList.length,
          deletedId: id,
        });
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
        this.logger.debugComponent('ThreatModelService', 'Updated threat model list after API deletion', {
          remainingCount: this._threatModelList.length,
          deletedId: id,
        });
      }),
      map(() => true), // Convert successful response to boolean true
      catchError(error => {
        this.logger.error(`Error deleting threat model with ID: ${id}`, error);
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
      threat_model_framework: threatModel.threat_model_framework as TMListItem['threat_model_framework'],
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
      this.logger.debugComponent(
        'ThreatModelService',
        'Expired cached threat models',
        { expiredCount: keysToDelete.length, keptId: keepId }
      );
    }
  }
}
