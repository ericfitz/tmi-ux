import { Injectable } from '@angular/core';
import { Graph, Cell, Node } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdCommandService } from './dfd-command.service';

/**
 * Simplified service for handling label editing using X6's built-in editor tools
 */
@Injectable({
  providedIn: 'root',
})
export class DfdLabelEditorService {
  private _commandService: DfdCommandService | null = null;

  constructor(private logger: LoggerService) {
    this.logger.info('DfdLabelEditorService initialized');
  }

  /**
   * Sets the command service (called from outside to avoid circular dependencies)
   * @param commandService The command service instance
   */
  setCommandService(commandService: DfdCommandService): void {
    this._commandService = commandService;
    this.logger.info('CommandService set in DfdLabelEditorService');
  }

  /**
   * Sets up label editing event handlers for the graph
   * @param graph The X6 graph instance
   */
  setupLabelEditingHandlers(graph: Graph): void {
    if (!graph) {
      return;
    }

    // Handle double-click on nodes to trigger label editing
    graph.on('node:dblclick', ({ node, e }) => {
      e.stopPropagation();
      this.startEditing(node, e);
    });

    // Handle double-click on edges to trigger label editing
    graph.on('edge:dblclick', ({ edge, e }) => {
      e.stopPropagation();
      this.startEditing(edge, e);
    });

    this.logger.info('Label editing handlers set up using X6 built-in editor tools');
  }

  /**
   * Starts editing using X6's built-in editor tools
   * @param cell The cell to edit (node or edge)
   * @param event The double-click event
   */
  private startEditing(cell: Cell, event: unknown): void {
    const isNode = cell.isNode();
    const toolName = isNode ? 'node-editor' : 'edge-editor';

    // Remove any existing editor tool
    cell.removeTool(toolName);

    // Add the appropriate editor tool with project styling
    cell.addTools({
      name: toolName,
      args: {
        event,
        attrs: {
          backgroundColor: isNode ? '#EFF4FF' : '#FFF',
          fontSize: '12px',
          fontFamily: "'Roboto Condensed', Arial, sans-serif",
          color: '#333',
          border: '1px solid #1890ff',
          borderRadius: '2px',
          padding: '2px',
          outline: 'none',
        },
      },
    });

    this.logger.info(`Started editing ${isNode ? 'node' : 'edge'} label`, {
      cellId: cell.id,
      cellType: isNode ? 'node' : 'edge',
    });
  }

  /**
   * Legacy method for backward compatibility - now simplified
   * @param node The node to apply label position to
   * @param _graph The X6 graph instance (optional, not used in simplified version)
   */
  applyLabelPosition(node: Node, _graph?: Graph): void {
    // In the simplified version, we don't need to do anything here
    // Label positioning is handled by X6's built-in editor tools
    this.logger.debug('applyLabelPosition called (simplified version - no action needed)', {
      nodeId: node.id,
    });
  }
}
