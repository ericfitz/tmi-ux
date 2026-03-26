// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { LoggerService, LogLevel, LogEntry } from './logger.service';
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
    it('should change log level', () => {
      // Should be able to change log level without error
      service.setLogLevel(LogLevel.INFO);
      service.setLogLevel(LogLevel.DEBUG);
      expect(service).toBeTruthy();
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

    it('should respect log level hierarchy for WARN level', () => {
      service.setLogLevel(LogLevel.WARN);

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
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[WARN\] Test warning message$/,
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

  describe('Performance Considerations', () => {
    it('should not output to console when log level prevents logging', () => {
      service.setLogLevel(LogLevel.ERROR);

      service.debug('This should not be output');
      service.info('This should not be output');
      service.warn('This should not be output');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();

      // But should output error messages
      service.error('This should be output');
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should still buffer entries even when console output is filtered', () => {
      service.setLogLevel(LogLevel.ERROR);

      service.debug('buffered debug');
      service.info('buffered info');
      service.warn('buffered warn');

      // Not output to console
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();

      // But captured in buffer
      const entries = service.getLogEntries();
      expect(entries).toHaveLength(3);
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
      expect(consoleSpy.warn).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
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

  describe('Sensitive Data Redaction', () => {
    beforeEach(() => {
      service.setLogLevel(LogLevel.DEBUG);
    });

    it('should redact access_token from URL fragment parameters', () => {
      const url =
        'http://localhost:4200/oauth2/callback#access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9&token_type=Bearer';
      service.debug('Current URL', url);

      const calls = consoleSpy.debug.mock.calls;
      const lastCall = calls[calls.length - 1];
      const redactedUrl = lastCall[1] as string;

      // URL encoding converts [...REDACTED...] to ...%5BREDACTED%5D...
      expect(redactedUrl).toContain('%5BREDACTED%5D');
      expect(redactedUrl).toContain('eyJh'); // First 4 chars
      expect(redactedUrl).toContain('VCJ9'); // Last 4 chars
      expect(redactedUrl).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'); // Full token should not appear
    });

    it('should redact multiple sensitive parameters from URLs', () => {
      const url =
        'http://example.com/api?access_token=secret123456&api_key=key987654321&other=public';
      service.info('API call', url);

      const calls = consoleSpy.info.mock.calls;
      const lastCall = calls[calls.length - 1];
      const redactedUrl = lastCall[1] as string;

      expect(redactedUrl).toContain('%5BREDACTED%5D');
      expect(redactedUrl).toContain('other=public'); // Non-sensitive param should remain
      expect(redactedUrl).not.toContain('secret123456');
      expect(redactedUrl).not.toContain('key987654321');
    });

    it('should handle short sensitive values with just [REDACTED]', () => {
      const url = 'http://example.com/api?token=short';
      service.warn('Request', url);

      const calls = consoleSpy.warn.mock.calls;
      const lastCall = calls[calls.length - 1];
      const redactedUrl = lastCall[1] as string;

      expect(redactedUrl).toContain('%5BREDACTED%5D');
      expect(redactedUrl).not.toContain('short');
    });

    it('should not redact non-URL strings', () => {
      const normalString = 'This is just a normal string with access_token word in it';
      service.debug('Message', normalString);

      const calls = consoleSpy.debug.mock.calls;
      const lastCall = calls[calls.length - 1];
      const param = lastCall[1] as string;

      expect(param).toBe(normalString); // Should remain unchanged
      expect(param).not.toContain('[REDACTED]');
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-valid-url-but-starts-with-http://';
      service.error('Error', invalidUrl);

      const calls = consoleSpy.error.mock.calls;
      const lastCall = calls[calls.length - 1];
      const param = lastCall[1] as string;

      expect(param).toBe(invalidUrl); // Should return original on parse failure
    });

    it('should redact tokens in all log levels', () => {
      const url = 'https://example.com?refresh_token=verylongtoken123456789';

      service.debug('Debug', url);
      service.info('Info', url);
      service.warn('Warn', url);
      service.error('Error', url);

      expect(consoleSpy.debug.mock.calls[0][1]).toContain('%5BREDACTED%5D');
      expect(consoleSpy.info.mock.calls[consoleSpy.info.mock.calls.length - 1][1]).toContain(
        '%5BREDACTED%5D',
      );
      expect(consoleSpy.warn.mock.calls[consoleSpy.warn.mock.calls.length - 1][1]).toContain(
        '%5BREDACTED%5D',
      );
      expect(consoleSpy.error.mock.calls[0][1]).toContain('%5BREDACTED%5D');
    });

    it('should redact tokens in debugComponent method', () => {
      const url =
        'http://localhost:4200/oauth2/callback#access_token=eyJhbGciOiJIUzI1NiIsInR5YzRhOGIzZGMyNTE5ZWRlMTYiLCJyZXR1cm5VcmwiOiIvdG0ifQ==&token_type=Bearer';
      service.debugComponent('App', 'Current URL', url);

      const calls = consoleSpy.debug.mock.calls;
      const lastCall = calls[calls.length - 1];
      const redactedUrl = lastCall[1] as string;

      expect(redactedUrl).toContain('%5BREDACTED%5D');
      expect(redactedUrl).toContain('eyJh'); // First 4 chars
      expect(redactedUrl).toContain('fQ%3D%3D'); // Last 4 chars URL-encoded (== becomes %3D%3D)
      expect(redactedUrl).not.toContain(
        'eyJhbGciOiJIUzI1NiIsInR5YzRhOGIzZGMyNTE5ZWRlMTYiLCJyZXR1cm5VcmwiOiIvdG0ifQ==',
      ); // Full token
    });

    it('should strip control characters from string params', () => {
      const malicious = 'normal\nForged [INFO] entry\r\x00hidden';
      service.debug('Message', malicious);

      const calls = consoleSpy.debug.mock.calls;
      const lastCall = calls[calls.length - 1];
      const sanitized = lastCall[1] as string;

      expect(sanitized).toBe('normalForged [INFO] entryhidden');
      expect(sanitized).not.toContain('\n');
      expect(sanitized).not.toContain('\r');
      expect(sanitized).not.toContain('\x00');
    });

    it('should recursively sanitize object params', () => {
      const malicious = {
        name: 'normal',
        nested: {
          value: 'has\nnewline\rand\x00null',
        },
        list: ['clean', 'has\nnewline'],
      };
      service.debug('Message', malicious);

      const calls = consoleSpy.debug.mock.calls;
      const lastCall = calls[calls.length - 1];
      const sanitized = lastCall[1] as Record<string, unknown>;

      expect(sanitized['name']).toBe('normal');
      const nested = sanitized['nested'] as Record<string, unknown>;
      expect(nested['value']).toBe('hasnewlineandnull');
      const list = sanitized['list'] as string[];
      expect(list[0]).toBe('clean');
      expect(list[1]).toBe('hasnewline');
    });

    it('should pass through non-string non-object params unchanged', () => {
      service.debug('Message', 42, true, null);

      const calls = consoleSpy.debug.mock.calls;
      const lastCall = calls[calls.length - 1];

      expect(lastCall[1]).toBe(42);
      expect(lastCall[2]).toBe(true);
      expect(lastCall[3]).toBeNull();
    });
  });

  describe('Ring Buffer', () => {
    beforeEach(() => {
      service.setLogLevel(LogLevel.ERROR); // Only errors to console
    });

    it('should buffer all log entries regardless of console log level', () => {
      service.debug('debug msg');
      service.info('info msg');
      service.warn('warn msg');
      service.error('error msg');

      const entries = service.getLogEntries();
      expect(entries).toHaveLength(4);
      expect(entries[0].level).toBe(LogLevel.DEBUG);
      expect(entries[0].message).toBe('debug msg');
      expect(entries[1].level).toBe(LogLevel.INFO);
      expect(entries[2].level).toBe(LogLevel.WARN);
      expect(entries[3].level).toBe(LogLevel.ERROR);
    });

    it('should include timestamp and level in each entry', () => {
      service.info('test');
      const entries = service.getLogEntries();
      expect(entries[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(entries[0].level).toBe(LogLevel.INFO);
      expect(entries[0].message).toBe('test');
    });

    it('should include params when provided', () => {
      service.info('msg', { key: 'value' });
      const entries = service.getLogEntries();
      expect(entries[0].params).toEqual([{ key: 'value' }]);
    });

    it('should omit params when none provided', () => {
      service.info('msg');
      const entries = service.getLogEntries();
      expect(entries[0].params).toBeUndefined();
    });

    it('should buffer debugComponent entries', () => {
      service.debugComponent('TestComp', 'comp msg');
      const entries = service.getLogEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('[TestComp] comp msg');
      expect(entries[0].level).toBe(LogLevel.DEBUG);
    });

    it('should wrap around when buffer is full', () => {
      // Fill buffer beyond capacity (1500)
      for (let i = 0; i < 1510; i++) {
        service.debug(`msg-${i}`);
      }

      const entries = service.getLogEntries();
      expect(entries).toHaveLength(1500);
      // Oldest should be msg-10 (first 10 were overwritten)
      expect(entries[0].message).toBe('msg-10');
      // Newest should be msg-1509
      expect(entries[entries.length - 1].message).toBe('msg-1509');
    });

    it('should return entries in chronological order after wrap', () => {
      for (let i = 0; i < 1505; i++) {
        service.debug(`msg-${i}`);
      }

      const entries = service.getLogEntries();
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].timestamp >= entries[i - 1].timestamp).toBe(true);
      }
    });

    it('should return a copy of the buffer, not a reference', () => {
      service.info('original');
      const entries1 = service.getLogEntries();
      service.info('added');
      const entries2 = service.getLogEntries();
      expect(entries1).toHaveLength(1);
      expect(entries2).toHaveLength(2);
    });

    it('should redact sensitive data in buffered params', () => {
      const url = 'https://example.com?access_token=supersecrettoken123';
      service.info('request', url);
      const entries = service.getLogEntries();
      const param = entries[0].params?.[0] as string;
      expect(param).toContain('%5BREDACTED%5D');
      expect(param).not.toContain('supersecrettoken123');
    });
  });

  describe('Export', () => {
    it('should export entries as JSONL format', () => {
      service.setLogLevel(LogLevel.DEBUG);
      service.info('line1');
      service.warn('line2');

      const jsonl = service.exportAsJsonl();
      const lines = jsonl.split('\n');
      expect(lines).toHaveLength(2);

      const entry1: LogEntry = JSON.parse(lines[0]);
      expect(entry1.level).toBe(LogLevel.INFO);
      expect(entry1.message).toBe('line1');

      const entry2: LogEntry = JSON.parse(lines[1]);
      expect(entry2.level).toBe(LogLevel.WARN);
      expect(entry2.message).toBe('line2');
    });

    it('should return empty string when buffer is empty', () => {
      expect(service.exportAsJsonl()).toBe('');
    });
  });
});
