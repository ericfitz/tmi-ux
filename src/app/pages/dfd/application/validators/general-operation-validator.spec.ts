/**
 * Tests for GeneralOperationValidator
 *
 * Covers: operation structure validation, context validation,
 * timing constraints, and collaboration permission checks.
 */

import '@angular/compiler';

import { describe, it, expect, beforeEach } from 'vitest';

import { LoggerService } from '../../../../core/services/logger.service';
import { GeneralOperationValidator } from './general-operation-validator';
import { createTypedMockLoggerService, type MockLoggerService } from '@testing/mocks';

describe('GeneralOperationValidator', () => {
  let validator: GeneralOperationValidator;
  let loggerService: MockLoggerService;

  function baseOperation(overrides: any = {}): any {
    return {
      id: 'op-1',
      type: 'create-node',
      source: 'user-interaction',
      priority: 'normal',
      timestamp: Date.now(),
      ...overrides,
    };
  }

  function baseContext(overrides: any = {}): any {
    return {
      graph: {}, // Non-null graph
      diagramId: 'diagram-1',
      threatModelId: 'tm-1',
      userId: 'user-1',
      isCollaborating: false,
      permissions: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    loggerService = createTypedMockLoggerService();
    validator = new GeneralOperationValidator(loggerService as unknown as LoggerService);
  });

  describe('canValidate', () => {
    it('should always return true', () => {
      expect(validator.canValidate(baseOperation())).toBe(true);
      expect(validator.canValidate(baseOperation({ type: 'delete-edge' }))).toBe(true);
      expect(validator.canValidate(baseOperation({ type: 'batch-operation' }))).toBe(true);
    });
  });

  describe('validate operation structure', () => {
    it('should reject missing operation ID', () => {
      const result = validator.validate(baseOperation({ id: null }), baseContext());
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('Operation ID'))).toBe(true);
    });

    it('should reject empty-string operation ID', () => {
      const result = validator.validate(baseOperation({ id: '  ' }), baseContext());
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('non-empty string'))).toBe(true);
    });

    it('should reject missing operation type', () => {
      const result = validator.validate(baseOperation({ type: null }), baseContext());
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('Operation type'))).toBe(true);
    });

    it('should warn on stale timestamp (> 5 minutes old)', () => {
      const staleTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      const result = validator.validate(
        baseOperation({ timestamp: staleTimestamp }),
        baseContext(),
      );
      expect(result.warnings.some((w: string) => w.includes('stale'))).toBe(true);
    });

    it('should warn on future timestamp', () => {
      const futureTimestamp = Date.now() + 5000; // 5 seconds in the future
      const result = validator.validate(
        baseOperation({ timestamp: futureTimestamp }),
        baseContext(),
      );
      expect(result.warnings.some((w: string) => w.includes('future'))).toBe(true);
    });

    it('should accept valid operation structure', () => {
      const result = validator.validate(baseOperation(), baseContext());
      expect(result.valid).toBe(true);
    });
  });

  describe('validate context', () => {
    it('should reject null graph', () => {
      const result = validator.validate(baseOperation(), baseContext({ graph: null }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('graph instance'))).toBe(true);
    });

    it('should reject empty-string userId', () => {
      const result = validator.validate(baseOperation(), baseContext({ userId: '  ' }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('User ID must be a non-empty'))).toBe(
        true,
      );
    });

    it('should warn when userId is missing', () => {
      const result = validator.validate(baseOperation(), baseContext({ userId: undefined }));
      expect(result.warnings.some((w: string) => w.includes('User ID not provided'))).toBe(true);
    });

    it('should warn when diagramId is missing', () => {
      const result = validator.validate(baseOperation(), baseContext({ diagramId: undefined }));
      expect(result.warnings.some((w: string) => w.includes('Diagram ID not provided'))).toBe(true);
    });
  });

  describe('validate timing', () => {
    it('should warn on rapid consecutive operations (< 10ms gap)', () => {
      const now = Date.now();
      const result = validator.validate(
        baseOperation({ timestamp: now }),
        baseContext({ lastOperationTime: now - 5 }),
      );
      expect(result.warnings.some((w: string) => w.includes('possible duplicate'))).toBe(true);
    });

    it('should not warn when operations are sufficiently spaced', () => {
      const now = Date.now();
      const result = validator.validate(
        baseOperation({ timestamp: now }),
        baseContext({ lastOperationTime: now - 100 }),
      );
      expect(result.warnings.every((w: string) => !w.includes('possible duplicate'))).toBe(true);
    });
  });

  describe('validate collaboration', () => {
    it('should not validate collaboration constraints in solo mode', () => {
      const result = validator.validate(baseOperation(), baseContext({ isCollaborating: false }));
      expect(result.valid).toBe(true);
    });

    it('should warn when sessionId is missing in collaboration mode', () => {
      const result = validator.validate(
        baseOperation({ source: 'user-interaction' }),
        baseContext({
          isCollaborating: true,
          suppressBroadcast: false,
          sessionId: undefined,
        }),
      );
      expect(result.warnings.some((w: string) => w.includes('Session ID'))).toBe(true);
    });

    it('should reject write operations without write permission in collaboration mode', () => {
      const result = validator.validate(
        baseOperation({ type: 'create-node' }),
        baseContext({
          isCollaborating: true,
          permissions: ['read'],
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('write permission'))).toBe(true);
    });

    it('should accept write operations with write permission in collaboration mode', () => {
      const result = validator.validate(
        baseOperation({ type: 'create-node' }),
        baseContext({
          isCollaborating: true,
          permissions: ['write'],
          sessionId: 'session-1',
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('should accept load-diagram with read-only permission in collaboration mode', () => {
      const result = validator.validate(
        baseOperation({ type: 'load-diagram' }),
        baseContext({
          isCollaborating: true,
          permissions: ['read'],
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('should warn when receiving collaborative operation from same user', () => {
      const result = validator.validate(
        baseOperation({ source: 'remote-collaboration' }),
        baseContext({
          isCollaborating: true,
          userId: 'user-1',
          originUserId: 'user-1',
          permissions: ['write'],
        }),
      );
      expect(result.warnings.some((w: string) => w.includes('same user'))).toBe(true);
    });
  });
});
