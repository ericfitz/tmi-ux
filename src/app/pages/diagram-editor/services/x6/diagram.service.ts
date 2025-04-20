import { Injectable } from '@angular/core';
import { Graph } from '@antv/x6';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggerService } from '../../../../core/services/logger.service';
import { X6GraphService } from './x6-graph.service';

export interface DiagramData {
  id: string;
  name: string;
  cells: any[];
}

@Injectable({
  providedIn: 'root',
})
export class DiagramService {
  private currentDiagramSubject = new BehaviorSubject<DiagramData | null>(null);
  readonly currentDiagram$ = this.currentDiagramSubject.asObservable();

  constructor(
    private logger: LoggerService,
    private graphService: X6GraphService,
  ) {
    this.logger.info('DiagramService initialized');
  }

  /**
   * Create a new diagram
   */
  createNewDiagram(name: string = 'Untitled Diagram'): void {
    // Create a new diagram data object regardless of graph initialization
    const newDiagram: DiagramData = {
      id: this.generateId(),
      name,
      cells: [],
    };

    // Update the current diagram subject
    this.currentDiagramSubject.next(newDiagram);
    this.logger.info(`New diagram created: ${name}`);

    // Try to clear the graph if it's initialized
    const graph = this.graphService.getGraph();
    if (graph) {
      // Clear the graph
      graph.clearCells();
    } else {
      // Set up a retry mechanism to clear the graph once it's initialized
      const checkInterval = setInterval(() => {
        const graph = this.graphService.getGraph();
        if (graph) {
          clearInterval(checkInterval);
          graph.clearCells();
          this.logger.info('Graph cleared after initialization');
        }
      }, 100);

      // Stop checking after 5 seconds to prevent infinite loop
      setTimeout(() => clearInterval(checkInterval), 5000);
    }
  }

  /**
   * Load a diagram
   */
  loadDiagram(diagram: DiagramData): void {
    const graph = this.graphService.getGraph();
    if (!graph) {
      this.logger.error('Cannot load diagram: Graph not initialized');
      return;
    }

    try {
      // Clear the graph
      graph.clearCells();

      // Load the cells
      graph.fromJSON({ cells: diagram.cells });

      this.currentDiagramSubject.next(diagram);
      this.logger.info(`Diagram loaded: ${diagram.name}`);
    } catch (error) {
      this.logger.error('Error loading diagram', error);
    }
  }

  /**
   * Save the current diagram
   */
  saveDiagram(): DiagramData | null {
    const graph = this.graphService.getGraph();
    if (!graph) {
      this.logger.error('Cannot save diagram: Graph not initialized');
      return null;
    }

    const currentDiagram = this.currentDiagramSubject.value;
    if (!currentDiagram) {
      this.logger.error('Cannot save diagram: No current diagram');
      return null;
    }

    try {
      // Get the cells from the graph
      const cells = graph.toJSON().cells;

      // Update the diagram
      const updatedDiagram: DiagramData = {
        ...currentDiagram,
        cells,
      };

      this.currentDiagramSubject.next(updatedDiagram);
      this.logger.info(`Diagram saved: ${updatedDiagram.name}`);

      return updatedDiagram;
    } catch (error) {
      this.logger.error('Error saving diagram', error);
      return null;
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Get the current diagram
   */
  getCurrentDiagram(): DiagramData | null {
    return this.currentDiagramSubject.value;
  }
}
