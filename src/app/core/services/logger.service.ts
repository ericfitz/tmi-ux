/**
 * Logging Service
 *
 * This service provides centralized logging functionality for the entire application.
 * It supports configurable log levels and component-specific debug logging.
 *
 * Key functionality:
 * - Provides standardized logging with ISO8601 timestamps
 * - Supports configurable log levels (DEBUG, INFO, WARN, ERROR)
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
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Map of log levels to their priority
 * Higher number means higher priority
 */
const LOG_LEVEL_PRIORITY = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * Maximum number of log entries to retain in the ring buffer
 */
const LOG_BUFFER_SIZE = 1500;

/**
 * URL query parameters that should be redacted in logs
 */
const SENSITIVE_URL_PARAMS = ['access_token', 'token', 'refresh_token', 'api_key', 'apikey'];

/**
 * Number of characters to show at start and end of redacted values
 */
const REDACTION_VISIBLE_CHARS = 4;

/**
 * Structured log entry stored in the ring buffer
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  params?: unknown[];
}

/**
 * A service for standardized application logging
 * Logs are formatted with ISO8601 timestamps and configurable log levels.
 * All log calls (regardless of console log level) are captured in a ring buffer
 * for export and bug reporting.
 */
@Injectable({
  providedIn: 'root',
})
export class LoggerService {
  // Private members
  private logLevel: LogLevel;
  private debugComponents: Set<string>;
  private buffer: LogEntry[] = [];
  private bufferIndex = 0;
  private bufferWrapped = false;

  constructor() {
    // Get log level from environment, default to ERROR if not set
    this.logLevel = (environment.logLevel as LogLevel) || LogLevel.ERROR;

    // Initialize component-specific debug logging
    this.debugComponents = new Set(environment.debugComponents || []);

    // this.info(`Logger initialized with level: ${this.logLevel}`);
  }

  /**
   * Set the current log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    // this.info(`Log level changed to: ${level}`);
  }

  // Public logging methods

  /**
   * Log a debug message
   */
  debug(message: string, ...optionalParams: unknown[]): void {
    const redactedParams = optionalParams.map(p => this.redactSensitiveData(p));
    this.bufferEntry(LogLevel.DEBUG, message, redactedParams);
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message), ...redactedParams);
    }
  }

  /**
   * Log a component-specific debug message
   * This will log at debug level if the component is in the debugComponents list,
   * regardless of the global log level
   */
  debugComponent(component: string, message: string, ...optionalParams: unknown[]): void {
    const sanitizedComponent = this.sanitizeForLog(component);
    const sanitizedMessage = this.sanitizeForLog(message);
    const redactedParams = optionalParams.map(p => this.redactSensitiveData(p));
    const formattedMessage = `[${sanitizedComponent}] ${sanitizedMessage}`;
    this.bufferEntry(LogLevel.DEBUG, formattedMessage, redactedParams);
    if (this.shouldLogComponent(component, LogLevel.DEBUG)) {
      // Explicit sanitizeForLog() barrier for CodeQL js/log-injection: redactSensitiveData()
      // already strips control characters, but CodeQL cannot trace through the recursive function.
      // Only debugComponent needs this because it receives external (WebSocket) tainted data;
      // the other log methods receive developer-authored string literals.
      const safeParams = redactedParams.map(p =>
        typeof p === 'string' ? this.sanitizeForLog(p) : p,
      );
      console.debug(this.formatMessage(LogLevel.DEBUG, formattedMessage), ...safeParams);
    }
  }

  /**
   * Log an info message
   */
  info(message: string, ...optionalParams: unknown[]): void {
    const redactedParams = optionalParams.map(p => this.redactSensitiveData(p));
    this.bufferEntry(LogLevel.INFO, message, redactedParams);
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message), ...redactedParams);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...optionalParams: unknown[]): void {
    const redactedParams = optionalParams.map(p => this.redactSensitiveData(p));
    this.bufferEntry(LogLevel.WARN, message, redactedParams);
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message), ...redactedParams);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, ...optionalParams: unknown[]): void {
    const redactedParams = optionalParams.map(p => this.redactSensitiveData(p));
    this.bufferEntry(LogLevel.ERROR, message, redactedParams);
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message), ...redactedParams);
    }
  }

  /**
   * Returns a copy of the buffered log entries in chronological order
   */
  getLogEntries(): LogEntry[] {
    if (this.bufferWrapped) {
      return [...this.buffer.slice(this.bufferIndex), ...this.buffer.slice(0, this.bufferIndex)];
    }
    return this.buffer.slice(0, this.bufferIndex);
  }

  /**
   * Exports all buffered log entries as a JSONL string (one JSON object per line).
   *
   * When `maxChars` is provided, the output is truncated to fit within that
   * character budget while preserving log-record boundaries (no record is
   * partially serialized). The most recent records are kept; older records are
   * dropped from the front. If no records fit, an empty string is returned.
   */
  exportAsJsonl(maxChars?: number): string {
    const lines = this.getLogEntries().map(entry => JSON.stringify(entry));

    if (maxChars === undefined || maxChars < 0) {
      return lines.join('\n');
    }

    let total = 0;
    const kept: string[] = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const addition = kept.length === 0 ? line.length : line.length + 1;
      if (total + addition > maxChars) {
        break;
      }
      kept.unshift(line);
      total += addition;
    }
    return kept.join('\n');
  }

  /**
   * Downloads the buffered log entries as a JSONL file
   */
  downloadLog(): void {
    const jsonl = this.exportAsJsonl();
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `tmi-log-${timestamp}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Appends a log entry to the ring buffer.
   * Always captures regardless of current console log level.
   */
  private bufferEntry(level: LogLevel, message: string, params: unknown[]): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };
    if (params.length > 0) {
      entry.params = params;
    }
    if (this.buffer.length < LOG_BUFFER_SIZE) {
      this.buffer.push(entry);
    } else {
      this.buffer[this.bufferIndex] = entry;
      this.bufferWrapped = true;
    }
    this.bufferIndex = (this.bufferIndex + 1) % LOG_BUFFER_SIZE;
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

  /**
   * Sanitize a string to prevent log injection attacks
   * Removes control characters that could be used to forge log entries
   */
  private sanitizeForLog(input: string): string {
    // Remove ASCII control characters (0x00-0x1F and 0x7F) to prevent log injection
    // eslint-disable-next-line no-control-regex
    return input.replace(/[\u0000-\u001F\u007F]/g, '');
  }

  /**
   * Redact sensitive URL parameters from a URL string
   * Shows first and last few characters of sensitive values with [...REDACTED...] in between
   * Handles both query parameters (after ?) and fragment parameters (after #)
   */
  private redactUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // Helper function to redact a parameter value
      const redactValue = (value: string): string => {
        if (value.length > REDACTION_VISIBLE_CHARS * 2) {
          const start = value.substring(0, REDACTION_VISIBLE_CHARS);
          const end = value.substring(value.length - REDACTION_VISIBLE_CHARS);
          return `${start}...[REDACTED]...${end}`;
        } else {
          // If value is too short, just show [REDACTED]
          return '[REDACTED]';
        }
      };

      // Redact query parameters
      const params = urlObj.searchParams;
      SENSITIVE_URL_PARAMS.forEach(param => {
        if (params.has(param)) {
          const value = params.get(param) || '';
          params.set(param, redactValue(value));
        }
      });

      // Redact fragment parameters (OAuth tokens often appear in fragments)
      if (urlObj.hash) {
        const fragmentParams = new URLSearchParams(urlObj.hash.substring(1)); // Remove leading #
        let hasRedaction = false;

        SENSITIVE_URL_PARAMS.forEach(param => {
          if (fragmentParams.has(param)) {
            const value = fragmentParams.get(param) || '';
            fragmentParams.set(param, redactValue(value));
            hasRedaction = true;
          }
        });

        if (hasRedaction) {
          urlObj.hash = fragmentParams.toString();
        }
      }

      return urlObj.toString();
    } catch {
      // If URL parsing fails, return original string
      return url;
    }
  }

  /**
   * Redact sensitive information from parameters before logging
   */
  private redactSensitiveData(param: unknown): unknown {
    if (typeof param === 'string') {
      // eslint-disable-next-line no-control-regex
      const sanitized = param.replace(/[\u0000-\u001F\u007F]/g, '');
      if (sanitized.startsWith('http://') || sanitized.startsWith('https://')) {
        return this.redactUrl(sanitized);
      }
      return sanitized;
    }
    if (Array.isArray(param)) {
      return param.map(item => this.redactSensitiveData(item));
    }
    if (param !== null && typeof param === 'object') {
      // Use Object.create(null) to prevent prototype pollution via user-controlled keys
      const sanitized: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const [key, value] of Object.entries(param)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        const sanitizedKey = this.sanitizeForLog(key);
        sanitized[sanitizedKey] = this.redactSensitiveData(value);
      }
      return sanitized;
    }
    return param;
  }
}
