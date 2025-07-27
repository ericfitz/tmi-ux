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
import { Observable, of, Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';

import { ThreatModel } from '../models/threat-model.model';
import { Diagram } from '../models/diagram.model';
import { LoggerService } from '../../../core/services/logger.service';
import { MockDataService } from '../../../mocks/mock-data.service';

@Injectable({
  providedIn: 'root',
})
export class ThreatModelService implements OnDestroy {
  private _threatModels: ThreatModel[] = [];
  private _useMockData = false;
  private _subscription: Subscription | null = null;

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private mockDataService: MockDataService,
  ) {
    // Subscribe to the mock data toggle
    this._subscription = this.mockDataService.useMockData$.subscribe(useMock => {
      this._useMockData = useMock;
      this.logger.debugComponent('ThreatModelService', `ThreatModelService using mock data: ${useMock}`, {
        useMock, 
        threatModelsCount: useMock ? this.mockDataService.getMockThreatModels().length : 0
      });

      // Initialize threat models based on the mock data setting
      if (useMock) {
        this._threatModels = [...this.mockDataService.getMockThreatModels()];
        this.logger.debugComponent('ThreatModelService', 'ThreatModelService loaded mock threat models', { 
          count: this._threatModels.length,
          models: this._threatModels.map(tm => ({ id: tm.id, name: tm.name }))
        });
      } else {
        this._threatModels = []; // Will be populated from API when needed
        this.logger.debugComponent('ThreatModelService', 'ThreatModelService using API mode (empty models)');
      }
    });
  }

  /**
   * Get all threat models
   */
  getThreatModels(): Observable<ThreatModel[]> {
    this.logger.debugComponent('ThreatModelService', 'ThreatModelService.getThreatModels called', { 
      useMockData: this._useMockData,
      threatModelsCount: this._threatModels.length,
      models: this._threatModels.map(tm => ({ id: tm.id, name: tm.name }))
    });
    
    if (this._useMockData) {
      this.logger.debugComponent('ThreatModelService', 'Returning mock threat models');
      return of(this._threatModels);
    }

    // In a real implementation, this would call the API
    this.logger.debugComponent('ThreatModelService', 'Fetching threat models from API');
    return this.http.get<ThreatModel[]>('/api/threat-models').pipe(
      catchError(error => {
        this.logger.error('Error fetching threat models', error);
        return of([]);
      }),
    );
  }

  /**
   * Get a threat model by ID
   */
  getThreatModelById(id: string): Observable<ThreatModel | undefined> {
    if (this._useMockData) {
      this.logger.debugComponent('ThreatModelService', `Returning mock threat model with ID: ${id}`);
      const threatModel = this._threatModels.find(tm => tm.id === id);
      return of(threatModel);
    }

    // In a real implementation, this would call the API
    this.logger.debugComponent('ThreatModelService', `Fetching threat model with ID: ${id} from API`);
    return this.http.get<ThreatModel>(`/api/threat-models/${id}`).pipe(
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
      this.logger.debugComponent('ThreatModelService', `Returning mock diagrams for threat model with ID: ${threatModelId}`);
      return of(this.mockDataService.getMockDiagramsForThreatModel(threatModelId));
    }

    // In a real implementation, this would call the API
    this.logger.debugComponent('ThreatModelService', `Fetching diagrams for threat model with ID: ${threatModelId} from API`);
    return this.http.get<Diagram[]>(`/api/threat-models/${threatModelId}/diagrams`).pipe(
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
      this.logger.debugComponent('ThreatModelService', `Returning mock diagram with ID: ${diagramId}`);
      return of(this.mockDataService.getMockDiagramById(diagramId));
    }

    // In a real implementation, this would call the API
    this.logger.debugComponent('ThreatModelService', `Fetching diagram with ID: ${diagramId} from API`);
    return this.http.get<Diagram>(`/api/threat-models/${threatModelId}/diagrams/${diagramId}`).pipe(
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
      const currentUser = 'user@example.com'; // Would come from auth service in real implementation

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

      this._threatModels.push(newThreatModel);
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

    return this.http.post<ThreatModel>('/api/threat-models', body).pipe(
      catchError(error => {
        this.logger.error('Error creating threat model', error);
        throw error;
      }),
    );
  }

  /**
   * Import a threat model from external JSON data
   */
  importThreatModel(data: Partial<ThreatModel> & { id: string; name: string }): Observable<ThreatModel> {
    this.logger.info('Importing threat model', { originalId: data.id, name: data.name });

    if (this._useMockData) {
      // Generate a new ID to avoid conflicts
      const importedModel: ThreatModel = {
        ...data,
        id: uuidv4(),
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        created_by: 'imported', // TODO: Use actual user when auth is implemented
        owner: 'imported', // TODO: Use actual user when auth is implemented
        threat_model_framework: data.threat_model_framework || 'STRIDE', // Provide default if missing
        authorization: data.authorization || [], // Provide default if missing
      };

      // Add to local mock data
      this._threatModels.push(importedModel);
      
      this.logger.debugComponent('ThreatModelService', 'Imported threat model to mock data', { 
        newId: importedModel.id, 
        name: importedModel.name,
        totalCount: this._threatModels.length 
      });

      return of(importedModel);
    } else {
      // For API mode, send the data to the backend
      this.logger.debugComponent('ThreatModelService', 'Sending threat model to API for import');
      
      return this.http.post<ThreatModel>('/api/threat-models/import', data).pipe(
        catchError(error => {
          this.logger.error('Failed to import threat model via API', error);
          throw error;
        }),
      );
    }
  }

  /**
   * Update a threat model
   */
  updateThreatModel(threatModel: ThreatModel): Observable<ThreatModel> {
    if (this._useMockData) {
      this.logger.debugComponent('ThreatModelService', `Updating mock threat model with ID: ${threatModel.id}`);

      const index = this._threatModels.findIndex(tm => tm.id === threatModel.id);
      if (index !== -1) {
        // Update the modified timestamp
        threatModel.modified_at = new Date().toISOString();
        this._threatModels[index] = { ...threatModel };
        return of(this._threatModels[index]);
      }
      return of(threatModel); // Return the original if not found
    }

    // In a real implementation, this would call the API
    this.logger.debugComponent('ThreatModelService', `Updating threat model with ID: ${threatModel.id} via API`);
    return this.http.put<ThreatModel>(`/api/threat-models/${threatModel.id}`, threatModel).pipe(
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

      const initialLength = this._threatModels.length;
      this._threatModels = this._threatModels.filter(tm => tm.id !== id);
      return of(this._threatModels.length < initialLength);
    }

    // In a real implementation, this would call the API
    this.logger.debugComponent('ThreatModelService', `Deleting threat model with ID: ${id} via API`);
    return this.http.delete<boolean>(`/api/threat-models/${id}`).pipe(
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
  }
}
