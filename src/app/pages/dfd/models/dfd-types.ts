// Used in type definitions
// import { PortManager } from '@antv/x6/lib/model/port';

/**
 * Type for port directions
 */
export type PortDirection = 'top' | 'right' | 'bottom' | 'left';

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
    [key: string]: unknown;
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
    label?: {
      text?: string;
      fill?: string;
      fontSize?: number;
      fontFamily?: string;
      textAnchor?: string;
      textVerticalAnchor?: string;
      pointerEvents?: string;
      refX?: string;
      refY?: string;
    };
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
