// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { OperatorService } from './operator.service';
import { BrandingConfigService } from './branding-config.service';

vi.mock('../../../environments/environment', () => ({
  environment: {
    operatorName: 'Test Operator Inc.',
    operatorContact: 'contact@testoperator.com',
    operatorJurisdiction: 'United States',
  },
}));

import { environment } from '../../../environments/environment';

function createBrandingStub(
  operator: { name?: string; contact?: string; jurisdiction?: string } | null = null,
): BrandingConfigService {
  return { serverOperator: operator } as unknown as BrandingConfigService;
}

describe('OperatorService', () => {
  let service: OperatorService;

  beforeEach(() => {
    service = new OperatorService(createBrandingStub(null));
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('Environment fallback (no server config)', () => {
    it('returns operator name from environment', () => {
      expect(service.getOperatorName()).toBe(environment.operatorName);
    });

    it('returns operator contact from environment', () => {
      expect(service.getOperatorContact()).toBe(environment.operatorContact);
    });

    it('returns operator jurisdiction from environment', () => {
      expect(service.getOperatorJurisdiction()).toBe(environment.operatorJurisdiction);
    });
  });

  describe('Server config takes precedence', () => {
    it('uses server operator name when present', () => {
      service = new OperatorService(createBrandingStub({ name: 'Server Operator' }));
      expect(service.getOperatorName()).toBe('Server Operator');
    });

    it('uses server operator contact when present', () => {
      service = new OperatorService(createBrandingStub({ contact: 'ops@server.example' }));
      expect(service.getOperatorContact()).toBe('ops@server.example');
    });

    it('uses server operator jurisdiction when present', () => {
      service = new OperatorService(createBrandingStub({ jurisdiction: 'EU' }));
      expect(service.getOperatorJurisdiction()).toBe('EU');
    });

    it('falls back to environment when server field is empty string', () => {
      service = new OperatorService(
        createBrandingStub({ name: '', contact: '', jurisdiction: '' }),
      );
      expect(service.getOperatorName()).toBe(environment.operatorName);
      expect(service.getOperatorContact()).toBe(environment.operatorContact);
      expect(service.getOperatorJurisdiction()).toBe(environment.operatorJurisdiction);
    });

    it('falls back to environment when server field is whitespace-only', () => {
      service = new OperatorService(createBrandingStub({ name: '   ' }));
      expect(service.getOperatorName()).toBe(environment.operatorName);
    });

    it('falls back to environment when server omits a field', () => {
      service = new OperatorService(createBrandingStub({ name: 'Server Operator' }));
      expect(service.getOperatorName()).toBe('Server Operator');
      expect(service.getOperatorContact()).toBe(environment.operatorContact);
      expect(service.getOperatorJurisdiction()).toBe(environment.operatorJurisdiction);
    });
  });

  describe('hasOperatorInfo()', () => {
    it('returns true when both name and contact resolve (from environment)', () => {
      expect(service.hasOperatorInfo()).toBe(true);
    });

    it('returns true when both resolve from server', () => {
      service = new OperatorService(
        createBrandingStub({ name: 'Server Operator', contact: 'ops@server.example' }),
      );
      expect(service.hasOperatorInfo()).toBe(true);
    });

    it('returns false when environment name is empty and server provides none', () => {
      const originalName = environment.operatorName;
      (environment as { operatorName: string }).operatorName = '';
      try {
        expect(service.hasOperatorInfo()).toBe(false);
      } finally {
        (environment as { operatorName: string }).operatorName = originalName;
      }
    });

    it('returns false when environment contact is empty and server provides none', () => {
      const originalContact = environment.operatorContact;
      (environment as { operatorContact: string }).operatorContact = '';
      try {
        expect(service.hasOperatorInfo()).toBe(false);
      } finally {
        (environment as { operatorContact: string }).operatorContact = originalContact;
      }
    });

    it('returns true when environment is empty but server provides values', () => {
      const originalName = environment.operatorName;
      const originalContact = environment.operatorContact;
      (environment as { operatorName: string }).operatorName = '';
      (environment as { operatorContact: string }).operatorContact = '';
      try {
        service = new OperatorService(
          createBrandingStub({ name: 'Server Operator', contact: 'ops@server.example' }),
        );
        expect(service.hasOperatorInfo()).toBe(true);
      } finally {
        (environment as { operatorName: string }).operatorName = originalName;
        (environment as { operatorContact: string }).operatorContact = originalContact;
      }
    });
  });
});
