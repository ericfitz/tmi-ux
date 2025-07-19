import { Injectable } from '@angular/core';
import { Node } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Interface for connection validation arguments from X6
 */
export interface ConnectionValidationArgs {
  sourceView: any;
  targetView: any;
  sourceMagnet: Element;
  targetMagnet: Element;
}

/**
 * Interface for magnet validation arguments from X6
 */
export interface MagnetValidationArgs {
  magnet: Element;
}

/**
 * Service for validating DFD connections and node shapes
 * Centralizes all business rules for DFD diagram validation
 */
@Injectable()
export class DfdConnectionValidationService {
  /**
   * Valid DFD node shape types
   */
  private readonly validNodeShapes = ['process', 'store', 'actor', 'security-boundary', 'text-box'];

  /**
   * DFD connection rules - which shapes can connect to which other shapes
   */
  private readonly connectionRules: Record<string, string[]> = {
    'dfd-process': ['dfd-datastore', 'dfd-external-entity', 'dfd-process'],
    'dfd-datastore': ['dfd-process'],
    'dfd-external-entity': ['dfd-process'],
  };

  constructor(private logger: LoggerService) {}

  /**
   * Check if a magnet (port) is valid for connection
   */
  isMagnetValid(args: MagnetValidationArgs): boolean {
    const magnet = args.magnet;
    if (!magnet) {
      this.logger.debugComponent('DFD', '[Edge Creation] isMagnetValid: no magnet found');
      return false;
    }

    // Check for magnet="true" or magnet="active" to match port configuration
    const magnetAttr = magnet.getAttribute('magnet');
    const isValid = magnetAttr === 'true' || magnetAttr === 'active';

    this.logger.debugComponent('DFD', '[Edge Creation] isMagnetValid result', {
      magnetAttribute: magnetAttr,
      portGroup: magnet.getAttribute('port-group'),
      isValid,
    });

    return isValid;
  }

  /**
   * Check if a connection can be made between two ports
   */
  isConnectionValid(args: ConnectionValidationArgs): boolean {
    const { sourceView, targetView, sourceMagnet, targetMagnet } = args;

    // Prevent creating an edge if source and target are the same port on the same node
    if (sourceView === targetView && sourceMagnet === targetMagnet) {
      this.logger.debugComponent('DFD', '[Edge Creation] Connection rejected: same port on same node');
      return false;
    }

    if (!targetMagnet || !sourceMagnet) {
      this.logger.debugComponent('DFD', '[Edge Creation] isConnectionValid: missing magnet', {
        hasSourceMagnet: !!sourceMagnet,
        hasTargetMagnet: !!targetMagnet,
      });
      return false;
    }

    // Check if ports have valid port groups
    const sourcePortGroup = sourceMagnet.getAttribute('port-group');
    const targetPortGroup = targetMagnet.getAttribute('port-group');

    if (!sourcePortGroup || !targetPortGroup) {
      this.logger.debugComponent('DFD', '[Edge Creation] isConnectionValid: missing port groups', {
        sourcePortGroup,
        targetPortGroup,
      });
      return false;
    }

    this.logger.debugComponent('DFD', '[Edge Creation] Connection validation passed');
    return true;
  }

  /**
   * Check if a connection can be made between two nodes based on DFD rules
   */
  isNodeConnectionValid(sourceNode: Node, targetNode: Node): boolean {
    const sourceShape = sourceNode.shape;
    const targetShape = targetNode.shape;

    const allowedTargets = this.connectionRules[sourceShape];
    if (!allowedTargets) {
      this.logger.warn('Unknown source shape type for connection validation', { sourceShape });
      return false;
    }

    const isValid = allowedTargets.includes(targetShape);
    if (!isValid) {
      this.logger.info('Connection not allowed by DFD rules', {
        sourceShape,
        targetShape,
        allowedTargets,
      });
    }

    return isValid;
  }

  /**
   * Validate node shape type
   */
  validateNodeShape(nodeType: string, nodeId: string): void {
    if (!nodeType || typeof nodeType !== 'string') {
      const error = `[DFD] Invalid node shape: shape property must be a non-empty string. Node ID: ${nodeId}, shape: ${nodeType}`;
      this.logger.error(error);
      throw new Error(error);
    }

    if (!this.validNodeShapes.includes(nodeType)) {
      const error = `[DFD] Invalid node shape: '${nodeType}' is not a recognized shape type. Valid shapes: ${this.validNodeShapes.join(', ')}. Node ID: ${nodeId}`;
      this.logger.error(error);
      throw new Error(error);
    }
  }

  /**
   * Validate that an X6 node was created with the correct shape property
   */
  validateX6NodeShape(x6Node: Node): void {
    const nodeShape = x6Node.shape;
    const nodeId = x6Node.id;

    if (!nodeShape || typeof nodeShape !== 'string') {
      const error = `[DFD] X6 node created without valid shape property. Node ID: ${nodeId}, shape: ${nodeShape}`;
      this.logger.error(error);
      throw new Error(error);
    }

    // Validate the shape matches expected X6 shape names
    const expectedX6Shapes = ['dfd-process', 'dfd-datastore', 'dfd-external-entity', 'security-boundary', 'text-box'];
    if (!expectedX6Shapes.includes(nodeShape)) {
      this.logger.warn('X6 node created with unexpected shape', {
        nodeId,
        shape: nodeShape,
        expectedShapes: expectedX6Shapes,
      });
    }
  }

  /**
   * Get valid connection targets for a given source shape
   */
  getValidConnectionTargets(sourceShape: string): string[] {
    return this.connectionRules[sourceShape] || [];
  }

  /**
   * Get all valid node shape types
   */
  getValidNodeShapes(): string[] {
    return [...this.validNodeShapes];
  }

  /**
   * Check if two shapes can be connected according to DFD rules
   */
  canShapesConnect(sourceShape: string, targetShape: string): boolean {
    const allowedTargets = this.connectionRules[sourceShape];
    return allowedTargets ? allowedTargets.includes(targetShape) : false;
  }
}