/**
 * Mock logger service for testing
 *
 * This provides a standardized mock of the LoggerService that can be reused
 * across all test files, eliminating duplication and ensuring consistency.
 */

import { vi } from 'vitest';
import type { LoggerService } from '../../app/core/services/logger.service';

/**
 * Creates a mock LoggerService with all required methods
 *
 * @returns A mock LoggerService with vitest mock functions
 */
// SEM@bb560366c986bbf9e3ba0bd83967d224db35ffe3: build a mock LoggerService with all logging methods as spies (pure)
export function createMockLoggerService(): LoggerService {
  return {
    info: vi.fn(),
    debug: vi.fn(),
    debugComponent: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    setLogLevel: vi.fn(),
    getLogEntries: vi.fn().mockReturnValue([]),
    exportAsJsonl: vi.fn().mockReturnValue(''),
    downloadLog: vi.fn(),
  } as unknown as LoggerService;
}

/**
 * Type-safe interface for the mock LoggerService
 * Use this type when you need to access the mock functions directly
 */
export interface MockLoggerService {
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  debugComponent: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  setLogLevel: ReturnType<typeof vi.fn>;
  getLogEntries: ReturnType<typeof vi.fn>;
  exportAsJsonl: ReturnType<typeof vi.fn>;
  downloadLog: ReturnType<typeof vi.fn>;
}

/**
 * Creates a typed mock LoggerService that allows easy access to mock functions
 *
 * @returns A typed mock LoggerService
 */
// SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: build a typed mock LoggerService exposing spy methods for test assertions (pure)
export function createTypedMockLoggerService(): MockLoggerService {
  return createMockLoggerService() as unknown as MockLoggerService;
}
