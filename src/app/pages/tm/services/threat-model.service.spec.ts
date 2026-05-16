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
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockLoggerService } from '../../../../testing/mocks';
import { Diagram } from '../models/diagram.model';

// Import testing utilities
import { waitForAsync } from '../../../../testing/async-utils';

// The Angular testing environment is initialized in src/testing/zone-setup.ts

describe('ThreatModelService', () => {
  let service: ThreatModelService;
  let loggerService: LoggerService;
  let apiService: ApiService;
  let authService: AuthService;
  let authorizationService: ThreatModelAuthorizationService;
  let importOrchestrator: any;
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

    loggerService = createMockLoggerService();

    // Create a simple mock for ApiService
    apiService = {
      get: vi.fn().mockReturnValue(of([])),
      getText: vi.fn().mockReturnValue(of('')),
      post: vi.fn().mockReturnValue(of({})),
      put: vi.fn().mockReturnValue(of({})),
      patch: vi.fn().mockReturnValue(of({})),
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
    importOrchestrator = {
      orchestrateImport: vi.fn(),
    } as any;

    const fieldFilter = {
      filterReadonlyFields: vi.fn(),
      filterAuthorizations: vi.fn((auths: unknown) => auths),
    } as any;

    // ProviderAdapterService — transformProviderForDisplay maps '*' to 'tmi'
    const providerAdapter = {
      transformProviderForDisplay: vi.fn((provider: string) =>
        provider === '*' ? 'tmi' : provider,
      ),
    } as any;

    // Create the service directly with mocked dependencies
    service = new ThreatModelService(
      apiService,
      loggerService,
      authService,
      authorizationService,
      importOrchestrator,
      fieldFilter,
      providerAdapter,
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

      it('should update cache after creating a threat', waitForAsync(() => {
        // Pre-populate cache by loading the threat model
        const cachedModel = { ...testThreatModel1, threats: [] };
        vi.spyOn(apiService, 'get').mockReturnValueOnce(of(cachedModel));

        return new Promise<void>(resolve => {
          service.getThreatModelById(testThreatModel1.id).subscribe(() => {
            // Now create a threat
            const newThreat = {
              id: 'new-threat-id',
              threat_model_id: testThreatModel1.id,
              name: 'New Threat',
              description: 'Created threat',
              severity: 'high',
              threat_type: ['spoofing'],
              created_at: new Date().toISOString(),
              modified_at: new Date().toISOString(),
            };
            vi.spyOn(apiService, 'post').mockReturnValueOnce(of(newThreat));

            service.createThreat(testThreatModel1.id, { name: 'New Threat' }).subscribe(() => {
              // Verify cache was updated (no forceRefresh, should use cache)
              service.getThreatModelById(testThreatModel1.id).subscribe(cached => {
                expect(cached?.threats).toBeDefined();
                expect(cached!.threats!.length).toBe(1);
                expect(cached!.threats![0].id).toBe('new-threat-id');
                resolve();
              });
            });
          });
        });
      }));

      it('should update cache after updating a threat', waitForAsync(() => {
        const existingThreat = {
          id: 'existing-threat-id',
          threat_model_id: testThreatModel1.id,
          name: 'Original Name',
          severity: 'low',
          threat_type: ['spoofing'],
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        };
        const cachedModel = { ...testThreatModel1, threats: [existingThreat] };
        vi.spyOn(apiService, 'get').mockReturnValueOnce(of(cachedModel));

        return new Promise<void>(resolve => {
          service.getThreatModelById(testThreatModel1.id).subscribe(() => {
            const updatedThreat = { ...existingThreat, name: 'Updated Name', severity: 'critical' };
            vi.spyOn(apiService, 'put').mockReturnValueOnce(of(updatedThreat));

            service
              .updateThreat(testThreatModel1.id, existingThreat.id, { name: 'Updated Name' })
              .subscribe(() => {
                service.getThreatModelById(testThreatModel1.id).subscribe(cached => {
                  expect(cached?.threats).toBeDefined();
                  expect(cached!.threats!.length).toBe(1);
                  expect(cached!.threats![0].name).toBe('Updated Name');
                  // 'critical' is migrated to '0' by migrateLegacyThreatFieldValues
                  expect(cached!.threats![0].severity).toBe('0');
                  resolve();
                });
              });
          });
        });
      }));

      it('should update cache after deleting a threat', waitForAsync(() => {
        const existingThreat = {
          id: 'threat-to-delete',
          threat_model_id: testThreatModel1.id,
          name: 'Doomed Threat',
          severity: 'high',
          threat_type: ['tampering'],
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        };
        const cachedModel = { ...testThreatModel1, threats: [existingThreat] };
        vi.spyOn(apiService, 'get').mockReturnValueOnce(of(cachedModel));

        return new Promise<void>(resolve => {
          service.getThreatModelById(testThreatModel1.id).subscribe(() => {
            vi.spyOn(apiService, 'delete').mockReturnValueOnce(of({}));

            service.deleteThreat(testThreatModel1.id, existingThreat.id).subscribe(() => {
              service.getThreatModelById(testThreatModel1.id).subscribe(cached => {
                expect(cached?.threats).toBeDefined();
                expect(cached!.threats!.length).toBe(0);
                resolve();
              });
            });
          });
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
        const diagramData: Partial<Diagram> = { name: 'Test Diagram', type: 'DFD-1.0.0' };
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

  describe('exportThreatModel', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';

    it('should fetch the threat model and all sub-entities', () =>
      waitForAsync(async () => {
        const baseTm = {
          ...testThreatModel1,
          authorization: [],
          diagrams: [],
          threats: [],
        };

        // List item (no content) vs full note (with content)
        const mockNoteListItem = {
          id: 'n1',
          name: 'Note 1',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        };
        const mockNoteFull = {
          ...mockNoteListItem,
          content: 'full note content',
        };
        const mockDoc = {
          id: 'd1',
          name: 'Doc 1',
          uri: 'https://example.com',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        };
        const mockRepo = {
          id: 'r1',
          name: 'Repo 1',
          type: 'git',
          uri: 'https://git.example.com',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        };
        const mockAsset = {
          id: 'a1',
          name: 'Asset 1',
          type: 'data',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        };
        // List item (no cells) vs full diagram (with cells)
        const mockDiagramListItem = {
          id: 'dg1',
          name: 'DFD 1',
          type: 'DFD-1.0.0',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        };
        const mockDiagramFull = {
          ...mockDiagramListItem,
          cells: [{ id: 'cell1', type: 'node' }],
        };
        const mockThreat = {
          id: 't1',
          name: 'Threat 1',
          severity: 'high',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        };

        vi.mocked(apiService.get).mockImplementation((url: string) => {
          if (url === `threat_models/${tmId}`) {
            return of(baseTm);
          }
          if (url === `threat_models/${tmId}/notes`) {
            return of({ notes: [mockNoteListItem], total: 1, limit: 100, offset: 0 });
          }
          if (url === `threat_models/${tmId}/notes/n1`) {
            return of(mockNoteFull);
          }
          if (url === `threat_models/${tmId}/documents`) {
            return of({ documents: [mockDoc], total: 1, limit: 100, offset: 0 });
          }
          if (url === `threat_models/${tmId}/repositories`) {
            return of({ repositories: [mockRepo], total: 1, limit: 100, offset: 0 });
          }
          if (url === `threat_models/${tmId}/assets`) {
            return of({ assets: [mockAsset], total: 1, limit: 100, offset: 0 });
          }
          if (url === `threat_models/${tmId}/diagrams`) {
            return of({ diagrams: [mockDiagramListItem], total: 1, limit: 100, offset: 0 });
          }
          if (url === `threat_models/${tmId}/diagrams/dg1`) {
            return of(mockDiagramFull);
          }
          if (url === `threat_models/${tmId}/threats`) {
            return of({ threats: [mockThreat], total: 1, limit: 100, offset: 0 });
          }
          return of(undefined);
        });

        return new Promise<void>((resolve, reject) => {
          service.exportThreatModel(tmId).subscribe({
            next: result => {
              try {
                expect(result).toBeDefined();
                // Notes should be the full version with content
                expect(result!.notes).toEqual([mockNoteFull]);
                expect(result!.notes![0].content).toBe('full note content');
                expect(result!.documents).toEqual([mockDoc]);
                expect(result!.repositories).toEqual([mockRepo]);
                expect(result!.assets).toEqual([mockAsset]);
                // Diagrams should be the full version with cells
                expect(result!.diagrams).toEqual([mockDiagramFull]);
                expect(result!.diagrams![0].cells).toEqual([{ id: 'cell1', type: 'node' }]);
                expect(result!.threats).toEqual([mockThreat]);
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
            error: err => reject(err instanceof Error ? err : new Error(String(err))),
          });
        });
      }));

    it('should paginate through multiple pages of sub-entities', () =>
      waitForAsync(async () => {
        const baseTm = {
          ...testThreatModel1,
          authorization: [],
          diagrams: [],
          threats: [],
        };

        const noteListItems = Array.from({ length: 3 }, (_, i) => ({
          id: `n${i}`,
          name: `Note ${i}`,
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        }));
        const notesFull = noteListItems.map(item => ({
          ...item,
          content: `content ${item.id}`,
        }));

        vi.mocked(apiService.get).mockImplementation(
          (url: string, params?: Record<string, string>) => {
            if (url === `threat_models/${tmId}`) {
              return of(baseTm);
            }
            if (url === `threat_models/${tmId}/notes`) {
              const offset = parseInt(params?.['offset'] || '0', 10);
              const limit = parseInt(params?.['limit'] || '100', 10);
              // Simulate pages of size 2 with 3 total items
              const page = noteListItems.slice(offset, offset + Math.min(limit, 2));
              return of({ notes: page, total: 3, limit: Math.min(limit, 2), offset });
            }
            // Individual note fetches return full objects with content
            const noteMatch = url.match(new RegExp(`threat_models/${tmId}/notes/(n\\d+)`));
            if (noteMatch) {
              return of(notesFull.find(n => n.id === noteMatch[1]));
            }
            // Single-page responses for other sub-entities
            if (url === `threat_models/${tmId}/documents`) {
              return of({ documents: [], total: 0, limit: 100, offset: 0 });
            }
            if (url === `threat_models/${tmId}/repositories`) {
              return of({ repositories: [], total: 0, limit: 100, offset: 0 });
            }
            if (url === `threat_models/${tmId}/assets`) {
              return of({ assets: [], total: 0, limit: 100, offset: 0 });
            }
            if (url === `threat_models/${tmId}/diagrams`) {
              return of({ diagrams: [], total: 0, limit: 100, offset: 0 });
            }
            if (url === `threat_models/${tmId}/threats`) {
              return of({ threats: [], total: 0, limit: 100, offset: 0 });
            }
            return of(undefined);
          },
        );

        return new Promise<void>((resolve, reject) => {
          service.exportThreatModel(tmId).subscribe({
            next: result => {
              try {
                expect(result).toBeDefined();
                expect(result!.notes).toHaveLength(3);
                expect(result!.notes![0].id).toBe('n0');
                expect(result!.notes![0].content).toBe('content n0');
                expect(result!.notes![2].id).toBe('n2');
                expect(result!.notes![2].content).toBe('content n2');
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
            error: err => reject(err instanceof Error ? err : new Error(String(err))),
          });
        });
      }));

    it('should terminate when server returns empty items despite total suggesting more pages', () =>
      waitForAsync(async () => {
        const baseTm = {
          ...testThreatModel1,
          authorization: [],
          diagrams: [],
          threats: [],
        };

        const noteListItems = [
          {
            id: 'n0',
            name: 'Note 0',
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
          },
          {
            id: 'n1',
            name: 'Note 1',
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
          },
          {
            id: 'n2',
            name: 'Note 2',
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
          },
        ];

        vi.mocked(apiService.get).mockImplementation(
          (url: string, params?: Record<string, string>) => {
            if (url === `threat_models/${tmId}`) {
              return of(baseTm);
            }
            if (url === `threat_models/${tmId}/notes`) {
              const offset = parseInt(params?.['offset'] || '0', 10);
              if (offset === 0) {
                // First page: returns all 3 notes
                return of({ notes: noteListItems, total: 3, limit: 100, offset: 0 });
              }
              // Second page: server returns empty items but broken total/offset
              // This previously caused an infinite loop
              return of({ notes: [], total: 3, limit: 100, offset });
            }
            // Individual note fetches
            const noteMatch = url.match(new RegExp(`threat_models/${tmId}/notes/(n\\d+)`));
            if (noteMatch) {
              const item = noteListItems.find(n => n.id === noteMatch[1]);
              return of(item ? { ...item, content: 'content' } : undefined);
            }
            if (url === `threat_models/${tmId}/documents`) {
              return of({ documents: [], total: 0, limit: 100, offset: 0 });
            }
            if (url === `threat_models/${tmId}/repositories`) {
              return of({ repositories: [], total: 0, limit: 100, offset: 0 });
            }
            if (url === `threat_models/${tmId}/assets`) {
              return of({ assets: [], total: 0, limit: 100, offset: 0 });
            }
            if (url === `threat_models/${tmId}/diagrams`) {
              return of({ diagrams: [], total: 0, limit: 100, offset: 0 });
            }
            if (url === `threat_models/${tmId}/threats`) {
              return of({ threats: [], total: 0, limit: 100, offset: 0 });
            }
            return of(undefined);
          },
        );

        return new Promise<void>((resolve, reject) => {
          service.exportThreatModel(tmId).subscribe({
            next: result => {
              try {
                expect(result).toBeDefined();
                expect(result!.notes).toHaveLength(3);
                expect(result!.notes![0].content).toBe('content');
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
            error: err => reject(err instanceof Error ? err : new Error(String(err))),
          });
        });
      }));

    it('should terminate when server omits pagination total field', () =>
      waitForAsync(async () => {
        const baseTm = {
          ...testThreatModel1,
          authorization: [],
          diagrams: [],
          threats: [],
        };

        const mockNoteListItem = {
          id: 'n1',
          name: 'Note 1',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        };
        const mockNoteFull = {
          ...mockNoteListItem,
          content: 'content',
        };

        vi.mocked(apiService.get).mockImplementation(
          (url: string, params?: Record<string, string>) => {
            if (url === `threat_models/${tmId}`) {
              return of(baseTm);
            }
            if (url === `threat_models/${tmId}/notes`) {
              const offset = parseInt(params?.['offset'] || '0', 10);
              if (offset === 0) {
                // Server returns items but no total field
                return of({ notes: [mockNoteListItem], limit: 100, offset: 0 } as any);
              }
              // Subsequent page: empty
              return of({ notes: [], limit: 100, offset } as any);
            }
            if (url === `threat_models/${tmId}/notes/n1`) {
              return of(mockNoteFull);
            }
            if (url === `threat_models/${tmId}/documents`) {
              return of({ documents: [], total: 0, limit: 100, offset: 0 });
            }
            if (url === `threat_models/${tmId}/repositories`) {
              return of({ repositories: [], total: 0, limit: 100, offset: 0 });
            }
            if (url === `threat_models/${tmId}/assets`) {
              return of({ assets: [], total: 0, limit: 100, offset: 0 });
            }
            if (url === `threat_models/${tmId}/diagrams`) {
              return of({ diagrams: [], total: 0, limit: 100, offset: 0 });
            }
            if (url === `threat_models/${tmId}/threats`) {
              return of({ threats: [], total: 0, limit: 100, offset: 0 });
            }
            return of(undefined);
          },
        );

        return new Promise<void>((resolve, reject) => {
          service.exportThreatModel(tmId).subscribe({
            next: result => {
              try {
                expect(result).toBeDefined();
                expect(result!.notes).toHaveLength(1);
                expect(result!.notes![0].id).toBe('n1');
                expect(result!.notes![0].content).toBe('content');
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
            error: err => reject(err instanceof Error ? err : new Error(String(err))),
          });
        });
      }));

    it('should return undefined when the threat model is not found', () =>
      waitForAsync(async () => {
        vi.mocked(apiService.get).mockReturnValue(of(undefined));

        return new Promise<void>((resolve, reject) => {
          service.exportThreatModel('nonexistent-id').subscribe({
            next: result => {
              try {
                expect(result).toBeUndefined();
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
            error: err => reject(err instanceof Error ? err : new Error(String(err))),
          });
        });
      }));

    it('should return undefined when an API error occurs', () =>
      waitForAsync(async () => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('Network error')));

        return new Promise<void>((resolve, reject) => {
          service.exportThreatModel(tmId).subscribe({
            next: result => {
              try {
                expect(result).toBeUndefined();
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
            error: err => reject(err instanceof Error ? err : new Error(String(err))),
          });
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // Sub-entity list getters
  //
  // getDiagramsForThreatModel / getDocumentsForThreatModel /
  // getRepositoriesForThreatModel / getNotesForThreatModel /
  // getAssetsForThreatModel share a uniform shape: build optional pagination
  // params, GET the collection endpoint, and on error return an empty-list
  // response (never throw).
  // ---------------------------------------------------------------------------
  describe('Sub-entity list getters', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';

    it('getDiagramsForThreatModel passes limit/offset params and returns the response', () =>
      new Promise<void>((resolve, reject) => {
        const response = { diagrams: [{ id: 'd1' }], total: 1, limit: 10, offset: 0 };
        vi.mocked(apiService.get).mockReturnValue(of(response));

        service.getDiagramsForThreatModel(tmId, 10, 0).subscribe({
          next: result => {
            try {
              expect(result).toEqual(response);
              expect(apiService.get).toHaveBeenCalledWith(`threat_models/${tmId}/diagrams`, {
                limit: '10',
                offset: '0',
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('getDiagramsForThreatModel omits params when limit/offset are undefined', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(
          of({ diagrams: [], total: 0, limit: 0, offset: 0 }),
        );

        service.getDiagramsForThreatModel(tmId).subscribe({
          next: () => {
            try {
              expect(apiService.get).toHaveBeenCalledWith(`threat_models/${tmId}/diagrams`, {});
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('getDiagramsForThreatModel returns an empty list on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('boom')));

        service.getDiagramsForThreatModel(tmId).subscribe({
          next: result => {
            try {
              expect(result).toEqual({ diagrams: [], total: 0, limit: 0, offset: 0 });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('getDocumentsForThreatModel returns an empty list on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('boom')));

        service.getDocumentsForThreatModel(tmId).subscribe({
          next: result => {
            try {
              expect(result).toEqual({ documents: [], total: 0, limit: 0, offset: 0 });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('getRepositoriesForThreatModel returns an empty list on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('boom')));

        service.getRepositoriesForThreatModel(tmId).subscribe({
          next: result => {
            try {
              expect(result).toEqual({ repositories: [], total: 0, limit: 0, offset: 0 });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('getNotesForThreatModel returns an empty list on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('boom')));

        service.getNotesForThreatModel(tmId).subscribe({
          next: result => {
            try {
              expect(result).toEqual({ notes: [], total: 0, limit: 0, offset: 0 });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('getAssetsForThreatModel passes params and returns an empty list on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('boom')));

        service.getAssetsForThreatModel(tmId, 5).subscribe({
          next: result => {
            try {
              expect(result).toEqual({ assets: [], total: 0, limit: 0, offset: 0 });
              expect(apiService.get).toHaveBeenCalledWith(`threat_models/${tmId}/assets`, {
                limit: '5',
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // getDiagramById — single diagram fetch
  // ---------------------------------------------------------------------------
  describe('getDiagramById', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';

    it('returns the diagram from the API', () =>
      new Promise<void>((resolve, reject) => {
        const diagram = { id: 'diag-1', name: 'DFD' } as unknown as Diagram;
        vi.mocked(apiService.get).mockReturnValue(of(diagram));

        service.getDiagramById(tmId, 'diag-1').subscribe({
          next: result => {
            try {
              expect(result).toEqual(diagram);
              expect(apiService.get).toHaveBeenCalledWith(`threat_models/${tmId}/diagrams/diag-1`);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('returns undefined on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('not found')));

        service.getDiagramById(tmId, 'diag-1').subscribe({
          next: result => {
            try {
              expect(result).toBeUndefined();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // Note CRUD — createNote / getNoteById / updateNote / deleteNote
  // create/update/delete rethrow on error; getNoteById swallows to undefined.
  // ---------------------------------------------------------------------------
  describe('Note API Methods', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';

    it('createNote POSTs to the notes endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const note = { id: 'n1', name: 'My Note', content: 'hi' };
        vi.mocked(apiService.post).mockReturnValue(of(note));

        service.createNote(tmId, { name: 'My Note', content: 'hi' }).subscribe({
          next: result => {
            try {
              expect(result).toEqual(note);
              expect(apiService.post).toHaveBeenCalledWith(`threat_models/${tmId}/notes`, {
                name: 'My Note',
                content: 'hi',
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('createNote rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.post).mockReturnValue(throwError(() => new Error('create failed')));

        service.createNote(tmId, { name: 'x' }).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('create failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('getNoteById returns the note', () =>
      new Promise<void>((resolve, reject) => {
        const note = { id: 'n1', name: 'Note' };
        vi.mocked(apiService.get).mockReturnValue(of(note));

        service.getNoteById(tmId, 'n1').subscribe({
          next: result => {
            try {
              expect(result).toEqual(note);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('getNoteById returns undefined on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('missing')));

        service.getNoteById(tmId, 'n1').subscribe({
          next: result => {
            try {
              expect(result).toBeUndefined();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('updateNote PUTs to the note endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const note = { id: 'n1', name: 'Updated' };
        vi.mocked(apiService.put).mockReturnValue(of(note));

        service.updateNote(tmId, 'n1', { name: 'Updated' }).subscribe({
          next: result => {
            try {
              expect(result).toEqual(note);
              expect(apiService.put).toHaveBeenCalledWith(`threat_models/${tmId}/notes/n1`, {
                name: 'Updated',
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('updateNote rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.put).mockReturnValue(throwError(() => new Error('update failed')));

        service.updateNote(tmId, 'n1', { name: 'x' }).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('update failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('deleteNote resolves to true on success', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.delete).mockReturnValue(of(undefined));

        service.deleteNote(tmId, 'n1').subscribe({
          next: result => {
            try {
              expect(result).toBe(true);
              expect(apiService.delete).toHaveBeenCalledWith(`threat_models/${tmId}/notes/n1`);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('deleteNote rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.delete).mockReturnValue(throwError(() => new Error('delete failed')));

        service.deleteNote(tmId, 'n1').subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('delete failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('getNoteMetadata GETs the note metadata endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const metadata = [{ key: 'k', value: 'v' }];
        vi.mocked(apiService.get).mockReturnValue(of(metadata));

        service.getNoteMetadata(tmId, 'n1').subscribe({
          next: result => {
            try {
              expect(result).toEqual(metadata);
              expect(apiService.get).toHaveBeenCalledWith(
                `threat_models/${tmId}/notes/n1/metadata`,
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('updateNoteMetadata PUTs to the bulk metadata endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const metadata = [{ key: 'k', value: 'v' }];
        vi.mocked(apiService.put).mockReturnValue(of(metadata));

        service.updateNoteMetadata(tmId, 'n1', metadata).subscribe({
          next: result => {
            try {
              expect(result).toEqual(metadata);
              expect(apiService.put).toHaveBeenCalledWith(
                `threat_models/${tmId}/notes/n1/metadata/bulk`,
                metadata,
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // Asset CRUD — createAsset / updateAsset / deleteAsset + metadata
  // ---------------------------------------------------------------------------
  describe('Asset API Methods', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';

    it('createAsset POSTs to the assets endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const asset = { id: 'a1', name: 'DB' };
        vi.mocked(apiService.post).mockReturnValue(of(asset));

        service.createAsset(tmId, { name: 'DB' }).subscribe({
          next: result => {
            try {
              expect(result).toEqual(asset);
              expect(apiService.post).toHaveBeenCalledWith(`threat_models/${tmId}/assets`, {
                name: 'DB',
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('createAsset rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.post).mockReturnValue(throwError(() => new Error('create failed')));

        service.createAsset(tmId, { name: 'x' }).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('create failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('updateAsset PUTs to the asset endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const asset = { id: 'a1', name: 'Updated' };
        vi.mocked(apiService.put).mockReturnValue(of(asset));

        service.updateAsset(tmId, 'a1', { name: 'Updated' }).subscribe({
          next: result => {
            try {
              expect(result).toEqual(asset);
              expect(apiService.put).toHaveBeenCalledWith(`threat_models/${tmId}/assets/a1`, {
                name: 'Updated',
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('deleteAsset resolves to true on success', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.delete).mockReturnValue(of(undefined));

        service.deleteAsset(tmId, 'a1').subscribe({
          next: result => {
            try {
              expect(result).toBe(true);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('deleteAsset rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.delete).mockReturnValue(throwError(() => new Error('delete failed')));

        service.deleteAsset(tmId, 'a1').subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('delete failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('getAssetMetadata returns an empty array on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('boom')));

        service.getAssetMetadata(tmId, 'a1').subscribe({
          next: result => {
            try {
              expect(result).toEqual([]);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('updateAssetMetadata PUTs to the bulk metadata endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const metadata = [{ key: 'k', value: 'v' }];
        vi.mocked(apiService.put).mockReturnValue(of(metadata));

        service.updateAssetMetadata(tmId, 'a1', metadata).subscribe({
          next: result => {
            try {
              expect(result).toEqual(metadata);
              expect(apiService.put).toHaveBeenCalledWith(
                `threat_models/${tmId}/assets/a1/metadata/bulk`,
                metadata,
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // Document / repository fetch + access-request helpers
  // ---------------------------------------------------------------------------
  describe('Document and repository helpers', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';

    it('getDocument GETs a single document', () =>
      new Promise<void>((resolve, reject) => {
        const doc = { id: 'doc-1', name: 'Spec' };
        vi.mocked(apiService.get).mockReturnValue(of(doc));

        service.getDocument(tmId, 'doc-1').subscribe({
          next: result => {
            try {
              expect(result).toEqual(doc);
              expect(apiService.get).toHaveBeenCalledWith(`threat_models/${tmId}/documents/doc-1`);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // Diagram PATCH operations — JSON Patch construction
  // ---------------------------------------------------------------------------
  describe('Diagram PATCH operations', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';
    const diagramId = 'diag-1';

    it('patchDiagramCells sends a single replace /cells operation', () =>
      new Promise<void>((resolve, reject) => {
        const diagram = { id: diagramId } as unknown as Diagram;
        vi.mocked(apiService.patch).mockReturnValue(of(diagram));
        const cells = [{ id: 'c1' }] as unknown as Parameters<typeof service.patchDiagramCells>[2];

        service.patchDiagramCells(tmId, diagramId, cells).subscribe({
          next: result => {
            try {
              expect(result).toEqual(diagram);
              expect(apiService.patch).toHaveBeenCalledWith(
                `threat_models/${tmId}/diagrams/${diagramId}`,
                [{ op: 'replace', path: '/cells', value: cells }],
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('patchDiagramWithImage sends /cells and /image operations and strips update_vector', () =>
      new Promise<void>((resolve, reject) => {
        const diagram = { id: diagramId } as unknown as Diagram;
        vi.mocked(apiService.patch).mockReturnValue(of(diagram));
        const cells = [] as unknown as Parameters<typeof service.patchDiagramWithImage>[2];

        service
          .patchDiagramWithImage(tmId, diagramId, cells, { svg: '<svg/>', update_vector: 7 })
          .subscribe({
            next: () => {
              try {
                expect(apiService.patch).toHaveBeenCalledWith(
                  `threat_models/${tmId}/diagrams/${diagramId}`,
                  [
                    { op: 'replace', path: '/cells', value: cells },
                    { op: 'replace', path: '/image', value: { svg: '<svg/>' } },
                  ],
                );
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
            error: err => reject(err instanceof Error ? err : new Error(String(err))),
          });
      }));

    it('patchDiagramProperties builds operations only for the provided fields', () =>
      new Promise<void>((resolve, reject) => {
        const diagram = { id: diagramId } as unknown as Diagram;
        vi.mocked(apiService.patch).mockReturnValue(of(diagram));

        service
          .patchDiagramProperties(tmId, diagramId, { name: 'New Name', timmy_enabled: false })
          .subscribe({
            next: () => {
              try {
                expect(apiService.patch).toHaveBeenCalledWith(
                  `threat_models/${tmId}/diagrams/${diagramId}`,
                  [
                    { op: 'replace', path: '/name', value: 'New Name' },
                    { op: 'replace', path: '/timmy_enabled', value: false },
                  ],
                );
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
            error: err => reject(err instanceof Error ? err : new Error(String(err))),
          });
      }));

    it('patchDiagramProperties errors when no properties are supplied', () =>
      new Promise<void>((resolve, reject) => {
        service.patchDiagramProperties(tmId, diagramId, {}).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('No properties to update');
              expect(apiService.patch).not.toHaveBeenCalled();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('updateDiagram PUTs the full diagram', () =>
      new Promise<void>((resolve, reject) => {
        const diagram = { id: diagramId, name: 'Replaced' } as unknown as Diagram;
        vi.mocked(apiService.put).mockReturnValue(of(diagram));

        service.updateDiagram(tmId, diagramId, { name: 'Replaced' }).subscribe({
          next: result => {
            try {
              expect(result).toEqual(diagram);
              expect(apiService.put).toHaveBeenCalledWith(
                `threat_models/${tmId}/diagrams/${diagramId}`,
                { name: 'Replaced' },
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // Threat query params + legacy field migration
  // ---------------------------------------------------------------------------
  describe('getThreatsForThreatModel and query params', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';

    it('passes no params when listParams is omitted', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(
          of({ threats: [], total: 0, limit: 0, offset: 0 }),
        );

        service.getThreatsForThreatModel(tmId).subscribe({
          next: () => {
            try {
              expect(apiService.get).toHaveBeenCalledWith(`threat_models/${tmId}/threats`, {});
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('builds numeric, string, text-trimmed, boolean and array query params', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(
          of({ threats: [], total: 0, limit: 0, offset: 0 }),
        );

        service
          .getThreatsForThreatModel(tmId, {
            limit: 25,
            offset: 0,
            score_gt: 5,
            sort: 'name',
            name: '  search  ',
            description: '   ',
            mitigated: false,
            severity: ['high', 'critical'],
            status: [],
          })
          .subscribe({
            next: () => {
              try {
                expect(apiService.get).toHaveBeenCalledWith(`threat_models/${tmId}/threats`, {
                  limit: '25',
                  offset: '0',
                  score_gt: '5',
                  sort: 'name',
                  name: 'search',
                  mitigated: false,
                  severity: ['high', 'critical'],
                });
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
            error: err => reject(err instanceof Error ? err : new Error(String(err))),
          });
      }));

    it('migrates legacy string severity/priority/status on returned threats', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(
          of({
            threats: [{ id: 't1', severity: 'High', priority: 'Immediate', status: 'Open' }],
            total: 1,
            limit: 10,
            offset: 0,
          }),
        );

        service.getThreatsForThreatModel(tmId).subscribe({
          next: result => {
            try {
              expect(result.threats[0].severity).toBe('1');
              expect(result.threats[0].priority).toBe('0');
              expect(result.threats[0].status).toBe('0');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('leaves already-numeric and unknown threat field values unchanged', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(
          of({
            threats: [{ id: 't1', severity: '2', priority: 'bogus', status: '9' }],
            total: 1,
            limit: 10,
            offset: 0,
          }),
        );

        service.getThreatsForThreatModel(tmId).subscribe({
          next: result => {
            try {
              expect(result.threats[0].severity).toBe('2');
              expect(result.threats[0].priority).toBe('bogus');
              expect(result.threats[0].status).toBe('9');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('returns an empty threats list on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('boom')));

        service.getThreatsForThreatModel(tmId).subscribe({
          next: result => {
            try {
              expect(result).toEqual({ threats: [], total: 0, limit: 0, offset: 0 });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // getThreatModelBasicInfo — derives a lightweight projection from the list
  // ---------------------------------------------------------------------------
  describe('getThreatModelBasicInfo', () => {
    it('returns a basic-info projection for a known threat model', () =>
      new Promise<void>((resolve, reject) => {
        const tm = testThreatModel1;
        vi.mocked(apiService.get).mockReturnValue(
          of({
            threat_models: [
              {
                id: tm.id,
                name: tm.name,
                description: tm.description,
                owner: tm.owner,
                created_at: tm.created_at,
                modified_at: tm.modified_at,
              },
            ],
            total: 1,
            limit: 100,
            offset: 0,
          }),
        );

        service.getThreatModelBasicInfo(tm.id).subscribe({
          next: result => {
            try {
              expect(result).toEqual({
                id: tm.id,
                name: tm.name,
                description: tm.description,
                owner: tm.owner,
                created_at: tm.created_at,
                modified_at: tm.modified_at,
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('returns undefined when the threat model is not in the list', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(
          of({ threat_models: [], total: 0, limit: 100, offset: 0 }),
        );

        service.getThreatModelBasicInfo('does-not-exist').subscribe({
          next: result => {
            try {
              expect(result).toBeUndefined();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // Collaboration session lifecycle
  // ---------------------------------------------------------------------------
  describe('Collaboration session methods', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';
    const diagramId = 'diag-1';

    it('startDiagramCollaborationSession POSTs to the collaborate endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const session = { session_id: 's1', participants: [] };
        vi.mocked(apiService.post).mockReturnValue(of(session));

        service.startDiagramCollaborationSession(tmId, diagramId).subscribe({
          next: result => {
            try {
              expect(result).toEqual(session);
              expect(apiService.post).toHaveBeenCalledWith(
                `threat_models/${tmId}/diagrams/${diagramId}/collaborate`,
                {},
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('startDiagramCollaborationSession rethrows as an Error on failure', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.post).mockReturnValue(throwError(() => 'string failure'));

        service.startDiagramCollaborationSession(tmId, diagramId).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect(err).toBeInstanceOf(Error);
              expect((err as Error).message).toBe('string failure');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('endDiagramCollaborationSession DELETEs the collaborate endpoint', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.delete).mockReturnValue(of(undefined));

        service.endDiagramCollaborationSession(tmId, diagramId).subscribe({
          next: () => {
            try {
              expect(apiService.delete).toHaveBeenCalledWith(
                `threat_models/${tmId}/diagrams/${diagramId}/collaborate`,
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('getDiagramCollaborationSession returns the session when one exists', () =>
      new Promise<void>((resolve, reject) => {
        const session = { session_id: 's1' };
        vi.mocked(apiService.get).mockReturnValue(of(session));

        service.getDiagramCollaborationSession(tmId, diagramId).subscribe({
          next: result => {
            try {
              expect(result).toEqual(session);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('getDiagramCollaborationSession returns null for an empty-object response', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(of({}));

        service.getDiagramCollaborationSession(tmId, diagramId).subscribe({
          next: result => {
            try {
              expect(result).toBeNull();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('getDiagramCollaborationSession returns null on a 404', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => ({ status: 404 })));

        service.getDiagramCollaborationSession(tmId, diagramId).subscribe({
          next: result => {
            try {
              expect(result).toBeNull();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('startOrJoinDiagramCollaborationSession returns the existing session without a POST', () =>
      new Promise<void>((resolve, reject) => {
        const session = { session_id: 's1' };
        vi.mocked(apiService.get).mockReturnValue(of(session));

        service.startOrJoinDiagramCollaborationSession(tmId, diagramId).subscribe({
          next: result => {
            try {
              expect(result).toEqual({ session, isNewSession: false });
              expect(apiService.post).not.toHaveBeenCalled();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('startOrJoinDiagramCollaborationSession creates a new session when none exists', () =>
      new Promise<void>((resolve, reject) => {
        const newSession = { session_id: 's2' };
        // GET resolves to {} (no session), POST creates one.
        vi.mocked(apiService.get).mockReturnValue(of({}));
        vi.mocked(apiService.post).mockReturnValue(of(newSession));

        service.startOrJoinDiagramCollaborationSession(tmId, diagramId).subscribe({
          next: result => {
            try {
              expect(result).toEqual({ session: newSession, isNewSession: true });
              expect(apiService.post).toHaveBeenCalledWith(
                `threat_models/${tmId}/diagrams/${diagramId}/collaborate`,
                {},
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // Document / repository CRUD + access requests
  // ---------------------------------------------------------------------------
  describe('Document and repository CRUD', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';

    it('createDocument POSTs to the documents endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const doc = { id: 'doc-1', name: 'Spec' };
        vi.mocked(apiService.post).mockReturnValue(of(doc));

        service.createDocument(tmId, { name: 'Spec' }).subscribe({
          next: result => {
            try {
              expect(result).toEqual(doc);
              expect(apiService.post).toHaveBeenCalledWith(`threat_models/${tmId}/documents`, {
                name: 'Spec',
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('createDocument rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.post).mockReturnValue(throwError(() => new Error('create failed')));

        service.createDocument(tmId, { name: 'x' }).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('create failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('updateDocument PUTs to the document endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const doc = { id: 'doc-1', name: 'Updated' };
        vi.mocked(apiService.put).mockReturnValue(of(doc));

        service.updateDocument(tmId, 'doc-1', { name: 'Updated' }).subscribe({
          next: result => {
            try {
              expect(result).toEqual(doc);
              expect(apiService.put).toHaveBeenCalledWith(`threat_models/${tmId}/documents/doc-1`, {
                name: 'Updated',
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('getDocument rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('missing')));

        service.getDocument(tmId, 'doc-1').subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('missing');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('requestDocumentAccess POSTs to the request_access endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const response = { status: 'requested', message: 'pending' };
        vi.mocked(apiService.post).mockReturnValue(of(response));

        service.requestDocumentAccess(tmId, 'doc-1').subscribe({
          next: result => {
            try {
              expect(result).toEqual(response);
              expect(apiService.post).toHaveBeenCalledWith(
                `threat_models/${tmId}/documents/doc-1/request_access`,
                {},
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('requestDocumentAccess rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.post).mockReturnValue(throwError(() => new Error('denied')));

        service.requestDocumentAccess(tmId, 'doc-1').subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('denied');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('deleteDocument resolves to true on success', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.delete).mockReturnValue(of(undefined));

        service.deleteDocument(tmId, 'doc-1').subscribe({
          next: result => {
            try {
              expect(result).toBe(true);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('createRepository POSTs to the repositories endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const repo = { id: 'r1', name: 'repo' };
        vi.mocked(apiService.post).mockReturnValue(of(repo));

        service.createRepository(tmId, { name: 'repo' }).subscribe({
          next: result => {
            try {
              expect(result).toEqual(repo);
              expect(apiService.post).toHaveBeenCalledWith(`threat_models/${tmId}/repositories`, {
                name: 'repo',
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('updateRepository PUTs to the repository endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const repo = { id: 'r1', name: 'updated' };
        vi.mocked(apiService.put).mockReturnValue(of(repo));

        service.updateRepository(tmId, 'r1', { name: 'updated' }).subscribe({
          next: result => {
            try {
              expect(result).toEqual(repo);
              expect(apiService.put).toHaveBeenCalledWith(`threat_models/${tmId}/repositories/r1`, {
                name: 'updated',
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('deleteRepository resolves to true on success', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.delete).mockReturnValue(of(undefined));

        service.deleteRepository(tmId, 'r1').subscribe({
          next: result => {
            try {
              expect(result).toBe(true);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('deleteRepository rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.delete).mockReturnValue(throwError(() => new Error('delete failed')));

        service.deleteRepository(tmId, 'r1').subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('delete failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('createDiagram rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.post).mockReturnValue(throwError(() => new Error('create failed')));

        service.createDiagram(tmId, { name: 'x' }).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('create failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // updateThreatModel / patchThreatModel / deleteThreatModel
  // ---------------------------------------------------------------------------
  describe('Threat model update/patch/delete', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';

    it('updateThreatModel PUTs the threat model', () =>
      new Promise<void>((resolve, reject) => {
        const updated = { ...testThreatModel1, name: 'Renamed' };
        vi.mocked(apiService.put).mockReturnValue(of(updated));

        service.updateThreatModel(tmId, { name: 'Renamed' }).subscribe({
          next: result => {
            try {
              expect(result).toEqual(updated);
              expect(apiService.put).toHaveBeenCalledWith(`threat_models/${tmId}`, {
                name: 'Renamed',
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('updateThreatModel rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.put).mockReturnValue(throwError(() => new Error('update failed')));

        service.updateThreatModel(tmId, { name: 'x' }).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('update failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('patchThreatModel converts updates to JSON Patch operations and caches the result', () =>
      new Promise<void>((resolve, reject) => {
        // tmId equals testThreatModel1.id, so the patched model is cached under it.
        const patched = { ...testThreatModel1, name: 'Patched' };
        vi.mocked(apiService.patch).mockReturnValue(of(patched));

        service.patchThreatModel(tmId, { name: 'Patched', description: 'New' }).subscribe({
          next: result => {
            try {
              expect(result).toEqual(patched);
              expect(apiService.patch).toHaveBeenCalledWith(`threat_models/${tmId}`, [
                { op: 'replace', path: '/name', value: 'Patched' },
                { op: 'replace', path: '/description', value: 'New' },
              ]);
              // The patched model is now cached: a subsequent read hits the
              // cache and issues no GET.
              vi.mocked(apiService.get).mockClear();
              service.getThreatModelById(tmId).subscribe({
                next: cached => {
                  try {
                    expect(cached).toEqual(patched);
                    expect(apiService.get).not.toHaveBeenCalled();
                    resolve();
                  } catch (e) {
                    reject(e instanceof Error ? e : new Error(String(e)));
                  }
                },
                error: err => reject(err instanceof Error ? err : new Error(String(err))),
              });
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('patchThreatModel transforms authorization providers and notifies the auth service', () =>
      new Promise<void>((resolve, reject) => {
        const patched = {
          ...testThreatModel1,
          authorization: [{ provider: '*', provider_id: 'u1', role: 'reader', display_name: 'X' }],
        };
        vi.mocked(apiService.patch).mockReturnValue(of(patched));

        service
          .patchThreatModel(tmId, {
            authorization: [{ provider: '*', provider_id: 'u1', role: 'reader' }] as never,
          })
          .subscribe({
            next: result => {
              try {
                // '*' provider transformed to 'tmi', display_name stripped
                expect(result.authorization?.[0].provider).toBe('tmi');
                expect('display_name' in (result.authorization?.[0] ?? {})).toBe(false);
                expect(authorizationService.updateAuthorization).toHaveBeenCalled();
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
            error: err => reject(err instanceof Error ? err : new Error(String(err))),
          });
      }));

    it('patchThreatModel rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.patch).mockReturnValue(throwError(() => new Error('patch failed')));

        service.patchThreatModel(tmId, { name: 'x' }).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('patch failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('deleteThreatModel resolves to true on success', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.delete).mockReturnValue(of(undefined));

        service.deleteThreatModel(tmId).subscribe({
          next: result => {
            try {
              expect(result).toBe(true);
              expect(apiService.delete).toHaveBeenCalledWith(`threat_models/${tmId}`);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('deleteThreatModel rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.delete).mockReturnValue(throwError(() => new Error('delete failed')));

        service.deleteThreatModel(tmId).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('delete failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // getDiagramModel — JSON vs text formats
  // ---------------------------------------------------------------------------
  describe('getDiagramModel', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';
    const diagramId = 'diag-1';

    it('stringifies the response for the json format', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(of({ cells: [] }));

        service.getDiagramModel(tmId, diagramId, 'json').subscribe({
          next: result => {
            try {
              expect(result).toBe(JSON.stringify({ cells: [] }, null, 2));
              expect(apiService.get).toHaveBeenCalledWith(
                `threat_models/${tmId}/diagrams/${diagramId}/model`,
                { format: 'json' },
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('uses getText for the yaml format', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.getText).mockReturnValue(of('cells: []'));

        service.getDiagramModel(tmId, diagramId, 'yaml').subscribe({
          next: result => {
            try {
              expect(result).toBe('cells: []');
              expect(apiService.getText).toHaveBeenCalledWith(
                `threat_models/${tmId}/diagrams/${diagramId}/model`,
                { format: 'yaml' },
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.getText).mockReturnValue(throwError(() => new Error('export failed')));

        service.getDiagramModel(tmId, diagramId, 'graphml').subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('export failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // importThreatModel — delegates to the import orchestrator
  // ---------------------------------------------------------------------------
  describe('importThreatModel', () => {
    it('returns the imported model on a successful orchestrated import', () =>
      new Promise<void>((resolve, reject) => {
        const imported = { ...testThreatModel1, id: 'new-id' };
        vi.mocked(importOrchestrator.orchestrateImport).mockReturnValue(
          of({ success: true, threatModel: imported, counts: {}, errors: [] }),
        );

        service.importThreatModel({ id: 'orig-id', name: 'Imported TM' }).subscribe({
          next: result => {
            try {
              expect(result).toEqual({ model: imported });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('rethrows when the orchestrated import reports failure', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(importOrchestrator.orchestrateImport).mockReturnValue(
          of({ success: false, threatModel: undefined, counts: {}, errors: ['bad data'] }),
        );

        service.importThreatModel({ id: 'orig-id', name: 'x' }).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toContain('bad data');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // getThreatModelById — cache, authorization transform, and error handling
  // ---------------------------------------------------------------------------
  describe('getThreatModelById', () => {
    it('returns a cached model without an API call and refreshes authorization', () =>
      new Promise<void>((resolve, reject) => {
        const tmId = testThreatModel1.id;
        // Prime the cache via a first fetch.
        vi.mocked(apiService.get).mockReturnValue(of(testThreatModel1));

        service.getThreatModelById(tmId).subscribe({
          next: () => {
            vi.mocked(apiService.get).mockClear();
            // Second call should hit the cache.
            service.getThreatModelById(tmId).subscribe({
              next: cached => {
                try {
                  expect(cached).toEqual(testThreatModel1);
                  expect(apiService.get).not.toHaveBeenCalled();
                  // testThreatModel1 has no authorization field, so the
                  // cached-read path forwards it through as undefined.
                  expect(authorizationService.setAuthorization).toHaveBeenCalledWith(
                    tmId,
                    testThreatModel1.authorization,
                    testThreatModel1.owner,
                  );
                  resolve();
                } catch (e) {
                  reject(e instanceof Error ? e : new Error(String(e)));
                }
              },
              error: err => reject(err instanceof Error ? err : new Error(String(err))),
            });
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('bypasses the cache when forceRefresh is true', () =>
      new Promise<void>((resolve, reject) => {
        const tmId = testThreatModel1.id;
        vi.mocked(apiService.get).mockReturnValue(of(testThreatModel1));

        service.getThreatModelById(tmId).subscribe({
          next: () => {
            vi.mocked(apiService.get).mockClear();
            vi.mocked(apiService.get).mockReturnValue(of(testThreatModel1));
            service.getThreatModelById(tmId, true).subscribe({
              next: () => {
                try {
                  expect(apiService.get).toHaveBeenCalledWith(`threat_models/${tmId}`);
                  resolve();
                } catch (e) {
                  reject(e instanceof Error ? e : new Error(String(e)));
                }
              },
              error: err => reject(err instanceof Error ? err : new Error(String(err))),
            });
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('transforms authorization providers (* to tmi) and strips display_name', () =>
      new Promise<void>((resolve, reject) => {
        const tmId = testThreatModel1.id;
        vi.mocked(apiService.get).mockReturnValue(
          of({
            ...testThreatModel1,
            authorization: [{ provider: '*', provider_id: 'u1', role: 'owner', display_name: 'X' }],
          }),
        );

        service.getThreatModelById(tmId, true).subscribe({
          next: result => {
            try {
              expect(result?.authorization?.[0].provider).toBe('tmi');
              expect('display_name' in (result?.authorization?.[0] ?? {})).toBe(false);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('migrates legacy threat field values on the loaded model', () =>
      new Promise<void>((resolve, reject) => {
        const tmId = testThreatModel1.id;
        vi.mocked(apiService.get).mockReturnValue(
          of({
            ...testThreatModel1,
            threats: [{ id: 't1', severity: 'low', priority: 'deferred', status: 'closed' }],
          }),
        );

        service.getThreatModelById(tmId, true).subscribe({
          next: result => {
            try {
              expect(result?.threats?.[0].severity).toBe('3');
              expect(result?.threats?.[0].priority).toBe('4');
              expect(result?.threats?.[0].status).toBe('9');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('returns undefined on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('not found')));

        service.getThreatModelById('missing-id', true).subscribe({
          next: result => {
            try {
              expect(result).toBeUndefined();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // fetchThreatModels — list query params
  // ---------------------------------------------------------------------------
  describe('fetchThreatModels query params', () => {
    it('builds limit/offset and string filter params', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(
          of({ threat_models: [], total: 0, limit: 0, offset: 0 }),
        );

        service
          .fetchThreatModels({ limit: 50, offset: 10, name: 'auth', status: 'active' })
          .subscribe({
            next: () => {
              try {
                expect(apiService.get).toHaveBeenCalledWith('threat_models', {
                  limit: '50',
                  offset: '10',
                  name: 'auth',
                  status: 'active',
                });
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
            error: err => reject(err instanceof Error ? err : new Error(String(err))),
          });
      }));

    it('refreshThreatModelList triggers a fetch', () => {
      vi.mocked(apiService.get).mockReturnValue(
        of({ threat_models: [], total: 0, limit: 0, offset: 0 }),
      );

      service.refreshThreatModelList();

      expect(apiService.get).toHaveBeenCalledWith('threat_models', {});
    });
  });

  // ---------------------------------------------------------------------------
  // Metadata getter error branches — these rethrow (unlike asset metadata)
  // ---------------------------------------------------------------------------
  describe('Metadata getter error handling', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';

    it('getThreatModelMetadata rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('meta failed')));

        service.getThreatModelMetadata(tmId).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('meta failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('getDiagramMetadata rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('meta failed')));

        service.getDiagramMetadata(tmId, 'd1').subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('meta failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('getThreatMetadata rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('meta failed')));

        service.getThreatMetadata(tmId, 't1').subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('meta failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('getDocumentMetadata rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('meta failed')));

        service.getDocumentMetadata(tmId, 'doc1').subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('meta failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('getRepositoryMetadata rethrows on API error', () =>
      new Promise<void>((resolve, reject) => {
        vi.mocked(apiService.get).mockReturnValue(throwError(() => new Error('meta failed')));

        service.getRepositoryMetadata(tmId, 'r1').subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toBe('meta failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));

    it('updateDiagramMetadata PUTs to the bulk endpoint', () =>
      new Promise<void>((resolve, reject) => {
        const metadata = [{ key: 'k', value: 'v' }];
        vi.mocked(apiService.put).mockReturnValue(of(metadata));

        service.updateDiagramMetadata(tmId, 'd1', metadata).subscribe({
          next: result => {
            try {
              expect(result).toEqual(metadata);
              expect(apiService.put).toHaveBeenCalledWith(
                `threat_models/${tmId}/diagrams/d1/metadata/bulk`,
                metadata,
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // ngOnDestroy — completes the list subject
  // ---------------------------------------------------------------------------
  describe('ngOnDestroy', () => {
    it('completes the threat model list subject', () =>
      new Promise<void>((resolve, reject) => {
        let completed = false;
        service.getThreatModelList().subscribe({
          complete: () => {
            completed = true;
          },
        });

        service.ngOnDestroy();

        // The subject completes synchronously on ngOnDestroy.
        try {
          expect(completed).toBe(true);
          resolve();
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      }));
  });

  // ---------------------------------------------------------------------------
  // patchThreatModel retry strategy (getRetryStrategy + isRetryableError)
  //
  // patchThreatModel is the only method wired through retryWhen. The retry
  // strategy retries transient errors (5xx, status 0, 408) with exponential
  // backoff and gives up immediately on client errors (4xx). Only the
  // deterministic no-retry branch is asserted here — the backoff-timed retry
  // path needs the RxJS TestScheduler and is left for a follow-up.
  // ---------------------------------------------------------------------------
  describe('patchThreatModel retry strategy', () => {
    const tmId = '550e8400-e29b-41d4-a716-446655440000';

    it('does not retry a 400 client error and propagates it immediately', () =>
      new Promise<void>((resolve, reject) => {
        const clientError = new HttpErrorResponse({ status: 400, statusText: 'Bad Request' });
        vi.mocked(apiService.patch).mockReturnValue(throwError(() => clientError));

        service.patchThreatModel(tmId, { name: 'x' }).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect(err).toBe(clientError);
              // No retry: exactly one call.
              expect(apiService.patch).toHaveBeenCalledTimes(1);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));
  });
});
