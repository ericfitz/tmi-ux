import { Graph, Shape, Node } from '@antv/x6';
import { PortManager } from '@antv/x6/lib/model/port';

/**
 * Type definition for ProcessShape to help with TypeScript
 */
export interface ProcessShapeType extends Node {
  getPortsByDirection(direction: 'top' | 'right' | 'bottom' | 'left'): PortManager.Port[];
  getAllPorts(): PortManager.Port[];
  updatePorts(graph: Graph): ProcessShapeType;
  setName(name: string): void;
  updateStyle(color: string, dash: string, strokeWidth: number): void;
}

/**
 * ProcessShape class for DFD diagrams
 * Represents a process in the diagram
 */
export const ProcessShape = Shape.Circle.define({
  constructorName: 'process',
  width: 80,
  height: 80,
  markup: [
    {
      tagName: 'circle',
      selector: 'body',
    },
    {
      tagName: 'text',
      selector: 'label',
    },
  ],
  portMarkup: [
    {
      tagName: 'circle',
      selector: 'portBody',
    },
  ],
  attrs: {
    root: {
      magnet: false,
    },
    body: {
      class: 'process-shape',
    },
    label: {
      text: 'Process',
      class: 'process-label',
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
            magnet: 'active',
            r: 5,
            class: 'port-body',
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
            magnet: 'active',
            r: 5,
            class: 'port-body',
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
            magnet: 'active',
            r: 5,
            class: 'port-body',
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
            magnet: 'active',
            r: 5,
            class: 'port-body',
            'port-anchor': 'center',
          },
        },
      },
    },
  },
});

/**
 * Get ports by direction
 * @param direction The port direction ('top', 'right', 'bottom', 'left')
 * @returns Array of ports for the specified direction
 */
(ProcessShape.prototype as ProcessShapeType).getPortsByDirection = function (
  direction: 'top' | 'right' | 'bottom' | 'left',
): PortManager.Port[] {
  const ports = this.getPortsByGroup(direction);
  return ports.map(port => ({
    ...port,
    id: port.id || `${direction}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    position: { name: direction },
    // Ensure label is defined to satisfy the type
    label: port.label || { position: { distance: 0.5 } },
  })) as PortManager.Port[];
};

/**
 * Get all ports from all directions
 * @returns Array of all ports
 */
(ProcessShape.prototype as ProcessShapeType).getAllPorts = function (): PortManager.Port[] {
  return [
    ...this.getPortsByDirection('top'),
    ...this.getPortsByDirection('right'),
    ...this.getPortsByDirection('bottom'),
    ...this.getPortsByDirection('left'),
  ];
};

/**
 * Update ports for all directions
 * @param graph The X6 graph instance
 * @returns The shape instance for chaining
 */
(ProcessShape.prototype as ProcessShapeType).updatePorts = function (
  _graph: Graph,
): ProcessShapeType {
  const directions: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left'];
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
};

/**
 * Set the name of the process
 * @param name The name to set
 */
(ProcessShape.prototype as ProcessShapeType).setName = function (name: string): void {
  this.attr('label/text', name);
};

/**
 * Update the style of the process
 * @param color The color to set
 * @param dash The dash pattern to set
 * @param strokeWidth The stroke width to set
 */
(ProcessShape.prototype as ProcessShapeType).updateStyle = function (
  color: string,
  dash: string,
  strokeWidth: number,
): void {
  this.attr('body/stroke', color);
  this.attr('body/strokeWidth', strokeWidth);
  this.attr('body/strokeDasharray', dash);
};
