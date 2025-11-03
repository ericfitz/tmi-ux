import { Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import type {
  ThreatModel,
  Asset,
  Note,
  Threat,
  Metadata,
  Document as TMDocument,
  Repository,
} from '../../models/threat-model.model';
import type { Diagram } from '../../models/diagram.model';
import { IdTranslationService } from './id-translation.service';
import { ReadonlyFieldFilterService } from './readonly-field-filter.service';
import { ReferenceRewriterService } from './reference-rewriter.service';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Result of importing a nested object
 */
interface ImportResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  originalId?: string;
}

/**
 * Summary of the import operation
 */
export interface ImportSummary {
  success: boolean;
  threatModel?: ThreatModel;
  counts: {
    assets: { success: number; failed: number };
    notes: { success: number; failed: number };
    diagrams: { success: number; failed: number };
    threats: { success: number; failed: number };
    documents: { success: number; failed: number };
    repositories: { success: number; failed: number };
  };
  errors: string[];
}

/**
 * Dependencies needed for import orchestration
 */
export interface ImportDependencies {
  createThreatModel: (data: Record<string, unknown>) => Observable<ThreatModel>;
  createAsset: (tmId: string, asset: Record<string, unknown>) => Observable<Asset>;
  createNote: (tmId: string, note: Record<string, unknown>) => Observable<Note>;
  createDiagram: (tmId: string, diagram: Record<string, unknown>) => Observable<Diagram>;
  updateDiagram: (
    tmId: string,
    diagramId: string,
    diagram: Record<string, unknown>,
  ) => Observable<Diagram>;
  createThreat: (tmId: string, threat: Record<string, unknown>) => Observable<Threat>;
  createDocument: (tmId: string, document: Record<string, unknown>) => Observable<TMDocument>;
  createRepository: (tmId: string, repository: Record<string, unknown>) => Observable<Repository>;
  updateThreatModelMetadata: (tmId: string, metadata: Metadata[]) => Observable<Metadata[]>;
  updateAssetMetadata: (
    tmId: string,
    assetId: string,
    metadata: Metadata[],
  ) => Observable<Metadata[]>;
  updateNoteMetadata: (
    tmId: string,
    noteId: string,
    metadata: Metadata[],
  ) => Observable<Metadata[]>;
  updateDiagramMetadata: (
    tmId: string,
    diagramId: string,
    metadata: Metadata[],
  ) => Observable<Metadata[]>;
  updateThreatMetadata: (
    tmId: string,
    threatId: string,
    metadata: Metadata[],
  ) => Observable<Metadata[]>;
  updateDocumentMetadata: (
    tmId: string,
    documentId: string,
    metadata: Metadata[],
  ) => Observable<Metadata[]>;
  updateRepositoryMetadata: (
    tmId: string,
    repositoryId: string,
    metadata: Metadata[],
  ) => Observable<Metadata[]>;
}

/**
 * Orchestrates the import of a complete threat model with nested objects.
 * Handles dependency ordering, ID translation, and metadata management.
 */
@Injectable({
  providedIn: 'root',
})
export class ImportOrchestratorService {
  constructor(
    private _idTranslation: IdTranslationService,
    private _fieldFilter: ReadonlyFieldFilterService,
    private _referenceRewriter: ReferenceRewriterService,
    private _logger: LoggerService,
  ) {}

  /**
   * Orchestrates the complete import of a threat model with all nested objects.
   *
   * Import order:
   * 1. Create ThreatModel
   * 2. Create Assets (may be referenced by Threats)
   * 3. Create Notes (standalone)
   * 4. Create Documents (standalone)
   * 5. Create Repositories (standalone)
   * 6. Create Diagrams (contain cells with preserved IDs)
   * 7. Create Threats (reference Assets, Diagrams, Cells)
   * 8. Update metadata for all objects
   */
  orchestrateImport(
    importedData: Record<string, unknown>,
    deps: ImportDependencies,
  ): Observable<ImportSummary> {
    // Reset ID translation map for new import
    this._idTranslation.reset();

    const summary: ImportSummary = {
      success: false,
      counts: {
        assets: { success: 0, failed: 0 },
        notes: { success: 0, failed: 0 },
        diagrams: { success: 0, failed: 0 },
        threats: { success: 0, failed: 0 },
        documents: { success: 0, failed: 0 },
        repositories: { success: 0, failed: 0 },
      },
      errors: [],
    };

    // Step 1: Create threat model
    return this._createThreatModel(importedData, deps).pipe(
      switchMap(tmResult => {
        if (!tmResult.success || !tmResult.data) {
          summary.errors.push(tmResult.error || 'Failed to create threat model');
          return of(summary);
        }

        summary.threatModel = tmResult.data;
        const threatModelId = tmResult.data.id;

        // Store original TM ID if present
        if (typeof importedData['id'] === 'string') {
          this._idTranslation.setThreatModelId(importedData['id'], threatModelId);
        }

        // Step 2-7: Create nested objects in dependency order
        return this._importNestedObjects(importedData, threatModelId, deps, summary).pipe(
          map(() => {
            summary.success = true;
            this._logger.info('Import completed', this._idTranslation.getStats());
            return summary;
          }),
        );
      }),
      catchError(error => {
        this._logger.error('Import orchestration failed', error);
        summary.errors.push(
          `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return of(summary);
      }),
    );
  }

  /**
   * Creates the threat model (step 1)
   */
  private _createThreatModel(
    importedData: Record<string, unknown>,
    deps: ImportDependencies,
  ): Observable<ImportResult<ThreatModel>> {
    const { filtered, metadata } = this._fieldFilter.filterThreatModel(importedData);

    return deps.createThreatModel(filtered).pipe(
      switchMap(threatModel => {
        // Update metadata if present
        if (metadata && metadata.length > 0) {
          return deps.updateThreatModelMetadata(threatModel.id, metadata).pipe(
            map(() => ({
              success: true,
              data: { ...threatModel, metadata },
            })),
            catchError(error => {
              this._logger.warn('Failed to update threat model metadata', error);
              // Continue with import even if metadata fails
              return of({ success: true, data: threatModel });
            }),
          );
        }
        return of({ success: true, data: threatModel });
      }),
      catchError(error => {
        this._logger.error('Failed to create threat model', error);
        return of({
          success: false,
          error: `Failed to create threat model: ${error instanceof Error ? error.message : String(error)}`,
        });
      }),
    );
  }

  /**
   * Imports all nested objects in dependency order
   */
  private _importNestedObjects(
    importedData: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
    summary: ImportSummary,
  ): Observable<void> {
    // Step 2: Import Assets
    const assets$ = this._importAssets(importedData, threatModelId, deps, summary);

    // Step 3: Import Notes
    const notes$ = assets$.pipe(
      switchMap(() => this._importNotes(importedData, threatModelId, deps, summary)),
    );

    // Step 4: Import Documents
    const documents$ = notes$.pipe(
      switchMap(() => this._importDocuments(importedData, threatModelId, deps, summary)),
    );

    // Step 5: Import Repositories
    const repositories$ = documents$.pipe(
      switchMap(() => this._importRepositories(importedData, threatModelId, deps, summary)),
    );

    // Step 6: Import Diagrams
    const diagrams$ = repositories$.pipe(
      switchMap(() => this._importDiagrams(importedData, threatModelId, deps, summary)),
    );

    // Step 7: Import Threats (depends on Assets and Diagrams)
    return diagrams$.pipe(
      switchMap(() => this._importThreats(importedData, threatModelId, deps, summary)),
      map(() => undefined),
    );
  }

  /**
   * Imports assets (step 2)
   */
  private _importAssets(
    importedData: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
    summary: ImportSummary,
  ): Observable<void> {
    const assets = (importedData['assets'] as Record<string, unknown>[]) || [];
    if (assets.length === 0) {
      return of(undefined);
    }

    const imports$ = assets.map(asset => this._importAsset(asset, threatModelId, deps));

    return forkJoin(imports$).pipe(
      map(results => {
        results.forEach(result => {
          if (result.success) {
            summary.counts.assets.success++;
          } else {
            summary.counts.assets.failed++;
            if (result.error) {
              summary.errors.push(`Asset import failed: ${result.error}`);
            }
          }
        });
      }),
      catchError(error => {
        this._logger.error('Asset import batch failed', error);
        summary.errors.push(`Asset batch import failed: ${String(error)}`);
        return of(undefined);
      }),
    );
  }

  private _importAsset(
    asset: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
  ): Observable<ImportResult<Asset>> {
    const originalId = asset['id'] as string | undefined;
    const { filtered, metadata } = this._fieldFilter.filterAsset(asset);
    const rewritten = this._referenceRewriter.rewriteAssetReferences(filtered);

    return deps.createAsset(threatModelId, rewritten).pipe(
      switchMap(created => {
        // Track ID translation
        if (originalId) {
          this._idTranslation.setAssetId(originalId, created.id);
        }

        // Update metadata if present
        if (metadata && metadata.length > 0) {
          return deps.updateAssetMetadata(threatModelId, created.id, metadata).pipe(
            map(() => ({ success: true, data: created, originalId })),
            catchError(error => {
              this._logger.warn(`Failed to update asset metadata for ${created.id}`, error);
              return of({ success: true, data: created, originalId });
            }),
          );
        }

        return of({ success: true, data: created, originalId });
      }),
      catchError(error => {
        this._logger.warn(`Failed to import asset ${originalId || 'unknown'}`, error);
        return of({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          originalId,
        });
      }),
    );
  }

  /**
   * Imports notes (step 3)
   */
  private _importNotes(
    importedData: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
    summary: ImportSummary,
  ): Observable<void> {
    const notes = (importedData['notes'] as Record<string, unknown>[]) || [];
    if (notes.length === 0) {
      return of(undefined);
    }

    const imports$ = notes.map(note => this._importNote(note, threatModelId, deps));

    return forkJoin(imports$).pipe(
      map(results => {
        results.forEach(result => {
          if (result.success) {
            summary.counts.notes.success++;
          } else {
            summary.counts.notes.failed++;
            if (result.error) {
              summary.errors.push(`Note import failed: ${result.error}`);
            }
          }
        });
      }),
      catchError(error => {
        this._logger.error('Note import batch failed', error);
        summary.errors.push(`Note batch import failed: ${String(error)}`);
        return of(undefined);
      }),
    );
  }

  private _importNote(
    note: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
  ): Observable<ImportResult<Note>> {
    const originalId = note['id'] as string | undefined;
    const { filtered, metadata } = this._fieldFilter.filterNote(note);
    const rewritten = this._referenceRewriter.rewriteNoteReferences(filtered);

    return deps.createNote(threatModelId, rewritten).pipe(
      switchMap(created => {
        // Track ID translation
        if (originalId) {
          this._idTranslation.setNoteId(originalId, created.id);
        }

        // Update metadata if present
        if (metadata && metadata.length > 0) {
          return deps.updateNoteMetadata(threatModelId, created.id, metadata).pipe(
            map(() => ({ success: true, data: created, originalId })),
            catchError(error => {
              this._logger.warn(`Failed to update note metadata for ${created.id}`, error);
              return of({ success: true, data: created, originalId });
            }),
          );
        }

        return of({ success: true, data: created, originalId });
      }),
      catchError(error => {
        this._logger.warn(`Failed to import note ${originalId || 'unknown'}`, error);
        return of({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          originalId,
        });
      }),
    );
  }

  /**
   * Imports documents (step 4)
   */
  private _importDocuments(
    importedData: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
    summary: ImportSummary,
  ): Observable<void> {
    const documents = (importedData['documents'] as Record<string, unknown>[]) || [];
    if (documents.length === 0) {
      return of(undefined);
    }

    const imports$ = documents.map(document => this._importDocument(document, threatModelId, deps));

    return forkJoin(imports$).pipe(
      map(results => {
        results.forEach(result => {
          if (result.success) {
            summary.counts.documents.success++;
          } else {
            summary.counts.documents.failed++;
            if (result.error) {
              summary.errors.push(`Document import failed: ${result.error}`);
            }
          }
        });
      }),
      catchError(error => {
        this._logger.error('Document import batch failed', error);
        summary.errors.push(`Document batch import failed: ${String(error)}`);
        return of(undefined);
      }),
    );
  }

  private _importDocument(
    document: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
  ): Observable<ImportResult<TMDocument>> {
    const originalId = document['id'] as string | undefined;
    const { filtered, metadata } = this._fieldFilter.filterDocument(document);
    const rewritten = this._referenceRewriter.rewriteDocumentReferences(filtered);

    return deps.createDocument(threatModelId, rewritten).pipe(
      switchMap(created => {
        // Track ID translation
        if (originalId) {
          this._idTranslation.setDocumentId(originalId, created.id);
        }

        // Update metadata if present
        if (metadata && metadata.length > 0) {
          return deps.updateDocumentMetadata(threatModelId, created.id, metadata).pipe(
            map(() => ({ success: true, data: created, originalId })),
            catchError(error => {
              this._logger.warn(`Failed to update document metadata for ${created.id}`, error);
              return of({ success: true, data: created, originalId });
            }),
          );
        }

        return of({ success: true, data: created, originalId });
      }),
      catchError(error => {
        this._logger.warn(`Failed to import document ${originalId || 'unknown'}`, error);
        return of({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          originalId,
        });
      }),
    );
  }

  /**
   * Imports repositories (step 5)
   */
  private _importRepositories(
    importedData: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
    summary: ImportSummary,
  ): Observable<void> {
    const repositories = (importedData['repositories'] as Record<string, unknown>[]) || [];
    if (repositories.length === 0) {
      return of(undefined);
    }

    const imports$ = repositories.map(repository =>
      this._importRepository(repository, threatModelId, deps),
    );

    return forkJoin(imports$).pipe(
      map(results => {
        results.forEach(result => {
          if (result.success) {
            summary.counts.repositories.success++;
          } else {
            summary.counts.repositories.failed++;
            if (result.error) {
              summary.errors.push(`Repository import failed: ${result.error}`);
            }
          }
        });
      }),
      catchError(error => {
        this._logger.error('Repository import batch failed', error);
        summary.errors.push(`Repository batch import failed: ${String(error)}`);
        return of(undefined);
      }),
    );
  }

  private _importRepository(
    repository: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
  ): Observable<ImportResult<Repository>> {
    const originalId = repository['id'] as string | undefined;
    const { filtered, metadata } = this._fieldFilter.filterRepository(repository);
    const rewritten = this._referenceRewriter.rewriteRepositoryReferences(filtered);

    return deps.createRepository(threatModelId, rewritten).pipe(
      switchMap(created => {
        // Track ID translation
        if (originalId) {
          this._idTranslation.setRepositoryId(originalId, created.id);
        }

        // Update metadata if present
        if (metadata && metadata.length > 0) {
          return deps.updateRepositoryMetadata(threatModelId, created.id, metadata).pipe(
            map(() => ({ success: true, data: created, originalId })),
            catchError(error => {
              this._logger.warn(`Failed to update repository metadata for ${created.id}`, error);
              return of({ success: true, data: created, originalId });
            }),
          );
        }

        return of({ success: true, data: created, originalId });
      }),
      catchError(error => {
        this._logger.warn(`Failed to import repository ${originalId || 'unknown'}`, error);
        return of({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          originalId,
        });
      }),
    );
  }

  /**
   * Imports diagrams (step 6)
   */
  private _importDiagrams(
    importedData: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
    summary: ImportSummary,
  ): Observable<void> {
    const diagrams = (importedData['diagrams'] as Record<string, unknown>[]) || [];
    if (diagrams.length === 0) {
      return of(undefined);
    }

    const imports$ = diagrams.map(diagram => this._importDiagram(diagram, threatModelId, deps));

    return forkJoin(imports$).pipe(
      map(results => {
        results.forEach(result => {
          if (result.success) {
            summary.counts.diagrams.success++;
          } else {
            summary.counts.diagrams.failed++;
            if (result.error) {
              summary.errors.push(`Diagram import failed: ${result.error}`);
            }
          }
        });
      }),
      catchError(error => {
        this._logger.error('Diagram import batch failed', error);
        summary.errors.push(`Diagram batch import failed: ${String(error)}`);
        return of(undefined);
      }),
    );
  }

  private _importDiagram(
    diagram: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
  ): Observable<ImportResult<Diagram>> {
    const originalId = diagram['id'] as string | undefined;
    const { filtered, metadata, cells } = this._fieldFilter.filterDiagram(diagram);
    const rewritten = this._referenceRewriter.rewriteDiagramReferences(filtered);

    return deps.createDiagram(threatModelId, rewritten).pipe(
      switchMap(created => {
        // Track ID translation
        if (originalId) {
          this._idTranslation.setDiagramId(originalId, created.id);
        }

        // Update diagram with cells if present
        // Cells must be added via PUT after creation since CreateDiagramRequest doesn't accept them
        if (cells && cells.length > 0) {
          // Filter cells to match API schema (ensure edge 'shape' field is present)
          const filteredCells = this._fieldFilter.filterCells(cells);

          const diagramUpdate: Record<string, unknown> = {
            name: created.name,
            type: created.type,
            created_at: created.created_at,
            modified_at: created.modified_at,
            cells: filteredCells,
          };

          if (created.description) {
            diagramUpdate['description'] = created.description;
          }

          return deps.updateDiagram(threatModelId, created.id, diagramUpdate).pipe(
            switchMap(updatedDiagram => {
              // Update metadata if present
              if (metadata && metadata.length > 0) {
                return deps.updateDiagramMetadata(threatModelId, created.id, metadata).pipe(
                  map(() => ({ success: true, data: updatedDiagram, originalId })),
                  catchError(error => {
                    this._logger.warn(`Failed to update diagram metadata for ${created.id}`, error);
                    return of({ success: true, data: updatedDiagram, originalId });
                  }),
                );
              }
              return of({ success: true, data: updatedDiagram, originalId });
            }),
            catchError(error => {
              this._logger.warn(`Failed to update diagram cells for ${created.id}`, error);
              // Still consider it a success since diagram was created, just without cells
              return of({ success: true, data: created, originalId });
            }),
          );
        }

        // No cells to add, just update metadata if present
        if (metadata && metadata.length > 0) {
          return deps.updateDiagramMetadata(threatModelId, created.id, metadata).pipe(
            map(() => ({ success: true, data: created, originalId })),
            catchError(error => {
              this._logger.warn(`Failed to update diagram metadata for ${created.id}`, error);
              return of({ success: true, data: created, originalId });
            }),
          );
        }

        return of({ success: true, data: created, originalId });
      }),
      catchError(error => {
        this._logger.warn(`Failed to import diagram ${originalId || 'unknown'}`, error);
        return of({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          originalId,
        });
      }),
    );
  }

  /**
   * Imports threats (step 7) - must run after Assets and Diagrams
   */
  private _importThreats(
    importedData: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
    summary: ImportSummary,
  ): Observable<void> {
    const threats = (importedData['threats'] as Record<string, unknown>[]) || [];
    if (threats.length === 0) {
      return of(undefined);
    }

    const imports$ = threats.map(threat => this._importThreat(threat, threatModelId, deps));

    return forkJoin(imports$).pipe(
      map(results => {
        results.forEach(result => {
          if (result.success) {
            summary.counts.threats.success++;
          } else {
            summary.counts.threats.failed++;
            if (result.error) {
              summary.errors.push(`Threat import failed: ${result.error}`);
            }
          }
        });
      }),
      catchError(error => {
        this._logger.error('Threat import batch failed', error);
        summary.errors.push(`Threat batch import failed: ${String(error)}`);
        return of(undefined);
      }),
    );
  }

  private _importThreat(
    threat: Record<string, unknown>,
    threatModelId: string,
    deps: ImportDependencies,
  ): Observable<ImportResult<Threat>> {
    const originalId = threat['id'] as string | undefined;
    const { filtered, metadata } = this._fieldFilter.filterThreat(threat);
    // Rewrite references (diagram_id, asset_id) - cell_id is preserved
    const rewritten = this._referenceRewriter.rewriteThreatReferences(filtered);

    return deps.createThreat(threatModelId, rewritten).pipe(
      switchMap(created => {
        // Track ID translation
        if (originalId) {
          this._idTranslation.setThreatId(originalId, created.id);
        }

        // Update metadata if present
        if (metadata && metadata.length > 0) {
          return deps.updateThreatMetadata(threatModelId, created.id, metadata).pipe(
            map(() => ({ success: true, data: created, originalId })),
            catchError(error => {
              this._logger.warn(`Failed to update threat metadata for ${created.id}`, error);
              return of({ success: true, data: created, originalId });
            }),
          );
        }

        return of({ success: true, data: created, originalId });
      }),
      catchError(error => {
        this._logger.warn(`Failed to import threat ${originalId || 'unknown'}`, error);
        return of({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          originalId,
        });
      }),
    );
  }
}
