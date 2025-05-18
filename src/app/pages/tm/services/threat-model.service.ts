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
      this.logger.debug(`ThreatModelService using mock data: ${useMock}`);

      // Initialize threat models based on the mock data setting
      if (useMock) {
        this._threatModels = [...this.mockDataService.getMockThreatModels()];
      } else {
        this._threatModels = []; // Will be populated from API when needed
      }
    });
  }

  /**
   * Get all threat models
   */
  getThreatModels(): Observable<ThreatModel[]> {
    if (this._useMockData) {
      this.logger.debug('Returning mock threat models');
      return of(this._threatModels);
    }

    // In a real implementation, this would call the API
    this.logger.debug('Fetching threat models from API');
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
      this.logger.debug(`Returning mock threat model with ID: ${id}`);
      const threatModel = this._threatModels.find(tm => tm.id === id);
      return of(threatModel);
    }

    // In a real implementation, this would call the API
    this.logger.debug(`Fetching threat model with ID: ${id} from API`);
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
      this.logger.debug(`Returning mock diagrams for threat model with ID: ${threatModelId}`);
      return of(this.mockDataService.getMockDiagramsForThreatModel(threatModelId));
    }

    // In a real implementation, this would call the API
    this.logger.debug(`Fetching diagrams for threat model with ID: ${threatModelId} from API`);
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
      this.logger.debug(`Returning mock diagram with ID: ${diagramId}`);
      return of(this.mockDataService.getMockDiagramById(diagramId));
    }

    // In a real implementation, this would call the API
    this.logger.debug(`Fetching diagram with ID: ${diagramId} from API`);
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
      this.logger.debug('Creating mock threat model');

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
    this.logger.debug('Creating threat model via API');
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
   * Update a threat model
   */
  updateThreatModel(threatModel: ThreatModel): Observable<ThreatModel> {
    if (this._useMockData) {
      this.logger.debug(`Updating mock threat model with ID: ${threatModel.id}`);

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
    this.logger.debug(`Updating threat model with ID: ${threatModel.id} via API`);
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
      this.logger.debug(`Deleting mock threat model with ID: ${id}`);

      const initialLength = this._threatModels.length;
      this._threatModels = this._threatModels.filter(tm => tm.id !== id);
      return of(this._threatModels.length < initialLength);
    }

    // In a real implementation, this would call the API
    this.logger.debug(`Deleting threat model with ID: ${id} via API`);
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
