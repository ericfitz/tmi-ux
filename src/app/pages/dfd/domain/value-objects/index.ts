/**
 * Barrel export for DFD domain value objects
 * This file provides a centralized export for all domain value objects
 */

// Value objects
export { NodeInfo } from './node-info';
export { EdgeInfo } from './edge-info';
export { DiagramInfo } from './diagram-info';
export { DiagramNode } from './diagram-node';
export { DiagramEdge } from './diagram-edge';
export type { EdgeAttrs } from './edge-attrs';
export type { NodeAttrs } from './node-attrs';
export type { EdgeLabel } from './edge-label';
export type { EdgeTerminal } from './edge-terminal';
export { Point } from './point';
export type { Metadata } from './metadata';
export type { PortConfiguration } from './port-configuration';

// Type definitions
export * from './x6-types';
