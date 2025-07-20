# Core Services

This directory contains application-wide services that provide core functionality.

## Logger Service

The Logger Service provides standardized logging throughout the application with support for different log levels.

### Features

- ISO8601 timestamp format for all log messages
- Four log levels: DEBUG, INFO, WARNING, ERROR
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
    // Different log levels
    logger.debug('Detailed debugging information');
    logger.info('Informational message');
    logger.warn('Warning message');
    logger.error('Error message');

    // You can also include additional data
    logger.error('Failed to load user data', error);

    // Variable initialization logging
    this.count = logger.logInit('count', 0, 'MyComponent');

    // Variable update logging
    this.count = logger.logUpdate('count', this.count + 1, 'MyComponent.increment');

    // Object initialization logging
    this.user = logger.logInit(
      'user',
      {
        id: 123,
        name: 'John Doe',
        roles: ['admin', 'user'],
      },
      'MyComponent',
    );
  }
}
```

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
  logLevel: 'WARNING', // Only show warnings and errors in test
};

// Staging environment (src/environments/environment.staging.ts)
export const environment = {
  // ...
  logLevel: 'WARNING', // Only show warnings and errors in staging
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
3. **WARNING** - Potential issues that aren't yet errors
4. **ERROR** - Error conditions that should be addressed

Each level includes all higher-priority levels. For example, setting the level to WARNING will show both WARNING and ERROR messages, but not INFO or DEBUG.

### Runtime Configuration

You can change the log level at runtime:

```typescript
import { LogLevel, LoggerService } from '../../core/services/logger.service';

// ...
logger.setLogLevel(LogLevel.DEBUG); // Temporarily enable verbose logging
```

### Variable Logging

The logger provides special methods to log variable initialization and updates at the DEBUG level:

```typescript
// Initialize a variable with logging
const count = logger.logInit('count', 0, 'MyComponent');

// Update a variable with logging
this.total = logger.logUpdate('total', this.total + count, 'MyComponent.calculate');
```

These methods are designed to be used inline with variable assignments, so they return the value being logged:

```typescript
// This logs the initialization and returns the value for assignment
this.options = logger.logInit(
  'options',
  {
    theme: 'dark',
    showNotifications: true,
    refreshInterval: 60,
  },
  'SettingsComponent',
);
```

The optional source parameter helps identify where the variable is being set, which is especially useful in larger applications with many components.

For complex objects, the logger will format the output with proper indentation and truncate it if it's too long to display.
