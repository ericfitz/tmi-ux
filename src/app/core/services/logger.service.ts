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
 * Interface for variable initialization tracking
 */
export interface VarInit<T> {
  name: string;
  value: T;
  source?: string;
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

  constructor() {
    // Get log level from environment, default to ERROR if not set
    this.logLevel = (environment.logLevel as LogLevel) || LogLevel.ERROR;
    this.info(`Logger initialized with level: ${this.logLevel}`);
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
   * Log initialization of a variable
   * @param name Variable name
   * @param value Variable value
   * @param source Optional source (class/method/file)
   * @returns The original value for easy chaining
   */
  logInit<T>(name: string, value: T, source?: string): T {
    return this.logVar({ name, value, source }, 'initialized');
  }

  /**
   * Log update of a variable's value
   * @param name Variable name
   * @param value New variable value
   * @param source Optional source (class/method/file)
   * @returns The original value for easy chaining
   */
  logUpdate<T>(name: string, value: T, source?: string): T {
    return this.logVar({ name, value, source }, 'updated');
  }

  /**
   * Log variable initialization or value change
   * @param varInfo Object containing variable name, value, and optional source
   * @param operation The operation being performed (initialize, update, etc.)
   * @returns The original value for easy chaining
   */
  logVar<T>(varInfo: VarInit<T>, operation = 'initialized'): T {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const source = varInfo.source ? ` in ${varInfo.source}` : '';
      let valueStr = '';

      try {
        // For objects and arrays, stringify with pretty printing (2 spaces)
        if (typeof varInfo.value === 'object' && varInfo.value !== null) {
          valueStr = JSON.stringify(varInfo.value, null, 2);
          // Truncate if too long
          if (valueStr.length > 500) {
            valueStr = valueStr.substring(0, 500) + '... (truncated)';
          }
        } else {
          valueStr = String(varInfo.value);
        }
      } catch {
        valueStr = '[Unstringifiable value]';
      }

      this.debug(`Variable '${varInfo.name}'${source} ${operation} to: ${valueStr}`);
    }
    return varInfo.value;
  }

  /**
   * Determine if a message at the given level should be logged
   * based on the current log level setting
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.logLevel];
  }

  /**
   * Format the log message with ISO8601 timestamp and level
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `${timestamp} [${level}] ${message}`;
  }
}
