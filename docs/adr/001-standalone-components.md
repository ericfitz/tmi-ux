# ADR-001: Adopt Angular Standalone Components

## Status
Accepted

## Date
2025-09-05

## Context
The TMI-UX application was originally built using Angular's NgModule system, with SharedModule and MaterialModule providing common imports across the application. This approach led to:
- Large bundle sizes due to inability to tree-shake unused imports
- Circular dependency issues between modules
- Complex module dependency graphs
- Difficulty in understanding component dependencies

Angular 14+ introduced standalone components as a first-class feature, allowing components to declare their dependencies directly without NgModules.

## Decision
We have decided to migrate all components in the TMI-UX application to use Angular's standalone API and eliminate all application NgModules (keeping only third-party modules like TranslocoRootModule).

## Consequences

### Positive
- **Improved Tree-shaking**: Components only bundle what they explicitly import
- **Clearer Dependencies**: Each component's dependencies are visible in its imports array
- **Simplified Mental Model**: No need to trace through module hierarchies
- **Better Code Splitting**: Lazy loading works at the component level
- **Reduced Bundle Size**: Initial measurements show potential for significant size reduction
- **Easier Testing**: Test setup is simplified without module configuration

### Negative
- **Migration Effort**: Required updating all components and their tests
- **Learning Curve**: Developers need to understand the new pattern
- **Import Duplication**: Some imports need to be repeated across components
- **IDE Support**: Some IDEs may not fully support auto-importing standalone components

### Mitigations
- Created shared import constants (`COMMON_IMPORTS`, `CORE_MATERIAL_IMPORTS`, etc.) to reduce duplication
- Added TypeScript path mapping (`@app/*`) for cleaner imports
- Updated test harness to support both standalone and non-standalone components
- Created comprehensive documentation for the new patterns

## Implementation
1. Created `src/app/shared/imports.ts` with reusable import constants
2. Migrated all components to standalone: true
3. Removed all application NgModules
4. Updated routing to use route configurations instead of routing modules
5. Updated test infrastructure to support standalone components

## References
- [Angular Standalone Components Guide](https://angular.io/guide/standalone-components)
- [RFC: Standalone Angular APIs](https://github.com/angular/angular/discussions/45554)