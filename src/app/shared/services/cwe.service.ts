import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, map } from 'rxjs';
import { CweDataFile, CweWeakness } from '../models/cwe.model';
import { LoggerService } from '../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
// SEM@dd4f585071231faa7be62ea453727e96148a393a: fetch and search CWE-699 weakness definitions from a bundled asset
export class CweService {
  private readonly _cweAssetPath = '/assets/cwe/cwe-699.json';
  private _cache$: Observable<CweWeakness[]> | null = null;

  // SEM@dd4f585071231faa7be62ea453727e96148a393a: inject HTTP client and logger dependencies (pure)
  constructor(
    private http: HttpClient,
    private logger: LoggerService,
  ) {}

  /**
   * Load all CWE-699 weaknesses from the static asset file.
   * Results are cached for the lifetime of the service.
   */
  // SEM@dd4f585071231faa7be62ea453727e96148a393a: fetch all CWE weakness entries from the static asset, caching for the service lifetime
  loadWeaknesses(): Observable<CweWeakness[]> {
    if (!this._cache$) {
      this._cache$ = this.http.get<CweDataFile>(this._cweAssetPath).pipe(
        map(data => {
          this.logger.info('Loaded CWE weaknesses', { count: data.weaknesses.length });
          return data.weaknesses;
        }),
        shareReplay(1),
      );
    }
    return this._cache$;
  }

  /**
   * Filter weaknesses by a search query (full-text across ID, name, description).
   * Empty query returns all weaknesses.
   */
  // SEM@dd4f585071231faa7be62ea453727e96148a393a: filter CWE weaknesses by full-text query across ID, name, and description (pure)
  search(weaknesses: CweWeakness[], query: string): CweWeakness[] {
    const trimmed = query.trim();
    if (!trimmed) return weaknesses;
    const lower = trimmed.toLowerCase();
    return weaknesses.filter(
      w =>
        w.cwe_id.toLowerCase().includes(lower) ||
        w.name.toLowerCase().includes(lower) ||
        w.description.toLowerCase().includes(lower) ||
        w.extended_description.toLowerCase().includes(lower),
    );
  }
}
