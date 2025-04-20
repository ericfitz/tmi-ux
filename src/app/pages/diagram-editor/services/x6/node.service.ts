import { Injectable } from '@angular/core';
import { Node } from '@antv/x6';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '../../../../core/services/logger.service';
import { X6GraphService } from './x6-graph.service';

@Injectable({
  providedIn: 'root',
})
export class NodeService {
  constructor(
    private logger: LoggerService,
    private graphService: X6GraphService,
  ) {
    this.logger.info('NodeService initialized');
  }

  /**
   * Create a process node
   */
  createProcessNode(x: number, y: number, label: string = 'Process'): Node | null {
    this.logger.debug(`Creating process node at (${x}, ${y}) with label: ${label}`);

    return this.graphService.createNode({
      shape: 'process-node',
      x,
      y,
      width: 120,
      height: 60,
      attrs: {
        body: {
          fill: '#ffffff',
          stroke: '#5F95FF',
          strokeWidth: 1,
          rx: 6,
          ry: 6,
        },
      },
      id: uuidv4(),
      data: {
        type: 'process',
        label,
      },
    });
  }

  /**
   * Create a store node (cylinder)
   */
  createStoreNode(x: number, y: number, label: string = 'Store'): Node | null {
    this.logger.debug(`Creating store node at (${x}, ${y}) with label: ${label}`);

    return this.graphService.createNode({
      shape: 'store-node',
      x,
      y,
      width: 120,
      height: 60,
      attrs: {
        body: {
          fill: '#ffffff',
          stroke: '#5F95FF',
          strokeWidth: 1,
        },
      },
      id: uuidv4(),
      data: {
        type: 'store',
        label,
      },
    });
  }

  /**
   * Create an actor node
   */
  createActorNode(x: number, y: number, label: string = 'Actor'): Node | null {
    this.logger.debug(`Creating actor node at (${x}, ${y}) with label: ${label}`);

    return this.graphService.createNode({
      shape: 'actor-node',
      x,
      y,
      width: 80,
      height: 100,
      attrs: {
        body: {
          fill: '#ffffff',
          stroke: '#5F95FF',
          strokeWidth: 1,
        },
      },
      id: uuidv4(),
      data: {
        type: 'actor',
        label,
      },
    });
  }

  /**
   * Delete a node
   */
  deleteNode(node: Node | string): boolean {
    const graph = this.graphService.getGraph();
    if (!graph) return false;

    try {
      const nodeId = typeof node === 'string' ? node : node.id;
      const nodeToRemove = graph.getCellById(nodeId);

      if (nodeToRemove) {
        nodeToRemove.remove();
        this.logger.debug(`Node deleted: ${nodeId}`);
        return true;
      }

      this.logger.warn(`Node not found: ${nodeId}`);
      return false;
    } catch (error) {
      this.logger.error('Error deleting node', error);
      return false;
    }
  }
}
