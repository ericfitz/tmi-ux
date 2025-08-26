/**
 * Logging Service
 *
 * This service provides centralized logging functionality for the entire application.
 * It supports configurable log levels and component-specific debug logging.
 *
 * Key functionality:
 * - Provides standardized logging with ISO8601 timestamps
 * - Supports configurable log levels (DEBUG, INFO, WARNING, ERROR)
 * - Enables component-specific debug logging via environment configuration
 * - Filters logs based on environment settings for performance
 * - Provides specialized logging methods for variable initialization tracking
 * - Uses console.log methods with appropriate styling for different log levels
 * - Supports structured logging with context objects
 * - Automatically includes environment-based log level filtering
 */

import { Injectable } from '@angular/core';

import { environment } from '../../../environments/environment';

/**
 * Enum representing different log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

/**
 * Map of log levels to their priority
 * Higher number means higher priority
 */
const LOG_LEVEL_PRIORITY = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARNING]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * A service for standardized application logging
 * Logs are formatted with ISO8601 timestamps and configurable log levels
 */
@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  // Private members
  private logLevel: LogLevel;
  private debugComponents: Set<string>;

  constructor() {
    // Get log level from environment, default to ERROR if not set
    this.logLevel = (environment.logLevel as LogLevel) || LogLevel.ERROR;

    // Initialize component-specific debug logging
    this.debugComponents = new Set(environment.debugComponents || []);

    this.info(`Logger initialized with level: ${this.logLevel}`);
    if (this.debugComponents.size > 0) {
      this.info(
        `Component-specific debug logging enabled for: ${Array.from(this.debugComponents).join(', ')}`,
      );
    }
  }

  /**
   * Set the current log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(`Log level changed to: ${level}`);
  }

  // Public logging methods

  /**
   * Log a debug message
   */
  debug(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message), ...optionalParams);
    }
  }

  /**
   * Log a component-specific debug message
   * This will log at debug level if the component is in the debugComponents list,
   * regardless of the global log level
   */
  debugComponent(component: string, message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLogComponent(component, LogLevel.DEBUG)) {
      console.debug(
        this.formatMessage(LogLevel.DEBUG, `[${component}] ${message}`),
        ...optionalParams,
      );
    }
  }

  /**
   * Log an info message
   */
  info(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message), ...optionalParams);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog(LogLevel.WARNING)) {
      console.warn(this.formatMessage(LogLevel.WARNING, message), ...optionalParams);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, ...optionalParams: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message), ...optionalParams);
    }
  }

  /**
   * Determine if a message at the given level should be logged
   * based on the current log level setting
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.logLevel];
  }

  /**
   * Determine if a component-specific message should be logged
   * Component-specific debug logging overrides global log level for enabled components
   */
  private shouldLogComponent(component: string, level: LogLevel): boolean {
    // If component-specific debug is enabled for this component and level is DEBUG, always log
    if (level === LogLevel.DEBUG && this.debugComponents.has(component)) {
      return true;
    }
    // Otherwise, use normal log level check
    return this.shouldLog(level);
  }

  /**
   * Format the log message with ISO8601 timestamp and level
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} [${level}] ${message}`;
  }
}
