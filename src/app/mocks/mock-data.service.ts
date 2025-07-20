import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggerService } from '../core/services/logger.service';

import { ThreatModel } from '../pages/tm/models/threat-model.model';
import { Diagram } from '../pages/tm/models/diagram.model';

import { createMockThreatModel } from './factories/threat-model.factory';
import { createMockDiagram } from './factories/diagram.factory';
import { createMockCell } from './factories/cell.factory';
import { createMockThreat } from './factories/threat.factory';

import { mockThreatModel1, mockDiagrams1 } from './instances/threat-model-1';
import { mockThreatModel2, mockDiagrams2 } from './instances/threat-model-2';
import { mockThreatModel3, mockDiagrams3 } from './instances/threat-model-3';

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
  private _mockThreatModels: ThreatModel[] = [mockThreatModel1, mockThreatModel2, mockThreatModel3];

  // Map of all diagrams by ID for quick lookup
  private _mockDiagramsMap = new Map<string, Diagram>();

  constructor(private logger: LoggerService) {
    this.logger.debug('MockDataService initialized');

    // Initialize diagrams map
    this.initDiagramsMap();
  }

  // Public observable for components to subscribe to
  get useMockData$(): Observable<boolean> {
    return this._useMockData.asObservable();
  }

  /**
   * Toggle the use of mock data
   * @param useMock Boolean indicating whether to use mock data
   */
  toggleMockData(useMock: boolean): void {
    this._useMockData.next(useMock);
    localStorage.setItem('useMockData', String(useMock));
    this.logger.info(`Mock data ${useMock ? 'enabled' : 'disabled'}`);
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

    return threatModel.diagrams
      .map(diagramId => this._mockDiagramsMap.get(diagramId))
      .filter((diagram): diagram is Diagram => !!diagram);
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
   * Initialize the diagrams map with all mock diagrams
   */
  private initDiagramsMap(): void {
    // Add all diagrams from mockDiagrams1
    Object.entries(mockDiagrams1).forEach(([id, diagram]) => {
      this._mockDiagramsMap.set(id, diagram);
    });

    // Add all diagrams from mockDiagrams2
    Object.entries(mockDiagrams2).forEach(([id, diagram]) => {
      this._mockDiagramsMap.set(id, diagram);
    });

    // Add all diagrams from mockDiagrams3
    Object.entries(mockDiagrams3).forEach(([id, diagram]) => {
      this._mockDiagramsMap.set(id, diagram);
    });

    this.logger.debug(`Initialized diagrams map with ${this._mockDiagramsMap.size} diagrams`);
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
