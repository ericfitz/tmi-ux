# ADR-003: Abstraction Layer for Cross-Cutting Concerns

## Status
Accepted

## Date
2025-09-05

## Context
The TMI-UX application had circular dependencies between core services and feature modules:
- Core services (WebsocketService, TmiMessageHandlerService) needed to communicate with feature services
- Feature services (DfdCollaborationService) needed core functionality
- Direct dependencies created tight coupling and circular dependency issues

This violated clean architecture principles where dependencies should flow inward (features depend on core, not vice versa).

## Decision
Implement an abstraction layer using interfaces and dependency injection:

1. **Define Interfaces in Core**: Create interfaces for feature contracts in `core/interfaces/`
2. **Implement in Features**: Feature services implement these interfaces
3. **Inject via DI**: Core services depend on interfaces, not concrete implementations
4. **Register at Bootstrap**: Wire implementations at application startup

Example:
```typescript
// core/interfaces/collaboration-notification.interface.ts
export interface CollaborationNotificationHandler {
  handleNotification(notification: any): void;
}

// core/services/tmi-message-handler.service.ts
@Injectable({ providedIn: 'root' })
export class TmiMessageHandlerService {
  constructor(
    @Optional() private collaborationHandler?: CollaborationNotificationHandler
  ) {}
}

// pages/dfd/services/dfd-collaboration.service.ts
@Injectable()
export class DfdCollaborationService implements CollaborationNotificationHandler {
  handleNotification(notification: any): void {
    // Implementation
  }
}
```

## Consequences

### Positive
- **Eliminated Circular Dependencies**: Core no longer depends on features
- **Loose Coupling**: Services communicate through contracts
- **Testability**: Easy to mock interfaces for testing
- **Extensibility**: New features can implement interfaces without changing core
- **Clear Architecture**: Dependency flow is unidirectional

### Negative
- **Additional Abstraction**: One more layer of indirection
- **Learning Curve**: Developers need to understand the pattern
- **Setup Complexity**: Requires proper DI configuration

### Mitigations
- Clear documentation of the pattern with examples
- Consistent naming conventions for interfaces
- Automated tests to verify correct wiring
- Code generation templates for new features

## Implementation
1. Created `CollaborationNotificationHandler` interface
2. Updated `TmiMessageHandlerService` to use interface
3. Implemented interface in `DfdCollaborationService`
4. Configured providers in feature components
5. Added documentation and examples

## References
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
- [Angular Dependency Injection](https://angular.io/guide/dependency-injection)