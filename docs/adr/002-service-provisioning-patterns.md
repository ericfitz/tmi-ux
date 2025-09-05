# ADR-002: Service Provisioning Patterns

## Status
Accepted

## Date
2025-09-05

## Context
In Angular applications, services can be provided at different levels:
1. Root level (application-wide singleton)
2. Component level (new instance per component)
3. Route level (shared within a route tree)

The TMI-UX application had inconsistent service provisioning, with some services provided multiple times at different levels, leading to:
- Multiple instances of services that should be singletons
- State management issues
- Memory leaks from duplicate subscriptions
- Confusion about service lifecycle

## Decision
We have established clear service provisioning standards:

### 1. Application Services (Root Providers)
Services that maintain application-wide state or manage external resources:
- `providedIn: 'root'` in the @Injectable decorator
- Examples: AuthService, ApiService, WebsocketService

### 2. Feature Services (Component/Route Providers)
Services that manage feature-specific state:
- Provided in component's `providers` array
- New instance per component/route
- Examples: DfdNodeService, GraphHistoryCoordinator

### 3. Infrastructure Services (Hierarchical Providers)
Services that need to be shared within a component tree:
- Provided at the top-level feature component
- Shared by all child components
- Examples: X6GraphAdapter, X6HistoryManager

## Consequences

### Positive
- **Clear Service Boundaries**: Developers know where to provide services
- **Predictable Lifecycle**: Service instances are created and destroyed predictably
- **Better Performance**: No duplicate service instances
- **Easier Debugging**: Clear service hierarchy makes debugging easier

### Negative
- **Migration Effort**: Existing services need to be reviewed and updated
- **Learning Curve**: Developers need to understand provisioning patterns
- **Potential Bugs**: Incorrect provisioning can lead to subtle bugs

### Mitigations
- Created `docs/SERVICE_PROVISIONING_STANDARDS.md` with detailed guidelines
- Added comments in services indicating their provisioning level
- Implemented linting rules to catch common provisioning mistakes
- Regular code reviews focusing on service provisioning

## Implementation
1. Audited all services to determine correct provisioning level
2. Moved services to appropriate provisioning level
3. Removed duplicate providers from components
4. Updated documentation with clear examples
5. Added provisioning patterns to developer onboarding

## References
- [Angular Dependency Injection Guide](https://angular.io/guide/dependency-injection)
- [Angular Hierarchical Dependency Injection](https://angular.io/guide/hierarchical-dependency-injection)