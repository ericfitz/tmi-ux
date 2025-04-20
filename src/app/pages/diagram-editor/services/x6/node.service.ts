import { Injectable } from '@angular/core';
// Import the Graph for type information
import { Graph } from '@antv/x6';
// Use any for now to avoid ESLint errors
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
  createProcessNode(x: number, y: number, label: string = 'Process'): any {
    this.logger.debug(`Creating process node at (${x}, ${y}) with label: ${label}`);

    return this.graphService.createNode({
      shape: 'rect',
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
        label: {
          text: label,
          fill: '#333333',
          fontSize: 14,
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          refX: '50%',
          refY: '50%',
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
  createStoreNode(x: number, y: number, label: string = 'Store'): any {
    this.logger.debug(`Creating store node at (${x}, ${y}) with label: ${label}`);

    return this.graphService.createNode({
      shape: 'ellipse',
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
        label: {
          text: label,
          fill: '#333333',
          fontSize: 14,
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          refX: '50%',
          refY: '50%',
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
  createActorNode(x: number, y: number, label: string = 'Actor'): any {
    this.logger.debug(`Creating actor node at (${x}, ${y}) with label: ${label}`);

    return this.graphService.createNode({
      shape: 'circle',
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
        label: {
          text: label,
          fill: '#333333',
          fontSize: 14,
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          refX: '50%',
          refY: '50%',
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
   * Create a boundary node
   */
  createBoundaryNode(x: number, y: number, label: string = 'Boundary'): any {
    this.logger.debug(`Creating boundary node at (${x}, ${y}) with label: ${label}`);

    return this.graphService.createNode({
      shape: 'rect',
      x,
      y,
      width: 180,
      height: 120,
      attrs: {
        body: {
          fill: '#f8f8f8',
          stroke: '#aaaaaa',
          strokeWidth: 1,
          strokeDasharray: '5,5',
          rx: 10,
          ry: 10,
        },
        label: {
          text: label,
          fill: '#666666',
          fontSize: 14,
          textAnchor: 'middle',
          textVerticalAnchor: 'middle',
          refX: '50%',
          refY: '50%',
        },
      },
      id: uuidv4(),
      data: {
        type: 'boundary',
        label,
      },
      zIndex: -1, // Place below other shapes
    });
  }

  /**
   * Delete a node
   */
  deleteNode(node: any): boolean {
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
