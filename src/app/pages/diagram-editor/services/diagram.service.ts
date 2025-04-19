import { Injectable } from '@angular/core';
import { BehaviorSubject } from '../../../core/rxjs-imports';
import { v4 as uuidv4 } from 'uuid';

import { LoggerService } from '../../../core/services/logger.service';
import {
  Diagram,
  DiagramOperationType,
  DiagramOperationUnion,
  AddCellOperation,
  UpdateCellOperation,
  DeleteCellOperation,
  UpdateDiagramPropertiesOperation,
  BatchOperation,
  DiagramElementType,
  Cell,
} from '../models/diagram.model';

/**
 * Service for managing diagram data and operations
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramService {
  // Observable for the current diagram
  private _currentDiagram = new BehaviorSubject<Diagram | null>(null);
  public currentDiagram$ = this._currentDiagram.asObservable();

  // Observable for diagram operations
  private _operations = new BehaviorSubject<DiagramOperationUnion[]>([]);
  public operations$ = this._operations.asObservable();

  // Track pending operations for optimistic updates
  private pendingOperations: Map<string, DiagramOperationUnion> = new Map();

  // Track operation history for undo/redo
  private operationHistory: DiagramOperationUnion[] = [];
  private historyIndex = -1;

  // Mock user ID (would come from auth service in real implementation)
  private userId = 'local-user';

  constructor(private logger: LoggerService) {
    this.logger.info('DiagramService initialized');
  }

  /**
   * Create a new empty diagram
   */
  createNewDiagram(name: string, description?: string): Diagram {
    this.logger.info(`Creating new diagram: ${name}`);

    const now = new Date().toISOString();
    const diagram: Diagram = {
      id: uuidv4(),
      name,
      description,
      created_at: now,
      modified_at: now,
      owner: this.userId,
      authorization: [{ subject: this.userId, role: 'owner' }],
      graphData: [],
      version: 1,
    };

    this._currentDiagram.next(diagram);
    this.logger.debug('New diagram created', diagram);
    return diagram;
  }

  /**
   * Load a diagram
   */
  loadDiagram(diagram: Diagram): void {
    this.logger.info(`Loading diagram: ${diagram.name} (${diagram.id})`);
    this._currentDiagram.next(diagram);
    // Reset operation history when loading a new diagram
    this.operationHistory = [];
    this.historyIndex = -1;
    this.pendingOperations.clear();
    this.logger.debug('Diagram loaded', diagram);
  }

  /**
   * Get the current diagram
   */
  getCurrentDiagram(): Diagram | null {
    return this._currentDiagram.getValue();
  }

  /**
   * Apply an operation to the diagram
   */
  applyOperation(operation: DiagramOperationUnion, isUndoRedo = false): void {
    const diagram = this._currentDiagram.getValue();
    if (!diagram) {
      this.logger.error('Cannot apply operation: No diagram loaded');
      return;
    }

    try {
      // Apply the operation
      this.logger.debug(`Applying operation: ${operation.type}`, operation);

      const updatedDiagram = this.executeOperation(diagram, operation);

      // Update the diagram
      updatedDiagram.modified_at = new Date().toISOString();
      updatedDiagram.version = (updatedDiagram.version || 1) + 1;
      this._currentDiagram.next(updatedDiagram);

      // Track in history if not an undo/redo operation
      if (!isUndoRedo) {
        // If we're in the middle of the history, remove all operations after current index
        if (this.historyIndex < this.operationHistory.length - 1) {
          this.operationHistory = this.operationHistory.slice(0, this.historyIndex + 1);
        }

        this.operationHistory.push(operation);
        this.historyIndex = this.operationHistory.length - 1;
      }

      // Add to pending operations (for future server integration)
      this.pendingOperations.set(operation.id, operation);

      // Emit the operation
      const operations = this._operations.getValue();
      this._operations.next([...operations, operation]);

      this.logger.info(`Operation ${operation.id} applied successfully`);
    } catch (error) {
      this.logger.error(`Failed to apply operation: ${operation.type}`, error);
      throw error;
    }
  }

  /**
   * Execute a single operation on the diagram
   */
  private executeOperation(diagram: Diagram, operation: DiagramOperationUnion): Diagram {
    // Create a deep copy of the diagram to avoid mutating the original
    const updatedDiagram = JSON.parse(JSON.stringify(diagram)) as Diagram;

    switch (operation.type) {
      case DiagramOperationType.ADD_CELL:
        return this.executeAddCell(updatedDiagram, operation);

      case DiagramOperationType.UPDATE_CELL:
        return this.executeUpdateCell(updatedDiagram, operation);

      case DiagramOperationType.DELETE_CELL:
        return this.executeDeleteCell(updatedDiagram, operation);

      case DiagramOperationType.UPDATE_DIAGRAM_PROPERTIES:
        return this.executeUpdateDiagramProperties(updatedDiagram, operation);

      case DiagramOperationType.BATCH_OPERATION:
        return this.executeBatchOperation(updatedDiagram, operation);

      default:
        this.logger.error(`Unknown operation type: ${(operation as any).type}`);
        throw new Error(`Unknown operation type: ${(operation as any).type}`);
    }
  }

  private executeAddCell(diagram: Diagram, operation: AddCellOperation): Diagram {
    // Add the cell to graphData
    diagram.graphData.push(operation.cell);
    return diagram;
  }

  private executeUpdateCell(diagram: Diagram, operation: UpdateCellOperation): Diagram {
    // Find the cell by ID
    const cellIndex = diagram.graphData.findIndex(c => c.id === operation.cellId);

    if (cellIndex === -1) {
      this.logger.error(`Cell not found: ${operation.cellId}`);
      throw new Error(`Cell not found: ${operation.cellId}`);
    }

    // Apply changes to cell
    diagram.graphData[cellIndex] = {
      ...diagram.graphData[cellIndex],
      ...operation.changes,
      // Keep cell ID the same
      id: operation.cellId,
    };

    return diagram;
  }

  private executeDeleteCell(diagram: Diagram, operation: DeleteCellOperation): Diagram {
    const cellIndex = diagram.graphData.findIndex(c => c.id === operation.cellId);

    if (cellIndex === -1) {
      this.logger.error(`Cell not found: ${operation.cellId}`);
      throw new Error(`Cell not found: ${operation.cellId}`);
    }

    diagram.graphData.splice(cellIndex, 1);
    return diagram;
  }

  private executeUpdateDiagramProperties(
    diagram: Diagram,
    operation: UpdateDiagramPropertiesOperation,
  ): Diagram {
    // Apply changes to diagram properties (excluding graphData)
    const { graphData, ...diagramProps } = diagram;

    const updatedProps = {
      ...diagramProps,
      ...operation.changes,
    };

    return {
      ...updatedProps,
      graphData,
    } as Diagram;
  }

  private executeBatchOperation(diagram: Diagram, operation: BatchOperation): Diagram {
    // Apply each operation in the batch sequentially
    let updatedDiagram = diagram;

    for (const op of operation.operations) {
      updatedDiagram = this.executeOperation(updatedDiagram, op as DiagramOperationUnion);
    }

    return updatedDiagram;
  }

  /**
   * Create a cell
   * @param type The element type ('vertex' or 'edge')
   * @param properties The cell properties
   * @param cellId Optional cell ID (if not provided, a UUID will be generated)
   */
  createCell(type: DiagramElementType, properties: Partial<Cell>, cellId?: string): Cell {
    const id = cellId || uuidv4(); // Use provided ID or generate new one

    // Create a base cell with the correct type
    const cell: Cell = {
      id,
      vertex: type === 'vertex',
      edge: type === 'edge',
      ...properties,
    };

    return cell;
  }

  /**
   * Add a cell to the diagram
   * @param type The element type ('vertex' or 'edge')
   * @param properties The cell properties
   * @param cellId Optional cell ID (if not provided, a UUID will be generated)
   */
  addCell(type: DiagramElementType, properties: Partial<Cell>, cellId?: string): Cell {
    // Create the cell
    const cell = this.createCell(type, properties, cellId);

    // Create an operation to add the cell to the diagram
    const operation: AddCellOperation = {
      id: uuidv4(),
      type: DiagramOperationType.ADD_CELL,
      timestamp: Date.now(),
      userId: this.userId,
      diagramId: this.getCurrentDiagram()?.id || '',
      cell,
    };

    // Apply the operation to update the diagram
    this.applyOperation(operation);

    // Return the created cell
    return cell;
  }

  /**
   * Find a cell by ID
   */
  findCellById(cellId: string): Cell | undefined {
    const diagram = this.getCurrentDiagram();
    if (!diagram) return undefined;

    return diagram.graphData.find(c => c.id === cellId);
  }

  /**
   * Bulk update multiple cells without triggering re-renders
   * This method is used to avoid circular update loops
   * @param updates Array of operations with cellId and changes
   */
  bulkUpdateCellsWithoutRender(updates: Array<{ cellId: string; changes: Partial<Cell> }>): void {
    const diagram = this._currentDiagram.getValue();
    if (!diagram) {
      this.logger.error('Cannot apply bulk updates: No diagram loaded');
      return;
    }

    // Create a deep copy of the diagram to avoid mutating the current value
    const updatedDiagram = JSON.parse(JSON.stringify(diagram)) as Diagram;

    // Apply all updates directly to the diagram copy
    for (const update of updates) {
      const cellIndex = updatedDiagram.graphData.findIndex(c => c.id === update.cellId);
      if (cellIndex === -1) {
        this.logger.warn(`Cell not found for bulk update: ${update.cellId}`);
        continue;
      }

      // Apply changes directly
      updatedDiagram.graphData[cellIndex] = {
        ...updatedDiagram.graphData[cellIndex],
        ...update.changes,
        // Ensure cell ID doesn't change
        id: update.cellId,
      };
    }

    // Update modified timestamp
    updatedDiagram.modified_at = new Date().toISOString();

    // Replace the current diagram without creating operations that would trigger updates
    this._currentDiagram.next(updatedDiagram);

    this.logger.info(`Bulk updated ${updates.length} cells without triggering re-render`);
  }

  /**
   * Update a cell in the diagram
   */
  updateCell(cellId: string, changes: Partial<Cell>): void {
    const operation: UpdateCellOperation = {
      id: uuidv4(),
      type: DiagramOperationType.UPDATE_CELL,
      timestamp: Date.now(),
      userId: this.userId,
      diagramId: this.getCurrentDiagram()?.id || '',
      cellId,
      changes,
    };

    this.applyOperation(operation);
  }

  /**
   * Delete a cell from the diagram
   */
  deleteCell(cellId: string): void {
    const operation: DeleteCellOperation = {
      id: uuidv4(),
      type: DiagramOperationType.DELETE_CELL,
      timestamp: Date.now(),
      userId: this.userId,
      diagramId: this.getCurrentDiagram()?.id || '',
      cellId,
    };

    this.applyOperation(operation);
  }

  /**
   * Update diagram properties
   */
  updateDiagramProperties(changes: Partial<Omit<Diagram, 'graphData'>>): void {
    const operation: UpdateDiagramPropertiesOperation = {
      id: uuidv4(),
      type: DiagramOperationType.UPDATE_DIAGRAM_PROPERTIES,
      timestamp: Date.now(),
      userId: this.userId,
      diagramId: this.getCurrentDiagram()?.id || '',
      changes,
    };

    this.applyOperation(operation);
  }

  /**
   * Batch multiple operations together
   */
  batchOperations(operations: DiagramOperationUnion[]): void {
    const operation: BatchOperation = {
      id: uuidv4(),
      type: DiagramOperationType.BATCH_OPERATION,
      timestamp: Date.now(),
      userId: this.userId,
      diagramId: this.getCurrentDiagram()?.id || '',
      operations,
    };

    this.applyOperation(operation);
  }

  /**
   * Undo the last operation
   */
  undo(): void {
    if (this.historyIndex < 0) {
      this.logger.warn('Nothing to undo');
      return;
    }

    // TODO: Implement proper undo by applying inverse operations
    this.logger.info('Undo not fully implemented yet');
  }

  /**
   * Redo a previously undone operation
   */
  redo(): void {
    if (this.historyIndex >= this.operationHistory.length - 1) {
      this.logger.warn('Nothing to redo');
      return;
    }

    // TODO: Implement proper redo
    this.logger.info('Redo not fully implemented yet');
  }

  /**
   * Save diagram to local storage
   */
  saveDiagramToLocalStorage(): void {
    const diagram = this.getCurrentDiagram();
    if (!diagram) {
      this.logger.warn('No diagram to save');
      return;
    }

    try {
      localStorage.setItem(`diagram_${diagram.id}`, JSON.stringify(diagram));
      this.logger.info(`Diagram saved to local storage: ${diagram.id}`);
    } catch (error) {
      this.logger.error('Failed to save diagram to local storage', error);
    }
  }

  /**
   * Load diagram from local storage
   */
  loadDiagramFromLocalStorage(id: string): Diagram | null {
    try {
      const diagramStr = localStorage.getItem(`diagram_${id}`);
      if (!diagramStr) {
        this.logger.warn(`Diagram not found in local storage: ${id}`);
        return null;
      }

      const diagram = JSON.parse(diagramStr) as Diagram;
      this.loadDiagram(diagram);
      this.logger.info(`Diagram loaded from local storage: ${id}`);
      return diagram;
    } catch (error) {
      this.logger.error('Failed to load diagram from local storage', error);
      return null;
    }
  }

  /**
   * Get a list of saved diagrams in local storage
   */
  getSavedDiagrams(): { id: string; name: string }[] {
    const diagrams: { id: string; name: string }[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('diagram_')) {
          const diagramStr = localStorage.getItem(key);
          if (diagramStr) {
            const diagram = JSON.parse(diagramStr) as Diagram;
            diagrams.push({ id: diagram.id, name: diagram.name });
          }
        }
      }

      this.logger.debug(`Found ${diagrams.length} saved diagrams in local storage`);
      return diagrams;
    } catch (error) {
      this.logger.error('Failed to get saved diagrams from local storage', error);
      return [];
    }
  }
}
