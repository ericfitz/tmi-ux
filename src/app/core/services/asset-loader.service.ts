import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Service for optimized asset loading
 * This service helps with lazy loading images and other assets
 * to reduce initial bundle size
 */
@Injectable({
  providedIn: 'root',
})
export class AssetLoaderService {
  private loadedAssets = new Set<string>();
  private loadingPromises = new Map<string, Promise<string>>();
  private supportsWebP: boolean | null = null;

  constructor() {
    // Check WebP support
    void this.checkWebPSupport();
  }

  /**
   * Preload an image
   * @param src Image source path
   * @returns Promise that resolves when the image is loaded
   */
  preloadImage(src: string): Promise<string> {
    if (this.loadedAssets.has(src)) {
      return Promise.resolve(src);
    }

    if (this.loadingPromises.has(src)) {
      return this.loadingPromises.get(src)!;
    }

    const promise = new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.loadedAssets.add(src);
        this.loadingPromises.delete(src);
        resolve(src);
      };
      img.onerror = () => {
        this.loadingPromises.delete(src);
        reject(new Error(`Failed to load image: ${src}`));
      };
      img.src = src;
    });

    this.loadingPromises.set(src, promise);
    return promise;
  }

  /**
   * Get the optimal image format based on browser support
   * @param path Base path of the image without extension
   * @param originalExt Original extension (e.g., 'gif', 'png')
   * @returns Path with the optimal extension
   */
  getOptimalImagePath(path: string, originalExt: string): string {
    // In production, use WebP if supported
    if (environment.production && this.supportsWebP === true) {
      // Check if we have a WebP version in the webp subdirectory
      const baseName = path.substring(path.lastIndexOf('/') + 1);
      return `assets/images/webp/${baseName}.webp`;
    }

    // Otherwise use the original format
    return `${path}.${originalExt}`;
  }

  /**
   * Check if the browser supports WebP
   * @returns Promise that resolves to true if WebP is supported
   */
  private async checkWebPSupport(): Promise<boolean> {
    if (this.supportsWebP !== null) {
      return this.supportsWebP;
    }

    return new Promise<boolean>(resolve => {
      const webP = new Image();
      webP.onload = () => {
        this.supportsWebP = true;
        resolve(true);
      };
      webP.onerror = () => {
        this.supportsWebP = false;
        resolve(false);
      };
      webP.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
    });
  }
}
