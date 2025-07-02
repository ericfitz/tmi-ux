import { Point } from '../value-objects/point';
import { NodeData } from '../value-objects/node-data';
import { EdgeData } from '../value-objects/edge-data';

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
  readonly data: NodeData;
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
export interface UpdateNodeDataCommand extends DiagramCommand {
  readonly type: 'UPDATE_NODE_DATA';
  readonly nodeId: string;
  readonly newData: NodeData;
  readonly oldData: NodeData;
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
  readonly data: EdgeData;
}

/**
 * Command to update an edge's data
 */
export interface UpdateEdgeDataCommand extends DiagramCommand {
  readonly type: 'UPDATE_EDGE_DATA';
  readonly edgeId: string;
  readonly newData: EdgeData;
  readonly oldData: EdgeData;
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
 * Union type of all diagram commands
 */
export type AnyDiagramCommand =
  | CreateDiagramCommand
  | AddNodeCommand
  | UpdateNodePositionCommand
  | UpdateNodeDataCommand
  | RemoveNodeCommand
  | AddEdgeCommand
  | UpdateEdgeDataCommand
  | RemoveEdgeCommand
  | UpdateDiagramMetadataCommand;

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
    data: NodeData,
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
      data,
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
    newData: NodeData,
    oldData: NodeData,
    isLocalUserInitiated?: boolean,
  ): UpdateNodeDataCommand {
    return {
      type: 'UPDATE_NODE_DATA',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      nodeId,
      newData,
      oldData,
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
    data: EdgeData,
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
      data,
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
    newData: EdgeData,
    oldData: EdgeData,
    isLocalUserInitiated?: boolean,
  ): UpdateEdgeDataCommand {
    return {
      type: 'UPDATE_EDGE_DATA',
      diagramId,
      userId,
      commandId: this.generateCommandId(),
      timestamp: new Date(),
      edgeId,
      newData,
      oldData,
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
        if (!addNodeCmd.data) {
          errors.push('Node data is required');
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
        if (!addEdgeCmd.data) {
          errors.push('Edge data is required');
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
