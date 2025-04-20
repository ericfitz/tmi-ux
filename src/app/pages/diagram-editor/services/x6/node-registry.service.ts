import { Injectable, Injector } from '@angular/core';
import { Graph } from '@antv/x6';
import { register } from '@antv/x6-angular-shape';
import { LoggerService } from '../../../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
export class NodeRegistryService {
  private registered = false;

  constructor(
    private injector: Injector,
    private logger: LoggerService,
  ) {}

  /**
   * Register all node shapes
   */
  registerNodeShapes(): void {
    if (this.registered) {
      return;
    }

    try {
      // Register a boundary node shape (rounded rectangle with dashed edge and light grey background)
      Graph.registerNode('boundary-node', {
        width: 180,
        height: 120,
        markup: [
          {
            tagName: 'rect',
            selector: 'body',
          },
          {
            tagName: 'text',
            selector: 'label',
          },
        ],
        attrs: {
          body: {
            fill: '#f8f8f8', // Very light grey background
            stroke: '#aaaaaa', // Grey border
            strokeWidth: 1,
            strokeDasharray: '5,5', // Dashed edge
            rx: 10, // Rounded corners
            ry: 10,
            refWidth: '100%',
            refHeight: '100%',
          },
          label: {
            text: 'Boundary',
            fill: '#666666',
            fontSize: 14,
            textAnchor: 'middle',
            textVerticalAnchor: 'middle',
            refX: '50%',
            refY: '50%',
          },
        },
        zIndex: -1, // Place below other shapes
      });

      // Register a basic process node shape
      Graph.registerNode('process-node', {
        width: 120,
        height: 60,
        markup: [
          {
            tagName: 'rect',
            selector: 'body',
          },
          {
            tagName: 'text',
            selector: 'label',
          },
        ],
        attrs: {
          body: {
            fill: '#ffffff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            rx: 6,
            ry: 6,
            refWidth: '100%',
            refHeight: '100%',
          },
          label: {
            text: 'Process',
            fill: '#333333',
            fontSize: 14,
            textAnchor: 'middle',
            textVerticalAnchor: 'middle',
            refX: '50%',
            refY: '50%',
          },
        },
      });

      // Register a store node shape
      Graph.registerNode('store-node', {
        width: 120,
        height: 60,
        markup: [
          {
            tagName: 'ellipse',
            selector: 'top',
          },
          {
            tagName: 'rect',
            selector: 'body',
          },
          {
            tagName: 'ellipse',
            selector: 'bottom',
          },
          {
            tagName: 'text',
            selector: 'label',
          },
        ],
        attrs: {
          top: {
            refWidth: '100%',
            refHeight: '30%',
            refY: '0%',
            fillOpacity: 1,
            fill: '#ffffff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            refCx: '50%',
            refRx: '50%',
            refCy: '10%',
            refRy: '10%',
          },
          body: {
            refWidth: '100%',
            refHeight: '70%',
            refY: '15%',
            fill: '#ffffff',
            stroke: '#5F95FF',
            strokeWidth: 1,
          },
          bottom: {
            refWidth: '100%',
            refHeight: '30%',
            refY: '70%',
            fillOpacity: 1,
            fill: '#ffffff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            refCx: '50%',
            refRx: '50%',
            refCy: '90%',
            refRy: '10%',
          },
          label: {
            text: 'Store',
            fill: '#333333',
            fontSize: 14,
            textAnchor: 'middle',
            textVerticalAnchor: 'middle',
            refX: '50%',
            refY: '50%',
          },
        },
      });

      // Register an actor node shape
      Graph.registerNode('actor-node', {
        width: 80,
        height: 100,
        markup: [
          {
            tagName: 'circle',
            selector: 'head',
          },
          {
            tagName: 'rect',
            selector: 'body',
          },
          {
            tagName: 'text',
            selector: 'label',
          },
        ],
        attrs: {
          head: {
            r: 15,
            fill: '#ffffff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            refX: '50%',
            refY: '20%',
          },
          body: {
            refWidth: '50%',
            refHeight: '40%',
            refX: '25%',
            refY: '40%',
            fill: '#ffffff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            rx: 5,
            ry: 5,
          },
          label: {
            text: 'Actor',
            fill: '#333333',
            fontSize: 14,
            textAnchor: 'middle',
            textVerticalAnchor: 'middle',
            refX: '50%',
            refY: '85%',
          },
        },
      });

      this.registered = true;
      this.logger.info('Node shapes registered successfully');
    } catch (error) {
      this.logger.error('Error registering node shapes', error);
    }
  }

  /**
   * Check if node shapes are registered
   */
  areShapesRegistered(): boolean {
    return this.registered;
  }
}
