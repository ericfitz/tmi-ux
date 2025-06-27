/**
 * Custom matchers for testing AntV/X6 graph components
 */

import { Graph, Node } from '@antv/x6';

// Type definitions for the custom matchers
interface ChaiStatic {
  Assertion: {
    // We need to use any here for the Chai API to work correctly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addMethod: (name: string, fn: (this: ChaiAssertionThis, ...args: any[]) => void) => void;
  };
}

interface ChaiAssertionThis {
  _obj: Graph;
  assert: (
    expression: boolean,
    message: string,
    negatedMessage: string,
    expected?: unknown,
    actual?: unknown,
    showDiff?: boolean,
  ) => void;
}

type ChaiPlugin = (chai: ChaiStatic, utils: unknown) => void;

/**
 * Add custom matchers for AntV/X6 graphs to Chai
 */
export const graphMatchers: ChaiPlugin = (chai, _utils) => {
  const Assertion = chai.Assertion;

  Assertion.addMethod('haveNode', function (nodeId: string) {
    const graph = this._obj;
    const node = graph.getCellById(nodeId);

    this.assert(
      node !== null && node.isNode(),
      `expected graph to have node with id '${nodeId}'`,
      `expected graph to not have node with id '${nodeId}'`,
      true,
      node === null ? null : node.id,
    );
  });

  Assertion.addMethod('haveEdge', function (edgeId: string) {
    const graph = this._obj;
    const edge = graph.getCellById(edgeId);

    this.assert(
      edge !== null && edge.isEdge(),
      `expected graph to have edge with id '${edgeId}'`,
      `expected graph to not have edge with id '${edgeId}'`,
      true,
      edge === null ? null : edge.id,
    );
  });

  Assertion.addMethod('haveNodeCount', function (count: number) {
    const graph = this._obj;
    const nodes = graph.getNodes();

    this.assert(
      nodes.length === count,
      `expected graph to have ${count} nodes, but got ${nodes.length}`,
      `expected graph to not have ${count} nodes`,
      count,
      nodes.length,
    );
  });

  Assertion.addMethod('haveEdgeCount', function (count: number) {
    const graph = this._obj;
    const edges = graph.getEdges();

    this.assert(
      edges.length === count,
      `expected graph to have ${count} edges, but got ${edges.length}`,
      `expected graph to not have ${count} edges`,
      count,
      edges.length,
    );
  });

  Assertion.addMethod('haveConnection', function (sourceId: string, targetId: string) {
    const graph = this._obj;
    const edges = graph.getEdges();
    const hasConnection = edges.some(
      edge => edge.getSourceCellId() === sourceId && edge.getTargetCellId() === targetId,
    );

    this.assert(
      hasConnection,
      `expected graph to have connection from '${sourceId}' to '${targetId}'`,
      `expected graph to not have connection from '${sourceId}' to '${targetId}'`,
      true,
      hasConnection,
    );
  });

  Assertion.addMethod('haveNodeWithLabel', function (label: string) {
    const graph = this._obj;
    const nodes = graph.getNodes();
    const hasNodeWithLabel = nodes.some(node => {
      // Use standardized text/text attribute for node labels
      const nodeLabel = node.attr('text/text');
      return typeof nodeLabel === 'string' && nodeLabel === label;
    });

    this.assert(
      hasNodeWithLabel,
      `expected graph to have node with label '${label}'`,
      `expected graph to not have node with label '${label}'`,
      true,
      hasNodeWithLabel,
    );
  });

  Assertion.addMethod('haveSelectedNode', function (nodeId: string) {
    const graph = this._obj;
    const node = graph.getCellById(nodeId) as Node;

    // In X6, selection is typically indicated by a CSS class or a visual highlight
    // Since we can't directly access the selection state from the Graph API in this context,
    // we'll check if the node has a selection-related property
    const isSelected = node && node.getProp('selected') === true;

    this.assert(
      node !== null && node.isNode() && isSelected,
      `expected graph to have selected node with id '${nodeId}'`,
      `expected graph to not have selected node with id '${nodeId}'`,
      true,
      node === null ? null : isSelected,
    );
  });
};

/**
 * Register the graph matchers with Cypress
 */
export const registerGraphMatchers = (): void => {
  if (typeof window !== 'undefined') {
    // Check if Cypress and chai are available
    const cypressExists = 'Cypress' in window;
    const chaiExists = 'chai' in window;

    if (cypressExists && chaiExists) {
      // Safely access chai with proper type checking
      // First cast to unknown to avoid type errors
      const windowAny = window as unknown;
      // Then cast to the specific type we need
      const windowWithChai = windowAny as { chai: { use: (plugin: ChaiPlugin) => void } };

      if (typeof windowWithChai.chai?.use === 'function') {
        windowWithChai.chai.use(graphMatchers);
      }
    }
  }
};
