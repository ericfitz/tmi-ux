import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError, timeout, switchMap } from 'rxjs/operators';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { AppOperationStateManager } from './app-operation-state-manager.service';
import { InfraPortStateService } from '../../infrastructure/services/infra-port-state.service';
import { getX6ShapeForNodeType } from '../../infrastructure/adapters/infra-x6-shape-definitions';
import { InfraNodeService } from '../../infrastructure/services/infra-node.service';
import { InfraEdgeService } from '../../infrastructure/services/infra-edge.service';
import { NodeInfo, NodeType } from '../../domain/value-objects/node-info';
import { EdgeInfo } from '../../domain/value-objects/edge-info';
import { DFD_STYLING } from '../../constants/styling-constants';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { InfraWebsocketCollaborationAdapter } from '../../infrastructure/adapters/infra-websocket-collaboration.adapter';
import { CellOperation } from '../../../../core/types/websocket-message.types';
import { normalizeCellsFormat } from '../../utils/cell-format-normalization.util';

/**
 * Interface for diagram data
 */
export interface DiagramData {
  id: string;
  name: string;
  threatModelId?: string;
  threatModelName?: string;
  cells?: any[]; // Full diagram cells data for rendering
  update_vector?: number; // Server-managed version counter
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
export class AppDiagramService {
  constructor(
    private logger: LoggerService,
    private threatModelService: ThreatModelService,
    private historyCoordinator: AppOperationStateManager,
    private portStateManager: InfraPortStateService,
    private infraNodeService: InfraNodeService,
    private infraEdgeService: InfraEdgeService,
    private collaborationService: DfdCollaborationService,
    private collaborativeOperationService: InfraWebsocketCollaborationAdapter,
  ) {}

  /**
   * Load diagram data by ID
   * Returns observable with load result
   */
  loadDiagram(diagramId: string, threatModelId?: string): Observable<DiagramLoadResult> {
    this.logger.info('Loading diagram data using dedicated diagram endpoint', {
      diagramId,
      threatModelId,
    });

    if (!threatModelId) {
      this.logger.error('Threat model ID is required to load diagram data');
      return of({
        success: false,
        error: 'Threat model ID is required',
      });
    }

    // Load both diagram and threat model data to get diagram name and threat model name
    return this.threatModelService.getDiagramById(threatModelId, diagramId).pipe(
      switchMap(diagram => {
        if (!diagram) {
          this.logger.warn('Diagram not found', { diagramId, threatModelId });
          return of({
            success: false,
            error: `Diagram with ID ${diagramId} not found`,
          });
        }

        // Also load threat model to get its name
        return this.threatModelService.getThreatModelById(threatModelId).pipe(
          map(threatModel => {
            const diagramData: DiagramData = {
              id: diagramId,
              name: diagram.name,
              threatModelId,
              threatModelName: threatModel?.name,
              cells: diagram.cells || [], // Use the diagram cells directly from the diagram endpoint
              update_vector: diagram.update_vector,
            };

            this.logger.info('Successfully loaded diagram and threat model data', {
              diagramName: diagramData.name,
              threatModelName: diagramData.threatModelName,
              id: diagramId,
              threatModelId,
              cellCount: diagramData.cells?.length || 0,
              updateVector: diagramData.update_vector,
            });

            return {
              success: true,
              diagram: diagramData,
            };
          }),
        );
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
    infraNodeConfigurationService: any,
  ): void {
    this.logger.info('Loading diagram cells in batch with history suppression', {
      cellCount: cells.length,
      diagramId,
      cellTypes: cells.map(cell => ({ id: cell.id, shape: cell.shape })),
    });

    try {
      // Normalize cells from flat format (X6 v1 legacy) to nested format (X6 v2 native)
      // This ensures backward compatibility with old exports while using X6 v2 native format
      const normalizedCells = normalizeCellsFormat(cells);

      this.logger.debugComponent('DfdDiagram', 'Normalized cells to X6 v2 nested format', {
        cellCount: normalizedCells.length,
      });

      // Deduplicate cells by ID before processing
      const seenIds = new Set<string>();
      const deduplicatedCells = normalizedCells.filter(cell => {
        if (seenIds.has(cell.id)) {
          this.logger.warn('Duplicate cell ID detected in server data, skipping duplicate', {
            cellId: cell.id,
            shape: cell.shape,
          });
          return false;
        }
        seenIds.add(cell.id);
        return true;
      });

      if (deduplicatedCells.length < cells.length) {
        this.logger.warn('Removed duplicate cells from server data', {
          originalCount: cells.length,
          deduplicatedCount: deduplicatedCells.length,
          duplicatesRemoved: cells.length - deduplicatedCells.length,
        });
      }

      // Convert all cells to X6 format
      const convertedCells: any[] = [];
      const nodes: any[] = [];
      const edges: any[] = [];

      deduplicatedCells.forEach(cell => {
        try {
          const convertedCell = this.convertMockCellToX6Format(cell, infraNodeConfigurationService);
          convertedCells.push(convertedCell);

          // Separate nodes and edges for proper ordering
          if (cell.shape === 'edge' || cell['edge'] === true) {
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

      this.logger.debugComponent('DfdDiagram', 'Starting atomic operation for diagram loading', {
        nodeCount: nodes.length,
        edgeCount: edges.length,
      });

      // Use history coordinator for batch loading with history suppression
      // executeRemoteOperation disables history during the operation
      this.historyCoordinator.executeRemoteOperation(graph, () => {
        this.logger.debugComponent(
          'DfdDiagram',
          'Inside atomic operation - clearing existing cells',
        );
        // Clear existing graph first
        graph.clearCells();

        this.logger.debugComponent('DfdDiagram', 'Adding nodes to graph', {
          nodeCount: nodes.length,
        });
        // Add nodes first, then edges (to ensure proper dependencies)
        // Track nodes that have parent relationships to establish after all nodes are created
        const nodesWithParents: Array<{ nodeId: string; parentId: string }> = [];

        nodes.forEach((nodeConfig, index) => {
          try {
            this.logger.debugComponent('DfdDiagram', `Adding node ${index + 1}/${nodes.length}`, {
              nodeId: nodeConfig.id,
              shape: nodeConfig.shape,
            });

            // Convert X6 config to NodeInfo domain object
            const nodeInfo = this.convertX6ConfigToNodeInfo(nodeConfig);

            // Use infrastructure service instead of direct X6 call
            const node = this.infraNodeService.createNodeFromInfo(graph, nodeInfo, {
              ensureVisualRendering: true,
              updatePortVisibility: false, // Will be handled in batch after all nodes/edges
              suppressHistory: true, // Already in atomic operation
            });

            // Apply zIndex after adding to ensure proper ordering
            if (nodeConfig.zIndex !== undefined) {
              node.setZIndex(nodeConfig.zIndex);
            }

            // Track parent relationship to establish later
            if (nodeConfig.parent) {
              nodesWithParents.push({ nodeId: nodeConfig.id, parentId: nodeConfig.parent });
            }

            this.logger.debugComponent('DfdDiagram', `Successfully added node ${nodeInfo.id}`);
          } catch (error) {
            this.logger.error('Error adding node during batch load', {
              nodeId: nodeConfig.id,
              nodeIndex: index,
              error,
            });
          }
        });

        // Establish parent-child relationships after all nodes are created
        this.logger.debugComponent('DfdDiagram', 'Establishing embedding relationships', {
          count: nodesWithParents.length,
        });
        nodesWithParents.forEach(({ nodeId, parentId }) => {
          try {
            const childNode = graph.getCellById(nodeId);
            const parentNode = graph.getCellById(parentId);

            if (childNode && parentNode && childNode.isNode() && parentNode.isNode()) {
              childNode.setParent(parentNode);
              this.logger.debugComponent('DfdDiagram', 'Established embedding relationship', {
                childId: nodeId,
                parentId: parentId,
              });
            } else {
              this.logger.warn('Could not establish embedding relationship', {
                childId: nodeId,
                parentId: parentId,
                childFound: !!childNode,
                parentFound: !!parentNode,
              });
            }
          } catch (error) {
            this.logger.error('Error establishing embedding relationship', {
              childId: nodeId,
              parentId: parentId,
              error,
            });
          }
        });

        this.logger.debugComponent('DfdDiagram', 'Adding edges to graph', {
          edgeCount: edges.length,
        });
        edges.forEach((edgeConfig, index) => {
          try {
            this.logger.debugComponent('DfdDiagram', `Adding edge ${index + 1}/${edges.length}`, {
              edgeId: edgeConfig.id,
              source: edgeConfig.source?.cell,
              target: edgeConfig.target?.cell,
            });

            // Convert X6 config to EdgeInfo domain object
            const edgeInfo = this.convertX6ConfigToEdgeInfo(edgeConfig);

            // Use infrastructure service instead of direct X6 call
            const edge = this.infraEdgeService.createEdge(graph, edgeInfo, {
              ensureVisualRendering: true,
              updatePortVisibility: false, // Will be handled in batch after all nodes/edges
            });

            // Apply zIndex after adding to ensure proper ordering
            if (edgeConfig.zIndex !== undefined) {
              edge.setZIndex(edgeConfig.zIndex);
            }

            this.logger.debugComponent('DfdDiagram', `Successfully added edge ${edgeInfo.id}`);
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
      });

      this.logger.debugComponent('DfdDiagram', 'Atomic operation completed - checking graph state');
      const graphCellsAfterLoad = graph.getCells();
      this.logger.debugComponent('DfdDiagram', 'Graph state after atomic operation', {
        totalCellsInGraph: graphCellsAfterLoad.length,
        cellIds: graphCellsAfterLoad.map(cell => cell.id),
      });

      // Update port visibility after loading (as separate visual effect)
      this.historyCoordinator.executeVisualEffect(graph, () => {
        // Hide unconnected ports on all nodes
        this.portStateManager.hideUnconnectedPorts(graph);
        this.logger.debugComponent('DfdDiagram', 'Updated port visibility after diagram load');
      });

      // Fit the graph to show all content
      graph.centerContent();

      this.logger.debugComponent(
        'DfdDiagram',
        'Successfully loaded diagram cells in batch - final graph state',
        {
          finalCellCount: graph.getCells().length,
        },
      );
    } catch (error) {
      this.logger.error('Error in batch loading diagram cells', error);
      throw error;
    }
  }

  /**
   * Convert mock diagram cell data to proper X6 format
   * Handles both nodes and edges with proper conversion logic
   */
  private convertMockCellToX6Format(mockCell: any, infraNodeConfigurationService: any): any {
    // Handle edges
    if (mockCell.shape === 'edge' || mockCell.edge === true) {
      return this.convertMockEdgeToX6Format(mockCell);
    }

    // Handle nodes
    return this.convertMockNodeToX6Format(mockCell, infraNodeConfigurationService);
  }

  /**
   * Convert mock node data to proper X6 format
   */
  private convertMockNodeToX6Format(mockCell: any, infraNodeConfigurationService: any): any {
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
    const portConfig = infraNodeConfigurationService.getNodePorts(nodeType);

    // Handle position from X6 format (position object), fallback to flat properties or geometry
    const x = mockCell.position?.x ?? mockCell.x ?? mockCell.geometry?.x ?? 0;
    const y = mockCell.position?.y ?? mockCell.y ?? mockCell.geometry?.y ?? 0;
    const width = mockCell.size?.width ?? mockCell.width ?? mockCell.geometry?.width ?? 80;
    const height = mockCell.size?.height ?? mockCell.height ?? mockCell.geometry?.height ?? 80;

    // Log position data for debugging positioning issues
    if (x === 0 && y === 0 && !mockCell.position?.x && !mockCell.x && !mockCell.geometry?.x) {
      this.logger.warn('Node has no position data, defaulting to (0,0)', {
        nodeId: mockCell.id,
        shape: nodeType,
        mockCellKeys: Object.keys(mockCell),
        hasPosition: 'position' in mockCell,
        hasX: 'x' in mockCell,
        hasY: 'y' in mockCell,
        hasGeometry: 'geometry' in mockCell,
      });
    }

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

    // Add parent property if present (for embedded nodes)
    if (mockCell.parent) {
      cellConfig.parent = mockCell.parent;
    }

    // Add children property if present (for container nodes)
    if (mockCell.children && Array.isArray(mockCell.children)) {
      cellConfig.children = mockCell.children;
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
      connector: mockCell.connector || DFD_STYLING.EDGES.CONNECTOR,
      router: mockCell.router || DFD_STYLING.EDGES.ROUTER,
      attrs: {
        line: {
          stroke: DFD_STYLING.EDGES.STROKE,
          strokeWidth: DFD_STYLING.EDGES.STROKE_WIDTH,
          targetMarker: {
            name: DFD_STYLING.EDGES.TARGET_MARKER.NAME,
            size: DFD_STYLING.EDGES.TARGET_MARKER.SIZE,
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

    // Build attrs with label if present
    const attrs = nodeConfig.attrs || {
      text: { text: nodeConfig.label || '' },
    };

    return NodeInfo.fromJSON({
      id: nodeConfig.id,
      shape: nodeConfig.shape as NodeType,
      x: nodeConfig.x,
      y: nodeConfig.y,
      width: nodeConfig.width,
      height: nodeConfig.height,
      attrs,
      data: hybridData,
      parent: nodeConfig.parent,
      markup: nodeConfig.markup,
      tools: nodeConfig.tools,
    });
  }

  /**
   * Convert X6 edge config to EdgeInfo domain object
   */
  private convertX6ConfigToEdgeInfo(edgeConfig: any): EdgeInfo {
    // Extract labels array directly if present, otherwise create from single label
    let labels: any[] = [];

    if (edgeConfig.labels && Array.isArray(edgeConfig.labels)) {
      // Use existing labels array directly for X6 compatibility
      labels = edgeConfig.labels;
    } else if (edgeConfig.label) {
      // Convert single label to X6 labels format
      labels = [
        {
          attrs: {
            text: {
              text: edgeConfig.label,
            },
          },
        },
      ];
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
      labels, // Pass the full labels array instead of a simple string
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
   * Routes to WebSocket for collaborative sessions, REST for solo editing
   * Implements graceful fallback to REST when WebSocket fails
   */
  saveDiagramChanges(graph: Graph, diagramId: string, threatModelId: string): Observable<boolean> {
    // Check if in collaborative mode
    if (this.collaborationService.isCollaborating()) {
      this.logger.debug('Collaborative mode: attempting WebSocket save with REST fallback');

      // In collaborative mode, try WebSocket first, but fall back to REST if WebSocket fails
      // For bulk save operations (like auto-save), we need to convert the entire graph state
      return this._saveViaWebSocketWithFallback(graph, diagramId, threatModelId);
    }

    // Solo mode: use existing REST PATCH operation
    return this.saveViaREST(graph, diagramId, threatModelId);
  }

  /**
   * Save diagram changes with image data back to the threat model
   * Routes to WebSocket for collaborative sessions, REST for solo editing
   * Implements graceful fallback to REST when WebSocket fails
   */
  saveDiagramChangesWithImage(
    graph: Graph,
    diagramId: string,
    threatModelId: string,
    imageData: { svg?: string; update_vector?: number },
  ): Observable<boolean> {
    // Check if in collaborative mode
    if (this.collaborationService.isCollaborating()) {
      this.logger.debug(
        'Collaborative mode: attempting WebSocket save with image data and REST fallback',
      );

      // In collaborative mode, try WebSocket first, but fall back to REST if WebSocket fails
      // For bulk save operations (like auto-save), we need to convert the entire graph state
      return this._saveViaWebSocketWithImageFallback(graph, diagramId, threatModelId, imageData);
    }

    // Solo mode: use REST with image data
    return this.saveViaRESTWithImage(graph, diagramId, threatModelId, imageData);
  }

  /**
   * Attempt save via WebSocket with image data, falling back to REST if WebSocket fails
   */
  private _saveViaWebSocketWithImageFallback(
    graph: Graph,
    diagramId: string,
    threatModelId: string,
    imageData: { svg?: string; update_vector?: number },
  ): Observable<boolean> {
    // Convert current graph state to cell operations (full state sync)
    const cells = this.convertGraphToCellsFormat(graph);
    const operations: CellOperation[] = cells.map(cell => ({
      id: cell.id,
      operation: 'update',
      data: cell,
    }));

    this.logger.debug('[DfdDiagram] Attempting WebSocket save with image data', {
      diagramId,
      threatModelId,
      operationCount: operations.length,
      hasImageData: !!imageData.svg,
    });

    // Try WebSocket save first
    return this.sendCollaborativeOperation(operations, graph, diagramId, threatModelId).pipe(
      map(() => true), // Convert void to boolean success
      catchError((wsError: unknown) => {
        this.logger.warn(
          'WebSocket save with image failed, falling back to REST with image',
          wsError,
          {
            diagramId,
            threatModelId,
            operationCount: operations.length,
          },
        );

        // Fall back to REST save with image
        return this.saveViaRESTWithImage(graph, diagramId, threatModelId, imageData).pipe(
          catchError((restError: unknown) => {
            this.logger.error('Both WebSocket and REST save with image failed', {
              wsError: wsError instanceof Error ? wsError.message : String(wsError),
              restError: restError instanceof Error ? restError.message : String(restError),
            });
            return of(false); // Return false instead of throwing to match REST behavior
          }),
        );
      }),
    );
  }

  /**
   * Save diagram changes with image data via REST API (non-collaborative mode)
   */
  private saveViaRESTWithImage(
    graph: Graph,
    diagramId: string,
    threatModelId: string,
    imageData: { svg?: string; update_vector?: number },
  ): Observable<boolean> {
    this.logger.info('Saving diagram changes with image using REST PATCH', {
      diagramId,
      threatModelId,
      hasImageData: !!imageData.svg,
    });

    // Convert current graph state to cells format
    const cells = this.convertGraphToCellsFormat(graph);
    this.logger.debug('[DfdDiagram] Converted graph to cells format with image', {
      cellCount: cells.length,
      hasImageData: !!imageData.svg,
    });

    // Use the PATCH method for diagram-only updates with image data
    return this.threatModelService
      .patchDiagramWithImage(threatModelId, diagramId, cells, imageData)
      .pipe(
        map(updatedDiagram => {
          this.logger.info('Successfully saved diagram changes with image using REST PATCH', {
            diagramId,
            threatModelId,
            cellCount: cells.length,
            diagramName: updatedDiagram.name,
            hasImageData: !!imageData.svg,
          });
          return true;
        }),
        catchError(error => {
          this.logger.error('Error saving diagram changes with image using REST PATCH', error, {
            diagramId,
            threatModelId,
            cellCount: cells.length,
            hasImageData: !!imageData.svg,
          });
          return of(false);
        }),
      );
  }

  /**
   * Attempt save via WebSocket, falling back to REST if WebSocket fails
   */
  private _saveViaWebSocketWithFallback(
    graph: Graph,
    diagramId: string,
    threatModelId: string,
  ): Observable<boolean> {
    // Convert current graph state to cell operations (full state sync)
    const cells = this.convertGraphToCellsFormat(graph);
    const operations: CellOperation[] = cells.map(cell => ({
      id: cell.id,
      operation: 'update', // For bulk save, treat all as updates
      data: cell,
    }));

    this.logger.debug('Attempting WebSocket bulk save', {
      cellCount: cells.length,
      diagramId,
      threatModelId,
    });

    // Try WebSocket operation with timeout
    return this.collaborativeOperationService.sendDiagramOperation(operations).pipe(
      timeout(15000), // 15 second timeout for WebSocket operations
      map(() => {
        this.logger.info('WebSocket bulk save successful');
        return true;
      }),
      catchError(error => {
        this.logger.warn('WebSocket bulk save failed, falling back to REST', {
          error: error.message,
          cellCount: cells.length,
        });

        // Check if error is authentication-related (don't fallback for auth errors)
        if (this._isAuthenticationError(error)) {
          this.logger.debug('User lacks edit permissions - operation blocked as expected', {
            error: error.message,
          });
          return throwError(() => error);
        }

        // Attempt REST fallback
        this.logger.info('Executing REST fallback for bulk save operation');
        return this.saveViaREST(graph, diagramId, threatModelId).pipe(
          map(success => {
            if (success) {
              this.logger.info('REST fallback successful - diagram saved via REST API');
            } else {
              this.logger.error('REST fallback failed - diagram not saved');
            }
            return success;
          }),
          catchError(restError => {
            this.logger.error('Both WebSocket and REST bulk save operations failed', {
              webSocketError: error.message,
              restError: restError.message,
            });
            return of(false); // Return false instead of throwing to match REST behavior
          }),
        );
      }),
    );
  }

  /**
   * Save diagram changes via REST API (non-collaborative mode)
   */
  private saveViaREST(graph: Graph, diagramId: string, threatModelId: string): Observable<boolean> {
    this.logger.info('Saving diagram changes using REST PATCH', { diagramId, threatModelId });

    // Convert current graph state to cells format
    const cells = this.convertGraphToCellsFormat(graph);
    this.logger.debug('[DfdDiagram] Converted graph to cells format', { cellCount: cells.length });

    // Use the PATCH method for diagram-only updates
    return this.threatModelService.patchDiagramCells(threatModelId, diagramId, cells).pipe(
      map(updatedDiagram => {
        this.logger.info('Successfully saved diagram changes using REST PATCH', {
          diagramId,
          threatModelId,
          cellCount: cells.length,
          diagramName: updatedDiagram.name,
        });
        return true;
      }),
      catchError(error => {
        this.logger.error('Error saving diagram changes using REST PATCH', error, {
          diagramId,
          threatModelId,
          cellCount: cells.length,
        });
        return of(false);
      }),
    );
  }

  /**
   * Send incremental cell operations via WebSocket for collaborative editing
   * Falls back to REST save if WebSocket fails
   */
  sendCollaborativeOperation(
    operations: CellOperation[],
    graph?: Graph,
    diagramId?: string,
    threatModelId?: string,
  ): Observable<void> {
    if (!this.collaborationService.isCollaborating()) {
      return throwError(() => new Error('Not in collaborative mode'));
    }

    this.logger.debug('Sending collaborative operation', {
      operationCount: operations.length,
      operations: operations.map(op => ({ id: op.id, operation: op.operation })),
    });

    // Try WebSocket operation first with timeout
    return this.collaborativeOperationService.sendDiagramOperation(operations).pipe(
      timeout(15000), // 15 second timeout for WebSocket operations
      catchError(error => {
        this.logger.warn('WebSocket operation failed, attempting REST fallback', {
          error: error.message,
          operationCount: operations.length,
        });

        // Check if we have the necessary parameters for REST fallback
        if (!graph || !diagramId || !threatModelId) {
          this.logger.error('REST fallback not possible - missing required parameters', {
            hasGraph: !!graph,
            hasDiagramId: !!diagramId,
            hasThreatModelId: !!threatModelId,
          });
          return throwError(
            () =>
              new Error(
                `WebSocket operation failed and REST fallback not available: ${error.message}`,
              ),
          );
        }

        // Check if error is recoverable (don't fallback for auth errors)
        if (this._isAuthenticationError(error)) {
          this.logger.debug('User lacks edit permissions - operation blocked as expected', {
            error: error.message,
          });
          return throwError(() => error);
        }

        // Attempt REST fallback
        this.logger.info('Falling back to REST save due to WebSocket failure');
        return this.saveViaREST(graph, diagramId, threatModelId).pipe(
          map(() => {
            this.logger.info('REST fallback successful - operation completed via REST API');
            // Return void to match WebSocket operation signature
          }),
          catchError(restError => {
            this.logger.error('Both WebSocket and REST operations failed', {
              webSocketError: error.message,
              restError: restError.message,
            });
            return throwError(
              () =>
                new Error(
                  `WebSocket failed: ${error.message}. REST fallback also failed: ${restError.message}`,
                ),
            );
          }),
        );
      }),
    );
  }

  /**
   * Check if error is authentication-related and shouldn't trigger fallback
   */
  private _isAuthenticationError(error: any): boolean {
    return (
      error.message?.includes('401') ||
      error.message?.includes('403') ||
      error.message?.includes('permission') ||
      error.message?.includes('Unauthorized')
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
          const nodeCell: any = {
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
                fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
                fill: DFD_STYLING.NODES.LABEL_TEXT_COLOR,
              },
            },
            data: this.convertCellDataToArray(cell.getData()),
          };

          // Add parent property if the node is embedded
          const parent = cell.getParent();
          if (parent && parent.isNode()) {
            nodeCell.parent = parent.id;
          }

          // Add children property if the node has embedded children
          const children = graphCells.filter(c => c.isNode() && c.getParent()?.id === cell.id);
          if (children.length > 0) {
            nodeCell.children = children.map(c => c.id);
          }

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
                stroke: DFD_STYLING.EDGES.STROKE,
                strokeWidth: DFD_STYLING.EDGES.STROKE_WIDTH,
                targetMarker: {
                  name: DFD_STYLING.EDGES.TARGET_MARKER.NAME,
                  size: DFD_STYLING.EDGES.TARGET_MARKER.SIZE,
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
