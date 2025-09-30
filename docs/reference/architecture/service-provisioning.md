# Service Provisioning Standards

## Overview

This document defines the standards for providing services in the TMI-UX Angular application. Following these standards ensures consistent behavior, prevents circular dependencies, and maintains a clean architecture.

## Key Principles

### 1. Use Root-Level Provisioning for Shared Services

Services that manage application-wide state or are used across multiple components should use root-level provisioning:

```typescript
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Service implementation
}
```

**Examples of services that should be root-provided:**
- Authentication services (`AuthService`)
- API services (`ApiService`, `ThreatModelService`)
- Logging services (`LoggerService`)
- Global state management services
- WebSocket services for real-time collaboration

### 2. Use Component-Level Provisioning for Component-Specific Services

Services that are tightly coupled to a specific component's lifecycle should be provided at the component level:

```typescript
@Component({
  selector: 'app-example',
  providers: [ComponentSpecificService]
})
export class ExampleComponent {
  // Component implementation
}
```

**Examples of services that should be component-provided:**
- Graph adapters (e.g., X6 adapters in DFD component)
- Event handlers specific to a component
- History managers for undo/redo within a component
- Services that manage component-specific UI state

## Common Pitfalls to Avoid

### 1. Duplicate Provisioning

**❌ Bad:** Providing a root-level service again in a component

```typescript
// service.ts
@Injectable({
  providedIn: 'root'  // Already provided at root
})
export class SharedService {}

// component.ts
@Component({
  providers: [SharedService]  // DON'T DO THIS - creates duplicate instance
})
```

**✅ Good:** Use the root-provided instance

```typescript
// component.ts
@Component({
  // No providers array needed for root-provided services
})
export class ExampleComponent {
  constructor(private sharedService: SharedService) {}
}
```

### 2. Circular Dependencies

**❌ Bad:** Core services depending on feature services

```typescript
// In core/services/
export class CoreService {
  constructor(private featureService: FeatureService) {} // Upward dependency
}
```

**✅ Good:** Use dependency injection tokens or interfaces

```typescript
// In core/services/
export const FEATURE_HANDLER = new InjectionToken<FeatureHandler>('FeatureHandler');

export class CoreService {
  constructor(@Optional() @Inject(FEATURE_HANDLER) private handler?: FeatureHandler) {}
}
```

## Service Categories and Provisioning Guidelines

### Core Services (Always Root-Provided)
- **Location:** `src/app/core/services/`
- **Provisioning:** `providedIn: 'root'`
- **Examples:** `ApiService`, `LoggerService`, `AuthService`

### Feature Services (Context-Dependent)
- **Location:** `src/app/pages/[feature]/services/`
- **Provisioning:** 
  - `providedIn: 'root'` if shared across components
  - Component providers if component-specific

### Infrastructure Adapters (Component-Provided)
- **Location:** `src/app/pages/[feature]/infrastructure/adapters/`
- **Provisioning:** Component providers array
- **Examples:** X6 graph adapters, DOM manipulation services

### Shared UI Services (Root-Provided)
- **Location:** `src/app/shared/services/`
- **Provisioning:** `providedIn: 'root'`
- **Examples:** `NotificationService`, `DialogService`

## Migration Checklist

When reviewing or refactoring services:

1. ✅ Check if the service is already provided at root level
2. ✅ Remove duplicate provisioning from component providers arrays
3. ✅ Verify no circular dependencies exist
4. ✅ Ensure core services don't import from feature modules
5. ✅ Test that singleton behavior is preserved where expected
6. ✅ Document any exceptions to these standards with clear justification

## Testing Considerations

- Unit tests should mock dependencies appropriately
- Integration tests should verify singleton behavior
- Use `TestBed.configureTestingModule()` to override provisioning in tests when needed

## Exceptions

Some valid exceptions to these standards include:

1. **Testing isolation:** Providing a service at component level for easier testing
2. **Multiple instances required:** Rare cases where multiple service instances are needed
3. **Legacy code:** Existing patterns that are too risky to refactor immediately

All exceptions should be documented with a comment explaining the reasoning.