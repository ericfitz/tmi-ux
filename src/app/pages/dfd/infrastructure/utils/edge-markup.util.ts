// v3.1.7's public barrel (lib/view/index.d.ts) re-exports the `Markup` value but not the
// `MarkupJSONMarkup` type; deep import is intentional. Revisit when the pnpm patch is dropped.
import type { MarkupJSONMarkup } from '@antv/x6/lib/view/markup';

/**
 * Returns the static X6 edge markup configuration shared by edge-creating
 * infrastructure code. The markup defines a transparent "wrap" path (a wide,
 * invisible hit area that makes the edge easier to select) layered beneath the
 * visible "line" path.
 *
 * @returns The X6 JSON markup describing the edge's wrap and line paths.
 */
// SEM@e99bb98ad3ad07b8d4047d771022c542c89d8e39: build the X6 edge markup with transparent hit-area and visible line paths (pure)
export function getEdgeMarkup(): MarkupJSONMarkup[] {
  return [
    {
      tagName: 'path',
      selector: 'wrap',
      groupSelector: 'lines',
      attrs: {
        fill: 'none',
        cursor: 'pointer',
        stroke: 'transparent',
        strokeLinecap: 'round',
      },
    },
    {
      tagName: 'path',
      selector: 'line',
      groupSelector: 'lines',
      attrs: {
        fill: 'none',
        pointerEvents: 'none',
      },
    },
  ];
}
