import { Injectable } from '@angular/core';
import { LoggerService } from '@app/core/services/logger.service';

/**
 * Service to manage SVG-related caches across threat model components
 * This ensures proper cache cleanup when navigating between threat model pages
 */
@Injectable({
  providedIn: 'root',
})
export class SvgCacheService {
  // Cache for SVG validation results
  private svgValidationCache = new Map<string, boolean>();

  // Cache for SVG data URLs to prevent recalculation
  private svgDataUrlCache = new Map<string, string>();

  constructor(private logger: LoggerService) {}

  /**
   * Check if SVG validation is cached
   * @param cacheKey The cache key
   * @returns True if validation result is cached
   */
  hasValidationCache(cacheKey: string): boolean {
    return this.svgValidationCache.has(cacheKey);
  }

  /**
   * Get cached SVG validation result
   * @param cacheKey The cache key
   * @returns Cached validation result
   */
  getValidationCache(cacheKey: string): boolean | undefined {
    return this.svgValidationCache.get(cacheKey);
  }

  /**
   * Set SVG validation cache
   * @param cacheKey The cache key
   * @param isValid The validation result
   */
  setValidationCache(cacheKey: string, isValid: boolean): void {
    this.svgValidationCache.set(cacheKey, isValid);
  }

  /**
   * Check if SVG data URL is cached
   * @param cacheKey The cache key
   * @returns True if data URL is cached
   */
  hasDataUrlCache(cacheKey: string): boolean {
    return this.svgDataUrlCache.has(cacheKey);
  }

  /**
   * Get cached SVG data URL
   * @param cacheKey The cache key
   * @returns Cached data URL
   */
  getDataUrlCache(cacheKey: string): string | undefined {
    return this.svgDataUrlCache.get(cacheKey);
  }

  /**
   * Set SVG data URL cache
   * @param cacheKey The cache key
   * @param dataUrl The data URL
   */
  setDataUrlCache(cacheKey: string, dataUrl: string): void {
    this.svgDataUrlCache.set(cacheKey, dataUrl);
  }

  /**
   * Clear all SVG-related caches
   * This should be called when navigating away from threat models or initializing dashboard
   */
  clearAllCaches(): void {
    // const validationCount = this.svgValidationCache.size;
    // const dataUrlCount = this.svgDataUrlCache.size;

    this.svgValidationCache.clear();
    this.svgDataUrlCache.clear();

    // this.logger.debugComponent('SvgCacheService', 'SVG caches cleared', {
    //   validationCacheCleared: validationCount,
    //   dataUrlCacheCleared: dataUrlCount,
    // });
  }

  /**
   * Get cache statistics for debugging
   * @returns Cache size information
   */
  getCacheStats(): { validationCacheSize: number; dataUrlCacheSize: number } {
    return {
      validationCacheSize: this.svgValidationCache.size,
      dataUrlCacheSize: this.svgDataUrlCache.size,
    };
  }
}
