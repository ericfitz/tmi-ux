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

import { ThreatModelService } from './threat-model.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ApiService } from '../../../core/services/api.service';
import { MockDataService } from '../../../mocks/mock-data.service';
import { AuthService } from '../../../auth/services/auth.service';
import { BehaviorSubject, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockLoggerService } from '../../../../testing/mocks';

// Import testing utilities
import { waitForAsync } from '../../../../testing/async-utils';

// Import mock data factory
import { createMockThreatModel } from '../../../mocks/factories/threat-model.factory';

// The Angular testing environment is initialized in src/testing/zone-setup.ts

describe('ThreatModelService', () => {
  let service: ThreatModelService;
  let mockDataService: MockDataService;
  let loggerService: LoggerService;
  let apiService: ApiService;
  let authService: AuthService;
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

    loggerService = createMockLoggerService() as unknown as LoggerService;

    // Create a simple mock for ApiService
    apiService = {
      get: vi.fn().mockReturnValue(of([])),
      post: vi.fn().mockReturnValue(of({})),
      put: vi.fn().mockReturnValue(of({})),
      delete: vi.fn().mockReturnValue(of(true)),
    } as unknown as ApiService;

    // Create a mock for AuthService
    authService = {
      userEmail: 'test.user@example.com',
      userProfile: { email: 'test.user@example.com', name: 'Test User' },
    } as unknown as AuthService;

    // Create the service directly with mocked dependencies
    service = new ThreatModelService(apiService, loggerService, mockDataService, authService);
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

    it('should return mock threat model list', waitForAsync(() => {
      service.getThreatModelList().subscribe(threatModelList => {
        expect(threatModelList.length).toBe(3);
        expect(threatModelList[0].id).toBe(testThreatModel1.id);
        expect(threatModelList[0].name).toBe(testThreatModel1.name);
        expect(threatModelList[0].document_count).toBeDefined();
        expect(threatModelList[0].diagram_count).toBeDefined();
        expect(threatModelList[0].threat_count).toBeDefined();
        expect(threatModelList[0].source_count).toBeDefined();
      });
    }));

    it('should return mock threat models (deprecated method)', waitForAsync(() => {
      service.getThreatModels().subscribe(threatModels => {
        expect(threatModels.length).toBe(0); // Deprecated method returns empty for efficiency
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

    it('should return mock diagrams for a threat model', waitForAsync(() => {
      service.getDiagramsForThreatModel(testThreatModel1.id).subscribe(diagrams => {
        expect(diagrams).toBeDefined();
        expect(Array.isArray(diagrams)).toBe(true);
        // The mock data service should return diagrams for the threat model
      });
    }));

    it('should return mock documents for a threat model', waitForAsync(() => {
      service.getDocumentsForThreatModel(testThreatModel1.id).subscribe(documents => {
        expect(documents).toBeDefined();
        expect(Array.isArray(documents)).toBe(true);
        // Should return the documents from the threat model
        expect(documents.length).toBe(testThreatModel1.documents?.length || 0);
      });
    }));

    it('should return mock source code for a threat model', waitForAsync(() => {
      service.getSourceCodeForThreatModel(testThreatModel1.id).subscribe(sourceCode => {
        expect(sourceCode).toBeDefined();
        expect(Array.isArray(sourceCode)).toBe(true);
        // Should return the source code from the threat model
        expect(sourceCode.length).toBe(testThreatModel1.sourceCode?.length || 0);
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

    it('should make API calls for diagrams when mock data is disabled', waitForAsync(() => {
      const mockDiagrams = [{ id: 'diag1', name: 'Test Diagram' }];
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockDiagrams));

      service.getDiagramsForThreatModel(testThreatModel1.id).subscribe(diagrams => {
        expect(apiService.get).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/diagrams`);
        expect(diagrams).toEqual(mockDiagrams);
      });
    }));

    it('should make API calls for documents when mock data is disabled', waitForAsync(() => {
      const mockDocuments = [{ id: 'doc1', name: 'Test Document', url: 'http://example.com' }];
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockDocuments));

      service.getDocumentsForThreatModel(testThreatModel1.id).subscribe(documents => {
        expect(apiService.get).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/documents`);
        expect(documents).toEqual(mockDocuments);
      });
    }));

    it('should make API calls for source code when mock data is disabled', waitForAsync(() => {
      const mockSourceCode = [{ id: 'src1', name: 'Test Source', url: 'http://github.com/example' }];
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockSourceCode));

      service.getSourceCodeForThreatModel(testThreatModel1.id).subscribe(sourceCode => {
        expect(apiService.get).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/sources`);
        expect(sourceCode).toEqual(mockSourceCode);
      });
    }));
  });
});
