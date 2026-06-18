/**
 * Infrastructure DFD Validation Service
 *
 * Provides DFD-specific validation logic for connections, magnets, and node shapes.
 * Also provides localized label resolution for edge creation.
 *
 * This service lives in the infrastructure layer so that InfraX6GraphAdapter can
 * use it without depending on application-layer services, avoiding circular
 * dependency chains.
 */

import { Injectable } from '@angular/core';
import { LoggerService } from '../../../../core/services/logger.service';
import { TranslocoService } from '@jsverse/transloco';
import { Node } from '@antv/x6';

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

@Injectable()
// SEM@6774bae2f845efae6c7636f13727d462e9fb9e6d: validate DFD node shapes, port magnets, and connection rules; resolve localized edge labels
export class InfraDfdValidationService {
  private readonly validNodeShapes = ['process', 'store', 'actor', 'security-boundary', 'text-box'];

  private readonly connectionRules: Record<string, string[]> = {
    process: ['store', 'actor', 'process'],
    store: ['process'],
    actor: ['process'],
  };

  // SEM@6774bae2f845efae6c7636f13727d462e9fb9e6d: inject logger and translation services (mutates shared state)
  constructor(
    private logger: LoggerService,
    private transloco: TranslocoService,
  ) {}

  /**
   * Check if a magnet (port) is valid for connection
   */
  // SEM@6774bae2f845efae6c7636f13727d462e9fb9e6d: validate that a port magnet element is active and connectable (pure)
  isMagnetValid(args: MagnetValidationArgs): boolean {
    const magnet = args.magnet;
    if (!magnet) {
      this.logger.debugComponent('DfdValidation', 'isMagnetValid: no magnet found');
      return false;
    }

    const magnetAttr = magnet.getAttribute('magnet');
    const isValid = magnetAttr === 'true' || magnetAttr === 'active';

    this.logger.debugComponent('DfdValidation', 'isMagnetValid result', {
      magnetAttribute: magnetAttr,
      portGroup: magnet.getAttribute('port-group'),
      isValid,
    });

    return isValid;
  }

  /**
   * Check if a connection can be made between two ports
   */
  // SEM@6774bae2f845efae6c7636f13727d462e9fb9e6d: validate that source and target ports are distinct and have port groups (pure)
  isConnectionValid(args: ConnectionValidationArgs): boolean {
    const { sourceView, targetView, sourceMagnet, targetMagnet } = args;

    if (sourceView === targetView && sourceMagnet === targetMagnet) {
      return false;
    }

    if (!targetMagnet || !sourceMagnet) {
      this.logger.debugComponent('DfdValidation', 'isConnectionValid: missing magnet', {
        hasSourceMagnet: !!sourceMagnet,
        hasTargetMagnet: !!targetMagnet,
      });
      return false;
    }

    const sourcePortGroup = sourceMagnet.getAttribute('port-group');
    const targetPortGroup = targetMagnet.getAttribute('port-group');

    if (!sourcePortGroup || !targetPortGroup) {
      this.logger.debugComponent('DfdValidation', 'isConnectionValid: missing port groups', {
        sourcePortGroup,
        targetPortGroup,
      });
      return false;
    }

    return true;
  }

  /**
   * Check if a connection can be made between two nodes based on DFD rules
   */
  // SEM@6774bae2f845efae6c7636f13727d462e9fb9e6d: validate a connection between two nodes against DFD shape rules (pure)
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
  // SEM@6774bae2f845efae6c7636f13727d462e9fb9e6d: validate a node shape type string against allowed DFD shapes; throws if invalid (pure)
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
  // SEM@6774bae2f845efae6c7636f13727d462e9fb9e6d: validate that an X6 node has a recognized DFD shape property; warns if unexpected (pure)
  validateX6NodeShape(x6Node: Node): void {
    const nodeShape = x6Node.shape;
    const nodeId = x6Node.id;

    if (!nodeShape || typeof nodeShape !== 'string') {
      const error = `[DFD] X6 node created without valid shape property. Node ID: ${nodeId}, shape: ${nodeShape}`;
      this.logger.error(error);
      throw new Error(error);
    }

    const expectedX6Shapes = ['process', 'store', 'actor', 'security-boundary', 'text-box'];
    if (!expectedX6Shapes.includes(nodeShape)) {
      this.logger.warn('X6 node created with unexpected shape', {
        nodeId,
        shape: nodeShape,
        expectedShapes: expectedX6Shapes,
      });
    }
  }

  /**
   * Check if two shapes can be connected according to DFD rules
   */
  // SEM@6774bae2f845efae6c7636f13727d462e9fb9e6d: check if two DFD shapes are allowed to connect by rule (pure)
  canShapesConnect(sourceShape: string, targetShape: string): boolean {
    const allowedTargets = this.connectionRules[sourceShape];
    return allowedTargets ? allowedTargets.includes(targetShape) : false;
  }

  /**
   * Get valid connection targets for a given source shape
   */
  // SEM@6774bae2f845efae6c7636f13727d462e9fb9e6d: list allowed target shape types for a given source DFD shape (pure)
  getValidConnectionTargets(sourceShape: string): string[] {
    return this.connectionRules[sourceShape] || [];
  }

  /**
   * Get all valid node shape types
   */
  // SEM@6774bae2f845efae6c7636f13727d462e9fb9e6d: list all recognized DFD node shape types (pure)
  getValidNodeShapes(): string[] {
    return [...this.validNodeShapes];
  }

  /**
   * Get localized flow label with fallback for when translations aren't loaded yet
   */
  // SEM@6774bae2f845efae6c7636f13727d462e9fb9e6d: fetch the localized edge flow label, falling back to 'Flow' if translation unavailable (pure)
  getLocalizedFlowLabel(): string {
    const translatedLabel = this.transloco.translate('editor.flowLabel');

    if (translatedLabel === 'editor.flowLabel') {
      this.logger.warn('Translation not available for editor.flowLabel, using fallback', {
        currentLanguage: this.transloco.getActiveLang(),
        returnedValue: translatedLabel,
      });
      return 'Flow';
    }

    return translatedLabel;
  }
}
