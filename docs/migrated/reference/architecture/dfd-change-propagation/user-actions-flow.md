# User Actions Flow

This document details how user interactions with the DFD graph propagate through the system, showing the complete flow from user action to final state updates.

## Overview

User actions in the DFD component follow different propagation paths depending on whether the user is in collaborative mode or solo editing mode. The system implements sophisticated filtering to ensure only semantic changes trigger saves and broadcasts.

## User Action Categories

### 1. Node Creation

When a user adds a new node to the diagram:

```mermaid
flowchart TD
    A[User adds node via toolbar] --> B[DfdFacadeService.addGraphNode]
    B --> C[DfdNodeService.addGraphNode]
    C --> D[X6 Graph.addNode]
    D --> E[X6 Event: 'node:added']

    E --> F{Is Collaborating?}
    F -->|Yes| G[DiagramOperationBroadcaster.handleCellEvent]
    F -->|No| H[X6HistoryManager records change]

    G --> I[Convert to CellOperation]
    I --> J[CollaborativeOperationService.sendDiagramOperation]
    J --> K[WebSocket broadcast to collaborators]

    H --> L[GraphHistoryCoordinator.executeAtomicOperation]
    L --> M[History change recorded]
    M --> N[DfdComponent.historyModified$ triggers]
    N --> O[autoSaveDiagram called]
    O --> P[DfdDiagramService.saveDiagramChanges]

    K --> Q[Remote collaborators receive update]
    P --> R[REST API saves to database]

    Q --> S[Remote graph updates]
    R --> T[Local save complete]

    style F fill:#e1f5fe
    style G fill:#f3e5f5
    style H fill:#e8f5e8
```

### 2. Node Drag/Move Operations

When a user drags a node to a new position:

```mermaid
flowchart TD
    A[User drags node] --> B[X6 handles mouse events]
    B --> C[X6 updates node position]
    C --> D[X6 Event: 'node:change:position']

    D --> E{History Filtering}
    E -->|Position change = semantic| F[Change passes filter]
    E -->|Visual only| G[Change filtered out]

    F --> H{Is Collaborating?}
    H -->|Yes| I[DiagramOperationBroadcaster captures]
    H -->|No| J[X6 History records]

    I --> K[Create CellOperation with position update]
    K --> L[Send via WebSocket]

    J --> M[History modified event]
    M --> N[Auto-save triggered]

    G --> O[No propagation - visual only]

    L --> P[Collaborators update their graphs]
    N --> Q[Database save via REST]

    style E fill:#fff3e0
    style H fill:#e1f5fe
    style O fill:#ffebee
```

### 3. Node Deletion

When a user deletes one or more nodes:

```mermaid
flowchart TD
    A[User selects nodes and presses Delete] --> B[DfdEventHandlersService.onDeleteSelected]
    B --> C[X6SelectionAdapter.getSelectedCells]
    C --> D[X6 Graph.removeCells]

    D --> E[X6 Events: 'node:removed' + 'edge:removed']
    E --> F[Multiple cells deleted in batch]

    F --> G{Is Collaborating?}
    G -->|Yes| H[DiagramOperationBroadcaster batches operations]
    G -->|No| I[X6 History records batch deletion]

    H --> J[Create multiple CellOperations]
    J --> K[Send batch via WebSocket]

    I --> L[Single history entry for batch]
    L --> M[Auto-save triggered]

    K --> N[Collaborators apply batch deletion]
    M --> O[Database save]

    N --> P[Remote graphs updated]
    O --> Q[Local save complete]

    style F fill:#fff3e0
    style G fill:#e1f5fe
```

### 4. Edge Creation

When a user connects two nodes:

```mermaid
flowchart TD
    A[User drags from source port] --> B[X6 validates connection]
    B --> C{Connection Valid?}
    C -->|Yes| D[X6 creates edge]
    C -->|No| E[Connection rejected]

    D --> F[X6 Event: 'edge:added']
    F --> G[DfdFacadeService.handleEdgeAdded]
    G --> H[DfdEdgeService.handleEdgeAdded]

    H --> I[Validate DFD rules]
    I --> J{DFD Rules Valid?}
    J -->|Yes| K[Edge accepted]
    J -->|No| L[Edge removed]

    K --> M{Is Collaborating?}
    M -->|Yes| N[Broadcast edge creation]
    M -->|No| O[Record in history]

    N --> P[WebSocket to collaborators]
    O --> Q[Auto-save triggered]

    L --> R[Remove invalid edge]
    R --> S[Show validation error]

    E --> T[Show connection error]

    P --> U[Remote edge creation]
    Q --> V[Database save]

    style I fill:#fff3e0
    style J fill:#fff3e0
    style M fill:#e1f5fe
```

## Visual Effects Flow

Visual effects are applied separately from semantic changes to avoid cluttering the history:

```mermaid
flowchart TD
    A[User action triggers visual effect] --> B[VisualEffectsService]
    B --> C[GraphHistoryCoordinator.executeVisualEffect]
    C --> D[Temporarily disable X6 history]
    D --> E[Apply visual styling]
    E --> F[Re-enable X6 history]

    F --> G[Visual effect complete]
    G --> H[No history entry created]
    H --> I[No auto-save triggered]

    style B fill:#f3e5f5
    style C fill:#f3e5f5
    style H fill:#e8f5e8
```

## Decision Points and Filters

### History Filtering Logic

The system applies sophisticated filtering to determine what should be recorded in history:

```mermaid
flowchart TD
    A[X6 Change Event] --> B{Tool changes?}
    B -->|Yes| C[Filter out - no history]
    B -->|No| D{Visual attributes only?}

    D -->|Yes| E[Check GraphHistoryCoordinator.shouldExcludeAttribute]
    D -->|No| F[Semantic change - include in history]

    E --> G{All attributes visual?}
    G -->|Yes| H[Filter out - no history]
    G -->|No| I[Mixed changes - include in history]

    F --> J[Record in history]
    I --> J
    J --> K[Trigger auto-save]

    C --> L[No propagation]
    H --> L

    style E fill:#fff3e0
    style G fill:#fff3e0
```

### Collaborative vs Solo Mode Decision

```mermaid
flowchart TD
    A[Change event] --> B{DfdCollaborationService.isCollaborating?}
    B -->|Yes| C{Has edit permissions?}
    B -->|No| D[Solo mode - use history system]

    C -->|Yes| E[Use DiagramOperationBroadcaster]
    C -->|No| F[Block change - show error]

    E --> G[Send via WebSocket]
    D --> H[Record in X6 history]

    G --> I[Broadcast to collaborators]
    H --> J[Trigger auto-save]

    style B fill:#e1f5fe
    style C fill:#fff3e0
```

## Key Services and Their Roles

> **Note**: This section has been updated to reflect the current service names as of 2026-01-25. The Mermaid diagrams above use older service names for historical context.

### Primary Orchestrators

- **AppDfdFacade**: Single entry point for most operations (formerly DfdFacadeService)
- **AppEventHandlersService**: Handles keyboard and user interactions (formerly DfdEventHandlersService)
- **InfraWebsocketCollaborationAdapter**: Captures and broadcasts changes in collaborative mode (formerly DiagramOperationBroadcaster)

### Change Processing

- **AppOperationStateManager**: Controls operation state flags and coordinates with history (formerly GraphHistoryCoordinator)
- **AppHistoryService**: Manages undo/redo stacks and history entries (replaces X6HistoryManager)
- **AppDiagramService**: Handles saving and loading diagram data (formerly DfdDiagramService)

### State Management

- **DfdStateStore**: Local component state (dfd.state.ts)
- **AppStateService**: Collaborative state and conflict resolution (formerly DfdStateService)

## Performance Considerations

1. **Batching**: Multiple related changes are batched into single operations
2. **Filtering**: Visual-only changes are filtered out to reduce noise
3. **Debouncing**: Auto-save is debounced to prevent excessive API calls
4. **History Limits**: X6 history is capped to prevent memory issues

## Error Handling

The system implements several layers of error handling:

- Connection validation before edge creation
- DFD rule validation after X6 operations
- Permission checks in collaborative mode
- Graceful fallback when WebSocket operations fail
