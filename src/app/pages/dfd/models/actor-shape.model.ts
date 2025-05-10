import { Graph, Shape } from '@antv/x6';
import { PortManager } from '@antv/x6/lib/model/port';
// BaseShape contains shared methods that are duplicated in ActorShape
// import { BaseShape } from './base-shape.model';
import { PortDirection } from './dfd-types';

/**
 * ActorShape class for DFD diagrams
 * Represents an actor in the diagram
 */
export class ActorShape extends Shape.Rect {
  /**
   * Get ports by direction
   * @param direction The port direction ('top', 'right', 'bottom', 'left')
   * @returns Array of ports for the specified direction
   */
  getPortsByDirection(direction: PortDirection): PortManager.Port[] {
    const ports = this.getPortsByGroup(direction);
    return ports.map(port => {
      return {
        ...port,
        id: port.id || `${direction}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        position: { name: direction },
        // Ensure label is defined to satisfy the type
        label: port.label || { position: { distance: 0.5 } },
      } as PortManager.Port;
    });
  }

  /**
   * Get all ports from all directions
   * @returns Array of all ports
   */
  getAllPorts(): PortManager.Port[] {
    return [
      ...this.getPortsByDirection('top'),
      ...this.getPortsByDirection('right'),
      ...this.getPortsByDirection('bottom'),
      ...this.getPortsByDirection('left'),
    ];
  }

  /**
   * Update ports for all directions
   * @param graph The X6 graph instance
   * @returns The shape instance for chaining
   */
  updatePorts(_graph: Graph): ActorShape {
    const directions: PortDirection[] = ['top', 'right', 'bottom', 'left'];
    const portsPerDirection = 1;

    let allPorts: PortManager.Port[] = [];

    directions.forEach(direction => {
      // Get existing ports or create initial ports if none exist
      const existingPorts = this.getPortsByDirection(direction);

      if (existingPorts.length === 0) {
        // Only create new ports if there are no existing ones
        const newPorts = Array.from({ length: portsPerDirection }, (_, index) => {
          return {
            id: `new-${direction}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 11)}`,
            group: direction,
            position: { name: direction },
          } as PortManager.Port;
        });
        allPorts = [...allPorts, ...newPorts];
      } else {
        // Keep existing ports
        allPorts = [...allPorts, ...existingPorts];
      }
    });

    // Update all ports at once
    this.prop(['ports', 'items'], allPorts, {
      rewrite: true,
    });

    return this;
  }
}

// Configure ActorShape
ActorShape.config({
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
    root: {
      magnet: false,
    },
    body: {
      fill: '#FFFFFF',
      stroke: '#333333',
      strokeWidth: 2,
      opacity: 1,
    },
    label: {
      text: 'Actor',
      fill: '#333333',
      fontSize: 12,
      fontFamily: '"Roboto Condensed", Arial, sans-serif',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      pointerEvents: 'none',
      refX: '50%',
      refY: '50%',
    },
  },
  ports: {
    items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
    groups: {
      top: {
        position: {
          name: 'top',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            stroke: '#5F95FF',
            fill: '#fff',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
            // Ensure port connects at its center
            'port-anchor': 'center',
          },
        },
      },
      right: {
        position: {
          name: 'right',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            fill: '#fff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
            // Ensure port connects at its center
            'port-anchor': 'center',
          },
        },
      },
      bottom: {
        position: {
          name: 'bottom',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            fill: '#fff',
            stroke: '#5F95FF',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
            // Ensure port connects at its center
            'port-anchor': 'center',
          },
        },
      },
      left: {
        position: {
          name: 'left',
        },
        attrs: {
          portBody: {
            magnet: 'active', // Change to 'active' to enable edge creation when dragging from port
            r: 5,
            stroke: '#5F95FF',
            fill: '#fff',
            strokeWidth: 1,
            visibility: 'hidden', // Hide ports by default
            // Ensure port connects at its center
            'port-anchor': 'center',
          },
        },
      },
    },
  },
  portMarkup: [
    {
      tagName: 'circle',
      selector: 'portBody',
    },
  ],
});
