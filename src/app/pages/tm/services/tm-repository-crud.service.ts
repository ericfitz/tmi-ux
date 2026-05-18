import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import type { ApiRepositoryInput } from '@app/generated/api-type-helpers';

import { ThreatModelService } from './threat-model.service';
import { RepositoryFormResult } from './tm-dialog.service';
import { Repository, Metadata } from '../models/threat-model.model';

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
export class TmRepositoryCrudService {
  constructor(private threatModelService: ThreatModelService) {}

  /** Map repository editor form values to a Partial<ApiRepositoryInput>. */
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
  createRepository(threatModelId: string, values: RepositoryFormResult): Observable<Repository> {
    return this.threatModelService.createRepository(
      threatModelId,
      this.buildRepositoryData(values),
    );
  }

  /** Update a repository from editor form values; emits the updated repository. */
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
  deleteRepository(threatModelId: string, repositoryId: string): Observable<boolean> {
    return this.threatModelService.deleteRepository(threatModelId, repositoryId);
  }

  /** Update a repository's metadata; emits the updated metadata array. */
  updateRepositoryMetadata(
    threatModelId: string,
    repositoryId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateRepositoryMetadata(threatModelId, repositoryId, metadata);
  }
}
