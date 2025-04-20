# Diagram Editor Overview

## Architecture

The diagram editor is built using Angular and integrates with AntV/X6 for diagram visualization and interaction. The architecture follows a clean separation of concerns with unidirectional data flow:

### Component Structure

- `DiagramEditorComponent`: The main component that orchestrates the diagram editor UI
- Specialized components for palette, canvas, properties panel, and state indicators
- Uses Angular Material for UI components
- Angular components for node types (process, store, actor) using `@antv/x6-angular-shape`

### Service Layer

- `DiagramService`: Manages diagram data and operations
- `X6GraphService`: Core service for managing the X6 graph instance
- Specialized services for node/edge management, history, and export/import
- `NodeService`: Manages node creation and manipulation
- `EdgeService`: Manages edge creation and manipulation
- `HistoryService`: Manages undo/redo operations
- `ExportImportService`: Handles diagram export and import

### Data Flow Architecture

- Unidirectional data flow with nodes and edges as the primary data structures
- Operations start by creating/modifying X6 nodes and edges
- After successful X6 operations, the diagram model is updated
- Clean listener pattern to avoid circular dependencies
- Reactive programming with RxJS observables

### State Management

- Operation-based architecture for tracking changes
- BehaviorSubjects for reactive state management
- Full undo/redo support using X6's history manager
- Support for export/import functionality

## Key Features

### Diagram Editing

- Create nodes (process, store, actor) with different visual styles
- Create edges between nodes
- Drag-and-drop from palette to canvas
- Selection and property editing
- Delete elements
- Grid support
- Undo/redo functionality

### User Experience

- Visual feedback for operations
- State indicators for loading, error states
- Keyboard shortcuts for common operations
- Tooltips and localization support
- Properties panel for editing node and edge attributes

### Data Management

- Local storage for diagrams
- Operation-based change tracking
- Support for future server integration
- Export/import functionality
  - JSON export for diagram data
  - PNG and SVG export for visualization

## Implementation Status

The diagram editor has successfully implemented:

- Basic diagram rendering with AntV/X6
- Node and edge creation
- Selection and deletion
- Drag-and-drop from palette
- Local storage persistence
- Theme support
- Export/import functionality (JSON, PNG, SVG)
- Undo/redo functionality
- Properties panel for editing node and edge attributes

In progress or planned features:

- Collaborative editing features
- Server synchronization
- Enhanced UI features (minimap, contextual toolbars)
- Mobile and touch improvements

## Technical Challenges and Solutions

### Node and Edge Management

- Clean abstraction between graph visualization and data model
- Angular components for node types using `@antv/x6-angular-shape`
- Reactive programming for state management

### Deletion Flow

- Clean deletion process with proper reference management
- Centralized cleanup for deleted elements

### Circular Dependencies

- Unidirectional data flow and batched updates
- Clear separation of concerns between services

### AntV/X6 Integration

- Seamless integration with Angular using `@antv/x6-angular-shape`
- Proper event handling and state management
- Efficient rendering and interaction

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

The diagram editor is built with a clean architecture that provides a solid foundation for future enhancements. The operation-based architecture will enable collaborative editing features in the future.
