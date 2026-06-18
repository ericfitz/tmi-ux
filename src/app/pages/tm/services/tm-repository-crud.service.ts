import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import type { components } from '@app/generated/api-types';

import { ThreatModelService } from './threat-model.service';
import { RepositoryFormResult } from './tm-dialog.service';
import { Repository, Metadata } from '../models/threat-model.model';

// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: type alias for the API repository input schema (pure)
type ApiRepositoryInput = components['schemas']['RepositoryInput'];

/** Repositories loaded for one page of the repositories sub-table. */
export interface RepositoriesPage {
  repositories: Repository[];
  total: number;
}

/**
 * Repository CRUD orchestration extracted from TmEditComponent. Owns the
 * form-value mapping and the ThreatModelService calls. Does NOT touch
 * repositoriesDataSource or pagination view state.
 */
@Injectable({ providedIn: 'root' })
// SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: orchestrate repository CRUD API calls for a threat model
export class TmRepositoryCrudService {
  // SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: inject ThreatModelService dependency
  constructor(private threatModelService: ThreatModelService) {}

  /** Map repository editor form values to a Partial<ApiRepositoryInput>. */
  // SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: convert repository form values to an API repository input payload (pure)
  buildRepositoryData(values: RepositoryFormResult): Partial<ApiRepositoryInput> {
    return {
      name: values.name,
      description: values.description || undefined,
      type: values.type,
      uri: values.uri,
      parameters: values.parameters,
      include_in_report: values.include_in_report,
    };
  }

  /** Load one page of repositories for a threat model. */
  // SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: fetch one page of repositories for a threat model (reads DB)
  loadRepositories(
    threatModelId: string,
    pageIndex: number,
    pageSize: number,
  ): Observable<RepositoriesPage> {
    const offset = calculateOffset(pageIndex, pageSize);
    return this.threatModelService
      .getRepositoriesForThreatModel(threatModelId, pageSize, offset)
      .pipe(
        map(response => ({
          repositories: response.repositories ?? [],
          total: response.total ?? 0,
        })),
      );
  }

  /** Create a repository from editor form values. */
  // SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: store a new repository for a threat model from form values (reads DB)
  createRepository(threatModelId: string, values: RepositoryFormResult): Observable<Repository> {
    return this.threatModelService.createRepository(
      threatModelId,
      this.buildRepositoryData(values),
    );
  }

  /** Update a repository from editor form values; emits the updated repository. */
  // SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: update an existing repository for a threat model from form values (reads DB)
  updateRepository(
    threatModelId: string,
    repositoryId: string,
    values: RepositoryFormResult,
  ): Observable<Repository> {
    return this.threatModelService.updateRepository(
      threatModelId,
      repositoryId,
      this.buildRepositoryData(values),
    );
  }

  /** Delete a repository; emits the success boolean. */
  // SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: delete a repository from a threat model by ID (reads DB)
  deleteRepository(threatModelId: string, repositoryId: string): Observable<boolean> {
    return this.threatModelService.deleteRepository(threatModelId, repositoryId);
  }

  /** Update a repository's metadata; emits the updated metadata array. */
  // SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: update metadata on a repository for a threat model (reads DB)
  updateRepositoryMetadata(
    threatModelId: string,
    repositoryId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateRepositoryMetadata(threatModelId, repositoryId, metadata);
  }
}
