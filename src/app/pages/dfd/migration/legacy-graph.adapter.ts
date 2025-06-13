import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { Graph, Node } from '@antv/x6';
import '@antv/x6-plugin-export';
import { LoggerService } from '../../../core/services/logger.service';
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';

/**
 * Adapter that provides the legacy DfdService interface while using the new clean architecture
 * This allows gradual migration without breaking existing component code
 */
@Injectable()
export class LegacyGraphAdapter {
  private _isInitialized = new BehaviorSubject<boolean>(false);
  private _selectedNode = new BehaviorSubject<Node | null>(null);
  private _canUndo = new BehaviorSubject<boolean>(false);
  private _canRedo = new BehaviorSubject<boolean>(false);

  constructor(
    private logger: LoggerService,
    private x6GraphAdapter: X6GraphAdapter,
  ) {
    this.logger.info('LegacyGraphAdapter initialized');
    this.setupStateSync();
  }

  /**
   * Get the X6 graph instance (legacy interface)
   */
  get graph(): Graph | null {
    try {
      return this.x6GraphAdapter.getGraph();
    } catch {
      return null;
    }
  }

  /**
   * Check if the graph is initialized (legacy interface)
   */
  get isInitialized(): boolean {
    return this._isInitialized.value;
  }

  /**
   * Get initialization state as observable (legacy interface)
   */
  get isInitialized$(): Observable<boolean> {
    return this._isInitialized.asObservable();
  }

  /**
   * Get selected node (legacy interface)
   */
  get selectedNode(): Node | null {
    return this._selectedNode.value;
  }

  /**
   * Get selected node as observable (legacy interface)
   */
  get selectedNode$(): Observable<Node | null> {
    return this._selectedNode.asObservable();
  }

  /**
   * Get undo capability as observable (legacy interface)
   */
  get canUndo$(): Observable<boolean> {
    return this._canUndo.asObservable();
  }

  /**
   * Get redo capability as observable (legacy interface)
   */
  get canRedo$(): Observable<boolean> {
    return this._canRedo.asObservable();
  }

  /**
   * Get current undo capability (legacy interface)
   */
  get canUndo(): boolean {
    return this._canUndo.value;
  }

  /**
   * Get current redo capability (legacy interface)
   */
  get canRedo(): boolean {
    return this._canRedo.value;
  }

  /**
   * Initialize the graph (legacy interface)
   * @param containerElement The container element for the graph
   * @returns True if initialization was successful
   */
  initialize(containerElement: HTMLElement): boolean {
    this.logger.info('LegacyGraphAdapter: Initializing graph with new architecture');

    try {
      // Use the X6GraphAdapter to initialize
      this.x6GraphAdapter.initialize(containerElement);
      this._isInitialized.next(true);
      this.logger.info('LegacyGraphAdapter: Graph initialized successfully');
      return true;
    } catch (error) {
      this.logger.error('LegacyGraphAdapter: Error during graph initialization', error);
      this._isInitialized.next(false);
      return false;
    }
  }

  /**
   * Dispose the graph and clean up resources (legacy interface)
   */
  dispose(): void {
    this.logger.info('LegacyGraphAdapter: Disposing graph');

    try {
      // Dispose the X6 graph adapter
      this.x6GraphAdapter.dispose();

      // Reset state
      this._isInitialized.next(false);
      this._selectedNode.next(null);
      this._canUndo.next(false);
      this._canRedo.next(false);

      this.logger.info('LegacyGraphAdapter: Graph disposed successfully');
    } catch (error) {
      this.logger.error('LegacyGraphAdapter: Error during graph disposal', error);
    }
  }

  /**
   * Add passive event listeners (legacy interface)
   * @param container The container element
   */
  addPassiveEventListeners(container: HTMLElement): void {
    this.logger.info('LegacyGraphAdapter: Adding passive event listeners');

    // Add passive event listeners manually since X6GraphAdapter doesn't have this method
    const passiveEvents = ['touchstart', 'touchmove', 'wheel', 'mousewheel'];

    const addPassiveListener = (element: Element): void => {
      passiveEvents.forEach(eventType => {
        element.addEventListener(
          eventType,
          (_e: Event) => {
            // Empty handler with passive: true to prevent browser warnings
          },
          { passive: true, capture: false },
        );
      });
    };

    // Add listeners to canvas and SVG elements
    const canvasElements = container.querySelectorAll('canvas');
    const svgElements = container.querySelectorAll('svg');

    canvasElements.forEach(addPassiveListener);
    svgElements.forEach(addPassiveListener);
    addPassiveListener(container);
  }

  /**
   * Export diagram in specified format (legacy interface)
   * @param format The export format
   * @param callback Optional callback for handling the exported data
   */
  exportDiagram(
    format: 'svg' | 'png' | 'jpeg',
    callback?: (blob: Blob, filename: string) => void,
  ): void {
    this.logger.info('LegacyGraphAdapter: Exporting diagram', { format });

    const graph = this.graph;
    if (!graph) {
      this.logger.warn('LegacyGraphAdapter: Cannot export - graph not initialized');
      return;
    }

    try {
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `dfd-diagram-${timestamp}.${format}`;

      // Default callback if not provided
      const defaultCallback = (blob: Blob, name: string): void => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      };

      const finalCallback = callback || defaultCallback;

      // Cast graph to access export methods added by the plugin
      const exportGraph = graph as Graph & {
        toSVG: (callback: (svgString: string) => void) => void;
        toPNG: (callback: (dataUri: string) => void, options?: Record<string, unknown>) => void;
        toJPEG: (callback: (dataUri: string) => void, options?: Record<string, unknown>) => void;
      };

      if (format === 'svg') {
        exportGraph.toSVG((svgString: string) => {
          const blob = new Blob([svgString], { type: 'image/svg+xml' });
          finalCallback(blob, filename);
          this.logger.info('LegacyGraphAdapter: SVG export completed', { filename });
        });
      } else {
        const exportOptions = {
          backgroundColor: 'white',
          padding: 20,
          quality: format === 'jpeg' ? 0.8 : 1,
        };

        if (format === 'png') {
          exportGraph.toPNG((dataUri: string) => {
            const blob = this.dataUriToBlob(dataUri, 'image/png');
            finalCallback(blob, filename);
            this.logger.info('LegacyGraphAdapter: PNG export completed', { filename });
          }, exportOptions);
        } else {
          exportGraph.toJPEG((dataUri: string) => {
            const blob = this.dataUriToBlob(dataUri, 'image/jpeg');
            finalCallback(blob, filename);
            this.logger.info('LegacyGraphAdapter: JPEG export completed', { filename });
          }, exportOptions);
        }
      }
    } catch (error) {
      this.logger.error('LegacyGraphAdapter: Error exporting diagram', error);
    }
  }

  /**
   * Set up synchronization between new architecture state and legacy observables
   */
  private setupStateSync(): void {
    // Subscribe to X6GraphAdapter events to sync state
    this.x6GraphAdapter.selectionChanged$.subscribe(({ selected }) => {
      if (selected.length > 0) {
        const node = this.x6GraphAdapter.getNode(selected[0]);
        this._selectedNode.next(node);
      } else {
        this._selectedNode.next(null);
      }
    });

    this.logger.debug('LegacyGraphAdapter: State synchronization set up');
  }

  /**
   * Convert data URI to Blob
   * @param dataUri The data URI to convert
   * @param mimeType The MIME type of the blob
   * @returns The converted blob
   */
  private dataUriToBlob(dataUri: string, mimeType: string): Blob {
    const byteString = atob(dataUri.split(',')[1]);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const uint8Array = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: mimeType });
  }
}
