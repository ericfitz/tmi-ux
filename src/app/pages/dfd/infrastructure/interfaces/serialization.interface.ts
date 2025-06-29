import { AnyDiagramCommand } from '../../domain/commands/diagram-commands';
import { BaseDomainEvent } from '../../domain/events/domain-event';

/**
 * Serialized command data for persistence and transmission
 */
export interface SerializedCommand {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  version: string;
  metadata?: Record<string, unknown>;
}

/**
 * Serialized event data for persistence and transmission
 */
export interface SerializedEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  version: string;
  aggregateId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Serialized diagram state for persistence
 */
export interface SerializedDiagramState {
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  metadata: {
    version: string;
    timestamp: number;
    checksum?: string;
  };
}

/**
 * Interface for serialization service that handles conversion between
 * domain objects and serialized formats for persistence and collaboration.
 */
export interface ISerializationService {
  /**
   * Serialize a command for persistence or transmission
   */
  serializeCommand(command: AnyDiagramCommand): SerializedCommand;

  /**
   * Deserialize a command from stored or transmitted data
   */
  deserializeCommand(data: SerializedCommand): AnyDiagramCommand;

  /**
   * Serialize a domain event for persistence or transmission
   */
  serializeEvent(event: BaseDomainEvent): SerializedEvent;

  /**
   * Deserialize a domain event from stored or transmitted data
   */
  deserializeEvent(data: SerializedEvent): BaseDomainEvent;

  /**
   * Serialize diagram state for persistence
   */
  serializeDiagramState(
    nodes: Record<string, unknown>[],
    edges: Record<string, unknown>[],
  ): SerializedDiagramState;

  /**
   * Deserialize diagram state from stored data
   */
  deserializeDiagramState(data: SerializedDiagramState): {
    nodes: Record<string, unknown>[];
    edges: Record<string, unknown>[];
  };

  /**
   * Validate serialized data format and version compatibility
   */
  validateSerializedData(data: SerializedCommand | SerializedEvent): boolean;

  /**
   * Get the current serialization version
   */
  getCurrentVersion(): string;

  /**
   * Check if a version is compatible with current implementation
   */
  isVersionCompatible(version: string): boolean;

  /**
   * Migrate serialized data from older versions
   */
  migrateData(
    data: SerializedCommand | SerializedEvent,
    targetVersion: string,
  ): SerializedCommand | SerializedEvent;

  /**
   * Calculate checksum for data integrity verification
   */
  calculateChecksum(data: Record<string, unknown>): string;

  /**
   * Verify data integrity using checksum
   */
  verifyChecksum(data: Record<string, unknown>, checksum: string): boolean;
}
