# Debug Component Names Reference

This document lists all component names used in `logger.debugComponent()` calls throughout the TMI-UX codebase. These component names can be used with the `debugComponents` array in environment configuration to enable targeted debug logging for specific components.

## Usage

To enable debug logging for specific components, add the component names to the `debugComponents` array in your environment configuration:

```typescript
export const environment = {
  // ... other config
  debugComponents: ['DfdEdge', 'X6Graph', 'Auth'], // Enable debug logging for these components
};
```

## Component Names by Category

### Application Core
- **App** - Main application component and initialization
- **api** - HTTP API request and response logging (via interceptor)
- **websocket-api** - WebSocket API request and response logging (via WebSocket adapter)
- **MockData** - Mock data service for development/testing
- **MockDataToggle** - Mock data toggle component

### Authentication & Authorization
- **Auth** - Authentication service and OAuth operations
- **AuthGuard** - Route guard for authentication checks
- **HomeGuard** - Route guard for home page redirects
- **RoleGuard** - Route guard for role-based access control
- **ReauthDialog** - Re-authentication dialog component

### Threat Modeling (TM)
- **TM** - Main threat modeling component
- **TmEdit** - Threat model editing component
- **ThreatModelService** - Threat model data service
- **ThreatEditorDialog** - Individual threat editing dialog

### Data Flow Diagrams (DFD) - Application Layer
- **DfdDiagram** - Diagram management and persistence
- **DfdEdge** - Edge creation and validation logic
- **DfdEventHandlers** - DFD component event handling
- **DfdState** - State management for DFD components
- **DfdTooltip** - Tooltip service for DFD elements

### DFD Infrastructure Services
- **DfdEdgeQuery** - Edge query and relationship operations
- **DfdEdgeService** - Infrastructure edge service operations
- **DfdNodeService** - Node service operations and lifecycle
- **DfdPortStateManager** - Port visibility and state management
- **DfdVisualEffects** - Visual effects and animations

### X6 Graph Library Integration
- **X6CoreOperations** - Low-level X6 graph operations
- **X6EventHandlers** - X6 event handling and coordination
- **X6Graph** - Main X6 graph adapter and operations
- **X6Keyboard** - X6 keyboard event handling
- **X6Tooltip** - X6 tooltip adapter and DOM manipulation

## Component Name Conventions

### Prefixes
- **App** - Application-level components
- **Auth** - Authentication and authorization related
- **Dfd** - Data Flow Diagram domain/application layer
- **TM/Tm** - Threat Modeling components
- **X6** - AntV X6 graph library integration layer
- **Mock** - Mock data and testing utilities

### Naming Patterns
- Service classes typically include "Service" in the name (e.g., `ThreatModelService`, `DfdNodeService`)
- Guards include "Guard" in the name (e.g., `AuthGuard`, `RoleGuard`)
- Dialogs include "Dialog" in the name (e.g., `ReauthDialog`, `ThreatEditorDialog`)
- X6 adapters are prefixed with "X6" to distinguish infrastructure concerns

## Debug Logging Best Practices

1. **Use specific component names** rather than generic names like "DFD" or "Component"
2. **Group related functionality** under consistent prefixes (Dfd*, X6*, etc.)
3. **Include the service/component type** in the name when helpful (Service, Dialog, Guard, etc.)
4. **Keep names concise** but descriptive enough to identify the source

## Total Component Count: 26

This list represents all components that currently use debug logging in the codebase as of the last update.