# DFD Graph Change Propagation Architecture

This directory contains comprehensive documentation on how changes to the Data Flow Diagram (DFD) graph propagate through the TMI-UX system. The analysis reveals a complex architecture with multiple pathways for handling user interactions, collaborative operations, auto-save functionality, and visual effects.

## Overview

The DFD component implements a sophisticated change propagation system that handles:

- **Local user interactions** (drag, add, delete operations)
- **Real-time collaborative editing** via WebSocket connections
- **Automatic saving** of diagram state
- **Undo/redo history management** 
- **Visual effects and styling** (selection, hover, creation highlights)
- **State synchronization** across multiple stores

## Key Architectural Concerns

Based on analysis of the codebase, several architectural challenges have been identified:

1. **Multiple Change Pathways**: Similar operations can follow different code paths depending on context
2. **Code Path Duplication**: Redundant logic exists for handling node/edge operations
3. **Complex Decision Logic**: Numerous conditional checks determine which systems to invoke
4. **State Synchronization**: Multiple state stores must stay synchronized
5. **History Management Complexity**: Intricate rules for what gets included in undo/redo

## Documentation Structure

### Flow Diagrams
- [User Actions Flow](./user-actions-flow.md) - How user interactions propagate through the system
- [Collaborative Operations Flow](./collaborative-operations-flow.md) - WebSocket message handling and state sync
- [Auto-save Decision Tree](./autosave-decision-tree.md) - When and how auto-saving is triggered
- [History Management Flow](./history-management-flow.md) - What gets included/excluded from history
- [Visual Effects Pipeline](./visual-effects-pipeline.md) - How styling and animations are applied

### Analysis Documents  
- [Change Propagation Matrix](./change-propagation-matrix.md) - Comprehensive mapping of operations to affected systems
- [Decision Points Analysis](./decision-points-analysis.md) - Critical decision points and their logic
- [State Synchronization](./state-synchronization.md) - How different stores coordinate
- [Architectural Issues](./architectural-issues.md) - Problems identified and recommendations

## Key Components

### Core Services
- **DfdFacadeService** - Unified interface for DFD operations
- **DfdDiagramService** - Handles diagram loading and saving
- **DfdStateService** - Manages collaborative state and remote operations
- **GraphHistoryCoordinator** - Controls what gets added to undo/redo history

### X6 Integration Layer
- **X6GraphAdapter** - Primary interface to X6 graph library
- **DiagramOperationBroadcaster** - Captures X6 events for collaborative broadcasting
- **X6EventHandlers** - Centralized X6 event management
- **VisualEffectsService** - Manages visual styling without affecting history

### Collaborative Features
- **WebSocketService** - Handles incoming collaborative messages
- **CollaborativeOperationService** - Sends operations to other collaborators
- **DfdCollaborationService** - Manages collaboration state and permissions

### State Management
- **DfdStateStore** - Local component state (cells, selection, etc.)
- **DfdStateService** - Collaborative state and conflict resolution

## Change Propagation Patterns

The system implements several distinct patterns for propagating changes:

1. **Local User Actions** → X6 Events → History System → Auto-save
2. **Collaborative Mode** → X6 Events → DiagramOperationBroadcaster → WebSocket
3. **Remote Operations** → WebSocket → DfdStateService → Direct Graph Updates
4. **Visual Effects** → VisualEffectsService → Direct Styling (history excluded)

Each pattern has different rules for history inclusion, auto-save triggers, and state updates.

## Usage Notes

This documentation is intended for developers working on:
- DFD component architecture and refactoring
- Collaborative editing features
- Auto-save and state management
- Performance optimization
- Debugging change propagation issues

The diagrams use Mermaid syntax and can be viewed in any Markdown renderer that supports Mermaid.