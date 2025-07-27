import { Injectable } from '@angular/core';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * X6 Event Logger Service
 *
 * Dedicated service for logging all X6 graph events to a separate log file.
 * This service intercepts raw X6 events at the graph level and writes them
 * to a dedicated x6-events.log file, separate from the main application logger.
 */
@Injectable()
export class X6EventLoggerService {
  private _logEntries: string[] = [];
  private _isEnabled = false;
  private _maxLogEntries = 1000; // Prevent memory issues
  private _logFileName = 'x6-events.log';

  constructor(private logger: LoggerService) {}

  /**
   * Initialize X6 event logging for the given graph
   */
  initializeEventLogging(graph: Graph): void {
    if (!this._isEnabled || !graph) {
      return;
    }

    this._logEvent('SYSTEM', 'X6EventLogger initialized', { graphId: 'dfd-graph' });

    // Node lifecycle events
    graph.on('node:added', ({ node }: { node: Node }) => {
      this._logEvent('NODE_ADDED', 'Node added to graph', {
        nodeId: node.id,
        shape: node.shape,
        position: node.getPosition(),
        size: node.getSize(),
        label: this._getNodeLabel(node),
      });
    });

    graph.on('node:removed', ({ node }: { node: Node }) => {
      this._logEvent('NODE_REMOVED', 'Node removed from graph', {
        nodeId: node.id,
        shape: node.shape,
        position: node.getPosition(),
        size: node.getSize(),
      });
    });

    // Node transformation events
    graph.on(
      'node:change:position',
      ({
        node,
        current,
        previous,
      }: {
        node: Node;
        current?: { x: number; y: number };
        previous?: { x: number; y: number };
      }) => {
        if (current && previous) {
          this._logEvent('NODE_POSITION_CHANGED', 'Node position changed', {
            nodeId: node.id,
            currentPosition: current,
            previousPosition: previous,
            deltaX: current.x - previous.x,
            deltaY: current.y - previous.y,
          });
        }
      },
    );

    graph.on(
      'node:change:size',
      ({
        node,
        current,
        previous,
      }: {
        node: Node;
        current?: { width: number; height: number };
        previous?: { width: number; height: number };
      }) => {
        if (current && previous) {
          this._logEvent('NODE_SIZE_CHANGED', 'Node size changed', {
            nodeId: node.id,
            currentSize: current,
            previousSize: previous,
            deltaWidth: current.width - previous.width,
            deltaHeight: current.height - previous.height,
          });
        }
      },
    );

    // Node interaction events
    graph.on('node:mouseenter', ({ node }: { node: Node }) => {
      this._logEvent('NODE_MOUSE_ENTER', 'Mouse entered node', {
        nodeId: node.id,
        shape: node.shape,
      });
    });

    graph.on('node:mouseleave', ({ node }: { node: Node }) => {
      this._logEvent('NODE_MOUSE_LEAVE', 'Mouse left node', {
        nodeId: node.id,
        shape: node.shape,
      });
    });

    graph.on('node:click', ({ node, e }: { node: Node; e: MouseEvent }) => {
      this._logEvent('NODE_CLICK', 'Node clicked', {
        nodeId: node.id,
        shape: node.shape,
        clientX: e.clientX,
        clientY: e.clientY,
        button: e.button,
      });
    });

    graph.on('node:dblclick', ({ node, e }: { node: Node; e: MouseEvent }) => {
      this._logEvent('NODE_DOUBLE_CLICK', 'Node double-clicked', {
        nodeId: node.id,
        shape: node.shape,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    });

    graph.on('node:contextmenu', ({ node, e }: { node: Node; e: MouseEvent }) => {
      this._logEvent('NODE_CONTEXT_MENU', 'Node context menu triggered', {
        nodeId: node.id,
        shape: node.shape,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    });

    // Node drag events
    graph.on('node:move', ({ node }: { node: Node }) => {
      this._logEvent('NODE_MOVE', 'Node being moved (drag in progress)', {
        nodeId: node.id,
        position: node.getPosition(),
      });
    });

    graph.on('node:moved', ({ node }: { node: Node }) => {
      this._logEvent('NODE_MOVED', 'Node move completed', {
        nodeId: node.id,
        finalPosition: node.getPosition(),
      });
    });

    // Edge lifecycle events
    graph.on('edge:added', ({ edge }: { edge: Edge }) => {
      this._logEvent('EDGE_ADDED', 'Edge added to graph', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
        sourcePortId: edge.getSourcePortId(),
        targetPortId: edge.getTargetPortId(),
        vertices: edge.getVertices(),
        labels: edge.getLabels(),
      });
    });

    graph.on('edge:removed', ({ edge }: { edge: Edge }) => {
      this._logEvent('EDGE_REMOVED', 'Edge removed from graph', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
      });
    });

    // Edge connection events
    graph.on('edge:connecting', ({ edge }: { edge: Edge }) => {
      this._logEvent('EDGE_CONNECTING', 'Edge connection in progress', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
      });
    });

    graph.on('edge:connected', ({ edge }: { edge: Edge }) => {
      this._logEvent('EDGE_CONNECTED', 'Edge connection completed', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
        sourcePortId: edge.getSourcePortId(),
        targetPortId: edge.getTargetPortId(),
      });
    });

    graph.on('edge:disconnected', ({ edge }: { edge: Edge }) => {
      this._logEvent('EDGE_DISCONNECTED', 'Edge disconnected', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
      });
    });

    // Edge modification events
    graph.on('edge:change:vertices', ({ edge }: { edge: Edge }) => {
      this._logEvent('EDGE_VERTICES_CHANGED', 'Edge vertices modified', {
        edgeId: edge.id,
        vertices: edge.getVertices(),
        vertexCount: edge.getVertices().length,
      });
    });

    graph.on('edge:change:source', ({ edge }: { edge: Edge }) => {
      this._logEvent('EDGE_SOURCE_CHANGED', 'Edge source changed', {
        edgeId: edge.id,
        newSourceId: edge.getSourceCellId(),
        newSourcePortId: edge.getSourcePortId(),
      });
    });

    graph.on('edge:change:target', ({ edge }: { edge: Edge }) => {
      this._logEvent('EDGE_TARGET_CHANGED', 'Edge target changed', {
        edgeId: edge.id,
        newTargetId: edge.getTargetCellId(),
        newTargetPortId: edge.getTargetPortId(),
      });
    });

    // Edge interaction events
    graph.on('edge:click', ({ edge, e }: { edge: Edge; e: MouseEvent }) => {
      this._logEvent('EDGE_CLICK', 'Edge clicked', {
        edgeId: edge.id,
        clientX: e.clientX,
        clientY: e.clientY,
        button: e.button,
      });
    });

    graph.on('edge:dblclick', ({ edge, e }: { edge: Edge; e: MouseEvent }) => {
      this._logEvent('EDGE_DOUBLE_CLICK', 'Edge double-clicked', {
        edgeId: edge.id,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    });

    graph.on('edge:contextmenu', ({ edge, e }: { edge: Edge; e: MouseEvent }) => {
      this._logEvent('EDGE_CONTEXT_MENU', 'Edge context menu triggered', {
        edgeId: edge.id,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    });

    // Selection events
    graph.on('selection:changed', ({ added, removed }: { added: Cell[]; removed: Cell[] }) => {
      this._logEvent('SELECTION_CHANGED', 'Selection changed', {
        addedCells: added.map(cell => ({
          id: cell.id,
          type: cell.isNode() ? 'node' : 'edge',
          shape: cell.shape,
        })),
        removedCells: removed.map(cell => ({
          id: cell.id,
          type: cell.isNode() ? 'node' : 'edge',
          shape: cell.shape,
        })),
        totalSelected: added.length,
        totalDeselected: removed.length,
      });
    });

    // Graph-level events
    graph.on('blank:click', ({ e }: { e: MouseEvent }) => {
      this._logEvent('BLANK_CLICK', 'Blank area clicked', {
        clientX: e.clientX,
        clientY: e.clientY,
        button: e.button,
      });
    });

    graph.on('blank:dblclick', ({ e }: { e: MouseEvent }) => {
      this._logEvent('BLANK_DOUBLE_CLICK', 'Blank area double-clicked', {
        clientX: e.clientX,
        clientY: e.clientY,
      });
    });

    graph.on('blank:contextmenu', ({ e }: { e: MouseEvent }) => {
      this._logEvent('BLANK_CONTEXT_MENU', 'Blank area context menu', {
        clientX: e.clientX,
        clientY: e.clientY,
      });
    });

    // Graph state events
    graph.on('graph:cleared', () => {
      this._logEvent('GRAPH_CLEARED', 'Graph cleared', {
        timestamp: new Date().toISOString(),
      });
    });

    // Cell data change events
    graph.on(
      'cell:change:data',
      ({
        cell,
        current,
        previous,
      }: {
        cell: Cell;
        current?: Record<string, unknown>;
        previous?: Record<string, unknown>;
      }) => {
        this._logEvent('CELL_DATA_CHANGED', 'Cell data changed', {
          cellId: cell.id,
          cellType: cell.isNode() ? 'node' : 'edge',
          currentData: current,
          previousData: previous,
        });
      },
    );

    // Render events
    graph.on('render:start', () => {
      this._logEvent('RENDER_START', 'Graph render started', {
        timestamp: new Date().toISOString(),
      });
    });

    graph.on('render:done', () => {
      this._logEvent('RENDER_DONE', 'Graph render completed', {
        timestamp: new Date().toISOString(),
      });
    });

    // Batch operation events
    graph.on('batch:start', () => {
      this._logEvent('BATCH_START', 'Batch operation started', {
        timestamp: new Date().toISOString(),
      });
    });

    graph.on('batch:stop', () => {
      this._logEvent('BATCH_STOP', 'Batch operation completed', {
        timestamp: new Date().toISOString(),
      });
    });

    // Port events
    graph.on('node:port:mouseenter', ({ node, port }: { node: Node; port: { id: string } }) => {
      this._logEvent('PORT_MOUSE_ENTER', 'Mouse entered port', {
        nodeId: node.id,
        portId: port.id,
      });
    });

    graph.on('node:port:mouseleave', ({ node, port }: { node: Node; port: { id: string } }) => {
      this._logEvent('PORT_MOUSE_LEAVE', 'Mouse left port', {
        nodeId: node.id,
        portId: port.id,
      });
    });

    this._logEvent('SYSTEM', 'All X6 event listeners registered', {
      totalEventTypes: 'comprehensive',
    });
  }

  /**
   * Get all logged events
   */
  getLogEntries(): string[] {
    return [...this._logEntries];
  }

  /**
   * Clear all logged events
   */
  clearLog(): void {
    this._logEntries = [];
    this._logEvent('SYSTEM', 'Log cleared', {});
  }

  /**
   * Enable or disable event logging
   */
  setEnabled(enabled: boolean): void {
    this._isEnabled = enabled;
    this._logEvent('SYSTEM', `Event logging ${enabled ? 'enabled' : 'disabled'}`, {});
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this._isEnabled;
  }

  /**
   * Export log entries as a downloadable file (browser environment)
   */
  exportLogFile(): void {
    if (typeof window === 'undefined') {
      return; // Not in browser environment
    }

    const logContent = this._logEntries.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = this._logFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    this._logEvent('SYSTEM', 'Log file exported', {
      fileName: this._logFileName,
      entryCount: this._logEntries.length,
    });
  }

  /**
   * Get statistics about logged events
   */
  getLogStatistics(): Record<string, number> {
    const stats: Record<string, number> = {};

    this._logEntries.forEach(entry => {
      const eventTypeMatch = entry.match(/\] ([A-Z_]+):/);
      if (eventTypeMatch) {
        const eventType = eventTypeMatch[1];
        stats[eventType] = (stats[eventType] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this._logEvent('SYSTEM', 'X6EventLogger disposing', {
      totalLoggedEvents: this._logEntries.length,
    });
    this._logEntries = [];
    this._isEnabled = false;
  }

  /**
   * Log an X6 event with timestamp and structured data
   */
  private _logEvent(eventType: string, message: string, data?: Record<string, unknown>): void {
    if (!this._isEnabled) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${eventType}: ${message} ${JSON.stringify(data || {})}`;

    // Add to in-memory log
    this._logEntries.push(logLine);

    // Prevent memory issues by limiting log entries
    if (this._logEntries.length > this._maxLogEntries) {
      this._logEntries = this._logEntries.slice(-this._maxLogEntries / 2);
    }

    // Use debugComponent for X6 event logging to provide component context
    // This allows for better filtering and organization of X6-specific logs

    this.logger.debugComponent('X6EventLogger', logLine);
  }

  /**
   * Get node label safely
   */
  private _getNodeLabel(node: Node): string {
    try {
      // Use X6 cell extensions if available
      if ((node as any).getLabel) {
        return (node as any).getLabel();
      }

      // Fallback to attrs
      const attrs = node.getAttrs();
      if (attrs && attrs['text'] && typeof attrs['text'] === 'object' && 'text' in attrs['text']) {
        return String((attrs['text'] as any)['text']);
      }

      return '';
    } catch {
      return '';
    }
  }
}
