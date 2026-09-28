# ADR 0001: X6 cell helpers are plain functions, not prototype extensions

- **Status:** Accepted
- **Date:** 2026-09-28
- **Decision by:** Eric Fitzgerald (human decision)
- **Issue:** [#900](https://github.com/ericfitz/tmi-ux/issues/900)

## Context

`src/app/pages/dfd/utils/x6-cell-extensions.ts` installed ten DFD-specific methods on the
`@antv/x6` `Cell.prototype` (`setLabel`, `getLabel`, `getNodeTypeInfo`, the application metadata
accessors, and others) through `(Cell.prototype as any)`, from `initializeX6CellExtensions()`
called in two constructors. Nothing declared the methods to TypeScript, so every caller cast to
`any` to reach them (about 86 production sites plus a large spec cluster tracked in #870).

Five of the ten methods had no callers. The untyped access also hid three latent bugs:
`InfraEdgeQueryService.findEdgesByMetadata` called a `getMetadata()` method that was never
installed; `InfraVisualEffectsService` passed `null` to a `string` parameter to "clear" metadata;
and `CellDataExtractionService` treated `getLabel()` as returning a label object when it returns a
string, so the DFD threat dialog never showed live cell labels.

## Options considered

1. **Module augmentation** (`declare module '@antv/x6' { interface Cell { ... } }`). Removes the
   casts with a mechanical diff, but the types would claim every `Cell` has the methods whether or
   not initialization ran (a missed init becomes a runtime crash with no type error). Keeps
   mutating a third-party prototype; `@antv/x6` is exact-pinned and patched, and a future upstream
   method with the same name would clash silently.
2. **Plain exported functions** (`getCellLabel(cell)`, `setCellLabel(cell, label)`,
   `getNodeTypeInfo(cell)`, `get/set/removeApplicationMetadata(cell, ...)`). Honest types, no
   global mutation, no init ordering, specs need no setup. Costs a wider call-site rewrite.
3. Augmentation now, functions later. Rejected: does the call-site work twice.

## Decision

Option 2. The prototype extensions and `initializeX6CellExtensions()` are removed; the helpers are
plain functions in `x6-cell-extensions.ts`. Unused methods (`hasApplicationMetadata`, `isNodeType`,
`updatePortVisibility`, `getPortConnectionState` on `Cell`) are deleted; `removeApplicationMetadata`
is kept because the metadata cleanup fixes use it. `getNodeTypeInfo` keeps its
`NodeTypeInfo | null` return so callers must handle non-nodes. The three latent bugs above are
fixed in the same change.

## Consequences

- Do not add methods to X6 prototypes; add a function to `x6-cell-extensions.ts` instead.
- Temporary metadata (`_originalZIndex`, `_originalStroke`, `_originalStrokeWidth`) is now
  removed on cleanup rather than left behind as empty or `null` entries in `data._metadata`.
