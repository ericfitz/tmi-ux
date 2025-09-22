/**
 * Public API for DFD v2 architecture
 * This is the main entry point for the new unified DFD system
 */

// Core types and interfaces
export * from './types';
export * from './interfaces';

// Re-export domain value objects (unchanged from v1)
export * from '../domain/value-objects/node-info';
export * from '../domain/value-objects/edge-info';
export * from '../domain/value-objects/diagram-info';
