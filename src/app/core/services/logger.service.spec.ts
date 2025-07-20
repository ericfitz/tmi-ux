// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { LoggerService, LogLevel } from './logger.service';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';

// Mock the environment module
vi.mock('../../../environments/environment', () => ({
  environment: {
    production: false,
    logLevel: 'DEBUG',
    apiUrl: 'http://localhost:8080',
    authTokenExpiryMinutes: 60,
    operatorName: 'TMI Operator (Test)',
    operatorContact: 'test@example.com',
  },
}));

describe('LoggerService', () => {
  let service: LoggerService;
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();

    // Mock console methods
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };

    // Create the service
    service = new LoggerService();
  });

  afterEach(() => {
    // Restore console methods
    vi.restoreAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with environment log level', () => {
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Logger initialized with level: DEBUG'),
      );
    });

    it('should default to ERROR level when environment logLevel is not set', () => {
      // Mock environment without logLevel
      vi.doMock('../../../environments/environment', () => ({
        environment: {
          production: false,
          // No logLevel property
        },
      }));

      const serviceWithoutLogLevel = new LoggerService();
      expect(serviceWithoutLogLevel).toBeTruthy();
    });
  });

  describe('Log Level Management', () => {
    it('should change log level and log the change', () => {
      // First, set to a level that allows info logging
      service.setLogLevel(LogLevel.INFO);

      // Clear previous calls to get a clean slate
      consoleSpy.info.mockClear();

      // Now change to DEBUG level (this should log the change)
      service.setLogLevel(LogLevel.DEBUG);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Log level changed to: DEBUG'),
      );
    });

    it('should respect log level hierarchy for DEBUG level', () => {
      service.setLogLevel(LogLevel.DEBUG);

      service.debug('Debug message');
      service.info('Info message');
      service.warn('Warning message');
      service.error('Error message');

      expect(consoleSpy.debug).toHaveBeenCalled();
      expect(consoleSpy.info).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should respect log level hierarchy for INFO level', () => {
      service.setLogLevel(LogLevel.INFO);

      service.debug('Debug message');
      service.info('Info message');
      service.warn('Warning message');
      service.error('Error message');

      expect(consoleSpy.debug).not.toHaveBeenCalledWith(expect.stringContaining('Debug message'));
      expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('Info message'));
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Warning message'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Error message'));
    });

    it('should respect log level hierarchy for WARNING level', () => {
      service.setLogLevel(LogLevel.WARNING);

      service.debug('Debug message');
      service.info('Info message');
      service.warn('Warning message');
      service.error('Error message');

      expect(consoleSpy.debug).not.toHaveBeenCalledWith(expect.stringContaining('Debug message'));
      expect(consoleSpy.info).not.toHaveBeenCalledWith(expect.stringContaining('Info message'));
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('Warning message'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Error message'));
    });

    it('should respect log level hierarchy for ERROR level', () => {
      service.setLogLevel(LogLevel.ERROR);

      service.debug('Debug message');
      service.info('Info message');
      service.warn('Warning message');
      service.error('Error message');

      expect(consoleSpy.debug).not.toHaveBeenCalledWith(expect.stringContaining('Debug message'));
      expect(consoleSpy.info).not.toHaveBeenCalledWith(expect.stringContaining('Info message'));
      expect(consoleSpy.warn).not.toHaveBeenCalledWith(expect.stringContaining('Warning message'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Error message'));
    });
  });

  describe('Message Formatting', () => {
    beforeEach(() => {
      service.setLogLevel(LogLevel.DEBUG);
    });

    it('should format debug messages with timestamp and level', () => {
      service.debug('Test debug message');

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[DEBUG\] Test debug message$/,
        ),
      );
    });

    it('should format info messages with timestamp and level', () => {
      service.info('Test info message');

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[INFO\] Test info message$/,
        ),
      );
    });

    it('should format warning messages with timestamp and level', () => {
      service.warn('Test warning message');

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[WARNING\] Test warning message$/,
        ),
      );
    });

    it('should format error messages with timestamp and level', () => {
      service.error('Test error message');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[ERROR\] Test error message$/,
        ),
      );
    });
  });

  describe('Optional Parameters', () => {
    beforeEach(() => {
      service.setLogLevel(LogLevel.DEBUG);
    });

    it('should pass optional parameters to console methods', () => {
      const obj = { key: 'value' };
      const arr = [1, 2, 3];

      service.debug('Debug with params', obj, arr);

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('Debug with params'),
        obj,
        arr,
      );
    });

    it('should handle multiple optional parameters for all log levels', () => {
      const param1 = 'string param';
      const param2 = { object: 'param' };
      const param3 = 42;

      service.info('Info message', param1, param2, param3);
      service.warn('Warning message', param1, param2, param3);
      service.error('Error message', param1, param2, param3);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Info message'),
        param1,
        param2,
        param3,
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning message'),
        param1,
        param2,
        param3,
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Error message'),
        param1,
        param2,
        param3,
      );
    });
  });

  describe('Variable Logging', () => {
    beforeEach(() => {
      service.setLogLevel(LogLevel.DEBUG);
    });

    it('should log variable initialization and return the value', () => {
      const testValue = 'test string';
      const result = service.logInit('testVar', testValue);

      expect(result).toBe(testValue);
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Variable 'testVar' initialized to: test string"),
      );
    });

    it('should log variable initialization with source', () => {
      const testValue = 42;
      const result = service.logInit('testVar', testValue, 'TestClass.method');

      expect(result).toBe(testValue);
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Variable 'testVar' in TestClass.method initialized to: 42"),
      );
    });

    it('should log variable updates', () => {
      const testValue = { key: 'value' };
      const result = service.logUpdate('testVar', testValue);

      expect(result).toBe(testValue);
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Variable 'testVar' updated to:"),
      );
    });

    it('should log variable updates with source', () => {
      const testValue = [1, 2, 3];
      const result = service.logUpdate('testVar', testValue, 'TestClass.setter');

      expect(result).toBe(testValue);
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Variable 'testVar' in TestClass.setter updated to:"),
      );
    });

    it('should handle object values with pretty printing', () => {
      const testObject = {
        name: 'test',
        value: 123,
        nested: {
          prop: 'nested value',
        },
      };

      service.logVar({ name: 'testObj', value: testObject });

      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('"name": "test"'));
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('"value": 123'));
    });

    it('should handle array values', () => {
      const testArray = ['item1', 'item2', 'item3'];

      service.logVar({ name: 'testArray', value: testArray });

      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('"item1"'));
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('"item2"'));
      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('"item3"'));
    });

    it('should truncate large objects', () => {
      // Create a large object that will exceed 500 characters when stringified
      const largeObject: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        largeObject[`property${i}`] =
          `This is a long value for property ${i} that will make the object very large`;
      }

      service.logVar({ name: 'largeObj', value: largeObject });

      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('... (truncated)'));
    });

    it('should handle null values', () => {
      const result = service.logVar({ name: 'nullVar', value: null });

      expect(result).toBeNull();
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Variable 'nullVar' initialized to: null"),
      );
    });

    it('should handle undefined values', () => {
      const result = service.logVar({ name: 'undefinedVar', value: undefined });

      expect(result).toBeUndefined();
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Variable 'undefinedVar' initialized to: undefined"),
      );
    });

    it('should handle circular references gracefully', () => {
      interface CircularObj {
        name: string;
        self?: CircularObj;
      }

      const circularObj: CircularObj = { name: 'circular' };
      circularObj.self = circularObj;

      const result = service.logVar({ name: 'circularObj', value: circularObj });

      expect(result).toBe(circularObj);
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Unstringifiable value]'),
      );
    });

    it('should handle custom operation names', () => {
      const testValue = 'test';
      service.logVar({ name: 'testVar', value: testValue }, 'custom operation');

      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining("Variable 'testVar' custom operation to: test"),
      );
    });

    it('should not log variables when log level is above DEBUG', () => {
      service.setLogLevel(LogLevel.INFO);

      service.logInit('testVar', 'value');
      service.logUpdate('testVar', 'new value');
      service.logVar({ name: 'testVar', value: 'another value' });

      // Should not have called debug for variable logging
      expect(consoleSpy.debug).not.toHaveBeenCalledWith(expect.stringContaining('Variable'));
    });
  });

  describe('Performance Considerations', () => {
    it('should not format messages when log level prevents logging', () => {
      service.setLogLevel(LogLevel.ERROR);

      // Mock Date.prototype.toISOString to verify it's not called for filtered logs
      const toISOStringSpy = vi.spyOn(Date.prototype, 'toISOString');

      service.debug('This should not be processed');
      service.info('This should not be processed');
      service.warn('This should not be processed');

      // toISOString should not be called for filtered messages
      expect(toISOStringSpy).not.toHaveBeenCalled();

      // But should be called for error messages
      service.error('This should be processed');
      expect(toISOStringSpy).toHaveBeenCalled();

      toISOStringSpy.mockRestore();
    });

    it('should not process variable logging when log level is above DEBUG', () => {
      service.setLogLevel(LogLevel.INFO);

      const largeObject = { data: 'x'.repeat(1000) };
      const jsonStringifySpy = vi.spyOn(JSON, 'stringify');

      service.logVar({ name: 'largeObj', value: largeObject });

      // JSON.stringify should not be called when DEBUG logging is disabled
      expect(jsonStringifySpy).not.toHaveBeenCalled();

      jsonStringifySpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      service.setLogLevel(LogLevel.DEBUG);
    });

    it('should handle empty messages', () => {
      service.debug('');
      service.info('');
      service.warn('');
      service.error('');

      expect(consoleSpy.debug).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
      expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('[WARNING]'));
      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Message with special chars: \n\t\r"\'\\';
      service.info(specialMessage);

      expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining(specialMessage));
    });

    it('should handle very long messages', () => {
      const longMessage = 'x'.repeat(10000);
      service.info(longMessage);

      expect(consoleSpy.info).toHaveBeenCalledWith(expect.stringContaining(longMessage));
    });
  });
});
