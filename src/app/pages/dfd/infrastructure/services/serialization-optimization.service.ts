import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

import { AnyDiagramCommand } from '../../domain/commands/diagram-commands';
import { AnyCollaborationEvent } from '../../domain/collaboration/collaboration-events';
import { DiagramSnapshot } from '../../domain/aggregates/diagram-aggregate';

/**
 * Configuration for serialization optimization
 */
export interface SerializationConfig {
  /** Enable compression for large payloads */
  enableCompression: boolean;
  /** Compression threshold in bytes */
  compressionThreshold: number;
  /** Enable binary serialization for better performance */
  enableBinarySerialization: boolean;
  /** Enable caching of serialized data */
  enableCaching: boolean;
  /** Maximum cache size in MB */
  maxCacheSize: number;
  /** Cache TTL in milliseconds */
  cacheTtl: number;
  /** Enable incremental serialization */
  enableIncrementalSerialization: boolean;
}

/**
 * Default configuration for serialization optimization
 */
export const DEFAULT_SERIALIZATION_CONFIG: SerializationConfig = {
  enableCompression: true,
  compressionThreshold: 1024, // 1KB
  enableBinarySerialization: false, // Disabled by default for compatibility
  enableCaching: true,
  maxCacheSize: 10, // 10MB
  cacheTtl: 300000, // 5 minutes
  enableIncrementalSerialization: true,
};

/**
 * Serialization format types
 */
export enum SerializationFormat {
  JSON = 'json',
  BINARY = 'binary',
  COMPRESSED_JSON = 'compressed_json',
  INCREMENTAL = 'incremental',
}

/**
 * Serialized data container
 */
export interface SerializedData {
  format: SerializationFormat;
  data: string | ArrayBuffer;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  timestamp: Date;
  checksum?: string;
}

/**
 * Cache entry for serialized data
 */
interface CacheEntry {
  data: SerializedData;
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
}

/**
 * Performance metrics for serialization operations
 */
export interface SerializationMetrics {
  totalSerializations: number;
  totalDeserializations: number;
  averageSerializationTime: number;
  averageDeserializationTime: number;
  totalDataSerialized: number;
  totalDataCompressed: number;
  averageCompressionRatio: number;
  cacheHitRate: number;
  cacheSize: number;
}

/**
 * Service for optimizing serialization performance
 */
@Injectable({
  providedIn: 'root',
})
export class SerializationOptimizationService {
  private readonly _config$ = new BehaviorSubject<SerializationConfig>(
    DEFAULT_SERIALIZATION_CONFIG,
  );
  private readonly _metrics$ = new BehaviorSubject<SerializationMetrics>({
    totalSerializations: 0,
    totalDeserializations: 0,
    averageSerializationTime: 0,
    averageDeserializationTime: 0,
    totalDataSerialized: 0,
    totalDataCompressed: 0,
    averageCompressionRatio: 1,
    cacheHitRate: 0,
    cacheSize: 0,
  });

  private readonly _cache = new Map<string, CacheEntry>();
  private readonly _serializationTimes: number[] = [];
  private readonly _deserializationTimes: number[] = [];
  private readonly _compressionRatios: number[] = [];
  private _cacheHits = 0;
  private _cacheMisses = 0;

  /**
   * Observable for configuration changes
   */
  public readonly config$: Observable<SerializationConfig> = this._config$.asObservable();

  /**
   * Observable for performance metrics
   */
  public readonly metrics$: Observable<SerializationMetrics> = this._metrics$.pipe(shareReplay(1));

  constructor() {
    // Setup cache cleanup interval
    setInterval(() => this._cleanupCache(), 60000); // Every minute
  }

  /**
   * Serialize a diagram command with optimization
   */
  serializeCommand(command: AnyDiagramCommand): SerializedData {
    const startTime = performance.now();
    const cacheKey = this._generateCacheKey('command', command.commandId);

    // Check cache first
    if (this._config$.value.enableCaching) {
      const cached = this._getCachedData(cacheKey);
      if (cached) {
        this._cacheHits++;
        this._updateMetrics();
        return cached;
      }
      this._cacheMisses++;
    }

    // Serialize the command
    const serialized = this._performSerialization(command, 'command');

    // Cache the result
    if (this._config$.value.enableCaching) {
      this._setCachedData(cacheKey, serialized);
    }

    // Record timing
    const serializationTime = performance.now() - startTime;
    this._serializationTimes.push(serializationTime);
    if (this._serializationTimes.length > 1000) {
      this._serializationTimes.shift();
    }

    this._updateMetrics();
    return serialized;
  }

  /**
   * Serialize a collaboration event with optimization
   */
  serializeEvent(event: AnyCollaborationEvent): SerializedData {
    const startTime = performance.now();
    const cacheKey = this._generateCacheKey('event', event.id);

    // Check cache first
    if (this._config$.value.enableCaching) {
      const cached = this._getCachedData(cacheKey);
      if (cached) {
        this._cacheHits++;
        this._updateMetrics();
        return cached;
      }
      this._cacheMisses++;
    }

    // Serialize the event
    const serialized = this._performSerialization(event, 'event');

    // Cache the result
    if (this._config$.value.enableCaching) {
      this._setCachedData(cacheKey, serialized);
    }

    // Record timing
    const serializationTime = performance.now() - startTime;
    this._serializationTimes.push(serializationTime);
    if (this._serializationTimes.length > 1000) {
      this._serializationTimes.shift();
    }

    this._updateMetrics();
    return serialized;
  }

  /**
   * Serialize a diagram snapshot with optimization
   */
  serializeDiagram(diagram: DiagramSnapshot): SerializedData {
    const startTime = performance.now();
    const cacheKey = this._generateCacheKey('diagram', `${diagram.id}_v${diagram.version}`);

    // Check cache first
    if (this._config$.value.enableCaching) {
      const cached = this._getCachedData(cacheKey);
      if (cached) {
        this._cacheHits++;
        this._updateMetrics();
        return cached;
      }
      this._cacheMisses++;
    }

    // Use incremental serialization for large diagrams
    const config = this._config$.value;
    let serialized: SerializedData;

    if (config.enableIncrementalSerialization && this._isLargeDiagram(diagram)) {
      serialized = this._performIncrementalSerialization(diagram);
    } else {
      serialized = this._performSerialization(diagram, 'diagram');
    }

    // Cache the result
    if (config.enableCaching) {
      this._setCachedData(cacheKey, serialized);
    }

    // Record timing
    const serializationTime = performance.now() - startTime;
    this._serializationTimes.push(serializationTime);
    if (this._serializationTimes.length > 1000) {
      this._serializationTimes.shift();
    }

    this._updateMetrics();
    return serialized;
  }

  /**
   * Deserialize data with optimization
   */
  deserialize<T>(serializedData: SerializedData): T {
    const startTime = performance.now();

    let result: T;

    switch (serializedData.format) {
      case SerializationFormat.JSON:
        result = JSON.parse(serializedData.data as string);
        break;
      case SerializationFormat.COMPRESSED_JSON:
        result = this._decompressAndParse(serializedData.data as string);
        break;
      case SerializationFormat.BINARY:
        result = this._deserializeBinary(serializedData.data as ArrayBuffer);
        break;
      case SerializationFormat.INCREMENTAL:
        result = this._deserializeIncremental(serializedData.data as string);
        break;
      default:
        throw new Error(`Unsupported serialization format: ${String(serializedData.format)}`);
    }

    // Record timing
    const deserializationTime = performance.now() - startTime;
    this._deserializationTimes.push(deserializationTime);
    if (this._deserializationTimes.length > 1000) {
      this._deserializationTimes.shift();
    }

    this._updateMetrics();
    return result;
  }

  /**
   * Update serialization configuration
   */
  updateConfig(config: Partial<SerializationConfig>): void {
    const currentConfig = this._config$.value;
    const newConfig = { ...currentConfig, ...config };
    this._config$.next(newConfig);
  }

  /**
   * Get current serialization metrics
   */
  getMetrics(): SerializationMetrics {
    return this._metrics$.value;
  }

  /**
   * Clear serialization cache
   */
  clearCache(): void {
    this._cache.clear();
    this._updateMetrics();
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    this.clearCache();
    this._config$.complete();
    this._metrics$.complete();
  }

  /**
   * Perform the actual serialization with format selection
   */
  private _performSerialization(data: any, type: string): SerializedData {
    const config = this._config$.value;
    const jsonString = JSON.stringify(data);
    const originalSize = new Blob([jsonString]).size;

    // Determine the best serialization format
    let format: SerializationFormat;
    let serializedData: string | ArrayBuffer;
    let compressedSize = originalSize;

    if (config.enableBinarySerialization && this._shouldUseBinary(data, type)) {
      format = SerializationFormat.BINARY;
      serializedData = this._serializeToBinary(data);
      compressedSize = serializedData.byteLength;
    } else if (config.enableCompression && originalSize > config.compressionThreshold) {
      format = SerializationFormat.COMPRESSED_JSON;
      serializedData = this._compressJson(jsonString);
      compressedSize = new Blob([serializedData]).size;
    } else {
      format = SerializationFormat.JSON;
      serializedData = jsonString;
    }

    const compressionRatio = originalSize / compressedSize;
    this._compressionRatios.push(compressionRatio);
    if (this._compressionRatios.length > 1000) {
      this._compressionRatios.shift();
    }

    return {
      format,
      data: serializedData,
      originalSize,
      compressedSize,
      compressionRatio,
      timestamp: new Date(),
      checksum: this._calculateChecksum(serializedData),
    };
  }

  /**
   * Perform incremental serialization for large diagrams
   */
  private _performIncrementalSerialization(diagram: DiagramSnapshot): SerializedData {
    // Split diagram into chunks for better performance
    const chunks = {
      metadata: {
        id: diagram.id,
        name: diagram.name,
        description: diagram.description,
        version: diagram.version,
        createdAt: diagram.createdAt,
        updatedAt: diagram.updatedAt,
        createdBy: diagram.createdBy,
      },
      nodes: diagram.nodes,
      edges: diagram.edges,
    };

    const serializedChunks = Object.entries(chunks).map(([key, chunk]) => ({
      key,
      data: this._performSerialization(chunk, `diagram_${key}`),
    }));

    const incrementalData = {
      format: SerializationFormat.INCREMENTAL,
      chunks: serializedChunks,
    };

    const jsonString = JSON.stringify(incrementalData);
    const originalSize = new Blob([jsonString]).size;

    return {
      format: SerializationFormat.INCREMENTAL,
      data: jsonString,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1,
      timestamp: new Date(),
    };
  }

  /**
   * Check if diagram is large enough to benefit from incremental serialization
   */
  private _isLargeDiagram(diagram: DiagramSnapshot): boolean {
    return diagram.nodes.length > 100 || diagram.edges.length > 200;
  }

  /**
   * Check if binary serialization should be used
   */
  private _shouldUseBinary(data: any, type: string): boolean {
    // Use binary for large datasets or specific types
    const jsonSize = JSON.stringify(data).length;
    return jsonSize > 10000 || type === 'diagram';
  }

  /**
   * Serialize data to binary format (simplified implementation)
   */
  private _serializeToBinary(data: any): ArrayBuffer {
    // This is a simplified implementation
    // In a real scenario, you might use MessagePack, Protocol Buffers, etc.
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    return encoder.encode(jsonString).buffer;
  }

  /**
   * Deserialize binary data (simplified implementation)
   */
  private _deserializeBinary<T>(buffer: ArrayBuffer): T {
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(buffer);
    return JSON.parse(jsonString);
  }

  /**
   * Compress JSON string (simplified implementation)
   */
  private _compressJson(jsonString: string): string {
    // This is a simplified implementation
    // In a real scenario, you might use gzip, brotli, etc.
    return jsonString; // Placeholder - would implement actual compression
  }

  /**
   * Decompress and parse JSON (simplified implementation)
   */
  private _decompressAndParse<T>(compressedData: string): T {
    // This is a simplified implementation
    // In a real scenario, you would decompress first
    return JSON.parse(compressedData); // Placeholder
  }

  /**
   * Deserialize incremental data
   */
  private _deserializeIncremental<T>(data: string): T {
    const incrementalData = JSON.parse(data);
    const result: any = {};

    for (const chunk of incrementalData.chunks) {
      const chunkData = this.deserialize(chunk.data);
      if (chunk.key === 'metadata') {
        Object.assign(result, chunkData);
      } else {
        result[chunk.key] = chunkData;
      }
    }

    return result;
  }

  /**
   * Calculate checksum for data integrity
   */
  private _calculateChecksum(data: string | ArrayBuffer): string {
    // Simplified checksum calculation
    let hash = 0;
    const str = typeof data === 'string' ? data : new TextDecoder().decode(data);

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString(16);
  }

  /**
   * Generate cache key
   */
  private _generateCacheKey(type: string, id: string): string {
    return `${type}_${id}`;
  }

  /**
   * Get cached data
   */
  private _getCachedData(key: string): SerializedData | null {
    const entry = this._cache.get(key);
    if (!entry) {
      return null;
    }

    const config = this._config$.value;
    const now = Date.now();

    // Check TTL
    if (now - entry.timestamp.getTime() > config.cacheTtl) {
      this._cache.delete(key);
      return null;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = new Date();

    return entry.data;
  }

  /**
   * Set cached data
   */
  private _setCachedData(key: string, data: SerializedData): void {
    const config = this._config$.value;

    // Check cache size limit
    if (this._getCacheSizeInBytes() > config.maxCacheSize * 1024 * 1024) {
      this._evictLeastRecentlyUsed();
    }

    this._cache.set(key, {
      data,
      timestamp: new Date(),
      accessCount: 1,
      lastAccessed: new Date(),
    });
  }

  /**
   * Get cache size in bytes
   */
  private _getCacheSizeInBytes(): number {
    let totalSize = 0;
    for (const entry of this._cache.values()) {
      totalSize += entry.data.compressedSize;
    }
    return totalSize;
  }

  /**
   * Evict least recently used cache entries
   */
  private _evictLeastRecentlyUsed(): void {
    const entries = Array.from(this._cache.entries());
    entries.sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());

    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this._cache.delete(entries[i][0]);
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private _cleanupCache(): void {
    const config = this._config$.value;
    const now = Date.now();

    for (const [key, entry] of this._cache.entries()) {
      if (now - entry.timestamp.getTime() > config.cacheTtl) {
        this._cache.delete(key);
      }
    }
  }

  /**
   * Update performance metrics
   */
  private _updateMetrics(): void {
    const totalCacheRequests = this._cacheHits + this._cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? this._cacheHits / totalCacheRequests : 0;

    const avgSerializationTime =
      this._serializationTimes.length > 0
        ? this._serializationTimes.reduce((sum, time) => sum + time, 0) /
          this._serializationTimes.length
        : 0;

    const avgDeserializationTime =
      this._deserializationTimes.length > 0
        ? this._deserializationTimes.reduce((sum, time) => sum + time, 0) /
          this._deserializationTimes.length
        : 0;

    const avgCompressionRatio =
      this._compressionRatios.length > 0
        ? this._compressionRatios.reduce((sum, ratio) => sum + ratio, 0) /
          this._compressionRatios.length
        : 1;

    const newMetrics: SerializationMetrics = {
      totalSerializations: this._serializationTimes.length,
      totalDeserializations: this._deserializationTimes.length,
      averageSerializationTime: avgSerializationTime,
      averageDeserializationTime: avgDeserializationTime,
      totalDataSerialized: this._serializationTimes.length,
      totalDataCompressed: this._compressionRatios.filter(r => r > 1).length,
      averageCompressionRatio: avgCompressionRatio,
      cacheHitRate,
      cacheSize: this._cache.size,
    };

    this._metrics$.next(newMetrics);
  }
}
