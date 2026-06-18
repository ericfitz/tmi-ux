import { Injectable } from '@angular/core';
import { LoggerService } from '../../../../core/services/logger.service';
import {
  ArchIconData,
  ArchIconManifest,
  ArchIconManifestEntry,
  ArchIconSearchResult,
} from '../../types/arch-icon.types';

/**
 * Architecture Icon Service
 *
 * Lazily loads the architecture icon manifest and provides
 * search, path resolution, and label/breadcrumb utilities.
 */
@Injectable({
  providedIn: 'root',
})
// SEM@ca308fb03ad87332d0865bc40ee7c392e48f78a1: fetch and search the architecture icon manifest; resolve icon paths and labels
export class ArchitectureIconService {
  private manifest: ArchIconManifestEntry[] = [];
  private loaded = false;
  private loadPromise: Promise<void> | null = null;

  // SEM@c6d35660fc666b0e17375cbb89bd0aacd17697d4: inject logger dependency for the architecture icon service (pure)
  constructor(private logger: LoggerService) {}

  /**
   * Lazily load the icon manifest. Safe to call multiple times;
   * subsequent calls return the same promise.
   */
  // SEM@c6d35660fc666b0e17375cbb89bd0aacd17697d4: lazily fetch the icon manifest once; subsequent calls return cached promise (mutates shared state)
  async loadManifest(): Promise<void> {
    if (this.loaded) {
      return;
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.fetchManifest();
    return this.loadPromise;
  }

  // SEM@c6d35660fc666b0e17375cbb89bd0aacd17697d4: fetch and parse the icon manifest JSON from the assets endpoint (mutates shared state)
  private async fetchManifest(): Promise<void> {
    try {
      const response = await fetch('assets/architecture-icons/manifest.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: ArchIconManifest = await response.json();
      this.manifest = data.icons ?? [];
      this.loaded = true;
      this.logger.debug(`ArchitectureIconService: loaded ${this.manifest.length} icons`);
    } catch (error) {
      this.logger.error('ArchitectureIconService: failed to load manifest', error);
      this.manifest = [];
      this.loadPromise = null;
    }
  }

  /**
   * Whether the manifest has been loaded.
   */
  // SEM@c6d35660fc666b0e17375cbb89bd0aacd17697d4: return whether the icon manifest has been successfully loaded (pure)
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Search icons using multi-token prefix matching (AND logic,
   * case-insensitive, order-independent).
   *
   * Returns results grouped by provider+subcategory, sorted alphabetically.
   */
  // SEM@c6d35660fc666b0e17375cbb89bd0aacd17697d4: filter icons by multi-token prefix query; return results grouped by provider and subcategory (pure)
  search(query: string): ArchIconSearchResult[] {
    if (!this.loaded || !query || !query.trim()) {
      return [];
    }

    const queryTokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 0);

    if (queryTokens.length === 0) {
      return [];
    }

    // Filter icons: every query token must prefix-match at least one icon token
    const matched = this.manifest.filter(entry =>
      queryTokens.every(qt => entry.tokens.some(et => et.startsWith(qt))),
    );

    // Group by provider + subcategory
    const groups = new Map<string, ArchIconSearchResult>();
    for (const entry of matched) {
      const key = `${entry.provider}·${entry.subcategory}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          provider: entry.provider,
          subcategory: entry.subcategory,
          icons: [],
        };
        groups.set(key, group);
      }
      group.icons.push(entry);
    }

    // Sort groups alphabetically by key, then icons within each group by label
    const results = Array.from(groups.values()).sort((a, b) => {
      const keyA = `${a.provider}·${a.subcategory}`;
      const keyB = `${b.provider}·${b.subcategory}`;
      return keyA.localeCompare(keyB);
    });

    for (const group of results) {
      group.icons.sort((a, b) => a.label.localeCompare(b.label));
    }

    return results;
  }

  /**
   * Resolve SVG asset path for an ArchIconData reference.
   * Uses the manifest path field when available, falls back to
   * reconstructing from parts.
   */
  // SEM@ca308fb03ad87332d0865bc40ee7c392e48f78a1: resolve the SVG asset path for an icon reference using the manifest (pure)
  getIconPath(arch: ArchIconData): string {
    const entry = this.manifest.find(e => e.provider === arch.provider && e.icon === arch.icon);
    if (entry) {
      return `assets/architecture-icons/${entry.path}`;
    }
    // Fallback: reconstruct from parts (skip subcategory when it equals type to avoid duplication)
    const base =
      arch.subcategory && arch.subcategory !== arch.type
        ? `${arch.provider}/${arch.type}/${arch.subcategory}`
        : `${arch.provider}/${arch.type}`;
    return `assets/architecture-icons/${base}/${arch.icon}.svg`;
  }

  /**
   * Resolve SVG asset path directly from a manifest entry.
   */
  // SEM@c6d35660fc666b0e17375cbb89bd0aacd17697d4: resolve SVG asset path from a manifest entry (pure)
  getIconPathFromEntry(entry: ArchIconManifestEntry): string {
    return `assets/architecture-icons/${entry.path}`;
  }

  /**
   * Get display label for an icon. Returns the manifest label if found,
   * otherwise falls back to a humanized version of the filename.
   */
  // SEM@c6d35660fc666b0e17375cbb89bd0aacd17697d4: fetch display label for an icon, falling back to humanized filename (pure)
  getIconLabel(arch: ArchIconData): string {
    const entry = this.manifest.find(e => e.provider === arch.provider && e.icon === arch.icon);
    if (entry) {
      return entry.label;
    }
    return this.humanizeFilename(arch.icon);
  }

  /**
   * Get breadcrumb string for an icon, e.g. "AWS · Services · Compute".
   */
  // SEM@c6d35660fc666b0e17375cbb89bd0aacd17697d4: format icon provider, type, and subcategory as a breadcrumb string (pure)
  getIconBreadcrumb(arch: ArchIconData): string {
    const provider = arch.provider.toUpperCase();
    const type = this.capitalize(arch.type);
    const subcategory = this.capitalize(arch.subcategory);
    return `${provider} · ${type} · ${subcategory}`;
  }

  /**
   * Convert a kebab-case filename to a human-readable label.
   * e.g. "amazon-ec2" → "Amazon Ec2"
   */
  // SEM@c6d35660fc666b0e17375cbb89bd0aacd17697d4: convert a kebab-case icon filename to a human-readable label (pure)
  private humanizeFilename(filename: string): string {
    return filename
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // SEM@c6d35660fc666b0e17375cbb89bd0aacd17697d4: convert first character of a string to uppercase (pure)
  private capitalize(value: string): string {
    if (!value) {
      return value;
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
