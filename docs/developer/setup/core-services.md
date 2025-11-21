# Core Services

This directory contains application-wide services that provide core functionality.

## Logger Service

The Logger Service provides standardized logging throughout the application with support for different log levels.

### Features

- ISO8601 timestamp format for all log messages
- Four log levels: DEBUG, INFO, WARN, ERROR
- Environment-configurable log level threshold
- Consistent formatting across the application

### Usage

```typescript
import { LoggerService, LogLevel } from '../../core/services/logger.service';

@Component({
  // ...
})
export class MyComponent {
  constructor(private logger: LoggerService) {
    // Component-specific debug logging (preferred for DEBUG level)
    logger.debugComponent('MyComponent', 'Detailed debugging information');
    logger.debugComponent('MyComponent', 'State changed', { oldState, newState });

    // General log levels
    logger.info('Informational message');
    logger.warn('Warning message');
    logger.error('Error message');

    // You can also include additional data
    logger.error('Failed to load user data', error);
  }
}
```

### Component-Specific Debug Logging

The `debugComponent()` method allows fine-grained control over debug logging by component. This is the preferred method for all DEBUG-level logging.

**Benefits:**
- Filter debug logs by specific components during development
- Reduce noise by enabling only relevant debug output
- Better organize debug logs by application area

**Configuration:**

Enable component-specific debug logging in environment files:

```typescript
// src/environments/environment.ts
export const environment = {
  // ...
  logLevel: 'DEBUG',
  debugComponents: ['AppDiagramService', 'websocket-api', 'DfdCollaborationService'],
};
```

When `debugComponents` is defined, only debug logs from those components will be shown. When undefined or empty, all debug logs are shown (if log level permits).

### Configuration

The log level is configured through the `logLevel` property in the environment files:

```typescript
// Development environment (src/environments/environment.ts)
export const environment = {
  // ...
  logLevel: 'DEBUG', // Show all logs in development
};

// Test environment (src/environments/environment.test.ts)
export const environment = {
  // ...
  logLevel: 'WARN', // Only show warnings and errors in test
};

// Staging environment (src/environments/environment.staging.ts)
export const environment = {
  // ...
  logLevel: 'WARN', // Only show warnings and errors in staging
};

// Production environment (src/environments/environment.prod.ts)
export const environment = {
  // ...
  logLevel: 'ERROR', // Only show errors in production
};
```

### Log Levels

From most to least verbose:

1. **DEBUG** - Detailed information for debugging purposes
2. **INFO** - General informational messages about system operation
3. **WARN** - Potential issues that aren't yet errors
4. **ERROR** - Error conditions that should be addressed

Each level includes all higher-priority levels. For example, setting the level to WARN will show both WARN and ERROR messages, but not INFO or DEBUG.

### Runtime Configuration

You can change the log level at runtime:

```typescript
import { LogLevel, LoggerService } from '../../core/services/logger.service';

// ...
logger.setLogLevel(LogLevel.DEBUG); // Temporarily enable verbose logging
```

For complex objects, the logger will format the output with proper indentation and truncate it if it's too long to display.

### Available Debug Components

Below is the complete list of component names used throughout the application for `debugComponent()` logging. Use these names when configuring `debugComponents` in your environment:

#### Application Layer (DFD)
- `AppDfdFacade` - Main DFD application facade
- `AppDfdOrchestrator` - DFD orchestration service
- `AppDiagramLoadingService` - Diagram loading operations
- `AppDiagramOperationBroadcaster` - Operation broadcasting for collaboration
- `AppDiagramResyncService` - Diagram resynchronization
- `AppDiagramService` - Core diagram management
- `AppEdgeService` - Edge operations
- `AppExportService` - Diagram export functionality
- `AppGraphOperationManager` - Graph operation coordination
- `AppHistoryService` - Undo/redo history management
- `AppNotificationService` - User notifications
- `AppOperationRejectionHandler` - Operation rejection handling
- `AppPersistenceCoordinator` - Persistence coordination
- `AppRemoteOperationHandler` - Remote operation handling
- `AppStateService` - Application state management

#### Executors (DFD)
- `BaseOperationExecutor` - Base operation execution
- `BatchOperationExecutor` - Batch operation execution
- `EdgeOperationExecutor` - Edge-specific operations
- `LoadDiagramExecutor` - Diagram loading execution
- `NodeOperationExecutor` - Node-specific operations

#### Validators (DFD)
- `BaseOperationValidator` - Base operation validation

#### Infrastructure Layer (DFD)
- `InfraDfdWebsocketAdapter` - WebSocket adapter for DFD
- `InfraEdgeService` - Infrastructure edge service
- `InfraLocalStorageAdapter` - Local storage adapter
- `InfraNodeService` - Infrastructure node service
- `InfraRestPersistenceStrategy` - REST persistence strategy
- `InfraX6GraphAdapter` - X6 graph adapter
- `InfraX6SelectionAdapter` - X6 selection adapter
- `WebSocketPersistenceStrategy` - WebSocket persistence strategy

#### X6 Adapters (DFD)
- `X6CoreOperations` - Core X6 operations
- `X6Embedding` - X6 embedding functionality
- `X6EventHandlers` - X6 event handling
- `X6EventLogger` - X6 event logging
- `X6Graph` - X6 graph management
- `X6Keyboard` - X6 keyboard handling
- `X6Tooltip` - X6 tooltip functionality
- `ZOrderService` - Z-order management

#### Presentation Layer (DFD)
- `DfdComponent` - Main DFD component
- `DfdDiagram` - Diagram presentation
- `DfdEdge` - Edge presentation
- `DfdEdgeQuery` - Edge querying
- `DfdEventHandlers` - Event handling
- `DfdExport` - Export functionality
- `DfdPortStateManager` - Port state management
- `DfdState` - DFD state
- `DfdStateStore` - DFD state store
- `DfdTooltip` - Tooltip management
- `DfdVisualEffects` - Visual effects
- `Embedding` - Embedding functionality
- `UiPresenterCoordinator` - Presenter coordination
- `UiPresenterCursorDisplayService` - Presenter cursor display

#### Core Services
- `Api` - API service
- `api` - API interceptor/helper
- `DfdCollaborationService` - DFD collaboration service
- `MessageChunkingService` - Message chunking for WebSocket
- `SecurityConfigService` - Security configuration
- `ServerConnection` - Server connection management
- `SessionManager` - Session management
- `websocket-api` - WebSocket API adapter

#### Collaboration
- `CollaborationComponent` - Collaboration UI component
- `CollaborationDialog` - Collaboration dialog
- `CollaborationSession` - Collaboration session management
- `GraphHistoryCoordinator` - History coordination for collaboration
- `WebSocketCollaboration` - WebSocket collaboration

#### Threat Modeling
- `TM` - Threat model list component
- `TmEdit` - Threat model editor
- `TmEditComponent` - Threat model edit component
- `ThreatEditorDialog` - Threat editor dialog
- `ThreatModelAuthorizationService` - Authorization service
- `ThreatModelReportService` - Report generation
- `ThreatModelResolver` - Route resolver
- `ThreatModelService` - Threat model service
- `ThreatModelValidator` - Validation service
- `SvgCacheService` - SVG caching
- `SvgOptimizationService` - SVG optimization

#### Authentication & Authorization
- `Auth` - Authentication component
- `AuthGuard` - Authentication guard
- `HomeGuard` - Home route guard
- `RoleGuard` - Role-based access guard

#### Utilities
- `CellDataExtractionService` - Cell data extraction
- `CellRelationshipValidation` - Cell relationship validation
- `Notification` - Notification service

#### Other
- `App` - Application root
- `Dashboard` - Dashboard component
- `DFD` - General DFD logging

### Example: Debugging Collaboration Issues

To debug collaboration-related issues, configure your environment:

```typescript
export const environment = {
  // ...
  logLevel: 'DEBUG',
  debugComponents: [
    'DfdCollaborationService',
    'CollaborationSession',
    'WebSocketCollaboration',
    'websocket-api',
    'AppDiagramOperationBroadcaster',
    'AppRemoteOperationHandler',
  ],
};
```

This configuration will show only debug logs related to collaboration, filtering out noise from other components.
