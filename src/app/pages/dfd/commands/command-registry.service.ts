import { Injectable } from '@angular/core';
import { CommandDeserializerService } from './command-deserializer.service';
import {
  AddNodeCommand,
  AddNodeParams,
  DeleteNodeCommand,
  DeletedNodeData,
  MoveNodeCommand,
} from './node-commands';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdShapeFactoryService } from '../services/dfd-shape-factory.service';

/**
 * Service for registering command deserializers
 */
@Injectable({
  providedIn: 'root',
})
export class CommandRegistryService {
  constructor(
    private deserializer: CommandDeserializerService,
    private logger: LoggerService,
    private shapeFactory: DfdShapeFactoryService,
  ) {
    this.registerDeserializers();
  }

  /**
   * Register all command deserializers
   */
  private registerDeserializers(): void {
    this.registerAddNodeDeserializer();
    this.registerDeleteNodeDeserializer();
    this.registerMoveNodeDeserializer();

    this.logger.debug('Command deserializers registered', {
      registeredTypes: this.deserializer.getRegisteredTypes(),
    });
  }

  /**
   * Register deserializer for AddNodeCommand
   */
  private registerAddNodeDeserializer(): void {
    this.deserializer.registerDeserializer('add-node', (data: Record<string, unknown>) => {
      const params = data as unknown as {
        type: AddNodeParams['type'];
        position: AddNodeParams['position'];
        size?: AddNodeParams['size'];
        label?: AddNodeParams['label'];
        zIndex?: AddNodeParams['zIndex'];
        parent?: AddNodeParams['parent'];
        createdNodeId?: string | null;
      };

      const command = new AddNodeCommand(
        {
          type: params.type,
          position: params.position,
          size: params.size,
          label: params.label,
          zIndex: params.zIndex,
          parent: params.parent,
        },
        this.logger,
        this.shapeFactory,
      );

      // Restore the createdNodeId if it exists
      if (params.createdNodeId) {
        // Use Object.defineProperty to set the private property
        Object.defineProperty(command, 'createdNodeId', {
          value: params.createdNodeId,
          writable: true,
        });
      }

      return command;
    });
  }

  /**
   * Register deserializer for DeleteNodeCommand
   */
  private registerDeleteNodeDeserializer(): void {
    this.deserializer.registerDeserializer('delete-node', (data: Record<string, unknown>) => {
      const params = data as unknown as {
        nodeId: string;
        deletedNodeData?: DeletedNodeData | null;
      };

      const command = new DeleteNodeCommand(params.nodeId, this.logger, this.shapeFactory);

      // Restore the deletedNodeData if it exists
      if (params.deletedNodeData) {
        // Use Object.defineProperty to set the private property
        Object.defineProperty(command, 'deletedNodeData', {
          value: params.deletedNodeData,
          writable: true,
        });
      }

      return command;
    });
  }

  /**
   * Register deserializer for MoveNodeCommand
   */
  private registerMoveNodeDeserializer(): void {
    this.deserializer.registerDeserializer('move-node', (data: Record<string, unknown>) => {
      const params = data as unknown as {
        nodeId: string;
        newPosition: { x: number; y: number };
        originalPosition?: { x: number; y: number } | null;
      };

      const command = new MoveNodeCommand(params.nodeId, params.newPosition, this.logger);

      // Restore the originalPosition if it exists
      if (params.originalPosition) {
        // Use Object.defineProperty to set the private property
        Object.defineProperty(command, 'originalPosition', {
          value: params.originalPosition,
          writable: true,
        });
      }

      return command;
    });
  }
}
