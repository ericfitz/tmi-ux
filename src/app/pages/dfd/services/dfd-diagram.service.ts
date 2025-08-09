import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { ThreatModelService } from '../../tm/services/threat-model.service';
import { GraphHistoryCoordinator } from './graph-history-coordinator.service';
import { PortStateManagerService } from '../infrastructure/services/port-state-manager.service';
import { HISTORY_OPERATION_TYPES } from './graph-history-coordinator.service';
import { getX6ShapeForNodeType } from '../infrastructure/adapters/x6-shape-definitions';
import { DfdNodeService } from '../infrastructure/services/node.service';
import { EdgeService } from '../infrastructure/services/edge.service';
import { NodeInfo, NodeType } from '../domain/value-objects/node-info';
import { EdgeInfo } from '../domain/value-objects/edge-info';

/**
 * Interface for diagram data
 */
export interface DiagramData {
  id: string;
  name: string;
  threatModelId?: string;
  cells?: any[]; // Full diagram cells data for rendering
}

/**
 * Result of diagram loading operation
 */
export interface DiagramLoadResult {
  success: boolean;
  diagram?: DiagramData;
  error?: string;
}

/**
 * Service for managing DFD diagram data operations
 * Handles diagram loading, validation, and error scenarios
 */
@Injectable()
export class DfdDiagramService {
  constructor(
    private logger: LoggerService,
    private threatModelService: ThreatModelService,
    private historyCoordinator: GraphHistoryCoordinator,
    private portStateManager: PortStateManagerService,
    private nodeService: DfdNodeService,
    private edgeService: EdgeService,
  ) {}

  /**
   * Load diagram data by ID
   * Returns observable with load result
   */
  loadDiagram(diagramId: string, threatModelId?: string): Observable<DiagramLoadResult> {
    this.logger.info('Loading diagram data using dedicated diagram endpoint', { diagramId, threatModelId });

    if (!threatModelId) {
      this.logger.error('Threat model ID is required to load diagram data');
      return of({
        success: false,
        error: 'Threat model ID is required',
      });
    }

    // Use the dedicated diagram endpoint instead of fetching the entire threat model
    return this.threatModelService.getDiagramById(threatModelId, diagramId).pipe(
      map(diagram => {
        if (!diagram) {
          this.logger.warn('Diagram not found', { diagramId, threatModelId });
          return {
            success: false,
            error: `Diagram with ID ${diagramId} not found`,
          };
        }

        const diagramData: DiagramData = {
          id: diagramId,
          name: diagram.name,
          threatModelId,
          cells: diagram.cells || [], // Use the diagram cells directly from the diagram endpoint
        };

        this.logger.info('Successfully loaded diagram data using dedicated endpoint', {
          name: diagramData.name,
          id: diagramId,
          threatModelId,
          cellCount: diagramData.cells?.length || 0,
        });

        return {
          success: true,
          diagram: diagramData,
        };
      }),
      catchError(error => {
        this.logger.error('Error loading diagram data using dedicated endpoint', error);
        return of({
          success: false,
          error: 'Failed to load diagram data',
        });
      }),
    );
  }

  /**
   * Validate if diagram exists and user has access
   */
  validateDiagramAccess(diagramId: string, threatModelId?: string): Observable<boolean> {
    return this.loadDiagram(diagramId, threatModelId).pipe(map(result => result.success));
  }

  /**
   * Get fallback navigation path when diagram is not found
   */
  getFallbackNavigationPath(threatModelId: string | null): string {
    if (threatModelId) {
      return `/threat-models/${threatModelId}`;
    }
    return '/threat-models';
  }

  /**
   * Validate diagram ID format
   */
  isValidDiagramId(diagramId: string | null): boolean {
    return diagramId !== null && diagramId.trim().length > 0;
  }

  /**
   * Load multiple diagram cells with proper history suppression and port visibility management
   */
  loadDiagramCellsBatch(
    cells: any[],
    graph: Graph,
    diagramId: string,
    nodeConfigurationService: any,
  ): void {
    this.logger.info('Loading diagram cells in batch with history suppression', {
      cellCount: cells.length,
      diagramId,
      cellTypes: cells.map(cell => ({ id: cell.id, shape: cell.shape }))
    });

    try {
      // Convert all cells to X6 format
      const convertedCells: any[] = [];
      const nodes: any[] = [];
      const edges: any[] = [];

      cells.forEach(cell => {
        try {
          const convertedCell = this.convertMockCellToX6Format(cell, nodeConfigurationService);
          convertedCells.push(convertedCell);

          // Separate nodes and edges for proper ordering
          if (cell.shape === 'edge' || cell.edge === true) {
            edges.push(convertedCell);
          } else {
            nodes.push(convertedCell);
          }
        } catch (error) {
          this.logger.error('Error converting cell to X6 format', {
            cellId: cell.id,
            cellShape: cell.shape,
            error,
          });
        }
      });

      this.logger.info('Starting atomic operation for diagram loading', {
        nodeCount: nodes.length,
        edgeCount: edges.length
      });

      // Use history coordinator for atomic batch loading with history suppression
      this.historyCoordinator.executeAtomicOperation(
        graph,
        HISTORY_OPERATION_TYPES.DIAGRAM_LOAD,
        () => {
          this.logger.info('Inside atomic operation - clearing existing cells');
          // Clear existing graph first
          graph.clearCells();

          this.logger.info('Adding nodes to graph', { nodeCount: nodes.length });
          // Add nodes first, then edges (to ensure proper dependencies)
          nodes.forEach((nodeConfig, index) => {
            try {
              this.logger.info(`Adding node ${index + 1}/${nodes.length}`, { 
                nodeId: nodeConfig.id, 
                shape: nodeConfig.shape 
              });
              
              // Convert X6 config to NodeInfo domain object
              const nodeInfo = this.convertX6ConfigToNodeInfo(nodeConfig);
              
              // Use infrastructure service instead of direct X6 call
              const node = this.nodeService.createNodeFromInfo(graph, nodeInfo, {
                ensureVisualRendering: true,
                updatePortVisibility: false, // Will be handled in batch after all nodes/edges
                suppressHistory: true, // Already in atomic operation
              });
              
              // Apply zIndex after adding to ensure proper ordering
              if (nodeConfig.zIndex !== undefined) {
                node.setZIndex(nodeConfig.zIndex);
              }
              
              this.logger.info(`Successfully added node ${nodeInfo.id}`);
            } catch (error) {
              this.logger.error('Error adding node during batch load', {
                nodeId: nodeConfig.id,
                nodeIndex: index,
                error,
              });
            }
          });

          this.logger.info('Adding edges to graph', { edgeCount: edges.length });
          edges.forEach((edgeConfig, index) => {
            try {
              this.logger.info(`Adding edge ${index + 1}/${edges.length}`, { 
                edgeId: edgeConfig.id,
                source: edgeConfig.source?.cell,
                target: edgeConfig.target?.cell
              });
              
              // Convert X6 config to EdgeInfo domain object
              const edgeInfo = this.convertX6ConfigToEdgeInfo(edgeConfig);
              
              // Use infrastructure service instead of direct X6 call
              const edge = this.edgeService.createEdge(graph, edgeInfo, {
                ensureVisualRendering: true,
                updatePortVisibility: false, // Will be handled in batch after all nodes/edges
              });
              
              // Apply zIndex after adding to ensure proper ordering
              if (edgeConfig.zIndex !== undefined) {
                edge.setZIndex(edgeConfig.zIndex);
              }
              
              this.logger.info(`Successfully added edge ${edgeInfo.id}`);
            } catch (error) {
              this.logger.error('Error adding edge during batch load', {
                edgeId: edgeConfig.id,
                edgeIndex: index,
                sourceCell: edgeConfig.source?.cell,
                targetCell: edgeConfig.target?.cell,
                error,
              });
            }
          });

          this.logger.debugComponent('DfdDiagram', 'Batch loaded cells into graph', {
            totalCells: convertedCells.length,
            nodes: nodes.length,
            edges: edges.length,
          });

          return convertedCells;
        },
        {
          includeVisualEffects: false,
          includePortVisibility: false,
          includeHighlighting: false,
          includeToolChanges: false,
        },
      );

      this.logger.info('Atomic operation completed - checking graph state');
      const graphCellsAfterLoad = graph.getCells();
      this.logger.info('Graph state after atomic operation', { 
        totalCellsInGraph: graphCellsAfterLoad.length,
        cellIds: graphCellsAfterLoad.map(cell => cell.id)
      });

      // Update port visibility after loading (as separate visual effect)
      this.historyCoordinator.executeVisualEffect(graph, 'diagram-load-port-visibility', () => {
        // Hide unconnected ports on all nodes
        this.portStateManager.hideUnconnectedPorts(graph);
        this.logger.debugComponent('DfdDiagram', 'Updated port visibility after diagram load');
      });

      // Fit the graph to show all content
      graph.centerContent();

      this.logger.info('Successfully loaded diagram cells in batch - final graph state', {
        finalCellCount: graph.getCells().length
      });
    } catch (error) {
      this.logger.error('Error in batch loading diagram cells', error);
      throw error;
    }
  }

  /**
   * Convert mock diagram cell data to proper X6 format
   * Handles both nodes and edges with proper conversion logic
   */
  private convertMockCellToX6Format(mockCell: any, nodeConfigurationService: any): any {
    // Handle edges
    if (mockCell.shape === 'edge' || mockCell.edge === true) {
      return this.convertMockEdgeToX6Format(mockCell);
    }

    // Handle nodes
    return this.convertMockNodeToX6Format(mockCell, nodeConfigurationService);
  }

  /**
   * Convert mock node data to proper X6 format
   */
  private convertMockNodeToX6Format(mockCell: any, nodeConfigurationService: any): any {
    // Get the node type from the shape
    const nodeType = mockCell.shape;

    // Get the correct X6 shape name
    const x6Shape = getX6ShapeForNodeType(nodeType);

    // Extract label from various possible import format locations
    // Note: This is for import/conversion, not live X6 cell manipulation
    const label =
      mockCell.attrs?.text?.text ||
      mockCell.value ||
      mockCell.label ||
      this.getDefaultLabelForType(nodeType);

    // Get proper port configuration for this node type
    const portConfig = nodeConfigurationService.getNodePorts(nodeType);

    // Handle position from either direct properties or geometry object
    const x = mockCell.x ?? mockCell.geometry?.x ?? 0;
    const y = mockCell.y ?? mockCell.geometry?.y ?? 0;
    const width = mockCell.width ?? mockCell.geometry?.width ?? 80;
    const height = mockCell.height ?? mockCell.geometry?.height ?? 80;

    // Create base configuration
    const cellConfig: any = {
      id: mockCell.id,
      shape: x6Shape,
      x,
      y,
      width,
      height,
      label,
      zIndex: mockCell.zIndex || 1,
      ports: portConfig,
    };

    // Add hybrid data format if present
    if (mockCell.data) {
      if (Array.isArray(mockCell.data)) {
        // Legacy format: convert array of {key, value} to hybrid format
        const metadataArray = mockCell.data.filter((item: any) => item.key && item.value);
        cellConfig.data = { _metadata: metadataArray };
      } else {
        // Already in hybrid format or custom object
        cellConfig.data = mockCell.data;
      }
    }

    return cellConfig;
  }

  /**
   * Convert mock edge data to proper X6 format
   */
  private convertMockEdgeToX6Format(mockCell: any): any {
    // Handle different source/target formats
    let source: any;
    let target: any;

    if (mockCell.source && typeof mockCell.source === 'object') {
      // New format: { cell: 'id', port?: 'portId' }
      source = mockCell.source;
    } else {
      // Legacy format: string IDs or separate properties
      source = {
        cell: mockCell.source || mockCell.sourceNodeId,
        port: mockCell.sourcePortId || 'right', // Default to right port
      };
    }

    if (mockCell.target && typeof mockCell.target === 'object') {
      // New format: { cell: 'id', port?: 'portId' }
      target = mockCell.target;
    } else {
      // Legacy format: string IDs or separate properties
      target = {
        cell: mockCell.target || mockCell.targetNodeId,
        port: mockCell.targetPortId || 'left', // Default to left port
      };
    }

    // Create edge configuration
    const edgeConfig: any = {
      id: mockCell.id,
      shape: 'edge',
      source,
      target,
      zIndex: mockCell.zIndex || 1,
      attrs: {
        line: {
          stroke: '#000000',
          strokeWidth: 2,
          targetMarker: {
            name: 'classic',
            size: 8,
          },
        },
      },
    };

    // Add custom attributes if present
    if (mockCell.attrs) {
      edgeConfig.attrs = { ...edgeConfig.attrs, ...mockCell.attrs };
    }

    // Add vertices if present
    if (mockCell.vertices && Array.isArray(mockCell.vertices)) {
      edgeConfig.vertices = mockCell.vertices;
    }

    // Add labels if present (import/conversion logic)
    // Note: This creates X6 configuration, not live cell manipulation
    if (mockCell.labels && Array.isArray(mockCell.labels)) {
      edgeConfig.labels = mockCell.labels;
    } else if (mockCell.value) {
      // Convert legacy value to label
      edgeConfig.labels = [
        {
          attrs: {
            text: {
              text: mockCell.value,
            },
          },
        },
      ];
    }

    // Add hybrid data format if present
    if (mockCell.data) {
      if (Array.isArray(mockCell.data)) {
        // Legacy format: convert array of {key, value} to hybrid format
        const metadataArray = mockCell.data.filter((item: any) => item.key && item.value);
        edgeConfig.data = { _metadata: metadataArray };
      } else {
        // Already in hybrid format or custom object
        edgeConfig.data = mockCell.data;
      }
    }

    return edgeConfig;
  }

  /**
   * Get default label for node type
   */
  private getDefaultLabelForType(nodeType: string): string {
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

  /**
   * Convert X6 node config to NodeInfo domain object
   */
  private convertX6ConfigToNodeInfo(nodeConfig: any): NodeInfo {
    // Extract hybrid data format (metadata + custom data)
    const hybridData = nodeConfig.data || { _metadata: [] };

    // Handle legacy format conversion if needed
    if (hybridData._metadata) {
      // New hybrid format - data is already in correct format
      // No conversion needed
    } else if (hybridData.metadata) {
      // Legacy format - convert to new format if needed
      // For now, keep as-is
    }

    return NodeInfo.fromJSON({
      id: nodeConfig.id,
      shape: nodeConfig.shape as NodeType,
      x: nodeConfig.x,
      y: nodeConfig.y,
      width: nodeConfig.width,
      height: nodeConfig.height,
      label: nodeConfig.label || '',
      data: hybridData,
      markup: nodeConfig.markup,
      tools: nodeConfig.tools,
    });
  }

  /**
   * Convert X6 edge config to EdgeInfo domain object
   */
  private convertX6ConfigToEdgeInfo(edgeConfig: any): EdgeInfo {
    // Extract label from labels array or direct label property
    let label = '';
    if (edgeConfig.labels && edgeConfig.labels.length > 0) {
      const firstLabel = edgeConfig.labels[0];
      if (firstLabel.attrs?.text?.text) {
        label = firstLabel.attrs.text.text;
      }
    } else if (edgeConfig.label) {
      label = edgeConfig.label;
    }

    // Extract hybrid data format (metadata + custom data)
    const hybridData = edgeConfig.data || { _metadata: [] };

    // Handle legacy format conversion if needed
    if (hybridData._metadata) {
      // New hybrid format - data is already in correct format
      // No conversion needed
    } else if (hybridData.metadata) {
      // Legacy format - convert to new format if needed
      // For now, keep as-is
    }

    return EdgeInfo.fromJSON({
      id: edgeConfig.id,
      source: edgeConfig.source,
      target: edgeConfig.target,
      label,
      vertices: edgeConfig.vertices || [],
      data: hybridData,
      markup: edgeConfig.markup,
      tools: edgeConfig.tools,
      router: edgeConfig.router,
      connector: edgeConfig.connector,
      defaultLabel: edgeConfig.defaultLabel,
    });
  }

  /**
   * Save diagram changes back to the threat model
   */
  saveDiagramChanges(graph: Graph, diagramId: string, threatModelId: string): Observable<boolean> {
    this.logger.info('Saving diagram changes using PATCH', { diagramId, threatModelId });

    // Convert current graph state to cells format
    const cells = this.convertGraphToCellsFormat(graph);
    this.logger.debug('[DfdDiagram] Converted graph to cells format', { cellCount: cells.length });

    // Use the new PATCH method for diagram-only updates instead of updating the entire threat model
    return this.threatModelService.patchDiagramCells(threatModelId, diagramId, cells).pipe(
      map(updatedDiagram => {
        this.logger.info('Successfully saved diagram changes using PATCH', {
          diagramId,
          threatModelId,
          cellCount: cells.length,
          diagramName: updatedDiagram.name
        });
        return true;
      }),
      catchError(error => {
        this.logger.error('Error saving diagram changes using PATCH', error, {
          diagramId,
          threatModelId,
          cellCount: cells.length
        });
        return of(false);
      }),
    );
  }

  /**
   * Convert current graph state to cells format for saving
   */
  private convertGraphToCellsFormat(graph: Graph): any[] {
    const cells: any[] = [];

    // Get all cells from the graph
    const graphCells = graph.getCells();

    graphCells.forEach(cell => {
      try {
        if (cell.isNode()) {
          // Convert node to cell format
          const nodeCell = {
            id: cell.id,
            shape: cell.shape,
            x: cell.position().x,
            y: cell.position().y,
            width: cell.size().width,
            height: cell.size().height,
            zIndex: cell.getZIndex(),
            visible: true,
            attrs: {
              body: {
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
              },
              text: {
                text: (cell as any).getLabel
                  ? (cell as any).getLabel()
                  : (cell.getAttrs() as any)?.text?.text || '',
                fontSize: 14,
                fill: '#000000',
              },
            },
            data: this.convertCellDataToArray(cell.getData()),
          };
          cells.push(nodeCell);
        } else if (cell.isEdge()) {
          // Convert edge to cell format
          const source = cell.getSource();
          const target = cell.getTarget();

          const edgeCell: any = {
            id: cell.id,
            shape: 'edge',
            source: {
              cell: (source as any).cell,
              port: (source as any).port,
            },
            target: {
              cell: (target as any).cell,
              port: (target as any).port,
            },
            vertices: cell.getVertices(),
            zIndex: cell.getZIndex(),
            attrs: {
              line: {
                stroke: '#000000',
                strokeWidth: 2,
                targetMarker: {
                  name: 'classic',
                  size: 8,
                },
              },
            },
            data: this.convertCellDataToArray(cell.getData()),
          };

          // Add labels if present
          const labels = (cell as any).getLabels ? (cell as any).getLabels() : [];
          if (labels && labels.length > 0) {
            edgeCell.labels = labels;
          }

          cells.push(edgeCell);
        }
      } catch (error) {
        this.logger.error('Error converting cell to save format', {
          cellId: cell.id,
          cellType: cell.isNode() ? 'node' : 'edge',
          error,
        });
      }
    });

    this.logger.debugComponent('DfdDiagram', 'Converted graph to cells format', {
      cellCount: cells.length,
    });
    return cells;
  }

  /**
   * Convert cell data from object format to array format for saving
   */
  private convertCellDataToArray(cellData: any): any {
    // Return the hybrid data format directly
    if (cellData && cellData._metadata) {
      // Already in hybrid format
      return cellData;
    } else if (cellData && cellData.metadata && typeof cellData.metadata === 'object') {
      // Legacy format - convert to hybrid format
      const metadataArray: any[] = [];
      Object.entries(cellData.metadata).forEach(([key, value]) => {
        metadataArray.push({ key, value: String(value) });
      });
      return { _metadata: metadataArray };
    }

    // Default empty hybrid format
    return { _metadata: [] };
  }

}
