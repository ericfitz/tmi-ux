import { Injectable } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { NodeData } from '../models/node-data.interface';
import { ActorShape } from '../models/actor-shape.model';
import { ProcessShape } from '../models/process-shape.model';
import { StoreShape } from '../models/store-shape.model';
import { SecurityBoundaryShape } from '../models/security-boundary-shape.model';
import { TextboxShape } from '../models/textbox-shape.model';
import { DfdLabelEditorService } from './dfd-label-editor.service';

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
      const nodeHeight = shapeType === 'process' ? 120 : 40;
      const randomX = Math.floor(Math.random() * (graphWidth - nodeWidth)) + nodeWidth / 2;
      const randomY = Math.floor(Math.random() * (graphHeight - nodeHeight)) + nodeHeight / 2;

      // Create the appropriate shape based on type
      let node;
      let defaultLabel = '';

      switch (shapeType) {
        case 'process':
          defaultLabel = 'Process';
          node = new ProcessShape().resize(80, 80).position(randomX, randomY).updatePorts(graph);
          break;
        case 'store':
          defaultLabel = 'Store';
          node = new StoreShape().resize(120, 40).position(randomX, randomY).updatePorts(graph);
          break;
        case 'securityBoundary':
          defaultLabel = 'Security Boundary';
          node = new SecurityBoundaryShape()
            .resize(180, 40)
            .position(randomX, randomY)
            .updatePorts(graph);
          node.setZIndex(-1);
          node.setData({ parent: true, label: defaultLabel } as NodeData);
          break;
        case 'textbox':
          defaultLabel = 'Text';
          node = new TextboxShape().resize(150, 60).position(randomX, randomY);
          // No ports to update for textbox
          // Set parent: false to prevent embedding
          node.setData({ parent: false, label: defaultLabel } as NodeData);
          // Update the HTML content with the default label
          node.updateHtml(defaultLabel);
          break;
        case 'actor':
        default:
          defaultLabel = 'Actor';
          node = new ActorShape().resize(120, 40).position(randomX, randomY).updatePorts(graph);
          break;
      }

      // Set the label text (except for textbox which uses updateHtml)
      if (shapeType !== 'textbox') {
        node.attr('label/text', defaultLabel);
      }

      // Store the label in node data (except for security boundary and textbox which are already set)
      // Set parent: true for all node types except textbox to allow embedding
      if (shapeType !== 'securityBoundary' && shapeType !== 'textbox') {
        node.setData({ parent: true, label: defaultLabel } as NodeData);
      }

      // Add the node to the graph
      graph.addNode(node);

      // Apply any saved label position
      if (shapeType !== 'textbox') {
        this.labelEditorService.applyLabelPosition(node);
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
    const securityBoundary = new SecurityBoundaryShape()
      .resize(250, 150)
      .position(500, 150)
      .updatePorts(graph);
    securityBoundary.setZIndex(-1);
    securityBoundary.attr('label/text', 'Security Boundary');
    securityBoundary.setData({ parent: true, label: 'Security Boundary' } as NodeData);
    graph.addNode(securityBoundary);

    // Add actor node
    const actor = new ActorShape().resize(120, 40).position(200, 50).updatePorts(graph);
    actor.attr('label/text', 'Actor');
    actor.setData({ parent: true, label: 'Actor' } as NodeData);
    graph.addNode(actor);

    // Add process node
    const process = new ProcessShape().resize(80, 80).position(400, 50).updatePorts(graph);
    process.attr('label/text', 'Process');
    process.setData({ parent: true, label: 'Process' } as NodeData);
    graph.addNode(process);

    // Add store node
    const store = new StoreShape().resize(120, 40).position(300, 250).updatePorts(graph);
    store.attr('label/text', 'Store');
    store.setData({ parent: true, label: 'Store' } as NodeData);
    graph.addNode(store);

    // Apply any saved label positions
    this.labelEditorService.applyLabelPosition(securityBoundary);
    this.labelEditorService.applyLabelPosition(actor);
    this.labelEditorService.applyLabelPosition(process);
    this.labelEditorService.applyLabelPosition(store);
  }

  /**
   * Checks if a node is a DFD shape
   * @param node The node to check
   * @returns True if the node is a DFD shape
   */
  isDfdNode(node: Node): boolean {
    return (
      node instanceof ActorShape ||
      node instanceof ProcessShape ||
      node instanceof StoreShape ||
      node instanceof SecurityBoundaryShape ||
      node instanceof TextboxShape
    );
  }
}
