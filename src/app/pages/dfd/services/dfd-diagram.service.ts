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
    this.logger.info('Loading diagram data', { diagramId, threatModelId });

    if (!threatModelId) {
      this.logger.error('Threat model ID is required to load diagram data');
      return of({
        success: false,
        error: 'Threat model ID is required',
      });
    }

    // Load diagram data from the threat model service
    return this.threatModelService.getThreatModelById(threatModelId).pipe(
      map(threatModel => {
        if (!threatModel) {
          this.logger.warn('Threat model not found', { threatModelId });
          return {
            success: false,
            error: `Threat model with ID ${threatModelId} not found`,
          };
        }

        // Find the diagram within the threat model
        const diagram = threatModel.diagrams?.find(d => d.id === diagramId);
        if (!diagram) {
          this.logger.warn('Diagram not found in threat model', { diagramId, threatModelId });
          return {
            success: false,
            error: `Diagram with ID ${diagramId} not found in threat model`,
          };
        }

        const diagramData: DiagramData = {
          id: diagramId,
          name: diagram.name,
          threatModelId,
          cells: diagram.cells || [], // Include the actual diagram cells from threat model
        };
        
        this.logger.info('Successfully loaded diagram data from threat model', { 
          name: diagramData.name, 
          id: diagramId,
          threatModelId,
          cellCount: diagramData.cells?.length || 0
        });
        
        return {
          success: true,
          diagram: diagramData,
        };
      }),
      catchError(error => {
        this.logger.error('Error loading diagram data from threat model', error);
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
    return this.loadDiagram(diagramId, threatModelId).pipe(
      map(result => result.success),
    );
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
    nodeConfigurationService: any
  ): void {
    this.logger.info('Loading diagram cells in batch with history suppression', { 
      cellCount: cells.length,
      diagramId 
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
            error 
          });
        }
      });

      // Use history coordinator for atomic batch loading with history suppression
      this.historyCoordinator.executeAtomicOperation(
        graph,
        HISTORY_OPERATION_TYPES.DIAGRAM_LOAD,
        () => {
          // Clear existing graph first
          graph.clearCells();
          
          // Add nodes first, then edges (to ensure proper dependencies)
          nodes.forEach(nodeConfig => {
            try {
              // Convert X6 config to NodeInfo domain object
              const nodeInfo = this.convertX6ConfigToNodeInfo(nodeConfig);
              // Use infrastructure service instead of direct X6 call
              const node = this.nodeService.createNodeFromInfo(graph, nodeInfo, {
                ensureVisualRendering: true,
                updatePortVisibility: false, // Will be handled in batch after all nodes/edges
                suppressHistory: true // Already in atomic operation
              });
              // Apply zIndex after adding to ensure proper ordering
              if (nodeConfig.zIndex !== undefined) {
                node.setZIndex(nodeConfig.zIndex);
              }
            } catch (error) {
              this.logger.error('Error adding node during batch load', { 
                nodeId: nodeConfig.id, 
                error 
              });
            }
          });
          
          edges.forEach(edgeConfig => {
            try {
              // Convert X6 config to EdgeInfo domain object
              const edgeInfo = this.convertX6ConfigToEdgeInfo(edgeConfig);
              // Use infrastructure service instead of direct X6 call
              const edge = this.edgeService.createEdge(graph, edgeInfo, {
                ensureVisualRendering: true,
                updatePortVisibility: false // Will be handled in batch after all nodes/edges
              });
              // Apply zIndex after adding to ensure proper ordering
              if (edgeConfig.zIndex !== undefined) {
                edge.setZIndex(edgeConfig.zIndex);
              }
            } catch (error) {
              this.logger.error('Error adding edge during batch load', { 
                edgeId: edgeConfig.id, 
                sourceCell: edgeConfig.source?.cell,
                targetCell: edgeConfig.target?.cell,
                error 
              });
            }
          });
          
          this.logger.debug('Batch loaded cells into graph', {
            totalCells: convertedCells.length,
            nodes: nodes.length,
            edges: edges.length
          });
          
          return convertedCells;
        },
        {
          includeVisualEffects: false,
          includePortVisibility: false,
          includeHighlighting: false,
          includeToolChanges: false
        }
      );

      // Update port visibility after loading (as separate visual effect)
      this.historyCoordinator.executeVisualEffect(
        graph,
        'diagram-load-port-visibility',
        () => {
          // Hide unconnected ports on all nodes
          this.portStateManager.hideUnconnectedPorts(graph);
          this.logger.debug('Updated port visibility after diagram load');
        }
      );

      // Fit the graph to show all content
      graph.centerContent();
      
      this.logger.info('Successfully loaded diagram cells in batch');

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
    const label = mockCell.attrs?.text?.text || mockCell.value || mockCell.label || this.getDefaultLabelForType(nodeType);
    
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

    // Add metadata if present
    if (mockCell.data && Array.isArray(mockCell.data)) {
      const metadata: any = {};
      mockCell.data.forEach((item: any) => {
        if (item.key && item.value) {
          metadata[item.key] = item.value;
        }
      });
      cellConfig.data = { metadata };
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
        port: mockCell.sourcePortId || 'right' // Default to right port
      };
    }
    
    if (mockCell.target && typeof mockCell.target === 'object') {
      // New format: { cell: 'id', port?: 'portId' }
      target = mockCell.target;
    } else {
      // Legacy format: string IDs or separate properties
      target = {
        cell: mockCell.target || mockCell.targetNodeId,
        port: mockCell.targetPortId || 'left' // Default to left port
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
            size: 8
          }
        }
      }
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
      edgeConfig.labels = [{
        attrs: {
          text: {
            text: mockCell.value
          }
        }
      }];
    }
    
    // Add metadata if present
    if (mockCell.data && Array.isArray(mockCell.data)) {
      const metadata: any = {};
      mockCell.data.forEach((item: any) => {
        if (item.key && item.value) {
          metadata[item.key] = item.value;
        }
      });
      edgeConfig.data = { metadata };
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
    // Extract metadata from data field
    const metadata = nodeConfig.data?.metadata || {};
    
    return NodeInfo.create({
      id: nodeConfig.id,
      type: this.mapShapeToNodeType(nodeConfig.shape),
      position: { x: nodeConfig.x, y: nodeConfig.y },
      width: nodeConfig.width,
      height: nodeConfig.height,
      label: nodeConfig.label || '',
      metadata
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

    // Extract metadata from data field
    const metadata = edgeConfig.data?.metadata || {};

    return EdgeInfo.create({
      id: edgeConfig.id,
      sourceNodeId: edgeConfig.source.cell,
      targetNodeId: edgeConfig.target.cell,
      sourcePortId: edgeConfig.source.port,
      targetPortId: edgeConfig.target.port,
      label,
      vertices: edgeConfig.vertices || [],
      metadata
    });
  }

  /**
   * Map X6 shape name back to NodeType for domain object creation
   */
  private mapShapeToNodeType(shape: string): NodeType {
    switch (shape) {
      case 'rect':
        return 'actor'; // Default for rect shapes
      case 'ellipse':
        return 'process';
      case 'store':
        return 'store';
      case 'security-boundary':
        return 'security-boundary';
      case 'text-box':
        return 'text-box';
      default:
        return 'actor'; // Fallback
    }
  }
}