import { Injectable } from '@angular/core';
import { LoggerService } from '../../../../core/services/logger.service';
import {
  AnyDiagramCommand,
  AddNodeCommand,
  RemoveNodeCommand,
  UpdateNodePositionCommand,
  UpdateNodeSnapshotCommand,
  AddEdgeCommand,
  RemoveEdgeCommand,
  UpdateEdgeSnapshotCommand,
  CompositeCommand,
  DiagramCommandFactory,
} from '../commands/diagram-commands';
import type { DiagramState } from '../history/history.types';

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
        case 'UPDATE_NODE_SNAPSHOT':
          return this._createUpdateNodeSnapshotInverse(command, beforeState);
        case 'ADD_EDGE':
          return this._createRemoveEdgeInverse(command, beforeState);
        case 'REMOVE_EDGE':
          return this._createAddEdgeInverse(command, beforeState);
        case 'UPDATE_EDGE_SNAPSHOT':
          return this._createUpdateEdgeSnapshotInverse(command, beforeState);
        case 'COMPOSITE':
          return this._createCompositeInverse(command, beforeState);
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
      'UPDATE_NODE_SNAPSHOT',
      'ADD_EDGE',
      'REMOVE_EDGE',
      'UPDATE_EDGE_SNAPSHOT',
      'COMPOSITE',
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
        ['REMOVE_NODE', 'COMPOSITE'], // Node removal inverse is composite (node + edges)
        ['ADD_EDGE', 'REMOVE_EDGE'],
        ['REMOVE_EDGE', 'ADD_EDGE'],
        ['UPDATE_NODE_POSITION', 'UPDATE_NODE_POSITION'],
        ['UPDATE_NODE_SNAPSHOT', 'UPDATE_NODE_SNAPSHOT'],
        ['UPDATE_EDGE_SNAPSHOT', 'UPDATE_EDGE_SNAPSHOT'],
        ['COMPOSITE', 'COMPOSITE'],
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
  ): CompositeCommand {
    // For RemoveNodeCommand, create CompositeCommand that restores node + connected edges
    const nodeToRestore = beforeState.nodes.find(node => node.id === command.nodeId);
    if (!nodeToRestore) {
      throw new Error(`Cannot create inverse: node ${command.nodeId} not found in before state`);
    }

    // Find all edges that were connected to this node
    const connectedEdges = beforeState.edges.filter(
      edge => edge.sourceNodeId === command.nodeId || edge.targetNodeId === command.nodeId,
    );

    this._logger.info('DIAGNOSTIC: Creating composite inverse for node deletion', {
      nodeId: command.nodeId,
      connectedEdgeCount: connectedEdges.length,
      connectedEdgeIds: connectedEdges.map(edge => edge.id),
    });

    // Create commands to restore the node and all connected edges
    const restoreCommands: AnyDiagramCommand[] = [];

    // First, restore the node - use X6NodeSnapshot directly
    const nodeSnapshot = nodeToRestore.data;

    const addNodeCommand = DiagramCommandFactory.addNode(
      command.diagramId,
      command.userId,
      command.nodeId,
      nodeToRestore.position,
      nodeSnapshot,
    );
    restoreCommands.push(addNodeCommand);

    // Then, restore all connected edges
    for (const edge of connectedEdges) {
      // Use X6EdgeSnapshot directly
      const edgeSnapshot = edge.data;

      const addEdgeCommand = DiagramCommandFactory.addEdge(
        command.diagramId,
        command.userId,
        edge.id,
        edge.sourceNodeId,
        edge.targetNodeId,
        edgeSnapshot,
      );
      restoreCommands.push(addEdgeCommand);
    }

    // Create composite command
    return DiagramCommandFactory.createComposite(
      command.diagramId,
      command.userId,
      restoreCommands,
      `Restore node ${command.nodeId} and ${connectedEdges.length} connected edges`,
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

  private _createUpdateNodeSnapshotInverse(
    command: UpdateNodeSnapshotCommand,
    _beforeState: DiagramState,
  ): UpdateNodeSnapshotCommand {
    // For UpdateNodeSnapshotCommand, create another UpdateNodeSnapshotCommand with old snapshot
    return DiagramCommandFactory.updateNodeData(
      command.diagramId,
      command.userId,
      command.nodeId,
      command.oldSnapshot, // Restore old snapshot
      command.newSnapshot, // Current snapshot becomes old
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

    // Use X6EdgeSnapshot directly
    const edgeSnapshot = edgeToRestore.data;

    return DiagramCommandFactory.addEdge(
      command.diagramId,
      command.userId,
      command.edgeId,
      edgeToRestore.sourceNodeId,
      edgeToRestore.targetNodeId,
      edgeSnapshot,
    );
  }

  private _createUpdateEdgeSnapshotInverse(
    command: UpdateEdgeSnapshotCommand,
    _beforeState: DiagramState,
  ): UpdateEdgeSnapshotCommand {
    // For UpdateEdgeSnapshotCommand, create another UpdateEdgeSnapshotCommand with old snapshot
    return DiagramCommandFactory.updateEdgeData(
      command.diagramId,
      command.userId,
      command.edgeId,
      command.oldSnapshot, // Restore old snapshot
      command.newSnapshot, // Current snapshot becomes old
    );
  }

  private _createCompositeInverse(
    command: CompositeCommand,
    beforeState: DiagramState,
  ): CompositeCommand {
    // For CompositeCommand, create inverse commands for each sub-command in reverse order
    const inverseCommands: AnyDiagramCommand[] = [];

    // Process commands in reverse order for proper undo
    for (let i = command.commands.length - 1; i >= 0; i--) {
      const subCommand = command.commands[i];
      const inverseCommand = this.createInverse(subCommand, beforeState);
      inverseCommands.push(inverseCommand);
    }

    return DiagramCommandFactory.createComposite(
      command.diagramId,
      command.userId,
      inverseCommands,
      `Inverse of: ${command.description}`,
    );
  }
}
