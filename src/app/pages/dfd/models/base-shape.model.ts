import { Graph, Node } from '@antv/x6';
import { PortManager } from '@antv/x6/lib/model/port';
import { BaseShapeMethods, PortDirection } from './dfd-types';

/**
 * Abstract base class for all DFD shapes
 * Contains common methods for port management
 */
export abstract class BaseShape implements BaseShapeMethods {
  /**
   * Get ports by direction
   * @param direction The port direction ('top', 'right', 'bottom', 'left')
   * @returns Array of ports for the specified direction
   */
  getPortsByDirection(direction: PortDirection): PortManager.Port[] {
    const node = this as unknown as Node;
    const ports = node.getPortsByGroup(direction);
    return ports.map((port: PortManager.Port) => ({
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
   * @param graph The X6 graph instance
   * @returns The shape instance for chaining
   */
  updatePorts(graph: Graph): Node {
    const node = this as unknown as Node;
    const directions: PortDirection[] = ['top', 'right', 'bottom', 'left'];
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
    node.prop(['ports', 'items'], allPorts, {
      rewrite: true,
    });

    return node;
  }
}
