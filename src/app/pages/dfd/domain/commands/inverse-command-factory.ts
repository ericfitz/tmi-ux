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
  RestoreEmbeddingCommand,
  DiagramCommandFactory,
} from '../commands/diagram-commands';
import type { DiagramState, EmbeddingRelationship } from '../history/history.types';

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
        case 'RESTORE_EMBEDDING':
          return this._createRestoreEmbeddingInverse(command, beforeState);
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
      'RESTORE_EMBEDDING',
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
        ['REMOVE_NODE', 'COMPOSITE'], // Node removal inverse is composite (node + edges + embedding)
        ['ADD_EDGE', 'REMOVE_EDGE'],
        ['REMOVE_EDGE', 'ADD_EDGE'],
        ['UPDATE_NODE_POSITION', 'UPDATE_NODE_POSITION'],
        ['UPDATE_NODE_SNAPSHOT', 'UPDATE_NODE_SNAPSHOT'],
        ['UPDATE_EDGE_SNAPSHOT', 'UPDATE_EDGE_SNAPSHOT'],
        ['RESTORE_EMBEDDING', 'RESTORE_EMBEDDING'],
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
    // For RemoveNodeCommand, create CompositeCommand that restores node + connected edges + embedding relationships
    const nodeToRestore = beforeState.nodes.find(node => node.id === command.nodeId);
    if (!nodeToRestore) {
      throw new Error(`Cannot create inverse: node ${command.nodeId} not found in before state`);
    }

    // Find all edges that were connected to this node
    const connectedEdges = beforeState.edges.filter(
      edge => edge.sourceNodeId === command.nodeId || edge.targetNodeId === command.nodeId,
    );

    // CRITICAL FIX: Find all embedding relationships involving this node
    const embeddingRelationships = beforeState.embeddingRelationships.filter(
      rel => rel.parentId === command.nodeId || rel.childId === command.nodeId,
    );

    // Find all nodes that were embedded in the deleted node (children that need to be restored)
    const embeddedChildNodes = embeddingRelationships
      .filter(rel => rel.parentId === command.nodeId)
      .map(rel => beforeState.nodes.find(node => node.id === rel.childId))
      .filter(node => node !== undefined);

    // Find all edges connected to embedded children
    const embeddedChildEdges = embeddedChildNodes.flatMap(childNode =>
      beforeState.edges.filter(
        edge => edge.sourceNodeId === childNode.id || edge.targetNodeId === childNode.id,
      ),
    );

    // Remove duplicates from connected edges (in case embedded child edges are already included)
    const allEdgesToRestore = Array.from(
      new Map([...connectedEdges, ...embeddedChildEdges].map(edge => [edge.id, edge])).values(),
    );

    this._logger.info(
      'FIXED: Creating composite inverse for node deletion with embedding support',
      {
        nodeId: command.nodeId,
        connectedEdgeCount: connectedEdges.length,
        embeddingRelationshipCount: embeddingRelationships.length,
        embeddedChildCount: embeddedChildNodes.length,
        totalEdgesToRestore: allEdgesToRestore.length,
        embeddingRelationships: embeddingRelationships.map(
          rel => `${rel.parentId} -> ${rel.childId}`,
        ),
      },
    );

    // Create commands to restore everything in the correct order
    const restoreCommands: AnyDiagramCommand[] = [];

    // Step 1: Restore the main node
    const nodeSnapshot = this._convertX6SnapshotToDomainSnapshot(nodeToRestore.data);
    const addNodeCommand = DiagramCommandFactory.addNode(
      command.diagramId,
      command.userId,
      command.nodeId,
      nodeToRestore.position,
      nodeSnapshot,
    );
    restoreCommands.push(addNodeCommand);

    // Step 2: Restore all embedded child nodes
    for (const childNode of embeddedChildNodes) {
      const childSnapshot = this._convertX6SnapshotToDomainSnapshot(childNode.data);
      const addChildCommand = DiagramCommandFactory.addNode(
        command.diagramId,
        command.userId,
        childNode.id,
        childNode.position,
        childSnapshot,
      );
      restoreCommands.push(addChildCommand);
    }

    // Step 3: Restore all connected edges (including edges to embedded children)
    for (const edge of allEdgesToRestore) {
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

    // Step 4: CRITICAL FIX - Add a special command to restore embedding relationships
    // This needs to happen after all nodes are restored
    if (embeddingRelationships.length > 0) {
      const restoreEmbeddingCommand = this._createRestoreEmbeddingCommand(
        command.diagramId,
        command.userId,
        embeddingRelationships,
      );
      restoreCommands.push(restoreEmbeddingCommand);
    }

    // Create composite command
    return DiagramCommandFactory.createComposite(
      command.diagramId,
      command.userId,
      restoreCommands,
      `Restore node ${command.nodeId}, ${embeddedChildNodes.length} embedded children, ${allEdgesToRestore.length} edges, and ${embeddingRelationships.length} embedding relationships`,
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

  /**
   * Convert X6NodeSnapshot to domain-compatible snapshot by mapping X6 shape types to domain NodeTypes
   */
  private _convertX6SnapshotToDomainSnapshot(x6Snapshot: any): any {
    // Create a copy of the snapshot to avoid mutating the original
    const domainSnapshot = { ...x6Snapshot };

    // Map X6 shape types back to domain NodeTypes
    const shapeToNodeTypeMap: Record<string, string> = {
      rect: this._getNodeTypeFromMetadata(x6Snapshot) || 'actor', // Default to actor for rect shapes
      ellipse: 'process',
      'store-shape': 'store',
    };

    // If the snapshot has a shape, map it to the correct domain type
    if (domainSnapshot.shape && shapeToNodeTypeMap[domainSnapshot.shape]) {
      domainSnapshot.type = shapeToNodeTypeMap[domainSnapshot.shape];
    }

    // If we have metadata, extract the actual node type from there (most reliable)
    const actualNodeType = this._getNodeTypeFromMetadata(x6Snapshot);
    if (actualNodeType) {
      domainSnapshot.type = actualNodeType;
    }

    this._logger.debug('Converted X6 snapshot to domain snapshot', {
      originalShape: x6Snapshot.shape,
      originalType: x6Snapshot.type,
      convertedType: domainSnapshot.type,
      hasMetadata: !!x6Snapshot.metadata,
    });

    return domainSnapshot;
  }

  /**
   * Extract the actual node type from X6 snapshot metadata
   */
  private _getNodeTypeFromMetadata(x6Snapshot: any): string | null {
    if (!x6Snapshot.metadata || !Array.isArray(x6Snapshot.metadata)) {
      return null;
    }

    const typeMetadata = x6Snapshot.metadata.find((m: any) => m.key === 'type');
    return typeMetadata?.value || null;
  }

  /**
   * Creates an inverse for RestoreEmbeddingCommand (which is a no-op since embedding restoration is idempotent)
   */
  private _createRestoreEmbeddingInverse(
    command: RestoreEmbeddingCommand,
    _beforeState: DiagramState,
  ): RestoreEmbeddingCommand {
    // For RestoreEmbeddingCommand, the inverse is typically a no-op or the same command
    // since embedding restoration is part of a larger composite operation
    // In practice, this should rarely be called directly as RestoreEmbedding commands
    // are usually part of composite commands that handle their own inverses
    return DiagramCommandFactory.restoreEmbedding(
      command.diagramId,
      command.userId,
      [], // Empty relationships to effectively "undo" the embedding restoration
      false,
    );
  }

  /**
   * Creates a command to restore embedding relationships
   */
  private _createRestoreEmbeddingCommand(
    diagramId: string,
    userId: string,
    embeddingRelationships: EmbeddingRelationship[],
  ): RestoreEmbeddingCommand {
    return DiagramCommandFactory.restoreEmbedding(
      diagramId,
      userId,
      embeddingRelationships,
      false, // Not user-initiated, this is part of undo/redo
    );
  }
}
