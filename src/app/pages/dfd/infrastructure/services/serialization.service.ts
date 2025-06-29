import { Injectable } from '@angular/core';
import { AnyDiagramCommand, DiagramCommandFactory } from '../../domain/commands/diagram-commands';
import { BaseDomainEvent } from '../../domain/events/domain-event';
import {
  ISerializationService,
  SerializedCommand,
  SerializedEvent,
  SerializedDiagramState,
} from '../interfaces/serialization.interface';
import { Point } from '../../domain/value-objects/point';
import { NodeData } from '../../domain/value-objects/node-data';
import { EdgeData } from '../../domain/value-objects/edge-data';

/**
 * Service that handles serialization and deserialization of domain objects
 * for persistence and collaboration support.
 */
@Injectable({
  providedIn: 'root',
})
export class SerializationService implements ISerializationService {
  private readonly _currentVersion = '1.0.0';
  private readonly _compatibleVersions = ['1.0.0'];

  /**
   * Serialize a command for persistence or transmission
   */
  serializeCommand(command: AnyDiagramCommand): SerializedCommand {
    return {
      type: command.type,
      data: this._extractCommandData(command),
      timestamp: command.timestamp.getTime(),
      version: this._currentVersion,
      metadata: {
        diagramId: command.diagramId,
        userId: command.userId,
        commandId: command.commandId,
      },
    };
  }

  /**
   * Deserialize a command from stored or transmitted data
   */
  deserializeCommand(data: SerializedCommand): AnyDiagramCommand {
    if (!this.validateSerializedData(data)) {
      throw new Error('Invalid serialized command data');
    }

    if (!this.isVersionCompatible(data.version)) {
      throw new Error(`Incompatible command version: ${data.version}`);
    }

    return this._reconstructCommand(data);
  }

  /**
   * Serialize a domain event for persistence or transmission
   */
  serializeEvent(event: BaseDomainEvent): SerializedEvent {
    return {
      type: event.type,
      data: event.metadata || {},
      timestamp: event.timestamp,
      version: this._currentVersion,
      aggregateId: event.aggregateId,
      metadata: {
        eventId: event.id,
        aggregateVersion: event.aggregateVersion,
      },
    };
  }

  /**
   * Deserialize a domain event from stored or transmitted data
   */
  deserializeEvent(data: SerializedEvent): BaseDomainEvent {
    if (!this.validateSerializedData(data)) {
      throw new Error('Invalid serialized event data');
    }

    if (!this.isVersionCompatible(data.version)) {
      throw new Error(`Incompatible event version: ${data.version}`);
    }

    // Create a concrete implementation since BaseDomainEvent is abstract
    return new (class extends BaseDomainEvent {
      constructor() {
        super(
          data.type,
          data.aggregateId,
          ((data.metadata as Record<string, unknown>)?.['aggregateVersion'] as number) || 1,
          data.data,
        );
      }
    })();
  }

  /**
   * Serialize diagram state for persistence
   */
  serializeDiagramState(
    nodes: Record<string, unknown>[],
    edges: Record<string, unknown>[],
  ): SerializedDiagramState {
    const timestamp = Date.now();
    const stateData = { nodes, edges };

    return {
      nodes,
      edges,
      metadata: {
        version: this._currentVersion,
        timestamp,
        checksum: this.calculateChecksum(stateData),
      },
    };
  }

  /**
   * Deserialize diagram state from stored data
   */
  deserializeDiagramState(data: SerializedDiagramState): {
    nodes: Record<string, unknown>[];
    edges: Record<string, unknown>[];
  } {
    if (!data.metadata || !this.isVersionCompatible(data.metadata.version)) {
      throw new Error(`Incompatible diagram state version: ${data.metadata?.version}`);
    }

    // Verify data integrity if checksum is available
    if (data.metadata.checksum) {
      const stateData = { nodes: data.nodes, edges: data.edges };
      if (!this.verifyChecksum(stateData, data.metadata.checksum)) {
        throw new Error('Diagram state data integrity check failed');
      }
    }

    return {
      nodes: data.nodes,
      edges: data.edges,
    };
  }

  /**
   * Validate serialized data format and version compatibility
   */
  validateSerializedData(data: SerializedCommand | SerializedEvent): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check required fields
    if (!data.type || !data.data || !data.timestamp || !data.version) {
      return false;
    }

    // Check data types
    if (
      typeof data.type !== 'string' ||
      typeof data.data !== 'object' ||
      typeof data.timestamp !== 'number' ||
      typeof data.version !== 'string'
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get the current serialization version
   */
  getCurrentVersion(): string {
    return this._currentVersion;
  }

  /**
   * Check if a version is compatible with current implementation
   */
  isVersionCompatible(version: string): boolean {
    return this._compatibleVersions.includes(version);
  }

  /**
   * Migrate serialized data from older versions
   */
  migrateData(
    data: SerializedCommand | SerializedEvent,
    targetVersion: string,
  ): SerializedCommand | SerializedEvent {
    if (data.version === targetVersion) {
      return data;
    }

    // For now, we only support the current version
    // Future versions would implement migration logic here
    throw new Error(`Migration from version ${data.version} to ${targetVersion} not supported`);
  }

  /**
   * Calculate checksum for data integrity verification
   */
  calculateChecksum(data: Record<string, unknown>): string {
    // Simple checksum implementation using JSON string hash
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    let hash = 0;

    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Verify data integrity using checksum
   */
  verifyChecksum(data: Record<string, unknown>, checksum: string): boolean {
    const calculatedChecksum = this.calculateChecksum(data);
    return calculatedChecksum === checksum;
  }

  /**
   * Extract command-specific data for serialization
   */
  private _extractCommandData(command: AnyDiagramCommand): Record<string, unknown> {
    const baseData = {
      diagramId: command.diagramId,
      userId: command.userId,
      commandId: command.commandId,
    };

    switch (command.type) {
      case 'CREATE_DIAGRAM':
        return {
          ...baseData,
          name: command.name,
          description: command.description,
        };
      case 'ADD_NODE':
        return {
          ...baseData,
          nodeId: command.nodeId,
          position: command.position,
          data: command.data,
        };
      case 'UPDATE_NODE_POSITION':
        return {
          ...baseData,
          nodeId: command.nodeId,
          newPosition: command.newPosition,
          oldPosition: command.oldPosition,
        };
      case 'UPDATE_NODE_DATA':
        return {
          ...baseData,
          nodeId: command.nodeId,
          newData: command.newData,
          oldData: command.oldData,
        };
      case 'REMOVE_NODE':
        return {
          ...baseData,
          nodeId: command.nodeId,
        };
      case 'ADD_EDGE':
        return {
          ...baseData,
          edgeId: command.edgeId,
          sourceNodeId: command.sourceNodeId,
          targetNodeId: command.targetNodeId,
          data: command.data,
        };
      case 'UPDATE_EDGE_DATA':
        return {
          ...baseData,
          edgeId: command.edgeId,
          newData: command.newData,
          oldData: command.oldData,
        };
      case 'REMOVE_EDGE':
        return {
          ...baseData,
          edgeId: command.edgeId,
        };
      case 'UPDATE_DIAGRAM_METADATA':
        return {
          ...baseData,
          name: command.name,
          description: command.description,
        };
      default:
        return baseData;
    }
  }

  /**
   * Reconstruct a command from serialized data
   */
  private _reconstructCommand(data: SerializedCommand): AnyDiagramCommand {
    const metadata = data.metadata as Record<string, unknown>;
    const diagramId = metadata['diagramId'] as string;
    const userId = metadata['userId'] as string;
    const commandData = data.data;

    switch (data.type) {
      case 'CREATE_DIAGRAM':
        return DiagramCommandFactory.createDiagram(
          diagramId,
          userId,
          commandData['name'] as string,
          commandData['description'] as string | undefined,
        );
      case 'ADD_NODE':
        return DiagramCommandFactory.addNode(
          diagramId,
          userId,
          commandData['nodeId'] as string,
          commandData['position'] as Point,
          commandData['data'] as NodeData,
        );
      case 'UPDATE_NODE_POSITION':
        return DiagramCommandFactory.updateNodePosition(
          diagramId,
          userId,
          commandData['nodeId'] as string,
          commandData['newPosition'] as Point,
          commandData['oldPosition'] as Point,
        );
      case 'UPDATE_NODE_DATA':
        return DiagramCommandFactory.updateNodeData(
          diagramId,
          userId,
          commandData['nodeId'] as string,
          commandData['newData'] as NodeData,
          commandData['oldData'] as NodeData,
        );
      case 'REMOVE_NODE':
        return DiagramCommandFactory.removeNode(diagramId, userId, commandData['nodeId'] as string);
      case 'ADD_EDGE':
        return DiagramCommandFactory.addEdge(
          diagramId,
          userId,
          commandData['edgeId'] as string,
          commandData['sourceNodeId'] as string,
          commandData['targetNodeId'] as string,
          commandData['data'] as EdgeData,
        );
      case 'UPDATE_EDGE_DATA':
        return DiagramCommandFactory.updateEdgeData(
          diagramId,
          userId,
          commandData['edgeId'] as string,
          commandData['newData'] as EdgeData,
          commandData['oldData'] as EdgeData,
        );
      case 'REMOVE_EDGE':
        return DiagramCommandFactory.removeEdge(diagramId, userId, commandData['edgeId'] as string);
      case 'UPDATE_DIAGRAM_METADATA':
        return DiagramCommandFactory.updateDiagramMetadata(
          diagramId,
          userId,
          commandData['name'] as string | undefined,
          commandData['description'] as string | undefined,
        );
      default:
        throw new Error(`Unknown command type: ${data.type}`);
    }
  }
}
