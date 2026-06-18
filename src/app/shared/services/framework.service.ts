import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of } from 'rxjs';
import { Framework, FrameworkModel } from '../models/framework.model';
import { LoggerService } from '../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
// SEM@645eb84233150889b73c2c94cbb443998221b2e4: fetch and convert threat framework JSON assets into in-memory models
export class FrameworkService {
  private readonly _frameworkAssetPath = '/assets/frameworks/';
  private readonly _frameworkFiles = [
    'stride.json',
    'linddun.json',
    'cia.json',
    'die.json',
    'plot4ai.json',
  ];

  // SEM@803b1d8eb3f22b9f4413abf177f94ae872078cc0: inject HTTP client and logger dependencies
  constructor(
    private http: HttpClient,
    private logger: LoggerService,
  ) {}

  /**
   * Load all framework JSON files and convert them to in-memory models
   */
  // SEM@645eb84233150889b73c2c94cbb443998221b2e4: fetch all threat framework assets in parallel and return as models
  loadAllFrameworks(): Observable<FrameworkModel[]> {
    // this.logger.info('Loading all framework files from assets');

    const frameworkRequests = this._frameworkFiles.map(fileName =>
      this.http.get<Framework>(`${this._frameworkAssetPath}${fileName}`),
    );

    return forkJoin(frameworkRequests).pipe(
      map(frameworks => {
        return frameworks.map(framework => this._convertToFrameworkModel(framework));
      }),
    );
  }

  /**
   * Load a specific framework by name
   */
  // SEM@803b1d8eb3f22b9f4413abf177f94ae872078cc0: fetch a single named threat framework asset and convert to model
  loadFramework(frameworkName: string): Observable<FrameworkModel | null> {
    const fileName = this._getFrameworkFileName(frameworkName);
    if (!fileName) {
      this.logger.warn('Unknown framework name', { frameworkName });
      return of(null);
    }

    return this.http.get<Framework>(`${this._frameworkAssetPath}${fileName}`).pipe(
      map(framework => {
        this.logger.info('Successfully loaded framework', { frameworkName });
        return this._convertToFrameworkModel(framework);
      }),
    );
  }

  /**
   * Convert Framework JSON structure to FrameworkModel
   */
  // SEM@803b1d8eb3f22b9f4413abf177f94ae872078cc0: convert raw framework JSON structure to a FrameworkModel (pure)
  private _convertToFrameworkModel(framework: Framework): FrameworkModel {
    return {
      name: framework['framework-name'],
      threatTypes: framework['threat-types'].map(threatType => ({
        name: threatType.name,
        appliesTo: threatType['applies-to'],
      })),
    };
  }

  /**
   * Get the appropriate JSON filename for a framework name
   */
  // SEM@803b1d8eb3f22b9f4413abf177f94ae872078cc0: map a framework name to its asset filename; return null if unknown (pure)
  private _getFrameworkFileName(frameworkName: string): string | null {
    const normalizedName = frameworkName.toLowerCase();
    const fileMap: Record<string, string> = {
      stride: 'stride.json',
      linddun: 'linddun.json',
      cia: 'cia.json',
      die: 'die.json',
      plot4ai: 'plot4ai.json',
    };

    return fileMap[normalizedName] || null;
  }
}
