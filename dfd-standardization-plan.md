# DFD Editor Standardization Plan

## Overview
Standardize naming conventions and file organization across the DFD editor to create clear architectural layer separation and eliminate duplication.

## 1. Architectural Layer Naming Convention

### Layer Prefixes
- **Domain Layer**: `Domain*` (e.g., `DomainEdge`, `DomainNode`)
- **Application Layer**: `App*` (e.g., `AppDfdOrchestrator`, `AppGraphOperationManager`)
- **Infrastructure Layer**: `Infra*` (e.g., `InfraX6GraphAdapter`, `InfraEdgeService`)
- **Presentation Layer**: No prefix for components, `UI*` for UI-specific services

### Service Type Suffixes
- **Adapters**: `*.adapter.ts` (external library integrations)
- **Managers**: `*.manager.ts` (coordinate multiple services)
- **Coordinators**: `*.coordinator.ts` (orchestrate complex operations)
- **Handlers**: `*.handler.ts` (event/message handling)
- **Strategies**: `*.strategy.ts` (strategy pattern implementations)
- **Facades**: `*.facade.ts` (simplified interface to complex subsystems)

## 2. Directory Structure Reorganization

### New Structure
```
src/app/pages/dfd/
├── domain/                           # Domain layer (pure business logic)
│   ├── entities/                     # Domain entities
│   ├── value-objects/               # Value objects (existing)
│   ├── events/                      # Domain events (existing)
│   └── services/                    # Domain services
│       ├── domain-edge.service.ts
│       ├── domain-node.service.ts
│       └── domain-validation.service.ts
├── application/                      # Application layer (use cases, orchestration)
│   ├── services/                    # Application services
│   │   ├── app-dfd-orchestrator.service.ts
│   │   ├── app-graph-operation-manager.service.ts
│   │   ├── app-auto-save-manager.service.ts
│   │   └── app-persistence-coordinator.service.ts
│   ├── handlers/                    # Event handlers
│   │   ├── app-edge.handler.ts
│   │   └── app-node.handler.ts
│   └── facades/                     # Application facades
│       └── app-dfd.facade.ts
├── infrastructure/                   # Infrastructure layer (external integrations)
│   ├── adapters/                    # External library adapters
│   │   ├── infra-x6-graph.adapter.ts
│   │   ├── infra-x6-selection.adapter.ts
│   │   ├── infra-x6-history.adapter.ts
│   │   └── infra-websocket.adapter.ts
│   ├── services/                    # Infrastructure services
│   │   ├── infra-edge.service.ts
│   │   ├── infra-node.service.ts
│   │   └── infra-visual-effects.service.ts
│   └── strategies/                  # Infrastructure strategies
│       ├── infra-rest-persistence.strategy.ts
│       └── infra-websocket-persistence.strategy.ts
├── presentation/                     # Presentation layer
│   ├── components/                  # UI components
│   │   ├── dfd.component.ts
│   │   └── dialogs/
│   └── services/                    # UI-specific services
│       └── ui-tooltip.service.ts
└── shared/                          # Shared resources
    ├── constants/
    ├── types/
    ├── interfaces/
    └── utils/
```

## 3. File Reorganization and Renaming

### Remove Duplicate V2 Architecture
- **DELETE** entire `/v2` directory (30+ duplicate files)
- **CONSOLIDATE** functionality into main architecture with new naming

### Key Renames by Layer

#### Domain Layer (→ `domain/`)
- **IMPLEMENTED**: Removed all services from domain layer for architectural purity
- Domain layer now contains only pure objects: value objects, entities, events
- No framework dependencies (Angular, RxJS) in domain layer

#### Application Layer (→ `application/services/`)
- **IMPLEMENTED**: `DomainEdgeService` → `AppEdgeService` (moved and renamed)
- **IMPLEMENTED**: `DomainStateService` → `AppStateService` (moved and renamed)
- `DfdOrchestrator` → `AppDfdOrchestrator` (existing)
- `GraphOperationManager` → `AppGraphOperationManager` (existing) 
- `AutoSaveManager` → `AppAutoSaveManager` (existing)
- `PersistenceCoordinator` → `AppPersistenceCoordinator` (existing)
- `DfdInfrastructureFacade` → `AppDfdFacade` (existing)

#### Infrastructure Layer
**Adapters** (→ `infrastructure/adapters/`)
- `X6GraphAdapter` → `InfraX6GraphAdapter`
- `X6SelectionAdapter` → `InfraX6SelectionAdapter`
- `X6HistoryManager` → `InfraX6HistoryAdapter`
- `X6KeyboardHandler` → `InfraX6KeyboardAdapter`

**Services** (→ `infrastructure/services/`)
- `EdgeService` → `InfraEdgeService`
- `NodeService` → `InfraNodeService`
- `VisualEffectsService` → `InfraVisualEffectsService`
- `PortStateManagerService` → `InfraPortStateService`

**Strategies** (→ `infrastructure/strategies/`)
- `RestPersistenceStrategy` → `InfraRestPersistenceStrategy`
- `WebsocketPersistenceStrategy` → `InfraWebsocketPersistenceStrategy`

#### Presentation Layer (→ `presentation/`)
- `DfdComponent` → `DfdComponent` (no change, clear context)
- `DfdTooltipService` → `UiTooltipService`

## 4. Automated Refactoring Scripts

### Script 1: `scripts/dfd-refactor-setup.sh`
Sets up the new directory structure and identifies all files to be moved:
```bash
#!/bin/bash
# Create new directory structure
# Generate file mapping manifest
# Validate current imports before changes
```

### Script 2: `scripts/dfd-class-rename.py`
Handles class name changes across all TypeScript files:
```python
#!/usr/bin/env python3
# Maps old class names to new class names
# Finds all references in import statements, constructor injections, type annotations
# Updates class names while preserving exact whitespace/formatting
# Handles complex patterns like generic types, array types, etc.
```

### Script 3: `scripts/dfd-import-path-updater.py` 
Updates import paths after files are moved:
```python
#!/usr/bin/env python3
# Calculates relative path depth from each file to new target locations
# Updates import statements with correct "../" prefixes
# Handles both named imports and default imports
# Preserves import formatting and comments
```

### Script 4: `scripts/dfd-file-mover.sh`
Moves files to new locations using Git for proper history tracking:
```bash
#!/bin/bash
# Uses git mv for proper version control history
# Creates intermediate directories as needed
# Renames files according to new convention
# Validates moves completed successfully
```

### Script 5: `scripts/dfd-validation.py`
Validates the refactoring results:
```python
#!/usr/bin/env python3
# Checks for broken imports
# Verifies all class references updated
# Ensures no orphaned files remain
# Reports any issues found
```

## 5. Script Implementation Details

### Key Script Features
1. **Dry Run Mode**: All scripts support `--dry-run` to preview changes
2. **Path Depth Calculation**: Automatic "../" calculation based on file location
3. **Import Pattern Recognition**: Handles all TypeScript import/export patterns
4. **Safe Replacements**: Uses word boundaries and context to avoid false matches
5. **Git Integration**: Uses `git mv` to preserve file history
6. **Comprehensive Logging**: Detailed logs of all changes made to `refactor-changes.log`

### Change Logging Format
All scripts will log changes to `refactor-changes.log`:
```
[timestamp] created directory src/app/pages/dfd/domain/services/
[timestamp] moved file services/dfd-edge.service.ts to domain/services/domain-edge.service.ts
[timestamp] renamed class DfdEdgeService to DomainEdgeService in 15 files
[timestamp] updated import paths from ./services/ to ../../domain/services/ in 8 files
```

### Script Execution Order
```bash
# 1. Setup and validation
./scripts/dfd-refactor-setup.sh --dry-run

# 2. Update class names in-place (before moving files)
./scripts/dfd-class-rename.py --dry-run

# 3. Move files to new structure
./scripts/dfd-file-mover.sh --dry-run

# 4. Update import paths for new locations
./scripts/dfd-import-path-updater.py --dry-run

# 5. Validate everything worked
./scripts/dfd-validation.py

# 6. Run actual changes (remove --dry-run flags)
```

### Example Transformations Scripts Will Handle

#### Class Name Changes:
```typescript
// Before
import { DfdEdgeService } from './services/dfd-edge.service';
constructor(private dfdEdgeService: DfdEdgeService) {}

// After  
import { DomainEdgeService } from './domain/services/domain-edge.service';
constructor(private domainEdgeService: DomainEdgeService) {}
```

#### Path Depth Updates:
```typescript
// File: presentation/components/dfd.component.ts
// Before
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';

// After (new path depth from presentation/ to infrastructure/)
import { InfraX6GraphAdapter } from '../../infrastructure/adapters/infra-x6-graph.adapter';
```

## 6. Implementation Steps

### Phase 1: Script Creation and Testing
1. **Create** all 5 refactoring scripts
2. **Test** scripts on small subset of files
3. **Validate** dry-run results manually

### Phase 2: Remove Duplication 
1. **Run** `dfd-refactor-setup.sh` to analyze current state
2. **Delete** `/v2` directory after backing up any unique logic
3. **Update** any v2 references found by scripts

### Phase 3: Execute Automated Refactoring
1. **Run** `dfd-class-rename.py --dry-run` → review → execute
2. **Run** `dfd-file-mover.sh --dry-run` → review → execute  
3. **Run** `dfd-import-path-updater.py --dry-run` → review → execute
4. **Run** `dfd-validation.py` to confirm success

### Phase 4: Manual Cleanup
1. **Update** Angular path mappings for new structure
2. **Update** barrel exports (`index.ts` files)
3. **Run** linting and fix any remaining issues

### Phase 5: Validation
1. **Run** full test suite
2. **Build** application to verify compilation
3. **Manual** smoke test of DFD functionality

## 7. Risk Mitigation

### Backup Strategy
- **Current branch** will contain all changes with detailed `refactor-changes.log`
- **File manifest** of all changes made by scripts
- **Manual reversal** using logged changes if needed

### Testing Strategy  
- **Unit tests** run after each script execution
- **Integration tests** run after complete refactoring
- **Manual testing** of core DFD workflows

## Benefits
- **Zero Manual Errors**: Scripts eliminate human error in bulk renaming
- **Complete Coverage**: Scripts find ALL references, not just obvious ones  
- **Consistent Patterns**: All changes follow exact same naming/path conventions
- **Audit Trail**: Scripts log every change for review/debugging
- **Manual Reversible**: Detailed logs enable step-by-step manual reversal if needed
- **Clear Architectural Boundaries**: Each layer explicitly named and organized
- **Eliminate Duplication**: Remove 30+ duplicate files automatically
- **Improved Maintainability**: Consistent naming makes code navigation intuitive