import { Graph, Shape } from '@antv/x6';
import { PortManager } from '@antv/x6/lib/model/port';

/**
 * StoreShape class for DFD diagrams
 * Represents a data store in the diagram
 */
export class StoreShape extends Shape.Rect {
  /**
   * Get ports by direction
   * @param direction The port direction ('top', 'right', 'bottom', 'left')
   * @returns Array of ports for the specified direction
   */
  getPortsByDirection(direction: 'top' | 'right' | 'bottom' | 'left'): PortManager.Port[] {
    const ports = this.getPortsByGroup(direction);
    return ports.map(port => ({
      ...port,
      id: port.id || `${direction}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      position: { name: direction },
    })) as PortManager.Port[];
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
   * @param _graph The X6 graph instance
   * @returns The shape instance for chaining
   */
  updatePorts(_graph: Graph): StoreShape {
    const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
      'top',
      'right',
      'bottom',
      'left',
    ];
    const portsPerDirection = 1;

    let allPorts: PortManager.Port[] = [];

    directions.forEach(direction => {
      // Get existing ports or create initial ports if none exist
      const existingPorts = this.getPortsByDirection(direction);

      if (existingPorts.length === 0) {
        // Only create new ports if there are no existing ones
        // Create new ports inline
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

// Configure StoreShape
StoreShape.config({
  markup: [
    {
      tagName: 'rect',
      selector: 'body',
    },
    {
      tagName: 'path',
      selector: 'topLine',
    },
    {
      tagName: 'path',
      selector: 'bottomLine',
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
      stroke: 'transparent',
      opacity: 1,
    },
    topLine: {
      stroke: '#333333',
      strokeWidth: 2,
      refD: 'M 0 0 l 200 0',
    },
    bottomLine: {
      stroke: '#333333',
      strokeWidth: 2,
      refY: '100%', // Position at the bottom of the shape
      refD: 'M 0 0 l 200 0',
    },
    label: {
      text: 'Store',
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
