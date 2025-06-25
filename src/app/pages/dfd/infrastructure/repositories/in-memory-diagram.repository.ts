import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { IDiagramRepository } from '../../application/handlers/diagram-command-handlers';
import { DiagramAggregate } from '../../domain/aggregates/diagram-aggregate';
import { MOCK_DIAGRAMS } from '../../../tm/models/diagram.model';
import { DiagramCommandFactory } from '../../domain/commands/diagram-commands';

/**
 * In-memory implementation of IDiagramRepository for development and testing
 * This is a simple implementation that stores diagrams in memory
 */
@Injectable({
  providedIn: 'root',
})
export class InMemoryDiagramRepository implements IDiagramRepository {
  private readonly _diagrams = new Map<string, DiagramAggregate>();

  constructor() {
    // Initialize with mock data
    this.initializeWithMockData();
  }

  /**
   * Find a diagram by ID
   */
  findById(id: string): Observable<DiagramAggregate | null> {
    const diagram = this._diagrams.get(id);
    return of(diagram || null);
  }

  /**
   * Save an existing diagram
   */
  save(aggregate: DiagramAggregate): Observable<DiagramAggregate> {
    if (!this._diagrams.has(aggregate.id)) {
      return throwError(() => new Error(`Diagram with ID ${aggregate.id} does not exist`));
    }

    this._diagrams.set(aggregate.id, aggregate);
    return of(aggregate);
  }

  /**
   * Create a new diagram
   */
  create(aggregate: DiagramAggregate): Observable<DiagramAggregate> {
    if (this._diagrams.has(aggregate.id)) {
      return throwError(() => new Error(`Diagram with ID ${aggregate.id} already exists`));
    }

    this._diagrams.set(aggregate.id, aggregate);
    return of(aggregate);
  }

  /**
   * Get all diagram IDs (for debugging/testing)
   */
  getAllIds(): string[] {
    return Array.from(this._diagrams.keys());
  }

  /**
   * Clear all diagrams (for testing)
   */
  clear(): void {
    this._diagrams.clear();
  }

  /**
   * Get the count of stored diagrams
   */
  count(): number {
    return this._diagrams.size;
  }

  /**
   * Initialize the repository with mock diagram data
   */
  private initializeWithMockData(): void {
    MOCK_DIAGRAMS.forEach(mockDiagram => {
      // Create a diagram aggregate from the mock data
      const createCommand = DiagramCommandFactory.createDiagram(
        mockDiagram.id,
        'system', // system user for mock data
        mockDiagram.name,
        mockDiagram.description,
      );

      const aggregate = DiagramAggregate.create(createCommand);
      this._diagrams.set(mockDiagram.id, aggregate);
    });
  }
}
