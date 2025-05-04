import { Graph, Node } from '@antv/x6';
import { PortManager } from '@antv/x6/lib/model/port';
import { PortDirection } from './dfd-types';

/**
 * Utility functions for port management
 */
export class PortUtils {
  /**
   * Get ports by direction
   * @param node The node to get ports from
   * @param direction The port direction ('top', 'right', 'bottom', 'left')
   * @returns Array of ports for the specified direction
   */
  static getPortsByDirection(node: Node, direction: PortDirection): PortManager.Port[] {
    const ports = node.getPortsByGroup(direction);
    return ports.map(port => ({
      ...port,
      id: port.id || `${direction}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      position: { name: direction },
    }));
  }

  /**
   * Get all ports from all directions
   * @param node The node to get ports from
   * @returns Array of all ports
   */
  static getAllPorts(node: Node): PortManager.Port[] {
    return [
      ...this.getPortsByDirection(node, 'top'),
      ...this.getPortsByDirection(node, 'right'),
      ...this.getPortsByDirection(node, 'bottom'),
      ...this.getPortsByDirection(node, 'left'),
    ];
  }

  /**
   * Update ports for all directions
   * @param node The node to update ports for
   * @param graph The X6 graph instance
   * @returns The node instance for chaining
   */
  static updatePorts(node: Node, _graph: Graph): Node {
    const directions: PortDirection[] = ['top', 'right', 'bottom', 'left'];
    const portsPerDirection = 1;

    let allPorts: PortManager.Port[] = [];

    directions.forEach(direction => {
      // Get existing ports or create initial ports if none exist
      const existingPorts = this.getPortsByDirection(node, direction);

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
    node.prop(['ports', 'items'], allPorts, {
      rewrite: true,
    });

    return node;
  }

  /**
   * Create default port groups configuration
   * @returns Port groups configuration
   */
  static createDefaultPortGroups(): Record<string, unknown> {
    return {
      groups: {
        top: {
          position: {
            name: 'top',
          },
          attrs: {
            portBody: {
              magnet: 'active',
              r: 5,
              stroke: '#5F95FF',
              fill: '#fff',
              strokeWidth: 1,
              visibility: 'hidden',
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
              fill: '#fff',
              stroke: '#5F95FF',
              strokeWidth: 1,
              visibility: 'hidden',
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
              fill: '#fff',
              stroke: '#5F95FF',
              strokeWidth: 1,
              visibility: 'hidden',
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
              stroke: '#5F95FF',
              fill: '#fff',
              strokeWidth: 1,
              visibility: 'hidden',
            },
          },
        },
      },
      items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
    };
  }

  /**
   * Create default port markup
   * @returns Port markup configuration
   */
  static createDefaultPortMarkup(): Array<{ tagName: string; selector: string }> {
    return [
      {
        tagName: 'circle',
        selector: 'portBody',
      },
    ];
  }
}
