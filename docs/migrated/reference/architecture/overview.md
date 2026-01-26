# TMI-UX Architecture Guide

## Overview

TMI-UX is an Angular-based web application that provides a frontend for threat modeling. The application follows clean architecture principles with clear separation of concerns and unidirectional dependency flow.

## Architecture Principles

### 1. Dependency Direction

Dependencies flow inward: Features → Core → Domain

- Core modules cannot import from feature modules
- Domain objects have no external dependencies
- Features can depend on core and domain

### 2. Layer Boundaries

```
┌─────────────────────────────────────────┐
│           Presentation Layer            │
│  (Components, Directives, Pipes)        │
├─────────────────────────────────────────┤
│           Application Layer             │
│  (Services, State Management)           │
├─────────────────────────────────────────┤
│          Infrastructure Layer           │
│   (API, WebSocket, External Libraries)  │
├─────────────────────────────────────────┤
│            Domain Layer                 │
│   (Value Objects, Domain Events)        │
└─────────────────────────────────────────┘
```

### 3. Module Organization

```
src/app/
├── auth/                 # Authentication feature
├── core/                 # Core services and utilities
│   ├── components/       # Shared UI components
│   ├── services/         # Application-wide services
│   ├── interfaces/       # Core interfaces
│   ├── interceptors/     # HTTP interceptors
│   └── utils/            # Utility functions
├── pages/                # Feature modules
│   ├── dfd/              # Data Flow Diagram feature
│   │   ├── domain/       # Pure domain objects (value objects, entities, events)
│   │   ├── application/  # Application services and use cases
│   │   ├── infrastructure/ # External integrations (X6, WebSocket)
│   │   ├── presentation/ # UI components
│   │   └── services/     # Legacy feature services
│   └── tm/               # Threat Model feature
├── shared/               # Shared resources
│   └── imports.ts        # Reusable import constants
└── types/                # TypeScript type definitions
```

## Key Architectural Decisions

### Standalone Components

All components use Angular's standalone API for better tree-shaking and clearer dependencies.

### Service Provisioning

Services follow specific provisioning patterns based on their scope and lifecycle. See [service-provisioning.md](service-provisioning.md).

### Abstraction Layer

Cross-cutting concerns use interfaces to avoid circular dependencies.

### WebSocket Architecture

Real-time features use a layered WebSocket architecture.

## Service Placement Guidelines

### Core Services (`core/services/`)

- Application-wide state management
- External API communication
- Cross-cutting concerns
- Examples: `ApiService`, `LoggerService`, `WebsocketService`

### Feature Services (`pages/*/services/`)

- Feature-specific business logic
- Feature state management
- Coordinate domain operations
- Examples: `ThreatModelService`, `AppEdgeService`

### Infrastructure Services (`*/infrastructure/`)

- External library adapters
- Third-party integrations
- Technical implementations
- Examples: `InfraX6GraphAdapter`, `TranslocoHttpLoader`

### Domain Layer (`*/domain/`)

- Pure business logic without framework dependencies
- Domain rules, validations, and business entities
- Value objects, domain events, and domain entities
- No Angular, RxJS, or third-party framework dependencies
- Examples: `EdgeInfo`, `NodeInfo`, domain events

### Application Services (`*/application/`)

- Orchestrate use cases and coordinate between layers
- Handle application-specific business workflows
- Depend on domain objects and infrastructure services
- Use Angular DI and reactive patterns
- Examples: `AppEdgeService`, `AppStateService`, `AppDfdFacade`

## Best Practices

### 1. Component Design

- Use OnPush change detection where possible
- Keep components focused on presentation
- Delegate business logic to services
- Use standalone components with explicit imports

### 2. Service Design

- Single responsibility principle
- Clear public API
- Proper error handling
- Observable-based for reactive updates

### 3. State Management

- Prefer services with BehaviorSubjects for state
- Use RxJS operators for derived state
- Implement proper cleanup in ngOnDestroy
- Consider immutability for state updates

### 4. Dependency Injection

- Provide services at appropriate level
- Use interfaces for loose coupling
- Avoid circular dependencies
- Document service lifecycle

### 5. Error Handling

- Centralized error handling in interceptors
- Meaningful error messages
- Proper error recovery strategies
- User-friendly error notifications

## Common Patterns

### Feature Module Structure

```
feature/
├── components/           # UI components
├── services/             # Business logic
├── models/               # Data models
├── guards/               # Route guards
├── resolvers/            # Route resolvers
└── feature.routes.ts     # Route configuration
```

### Service Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class FeatureService {
  private state$ = new BehaviorSubject<State>(initialState);

  get state(): Observable<State> {
    return this.state$.asObservable();
  }

  updateState(changes: Partial<State>): void {
    this.state$.next({ ...this.state$.value, ...changes });
  }
}
```

### Component Pattern

```typescript
@Component({
  selector: 'app-feature',
  standalone: true,
  imports: [...COMMON_IMPORTS, SpecificModule],
  templateUrl: './feature.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.service.state
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => this.handleStateChange(state));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## Testing Strategy

### Unit Tests

- Test services in isolation
- Mock external dependencies
- Focus on business logic
- Use Vitest for fast execution

### Integration Tests

- Test feature workflows
- Use real implementations where possible
- Focus on user interactions
- Use Playwright for E2E testing

### E2E Tests

- Test critical user paths
- Minimize test brittleness
- Use page objects pattern
- Run in CI/CD pipeline

## Performance Considerations

### Bundle Size

- Use lazy loading for features
- Import only needed Material components
- Enable production optimizations
- Monitor bundle analyzer output

### Runtime Performance

- Use OnPush change detection
- Implement virtual scrolling for lists
- Debounce user inputs
- Optimize RxJS subscriptions

### Memory Management

- Unsubscribe from observables
- Clear event listeners
- Dispose of resources properly
- Monitor memory leaks

## Security Guidelines

### Authentication

- JWT-based authentication
- Automatic token refresh
- Secure token storage
- Proper session management

### Authorization

- Role-based access control
- Resource-level permissions
- Client-side guards
- Server-side validation

### Data Protection

- HTTPS for all communications
- Input validation
- XSS prevention
- CSRF protection

## Development Workflow

### Code Style

- Follow Angular style guide
- Use ESLint and Prettier
- Consistent naming conventions
- Meaningful commit messages

### Code Review

- Architecture compliance
- Security considerations
- Performance impact
- Test coverage

### Documentation

- Keep documentation current
- Document architectural decisions
- Provide code examples
- Update ADRs as needed

## References

- [Angular Style Guide](https://angular.dev/style-guide)
- [RxJS Best Practices](https://www.learnrxjs.io/learn-rxjs/concepts/rxjs-primer)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)

<!--
VERIFICATION SUMMARY
Verified on: 2026-01-25
Agent: verify-migrate-doc

Verified items:
- Directory structure (src/app/auth, core, pages, shared, types): Confirmed via Glob
- ApiService: Exists in src/app/core/services/api.service.ts
- LoggerService: Exists in src/app/core/services/logger.service.ts
- WebsocketService: Exists (exported from src/app/core/services/index.ts, implemented in websocket.adapter.ts)
- ThreatModelService: Exists in src/app/pages/tm/services/threat-model.service.ts
- AppEdgeService: Exists in src/app/pages/dfd/application/services/app-edge.service.ts
- InfraX6GraphAdapter: Exists in src/app/pages/dfd/infrastructure/adapters/infra-x6-graph.adapter.ts
- TranslocoHttpLoader: Exists in src/app/i18n/transloco-loader.service.ts
- EdgeInfo: Exists in src/app/pages/dfd/domain/value-objects/edge-info.ts
- NodeInfo: Exists in src/app/pages/dfd/domain/value-objects/node-info.ts
- AppStateService: Exists in src/app/pages/dfd/application/services/app-state.service.ts
- AppDfdFacade: Exists in src/app/pages/dfd/application/facades/app-dfd.facade.ts
- COMMON_IMPORTS: Exists in src/app/shared/imports.ts
- Vitest configuration: Confirmed in vitest.config.ts
- Playwright for E2E tests: Confirmed in package.json (test:e2e script uses playwright)
- Angular Style Guide URL: Updated to https://angular.dev/style-guide (verified via WebSearch)
- RxJS Best Practices URL: Valid at https://www.learnrxjs.io/learn-rxjs/concepts/rxjs-primer (verified via WebFetch)
- Clean Architecture URL: Valid at https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html (verified via WebFetch)
- Domain-Driven Design URL: Valid at https://martinfowler.com/bliki/DomainDrivenDesign.html (verified via WebFetch)
- service-provisioning.md: Exists at docs/reference/architecture/service-provisioning.md

Corrections made:
- Removed broken ADR references (ADR-001 through ADR-004 files do not exist)
- Updated DfdNodeService to AppEdgeService (DfdNodeService does not exist)
- Updated X6GraphAdapter to InfraX6GraphAdapter (correct class name)
- Changed "Use Cypress for component testing" to "Use Playwright for E2E testing" (project uses Playwright)
- Updated Angular Style Guide URL from angular.io to angular.dev (old URL redirects)

Items needing review:
- None identified
-->
