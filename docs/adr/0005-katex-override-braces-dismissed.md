# ADR 0005: Override KaTeX to a fixed release; keep the braces advisory dismissed

- **Status:** Accepted
- **Date:** 2026-10-08
- **Decision by:** Eric Fitzgerald (human decision)
- **Related:** #992, #991 (KaTeX, GHSA-238p-pmpm-9mq7), #990 (braces, GHSA-vfj7-8cjw-p6xm)

## Context

Two Dependabot alerts were dismissed as tolerable on 2026-10-06 and investigated in #992.

- **KaTeX** (< 0.18.2, prototype pollution can bypass `trust`). The only loader in the browser is
  mermaid, in a lazily loaded chunk, which renders `$$...$$` math in diagram labels inside user
  notes (via ngx-markdown). No `trust` option is enabled and mermaid uses `securityLevel: strict`.
  Exploiting it needs prototype pollution elsewhere in the page first, which isn't present today;
  even then, the worst outcome observed through the app's DOMPurify is a clickable link or an
  external fetch, not script execution. Every mermaid release declares `katex ^0.16.47`, so no
  normal update reaches the fix.
- **braces** (<= 3.0.3, stack exhaustion on deeply nested patterns). No patched release exists. It
  is reached through stylelint/globby/fast-glob and, in the server container image, through
  http-proxy-middleware -> micromatch. braces only parses glob patterns we write; server.js uses
  plain-prefix proxy filters, so request paths never reach micromatch.

## Decision

- Add a pnpm override `"katex": ">=0.18.2 <0.20"` (bounded, with a `comments` entry), as defense in
  depth. A scratch install resolves 0.19.0; the KaTeX MathML output mermaid uses was byte-identical.
- Keep the braces alert dismissed. Correct #990's note that nothing on its path ships (the server
  image does) and add the Dockerfile.chainguard `runtime-deps` stage to its reassessment trigger.

## Consequences

- The KaTeX override stays until mermaid declares a fixed KaTeX range; drop it then.
- Adopting the override needs `pnpm run verify`, a manual render of `$$\frac{a}{b}$$` in a
  flowchart and a sequence-diagram label inside a note, and the DFD/markdown visual-regression
  plates.
- braces is reassessed if a fixed release appears, if any code passes input we don't control as a
  glob pattern, or if server.js starts using glob path filters.
- Evidence: `.local/992-findings.md` (machine-local).
