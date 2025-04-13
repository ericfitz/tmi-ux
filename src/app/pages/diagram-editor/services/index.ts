/**
 * Services barrel file
 * This file re-exports all services to make imports cleaner
 */

// Core services
export * from './diagram.service';
export * from './diagram-renderer.service';

// Event bus
export * from './event-bus/diagram-event-bus.service';

// Error handling
export * from './error-handling/diagram-error-handling.service';

// State management
export * from './state/state-manager.service';
export * from './state/editor-state.enum';

// Registry
export * from './registry/diagram-element-registry.service';

// Operations
export * from './operations/diagram-operations.service';

// Graph services
export * from './graph/graph-initialization.service';
export * from './graph/graph-utils.service';
export * from './graph/mx-graph-patching.service';
export * from './graph/graph-event-handling.service';

// Component services
export * from './components/vertex-management.service';
export * from './components/edge-management.service';
export * from './components/anchor-point.service';
export * from './components/diagram-component-mapper.service';

// Theming
export * from './theming/diagram-theme.service';

// Interfaces
export * from './interfaces/diagram-renderer.interface';

// Utils
export * from './utils/cell-delete-info.model';
export * from './utils/cell-reference-registry.service';
