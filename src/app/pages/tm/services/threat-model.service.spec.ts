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
    const useMockDataSubject = new BehaviorSubject<boolean>(true);
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
      useMockData$: useMockDataSubject,
      toggleMockData: vi.fn().mockImplementation((useMock: boolean) => {
        useMockDataSubject.next(useMock);
      }),
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

  describe('Metadata API Methods', () => {
    beforeEach(() => {
      // Disable mock data for these tests
      mockDataService.toggleMockData(false);
    });

    it('should get threat model metadata via API', waitForAsync(() => {
      const mockMetadata = [{ key: 'test-key', value: 'test-value' }];
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockMetadata));

      service.getThreatModelMetadata(testThreatModel1.id).subscribe(metadata => {
        expect(apiService.get).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/metadata`);
        expect(metadata).toEqual(mockMetadata);
      });
    }));

    it('should update threat model metadata via API', waitForAsync(() => {
      const metadata = [{ key: 'updated-key', value: 'updated-value' }];
      vi.spyOn(apiService, 'post').mockReturnValue(of(metadata));

      service.updateThreatModelMetadata(testThreatModel1.id, metadata).subscribe(result => {
        expect(apiService.post).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/metadata/bulk`, metadata);
        expect(result).toEqual(metadata);
      });
    }));

    it('should get diagram metadata via API', waitForAsync(() => {
      const mockMetadata = [{ key: 'diagram-key', value: 'diagram-value' }];
      const diagramId = 'test-diagram-id';
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockMetadata));

      service.getDiagramMetadata(testThreatModel1.id, diagramId).subscribe(metadata => {
        expect(apiService.get).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/diagrams/${diagramId}/metadata`);
        expect(metadata).toEqual(mockMetadata);
      });
    }));

    it('should update diagram metadata via API', waitForAsync(() => {
      const metadata = [{ key: 'diagram-updated', value: 'diagram-updated-value' }];
      const diagramId = 'test-diagram-id';
      vi.spyOn(apiService, 'post').mockReturnValue(of(metadata));

      service.updateDiagramMetadata(testThreatModel1.id, diagramId, metadata).subscribe(result => {
        expect(apiService.post).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/diagrams/${diagramId}/metadata/bulk`, metadata);
        expect(result).toEqual(metadata);
      });
    }));

    it('should get threat metadata via API', waitForAsync(() => {
      const mockMetadata = [{ key: 'threat-key', value: 'threat-value' }];
      const threatId = 'test-threat-id';
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockMetadata));

      service.getThreatMetadata(testThreatModel1.id, threatId).subscribe(metadata => {
        expect(apiService.get).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/threats/${threatId}/metadata`);
        expect(metadata).toEqual(mockMetadata);
      });
    }));

    it('should update threat metadata via API', waitForAsync(() => {
      const metadata = [{ key: 'threat-updated', value: 'threat-updated-value' }];
      const threatId = 'test-threat-id';
      vi.spyOn(apiService, 'post').mockReturnValue(of(metadata));

      service.updateThreatMetadata(testThreatModel1.id, threatId, metadata).subscribe(result => {
        expect(apiService.post).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/threats/${threatId}/metadata/bulk`, metadata);
        expect(result).toEqual(metadata);
      });
    }));

    it('should get document metadata via API', waitForAsync(() => {
      const mockMetadata = [{ key: 'doc-key', value: 'doc-value' }];
      const documentId = 'test-doc-id';
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockMetadata));

      service.getDocumentMetadata(testThreatModel1.id, documentId).subscribe(metadata => {
        expect(apiService.get).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/documents/${documentId}/metadata`);
        expect(metadata).toEqual(mockMetadata);
      });
    }));

    it('should update document metadata via API', waitForAsync(() => {
      const metadata = [{ key: 'doc-updated', value: 'doc-updated-value' }];
      const documentId = 'test-doc-id';
      vi.spyOn(apiService, 'post').mockReturnValue(of(metadata));

      service.updateDocumentMetadata(testThreatModel1.id, documentId, metadata).subscribe(result => {
        expect(apiService.post).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/documents/${documentId}/metadata/bulk`, metadata);
        expect(result).toEqual(metadata);
      });
    }));

    it('should get source metadata via API', waitForAsync(() => {
      const mockMetadata = [{ key: 'source-key', value: 'source-value' }];
      const sourceId = 'test-source-id';
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockMetadata));

      service.getSourceMetadata(testThreatModel1.id, sourceId).subscribe(metadata => {
        expect(apiService.get).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/sources/${sourceId}/metadata`);
        expect(metadata).toEqual(mockMetadata);
      });
    }));

    it('should update source metadata via API', waitForAsync(() => {
      const metadata = [{ key: 'source-updated', value: 'source-updated-value' }];
      const sourceId = 'test-source-id';
      vi.spyOn(apiService, 'post').mockReturnValue(of(metadata));

      service.updateSourceMetadata(testThreatModel1.id, sourceId, metadata).subscribe(result => {
        expect(apiService.post).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/sources/${sourceId}/metadata/bulk`, metadata);
        expect(result).toEqual(metadata);
      });
    }));
  });

  describe('Entity API Methods', () => {
    beforeEach(() => {
      // Disable mock data for these tests
      mockDataService.toggleMockData(false);
    });

    describe('Threat API Methods', () => {
      it('should create a threat via API', waitForAsync(() => {
        const threatData = { name: 'Test Threat', description: 'A test threat', severity: 'High' as const, threat_type: 'Information Disclosure' };
        const expectedThreat = { ...threatData, id: 'new-threat-id', threat_model_id: testThreatModel1.id };
        vi.spyOn(apiService, 'post').mockReturnValue(of(expectedThreat));

        service.createThreat(testThreatModel1.id, threatData).subscribe(result => {
          expect(apiService.post).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/threats`, threatData);
          expect(result).toEqual(expectedThreat);
        });
      }));

      it('should update a threat via API', waitForAsync(() => {
        const threatData = { name: 'Updated Threat', severity: 'Critical' as const };
        const threatId = 'test-threat-id';
        const expectedThreat = { ...threatData, id: threatId };
        vi.spyOn(apiService, 'put').mockReturnValue(of(expectedThreat));

        service.updateThreat(testThreatModel1.id, threatId, threatData).subscribe(result => {
          expect(apiService.put).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/threats/${threatId}`, threatData);
          expect(result).toEqual(expectedThreat);
        });
      }));

      it('should delete a threat via API', waitForAsync(() => {
        const threatId = 'test-threat-id';
        vi.spyOn(apiService, 'delete').mockReturnValue(of({}));

        service.deleteThreat(testThreatModel1.id, threatId).subscribe(result => {
          expect(apiService.delete).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/threats/${threatId}`);
          expect(result).toBe(true);
        });
      }));
    });

    describe('Document API Methods', () => {
      it('should create a document via API', waitForAsync(() => {
        const documentData = { name: 'Test Doc', url: 'http://example.com', description: 'A test document' };
        const expectedDocument = { ...documentData, id: 'new-doc-id' };
        vi.spyOn(apiService, 'post').mockReturnValue(of(expectedDocument));

        service.createDocument(testThreatModel1.id, documentData).subscribe(result => {
          expect(apiService.post).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/documents`, documentData);
          expect(result).toEqual(expectedDocument);
        });
      }));

      it('should update a document via API', waitForAsync(() => {
        const documentData = { name: 'Updated Doc', url: 'http://updated.com' };
        const documentId = 'test-doc-id';
        const expectedDocument = { ...documentData, id: documentId };
        vi.spyOn(apiService, 'put').mockReturnValue(of(expectedDocument));

        service.updateDocument(testThreatModel1.id, documentId, documentData).subscribe(result => {
          expect(apiService.put).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/documents/${documentId}`, documentData);
          expect(result).toEqual(expectedDocument);
        });
      }));

      it('should delete a document via API', waitForAsync(() => {
        const documentId = 'test-doc-id';
        vi.spyOn(apiService, 'delete').mockReturnValue(of({}));

        service.deleteDocument(testThreatModel1.id, documentId).subscribe(result => {
          expect(apiService.delete).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/documents/${documentId}`);
          expect(result).toBe(true);
        });
      }));
    });

    describe('Source API Methods', () => {
      it('should create a source via API', waitForAsync(() => {
        const sourceData = { name: 'Test Source', url: 'http://github.com/test', type: 'git' as const };
        const expectedSource = { ...sourceData, id: 'new-source-id' };
        vi.spyOn(apiService, 'post').mockReturnValue(of(expectedSource));

        service.createSource(testThreatModel1.id, sourceData).subscribe(result => {
          expect(apiService.post).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/sources`, sourceData);
          expect(result).toEqual(expectedSource);
        });
      }));

      it('should update a source via API', waitForAsync(() => {
        const sourceData = { name: 'Updated Source', url: 'http://github.com/updated' };
        const sourceId = 'test-source-id';
        const expectedSource = { ...sourceData, id: sourceId };
        vi.spyOn(apiService, 'put').mockReturnValue(of(expectedSource));

        service.updateSource(testThreatModel1.id, sourceId, sourceData).subscribe(result => {
          expect(apiService.put).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/sources/${sourceId}`, sourceData);
          expect(result).toEqual(expectedSource);
        });
      }));

      it('should delete a source via API', waitForAsync(() => {
        const sourceId = 'test-source-id';
        vi.spyOn(apiService, 'delete').mockReturnValue(of({}));

        service.deleteSource(testThreatModel1.id, sourceId).subscribe(result => {
          expect(apiService.delete).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/sources/${sourceId}`);
          expect(result).toBe(true);
        });
      }));
    });

    describe('Diagram API Methods', () => {
      it('should create a diagram via API', waitForAsync(() => {
        const diagramData = { name: 'Test Diagram', type: 'DFD-1.0.0' };
        const expectedDiagram = { ...diagramData, id: 'new-diagram-id' };
        vi.spyOn(apiService, 'post').mockReturnValue(of(expectedDiagram));

        service.createDiagram(testThreatModel1.id, diagramData).subscribe(result => {
          expect(apiService.post).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/diagrams`, diagramData);
          expect(result).toEqual(expectedDiagram);
        });
      }));

      it('should update a diagram via API', waitForAsync(() => {
        const diagramData = { name: 'Updated Diagram', type: 'DFD-2.0.0' };
        const diagramId = 'test-diagram-id';
        const expectedDiagram = { ...diagramData, id: diagramId };
        vi.spyOn(apiService, 'put').mockReturnValue(of(expectedDiagram));

        service.updateDiagram(testThreatModel1.id, diagramId, diagramData).subscribe(result => {
          expect(apiService.put).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/diagrams/${diagramId}`, diagramData);
          expect(result).toEqual(expectedDiagram);
        });
      }));

      it('should delete a diagram via API', waitForAsync(() => {
        const diagramId = 'test-diagram-id';
        vi.spyOn(apiService, 'delete').mockReturnValue(of({}));

        service.deleteDiagram(testThreatModel1.id, diagramId).subscribe(result => {
          expect(apiService.delete).toHaveBeenCalledWith(`threat_models/${testThreatModel1.id}/diagrams/${diagramId}`);
          expect(result).toBe(true);
        });
      }));
    });
  });
});
