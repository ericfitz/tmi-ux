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
│   │   ├── domain/       # Domain objects
│   │   ├── infrastructure/ # External integrations
│   │   └── services/     # Feature services
│   └── tm/               # Threat Model feature
├── shared/               # Shared resources
│   └── imports.ts        # Reusable import constants
└── types/                # TypeScript type definitions
```

## Key Architectural Decisions

### Standalone Components
All components use Angular's standalone API for better tree-shaking and clearer dependencies. See [ADR-001](adr/001-standalone-components.md).

### Service Provisioning
Services follow specific provisioning patterns based on their scope and lifecycle. See [ADR-002](adr/002-service-provisioning-patterns.md).

### Abstraction Layer
Cross-cutting concerns use interfaces to avoid circular dependencies. See [ADR-003](adr/003-abstraction-layer-pattern.md).

### WebSocket Architecture
Real-time features use a layered WebSocket architecture. See [ADR-004](adr/004-websocket-communication-patterns.md).

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
- Examples: `ThreatModelService`, `DfdNodeService`

### Infrastructure Services (`*/infrastructure/`)
- External library adapters
- Third-party integrations
- Technical implementations
- Examples: `X6GraphAdapter`, `TranslocoHttpLoader`

### Domain Services (`*/domain/`)
- Pure business logic
- Domain rules and validations
- No external dependencies
- Examples: Value objects, Domain events

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
  changeDetection: ChangeDetectionStrategy.OnPush
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
- Use Cypress for component testing

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

- [Angular Style Guide](https://angular.io/guide/styleguide)
- [RxJS Best Practices](https://www.learnrxjs.io/learn-rxjs/concepts/rxjs-primer)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)