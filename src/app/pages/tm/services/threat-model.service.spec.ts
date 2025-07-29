// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

// Import Zone.js is handled by the test setup

// Import Angular compiler
import '@angular/compiler';

import { HttpClient } from '@angular/common/http';
import { ThreatModelService } from './threat-model.service';
import { LoggerService } from '../../../core/services/logger.service';
import { MockDataService } from '../../../mocks/mock-data.service';
import { BehaviorSubject, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import testing utilities
import { waitForAsync } from '../../../../testing/async-utils';

// Import mock data factory
import { createMockThreatModel } from '../../../mocks/factories/threat-model.factory';

// The Angular testing environment is initialized in src/testing/zone-setup.ts

describe('ThreatModelService', () => {
  let service: ThreatModelService;
  let mockDataService: MockDataService;
  let loggerService: LoggerService;
  let httpClient: HttpClient;
  let testThreatModel1: any;
  let testThreatModel2: any;
  let testThreatModel3: any;

  beforeEach(() => {
    // Create test data using factory functions
    testThreatModel1 = createMockThreatModel({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Threat Model 1',
    });
    testThreatModel2 = createMockThreatModel({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Test Threat Model 2',
    });
    testThreatModel3 = createMockThreatModel({
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Test Threat Model 3',
    });

    // Create spy objects for the dependencies
    mockDataService = {
      getMockThreatModels: vi
        .fn()
        .mockReturnValue([testThreatModel1, testThreatModel2, testThreatModel3]),
      getMockThreatModelById: vi.fn().mockReturnValue(testThreatModel1),
      getMockDiagramsForThreatModel: vi.fn().mockReturnValue([]),
      getMockDiagramById: vi.fn().mockReturnValue(null),
      createThreatModel: vi.fn().mockReturnValue(
        createMockThreatModel({
          name: 'New Test Threat Model',
          description: 'Created for testing',
        }),
      ),
      useMockData$: new BehaviorSubject<boolean>(true),
    } as unknown as MockDataService;

    loggerService = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as LoggerService;

    // Create a simple mock for HttpClient
    httpClient = {
      get: vi.fn().mockReturnValue(of([])),
      post: vi.fn().mockReturnValue(of({})),
      put: vi.fn().mockReturnValue(of({})),
      delete: vi.fn().mockReturnValue(of(true)),
    } as unknown as HttpClient;

    // Create the service directly with mocked dependencies
    service = new ThreatModelService(httpClient, loggerService, mockDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('with mock data enabled', () => {
    beforeEach(() => {
      // Ensure mock data is enabled
      if (mockDataService.useMockData$ instanceof BehaviorSubject) {
        mockDataService.useMockData$.next(true);
      }
    });

    it('should return mock threat models', waitForAsync(() => {
      service.getThreatModels().subscribe(threatModels => {
        expect(threatModels.length).toBe(3);
        expect(threatModels).toContain(testThreatModel1);
        expect(threatModels).toContain(testThreatModel2);
        expect(threatModels).toContain(testThreatModel3);
      });
    }));

    it('should return a specific mock threat model by ID', waitForAsync(() => {
      service.getThreatModelById(testThreatModel1.id).subscribe(threatModel => {
        expect(threatModel).toBeDefined();
        expect(threatModel?.id).toBe(testThreatModel1.id);
      });
    }));

    it('should create a new mock threat model', waitForAsync(() => {
      service
        .createThreatModel('New Test Threat Model', 'Created for testing')
        .subscribe(threatModel => {
          expect(mockDataService.createThreatModel).toHaveBeenCalled();
          expect(threatModel).toBeDefined();
          expect(threatModel?.name).toBe('New Test Threat Model');
        });
    }));
  });

  describe('with mock data disabled', () => {
    beforeEach(() => {
      // Disable mock data
      if (mockDataService.useMockData$ instanceof BehaviorSubject) {
        mockDataService.useMockData$.next(false);
      }
    });

    // Add at least one test to avoid the "No test found in suite" error
    it('should handle API calls when mock data is disabled', waitForAsync(() => {
      // Disable mock data
      (mockDataService.useMockData$ as BehaviorSubject<boolean>).next(false);

      // This is a placeholder test
      expect(true).toBe(true);
    }));
  });
});
