# Diagram Editor Overview

## Architecture

The diagram editor is built using Angular and integrates with maxGraph (a TypeScript version of mxGraph) for diagram visualization and interaction. The architecture follows a clean separation of concerns with unidirectional data flow:

### Component Structure

- `DiagramEditorComponent`: The main component that orchestrates the diagram editor UI
- Specialized components for palette, canvas, properties panel, and state indicators
- Uses Angular Material for UI components

### Service Layer

- `DiagramService`: Manages diagram data and operations directly on cells
- `DiagramRendererService`: Facade for maxGraph integration
- Specialized services for graph initialization, event handling, vertex/edge management
- `MxGraphPatchingService`: Handles compatibility fixes for maxGraph

### Data Flow Architecture

- Unidirectional data flow with cells as the primary data structure
- Operations start by creating/modifying mxGraph cells
- After successful mxGraph operations, the diagram model is updated
- Direct cell references are used throughout the application
- Clean listener pattern to avoid circular dependencies

### State Management

- Operation-based architecture for tracking changes
- BehaviorSubjects for reactive state management
- State transitions managed by StateManagerService
- Support for undo/redo functionality (partially implemented)

## Key Features

### Diagram Editing

- Create vertices (process, store, actor) with different visual styles
- Create edges between vertices
- Drag-and-drop from palette to canvas
- Selection and property editing
- Delete elements
- Grid support

### User Experience

- Visual feedback for operations
- State indicators for loading, error states
- Keyboard shortcuts for common operations
- Tooltips and localization support

### Data Management

- Local storage for diagrams
- Operation-based change tracking
- Support for future server integration

## Implementation Status

The diagram editor has successfully implemented:

- Basic diagram rendering with maxGraph
- Vertex and edge creation
- Selection and deletion
- Drag-and-drop from palette
- Local storage persistence
- Theme support

In progress or planned features:

- Complete undo/redo implementation
- Collaborative editing features
- Server synchronization
- Enhanced UI features (minimap, contextual toolbars)
- Mobile and touch improvements

## Technical Challenges and Solutions

### Cell Management

- Direct cell references are used throughout the application
- Cells are the source of truth for both visual elements and business data
- The diagram model stores cells directly in the graphData array

### Deletion Flow Issues

- "Cell does not exist" warnings when accessing deleted cells
- Solution: Pre-delete information gathering and centralized cleanup

### Circular Dependencies

- Previous architecture had circular update patterns causing infinite recursion
- Solution: Unidirectional data flow and batched updates

### maxGraph Integration

- Compatibility issues with maxGraph API
- Solution: MxGraphPatchingService to handle compatibility fixes

## Future Plans

### Collaborative Editing

- WebSocket-based real-time communication
- Server as canonical state keeper
- Operation-based conflict resolution
- User presence indicators

### UI Improvements

- Better selection feedback
- Smart guides and snap-to-grid
- Contextual toolbars
- Enhanced label editing
- Multi-selection operations

### Performance Optimizations

- Virtualization for large diagrams
- Level-of-detail rendering
- WebGL rendering for very large diagrams

The diagram editor is built with a simplified architecture that uses direct cell references, avoiding previous complexity. This approach reduces circular dependencies and provides a clean foundation for future enhancements. The operation-based architecture will enable collaborative editing features in the future.
