// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Graph } from '@antv/x6';

import { GraphDataDialogComponent } from './graph-data-dialog.component';
import * as clipboardUtil from '../../../../../shared/utils/clipboard.util';

describe('GraphDataDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  /** Build an X6-graph stub whose toJSON returns the given object. */
  // SEM@e81349f7ea7bf60d484b2d87b1182fd5bd360a1f: build a minimal Graph test stub returning the given JSON object (pure)
  function graphStub(json: object): Graph {
    return { toJSON: () => json } as unknown as Graph;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    vi.restoreAllMocks();
  });

  it('serializes the graph to JSON on construction', () => {
    const graph = graphStub({ cells: [{ id: 'n1' }] });
    const component = new GraphDataDialogComponent(mockDialogRef as never, { graph });

    expect(component.graphJson).toContain('"id"');
    expect(component.graphJson).toContain('n1');
  });

  it('captures a serialization error rather than throwing', () => {
    const graph = {
      toJSON: () => {
        throw new Error('serialization failed');
      },
    } as unknown as Graph;

    const component = new GraphDataDialogComponent(mockDialogRef as never, { graph });

    expect(component.graphJson).toContain('Failed to serialize graph');
  });

  describe('onCopyToClipboard', () => {
    it('copies the serialized JSON via the clipboard util', () => {
      const spy = vi.spyOn(clipboardUtil, 'copyToClipboard').mockImplementation(() => undefined);
      const component = new GraphDataDialogComponent(mockDialogRef as never, {
        graph: graphStub({ cells: [] }),
      });

      component.onCopyToClipboard();

      expect(spy).toHaveBeenCalledWith(component.graphJson);
    });
  });

  describe('onClose', () => {
    it('closes the dialog', () => {
      const component = new GraphDataDialogComponent(mockDialogRef as never, {
        graph: graphStub({ cells: [] }),
      });

      component.onClose();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
