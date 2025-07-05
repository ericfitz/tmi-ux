import { Point } from '../value-objects/point';
import { X6NodeSnapshot, X6EdgeSnapshot } from '../../types/x6-cell.types';

/**
 * Base interface for all diagram commands
 */
export interface DiagramCommand {
  readonly type: string;
  readonly diagramId: string;
  readonly timestamp: Date;
  readonly userId: string;
  readonly commandId: string;
  readonly isLocalUserInitiated?: boolean;
}

/**
 * Command to create a new diagram
 */
export interface CreateDiagramCommand extends DiagramCommand {
  readonly type: 'CREATE_DIAGRAM';
  readonly name: string;
  readonly description?: string;
}

/**
 * Command to add a node to the diagram
 */
export interface AddNodeCommand extends DiagramCommand {
  readonly type: 'ADD_NODE';
  readonly nodeId: string;
  readonly position: Point;
  readonly nodeSnapshot: X6NodeSnapshot;
}

/**
 * Command to update a node's position
 */
export interface UpdateNodePositionCommand extends DiagramCommand {
  readonly type: 'UPDATE_NODE_POSITION';
  readonly nodeId: string;
  readonly newPosition: Point;
  readonly oldPosition: Point;
}

/**
 * Command to update a node's data
 */
export interface UpdateNodeSnapshotCommand extends DiagramCommand {
  readonly type: 'UPDATE_NODE_SNAPSHOT';
  readonly nodeId: string;
  readonly newSnapshot: X6NodeSnapshot;
  readonly oldSnapshot: X6NodeSnapshot;
}

/**
 * Command to remove a node from the diagram
 */
export interface RemoveNodeCommand extends DiagramCommand {
  readonly type: 'REMOVE_NODE';
  readonly nodeId: string;
}

/**
 * Command to add an edge to the diagram
 */
export interface AddEdgeCommand extends DiagramCommand {
  readonly type: 'ADD_EDGE';
  readonly edgeId: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly edgeSnapshot: X6EdgeSnapshot;
}

/**
 * Command to update an edge's data
 */
export interface UpdateEdgeSnapshotCommand extends DiagramCommand {
  readonly type: 'UPDATE_EDGE_SNAPSHOT';
  readonly edgeId: string;
  readonly newSnapshot: X6EdgeSnapshot;
  readonly oldSnapshot: X6EdgeSnapshot;
}

/**
 * Command to remove an edge from the diagram
 */
export interface RemoveEdgeCommand extends DiagramCommand {
  readonly type: 'REMOVE_EDGE';
  readonly edgeId: string;
}

/**
 * Command to update diagram metadata
 */
export interface UpdateDiagramMetadataCommand extends DiagramCommand {
  readonly type: 'UPDATE_DIAGRAM_METADATA';
  readonly name?: string;
  readonly description?: string;
}

/**
 * Command to restore embedding relationships between nodes
 */
export interface RestoreEmbeddingCommand extends DiagramCommand {
  readonly type: 'RESTORE_EMBEDDING';
  readonly embeddingRelationships: Array<{
    readonly parentId: string;
    readonly childId: string;
  }>;
}

/**
 * Composite command that executes multiple commands as a single atomic operation
 */
export interface CompositeCommand extends DiagramCommand {
  readonly type: 'COMPOSITE';
  readonly commands: AnyDiagramCommand[];
  readonly description: string;
}

/**
 * Union type of all diagram commands
 */
export type AnyDiagramCommand =
  | CreateDiagramCommand
  | AddNodeCommand
  | UpdateNodePositionCommand
  | UpdateNodeSnapshotCommand
  | RemoveNodeCommand
  | AddEdgeCommand
  | UpdateEdgeSnapshotCommand
  | RemoveEdgeCommand
  | UpdateDiagramMetadataCommand
  | RestoreEmbeddingCommand
  | CompositeCommand;

/**
 * Command factory for creating diagram commands with proper metadata
 */
export class DiagramCommandFactory {
  /**
   * Creates a command to create a new diagram
   */
  static createDiagram(
    diagramId: string,
    userId: string,
    name: string,
    description?: string,
    isLocalUserInitiated?: boolean,
  ): CreateDiagramCommand {
    return {
      type: 'CREATE_DIAGRAM',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      name,
      description,
      isLocalUserInitiated,
    };
  }

  /**
   * Creates a command to add a node
   */
  static addNode(
    diagramId: string,
    userId: string,
    nodeId: string,
    position: Point,
    nodeSnapshot: X6NodeSnapshot,
    isLocalUserInitiated?: boolean,
  ): AddNodeCommand {
    return {
      type: 'ADD_NODE',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      nodeId,
      position,
      nodeSnapshot,
      isLocalUserInitiated,
    };
  }

  /**
   * Creates a command to update node position
   */
  static updateNodePosition(
    diagramId: string,
    userId: string,
    nodeId: string,
    newPosition: Point,
    oldPosition: Point,
    isLocalUserInitiated?: boolean,
  ): UpdateNodePositionCommand {
    return {
      type: 'UPDATE_NODE_POSITION',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      nodeId,
      newPosition,
      oldPosition,
      isLocalUserInitiated,
    };
  }

  /**
   * Creates a command to update node data
   */
  static updateNodeData(
    diagramId: string,
    userId: string,
    nodeId: string,
    newSnapshot: X6NodeSnapshot,
    oldSnapshot: X6NodeSnapshot,
    isLocalUserInitiated?: boolean,
  ): UpdateNodeSnapshotCommand {
    return {
      type: 'UPDATE_NODE_SNAPSHOT',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      nodeId,
      newSnapshot,
      oldSnapshot,
      isLocalUserInitiated,
    };
  }

  /**
   * Creates a command to remove a node
   */
  static removeNode(
    diagramId: string,
    userId: string,
    nodeId: string,
    isLocalUserInitiated?: boolean,
  ): RemoveNodeCommand {
    return {
      type: 'REMOVE_NODE',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      nodeId,
      isLocalUserInitiated,
    };
  }

  /**
   * Creates a command to add an edge
   */
  static addEdge(
    diagramId: string,
    userId: string,
    edgeId: string,
    sourceNodeId: string,
    targetNodeId: string,
    edgeSnapshot: X6EdgeSnapshot,
    isLocalUserInitiated?: boolean,
  ): AddEdgeCommand {
    return {
      type: 'ADD_EDGE',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      edgeId,
      sourceNodeId,
      targetNodeId,
      edgeSnapshot,
      isLocalUserInitiated,
    };
  }

  /**
   * Creates a command to update edge data
   */
  static updateEdgeData(
    diagramId: string,
    userId: string,
    edgeId: string,
    newSnapshot: X6EdgeSnapshot,
    oldSnapshot: X6EdgeSnapshot,
    isLocalUserInitiated?: boolean,
  ): UpdateEdgeSnapshotCommand {
    return {
      type: 'UPDATE_EDGE_SNAPSHOT',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      edgeId,
      newSnapshot,
      oldSnapshot,
      isLocalUserInitiated,
    };
  }

  /**
   * Creates a command to remove an edge
   */
  static removeEdge(
    diagramId: string,
    userId: string,
    edgeId: string,
    isLocalUserInitiated?: boolean,
  ): RemoveEdgeCommand {
    return {
      type: 'REMOVE_EDGE',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      edgeId,
      isLocalUserInitiated,
    };
  }

  /**
   * Creates a command to update diagram metadata
   */
  static updateDiagramMetadata(
    diagramId: string,
    userId: string,
    name?: string,
    description?: string,
    isLocalUserInitiated?: boolean,
  ): UpdateDiagramMetadataCommand {
    return {
      type: 'UPDATE_DIAGRAM_METADATA',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      name,
      description,
      isLocalUserInitiated,
    };
  }

  /**
   * Creates a command to restore embedding relationships
   */
  static restoreEmbedding(
    diagramId: string,
    userId: string,
    embeddingRelationships: Array<{
      readonly parentId: string;
      readonly childId: string;
    }>,
    isLocalUserInitiated?: boolean,
  ): RestoreEmbeddingCommand {
    return {
      type: 'RESTORE_EMBEDDING',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      embeddingRelationships,
      isLocalUserInitiated,
    };
  }

  /**
   * Creates a composite command that executes multiple commands atomically
   */
  static createComposite(
    diagramId: string,
    userId: string,
    commands: AnyDiagramCommand[],
    description: string,
    isLocalUserInitiated?: boolean,
  ): CompositeCommand {
    return {
      type: 'COMPOSITE',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      isLocalUserInitiated: isLocalUserInitiated ?? true,
      commands,
      description,
    };
  }

  /**
   * Generates a unique command ID
   */
  private static generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Command validation utilities
 */
export class DiagramCommandValidator {
  /**
   * Validates a diagram command
   */
  static validate(command: AnyDiagramCommand): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!command.type) {
      errors.push('Command type is required');
    }
    if (!command.diagramId) {
      errors.push('Diagram ID is required');
    }
    if (!command.userId) {
      errors.push('User ID is required');
    }
    if (!command.commandId) {
      errors.push('Command ID is required');
    }
    if (!command.timestamp) {
      errors.push('Timestamp is required');
    }

    // Type-specific validation
    switch (command.type) {
      case 'CREATE_DIAGRAM':
        if (!command.name) {
          errors.push('Diagram name is required');
        }
        break;
      case 'ADD_NODE': {
        const addNodeCmd = command;
        if (!addNodeCmd.nodeId) {
          errors.push('Node ID is required');
        }
        if (!addNodeCmd.position) {
          errors.push('Node position is required');
        }
        if (!addNodeCmd.nodeSnapshot) {
          errors.push('Node snapshot is required');
        }
        break;
      }
      case 'UPDATE_NODE_POSITION': {
        const updatePosCmd = command;
        if (!updatePosCmd.nodeId) {
          errors.push('Node ID is required');
        }
        if (!updatePosCmd.newPosition) {
          errors.push('New position is required');
        }
        if (!updatePosCmd.oldPosition) {
          errors.push('Old position is required');
        }
        break;
      }
      case 'ADD_EDGE': {
        const addEdgeCmd = command;
        if (!addEdgeCmd.edgeId) {
          errors.push('Edge ID is required');
        }
        if (!addEdgeCmd.sourceNodeId) {
          errors.push('Source node ID is required');
        }
        if (!addEdgeCmd.targetNodeId) {
          errors.push('Target node ID is required');
        }
        if (!addEdgeCmd.edgeSnapshot) {
          errors.push('Edge snapshot is required');
        }
        break;
      }
      // Add more validation cases as needed
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
