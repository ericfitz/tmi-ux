# Change Propagation Matrix and Decision Points Analysis

This document provides a comprehensive mapping of how different operations propagate through the DFD system and analyzes the critical decision points that determine the flow of changes.

## Change Propagation Matrix

The following matrix shows which systems are affected by different types of operations in the DFD component:

| Operation Type         | X6 Graph     | History       | Auto-save    | WebSocket       | Visual Effects | State Store    | Collaboration     |
| ---------------------- | ------------ | ------------- | ------------ | --------------- | -------------- | -------------- | ----------------- |
| **User Node Creation** | ✅ Direct    | ✅ Semantic   | ✅ Triggered | ✅ If collab    | ✅ Highlight   | ✅ Update      | ✅ Broadcast      |
| **User Node Drag**     | ✅ Direct    | ✅ Position   | ✅ Triggered | ✅ If collab    | ❌ None        | ✅ Update      | ✅ Broadcast      |
| **User Node Delete**   | ✅ Direct    | ✅ Semantic   | ✅ Triggered | ✅ If collab    | ❌ None        | ✅ Update      | ✅ Broadcast      |
| **User Edge Creation** | ✅ Direct    | ✅ Semantic   | ✅ Triggered | ✅ If collab    | ✅ Highlight   | ✅ Update      | ✅ Broadcast      |
| **User Selection**     | ✅ Selection | ❌ Excluded   | ❌ No save   | ❌ No broadcast | ✅ Selection   | ✅ Update      | ✅ If presenter   |
| **User Hover**         | ✅ Visual    | ❌ Excluded   | ❌ No save   | ❌ No broadcast | ✅ Hover       | ❌ No update   | ❌ No broadcast   |
| **Remote Node Add**    | ✅ Applied   | ❌ Suppressed | ❌ No save   | ✅ Received     | ✅ Highlight   | ✅ Update      | ✅ Source         |
| **Remote Node Update** | ✅ Applied   | ❌ Suppressed | ❌ No save   | ✅ Received     | ❌ None        | ✅ Update      | ✅ Source         |
| **Remote Node Delete** | ✅ Applied   | ❌ Suppressed | ❌ No save   | ✅ Received     | ❌ None        | ✅ Update      | ✅ Source         |
| **Diagram Load**       | ✅ Batch     | ❌ Suppressed | ❌ No save   | ❌ No broadcast | ❌ None        | ✅ Full update | ❌ No broadcast   |
| **Undo/Redo (Solo)**   | ✅ History   | ✅ Applied    | ✅ Triggered | ❌ No broadcast | ❌ None        | ✅ Update      | ❌ Not collab     |
| **Undo/Redo (Collab)** | ✅ Applied   | ❌ Suppressed | ❌ No save   | ✅ Server-side  | ❌ None        | ✅ Update      | ✅ Server managed |
| **Port Visibility**    | ✅ Visual    | ❌ Excluded   | ❌ No save   | ❌ No broadcast | ✅ Ports       | ❌ No update   | ❌ No broadcast   |
| **Cell Properties**    | ✅ Direct    | ✅ Metadata   | ✅ Triggered | ✅ If collab    | ❌ None        | ✅ Update      | ✅ Broadcast      |
| **Threat Changes**     | ❌ No change | ❌ No history | ✅ Triggered | ❌ No broadcast | ❌ None        | ❌ No update   | ❌ No broadcast   |

### Legend

- ✅ **Affected**: The system is involved in processing this operation
- ❌ **Not Affected**: The system does not process this operation
- **If collab**: Only affected when in collaborative mode
- **If presenter**: Only affected for presenter in collaborative mode

## Critical Decision Points Analysis

The system contains numerous decision points that determine how changes propagate. Understanding these is crucial for debugging and architectural improvements.

### 1. Collaborative Mode Detection

**Location**: Multiple services check `DfdCollaborationService.isCollaborating()`

**Impact**: This is the most critical decision point that affects almost every operation flow.

```mermaid
flowchart TD
    A[Any User Action] --> B{isCollaborating?}
    B -->|Yes| C[Collaborative Flow]
    B -->|No| D[Solo Flow]

    C --> E[Check permissions]
    C --> F[Use WebSocket for persistence]
    C --> G[Suppress local history]
    C --> H[Enable DiagramOperationBroadcaster]

    D --> I[No permission checks]
    D --> J[Use REST for persistence]
    D --> K[Enable local history]
    D --> L[Disable broadcaster]

    style B fill:#e1f5fe
    style C fill:#f3e5f5
    style D fill:#e8f5e8
```

**Services that depend on this decision:**

- DfdComponent (auto-save logic)
- DiagramOperationBroadcaster (event capture)
- CollaborativeOperationService (permission checks)
- X6GraphAdapter (history enable/disable)
- DfdDiagramService (save routing)

### 2. History Filtering Decision

**Location**: `GraphHistoryCoordinator.shouldExcludeAttribute()`

**Impact**: Determines what operations create history entries and trigger auto-save.

```mermaid
flowchart TD
    A[X6 Change Event] --> B{Tool changes?}
    B -->|Yes| C[Exclude completely]
    B -->|No| D{Visual attributes only?}

    D --> E[GraphHistoryCoordinator.shouldExcludeAttribute]
    E --> F{shouldExclude result?}
    F -->|True| G[Exclude from history]
    F -->|False| H[Include in history]

    H --> I[Auto-save triggered]
    H --> J[Undo/redo available]

    C --> K[No propagation]
    G --> K

    style E fill:#fff3e0
    style F fill:#fff3e0
```

**Affected systems:**

- X6 History system
- Auto-save triggering
- DiagramOperationBroadcaster (collaborative mode)

### 3. Permission Validation Decision

**Location**: `CollaborativeOperationService.sendDiagramOperation()`

**Impact**: Blocks unauthorized operations in collaborative mode.

```mermaid
flowchart TD
    A[Collaborative Operation] --> B{Collaboration permissions loaded?}
    B -->|Yes| C[Check collaboration permission]
    B -->|No| D[Check threat model permission]

    C --> E{hasPermission('edit')?}
    E -->|Yes| F[Allow operation]
    E -->|No| G[Block operation]

    D --> H{threatModelPermission === 'writer'?}
    H -->|Yes| I[Allow operation (fallback)]
    H -->|No| J[Block operation]

    F --> K[Send to WebSocket]
    I --> K
    G --> L[Show permission error]
    J --> L

    style B fill:#fff3e0
    style E fill:#fff3e0
    style H fill:#fff3e0
```

### 4. Auto-save Validation Decision

**Location**: `DfdComponent.autoSaveDiagram()`

**Impact**: Determines when diagram changes are persisted to the database.

```mermaid
flowchart TD
    A[Auto-save Triggered] --> B{_isInitialLoadInProgress?}
    B -->|Yes| C[Skip - loading]
    B -->|No| D{isCollaborating?}

    D -->|Yes| E[Skip - WebSocket handles]
    D -->|No| F{Required data available?}

    F -->|No| G[Skip - missing data]
    F -->|Yes| H[Proceed with save]

    H --> I[DfdDiagramService.saveDiagramChanges]
    I --> J[REST API call]

    C --> K[No save]
    E --> K
    G --> K

    style B fill:#fff3e0
    style D fill:#e1f5fe
    style F fill:#fff3e0
```

### 5. Visual Effect Application Decision

**Location**: `VisualEffectsService.applyCreationHighlight()`

**Impact**: Prevents visual conflicts and ensures smooth user experience.

```mermaid
flowchart TD
    A[Visual Effect Request] --> B{Cell already has active effect?}
    B -->|Yes| C[Skip - avoid conflicts]
    B -->|No| D{Cell currently selected?}

    D -->|Yes| E[Skip - selection takes priority]
    D -->|No| F[Apply visual effect]

    F --> G[GraphHistoryCoordinator.executeVisualEffect]
    G --> H[Effect applied without history]

    C --> I[No effect applied]
    E --> I

    style B fill:#fff3e0
    style D fill:#fff3e0
    style G fill:#f3e5f5
```

## State Synchronization Decision Points

### 1. State Store Update Routing

**Location**: Multiple locations where state changes occur

**Impact**: Ensures different state stores stay synchronized.

```mermaid
flowchart TD
    A[State Change] --> B{Source of change?}
    B -->|X6 Graph| C[Update DfdStateStore]
    B -->|WebSocket| D[Update DfdStateService]
    B -->|User Input| E[Update component state]

    C --> F[Emit observables]
    D --> G[Emit collaborative events]
    E --> H[Update both stores]

    F --> I[UI components react]
    G --> J[Apply to graph]
    H --> K[Cascade updates]

    J --> L[Trigger DfdStateStore update]

    style B fill:#fff3e0
```

### 2. Remote Operation Processing Decision

**Location**: `DfdStateService.processDiagramOperation()`

**Impact**: Handles incoming collaborative operations correctly.

```mermaid
flowchart TD
    A[Remote Operation] --> B{From current user?}
    B -->|Yes| C[Skip - own operation]
    B -->|No| D{Already processed?}

    D -->|Yes| E[Skip - duplicate]
    D -->|No| F[Process operation]

    F --> G[Set isApplyingRemoteChange = true]
    G --> H[Apply to graph with history suppression]
    H --> I[Set isApplyingRemoteChange = false]

    C --> J[No action]
    E --> J

    style B fill:#fff3e0
    style D fill:#fff3e0
    style G fill:#f3e5f5
```

## Operation Deduplication Logic

### Cell Operation Merging

**Location**: `CollaborativeOperationService._deduplicateOperations()`

**Impact**: Prevents duplicate operations and optimizes WebSocket traffic.

```mermaid
flowchart TD
    A[Multiple operations for same cell] --> B{Operation types?}

    B -->|remove + any| C[Keep only remove]
    B -->|add + update| D[Merge into single add]
    B -->|update + update| E[Merge data objects]
    B -->|add + add| F[Keep latest add]

    C --> G[Single remove operation]
    D --> H[Single add with merged data]
    E --> I[Single update with merged data]
    F --> J[Single add operation]

    G --> K[Send optimized operations]
    H --> K
    I --> K
    J --> K

    style B fill:#fff3e0
    style K fill:#e8f5e8
```

## Error Handling Decision Points

### 1. WebSocket Failure Recovery

**Location**: `CollaborativeOperationService._sendOperationWithRetry()`

**Impact**: Determines fallback behavior when WebSocket operations fail.

```mermaid
flowchart TD
    A[WebSocket Operation Fails] --> B{Error type?}
    B -->|Network/Timeout| C[Queue for retry]
    B -->|Permission| D[Block operation]
    B -->|Connection lost| E[Queue operation]

    C --> F{Max retries exceeded?}
    F -->|No| G[Retry with backoff]
    F -->|Yes| H[Fall back to REST]

    E --> I{Connection restored?}
    I -->|Yes| J[Process queue]
    I -->|No| K[Continue queuing]

    H --> L[DfdDiagramService.saveViaREST]
    D --> M[Show error to user]

    style B fill:#fff3e0
    style F fill:#fff3e0
    style I fill:#e1f5fe
```

### 2. State Correction Handling

**Location**: `WebSocketService._handleStateCorrection()`

**Impact**: Resolves conflicts between local and server state.

```mermaid
flowchart TD
    A[State Correction Received] --> B{Compare update vectors}
    B -->|Server > Local| C[Trigger resync]
    B -->|Server ≤ Local| D[Ignore correction]

    C --> E[DfdStateService.triggerResync]
    E --> F[DiagramResyncService.performResync]
    F --> G[Fetch fresh diagram data]
    G --> H[Replace local state]

    D --> I[Keep local state]

    style B fill:#fff3e0
    style G fill:#e1f5fe
```

## Performance Decision Points

### 1. Batching Strategy

**Location**: `GraphHistoryCoordinator.executeAtomicOperation()`

**Impact**: Reduces overhead by batching related operations.

```mermaid
flowchart TD
    A[Multiple related changes] --> B{Use atomic operation?}
    B -->|Yes| C[Batch in single history entry]
    B -->|No| D[Individual history entries]

    C --> E[Single auto-save trigger]
    C --> F[Single WebSocket message]

    D --> G[Multiple auto-save triggers]
    D --> H[Multiple WebSocket messages]

    E --> I[Better performance]
    F --> I
    G --> J[Higher overhead]
    H --> J

    style B fill:#fff3e0
    style I fill:#e8f5e8
    style J fill:#ffebee
```

### 2. Visual Effect Throttling

**Location**: `VisualEffectsService` animation management

**Impact**: Prevents performance degradation from excessive visual updates.

```mermaid
flowchart TD
    A[Visual effect request] --> B{Active effect for cell?}
    B -->|Yes| C[Skip - already animating]
    B -->|No| D[Apply effect]

    D --> E[Track in activeEffects map]
    E --> F[Use requestAnimationFrame]
    F --> G[Efficient animation]

    C --> H[Prevent conflicts]

    style B fill:#fff3e0
    style F fill:#e8f5e8
    style H fill:#e8f5e8
```

## Architectural Bottlenecks

### 1. DfdComponent as Central Coordinator

**Issue**: The main DfdComponent handles too many coordination responsibilities.

**Affected Flows**:

- Auto-save decision making
- Collaboration mode switching
- WebSocket handler initialization
- State synchronization

**Impact**: Creates a single point of failure and makes the component difficult to test and maintain.

### 2. Multiple State Stores Without Clear Ownership

**Issue**: DfdStateStore and DfdStateService overlap in responsibilities.

**Confusion Points**:

- Which store owns which data
- How to keep them synchronized
- When to update which store

### 3. Complex Permission Checking Logic

**Issue**: Permission validation is scattered across multiple services with fallback logic.

**Problems**:

- Difficult to understand the complete permission flow
- Race conditions with asynchronous permission loading
- Inconsistent error handling

This analysis reveals the complexity of the current architecture and highlights areas where consolidation and simplification could improve maintainability and reliability.
