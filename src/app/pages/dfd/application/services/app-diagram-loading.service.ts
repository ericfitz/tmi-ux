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

import { LoggerService } from '../../../../core/services/logger.service';
import { InfraNodeConfigurationService } from '../../infrastructure/services/infra-node-configuration.service';
import { InfraX6GraphAdapter } from '../../infrastructure/adapters/infra-x6-graph.adapter';
import { AppDiagramService } from './app-diagram.service';
import { AppGraphHistoryCoordinator } from './app-graph-history-coordinator.service';

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
export class AppDiagramLoadingService {
  constructor(
    private logger: LoggerService,
    private infraNodeConfigurationService: InfraNodeConfigurationService,
    private diagramService: AppDiagramService,
    private historyCoordinator: AppGraphHistoryCoordinator,
  ) {
    this.logger.info('AppDiagramLoadingService initialized');
  }

  /**
   * Load diagram cells into the graph with proper history management
   * This is the shared implementation used by both initial loading and resync
   */
  loadCellsIntoGraph(
    cells: any[],
    graph: Graph,
    diagramId: string,
    infraX6GraphAdapter: InfraX6GraphAdapter,
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

      // Handle history suppression using GraphHistoryCoordinator
      let wasLoadingStateSuppressed = false;

      if (suppressHistory) {
        // Set diagram loading state to suppress history via the coordinator
        wasLoadingStateSuppressed = true;
        this.historyCoordinator.setDiagramLoadingState(true);
        this.logger.debug('Diagram loading state set - history recording suppressed');
      }

      try {
        // Delegate to the existing AppDiagramService which has all the proper logic
        // for cell conversion, creation, and loading
        this.diagramService.loadDiagramCellsBatch(
          cells,
          graph,
          diagramId,
          this.infraNodeConfigurationService,
        );

        this.logger.info('Successfully loaded cells into graph using AppDiagramService', {
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
        // Restore diagram loading state if it was modified
        if (wasLoadingStateSuppressed) {
          // Clear the diagram loading state to allow normal history recording
          this.historyCoordinator.setDiagramLoadingState(false);
          this.logger.debug('Diagram loading state cleared - history recording restored');
        }

        // Update embedding appearances if requested
        if (updateEmbedding) {
          infraX6GraphAdapter.updateAllEmbeddingAppearances();
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
