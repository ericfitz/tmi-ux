import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { AppOperationStateManager } from './app-operation-state-manager.service';
import { InfraPortStateService } from '../../infrastructure/services/infra-port-state.service';
import { getX6ShapeForNodeType } from '../../infrastructure/adapters/infra-x6-shape-definitions';
import { InfraNodeService } from '../../infrastructure/services/infra-node.service';
import { InfraEdgeService } from '../../infrastructure/services/infra-edge.service';
import { NodeInfo, NodeType } from '../../domain/value-objects/node-info';
import { createDefaultNodeAttrs } from '../../domain/value-objects/node-attrs';
import { EdgeInfo } from '../../domain/value-objects/edge-info';
import { DFD_STYLING } from '../../constants/styling-constants';
import { normalizeCellsFormatAndValidateRelationships } from '../../utils/cell-format-normalization.util';
import { isEdgeShape, CANONICAL_EDGE_SHAPE } from '../../utils/cell-property-filter.util';

/**
 * Interface for diagram data
 */
export interface DiagramData {
  id: string;
  name: string;
  description?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
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
  ) {}

  /**
   * Load diagram data by ID
   * Returns observable with load result
   */
  loadDiagram(diagramId: string, threatModelId?: string): Observable<DiagramLoadResult> {
    this.logger.debugComponent(
      'AppDiagramService',
      'Loading diagram data using dedicated diagram endpoint',
      {
        diagramId,
        threatModelId,
      },
    );

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
              description: diagram.description,
              include_in_report: diagram.include_in_report,
              timmy_enabled: diagram.timmy_enabled,
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
   * @returns Object indicating whether relationship fixes were applied
   */
  loadDiagramCellsBatch(
    cells: any[],
    graph: Graph,
    diagramId: string,
    infraNodeConfigurationService: any,
  ): { relationshipFixesApplied: boolean } {
    this.logger.debugComponent(
      'AppDiagramService',
      'Loading diagram cells in batch with history suppression',
      {
        cellCount: cells.length,
        diagramId,
        cellTypes: cells.map(cell => ({ id: cell.id, shape: cell.shape })),
      },
    );

    try {
      // Normalize cells from flat format (X6 v1 legacy) to nested format (X6 v2 native)
      // and validate parent-child relationships
      // This ensures backward compatibility with old exports while using X6 v2 native format
      const { cells: normalizedCells, validationResult } =
        normalizeCellsFormatAndValidateRelationships(cells, this.logger);

      this.logger.debugComponent('DfdDiagram', 'Normalized cells to X6 v2 nested format', {
        cellCount: normalizedCells.length,
        relationshipIssuesFixed: validationResult.fixCount,
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

      // Sanitize cells from server to handle known data corruption issues
      // (e.g., nodes returned with spurious source/target, empty attrs)
      const sanitizedCells = deduplicatedCells.map(cell => this.sanitizeCellFromServer(cell));

      // Convert all cells to X6 format
      const convertedCells: any[] = [];
      const nodes: any[] = [];
      const edges: any[] = [];

      sanitizedCells.forEach(cell => {
        try {
          const convertedCell = this.convertMockCellToX6Format(cell, infraNodeConfigurationService);
          convertedCells.push(convertedCell);

          // Separate nodes and edges for proper ordering
          // Use isEdgeShape to handle both 'edge' (legacy) and 'flow' (canonical) shapes
          // Also check structural properties: cells with non-nil source/target are edges
          if (
            isEdgeShape(cell.shape) ||
            cell['edge'] === true ||
            this.hasNonNilSourceTarget(cell)
          ) {
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

      // Return validation result
      return { relationshipFixesApplied: validationResult.hadIssues };
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
    // Handle edges - use isEdgeShape to handle both 'edge' (legacy) and 'flow' (canonical) shapes
    // Also check structural properties: cells with non-nil source/target are edges
    if (
      isEdgeShape(mockCell.shape) ||
      mockCell.edge === true ||
      this.hasNonNilSourceTarget(mockCell)
    ) {
      return this.convertMockEdgeToX6Format(mockCell);
    }

    // Handle nodes
    return this.convertMockNodeToX6Format(mockCell, infraNodeConfigurationService);
  }

  /**
   * Convert mock node data to proper X6 format
   */
  private convertMockNodeToX6Format(mockCell: any, infraNodeConfigurationService: any): any {
    const nodeType = mockCell.shape;
    const x6Shape = getX6ShapeForNodeType(nodeType);
    const label =
      mockCell.attrs?.text?.text ||
      mockCell.value ||
      mockCell.label ||
      this.getDefaultLabelForType(nodeType);

    // If attrs are empty or missing key properties, reconstruct defaults for the node type.
    // This handles server-side data corruption where node attrs are returned as {}.
    const hasValidAttrs =
      mockCell.attrs && (mockCell.attrs.text?.text || mockCell.attrs.body?.fill);
    const nodeAttrs = hasValidAttrs ? mockCell.attrs : createDefaultNodeAttrs(nodeType, label);

    const portConfig = mockCell.ports || infraNodeConfigurationService.getNodePorts(nodeType);
    const { x, y, width, height } = this.extractMockNodeGeometry(mockCell, nodeType);

    return {
      id: mockCell.id,
      shape: x6Shape,
      x,
      y,
      width,
      height,
      label,
      zIndex: mockCell.zIndex || 1,
      ports: portConfig,
      attrs: nodeAttrs,
      ...this.normalizeMockNodeData(mockCell),
      ...(mockCell.parent ? { parent: mockCell.parent } : {}),
      ...(Array.isArray(mockCell.children) ? { children: mockCell.children } : {}),
    };
  }

  /** Extract position and size from various import format locations. */
  private extractMockNodeGeometry(
    mockCell: any,
    nodeType: string,
  ): { x: number; y: number; width: number; height: number } {
    const x = this._resolveGeometryField(mockCell, 'position', 'x', 0);
    const y = this._resolveGeometryField(mockCell, 'position', 'y', 0);
    const width = this._resolveGeometryField(mockCell, 'size', 'width', 80);
    const height = this._resolveGeometryField(mockCell, 'size', 'height', 80);

    if (x === 0 && y === 0 && this._lacksExplicitPosition(mockCell)) {
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

    return { x, y, width, height };
  }

  /**
   * Resolve a geometry field from multiple possible import format locations.
   * Priority: nested (position/size) → flat → geometry (legacy) → fallback.
   */
  private _resolveGeometryField(
    mockCell: any,
    nestedKey: string,
    field: string,
    fallback: number,
  ): number {
    return (
      mockCell[nestedKey]?.[field] ?? mockCell[field] ?? mockCell.geometry?.[field] ?? fallback
    );
  }

  /** Check if a mock cell has no explicit x position in any format location. */
  private _lacksExplicitPosition(mockCell: any): boolean {
    return !mockCell.position?.x && !mockCell.x && !mockCell.geometry?.x;
  }

  /** Normalize mock node data to hybrid format. */
  private normalizeMockNodeData(mockCell: any): Record<string, unknown> {
    if (!mockCell.data) {
      return {};
    }
    if (Array.isArray(mockCell.data)) {
      const metadataArray = mockCell.data.filter((item: any) => item.key && item.value);
      return { data: { _metadata: metadataArray } };
    }
    return { data: mockCell.data };
  }

  private static readonly NIL_UUID = '00000000-0000-0000-0000-000000000000';

  /**
   * Sanitize a cell received from the server to handle known data corruption.
   * The server may add spurious source/target with nil UUIDs to node cells
   * and return empty attrs. This method strips those artefacts so downstream
   * classification and conversion work correctly.
   */
  private sanitizeCellFromServer(cell: any): any {
    // If the cell has a node shape but carries source/target with nil UUIDs,
    // strip those edge-only properties so the cell is treated as a node.
    if (!isEdgeShape(cell.shape) && cell.source && cell.target) {
      const sourceCell = cell.source?.cell || cell.source;
      const targetCell = cell.target?.cell || cell.target;
      const sourceIsNil =
        sourceCell === AppDiagramService.NIL_UUID ||
        sourceCell === null ||
        sourceCell === undefined;
      const targetIsNil =
        targetCell === AppDiagramService.NIL_UUID ||
        targetCell === null ||
        targetCell === undefined;

      if (sourceIsNil && targetIsNil) {
        this.logger.warn('Stripping nil-UUID source/target from node cell (server data issue)', {
          cellId: cell.id,
          shape: cell.shape,
        });
        const { source: _s, target: _t, ...cleanedCell } = cell;
        return cleanedCell;
      }
    }
    return cell;
  }

  /**
   * Check whether a cell has non-nil source and target references,
   * indicating it is structurally an edge regardless of its shape value.
   */
  private hasNonNilSourceTarget(cell: any): boolean {
    if (!cell.source || !cell.target) return false;
    const sourceCell = cell.source?.cell || cell.source;
    const targetCell = cell.target?.cell || cell.target;
    return (
      typeof sourceCell === 'string' &&
      typeof targetCell === 'string' &&
      sourceCell !== AppDiagramService.NIL_UUID &&
      targetCell !== AppDiagramService.NIL_UUID &&
      sourceCell.length > 0 &&
      targetCell.length > 0
    );
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
      shape: CANONICAL_EDGE_SHAPE,
      source,
      target,
      zIndex: mockCell.zIndex || 1,
      connector: mockCell.connector || DFD_STYLING.EDGES.CONNECTOR,
      router: mockCell.router || DFD_STYLING.EDGES.ROUTER,
      attrs: {
        lines: {
          connection: true,
        },
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
    return NodeInfo.getDefaultLabel(nodeType);
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
}
