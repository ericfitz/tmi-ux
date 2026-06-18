import { Injectable } from '@angular/core';
import { LoggerService } from '@app/core/services/logger.service';

/**
 * Service to manage SVG-related caches across threat model components
 * This ensures proper cache cleanup when navigating between threat model pages
 */
@Injectable({
  providedIn: 'root',
})
// SEM@c8dee1abe874e5b85fe25e7d3bbe1d4f26759478: cache SVG validation results and data URLs across threat model navigation (mutates shared state)
export class SvgCacheService {
  // Cache for SVG validation results
  private svgValidationCache = new Map<string, boolean>();

  // Cache for SVG data URLs to prevent recalculation
  private svgDataUrlCache = new Map<string, string>();

  // SEM@fa838e60ffa1932bc800ea6767510da97633c1e8: inject logger dependency
  constructor(private logger: LoggerService) {}

  /**
   * Check if SVG validation is cached
   * @param cacheKey The cache key
   * @returns True if validation result is cached
   */
  // SEM@fa838e60ffa1932bc800ea6767510da97633c1e8: check if an SVG validation result is cached for a given key (pure)
  hasValidationCache(cacheKey: string): boolean {
    return this.svgValidationCache.has(cacheKey);
  }

  /**
   * Get cached SVG validation result
   * @param cacheKey The cache key
   * @returns Cached validation result
   */
  // SEM@fa838e60ffa1932bc800ea6767510da97633c1e8: fetch a cached SVG validation result by key (pure)
  getValidationCache(cacheKey: string): boolean | undefined {
    return this.svgValidationCache.get(cacheKey);
  }

  /**
   * Set SVG validation cache
   * @param cacheKey The cache key
   * @param isValid The validation result
   */
  // SEM@fa838e60ffa1932bc800ea6767510da97633c1e8: store an SVG validation result in the cache (mutates shared state)
  setValidationCache(cacheKey: string, isValid: boolean): void {
    this.svgValidationCache.set(cacheKey, isValid);
  }

  /**
   * Check if SVG data URL is cached
   * @param cacheKey The cache key
   * @returns True if data URL is cached
   */
  // SEM@fa838e60ffa1932bc800ea6767510da97633c1e8: check if an SVG data URL is cached for a given key (pure)
  hasDataUrlCache(cacheKey: string): boolean {
    return this.svgDataUrlCache.has(cacheKey);
  }

  /**
   * Get cached SVG data URL
   * @param cacheKey The cache key
   * @returns Cached data URL
   */
  // SEM@fa838e60ffa1932bc800ea6767510da97633c1e8: fetch a cached SVG data URL by key (pure)
  getDataUrlCache(cacheKey: string): string | undefined {
    return this.svgDataUrlCache.get(cacheKey);
  }

  /**
   * Set SVG data URL cache
   * @param cacheKey The cache key
   * @param dataUrl The data URL
   */
  // SEM@fa838e60ffa1932bc800ea6767510da97633c1e8: store an SVG data URL in the cache (mutates shared state)
  setDataUrlCache(cacheKey: string, dataUrl: string): void {
    this.svgDataUrlCache.set(cacheKey, dataUrl);
  }

  /**
   * Clear all SVG-related caches
   * This should be called when navigating away from threat models or initializing dashboard
   */
  // SEM@c8dee1abe874e5b85fe25e7d3bbe1d4f26759478: clear all SVG validation and data URL caches (mutates shared state)
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
  // SEM@fa838e60ffa1932bc800ea6767510da97633c1e8: return current SVG validation and data URL cache entry counts (pure)
  getCacheStats(): { validationCacheSize: number; dataUrlCacheSize: number } {
    return {
      validationCacheSize: this.svgValidationCache.size,
      dataUrlCacheSize: this.svgDataUrlCache.size,
    };
  }
}
