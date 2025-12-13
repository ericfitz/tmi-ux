// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { OperatorService } from './operator.service';

// Mock the environment module
vi.mock('../../../environments/environment', () => ({
  environment: {
    operatorName: 'Test Operator Inc.',
    operatorContact: 'contact@testoperator.com',
    operatorJurisdiction: 'United States',
  },
}));

import { environment } from '../../../environments/environment';

describe('OperatorService', () => {
  let service: OperatorService;

  beforeEach(() => {
    service = new OperatorService();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('getOperatorName()', () => {
    it('should return operator name from environment', () => {
      const result = service.getOperatorName();

      expect(result).toBe('Test Operator Inc.');
      expect(result).toBe(environment.operatorName);
    });
  });

  describe('getOperatorContact()', () => {
    it('should return operator contact from environment', () => {
      const result = service.getOperatorContact();

      expect(result).toBe('contact@testoperator.com');
      expect(result).toBe(environment.operatorContact);
    });
  });

  describe('getOperatorJurisdiction()', () => {
    it('should return operator jurisdiction from environment', () => {
      const result = service.getOperatorJurisdiction();

      expect(result).toBe('United States');
      expect(result).toBe(environment.operatorJurisdiction);
    });
  });

  describe('hasOperatorInfo()', () => {
    it('should return true when both name and contact are configured', () => {
      const result = service.hasOperatorInfo();

      expect(result).toBe(true);
    });

    it('should return false when operator name is empty', () => {
      // Temporarily override environment for this test
      const originalName = environment.operatorName;
      (environment as any).operatorName = '';

      const result = service.hasOperatorInfo();

      expect(result).toBe(false);

      // Restore original value
      (environment as any).operatorName = originalName;
    });

    it('should return false when operator contact is empty', () => {
      // Temporarily override environment for this test
      const originalContact = environment.operatorContact;
      (environment as any).operatorContact = '';

      const result = service.hasOperatorInfo();

      expect(result).toBe(false);

      // Restore original value
      (environment as any).operatorContact = originalContact;
    });

    it('should return false when both name and contact are empty', () => {
      // Temporarily override environment for this test
      const originalName = environment.operatorName;
      const originalContact = environment.operatorContact;
      (environment as any).operatorName = '';
      (environment as any).operatorContact = '';

      const result = service.hasOperatorInfo();

      expect(result).toBe(false);

      // Restore original values
      (environment as any).operatorName = originalName;
      (environment as any).operatorContact = originalContact;
    });

    it('should return false when operator name is null', () => {
      // Temporarily override environment for this test
      const originalName = environment.operatorName;
      (environment as any).operatorName = null;

      const result = service.hasOperatorInfo();

      expect(result).toBe(false);

      // Restore original value
      (environment as any).operatorName = originalName;
    });

    it('should return false when operator contact is undefined', () => {
      // Temporarily override environment for this test
      const originalContact = environment.operatorContact;
      (environment as any).operatorContact = undefined;

      const result = service.hasOperatorInfo();

      expect(result).toBe(false);

      // Restore original value
      (environment as any).operatorContact = originalContact;
    });
  });

  describe('Environment Integration', () => {
    it('should use values from environment configuration', () => {
      expect(service.getOperatorName()).toBe(environment.operatorName);
      expect(service.getOperatorContact()).toBe(environment.operatorContact);
      expect(service.getOperatorJurisdiction()).toBe(environment.operatorJurisdiction);
    });
  });
});
