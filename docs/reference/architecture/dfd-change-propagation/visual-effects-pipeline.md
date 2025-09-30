# Visual Effects Pipeline and State Synchronization

This document details how visual effects are applied to the DFD graph and how state synchronization works across the multiple state stores in the system.

## Visual Effects Pipeline

The visual effects system provides immediate visual feedback for user interactions while carefully avoiding interference with the semantic change propagation and history systems.

### Visual Effects Architecture

```mermaid
flowchart TD
    A[User Interaction] --> B{Trigger Type}
    B -->|Selection| C[Selection Effects]
    B -->|Hover| D[Hover Effects]
    B -->|Creation| E[Creation Highlights]
    B -->|Connection| F[Connection Validation]
    
    C --> G[X6SelectionAdapter]
    D --> H[X6 hover event handlers]
    E --> I[VisualEffectsService]
    F --> J[Edge validation styling]
    
    G --> K[Apply selection styling]
    H --> L[Apply hover styling]
    I --> M[Apply creation highlight with fade]
    J --> N[Apply connection feedback]
    
    K --> O[GraphHistoryCoordinator.executeVisualEffect]
    L --> O
    M --> O
    N --> O
    
    O --> P[Temporarily disable history]
    P --> Q[Apply styling changes]
    Q --> R[Re-enable history]
    R --> S[Visual effect complete - no history entry]
    
    style O fill:#f3e5f5
    style S fill:#e8f5e8
```

### Selection Effects Flow

```mermaid
flowchart TD
    A[User selects cells] --> B[X6 selection event]
    B --> C[X6SelectionAdapter.handleSelectionChange]
    C --> D[Update selection state]
    D --> E[Apply selection styling]
    
    E --> F{Selected cell type?}
    F -->|Node| G[Apply node selection effects]
    F -->|Edge| H[Apply edge selection effects]
    
    G --> I[body/stroke: selection color]
    G --> J[body/strokeWidth: 3px]
    G --> K[body/filter: drop-shadow]
    
    H --> L[line/stroke: selection color]
    H --> M[line/strokeWidth: 4px]
    
    I --> N[GraphHistoryCoordinator.executeVisualEffect]
    J --> N
    K --> N
    L --> N
    M --> N
    
    N --> O[Changes applied without history]
    
    style N fill:#f3e5f5
    style O fill:#e8f5e8
```

### Creation Highlight System

```mermaid
flowchart TD
    A[Node/Edge created programmatically] --> B[VisualEffectsService.applyCreationHighlight]
    B --> C{Cell already selected or has effect?}
    C -->|Yes| D[Skip highlight - avoid conflicts]
    C -->|No| E[Start fade animation]
    
    E --> F[GraphHistoryCoordinator.executeVisualEffect]
    F --> G[Disable history tracking]
    G --> H[Apply initial bright styling]
    H --> I[Start fade timer]
    
    I --> J[Animate alpha from 1.0 to 0.0]
    J --> K[Update styling at each frame]
    K --> L{Animation complete?}
    L -->|No| M[Continue animation]
    L -->|Yes| N[Remove all highlight styling]
    
    M --> K
    N --> O[Re-enable history tracking]
    O --> P[Clean up effect state]
    
    style F fill:#f3e5f5
    style G fill:#f3e5f5
    style O fill:#f3e5f5
```

### Hover Effects Management

```mermaid
flowchart TD
    A[Mouse enters cell] --> B[X6 cell:mouseenter event]
    B --> C[Apply hover styling]
    C --> D[body/filter: brightness(1.1)]
    D --> E[Visual feedback applied]
    
    F[Mouse leaves cell] --> G[X6 cell:mouseleave event]
    G --> H[Remove hover styling]
    H --> I[Restore original styling]
    
    E --> J[No history impact]
    I --> J
    
    style C fill:#f3e5f5
    style H fill:#f3e5f5
    style J fill:#e8f5e8
```

## State Synchronization Architecture

The system manages multiple state stores that must remain synchronized while serving different purposes.

### State Store Hierarchy

```mermaid
flowchart TD
    A[X6 Graph - Source of Truth] --> B[Multiple State Consumers]
    
    B --> C[DfdStateStore - Local UI State]
    B --> D[DfdStateService - Collaborative State]
    B --> E[Component State - View State]
    
    C --> F[cells$, selectedNode$, canUndo$, etc.]
    D --> G[pendingOperations, syncState, conflicts]
    E --> H[isLoading, error states, etc.]
    
    F --> I[UI Components]
    G --> J[Collaboration Features]
    H --> K[Loading/Error UI]
    
    style A fill:#e1f5fe
    style C fill:#e8f5e8
    style D fill:#f3e5f5
    style E fill:#fff3e0
```

### State Update Propagation

```mermaid
flowchart TD
    A[Graph Change] --> B[X6 Event System]
    B --> C{Event Type}
    
    C -->|cell:added/removed| D[Update DfdStateStore.cells$]
    C -->|selection:changed| E[Update DfdStateStore.selectedNode$]
    C -->|history:change| F[Update DfdStateStore.canUndo$/canRedo$]
    
    D --> G[Emit cells observable]
    E --> H[Emit selectedNode observable]
    F --> I[Emit history observables]
    
    G --> J[UI re-renders cell list]
    H --> K[UI updates selection indicators]
    I --> L[UI enables/disables undo/redo buttons]
    
    style B fill:#e1f5fe
    style G fill:#e8f5e8
    style H fill:#e8f5e8
    style I fill:#e8f5e8
```

### Collaborative State Synchronization

```mermaid
flowchart TD
    A[WebSocket Message] --> B[DfdStateService]
    B --> C[Update collaborative state]
    C --> D{State Change Type}
    
    D -->|Remote operation| E[Update pendingOperations]
    D -->|Sync status| F[Update syncState]
    D -->|Conflict| G[Update conflictCount]
    
    E --> H[Emit applyOperationEvent$]
    F --> I[Emit syncState$]
    G --> J[Emit conflicts for UI]
    
    H --> K[DfdComponent applies changes]
    K --> L[Update X6 Graph]
    L --> M[Trigger DfdStateStore update]
    
    I --> N[Collaboration UI updates]
    J --> O[Show conflict indicators]
    
    style B fill:#f3e5f5
    style M fill:#e1f5fe
```

### Cross-Store Synchronization Points

```mermaid
flowchart TD
    A[State Change Event] --> B{Originating Store}
    
    B -->|DfdStateStore| C[Local state change]
    B -->|DfdStateService| D[Collaborative state change]
    B -->|X6 Graph| E[Graph state change]
    
    C --> F[Update X6 Graph if needed]
    D --> G[Update X6 Graph via remote operation]
    E --> H[Update both state stores]
    
    F --> I[Trigger X6 events]
    G --> I
    H --> J[Update observables]
    
    I --> K[Propagate to other stores]
    J --> L[UI components react]
    
    style I fill:#e1f5fe
    style K fill:#fff3e0
```

## Visual Effect Types and Styling

### Selection Styling Constants

```mermaid
flowchart TD
    A[Selection Detected] --> B[Apply DFD_STYLING.SELECTION constants]
    
    B --> C[STROKE_COLOR: #007acc]
    B --> D[STROKE_WIDTH: 3px]
    B --> E[FILTER: drop-shadow effect]
    B --> F[OPACITY: maintained at 1.0]
    
    C --> G[Visual distinction from unselected]
    D --> H[Emphasis without overwhelming]
    E --> I[Depth perception]
    F --> J[Full visibility maintained]
    
    style B fill:#e3f2fd
```

### Hover Styling System

```mermaid
flowchart TD
    A[Mouse Hover] --> B[Apply DFD_STYLING.HOVER constants]
    
    B --> C[BRIGHTNESS: filter(brightness(1.1))]
    B --> D[TRANSITION: smooth animation]
    B --> E[Z_INDEX: elevated layer]
    
    C --> F[Subtle brightening effect]
    D --> G[Smooth user experience]
    E --> H[Above other elements]
    
    style B fill:#f3e5f5
```

### Creation Highlight Configuration

```mermaid
flowchart TD
    A[Element Created] --> B[Apply DFD_STYLING.CREATION constants]
    
    B --> C[INITIAL_OPACITY: 1.0]
    B --> D[FINAL_OPACITY: 0.0]
    B --> E[FADE_DURATION: 1000ms]
    B --> F[ANIMATION_FRAMES: 60fps]
    
    C --> G[Start fully visible]
    D --> H[Fade to transparent]
    E --> I[One second duration]
    F --> J[Smooth animation]
    
    style B fill:#e8f5e8
```

## Port Visibility Management

### Port State Synchronization

```mermaid
flowchart TD
    A[Graph Change] --> B[PortStateManagerService]
    B --> C{Port visibility update needed?}
    
    C -->|Yes| D[Calculate connected ports]
    C -->|No| E[No action needed]
    
    D --> F[Update port visibility attributes]
    F --> G[GraphHistoryCoordinator.executeVisualEffect]
    G --> H[Apply visibility changes without history]
    
    H --> I[Ports show/hide based on connections]
    I --> J[Visual effect complete]
    
    E --> K[Maintain current port state]
    
    style G fill:#f3e5f5
    style H fill:#f3e5f5
```

### Port Visibility Rules

```mermaid
flowchart TD
    A[Port Evaluation] --> B{Port has connections?}
    B -->|Yes| C[Show port - has active connections]
    B -->|No| D{Node is selected?}
    
    D -->|Yes| E[Show port - node selected]
    D -->|No| F{Mouse hovering over node?}
    
    F -->|Yes| G[Show port - hover state]
    F -->|No| H[Hide port - inactive]
    
    C --> I[Port visible]
    E --> I
    G --> I
    H --> J[Port hidden]
    
    style I fill:#e8f5e8
    style J fill:#ffebee
```

## Performance Optimization

### Visual Effect Batching

```mermaid
flowchart TD
    A[Multiple visual changes] --> B[Batch visual updates]
    B --> C[Single GraphHistoryCoordinator.executeVisualEffect call]
    C --> D[Apply all changes in one history-suppressed block]
    D --> E[Reduced overhead]
    
    style C fill:#f3e5f5
    style E fill:#e8f5e8
```

### Memory Management for Effects

```mermaid
flowchart TD
    A[Visual effect started] --> B[Track in activeEffects Map]
    B --> C[Effect lifecycle managed]
    C --> D{Effect completed?}
    
    D -->|Yes| E[Clean up from activeEffects]
    D -->|No| F[Continue tracking]
    
    E --> G[Remove timers and references]
    G --> H[Prevent memory leaks]
    
    F --> I[Monitor for completion]
    I --> D
    
    style E fill:#e8f5e8
    style G fill:#e8f5e8
```

### State Update Debouncing

```mermaid
flowchart TD
    A[Rapid state changes] --> B[RxJS debouncing operators]
    B --> C[Batch state updates]
    C --> D[Single UI update cycle]
    D --> E[Improved performance]
    
    style B fill:#e8f5e8
    style E fill:#e8f5e8
```

## Error Handling in Visual Effects

### Visual Effect Failure Recovery

```mermaid
flowchart TD
    A[Visual effect error] --> B[Log error details]
    B --> C[Clean up partial state]
    C --> D[Restore history tracking]
    D --> E[Continue normal operation]
    
    E --> F[User experience preserved]
    
    style B fill:#ffebee
    style D fill:#f3e5f5
    style F fill:#e8f5e8
```

### State Synchronization Error Handling

```mermaid
flowchart TD
    A[State sync error] --> B[Detect inconsistency]
    B --> C[Log error with context]
    C --> D[Trigger state reconciliation]
    D --> E[Update observables with current state]
    E --> F[UI reflects correct state]
    
    style B fill:#ffebee
    style E fill:#e8f5e8
```

This visual effects and state synchronization system ensures that users receive immediate visual feedback while maintaining the integrity of the underlying data model and history system.