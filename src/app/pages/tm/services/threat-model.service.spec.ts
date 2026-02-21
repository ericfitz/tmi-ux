// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
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
import { AuthService } from '../../../auth/services/auth.service';
import { ThreatModelAuthorizationService } from './threat-model-authorization.service';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockLoggerService } from '../../../../testing/mocks';

// Import testing utilities
import { waitForAsync } from '../../../../testing/async-utils';

// The Angular testing environment is initialized in src/testing/zone-setup.ts

describe('ThreatModelService', () => {
  let service: ThreatModelService;
  let loggerService: LoggerService;
  let apiService: ApiService;
  let authService: AuthService;
  let authorizationService: ThreatModelAuthorizationService;
  let testThreatModel1: any;
  let testThreatModel2: any;
  let testThreatModel3: any;

  beforeEach(() => {
    // Create test user for mock data
    const testUser = {
      principal_type: 'user' as const,
      provider: 'test',
      provider_id: 'test-user-1',
      display_name: 'Test User',
      email: 'test@example.com',
    };

    // Create test data
    testThreatModel1 = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Threat Model 1',
      description: 'Test Description 1',
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      owner: testUser,
      created_by: testUser,
      threat_model_framework: 'STRIDE',
      diagrams: [],
      threats: [],
    };
    testThreatModel2 = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Test Threat Model 2',
      description: 'Test Description 2',
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      owner: testUser,
      created_by: testUser,
      threat_model_framework: 'STRIDE',
      diagrams: [],
      threats: [],
    };
    testThreatModel3 = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Test Threat Model 3',
      description: 'Test Description 3',
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      owner: testUser,
      created_by: testUser,
      threat_model_framework: 'STRIDE',
      diagrams: [],
      threats: [],
    };

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

    // Create mocks for the additional services
    const importOrchestrator = {
      importThreatModel: vi.fn(),
    } as any;

    const fieldFilter = {
      filterReadonlyFields: vi.fn(),
    } as any;

    // Create the service directly with mocked dependencies
    service = new ThreatModelService(
      apiService,
      loggerService,
      authService,
      authorizationService,
      importOrchestrator,
      fieldFilter,
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('API mode (offline mode removed)', () => {
    beforeEach(() => {
      // Mock API responses for threat model list
      const mockListItems = [testThreatModel1, testThreatModel2, testThreatModel3].map(tm => ({
        id: tm.id,
        name: tm.name,
        description: tm.description,
        created_at: tm.created_at,
        modified_at: tm.modified_at,
        owner: tm.owner,
        created_by: tm.created_by,
        threat_model_framework: tm.threat_model_framework,
        issue_uri: tm.issue_uri,
        status: tm.status,
        status_updated: tm.status_updated,
        document_count: tm.documents?.length || 0,
        repo_count: tm.repositories?.length || 0,
        diagram_count: tm.diagrams?.length || 0,
        threat_count: tm.threats?.length || 0,
        asset_count: tm.assets?.length || 0,
        note_count: tm.notes?.length || 0,
      }));

      vi.mocked(apiService.get).mockReturnValue(
        of({ threat_models: mockListItems, total: mockListItems.length, limit: 100, offset: 0 }),
      );
    });

    it('should return threat model list from API', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        service.getThreatModelList().subscribe({
          next: threatModelList => {
            // Skip empty array emissions (BehaviorSubject initial value)
            if (threatModelList.length === 0) {
              return;
            }

            try {
              expect(threatModelList.length).toBe(3);
              expect(threatModelList[0].id).toBe(testThreatModel1.id);
              expect(threatModelList[0].name).toBe(testThreatModel1.name);
              expect(threatModelList[0].document_count).toBeDefined();
              expect(threatModelList[0].diagram_count).toBeDefined();
              expect(threatModelList[0].threat_count).toBeDefined();
              expect(threatModelList[0].repo_count).toBeDefined();
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: error => {
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        });
      });
    }));

    it('should return a specific threat model by ID from API', waitForAsync(() => {
      // Mock the API call for getting a specific threat model
      vi.mocked(apiService.get).mockReturnValue(of(testThreatModel1));

      return new Promise<void>((resolve, reject) => {
        service.getThreatModelById(testThreatModel1.id).subscribe({
          next: threatModel => {
            try {
              expect(threatModel).toBeDefined();
              expect(threatModel?.id).toBe(testThreatModel1.id);
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: error => {
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        });
      });
    }));

    it('should create a new threat model via API', waitForAsync(() => {
      // Mock the API response for creating a threat model
      const newThreatModel = {
        id: 'new-threat-model-id',
        name: 'New Test Threat Model',
        description: 'Created for testing',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        owner: 'test@example.com',
        created_by: 'test@example.com',
        threat_model_framework: 'STRIDE',
        diagrams: [],
        threats: [],
      };
      vi.mocked(apiService.post).mockReturnValue(of(newThreatModel));

      return new Promise<void>((resolve, reject) => {
        service.createThreatModel('New Test Threat Model', 'Created for testing').subscribe({
          next: threatModel => {
            try {
              expect(apiService.post).toHaveBeenCalled();
              expect(threatModel).toBeDefined();
              expect(threatModel?.name).toBe('New Test Threat Model');
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: error => {
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        });
      });
    }));

    it('should return diagrams for a threat model from API', waitForAsync(() => {
      // Mock API to return wrapped response
      const mockResponse = {
        diagrams: testThreatModel1.diagrams || [],
        total: (testThreatModel1.diagrams || []).length,
        limit: 100,
        offset: 0,
      };
      vi.mocked(apiService.get).mockReturnValue(of(mockResponse));

      return new Promise<void>((resolve, reject) => {
        service.getDiagramsForThreatModel(testThreatModel1.id).subscribe({
          next: response => {
            try {
              expect(response).toBeDefined();
              expect(Array.isArray(response.diagrams)).toBe(true);
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: error => {
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        });
      });
    }));

    it('should return documents for a threat model from API', waitForAsync(() => {
      // Mock API to return wrapped response
      const mockResponse = {
        documents: testThreatModel1.documents || [],
        total: (testThreatModel1.documents || []).length,
        limit: 100,
        offset: 0,
      };
      vi.mocked(apiService.get).mockReturnValue(of(mockResponse));

      return new Promise<void>((resolve, reject) => {
        service.getDocumentsForThreatModel(testThreatModel1.id).subscribe({
          next: response => {
            try {
              expect(response).toBeDefined();
              expect(Array.isArray(response.documents)).toBe(true);
              expect(response.documents.length).toBe(testThreatModel1.documents?.length || 0);
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: error => {
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        });
      });
    }));

    it('should return repositories for a threat model from API', waitForAsync(() => {
      // Mock API to return wrapped response
      const mockResponse = {
        repositories: testThreatModel1.repositories || [],
        total: (testThreatModel1.repositories || []).length,
        limit: 100,
        offset: 0,
      };
      vi.mocked(apiService.get).mockReturnValue(of(mockResponse));

      return new Promise<void>((resolve, reject) => {
        service.getRepositoriesForThreatModel(testThreatModel1.id).subscribe({
          next: response => {
            try {
              expect(response).toBeDefined();
              expect(Array.isArray(response.repositories)).toBe(true);
              expect(response.repositories.length).toBe(testThreatModel1.repositories?.length || 0);
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: error => {
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        });
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
      const mockResponse = { diagrams: mockDiagrams, total: 1, limit: 100, offset: 0 };
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockResponse));

      service.getDiagramsForThreatModel(testThreatModel1.id).subscribe(response => {
        expect(apiService.get).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/diagrams`,
          {},
        );
        expect(response.diagrams).toEqual(mockDiagrams);
      });
    }));

    it('should make API calls for documents when mock data is disabled', waitForAsync(() => {
      const mockDocuments = [{ id: 'doc1', name: 'Test Document', url: 'http://example.com' }];
      const mockResponse = { documents: mockDocuments, total: 1, limit: 100, offset: 0 };
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockResponse));

      service.getDocumentsForThreatModel(testThreatModel1.id).subscribe(response => {
        expect(apiService.get).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/documents`,
          {},
        );
        expect(response.documents).toEqual(mockDocuments);
      });
    }));

    it('should make API calls for repositories when mock data is disabled', waitForAsync(() => {
      const mockRepositories = [
        { id: 'repo1', name: 'Test Repository', uri: 'http://github.com/example' },
      ];
      const mockResponse = { repositories: mockRepositories, total: 1, limit: 100, offset: 0 };
      vi.spyOn(apiService, 'get').mockReturnValue(of(mockResponse));

      service.getRepositoriesForThreatModel(testThreatModel1.id).subscribe(response => {
        expect(apiService.get).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/repositories`,
          {},
        );
        expect(response.repositories).toEqual(mockRepositories);
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
      vi.spyOn(apiService, 'put').mockReturnValue(of(metadata));

      service.updateThreatModelMetadata(testThreatModel1.id, metadata).subscribe(result => {
        expect(apiService.put).toHaveBeenCalledWith(
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
      vi.spyOn(apiService, 'put').mockReturnValue(of(metadata));

      service.updateDiagramMetadata(testThreatModel1.id, diagramId, metadata).subscribe(result => {
        expect(apiService.put).toHaveBeenCalledWith(
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
      vi.spyOn(apiService, 'put').mockReturnValue(of(metadata));

      service.updateThreatMetadata(testThreatModel1.id, threatId, metadata).subscribe(result => {
        expect(apiService.put).toHaveBeenCalledWith(
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
      vi.spyOn(apiService, 'put').mockReturnValue(of(metadata));

      service
        .updateDocumentMetadata(testThreatModel1.id, documentId, metadata)
        .subscribe(result => {
          expect(apiService.put).toHaveBeenCalledWith(
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
      vi.spyOn(apiService, 'put').mockReturnValue(of(metadata));

      service
        .updateRepositoryMetadata(testThreatModel1.id, repositoryId, metadata)
        .subscribe(result => {
          expect(apiService.put).toHaveBeenCalledWith(
            `threat_models/${testThreatModel1.id}/repositories/${repositoryId}/metadata/bulk`,
            metadata,
          );
          expect(result).toEqual(metadata);
        });
    }));

    it('should update note metadata via API', waitForAsync(() => {
      const metadata = [{ key: 'note-updated', value: 'note-updated-value' }];
      const noteId = 'test-note-id';
      vi.spyOn(apiService, 'put').mockReturnValue(of(metadata));

      service.updateNoteMetadata(testThreatModel1.id, noteId, metadata).subscribe(result => {
        expect(apiService.put).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/notes/${noteId}/metadata/bulk`,
          metadata,
        );
        expect(result).toEqual(metadata);
      });
    }));

    it('should update asset metadata via API', waitForAsync(() => {
      const metadata = [{ key: 'asset-updated', value: 'asset-updated-value' }];
      const assetId = 'test-asset-id';
      vi.spyOn(apiService, 'put').mockReturnValue(of(metadata));

      service.updateAssetMetadata(testThreatModel1.id, assetId, metadata).subscribe(result => {
        expect(apiService.put).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/assets/${assetId}/metadata/bulk`,
          metadata,
        );
        expect(result).toEqual(metadata);
      });
    }));

    it('should send PUT with empty array to clear metadata', waitForAsync(() => {
      vi.spyOn(apiService, 'put').mockReturnValue(of([]));

      service.updateThreatModelMetadata(testThreatModel1.id, []).subscribe(result => {
        expect(apiService.put).toHaveBeenCalledWith(
          `threat_models/${testThreatModel1.id}/metadata/bulk`,
          [],
        );
        expect(result).toEqual([]);
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
          threat_type: ['Information Disclosure'],
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

  describe('Cache Coherence (Data Integrity)', () => {
    it('should add created threat model to both list cache and detail cache', waitForAsync(() => {
      const newThreatModel = {
        id: 'new-tm-id',
        name: 'New TM',
        description: 'Test',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        owner: {
          principal_type: 'user',
          provider: 'test',
          provider_id: 'user-1',
          display_name: 'User',
          email: 'u@test.com',
        },
        created_by: {
          principal_type: 'user',
          provider: 'test',
          provider_id: 'user-1',
          display_name: 'User',
          email: 'u@test.com',
        },
        threat_model_framework: 'STRIDE',
        diagrams: [],
        threats: [],
        authorization: [],
      };
      vi.mocked(apiService.post).mockReturnValue(of(newThreatModel));

      return new Promise<void>((resolve, reject) => {
        service.createThreatModel('New TM', 'Test').subscribe({
          next: result => {
            try {
              expect(result).toBeDefined();
              expect(result.id).toBe('new-tm-id');

              // Verify authorization service was called
              expect(authorizationService.setAuthorization).toHaveBeenCalledWith(
                'new-tm-id',
                expect.any(Array),
                expect.anything(),
              );

              // Verify the detail cache has the model
              // Access via getThreatModelById with no force refresh (should use cache)
              vi.mocked(apiService.get).mockClear();
              service.getThreatModelById('new-tm-id').subscribe({
                next: cached => {
                  try {
                    expect(cached).toBeDefined();
                    expect(cached?.id).toBe('new-tm-id');
                    // Should NOT have made an API call (used cache)
                    expect(apiService.get).not.toHaveBeenCalled();
                    resolve();
                  } catch (error) {
                    reject(error instanceof Error ? error : new Error(String(error)));
                  }
                },
                error: err => reject(err instanceof Error ? err : new Error(String(err))),
              });
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      });
    }));

    it('should strip display_name from authorization in created threat model', waitForAsync(() => {
      const newThreatModel = {
        id: 'new-tm-id',
        name: 'New TM',
        description: 'Test',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        owner: {
          principal_type: 'user',
          provider: 'test',
          provider_id: 'user-1',
          display_name: 'User',
          email: 'u@test.com',
        },
        created_by: {
          principal_type: 'user',
          provider: 'test',
          provider_id: 'user-1',
          display_name: 'User',
          email: 'u@test.com',
        },
        threat_model_framework: 'STRIDE',
        diagrams: [],
        threats: [],
        authorization: [
          {
            provider: 'test',
            provider_id: 'user-1',
            email: 'u@test.com',
            display_name: 'Should Be Removed',
            permissions: ['owner'],
          },
        ],
      };
      vi.mocked(apiService.post).mockReturnValue(of(newThreatModel));

      return new Promise<void>((resolve, reject) => {
        service.createThreatModel('New TM', 'Test').subscribe({
          next: result => {
            try {
              // display_name should be removed from authorization entries
              if (result.authorization && result.authorization.length > 0) {
                expect((result.authorization[0] as any).display_name).toBeUndefined();
              }
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      });
    }));

    it('should bypass cache with forceRefresh=true on getThreatModelById', waitForAsync(() => {
      // First, populate the cache
      const cachedTm = {
        id: 'tm-cached',
        name: 'Cached Version',
        description: 'Old',
        authorization: [],
        threats: [],
        diagrams: [],
        owner: {
          principal_type: 'user',
          provider: 'test',
          provider_id: 'user-1',
          display_name: 'User',
          email: 'u@test.com',
        },
      };
      const freshTm = {
        ...cachedTm,
        name: 'Fresh Version',
        description: 'New',
      };

      vi.mocked(apiService.get).mockReturnValueOnce(of(cachedTm));

      return new Promise<void>((resolve, reject) => {
        // Load first to populate cache
        service.getThreatModelById('tm-cached').subscribe({
          next: () => {
            // Now force refresh with different API response
            vi.mocked(apiService.get).mockReturnValueOnce(of(freshTm));

            service.getThreatModelById('tm-cached', true).subscribe({
              next: result => {
                try {
                  expect(result?.name).toBe('Fresh Version');
                  // API should have been called again
                  expect(apiService.get).toHaveBeenCalledTimes(2);
                  resolve();
                } catch (error) {
                  reject(error instanceof Error ? error : new Error(String(error)));
                }
              },
              error: err => reject(err instanceof Error ? err : new Error(String(err))),
            });
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      });
    }));

    it('should replace full list on fetchThreatModels (not merge)', waitForAsync(() => {
      const firstList = [testThreatModel1].map(tm => ({
        id: tm.id,
        name: tm.name,
        description: tm.description,
        created_at: tm.created_at,
        modified_at: tm.modified_at,
        owner: tm.owner,
        created_by: tm.created_by,
        threat_model_framework: tm.threat_model_framework,
        document_count: 0,
        repo_count: 0,
        diagram_count: 0,
        threat_count: 0,
        asset_count: 0,
        note_count: 0,
      }));
      const secondList = [testThreatModel2, testThreatModel3].map(tm => ({
        id: tm.id,
        name: tm.name,
        description: tm.description,
        created_at: tm.created_at,
        modified_at: tm.modified_at,
        owner: tm.owner,
        created_by: tm.created_by,
        threat_model_framework: tm.threat_model_framework,
        document_count: 0,
        repo_count: 0,
        diagram_count: 0,
        threat_count: 0,
        asset_count: 0,
        note_count: 0,
      }));

      vi.mocked(apiService.get).mockReturnValueOnce(
        of({ threat_models: firstList, total: 1, limit: 100, offset: 0 }),
      );

      return new Promise<void>((resolve, reject) => {
        service.fetchThreatModels().subscribe({
          next: firstResponse => {
            try {
              expect(firstResponse.threat_models).toHaveLength(1);

              // Fetch again with different list
              vi.mocked(apiService.get).mockReturnValueOnce(
                of({ threat_models: secondList, total: 2, limit: 100, offset: 0 }),
              );

              service.fetchThreatModels().subscribe({
                next: secondResponse => {
                  try {
                    // Should be completely replaced, not merged
                    expect(secondResponse.threat_models).toHaveLength(2);
                    expect(secondResponse.threat_models[0].id).toBe(testThreatModel2.id);
                    resolve();
                  } catch (error) {
                    reject(error instanceof Error ? error : new Error(String(error)));
                  }
                },
                error: err => reject(err instanceof Error ? err : new Error(String(err))),
              });
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      });
    }));

    it('should return empty list on fetchThreatModels API failure', waitForAsync(() => {
      vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('API unavailable')));

      return new Promise<void>((resolve, reject) => {
        service.fetchThreatModels().subscribe({
          next: result => {
            try {
              expect(result.threat_models).toEqual([]);
              expect(result.total).toBe(0);
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      });
    }));

    it('should propagate error from createThreatModel API failure', waitForAsync(() => {
      vi.mocked(apiService.post).mockReturnValue(throwError(() => new Error('Create failed')));

      return new Promise<void>((resolve, reject) => {
        service.createThreatModel('Test', 'Desc').subscribe({
          next: () => reject(new Error('Should have thrown')),
          error: error => {
            try {
              expect(error.message).toBe('Create failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      });
    }));
  });
});
