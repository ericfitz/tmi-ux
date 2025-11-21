import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of } from 'rxjs';
import { Framework, FrameworkModel } from '../models/framework.model';
import { LoggerService } from '../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
export class FrameworkService {
  private readonly _frameworkAssetPath = '/assets/frameworks/';
  private readonly _frameworkFiles = [
    'stride.json',
    'linddun.json',
    'cia.json',
    'die.json',
    'plot4ai.json',
  ];

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
  ) {}

  /**
   * Load all framework JSON files and convert them to in-memory models
   */
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
