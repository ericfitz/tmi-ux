 
import { Injectable, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject, Subject, Subscription } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

/**
 * Configuration for memory leak prevention
 */
export interface MemoryLeakPreventionConfig {
  /** Enable automatic subscription cleanup */
  enableAutoCleanup: boolean;
  /** Enable memory usage monitoring */
  enableMemoryMonitoring: boolean;
  /** Memory usage threshold in MB before warnings */
  memoryWarningThreshold: number;
  /** Memory usage threshold in MB before cleanup */
  memoryCriticalThreshold: number;
  /** Interval for memory monitoring in milliseconds */
  monitoringInterval: number;
  /** Enable weak reference tracking */
  enableWeakReferences: boolean;
  /** Maximum number of cached items before cleanup */
  maxCacheSize: number;
  /** Enable automatic garbage collection hints */
  enableGcHints: boolean;
}

/**
 * Default configuration for memory leak prevention
 */
export const DEFAULT_MEMORY_CONFIG: MemoryLeakPreventionConfig = {
  enableAutoCleanup: true,
  enableMemoryMonitoring: true,
  memoryWarningThreshold: 100, // 100MB
  memoryCriticalThreshold: 200, // 200MB
  monitoringInterval: 30000, // 30 seconds
  enableWeakReferences: true,
  maxCacheSize: 1000,
  enableGcHints: true,
};

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usedJSHeapSizeMB: number;
  totalJSHeapSizeMB: number;
  jsHeapSizeLimitMB: number;
  memoryUsagePercentage: number;
  timestamp: Date;
}

/**
 * Memory leak detection result
 */
export interface MemoryLeakDetection {
  isLeakDetected: boolean;
  leakType: MemoryLeakType;
  severity: MemoryLeakSeverity;
  description: string;
  recommendations: string[];
  affectedComponents: string[];
  timestamp: Date;
}

/**
 * Types of memory leaks
 */
export enum MemoryLeakType {
  SUBSCRIPTION_LEAK = 'subscription_leak',
  EVENT_LISTENER_LEAK = 'event_listener_leak',
  TIMER_LEAK = 'timer_leak',
  CACHE_OVERFLOW = 'cache_overflow',
  CIRCULAR_REFERENCE = 'circular_reference',
  DETACHED_DOM = 'detached_dom',
  CLOSURE_LEAK = 'closure_leak',
}

/**
 * Severity levels for memory leaks
 */
export enum MemoryLeakSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Subscription tracker for automatic cleanup
 */
interface SubscriptionTracker {
  subscription: Subscription;
  componentName: string;
  createdAt: Date;
  isActive: boolean;
}

/**
 * Cache entry with weak reference support
 */
interface WeakCacheEntry<T extends object> {
  value: WeakRef<T>;
  key: string;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
}

/**
 * Service for preventing memory leaks in the application
 */
@Injectable({
  providedIn: 'root',
})
export class MemoryLeakPreventionService implements OnDestroy {
  private readonly _config$ = new BehaviorSubject<MemoryLeakPreventionConfig>(
    DEFAULT_MEMORY_CONFIG,
  );
  private readonly _memoryStats$ = new BehaviorSubject<MemoryStats | null>(null);
  private readonly _leakDetections$ = new BehaviorSubject<MemoryLeakDetection[]>([]);
  private readonly _destroy$ = new Subject<void>();

  private readonly _subscriptionTrackers = new Map<string, SubscriptionTracker>();
  private readonly _eventListeners = new Map<
    string,
    { element: Element; event: string; handler: EventListener }
  >();
  private readonly _timers = new Map<
    string,
    { id: number; type: 'timeout' | 'interval'; createdAt: Date }
  >();
  private readonly _weakCache = new Map<string, WeakCacheEntry<object>>();
  private readonly _componentRegistry = new Set<string>();

  private _monitoringInterval: number | null = null;
  private _memoryHistory: MemoryStats[] = [];
  private _leakDetectionHistory: MemoryLeakDetection[] = [];

  /**
   * Observable for configuration changes
   */
  public readonly config$: Observable<MemoryLeakPreventionConfig> = this._config$.asObservable();

  /**
   * Observable for memory statistics
   */
  public readonly memoryStats$: Observable<MemoryStats | null> = this._memoryStats$.pipe(
    shareReplay(1),
  );

  /**
   * Observable for leak detections
   */
  public readonly leakDetections$: Observable<MemoryLeakDetection[]> = this._leakDetections$.pipe(
    shareReplay(1),
  );

  constructor() {
    this._startMemoryMonitoring();
  }

  /**
   * Register a component for memory tracking
   */
  registerComponent(componentName: string): () => void {
    this._componentRegistry.add(componentName);

    // Return cleanup function
    return () => {
      this.cleanupComponent(componentName);
    };
  }

  /**
   * Track a subscription for automatic cleanup
   */
  trackSubscription(subscription: Subscription, componentName: string): string {
    const trackerId = this._generateTrackerId();

    this._subscriptionTrackers.set(trackerId, {
      subscription,
      componentName,
      createdAt: new Date(),
      isActive: true,
    });

    return trackerId;
  }

  /**
   * Track an event listener for automatic cleanup
   */
  trackEventListener(
    element: Element,
    event: string,
    handler: EventListener,
    componentName: string,
  ): string {
    const listenerId = this._generateTrackerId();

    this._eventListeners.set(listenerId, {
      element,
      event,
      handler,
    });

    // Add component association
    element.setAttribute('data-component', componentName);

    return listenerId;
  }

  /**
   * Track a timer for automatic cleanup
   */
  trackTimer(timerId: number, type: 'timeout' | 'interval', _componentName: string): string {
    const trackerId = this._generateTrackerId();

    this._timers.set(trackerId, {
      id: timerId,
      type,
      createdAt: new Date(),
    });

    return trackerId;
  }

  /**
   * Store data in weak reference cache
   */
  setWeakCache<T extends object>(key: string, value: T): void {
    if (!this._config$.value.enableWeakReferences) {
      return;
    }

    // Clean up expired entries first
    this._cleanupWeakCache();

    // Check cache size limit
    if (this._weakCache.size >= this._config$.value.maxCacheSize) {
      this._evictOldestCacheEntries();
    }

    this._weakCache.set(key, {
      value: new WeakRef(value),
      key,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
    });
  }

  /**
   * Get data from weak reference cache
   */
  getWeakCache<T>(key: string): T | null {
    const entry = this._weakCache.get(key);
    if (!entry) {
      return null;
    }

    const value = entry.value.deref() as T | undefined;
    if (!value) {
      // Object was garbage collected
      this._weakCache.delete(key);
      return null;
    }

    // Update access info
    entry.lastAccessed = new Date();
    entry.accessCount++;

    return value as T;
  }

  /**
   * Clean up all resources for a component
   */
  cleanupComponent(componentName: string): void {
    // Clean up subscriptions
    for (const [trackerId, tracker] of this._subscriptionTrackers.entries()) {
      if (tracker.componentName === componentName && tracker.isActive) {
        tracker.subscription.unsubscribe();
        tracker.isActive = false;
        this._subscriptionTrackers.delete(trackerId);
      }
    }

    // Clean up event listeners
    for (const [listenerId, listener] of this._eventListeners.entries()) {
      const component = listener.element.getAttribute('data-component');
      if (component === componentName) {
        listener.element.removeEventListener(listener.event, listener.handler);
        this._eventListeners.delete(listenerId);
      }
    }

    // Clean up timers
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_trackerId, _timer] of this._timers.entries()) {
      // Note: We can't directly associate timers with components without additional tracking
      // This would require modification of the timer tracking to include component info
    }

    this._componentRegistry.delete(componentName);
  }

  /**
   * Force garbage collection hint (if supported)
   */
  forceGarbageCollection(): void {
    if (!this._config$.value.enableGcHints) {
      return;
    }

    // Modern browsers don't expose gc() for security reasons
    // This is mainly for development/testing environments
    if (typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }

  /**
   * Get current memory statistics
   */
  getCurrentMemoryStats(): MemoryStats | null {
    if (!('memory' in performance)) {
      return null;
    }

    const memory = (performance as any).memory;

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usedJSHeapSizeMB: memory.usedJSHeapSize / (1024 * 1024),
      totalJSHeapSizeMB: memory.totalJSHeapSize / (1024 * 1024),
      jsHeapSizeLimitMB: memory.jsHeapSizeLimit / (1024 * 1024),
      memoryUsagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      timestamp: new Date(),
    };
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks(): MemoryLeakDetection[] {
    const detections: MemoryLeakDetection[] = [];
    const config = this._config$.value;

    // Check for subscription leaks
    const activeSubscriptions = Array.from(this._subscriptionTrackers.values()).filter(
      tracker => tracker.isActive,
    );

    if (activeSubscriptions.length > 50) {
      detections.push({
        isLeakDetected: true,
        leakType: MemoryLeakType.SUBSCRIPTION_LEAK,
        severity:
          activeSubscriptions.length > 100 ? MemoryLeakSeverity.HIGH : MemoryLeakSeverity.MEDIUM,
        description: `${activeSubscriptions.length} active subscriptions detected`,
        recommendations: [
          'Ensure all subscriptions are unsubscribed in ngOnDestroy',
          'Use takeUntil pattern for automatic cleanup',
          'Consider using async pipe in templates',
        ],
        affectedComponents: [...new Set(activeSubscriptions.map(s => s.componentName))],
        timestamp: new Date(),
      });
    }

    // Check for event listener leaks
    if (this._eventListeners.size > 100) {
      detections.push({
        isLeakDetected: true,
        leakType: MemoryLeakType.EVENT_LISTENER_LEAK,
        severity:
          this._eventListeners.size > 200 ? MemoryLeakSeverity.HIGH : MemoryLeakSeverity.MEDIUM,
        description: `${this._eventListeners.size} event listeners registered`,
        recommendations: [
          'Remove event listeners in component cleanup',
          'Use Angular event binding instead of manual listeners',
          'Check for duplicate event listener registrations',
        ],
        affectedComponents: [],
        timestamp: new Date(),
      });
    }

    // Check for timer leaks
    if (this._timers.size > 20) {
      detections.push({
        isLeakDetected: true,
        leakType: MemoryLeakType.TIMER_LEAK,
        severity: this._timers.size > 50 ? MemoryLeakSeverity.HIGH : MemoryLeakSeverity.MEDIUM,
        description: `${this._timers.size} active timers detected`,
        recommendations: [
          'Clear all timers in component cleanup',
          'Use RxJS operators instead of raw timers',
          'Check for timer recreation without cleanup',
        ],
        affectedComponents: [],
        timestamp: new Date(),
      });
    }

    // Check cache overflow
    if (this._weakCache.size > config.maxCacheSize * 0.8) {
      detections.push({
        isLeakDetected: true,
        leakType: MemoryLeakType.CACHE_OVERFLOW,
        severity: MemoryLeakSeverity.MEDIUM,
        description: `Cache approaching size limit: ${this._weakCache.size}/${config.maxCacheSize}`,
        recommendations: [
          'Implement cache eviction strategy',
          'Reduce cache size limit',
          'Clear unused cache entries',
        ],
        affectedComponents: [],
        timestamp: new Date(),
      });
    }

    // Check memory usage trends
    const currentStats = this.getCurrentMemoryStats();
    if (currentStats) {
      if (currentStats.usedJSHeapSizeMB > config.memoryCriticalThreshold) {
        detections.push({
          isLeakDetected: true,
          leakType: MemoryLeakType.CIRCULAR_REFERENCE,
          severity: MemoryLeakSeverity.CRITICAL,
          description: `Critical memory usage: ${currentStats.usedJSHeapSizeMB.toFixed(2)}MB`,
          recommendations: [
            'Force garbage collection',
            'Clear all caches',
            'Check for circular references',
            'Restart application if necessary',
          ],
          affectedComponents: Array.from(this._componentRegistry),
          timestamp: new Date(),
        });
      } else if (currentStats.usedJSHeapSizeMB > config.memoryWarningThreshold) {
        detections.push({
          isLeakDetected: true,
          leakType: MemoryLeakType.CIRCULAR_REFERENCE,
          severity: MemoryLeakSeverity.MEDIUM,
          description: `High memory usage: ${currentStats.usedJSHeapSizeMB.toFixed(2)}MB`,
          recommendations: [
            'Monitor memory usage closely',
            'Clear unnecessary caches',
            'Check for memory-intensive operations',
          ],
          affectedComponents: Array.from(this._componentRegistry),
          timestamp: new Date(),
        });
      }
    }

    this._leakDetectionHistory.push(...detections);
    this._leakDetections$.next(detections);

    return detections;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MemoryLeakPreventionConfig>): void {
    const currentConfig = this._config$.value;
    const newConfig = { ...currentConfig, ...config };
    this._config$.next(newConfig);

    // Restart monitoring if interval changed
    if (config.monitoringInterval !== undefined) {
      this._stopMemoryMonitoring();
      this._startMemoryMonitoring();
    }
  }

  /**
   * Get memory usage history
   */
  getMemoryHistory(): MemoryStats[] {
    return [...this._memoryHistory];
  }

  /**
   * Get leak detection history
   */
  getLeakDetectionHistory(): MemoryLeakDetection[] {
    return [...this._leakDetectionHistory];
  }

  /**
   * Clear all tracked resources
   */
  clearAllTracking(): void {
    // Unsubscribe all tracked subscriptions
    for (const tracker of this._subscriptionTrackers.values()) {
      if (tracker.isActive) {
        tracker.subscription.unsubscribe();
      }
    }
    this._subscriptionTrackers.clear();

    // Remove all tracked event listeners
    for (const listener of this._eventListeners.values()) {
      listener.element.removeEventListener(listener.event, listener.handler);
    }
    this._eventListeners.clear();

    // Clear all tracked timers
    for (const timer of this._timers.values()) {
      if (timer.type === 'timeout') {
        clearTimeout(timer.id);
      } else {
        clearInterval(timer.id);
      }
    }
    this._timers.clear();

    // Clear weak cache
    this._weakCache.clear();

    // Clear component registry
    this._componentRegistry.clear();
  }

  /**
   * Dispose of the service
   */
  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._stopMemoryMonitoring();
    this.clearAllTracking();
  }

  /**
   * Start memory monitoring
   */
  private _startMemoryMonitoring(): void {
    const config = this._config$.value;

    if (!config.enableMemoryMonitoring) {
      return;
    }

    this._monitoringInterval = window.setInterval(() => {
      const stats = this.getCurrentMemoryStats();
      if (stats) {
        this._memoryStats$.next(stats);
        this._memoryHistory.push(stats);

        // Keep only last 100 entries
        if (this._memoryHistory.length > 100) {
          this._memoryHistory.shift();
        }
      }

      // Run leak detection
      this.detectMemoryLeaks();
    }, config.monitoringInterval);
  }

  /**
   * Stop memory monitoring
   */
  private _stopMemoryMonitoring(): void {
    if (this._monitoringInterval) {
      clearInterval(this._monitoringInterval);
      this._monitoringInterval = null;
    }
  }

  /**
   * Generate unique tracker ID
   */
  private _generateTrackerId(): string {
    return `tracker_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Clean up expired weak cache entries
   */
  private _cleanupWeakCache(): void {
    for (const [key, entry] of this._weakCache.entries()) {
      const value = entry.value.deref();
      if (!value) {
        this._weakCache.delete(key);
      }
    }
  }

  /**
   * Evict oldest cache entries
   */
  private _evictOldestCacheEntries(): void {
    const entries = Array.from(this._weakCache.entries());
    entries.sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());

    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this._weakCache.delete(entries[i][0]);
    }
  }
}
