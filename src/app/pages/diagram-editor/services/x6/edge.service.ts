import { Injectable } from '@angular/core';
import { Edge, Node } from '@antv/x6';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '../../../../core/services/logger.service';
import { X6GraphService } from './x6-graph.service';

@Injectable({
  providedIn: 'root',
})
export class EdgeService {
  constructor(
    private logger: LoggerService,
    private graphService: X6GraphService,
  ) {
    this.logger.info('EdgeService initialized');
  }

  /**
   * Create a flow edge between two nodes
   */
  createFlowEdge(source: Node | string, target: Node | string, label: string = ''): Edge | null {
    this.logger.debug(
      `Creating flow edge from ${typeof source === 'string' ? source : source.id} to ${typeof target === 'string' ? target : target.id}`,
    );

    return this.graphService.createEdge(source, target, {
      id: uuidv4(),
      attrs: {
        line: {
          stroke: '#5F95FF',
          strokeWidth: 1,
          targetMarker: {
            name: 'classic',
            size: 8,
          },
        },
      },
      labels: label ? [{ text: label }] : [],
      data: {
        type: 'flow',
        label,
      },
    });
  }

  /**
   * Create an association edge between two nodes (dashed line, no arrow)
   */
  createAssociationEdge(
    source: Node | string,
    target: Node | string,
    label: string = '',
  ): Edge | null {
    this.logger.debug(
      `Creating association edge from ${typeof source === 'string' ? source : source.id} to ${typeof target === 'string' ? target : target.id}`,
    );

    return this.graphService.createEdge(source, target, {
      id: uuidv4(),
      attrs: {
        line: {
          stroke: '#5F95FF',
          strokeWidth: 1,
          strokeDasharray: '5 5',
          targetMarker: null,
        },
      },
      labels: label ? [{ text: label }] : [],
      data: {
        type: 'association',
        label,
      },
    });
  }

  /**
   * Delete an edge
   */
  deleteEdge(edge: Edge | string): boolean {
    const graph = this.graphService.getGraph();
    if (!graph) return false;

    try {
      const edgeId = typeof edge === 'string' ? edge : edge.id;
      const edgeToRemove = graph.getCellById(edgeId);

      if (edgeToRemove) {
        edgeToRemove.remove();
        this.logger.debug(`Edge deleted: ${edgeId}`);
        return true;
      }

      this.logger.warn(`Edge not found: ${edgeId}`);
      return false;
    } catch (error) {
      this.logger.error('Error deleting edge', error);
      return false;
    }
  }
}
