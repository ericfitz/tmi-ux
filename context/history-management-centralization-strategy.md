# History Management Centralization Strategy

## Current State Analysis

### Existing Patterns Found
1. **Sophisticated filtering** in History plugin's `beforeAddCommand` callback
2. **Dual patterns**: Both `graph.batchUpdate()` AND `historyManager.disable()/enable()`
3. **Comprehensive exclusions** for tools, visual effects, highlighting, port visibility
4. **Multiple services** managing history independently

### Identified Issues
- **Inconsistent patterns** across different code paths
- **Duplicate history logic** in multiple services
- **Complex filter logic** buried in adapter configuration
- **No centralized coordination** between batching and filtering

## Recommended Solution: Centralized History Management Service

### 1. Create `GraphHistoryCoordinator` Service

```typescript
@Injectable({
  providedIn: 'root'
})
export class GraphHistoryCoordinator {
  private readonly historyFilters = {
    // Visual effects exclusions
    visualEffects: [
      'tools', 'items', 'name',
      'body/filter', 'line/filter', 'text/filter',
      'body/strokeWidth', 'line/strokeWidth', 'line/stroke'
    ],
    
    // Port visibility patterns
    portVisibility: [
      /^ports\/.*\/attrs\/circle\/style\/visibility$/,
      /^ports\/.*\/attrs\/.*$/,
      /^attrs\/circle\/style\/visibility$/
    ],
    
    // Highlighting and selection
    highlighting: [
      'body/stroke', 'body/strokeWidth', 'line/stroke',
      'attrs/body/stroke', 'attrs/line/stroke'
    ]
  };

  constructor(
    private x6HistoryManager: X6HistoryManager,
    private loggerService: LoggerService
  ) {}

  /**
   * Execute a batched operation with consistent history filtering
   */
  executeAtomicOperation<T>(
    graph: Graph,
    operationName: string,
    operation: () => T,
    options: HistoryOperationOptions = {}
  ): T {
    const { 
      includeVisualEffects = false,
      includeHighlighting = false,
      includePortVisibility = false,
      customFilters = []
    } = options;

    // Configure filters for this operation
    this.configureFilters(graph, {
      visualEffects: !includeVisualEffects,
      highlighting: !includeHighlighting,
      portVisibility: !includePortVisibility,
      custom: customFilters
    });

    // Execute in atomic batch
    return graph.batchUpdate(() => {
      this.loggerService.debug(`Executing atomic operation: ${operationName}`);
      return operation();
    });
  }

  /**
   * Execute visual effects outside of history
   */
  executeVisualEffect(
    graph: Graph,
    effectName: string,
    effect: () => void
  ): void {
    this.x6HistoryManager.disable();
    try {
      this.loggerService.debug(`Executing visual effect: ${effectName}`);
      effect();
    } finally {
      this.x6HistoryManager.enable();
    }
  }

  /**
   * Configure history filters dynamically
   */
  private configureFilters(
    graph: Graph,
    filters: {
      visualEffects: boolean;
      highlighting: boolean;
      portVisibility: boolean;
      custom: string[];
    }
  ): void {
    const history = graph.getPlugin('history') as History;
    if (!history) return;

    // Build combined exclusion list
    const exclusions = new Set<string>();
    const patterns: RegExp[] = [];

    if (filters.visualEffects) {
      this.historyFilters.visualEffects.forEach(f => exclusions.add(f));
    }
    
    if (filters.highlighting) {
      this.historyFilters.highlighting.forEach(f => exclusions.add(f));
    }

    if (filters.portVisibility) {
      this.historyFilters.portVisibility.forEach(p => patterns.push(p));
    }

    filters.custom.forEach(f => exclusions.add(f));

    // Apply filters to history plugin
    this.applyFiltersToHistory(history, exclusions, patterns);
  }
}

interface HistoryOperationOptions {
  includeVisualEffects?: boolean;
  includeHighlighting?: boolean;
  includePortVisibility?: boolean;
  customFilters?: string[];
}
```

### 2. Standardize All `addNode` Paths

#### **A. Update `x6-graph.adapter.ts`**
```typescript
export class X6GraphAdapter implements GraphAdapterInterface {
  constructor(
    private historyCoordinator: GraphHistoryCoordinator,
    // ... other dependencies
  ) {}

  addNode(node: DiagramNode): Node {
    return this.historyCoordinator.executeAtomicOperation(
      this.graph,
      'Add Node (Domain)',
      () => {
        // Validate and configure node
        const nodeConfig = this.buildNodeConfig(node);
        const x6Node = this.graph.addNode(nodeConfig);
        
        // Apply z-order (structural change - include in history)
        this.x6ZOrderAdapter.applyNodeCreationZIndex(this.graph, x6Node);
        
        return x6Node;
      },
      {
        includeVisualEffects: false,
        includeHighlighting: false,
        includePortVisibility: false
      }
    );
  }
}
```

#### **B. Update `dfd-node.service.ts`**
```typescript
export class DfdNodeService {
  constructor(
    private historyCoordinator: GraphHistoryCoordinator,
    private visualEffectsService: VisualEffectsService,
    // ... other dependencies
  ) {}

  private createNode(/* params */): Node {
    // Structural changes in atomic batch
    const createdNode = this.historyCoordinator.executeAtomicOperation(
      graph,
      'Create Node (User Action)',
      () => {
        const node = graph.addNode(nodeConfig);
        this.x6ZOrderAdapter.applyNodeCreationZIndex(graph, node);
        return node;
      },
      {
        includeVisualEffects: false,
        includeHighlighting: false,
        includePortVisibility: false
      }
    );

    // Visual effects outside history
    this.historyCoordinator.executeVisualEffect(
      graph,
      'Node Creation Highlight',
      () => {
        this.visualEffectsService.applyCreationHighlight(createdNode, graph);
      }
    );

    return createdNode;
  }
}
```

#### **C. Update `x6-selection.adapter.ts`**
```typescript
export class X6SelectionAdapter {
  constructor(
    private historyCoordinator: GraphHistoryCoordinator,
    // ... other dependencies
  ) {}

  groupSelected(selectedCells: Cell[]): void {
    this.historyCoordinator.executeAtomicOperation(
      this.graph,
      'Group Selected Nodes',
      () => {
        // Calculate group bounds and config
        const groupConfig = this.selectionService.calculateGroupConfig(selectedCells);
        
        // Create group node (structural change)
        const groupNode = this.graph.addNode(groupConfig);
        
        // Add selected cells to group (structural change)
        selectedCells.forEach(cell => {
          groupNode.addChild(cell);
        });
        
        return groupNode;
      },
      {
        includeVisualEffects: false,
        includeHighlighting: false,
        includePortVisibility: false
      }
    );
  }

  applyHoverEffect(cell: Cell): void {
    // Visual effects only - exclude from history entirely
    this.historyCoordinator.executeVisualEffect(
      this.graph,
      'Apply Hover Effect',
      () => {
        this.highlightingService.highlight(cell);
        this.portVisibilityService.showPorts(cell);
      }
    );
  }
}
```

### 3. Configuration and Consistency

#### **A. History Plugin Configuration**
```typescript
// Simplified - filters now managed by coordinator
const historyPlugin = new History({
  enabled: true,
  beforeAddCommand: (event, args) => {
    // Delegate to coordinator's filter logic
    return this.historyCoordinator.shouldIncludeInHistory(event, args);
  }
});
```

#### **B. Operation Categories**
```typescript
export const HISTORY_OPERATION_TYPES = {
  // Structural operations (always recorded)
  NODE_CREATION: 'node-creation',
  EDGE_CREATION: 'edge-creation', 
  NODE_DELETION: 'node-deletion',
  EDGE_DELETION: 'edge-deletion',
  NODE_POSITIONING: 'node-positioning',
  
  // Visual operations (excluded by default)
  HIGHLIGHTING: 'highlighting',
  SELECTION_EFFECTS: 'selection-effects',
  HOVER_EFFECTS: 'hover-effects',
  CREATION_ANIMATIONS: 'creation-animations',
  
  // Grouping operations (structural)
  GROUP_CREATION: 'group-creation',
  GROUP_EXPANSION: 'group-expansion'
} as const;
```

## Implementation Benefits

### ✅ **Consistency Guarantees**
- **Single source of truth** for history filtering rules
- **Atomic batching** enforced for all structural operations  
- **Visual effects isolation** consistently applied
- **Operation logging** for debugging and auditing

### ✅ **Maintainability**
- **Centralized configuration** of filter rules
- **Type-safe operation definitions** 
- **Clear separation** between structural and visual operations
- **Simplified testing** through isolated coordinator

### ✅ **Flexibility**  
- **Configurable per operation** via options
- **Easy to extend** with new filter categories
- **Custom filters** for special cases
- **Plugin-agnostic** design for future X6 versions

## Migration Strategy

### Phase 1: Create Coordinator
1. Implement `GraphHistoryCoordinator` service
2. Extract existing filter logic from History plugin
3. Add comprehensive test coverage

### Phase 2: Migrate High-Impact Paths  
1. Update `dfd-node.service.ts` (user creation)
2. Update `x6-graph.adapter.ts` (domain operations)
3. Verify consistent behavior

### Phase 3: Complete Migration
1. Update `x6-selection.adapter.ts` (grouping operations)
2. Update all other graph modification paths
3. Remove duplicate history logic from individual services

### Phase 4: Optimization
1. Performance profiling of batch operations
2. Fine-tune filter efficiency
3. Add operation analytics and monitoring

This centralized approach ensures that **all node and edge creation paths have consistent history filtering and atomic batching**, while maintaining flexibility for special cases and future requirements.