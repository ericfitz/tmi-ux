import { Graph, Cell } from '@antv/x6';
import { PortManager } from '@antv/x6/lib/model/port';

/**
 * Type for port directions
 */
export type PortDirection = 'top' | 'right' | 'bottom' | 'left';

/**
 * Type for shape types
 */
export type ShapeType = 'actor' | 'process' | 'store' | 'securityBoundary';

/**
 * Type for port configuration
 */
export interface PortConfig {
  position: {
    name: PortDirection;
  };
  attrs: {
    portBody: {
      magnet: string;
      r: number;
      stroke: string;
      fill: string;
      strokeWidth: number;
      visibility: string;
    };
  };
}

/**
 * Type for port groups configuration
 */
export interface PortGroupsConfig {
  top: PortConfig;
  right: PortConfig;
  bottom: PortConfig;
  left: PortConfig;
}

/**
 * Type for shape configuration
 */
export interface ShapeConfig {
  markup: Array<{
    tagName: string;
    selector: string;
  }>;
  attrs: {
    root: {
      magnet: boolean;
    };
    body: {
      fill: string;
      stroke: string;
      strokeWidth: number;
      opacity?: number;
      strokeDasharray?: string;
      rx?: number;
      ry?: number;
    };
    [key: string]: unknown;
  };
  ports: {
    items: Array<{ group: string }>;
    groups: PortGroupsConfig;
  };
  portMarkup: Array<{
    tagName: string;
    selector: string;
  }>;
}

/**
 * Type for base shape methods
 */
export interface BaseShapeMethods {
  getPortsByDirection(direction: PortDirection): PortManager.Port[];
  getAllPorts(): PortManager.Port[];
  updatePorts(graph: Graph): Cell;
}
