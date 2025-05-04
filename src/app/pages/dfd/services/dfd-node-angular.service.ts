import { Injectable } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdAngularShapeService } from './dfd-angular-shape.service';

/**
 * Type for shape types
 */
export type ShapeType = 'actor' | 'process' | 'store' | 'securityBoundary';

/**
 * Service for managing nodes in the DFD component using Angular components
 */
@Injectable({
  providedIn: 'root',
})
export class DfdNodeAngularService {
  constructor(
    private logger: LoggerService,
    private angularShapeService: DfdAngularShapeService,
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

      // Calculate random position
      const nodeWidth = shapeType === 'securityBoundary' ? 180 : 120;
      const nodeHeight = shapeType === 'process' ? 80 : 40;
      const randomX = Math.floor(Math.random() * (graphWidth - nodeWidth)) + nodeWidth / 2;
      const randomY = Math.floor(Math.random() * (graphHeight - nodeHeight)) + nodeHeight / 2;

      // Get the appropriate shape name
      const shapeName = this.angularShapeService.getShapeName(shapeType);

      // Create default label based on shape type
      const defaultLabel = this.getDefaultLabel(shapeType);

      // Create node with Angular shape
      const node = graph.addNode({
        shape: shapeName,
        x: randomX,
        y: randomY,
        width: nodeWidth,
        height: nodeHeight,
        data: {
          ngArguments: {
            label: defaultLabel,
            embedded: false,
          },
          label: defaultLabel, // Keep this for compatibility with existing code
        },
      });

      // Add ports to the node
      this.addPortsToNode(node, graph);

      // Set z-index for security boundary
      if (shapeType === 'securityBoundary') {
        node.setZIndex(-1);
        node.setData({
          parent: true,
          label: defaultLabel,
          ngArguments: {
            label: defaultLabel,
            embedded: false,
            parent: true,
          },
        });
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

    // Add a security boundary
    const securityBoundary = graph.addNode({
      shape: this.angularShapeService.SECURITY_BOUNDARY_SHAPE,
      x: 300,
      y: 150,
      width: 250,
      height: 150,
      zIndex: -1,
      data: {
        parent: true,
        label: 'Security Boundary',
        ngArguments: {
          label: 'Security Boundary',
          embedded: false,
          parent: true,
        },
      },
    });
    this.addPortsToNode(securityBoundary, graph);

    // Add actor node
    const actor = graph.addNode({
      shape: this.angularShapeService.ACTOR_SHAPE,
      x: 200,
      y: 50,
      width: 120,
      height: 40,
      data: {
        label: 'Actor',
        ngArguments: {
          label: 'Actor',
          embedded: false,
        },
      },
    });
    this.addPortsToNode(actor, graph);

    // Add process node
    const process = graph.addNode({
      shape: this.angularShapeService.PROCESS_SHAPE,
      x: 400,
      y: 50,
      width: 80,
      height: 80,
      data: {
        label: 'Process',
        ngArguments: {
          label: 'Process',
          embedded: false,
        },
      },
    });
    this.addPortsToNode(process, graph);

    // Add store node
    const store = graph.addNode({
      shape: this.angularShapeService.STORE_SHAPE,
      x: 300,
      y: 250,
      width: 120,
      height: 40,
      data: {
        label: 'Store',
        ngArguments: {
          label: 'Store',
          embedded: false,
        },
      },
    });
    this.addPortsToNode(store, graph);
  }

  /**
   * Checks if a node is a DFD shape
   * @param node The node to check
   * @returns True if the node is a DFD shape
   */
  isDfdNode(node: Node): boolean {
    const shape = node.shape;
    return (
      shape === this.angularShapeService.ACTOR_SHAPE ||
      shape === this.angularShapeService.PROCESS_SHAPE ||
      shape === this.angularShapeService.STORE_SHAPE ||
      shape === this.angularShapeService.SECURITY_BOUNDARY_SHAPE
    );
  }

  /**
   * Adds ports to a node
   * @param node The node to add ports to
   * @param graph The X6 graph instance
   */
  private addPortsToNode(node: Node, _graph: Graph): void {
    const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
      'top',
      'right',
      'bottom',
      'left',
    ];

    directions.forEach(direction => {
      node.addPort({
        id: `${direction}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        group: direction,
        attrs: {
          portBody: {
            magnet: 'active',
            r: 5,
            stroke: '#5F95FF',
            fill: '#fff',
            strokeWidth: 1,
            visibility: 'hidden',
          },
        },
      });
    });
  }

  /**
   * Gets the default label for a shape type
   * @param shapeType The shape type
   * @returns The default label
   */
  private getDefaultLabel(shapeType: ShapeType): string {
    switch (shapeType) {
      case 'actor':
        return 'Actor';
      case 'process':
        return 'Process';
      case 'store':
        return 'Store';
      case 'securityBoundary':
        return 'Security Boundary';
      default:
        return 'Node';
    }
  }
}
