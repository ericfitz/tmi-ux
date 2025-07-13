import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '../../../core/services/logger.service';
import { CommandBusService } from '../application/services/command-bus.service';
import { DiagramCommandFactory } from '../domain/commands/diagram-commands';
import { NodeData } from '../domain/value-objects/node-data';
import { NodeType } from '../domain/value-objects/node-data';
import { Point } from '../domain/value-objects/point';
import { DiagramNode } from '../domain/value-objects/diagram-node';
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';
import { X6NodeSnapshot } from '../types/x6-cell.types';

/**
 * Service responsible for node creation and management in DFD diagrams
 */
@Injectable({
  providedIn: 'root',
})
export class DfdNodeManagerService {
  constructor(
    private logger: LoggerService,
    private commandBus: CommandBusService,
    private transloco: TranslocoService,
    private x6GraphAdapter: X6GraphAdapter,
  ) {}

  /**
   * Add a node at a predictable position
   */
  addGraphNode(
    shapeType: NodeType = 'actor',
    containerWidth: number,
    containerHeight: number,
    diagramId: string,
    isInitialized: boolean,
  ): Observable<void> {
    if (!isInitialized) {
      this.logger.warn('Cannot add node: Graph is not initialized');
      throw new Error('Graph is not initialized');
    }

    // Calculate a predictable position using a grid-based algorithm
    const position = this.calculateNextNodePosition(containerWidth, containerHeight);

    return this.createNode(shapeType, position, diagramId);
  }

  /**
   * Calculate the next predictable position for a new node using a grid-based algorithm
   * that ensures nodes are always placed in the viewable area
   */
  private calculateNextNodePosition(
    containerWidth: number,
    containerHeight: number,
  ): { x: number; y: number } {
    const nodeWidth = 120; // Default node width
    const nodeHeight = 80; // Default node height
    const padding = 50; // Padding from edges and between nodes
    const gridSpacingX = nodeWidth + padding;
    const gridSpacingY = nodeHeight + padding;
    const offsetIncrement = 25; // Offset increment for layered placement

    // Calculate available grid dimensions
    const availableWidth = containerWidth - 2 * padding;
    const availableHeight = containerHeight - 2 * padding;
    const maxColumns = Math.floor(availableWidth / gridSpacingX);
    const maxRows = Math.floor(availableHeight / gridSpacingY);
    const totalGridPositions = maxColumns * maxRows;

    // Get existing nodes to determine occupied positions
    const existingNodes = this.x6GraphAdapter.getNodes();

    // Calculate which layer we're on based on existing node count
    const currentLayer = Math.floor(existingNodes.length / totalGridPositions);
    const positionInLayer = existingNodes.length % totalGridPositions;

    // Calculate the offset for this layer to create a staggered effect
    const layerOffsetX = (currentLayer * offsetIncrement) % (gridSpacingX / 2);
    const layerOffsetY = (currentLayer * offsetIncrement) % (gridSpacingY / 2);

    // Calculate row and column for this position in the current layer
    const row = Math.floor(positionInLayer / maxColumns);
    const col = positionInLayer % maxColumns;

    // Calculate the actual position with layer offset
    const baseX = padding + col * gridSpacingX;
    const baseY = padding + row * gridSpacingY;
    const x = baseX + layerOffsetX;
    const y = baseY + layerOffsetY;

    // Ensure the position stays within the viewable area
    const clampedX = Math.min(Math.max(x, padding), containerWidth - nodeWidth - padding);
    const clampedY = Math.min(Math.max(y, padding), containerHeight - nodeHeight - padding);

    this.logger.info('Calculated predictable node position with layering', {
      layer: currentLayer,
      positionInLayer,
      gridPosition: { col, row },
      layerOffset: { x: layerOffsetX, y: layerOffsetY },
      calculatedPosition: { x, y },
      finalPosition: { x: clampedX, y: clampedY },
      totalGridPositions,
      existingNodeCount: existingNodes.length,
    });

    return { x: clampedX, y: clampedY };
  }

  /**
   * Create a node with the specified type and position
   */
  private createNode(
    shapeType: NodeType,
    position: { x: number; y: number },
    diagramId: string,
  ): Observable<void> {
    const userId = 'current-user'; // TODO: Get from auth service
    const nodeId = uuidv4(); // Generate UUID type 4 for UX-created nodes

    const nodeData = new NodeData(
      nodeId,
      shapeType, // shape
      shapeType, // type
      { x: position.x, y: position.y }, // position
      { width: 120, height: 80 }, // size
      { text: { text: this.getDefaultLabelForType(shapeType) } }, // attrs
      {}, // ports
      1, // zIndex
      true, // visible
      [], // metadata
    );

    const command = DiagramCommandFactory.addNode(
      diagramId,
      userId,
      nodeId,
      new Point(position.x, position.y),
      this.convertNodeDataToSnapshot(nodeData),
      true, // isLocalUserInitiated
    );

    return new Observable<void>(observer => {
      this.commandBus
        .execute<void>(command)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.logger.info('Node created successfully', { nodeId, shapeType });
            // Add the node to the visual graph
            const diagramNode = new DiagramNode(nodeData);
            this.x6GraphAdapter.addNode(diagramNode);
            observer.next();
            observer.complete();
          },
          error: error => {
            this.logger.error('Error creating node', error);
            observer.error(error);
          },
        });
    });
  }

  /**
   * Get default label for a shape type
   */
  private getDefaultLabelForType(shapeType: NodeType): string {
    switch (shapeType) {
      case 'actor':
        return this.transloco.translate('editor.nodeLabels.actor');
      case 'process':
        return this.transloco.translate('editor.nodeLabels.process');
      case 'store':
        return this.transloco.translate('editor.nodeLabels.store');
      case 'security-boundary':
        return this.transloco.translate('editor.nodeLabels.securityBoundary');
      case 'textbox':
        return this.transloco.translate('editor.nodeLabels.textbox');
      default:
        return this.transloco.translate('editor.nodeLabels.node');
    }
  }

  /**
   * Convert NodeData to X6NodeSnapshot
   */
  private convertNodeDataToSnapshot(nodeData: NodeData): X6NodeSnapshot {
    return {
      id: nodeData.id,
      shape: nodeData.type, // Use node type as shape
      position: { x: nodeData.position.x, y: nodeData.position.y },
      size: { width: nodeData.width, height: nodeData.height },
      attrs: {
        // Basic attrs structure for X6 nodes
        body: {
          fill: '#ffffff',
          stroke: '#333333',
          strokeWidth: 2,
        },
        text: {
          text: nodeData.label,
          fontSize: 14,
          fill: '#333333',
        },
      },
      ports: {
        // Default ports configuration
        groups: {
          top: { position: 'top' },
          right: { position: 'right' },
          bottom: { position: 'bottom' },
          left: { position: 'left' },
        },
        items: [],
      },
      zIndex: 1,
      visible: true,
      type: nodeData.type,
      metadata: nodeData.metadata,
    };
  }
}
