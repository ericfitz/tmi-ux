# Auto-save Decision Tree and History Management

This document details the complex decision logic that determines when auto-save is triggered and how the history system manages what gets included in undo/redo operations.

<!-- Note: This document describes architectural patterns and flows. Some class names
may evolve as the codebase is refactored. The patterns described remain valid. -->

## Auto-save Decision Tree

The auto-save system implements sophisticated logic to determine when diagram changes should be persisted to the database.

### Primary Auto-save Decision Flow

```mermaid
flowchart TD
    A[User makes change to diagram] --> B{Is initial load in progress?}
    B -->|Yes| C[Skip auto-save - loading state]
    B -->|No| D{Is collaborating?}

    D -->|Yes| E[Skip auto-save - WebSocket handles persistence]
    D -->|No| F{Is change semantic?}

    F -->|No| G[Skip auto-save - visual change only]
    F -->|Yes| H{AppOperationStateManager filter result?}

    H -->|Exclude| I[Skip auto-save - filtered out]
    H -->|Include| J[Record in custom history via AppHistoryService]

    J --> K[AppHistoryService records entry]
    K --> L[AppPersistenceCoordinator.saveStatus$ emits]
    L --> M[AppDfdOrchestrator triggers auto-save]

    M --> N{Required data available?}
    N -->|No| O[Log warning - cannot save]
    N -->|Yes| P[AppDiagramService.saveDiagramChanges]

    P --> Q[REST API call to save diagram]
    Q --> R[Database updated]

    style E fill:#e1f5fe
    style G fill:#ffebee
    style I fill:#ffebee
    style P fill:#e8f5e8
```

### Auto-save Trigger Sources

The system has multiple sources that can trigger auto-save:

```mermaid
flowchart TD
    A[History State Changes] --> B[AppHistoryService.historyStateChange$]
    C[Cell Metadata Changes] --> D[InfraX6GraphAdapter.nodeInfoChanged$]
    E[Threat Changes] --> F[AppEventHandlersService.threatChanged$]

    B --> G[AppDfdOrchestrator auto-save subscription]
    D --> G
    F --> G

    G --> H[AppPersistenceCoordinator.triggerSave called]
    H --> I{Passes auto-save checks?}
    I -->|Yes| J[Trigger save]
    I -->|No| K[Skip save]

    style G fill:#fff3e0
    style H fill:#e8f5e8
```

### Auto-save Validation Checks

Before triggering a save, the system performs several validation checks:

```mermaid
flowchart TD
    A[Save request received] --> B{InfraX6GraphAdapter.isInitialized?}
    B -->|No| C[Skip - graph not ready]
    B -->|Yes| D{dfdId exists?}

    D -->|No| E[Skip - no diagram ID]
    D -->|Yes| F{threatModelId exists?}

    F -->|No| G[Skip - no threat model ID]
    F -->|Yes| H{AppDfdOrchestrator state loading?}

    H -->|Yes| I[Skip - still loading]
    H -->|No| J{isCollaborating?}

    J -->|Yes| K[Skip - collaboration mode uses WebSocket]
    J -->|No| L[Proceed with save]

    L --> M[AppDiagramService.saveDiagramChanges]

    style C fill:#ffebee
    style E fill:#ffebee
    style G fill:#ffebee
    style I fill:#ffebee
    style K fill:#e1f5fe
    style L fill:#e8f5e8
```

## History Management System

The history system controls what operations can be undone/redone and filters out visual-only changes. TMI uses a custom history implementation (`AppHistoryService`) rather than the X6 built-in history plugin.

### History Inclusion Decision Tree

```mermaid
flowchart TD
    A[X6 Change Event] --> B{Event type check}
    B -->|cell:change:tools| C[Exclude - tool changes]
    B -->|cell:change:*| D[Analyze attribute changes]
    B -->|cell:added| E[Include - semantic change]
    B -->|cell:removed| F[Include - semantic change]

    D --> G{Extract attribute paths}
    G --> H[AppOperationStateManager.shouldExcludeAttribute]
    H --> I{All attributes visual?}

    I -->|Yes| J[Exclude - visual only]
    I -->|No| K[Include - has semantic changes]

    E --> L[Add to AppHistoryService]
    F --> L
    K --> L
    L --> M[historyStateChange$ emits]

    C --> N[No history entry]
    J --> N

    style H fill:#fff3e0
    style I fill:#fff3e0
```

### Visual Attribute Detection

The system maintains a comprehensive list of visual-only attributes:

```mermaid
flowchart TD
    A[Attribute path analysis] --> B{Check attribute patterns}

    B --> C[Selection effects: body/filter, body/stroke, body/strokeWidth]
    B --> D[Shadow effects: shadowOffsetX, shadowBlur, shadowColor]
    B --> E[Port highlights: circle/stroke, circle/fill]
    B --> F[Tool attributes: tools/*]

    C --> G{Path matches visual patterns?}
    D --> G
    E --> G
    F --> G

    G -->|Yes| H[Exclude from history]
    G -->|No| I[Include in history]

    style G fill:#fff3e0
```

### Port Visibility Handling

Port visibility changes are specifically excluded from history:

```mermaid
flowchart TD
    A[Property path check] --> B{Path contains 'ports/items/'?}
    B -->|No| C[Not port-related]
    B -->|Yes| D{Path ends with '/attrs/circle/style/visibility'?}

    D -->|No| E[Other port change - include]
    D -->|Yes| F[Port visibility - exclude]

    C --> G[Apply normal attribute rules]
    E --> H[Include in history]
    F --> I[Exclude from history]

    style D fill:#fff3e0
```

## History Operation Types

The system categorizes different types of operations for history tracking:

```mermaid
flowchart TD
    A[History Operations] --> B[Node Operations]
    A --> C[Edge Operations]
    A --> D[Compound Operations]

    B --> E[NODE_CREATE]
    B --> F[NODE_DELETE]
    B --> G[NODE_MOVE]
    B --> H[NODE_RESIZE]

    C --> I[EDGE_CREATE]
    C --> J[EDGE_DELETE]
    C --> K[EDGE_VERTICES_CHANGE]

    D --> L[CELL_DELETION - batch delete]
    D --> M[GROUP_CREATION - multiple adds]
    D --> N[DIAGRAM_LOAD - initial state]

    style B fill:#e3f2fd
    style C fill:#f3e5f5
    style D fill:#e8f5e8
```

## Atomic Operations and Batching

### Atomic Operation Handling

```mermaid
flowchart TD
    A[Start atomic operation] --> B[AppOperationStateManager.executeAtomicOperation]
    B --> C[X6 Graph.batchUpdate starts]
    C --> D[All changes batched]
    D --> E[Single history entry created]
    E --> F[X6 Graph.batchUpdate ends]
    F --> G[historyStateChange$ emits once]
    G --> H[Single auto-save triggered]

    style B fill:#e8f5e8
    style E fill:#e8f5e8
    style H fill:#e8f5e8
```

### Remote Operation History Suppression

```mermaid
flowchart TD
    A[Remote operation received] --> B[AppOperationStateManager.executeRemoteOperation]
    B --> C[stateEvents$ emits remote-operation-start]
    C --> D[Apply remote changes]
    D --> E[stateEvents$ emits remote-operation-end]
    E --> F[Remote changes recorded in history per user preference]
    F --> G[Auto-save skipped in collaboration mode]

    style B fill:#f3e5f5
    style C fill:#f3e5f5
    style F fill:#f3e5f5
```

## Collaborative Mode History Handling

### History Management in Collaboration

```mermaid
flowchart TD
    A[User joins collaboration] --> B[AppHistoryService.clearHistory called]
    B --> C[Local history cleared for fresh start]
    C --> D[Server manages canonical state]

    E[User leaves collaboration] --> F[AppHistoryService reinitialized]
    F --> G[Local history re-enabled]

    style C fill:#e1f5fe
    style D fill:#e1f5fe
    style G fill:#e8f5e8
```

### Server-side History Operations

```mermaid
flowchart TD
    A[User requests undo in collaboration] --> B[InfraWebsocketCollaborationAdapter.requestUndo]
    B --> C[WebSocket: undo_request message]
    C --> D[Server processes undo]
    D --> E[Server broadcasts result to all clients]
    E --> F[Clients apply undo via remote operation]

    style D fill:#e1f5fe
    style F fill:#f3e5f5
```

## Performance Considerations

### Debouncing and Throttling

```mermaid
flowchart TD
    A[Rapid changes] --> B[X6 batchUpdate mechanism]
    B --> C[Single history entry for batch]
    C --> D[Single auto-save call]

    E[History plugin debouncing] --> F[Prevents excessive events]
    F --> G[Improved performance]

    style B fill:#e8f5e8
    style C fill:#e8f5e8
    style F fill:#e8f5e8
```

### Memory Management

```mermaid
flowchart TD
    A[History size limits] --> B[AppHistoryService configuration]
    B --> C[Max history entries cap]
    C --> D[Automatic cleanup of old entries]

    E[Visual effect cleanup] --> F[Temporary visual states removed]
    F --> G[No memory leaks from effects]

    style C fill:#e8f5e8
    style F fill:#e8f5e8
```

## Error Scenarios and Handling

### Save Failure Handling

```mermaid
flowchart TD
    A[Auto-save triggered] --> B[AppDiagramService.saveDiagramChanges]
    B --> C{Save successful?}
    C -->|Yes| D[Log success]
    C -->|No| E[Log error]

    E --> F[No retry - user must manually save]
    F --> G[History preserved for manual save]

    style E fill:#ffebee
    style G fill:#fff3e0
```

### History Corruption Recovery

```mermaid
flowchart TD
    A[History corruption detected] --> B[Clear AppHistoryService]
    B --> C[Reset to current graph state]
    C --> D[Log warning to user]
    D --> E[Disable undo/redo temporarily]
    E --> F[User must reload to restore history]

    style A fill:#ffebee
    style E fill:#ffebee
```

This comprehensive auto-save and history management system ensures data integrity while providing a smooth user experience and maintaining performance even with complex collaborative editing scenarios.

<!--
VERIFICATION SUMMARY
Verified on: 2026-01-25
Agent: verify-migrate-doc

Verified items:
- AppOperationStateManager: Confirmed exists at src/app/pages/dfd/application/services/app-operation-state-manager.service.ts
- AppOperationStateManager.shouldExcludeAttribute: Method confirmed in source code
- AppOperationStateManager.executeAtomicOperation: Method confirmed in source code
- AppOperationStateManager.executeRemoteOperation: Method confirmed in source code
- AppDiagramService: Confirmed exists at src/app/pages/dfd/application/services/app-diagram.service.ts
- AppDiagramService.saveDiagramChanges: Method confirmed in source code
- AppEventHandlersService: Confirmed exists at src/app/pages/dfd/application/services/app-event-handlers.service.ts
- AppEventHandlersService.threatChanged$: Observable confirmed in source code
- AppEventHandlersService.nodeInfoChanged$: Observable confirmed in source code
- InfraX6GraphAdapter: Confirmed exists at src/app/pages/dfd/infrastructure/adapters/infra-x6-graph.adapter.ts
- InfraWebsocketCollaborationAdapter: Confirmed exists at src/app/pages/dfd/infrastructure/adapters/infra-websocket-collaboration.adapter.ts
- Visual attribute detection pattern: Verified shouldExcludeAttribute implementation matches documented patterns

Items corrected:
- GraphHistoryCoordinator renamed to AppOperationStateManager
- X6GraphAdapter renamed to InfraX6GraphAdapter
- DfdDiagramService renamed to AppDiagramService
- DfdEventHandlersService renamed to AppEventHandlersService
- CollaborativeOperationService renamed to InfraWebsocketCollaborationAdapter
- historyModified$ replaced with historyStateChange$ from AppHistoryService
- setHistoryEnabled replaced with clearHistory pattern in AppHistoryService
- Updated references to X6 history plugin to AppHistoryService (custom implementation)
-->
