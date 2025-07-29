/**
 * Mock Data Service
 * 
 * This service provides comprehensive mock data management for development and testing.
 * It centralizes all mock data creation and provides a toggle mechanism for switching
 * between mock and real API data.
 * 
 * Key functionality:
 * - Provides toggle mechanism between mock data and real API data
 * - Manages comprehensive mock threat model data with realistic content
 * - Includes factory methods for creating customized mock objects
 * - Supports mock diagram data with nodes, edges, and metadata
 * - Provides mock threat data for security modeling scenarios
 * - Handles mock cell data for data flow diagram components
 * - Persists mock data toggle state in localStorage for development convenience
 * - Provides observable interface for reactive mock data state management
 * - Includes realistic threat modeling scenarios for comprehensive testing
 * - Supports dynamic mock data generation with UUIDs and timestamps
 */

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';
import { LoggerService } from '../core/services/logger.service';

import { ThreatModel } from '../pages/tm/models/threat-model.model';
import { Diagram } from '../pages/tm/models/diagram.model';

import { createMockThreatModel } from './factories/threat-model.factory';
import { createMockDiagram } from './factories/diagram.factory';
import { createMockCell } from './factories/cell.factory';
import { createMockThreat } from './factories/threat.factory';

/**
 * Service for managing mock data and providing a toggle mechanism
 * This service centralizes all mock data access and provides factory methods
 * for creating customized mock objects
 */
@Injectable({
  providedIn: 'root',
})
export class MockDataService implements OnDestroy {
  // BehaviorSubject to track mock data usage state
  private _useMockData = new BehaviorSubject<boolean>(this.getInitialMockState());

  // Cached mock data
  private _mockThreatModels: ThreatModel[] = [];

  // Map of all diagrams by ID for quick lookup
  private _mockDiagramsMap = new Map<string, Diagram>();
  
  // Mapping of threat model UUID to mock file name
  private _uuidToFileNameMap = new Map<string, string>();

  // Loading state
  private _dataLoaded = false;

  constructor(
    private logger: LoggerService,
    private http: HttpClient
  ) {
    this.logger.debugComponent('MockData', 'MockDataService initialized', {
      initialMockState: this.getInitialMockState(),
      localStorage: localStorage.getItem('useMockData')
    });

    // Load JSON data on initialization
    this.loadMockData();
  }

  // Public observable for components to subscribe to
  get useMockData$(): Observable<boolean> {
    return this._useMockData.asObservable();
  }

  // Public getter for the current mock data state
  get isUsingMockData(): boolean {
    return this._useMockData.value;
  }

  /**
   * Check if a threat model ID corresponds to one of the mock data files
   * @param threatModelId The threat model ID to check
   * @returns true if this is a mock threat model
   */
  isMockThreatModel(threatModelId: string): boolean {
    return this._uuidToFileNameMap.has(threatModelId);
  }

  /**
   * Get the mock data file name for a given threat model ID
   * @param threatModelId The threat model ID
   * @returns The corresponding mock data file name, or null if not found
   */
  getMockDataFileName(threatModelId: string): string | null {
    return this._uuidToFileNameMap.get(threatModelId) || null;
  }

  /**
   * Toggle the use of mock data
   * @param useMock Boolean indicating whether to use mock data
   */
  toggleMockData(useMock: boolean): void {
    this._useMockData.next(useMock);
    localStorage.setItem('useMockData', String(useMock));
    this.logger.debugComponent('MockData', `Mock data ${useMock ? 'enabled' : 'disabled'}`, { useMock });
  }

  /**
   * Get all mock threat models
   * @returns Array of ThreatModel objects
   */
  getMockThreatModels(): ThreatModel[] {
    return [...this._mockThreatModels];
  }

  /**
   * Get a mock threat model by ID
   * @param id The ID of the threat model to retrieve
   * @returns The threat model with the specified ID, or undefined if not found
   */
  getMockThreatModelById(id: string): ThreatModel | undefined {
    return this._mockThreatModels.find(tm => tm.id === id);
  }

  /**
   * Get all mock diagrams
   * @returns Array of Diagram objects
   */
  getMockDiagrams(): Diagram[] {
    return Array.from(this._mockDiagramsMap.values());
  }

  /**
   * Get a mock diagram by ID
   * @param id The ID of the diagram to retrieve
   * @returns The diagram with the specified ID, or undefined if not found
   */
  getMockDiagramById(id: string): Diagram | undefined {
    return this._mockDiagramsMap.get(id);
  }

  /**
   * Get mock diagrams for a threat model
   * @param threatModelId The ID of the threat model
   * @returns Array of Diagram objects associated with the threat model
   */
  getMockDiagramsForThreatModel(threatModelId: string): Diagram[] {
    const threatModel = this.getMockThreatModelById(threatModelId);
    if (!threatModel || !threatModel.diagrams) {
      return [];
    }

    // Since diagrams are now Diagram objects directly, return them
    return threatModel.diagrams;
  }

  /**
   * Create a new mock threat model using the factory
   * @param overrides Optional partial ThreatModel to override default values
   * @returns A new ThreatModel object
   */
  createThreatModel(overrides?: Partial<ThreatModel>): ThreatModel {
    return createMockThreatModel(overrides);
  }

  /**
   * Create a new mock diagram using the factory
   * @param overrides Optional partial Diagram to override default values
   * @returns A new Diagram object
   */
  createDiagram(overrides?: Partial<Diagram>): Diagram {
    return createMockDiagram(overrides);
  }

  /**
   * Create a new mock threat using the factory
   * @param overrides Optional partial Threat to override default values
   * @returns A new Threat object
   */
  createThreat(
    overrides?: Parameters<typeof createMockThreat>[0],
  ): ReturnType<typeof createMockThreat> {
    return createMockThreat(overrides);
  }

  /**
   * Create a new mock cell using the factory
   * @param type The type of cell to create
   * @param overrides Optional partial Cell to override default values
   * @returns A new Cell object
   */
  createCell(
    type?: Parameters<typeof createMockCell>[0],
    overrides?: Parameters<typeof createMockCell>[1],
  ): ReturnType<typeof createMockCell> {
    return createMockCell(type, overrides);
  }

  /**
   * Clean up resources when the service is destroyed
   */
  ngOnDestroy(): void {
    this._useMockData.complete();
  }

  /**
   * Load mock data from JSON files
   */
  private loadMockData(): void {
    if (this._dataLoaded) {
      return;
    }

    const mockDataUrls = [
      'assets/mock-data/threat-model-1.json',
      'assets/mock-data/threat-model-2.json',
      'assets/mock-data/threat-model-3.json'
    ];

    forkJoin(
      mockDataUrls.map((url, index) => 
        this.http.get<ThreatModel>(url).pipe(
          catchError(error => {
            this.logger.error(`Failed to load mock data from ${url}`, error);
            return of(null);
          })
        ).pipe(
          map(threatModel => ({
            threatModel,
            fileName: url.split('/').pop() || `threat-model-${index + 1}.json`
          }))
        )
      )
    ).subscribe(results => {
      // Filter out null values from failed loads and build UUID mapping
      this._mockThreatModels = [];
      this._uuidToFileNameMap.clear();
      
      results.forEach(result => {
        if (result.threatModel) {
          this._mockThreatModels.push(result.threatModel);
          this._uuidToFileNameMap.set(result.threatModel.id, result.fileName);
        }
      });
      
      // Initialize diagrams map
      this.initDiagramsMap();
      
      this._dataLoaded = true;
      
      this.logger.debugComponent('MockData', 'Mock data loaded successfully', {
        threatModelCount: this._mockThreatModels.length,
        diagramCount: this._mockDiagramsMap.size
      });
    });
  }

  /**
   * Initialize the diagrams map with all mock diagrams from loaded threat models
   */
  private initDiagramsMap(): void {
    this._mockDiagramsMap.clear();
    
    // Extract all diagrams from threat models
    this._mockThreatModels.forEach(threatModel => {
      if (threatModel.diagrams) {
        threatModel.diagrams.forEach(diagram => {
          this._mockDiagramsMap.set(diagram.id, diagram);
        });
      }
    });

    this.logger.debugComponent('MockData', `Initialized diagrams map with ${this._mockDiagramsMap.size} diagrams`);
  }

  /**
   * Get the initial mock state from localStorage
   * @returns Boolean indicating whether to use mock data
   */
  private getInitialMockState(): boolean {
    const storedValue = localStorage.getItem('useMockData');
    return storedValue !== null ? storedValue === 'true' : true;
  }
}
