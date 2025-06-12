import { Injectable } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdLabelEditorService } from './dfd-label-editor.service';
import { DfdShapeFactoryService, ShapeOptions } from './dfd-shape-factory.service';

/**
 * Type for shape types
 */
export type ShapeType = 'actor' | 'process' | 'store' | 'securityBoundary' | 'textbox';

/**
 * Service for managing nodes in the DFD component
 */
@Injectable({
  providedIn: 'root',
})
export class DfdNodeService {
  constructor(
    private logger: LoggerService,
    private labelEditorService: DfdLabelEditorService,
    private shapeFactory: DfdShapeFactoryService,
  ) {}

  /**
   * Creates a node at a random position
   * @param graph The X6 graph instance
   * @param shapeType The type of shape to create
   * @param containerElement The container element
   * @returns The created node
   */
  createRandomNode(
    graph: Graph,
    shapeType: ShapeType = 'actor',
    containerElement: HTMLElement,
  ): Node | null {
    this.logger.info(`createRandomNode called with shapeType: ${shapeType}`);

    if (!graph) {
      this.logger.warn('Cannot add node: Graph is not initialized');
      return null;
    }

    try {
      // Get graph dimensions from the container
      const graphWidth = containerElement.clientWidth;
      const graphHeight = containerElement.clientHeight;

      // Get default dimensions for this shape type
      const defaultWidth = this.shapeFactory.getDefaultWidth(shapeType);
      const defaultHeight = this.shapeFactory.getDefaultHeight(shapeType);

      // Calculate random position
      const randomX = Math.floor(Math.random() * (graphWidth - defaultWidth)) + defaultWidth / 2;
      const randomY = Math.floor(Math.random() * (graphHeight - defaultHeight)) + defaultHeight / 2;

      // Define options for the shape
      const options: ShapeOptions = {
        x: randomX,
        y: randomY,
        label: this.shapeFactory.getDefaultLabel(shapeType),
        width: defaultWidth,
        height: defaultHeight,
        // For security boundary, set zIndex to -1
        ...(shapeType === 'securityBoundary' ? { zIndex: -1 } : {}),
        // For textbox, set parent to false to prevent embedding
        parent: shapeType !== 'textbox',
      };

      // Create the node using the factory
      const node = this.shapeFactory.createShape(shapeType, options, graph);

      // Add the node to the graph
      graph.addNode(node);

      // Apply any saved label position and create bounding box
      if (shapeType !== 'textbox') {
        this.labelEditorService.applyLabelPosition(node, graph);
      }

      return node;
    } catch (error) {
      this.logger.error('Error adding node:', error);
      return null;
    }
  }

  /**
   * Creates initial nodes for the graph
   * @param graph The X6 graph instance
   */
  createInitialNodes(graph: Graph): void {
    if (!graph) return;

    // Use batch operation to avoid history entries for initial setup
    graph.batchUpdate(
      () => {
        // Create a security boundary
        const securityBoundary = this.shapeFactory.createShape(
          'securityBoundary',
          {
            x: 500,
            y: 150,
            width: 250,
            height: 150,
            label: 'Security Boundary',
            zIndex: -1,
            parent: true,
          },
          graph,
        );
        graph.addNode(securityBoundary);

        // Create actor node
        const actor = this.shapeFactory.createShape(
          'actor',
          {
            x: 200,
            y: 50,
            width: 120,
            height: 40,
            label: 'Actor',
            parent: true,
          },
          graph,
        );
        graph.addNode(actor);

        // Create process node
        const process = this.shapeFactory.createShape(
          'process',
          {
            x: 400,
            y: 50,
            width: 80,
            height: 80,
            label: 'Process',
            parent: true,
          },
          graph,
        );
        graph.addNode(process);

        // Create store node
        const store = this.shapeFactory.createShape(
          'store',
          {
            x: 300,
            y: 250,
            width: 120,
            height: 40,
            label: 'Store',
            parent: true,
          },
          graph,
        );
        graph.addNode(store);

        // Apply any saved label positions and create bounding boxes
        this.labelEditorService.applyLabelPosition(securityBoundary, graph);
        this.labelEditorService.applyLabelPosition(actor, graph);
        this.labelEditorService.applyLabelPosition(process, graph);
        this.labelEditorService.applyLabelPosition(store, graph);
      },
      { historyDisabled: true },
    ); // Disable history for this batch operation

    // Log completion of initial setup
    this.logger.info('Initial nodes created without history entries');
  }

  /**
   * Checks if a node is a DFD shape
   * @param node The node to check
   * @returns True if the node is a DFD shape
   */
  isDfdNode(node: Node): boolean {
    // Check constructor name first
    const constructorName = node.constructor.name;
    if (
      constructorName === 'ActorShape' ||
      constructorName === 'ProcessShape' ||
      constructorName === 'StoreShape' ||
      constructorName === 'SecurityBoundaryShape' ||
      constructorName === 'TextboxShape'
    ) {
      return true;
    }

    // If not a direct instance (eg. for restored nodes from history),
    // check if node has DFD data attributes
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const nodeData = node.getData();
      if (nodeData && typeof nodeData === 'object') {
        // Check if the node has a type property that matches a DFD shape type
        if ('type' in nodeData) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const typeValue = String(nodeData['type']);
          if (
            typeValue === 'actor' ||
            typeValue === 'process' ||
            typeValue === 'store' ||
            typeValue === 'securityBoundary' ||
            typeValue === 'textbox'
          ) {
            return true;
          }
        }

        // Also check if the node has a label property (all DFD nodes should have this)
        if ('label' in nodeData) {
          return true;
        }
      }

      // Check for data-type attribute (new approach) or data-shape-type attribute (legacy)
      const dataType = node.attr('data-type');
      const shapeType = node.attr('data-shape-type');
      if (
        (typeof dataType === 'string' && dataType.length > 0) ||
        (typeof shapeType === 'string' && shapeType.length > 0)
      ) {
        return true;
      }
    } catch (error) {
      this.logger.debug('Error checking node data in isDfdNode', { nodeId: node.id, error });
    }

    return false;
  }
}
