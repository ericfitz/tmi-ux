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
    logger.debugComponent('MyComponent', 'Detailed debugging information');
    logger.info('Informational message');
    logger.warn('Warning message');
    logger.error('Error message');

    // You can also include additional data
    logger.error('Failed to load user data', error);
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

For complex objects, the logger will format the output with proper indentation and truncate it if it's too long to display.
