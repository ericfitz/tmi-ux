# Naming Conventions Guide

This document outlines the file naming conventions for the TMI-UX project.

## File Naming Standards

### Components
- **Pattern**: `*.component.ts`
- **Example**: `user-preferences-dialog.component.ts`
- **Usage**: All Angular components

### Services
- **Pattern**: `*.service.ts`
- **Example**: `threat-model.service.ts`
- **Usage**: All @Injectable() classes that provide business logic

### Guards
- **Pattern**: `*.guard.ts`
- **Example**: `auth.guard.ts`
- **Usage**: All route guards

### Interceptors
- **Pattern**: `*.interceptor.ts`
- **Example**: `jwt.interceptor.ts`
- **Usage**: All HTTP interceptors

### Resolvers
- **Pattern**: `*.resolver.ts`
- **Example**: `threat-model.resolver.ts`
- **Usage**: All route resolvers

### Models/Interfaces
- **Pattern**: `*.model.ts` or `*.interface.ts`
- **Example**: `threat-model.model.ts`, `user.interface.ts`
- **Usage**: Data models and interface definitions

### Types
- **Pattern**: `*.types.ts`
- **Example**: `websocket.types.ts`
- **Usage**: Type definitions and type aliases

### Constants
- **Pattern**: `*.constants.ts`
- **Example**: `tool-configurations.constants.ts`
- **Usage**: Constant values and configuration objects

### Utilities
- **Pattern**: `*.util.ts` or `*.utils.ts`
- **Example**: `x6-cell-extensions.util.ts`
- **Usage**: Utility functions and helper methods

### Validators
- **Pattern**: `*.validator.ts`
- **Example**: `threat-model-validator.service.ts`
- **Usage**: Validation logic (can be services if @Injectable)

### Tests
- **Pattern**: `*.spec.ts`
- **Example**: `auth.service.spec.ts`
- **Usage**: Unit tests

### Routes
- **Pattern**: `*.routes.ts`
- **Example**: `tm.routes.ts`
- **Usage**: Route configuration files

### State
- **Pattern**: `*.state.ts`
- **Example**: `dfd.state.ts`
- **Usage**: State management files

### Events
- **Pattern**: `*.event.ts` or `*.events.ts`
- **Example**: `domain.event.ts`
- **Usage**: Event definitions

### Barrel Exports
- **Pattern**: `index.ts`
- **Example**: `src/app/shared/index.ts`
- **Usage**: Re-exporting multiple items from a directory

## Directory Structure

```
src/app/
├── core/                    # Core functionality
│   ├── services/           # Core services
│   ├── guards/            # Authentication guards
│   ├── interceptors/      # HTTP interceptors
│   └── utils/             # Core utilities
├── shared/                 # Shared resources
│   ├── interfaces/        # Shared interfaces
│   ├── constants/         # Shared constants
│   └── utils/             # Shared utilities
├── pages/                  # Feature modules
│   └── [feature]/
│       ├── components/    # Feature components
│       ├── services/      # Feature services
│       ├── models/        # Feature models
│       └── utils/         # Feature utilities
└── types/                  # Global type definitions
```

## Naming Rules

1. **Use kebab-case** for file names
   - ✅ `threat-model.service.ts`
   - ❌ `ThreatModelService.ts`
   - ❌ `threat_model_service.ts`

2. **Be descriptive** in naming
   - ✅ `threat-model-authorization.service.ts`
   - ❌ `tm-auth.service.ts`

3. **Group related files** by feature
   - Keep related components, services, and models together
   - Use barrel exports (index.ts) for clean imports

4. **Match class names** to file names
   - File: `threat-model.service.ts`
   - Class: `ThreatModelService`

## Migration Notes

When renaming files:
1. Update all imports in the codebase
2. Update any barrel exports (index.ts files)
3. Check for impacts on tests
4. Run build and tests to verify