import { Injectable } from '@angular/core';
import { LoggerService } from '../../../../core/services/logger.service';
import {
  AnyDiagramCommand,
  AddNodeCommand,
  RemoveNodeCommand,
  UpdateNodePositionCommand,
  UpdateNodeDataCommand,
  AddEdgeCommand,
  RemoveEdgeCommand,
  UpdateEdgeDataCommand,
  DiagramCommandFactory,
} from '../commands/diagram-commands';
import type { DiagramState } from '../history/history.types';
import type { NodeData } from '../value-objects/node-data';
import type { EdgeData } from '../value-objects/edge-data';

/**
 * Factory for creating inverse commands that can undo the effects of original commands.
 * Implements the inverse command pattern for reliable undo operations.
 */
@Injectable({
  providedIn: 'root',
})
export class InverseCommandFactory {
  constructor(private readonly _logger: LoggerService) {}

  /**
   * Creates an inverse command that can undo the effects of the original command.
   * @param command The original command to create an inverse for
   * @param beforeState The state before the command was executed
   * @returns The inverse command that can undo the original command
   */
  createInverse<T extends AnyDiagramCommand>(
    command: T,
    beforeState: DiagramState,
  ): AnyDiagramCommand {
    try {
      switch (command.type) {
        case 'ADD_NODE':
          return this._createRemoveNodeInverse(command, beforeState);
        case 'REMOVE_NODE':
          return this._createAddNodeInverse(command, beforeState);
        case 'UPDATE_NODE_POSITION':
          return this._createUpdatePositionInverse(command, beforeState);
        case 'UPDATE_NODE_DATA':
          return this._createUpdateNodeDataInverse(command, beforeState);
        case 'ADD_EDGE':
          return this._createRemoveEdgeInverse(command, beforeState);
        case 'REMOVE_EDGE':
          return this._createAddEdgeInverse(command, beforeState);
        case 'UPDATE_EDGE_DATA':
          return this._createUpdateEdgeDataInverse(command, beforeState);
        default:
          throw new Error(`Unsupported command type for inverse: ${command.type}`);
      }
    } catch (error) {
      this._logger.error('Failed to create inverse command', { command, error });
      throw error;
    }
  }

  /**
   * Checks if an inverse command can be created for the given command.
   * @param command The command to check
   * @returns True if an inverse can be created
   */
  canCreateInverse(command: AnyDiagramCommand): boolean {
    const supportedTypes = [
      'ADD_NODE',
      'REMOVE_NODE',
      'UPDATE_NODE_POSITION',
      'UPDATE_NODE_DATA',
      'ADD_EDGE',
      'REMOVE_EDGE',
      'UPDATE_EDGE_DATA',
    ];
    return supportedTypes.includes(command.type);
  }

  /**
   * Validates that an inverse command is correct for the original command.
   * @param command The original command
   * @param inverse The inverse command
   * @returns True if the inverse is valid
   */
  validateInverse(command: AnyDiagramCommand, inverse: AnyDiagramCommand): boolean {
    try {
      // Basic validation - inverse should have opposite effect
      const commandType = command.type;
      const inverseType = inverse.type;

      const validPairs = new Map([
        ['ADD_NODE', 'REMOVE_NODE'],
        ['REMOVE_NODE', 'ADD_NODE'],
        ['ADD_EDGE', 'REMOVE_EDGE'],
        ['REMOVE_EDGE', 'ADD_EDGE'],
        ['UPDATE_NODE_POSITION', 'UPDATE_NODE_POSITION'],
        ['UPDATE_NODE_DATA', 'UPDATE_NODE_DATA'],
        ['UPDATE_EDGE_DATA', 'UPDATE_EDGE_DATA'],
      ]);

      return validPairs.get(commandType) === inverseType;
    } catch (error) {
      this._logger.error('Failed to validate inverse command', { command, inverse, error });
      return false;
    }
  }

  private _createRemoveNodeInverse(
    command: AddNodeCommand,
    _beforeState: DiagramState,
  ): RemoveNodeCommand {
    // For AddNodeCommand, create RemoveNodeCommand
    return DiagramCommandFactory.removeNode(command.diagramId, command.userId, command.nodeId);
  }

  private _createAddNodeInverse(
    command: RemoveNodeCommand,
    beforeState: DiagramState,
  ): AddNodeCommand {
    // For RemoveNodeCommand, create AddNodeCommand
    const nodeToRestore = beforeState.nodes.find(node => node.id === command.nodeId);
    if (!nodeToRestore) {
      throw new Error(`Cannot create inverse: node ${command.nodeId} not found in before state`);
    }

    return DiagramCommandFactory.addNode(
      command.diagramId,
      command.userId,
      command.nodeId,
      nodeToRestore.position,
      nodeToRestore.data as NodeData,
    );
  }

  private _createUpdatePositionInverse(
    command: UpdateNodePositionCommand,
    _beforeState: DiagramState,
  ): UpdateNodePositionCommand {
    // For UpdateNodePositionCommand, create another UpdateNodePositionCommand with swapped positions
    return DiagramCommandFactory.updateNodePosition(
      command.diagramId,
      command.userId,
      command.nodeId,
      command.oldPosition, // Restore old position
      command.newPosition, // Current position becomes old
    );
  }

  private _createUpdateNodeDataInverse(
    command: UpdateNodeDataCommand,
    _beforeState: DiagramState,
  ): UpdateNodeDataCommand {
    // For UpdateNodeDataCommand, create another UpdateNodeDataCommand with old data
    return DiagramCommandFactory.updateNodeData(
      command.diagramId,
      command.userId,
      command.nodeId,
      command.oldData, // Restore old data
      command.newData, // Current data becomes old
    );
  }

  private _createRemoveEdgeInverse(
    command: AddEdgeCommand,
    _beforeState: DiagramState,
  ): RemoveEdgeCommand {
    // For AddEdgeCommand, create RemoveEdgeCommand
    return DiagramCommandFactory.removeEdge(command.diagramId, command.userId, command.edgeId);
  }

  private _createAddEdgeInverse(
    command: RemoveEdgeCommand,
    beforeState: DiagramState,
  ): AddEdgeCommand {
    // For RemoveEdgeCommand, create AddEdgeCommand
    const edgeToRestore = beforeState.edges.find(edge => edge.id === command.edgeId);
    if (!edgeToRestore) {
      throw new Error(`Cannot create inverse: edge ${command.edgeId} not found in before state`);
    }

    return DiagramCommandFactory.addEdge(
      command.diagramId,
      command.userId,
      command.edgeId,
      edgeToRestore.sourceNodeId,
      edgeToRestore.targetNodeId,
      edgeToRestore.data as EdgeData,
    );
  }

  private _createUpdateEdgeDataInverse(
    command: UpdateEdgeDataCommand,
    _beforeState: DiagramState,
  ): UpdateEdgeDataCommand {
    // For UpdateEdgeDataCommand, create another UpdateEdgeDataCommand with old data
    return DiagramCommandFactory.updateEdgeData(
      command.diagramId,
      command.userId,
      command.edgeId,
      command.oldData, // Restore old data
      command.newData, // Current data becomes old
    );
  }
}
