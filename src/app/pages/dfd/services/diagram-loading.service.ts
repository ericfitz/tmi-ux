/**
 * Diagram Loading Service
 *
 * Shared service responsible for loading diagram cells into the X6 graph.
 * Handles proper history suppression, port visibility management, and
 * embedding appearance updates. Used by both initial diagram loading
 * and resynchronization operations.
 */

import { Injectable } from '@angular/core';
import { Graph } from '@antv/x6';

import { LoggerService } from '../../../core/services/logger.service';
import { NodeConfigurationService } from '../infrastructure/services/node-configuration.service';
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';
import { DfdDiagramService } from './dfd-diagram.service';

/**
 * Options for cell loading operations
 */
export interface CellLoadingOptions {
  /** Clear existing cells before loading new ones */
  clearExisting?: boolean;
  /** Suppress history tracking during load */
  suppressHistory?: boolean;
  /** Update embedding appearances after load */
  updateEmbedding?: boolean;
  /** Source of the loading operation for logging */
  source?: string;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramLoadingService {
  constructor(
    private logger: LoggerService,
    private nodeConfigurationService: NodeConfigurationService,
    private diagramService: DfdDiagramService,
  ) {
    this.logger.info('DiagramLoadingService initialized');
  }

  /**
   * Load diagram cells into the graph with proper history management
   * This is the shared implementation used by both initial loading and resync
   */
  loadCellsIntoGraph(
    cells: any[],
    graph: Graph,
    diagramId: string,
    x6GraphAdapter: X6GraphAdapter,
    options: CellLoadingOptions = {},
  ): void {
    const {
      clearExisting = false,
      suppressHistory = true,
      updateEmbedding = true,
      source = 'unknown',
    } = options;

    this.logger.info('Loading diagram cells into graph', {
      cellCount: cells.length,
      diagramId,
      source,
      options: { clearExisting, suppressHistory, updateEmbedding },
      cells: cells.map(cell => ({ id: cell.id, shape: cell.shape })),
    });

    try {
      // Clear existing cells if requested
      if (clearExisting) {
        graph.clearCells();
        this.logger.debug('Cleared existing cells from graph');
      }

      // Handle history suppression
      const historyManager = x6GraphAdapter.getHistoryManager();
      let historyWasEnabled = false;

      if (suppressHistory && historyManager) {
        // X6HistoryManager doesn't have isEnabled method, assume enabled by default for safety
        historyWasEnabled = true;
        if (historyWasEnabled) {
          historyManager.disable(graph);
          this.logger.debug('History tracking disabled for cell loading');
        }
      }

      try {
        // Delegate to the existing DfdDiagramService which has all the proper logic
        // for cell conversion, creation, and loading
        this.diagramService.loadDiagramCellsBatch(
          cells,
          graph,
          diagramId,
          this.nodeConfigurationService,
        );

        this.logger.info('Successfully loaded cells into graph using DfdDiagramService', {
          cellCount: cells.length,
          source,
        });

        // Verify cells were added
        const graphCells = graph.getCells();
        this.logger.debug('Graph state after loading', {
          totalCellsInGraph: graphCells.length,
          cellIds: graphCells.map(cell => cell.id),
        });
      } finally {
        // Restore history state if it was modified
        if (suppressHistory && historyManager && historyWasEnabled) {
          // Clear any history entries that might have been created during loading
          historyManager.clearHistory(graph);
          historyManager.enable(graph);
          this.logger.debug('History tracking re-enabled after cell loading');
        }

        // Update embedding appearances if requested
        if (updateEmbedding) {
          x6GraphAdapter.updateAllEmbeddingAppearances();
          this.logger.debug('Updated embedding appearances after cell loading');
        }
      }
    } catch (error) {
      this.logger.error('Error loading diagram cells', error);
      throw error;
    }
  }

  /**
   * Get default label for node type
   */
  private _getDefaultLabelForType(nodeType: string): string {
    switch (nodeType) {
      case 'actor':
        return 'External Entity';
      case 'process':
        return 'Process';
      case 'store':
        return 'Data Store';
      case 'security-boundary':
        return 'Trust Boundary';
      case 'text-box':
        return 'Text';
      default:
        return 'Element';
    }
  }
}
