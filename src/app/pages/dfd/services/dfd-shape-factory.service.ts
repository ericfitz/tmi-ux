import { Injectable } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { ActorShape } from '../models/actor-shape.model';
import { ProcessShape } from '../models/process-shape.model';
import { StoreShape } from '../models/store-shape.model';
import { SecurityBoundaryShape } from '../models/security-boundary-shape.model';
import { TextboxShape } from '../models/textbox-shape.model';
import { NodeData } from '../models/node-data.interface';
import { ShapeType } from './dfd-node.service';

export interface ShapeOptions {
  width?: number;
  height?: number;
  x: number;
  y: number;
  label: string;
  parent?: boolean;
  zIndex?: number;
}

/**
 * Factory service for creating DFD shapes
 * Centralizes shape creation logic
 */
@Injectable({
  providedIn: 'root',
})
export class DfdShapeFactoryService {
  constructor(private logger: LoggerService) {}

  /**
   * Creates a shape of the specified type with the provided options
   * @param shapeType The type of shape to create
   * @param options Configuration options for the shape
   * @param graph Optional graph instance needed for port updates
   * @returns The created shape
   */
  createShape(shapeType: ShapeType, options: ShapeOptions, graph?: Graph): Node {
    this.logger.debug(`Creating ${String(shapeType)} shape`, options);

    let node: Node;
    const defaultWidth = this.getDefaultWidth(shapeType);
    const defaultHeight = this.getDefaultHeight(shapeType);
    const width = options.width || defaultWidth;
    const height = options.height || defaultHeight;
    const label = options.label || this.getDefaultLabel(shapeType);

    // Create the shape based on type
    switch (shapeType) {
      case 'actor':
        node = new ActorShape()
          .resize(width, height)
          .position(options.x, options.y);
        break;
      case 'process':
        node = new ProcessShape()
          .resize(width, height)
          .position(options.x, options.y);
        break;
      case 'store':
        node = new StoreShape()
          .resize(width, height)
          .position(options.x, options.y);
        break;
      case 'securityBoundary':
        node = new SecurityBoundaryShape()
          .resize(width, height)
          .position(options.x, options.y);
        if (options.zIndex !== undefined) {
          node.setZIndex(options.zIndex);
        } else {
          node.setZIndex(-1); // Default z-index for security boundaries
        }
        break;
      case 'textbox':
        node = new TextboxShape()
          .resize(width, height)
          .position(options.x, options.y);
        // TextboxShape uses HTML for content
        (node as TextboxShape).updateHtml(label);
        break;
      default:
        this.logger.error(`Unknown shape type: ${String(shapeType)}`);
        throw new Error(`Unknown shape type: ${String(shapeType)}`);
    }

    // Set node data
    const isParent = options.parent === undefined ? true : options.parent;
    
    // For textbox, parent should always be false to prevent embedding
    const parent = shapeType === 'textbox' ? false : isParent;
    
    node.setData({
      parent,
      label,
      type: shapeType // Store the original shape type
    } as NodeData);

    // Set label text (except for textbox which uses updateHtml)
    if (shapeType !== 'textbox') {
      node.attr('label/text', label);
    }

    // Update ports if graph is provided
    if (graph && shapeType !== 'textbox') {
      if (node instanceof ActorShape || 
          node instanceof ProcessShape || 
          node instanceof StoreShape || 
          node instanceof SecurityBoundaryShape) {
        node.updatePorts(graph);
      }
    }
    
    return node;
  }


  /**
   * Gets the default width for a shape type
   * @param shapeType The shape type
   * @returns The default width
   */
  getDefaultWidth(shapeType: ShapeType): number {
    switch (shapeType) {
      case 'actor':
        return 120;
      case 'process':
        return 80;
      case 'store':
        return 120;
      case 'securityBoundary':
        return 180;
      case 'textbox':
        return 150;
      default:
        return 120;
    }
  }

  /**
   * Gets the default height for a shape type
   * @param shapeType The shape type
   * @returns The default height
   */
  getDefaultHeight(shapeType: ShapeType): number {
    switch (shapeType) {
      case 'actor':
        return 40;
      case 'process':
        return 80;
      case 'store':
        return 40;
      case 'securityBoundary':
        return 40;
      case 'textbox':
        return 60;
      default:
        return 40;
    }
  }

  /**
   * Gets the default label for a shape type
   * @param shapeType The shape type
   * @returns The default label
   */
  getDefaultLabel(shapeType: ShapeType): string {
    switch (shapeType) {
      case 'actor':
        return 'Actor';
      case 'process':
        return 'Process';
      case 'store':
        return 'Store';
      case 'securityBoundary':
        return 'Security Boundary';
      case 'textbox':
        return 'Text';
      default:
        return 'Node';
    }
  }
}