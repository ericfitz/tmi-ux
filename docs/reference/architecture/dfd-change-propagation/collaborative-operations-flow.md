# Collaborative Operations Flow

This document details how WebSocket-based collaborative operations work in the DFD system, including message handling, conflict resolution, and state synchronization.

## Overview

The collaborative editing system enables real-time synchronization of diagram changes across multiple users. It implements a client-server architecture with WebSocket communication, conflict detection, and graceful fallback mechanisms.

## WebSocket Message Flow

### Outgoing Operations (Local to Remote)

```mermaid
flowchart TD
    A[Local user makes change] --> B[DiagramOperationBroadcaster captures X6 event]
    B --> C[Filter visual-only changes]
    C --> D{Passes filter?}
    D -->|No| E[Skip broadcast]
    D -->|Yes| F[Convert to CellOperation]

    F --> G[CollaborativeOperationService.sendDiagramOperation]
    G --> H[Check permissions]
    H --> I{Has edit permission?}
    I -->|No| J[Throw permission error]
    I -->|Yes| K[Deduplicate operations]

    K --> L[Create DiagramOperationMessage]
    L --> M[WebSocketAdapter.sendTMIMessage]
    M --> N[Send to server]

    N --> O{WebSocket connected?}
    O -->|Yes| P[Message sent successfully]
    O -->|No| Q[Queue for retry]

    P --> R[Server processes and broadcasts]
    Q --> S[Retry when connection restored]

    R --> T[Remote collaborators receive]
    S --> U[Process queued operations]

    style I fill:#fff3e0
    style O fill:#e1f5fe
```

### Incoming Operations (Remote to Local)

```mermaid
flowchart TD
    A[WebSocket receives diagram_operation] --> B[WebSocketService.handleDiagramOperation]
    B --> C{From current user?}
    C -->|Yes| D[Skip - own operation]
    C -->|No| E[DfdStateService.processDiagramOperation]

    E --> F[Add to pending operations]
    F --> G[Emit applyOperationEvent]
    G --> H[DfdComponent subscribes to event]

    H --> I[Set isApplyingRemoteChange = true]
    I --> J[Process each CellOperation]
    J --> K{Operation type?}

    K -->|add| L[DfdFacadeService.createNodeFromRemoteOperation]
    K -->|update| M[Update existing cell]
    K -->|remove| N[DfdFacadeService.removeNodeFromRemoteOperation]

    L --> O[Apply to X6 graph with suppressHistory]
    M --> O
    N --> O

    O --> P[Update visual rendering]
    P --> Q[Set isApplyingRemoteChange = false]
    Q --> R[Clear processed operation]

    style I fill:#f3e5f5
    style O fill:#e8f5e8
```

## Conflict Resolution and State Correction

### State Correction Flow

```mermaid
flowchart TD
    A[Server detects state mismatch] --> B[Send state_correction message]
    B --> C[WebSocketService.handleStateCorrection]
    C --> D[Compare update vectors]

    D --> E{Server vector > Local vector?}
    E -->|Yes| F[Trigger resync]
    E -->|No| G[Ignore - local is newer]

    F --> H[DfdStateService sets isResyncing = true]
    H --> I[Emit triggerResyncEvent]
    I --> J[DfdComponent.handleResyncTrigger]

    J --> K[DiagramResyncService.performResync]
    K --> L[Fetch latest diagram via REST]
    L --> M[Clear current graph]
    M --> N[Load fresh diagram data]

    N --> O[DfdStateService.resyncComplete]
    O --> P[Set isSynced = true]

    style D fill:#fff3e0
    style E fill:#fff3e0
```

### Authorization Handling

```mermaid
flowchart TD
    A[Server rejects operation] --> B[Send authorization_denied message]
    B --> C[WebSocketService.handleAuthorizationDenied]
    C --> D[Log permission error]
    D --> E[Show user notification]
    E --> F[Update UI to reflect read-only state]

    style C fill:#ffebee
    style E fill:#ffebee
```

## Permission System Integration

### Permission Checking Flow

```mermaid
flowchart TD
    A[User attempts operation] --> B{DfdCollaborationService.isCollaborating?}
    B -->|No| C[Check threat model permission]
    B -->|Yes| D[Check collaboration permission]

    C --> E{Permission = 'writer'?}
    E -->|Yes| F[Allow operation]
    E -->|No| G[Block operation]

    D --> H{hasPermission('edit')?}
    H -->|Yes| I[Allow operation]
    H -->|No| J{isLoadingUsers?}

    J -->|Yes| K[Fallback to threat model permission]
    J -->|No| L[Block operation]

    K --> E

    F --> M[Proceed with operation]
    I --> M
    G --> N[Show permission error]
    L --> N

    style B fill:#e1f5fe
    style E fill:#fff3e0
    style H fill:#fff3e0
    style J fill:#fff3e0
```

## State Synchronization Architecture

### Multiple State Stores

```mermaid
flowchart TD
    A[WebSocket Message] --> B[WebSocketService]
    B --> C[DfdStateService - Collaborative State]
    C --> D[Emit domain events]

    D --> E[DfdComponent - Main Controller]
    E --> F[Update X6 Graph]
    F --> G[DfdStateStore - Local State]

    G --> H[Update observables]
    H --> I[UI Components react]

    style C fill:#e1f5fe
    style G fill:#e8f5e8
```

### State Synchronization Points

```mermaid
flowchart TD
    A[Remote Operation Applied] --> B[X6 Graph Updated]
    B --> C[DfdStateStore.updateState]
    C --> D[cells$ observable updated]

    E[Selection Change] --> F[X6SelectionAdapter]
    F --> G[DfdStateStore.updateState]
    G --> H[selectedNode$ observable updated]

    I[History Change] --> J[X6 History Plugin]
    J --> K[DfdStateStore.updateState]
    K --> L[canUndo$/canRedo$ observables updated]

    style C fill:#e8f5e8
    style G fill:#e8f5e8
    style K fill:#e8f5e8
```

## Error Handling and Fallback

### WebSocket Failure Handling

```mermaid
flowchart TD
    A[WebSocket operation fails] --> B{Error type?}
    B -->|Network/Timeout| C[Retry with exponential backoff]
    B -->|Permission| D[Show permission error]
    B -->|Connection lost| E[Queue operation for retry]

    C --> F{Max retries exceeded?}
    F -->|No| G[Try again]
    F -->|Yes| H[Fall back to REST API]

    E --> I[Connection restored?]
    I -->|Yes| J[Process queued operations]
    I -->|No| K[Continue queuing]

    H --> L[DfdDiagramService.saveViaREST]
    L --> M[Bulk save entire diagram state]

    style B fill:#fff3e0
    style F fill:#fff3e0
    style I fill:#e1f5fe
```

### Operation Deduplication

```mermaid
flowchart TD
    A[Multiple operations for same cell] --> B[CollaborativeOperationService.deduplicateOperations]
    B --> C{Operation types?}

    C -->|remove + any| D[Keep remove operation]
    C -->|add + update| E[Merge into single add]
    C -->|update + update| F[Merge data objects]

    D --> G[Single remove operation]
    E --> H[Single add with merged data]
    F --> I[Single update with merged data]

    G --> J[Send to WebSocket]
    H --> J
    I --> J

    style B fill:#fff3e0
```

## Presenter Mode Features

### Presenter Cursor Tracking

```mermaid
flowchart TD
    A[Presenter moves cursor] --> B[PresenterCursorService.updatePosition]
    B --> C[CollaborativeOperationService.sendPresenterCursor]
    C --> D[WebSocket: presenter_cursor message]

    D --> E[Remote clients receive]
    E --> F[PresenterCursorDisplayService.updateCursor]
    F --> G[Show cursor on remote graphs]

    style B fill:#f3e5f5
    style F fill:#f3e5f5
```

### Presenter Selection Sync

```mermaid
flowchart TD
    A[Presenter selects cells] --> B[PresenterSelectionService.updateSelection]
    B --> C[CollaborativeOperationService.sendPresenterSelection]
    C --> D[WebSocket: presenter_selection message]

    D --> E[Remote clients receive]
    E --> F[PresenterSelectionService.applyRemoteSelection]
    F --> G[Highlight selected cells on remote graphs]

    style B fill:#f3e5f5
    style F fill:#f3e5f5
```

## Performance Optimizations

### Message Batching

```mermaid
flowchart TD
    A[Multiple rapid changes] --> B[DiagramOperationBroadcaster.startAtomicOperation]
    B --> C[Collect operations in batch]
    C --> D[DiagramOperationBroadcaster.commitAtomicOperation]
    D --> E[Send single WebSocket message]

    E --> F[Reduced network traffic]
    F --> G[Better performance]

    style B fill:#e8f5e8
    style E fill:#e8f5e8
```

### History Suppression for Remote Operations

```mermaid
flowchart TD
    A[Remote operation received] --> B[GraphHistoryCoordinator.executeRemoteOperation]
    B --> C[Disable X6 history temporarily]
    C --> D[Apply changes to graph]
    D --> E[Re-enable X6 history]

    E --> F[No local history entry created]
    F --> G[Prevents history pollution]

    style B fill:#e8f5e8
    style F fill:#e8f5e8
```

## Key Message Types

### Diagram Operations

- `diagram_operation`: Cell add/update/remove operations
- `undo_request`: Request server-side undo
- `redo_request`: Request server-side redo
- `resync_request`: Request full diagram refresh

### State Management

- `state_correction`: Server indicates client is out of sync
- `authorization_denied`: Operation rejected due to permissions
- `history_operation`: Server-side history changes

### Presenter Features

- `presenter_cursor`: Presenter cursor position updates
- `presenter_selection`: Presenter selection changes
- `presenter_request`: Request to become presenter
- `presenter_denied`: Presenter request denied

### Collaboration Management

- `participant_joined`: New user joined session
- `participant_left`: User left session
- `participants_update`: Full participant list update

This collaborative architecture enables real-time editing while maintaining data consistency and handling various failure scenarios gracefully.
