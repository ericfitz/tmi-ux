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
import { ThreatModelAuthorizationService } from './threat-model-authorization.service';
import { of } from 'rxjs';
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
  let authorizationService: ThreatModelAuthorizationService;
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
    } as unknown as MockDataService;

    loggerService = createMockLoggerService() as unknown as LoggerService;

    // Create a simple mock for ApiService
    apiService = {
      get: vi.fn().mockReturnValue(of([])),
      post: vi.fn().mockReturnValue(of({})),
      put: vi.fn().mockReturnValue(of({})),
      delete: vi.fn().mockReturnValue(of(true)),
    } as unknown as ApiService;

    // Create a mock for AuthService (default to offline mode enabled)
    authService = {
      userEmail: 'test.user@example.com',
      userProfile: { email: 'test.user@example.com', name: 'Test User' },
      isUsingLocalProvider: true, // Enable offline mode by default for tests
    } as unknown as AuthService;

    // Create a mock for ThreatModelAuthorizationService
    authorizationService = {
      setAuthorization: vi.fn(),
      updateAuthorization: vi.fn(),
      clearAuthorization: vi.fn(),
      getCurrentUserPermission: vi.fn().mockReturnValue('owner'),
      canEdit: vi.fn().mockReturnValue(true),
      canManagePermissions: vi.fn().mockReturnValue(true),
    } as unknown as ThreatModelAuthorizationService;

    // Create the service directly with mocked dependencies
    service = new ThreatModelService(
      apiService,
      loggerService,
      mockDataService,
      authService,
      authorizationService,
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('with offline mode enabled', () => {
    beforeEach(() => {
      // Ensure offline mode is enabled
      authService.isUsingLocalProvider = true;
    });

    it('should return mock threat model list', waitForAsync(() => {
      service.getThreatModelList().subscribe(threatModelList => {
        expect(threatModelList.length).toBe(3);
        expect(threatModelList[0].id).toBe(testThreatModel1.id);
        expect(threatModelList[0].name).toBe(testThreatModel1.name);
        expect(threatModelList[0].document_count).toBeDefined();
        expect(threatModelList[0].diagram_count).toBeDefined();
        expect(threatModelList[0].threat_count).toBeDefined();
        expect(threatModelList[0].repo_count).toBeDefined();
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

    it('should return mock repositories for a threat model', waitForAsync(() => {
      service.getRepositoriesForThreatModel(testThreatModel1.id).subscribe(repositories => {
        expect(repositories).toBeDefined();
        expect(Array.isArray(repositories)).toBe(true);
        // Should return the repositories from the threat model
        expect(repositories.length).toBe(testThreatModel1.repositories?.length || 0);
      });
    }));
  });

  describe('with offline mode disabled', () => {
    beforeEach(() => {
      // Disable offline mode
      authService.isUsingLocalProvider = false;
    });

    it('should make API calls for diagrams when mock data is disabled', waitForAsync(() => {
      const mockDiagrams = [{ id: 'diag1', name: 'Test Diagram' }];
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockDiagrams));

      service.getDiagramsForThreatModel(testThreatModel1.id).subscribe(diagrams => {
        expect(apiService.get).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/diagrams`,
        );
        expect(diagrams).toEqual(mockDiagrams);
      });
    }));

    it('should make API calls for documents when mock data is disabled', waitForAsync(() => {
      const mockDocuments = [{ id: 'doc1', name: 'Test Document', url: 'http://example.com' }];
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockDocuments));

      service.getDocumentsForThreatModel(testThreatModel1.id).subscribe(documents => {
        expect(apiService.get).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/documents`,
        );
        expect(documents).toEqual(mockDocuments);
      });
    }));

    it('should make API calls for repositories when mock data is disabled', waitForAsync(() => {
      const mockRepositories = [
        { id: 'repo1', name: 'Test Repository', uri: 'http://github.com/example' },
      ];
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockRepositories));

      service.getRepositoriesForThreatModel(testThreatModel1.id).subscribe(repositories => {
        expect(apiService.get).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/repositories`,
        );
        expect(repositories).toEqual(mockRepositories);
      });
    }));
  });

  describe('Metadata API Methods', () => {
    beforeEach(() => {
      // Disable offline mode for these tests
      authService.isUsingLocalProvider = false;
    });

    it('should get threat model metadata via API', waitForAsync(() => {
      const mockMetadata = [{ key: 'test-key', value: 'test-value' }];
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockMetadata));

      service.getThreatModelMetadata(testThreatModel1.id).subscribe(metadata => {
        expect(apiService.get).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/metadata`,
        );
        expect(metadata).toEqual(mockMetadata);
      });
    }));

    it('should update threat model metadata via API', waitForAsync(() => {
      const metadata = [{ key: 'updated-key', value: 'updated-value' }];
      vi.spyOn(apiService, 'post').mockReturnValue(of(metadata));

      service.updateThreatModelMetadata(testThreatModel1.id, metadata).subscribe(result => {
        expect(apiService.post).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/metadata/bulk`,
          metadata,
        );
        expect(result).toEqual(metadata);
      });
    }));

    it('should get diagram metadata via API', waitForAsync(() => {
      const mockMetadata = [{ key: 'diagram-key', value: 'diagram-value' }];
      const diagramId = 'test-diagram-id';
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockMetadata));

      service.getDiagramMetadata(testThreatModel1.id, diagramId).subscribe(metadata => {
        expect(apiService.get).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/diagrams/${diagramId}/metadata`,
        );
        expect(metadata).toEqual(mockMetadata);
      });
    }));

    it('should update diagram metadata via API', waitForAsync(() => {
      const metadata = [{ key: 'diagram-updated', value: 'diagram-updated-value' }];
      const diagramId = 'test-diagram-id';
      vi.spyOn(apiService, 'post').mockReturnValue(of(metadata));

      service.updateDiagramMetadata(testThreatModel1.id, diagramId, metadata).subscribe(result => {
        expect(apiService.post).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/diagrams/${diagramId}/metadata/bulk`,
          metadata,
        );
        expect(result).toEqual(metadata);
      });
    }));

    it('should get threat metadata via API', waitForAsync(() => {
      const mockMetadata = [{ key: 'threat-key', value: 'threat-value' }];
      const threatId = 'test-threat-id';
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockMetadata));

      service.getThreatMetadata(testThreatModel1.id, threatId).subscribe(metadata => {
        expect(apiService.get).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/threats/${threatId}/metadata`,
        );
        expect(metadata).toEqual(mockMetadata);
      });
    }));

    it('should update threat metadata via API', waitForAsync(() => {
      const metadata = [{ key: 'threat-updated', value: 'threat-updated-value' }];
      const threatId = 'test-threat-id';
      vi.spyOn(apiService, 'post').mockReturnValue(of(metadata));

      service.updateThreatMetadata(testThreatModel1.id, threatId, metadata).subscribe(result => {
        expect(apiService.post).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/threats/${threatId}/metadata/bulk`,
          metadata,
        );
        expect(result).toEqual(metadata);
      });
    }));

    it('should get document metadata via API', waitForAsync(() => {
      const mockMetadata = [{ key: 'doc-key', value: 'doc-value' }];
      const documentId = 'test-doc-id';
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockMetadata));

      service.getDocumentMetadata(testThreatModel1.id, documentId).subscribe(metadata => {
        expect(apiService.get).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/documents/${documentId}/metadata`,
        );
        expect(metadata).toEqual(mockMetadata);
      });
    }));

    it('should update document metadata via API', waitForAsync(() => {
      const metadata = [{ key: 'doc-updated', value: 'doc-updated-value' }];
      const documentId = 'test-doc-id';
      vi.spyOn(apiService, 'post').mockReturnValue(of(metadata));

      service
        .updateDocumentMetadata(testThreatModel1.id, documentId, metadata)
        .subscribe(result => {
          expect(apiService.post).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/documents/${documentId}/metadata/bulk`,
            metadata,
          );
          expect(result).toEqual(metadata);
        });
    }));

    it('should get repository metadata via API', waitForAsync(() => {
      const mockMetadata = [{ key: 'repository-key', value: 'repository-value' }];
      const repositoryId = 'test-repository-id';
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockMetadata));

      service.getRepositoryMetadata(testThreatModel1.id, repositoryId).subscribe(metadata => {
        expect(apiService.get).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/repositories/${repositoryId}/metadata`,
        );
        expect(metadata).toEqual(mockMetadata);
      });
    }));

    it('should update repository metadata via API', waitForAsync(() => {
      const metadata = [{ key: 'repository-updated', value: 'repository-updated-value' }];
      const repositoryId = 'test-repository-id';
      vi.spyOn(apiService, 'post').mockReturnValue(of(metadata));

      service
        .updateRepositoryMetadata(testThreatModel1.id, repositoryId, metadata)
        .subscribe(result => {
          expect(apiService.post).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/repositories/${repositoryId}/metadata/bulk`,
            metadata,
          );
          expect(result).toEqual(metadata);
        });
    }));
  });

  describe('Entity API Methods', () => {
    beforeEach(() => {
      // Disable offline mode for these tests
      authService.isUsingLocalProvider = false;
    });

    describe('Threat API Methods', () => {
      it('should create a threat via API', waitForAsync(() => {
        const threatData = {
          name: 'Test Threat',
          description: 'A test threat',
          severity: 'High' as const,
          threat_type: 'Information Disclosure',
        };
        const expectedThreat = {
          ...threatData,
          id: 'new-threat-id',
          threat_model_id: testThreatModel1.id,
        };
        vi.spyOn(apiService, 'post').mockReturnValue(of(expectedThreat));

        service.createThreat(testThreatModel1.id, threatData).subscribe(result => {
          expect(apiService.post).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/threats`,
            threatData,
          );
          expect(result).toEqual(expectedThreat);
        });
      }));

      it('should update a threat via API', waitForAsync(() => {
        const threatData = { name: 'Updated Threat', severity: 'Critical' as const };
        const threatId = 'test-threat-id';
        const expectedThreat = { ...threatData, id: threatId };
        vi.spyOn(apiService, 'put').mockReturnValue(of(expectedThreat));

        service.updateThreat(testThreatModel1.id, threatId, threatData).subscribe(result => {
          expect(apiService.put).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/threats/${threatId}`,
            threatData,
          );
          expect(result).toEqual(expectedThreat);
        });
      }));

      it('should delete a threat via API', waitForAsync(() => {
        const threatId = 'test-threat-id';
        vi.spyOn(apiService, 'delete').mockReturnValue(of({}));

        service.deleteThreat(testThreatModel1.id, threatId).subscribe(result => {
          expect(apiService.delete).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/threats/${threatId}`,
          );
          expect(result).toBe(true);
        });
      }));
    });

    describe('Document API Methods', () => {
      it('should create a document via API', waitForAsync(() => {
        const documentData = {
          name: 'Test Doc',
          url: 'http://example.com',
          description: 'A test document',
        };
        const expectedDocument = { ...documentData, id: 'new-doc-id' };
        vi.spyOn(apiService, 'post').mockReturnValue(of(expectedDocument));

        service.createDocument(testThreatModel1.id, documentData).subscribe(result => {
          expect(apiService.post).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/documents`,
            documentData,
          );
          expect(result).toEqual(expectedDocument);
        });
      }));

      it('should update a document via API', waitForAsync(() => {
        const documentData = { name: 'Updated Doc', url: 'http://updated.com' };
        const documentId = 'test-doc-id';
        const expectedDocument = { ...documentData, id: documentId };
        vi.spyOn(apiService, 'put').mockReturnValue(of(expectedDocument));

        service.updateDocument(testThreatModel1.id, documentId, documentData).subscribe(result => {
          expect(apiService.put).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/documents/${documentId}`,
            documentData,
          );
          expect(result).toEqual(expectedDocument);
        });
      }));

      it('should delete a document via API', waitForAsync(() => {
        const documentId = 'test-doc-id';
        vi.spyOn(apiService, 'delete').mockReturnValue(of({}));

        service.deleteDocument(testThreatModel1.id, documentId).subscribe(result => {
          expect(apiService.delete).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/documents/${documentId}`,
          );
          expect(result).toBe(true);
        });
      }));
    });

    describe('Repository API Methods', () => {
      it('should create a repository via API', waitForAsync(() => {
        const repositoryData = {
          name: 'Test Repository',
          uri: 'http://github.com/test',
          type: 'git' as const,
        };
        const expectedRepository = { ...repositoryData, id: 'new-repository-id' };
        vi.spyOn(apiService, 'post').mockReturnValue(of(expectedRepository));

        service.createRepository(testThreatModel1.id, repositoryData).subscribe(result => {
          expect(apiService.post).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/repositories`,
            repositoryData,
          );
          expect(result).toEqual(expectedRepository);
        });
      }));

      it('should update a repository via API', waitForAsync(() => {
        const repositoryData = { name: 'Updated Repository', uri: 'http://github.com/updated' };
        const repositoryId = 'test-repository-id';
        const expectedRepository = { ...repositoryData, id: repositoryId };
        vi.spyOn(apiService, 'put').mockReturnValue(of(expectedRepository));

        service
          .updateRepository(testThreatModel1.id, repositoryId, repositoryData)
          .subscribe(result => {
            expect(apiService.put).toHaveBeenCalledWith(
              `threat_models/${testThreatModel1.id}/repositories/${repositoryId}`,
              repositoryData,
            );
            expect(result).toEqual(expectedRepository);
          });
      }));

      it('should delete a repository via API', waitForAsync(() => {
        const repositoryId = 'test-repository-id';
        vi.spyOn(apiService, 'delete').mockReturnValue(of({}));

        service.deleteRepository(testThreatModel1.id, repositoryId).subscribe(result => {
          expect(apiService.delete).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/repositories/${repositoryId}`,
          );
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
          expect(apiService.post).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/diagrams`,
            diagramData,
          );
          expect(result).toEqual(expectedDiagram);
        });
      }));

      // Test removed: updateDiagram method no longer exists
      // Diagrams are now updated via patchDiagramCells or patchDiagramWithImage

      it('should delete a diagram via API', waitForAsync(() => {
        const diagramId = 'test-diagram-id';
        vi.spyOn(apiService, 'delete').mockReturnValue(of({}));

        service.deleteDiagram(testThreatModel1.id, diagramId).subscribe(result => {
          expect(apiService.delete).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/diagrams/${diagramId}`,
          );
          expect(result).toBe(true);
        });
      }));
    });
  });
});
