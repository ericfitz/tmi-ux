import { Injectable } from '@angular/core';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdShapeFactoryService } from '../services/dfd-shape-factory.service';
import { ShapeType } from '../services/dfd-node.service';
import { AddNodeCommand, DeleteNodeCommand, MoveNodeCommand } from './node-commands';
import { AddEdgeCommand, DeleteEdgeCommand, UpdateEdgeVerticesCommand } from './edge-commands';
import { EditNodeLabelCommand, EditEdgeLabelCommand } from './label-commands';

/**
 * Factory service for creating commands
 * Simplifies the creation of commands and encapsulates command construction details
 */
@Injectable({
  providedIn: 'root',
})
export class CommandFactory {
  constructor(
    private logger: LoggerService,
    private shapeFactory: DfdShapeFactoryService,
  ) {
    this.logger.info('CommandFactory initialized');
  }

  /**
   * Create a command to add a node
   * @param params The node parameters
   * @returns AddNodeCommand instance
   */
  createAddNodeCommand(params: {
    type: ShapeType;
    position: { x: number; y: number };
    size?: { width: number; height: number };
    label?: string;
    zIndex?: number;
    parent?: boolean;
    containerElement?: HTMLElement;
  }): AddNodeCommand {
    return new AddNodeCommand(params, this.logger, this.shapeFactory);
  }

  /**
   * Create a command to delete a node
   * @param nodeId The ID of the node to delete
   * @returns DeleteNodeCommand instance
   */
  createDeleteNodeCommand(nodeId: string): DeleteNodeCommand {
    return new DeleteNodeCommand(nodeId, this.logger, this.shapeFactory);
  }

  /**
   * Create a command to move a node
   * @param nodeId The ID of the node to move
   * @param newPosition The new position for the node
   * @returns MoveNodeCommand instance
   */
  createMoveNodeCommand(nodeId: string, newPosition: { x: number; y: number }): MoveNodeCommand {
    return new MoveNodeCommand(nodeId, newPosition, this.logger);
  }

  /**
   * Create a command to edit a node's label
   * @param nodeId The ID of the node to edit
   * @param newLabel The new label for the node
   * @returns EditNodeLabelCommand instance
   */
  createEditNodeLabelCommand(nodeId: string, newLabel: string): EditNodeLabelCommand {
    return new EditNodeLabelCommand(nodeId, newLabel, this.logger);
  }

  /**
   * Create a command to add an edge
   * @param params The edge parameters
   * @returns AddEdgeCommand instance
   */
  createAddEdgeCommand(params: {
    source: { id: string; port?: string };
    target: { id: string; port?: string };
    vertices?: Array<{ x: number; y: number }>;
    attrs?: Record<string, unknown>;
    data?: Record<string, unknown>;
    router?: { name: string; args?: Record<string, unknown> };
    connector?: { name: string; args?: Record<string, unknown> };
  }): AddEdgeCommand {
    return new AddEdgeCommand(params, this.logger);
  }

  /**
   * Create a command to delete an edge
   * @param edgeId The ID of the edge to delete
   * @returns DeleteEdgeCommand instance
   */
  createDeleteEdgeCommand(edgeId: string): DeleteEdgeCommand {
    return new DeleteEdgeCommand(edgeId, this.logger);
  }

  /**
   * Create a command to update an edge's vertices (control points)
   * @param edgeId The ID of the edge to update
   * @param newVertices The new vertices for the edge
   * @returns UpdateEdgeVerticesCommand instance
   */
  createUpdateEdgeVerticesCommand(
    edgeId: string,
    newVertices: Array<{ x: number; y: number }>,
  ): UpdateEdgeVerticesCommand {
    return new UpdateEdgeVerticesCommand(edgeId, newVertices, this.logger);
  }

  /**
   * Create a command to edit an edge's label
   * @param edgeId The ID of the edge to edit
   * @param newLabel The new label for the edge
   * @returns EditEdgeLabelCommand instance
   */
  createEditEdgeLabelCommand(edgeId: string, newLabel: string): EditEdgeLabelCommand {
    return new EditEdgeLabelCommand(edgeId, newLabel, this.logger);
  }
}
