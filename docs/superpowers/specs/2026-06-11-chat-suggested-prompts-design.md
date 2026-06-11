# Chat Suggested-Prompt Affordance — Design

- **Issue:** [tmi-ux#692](https://github.com/ericfitz/tmi-ux/issues/692)
- **Status:** Design approved 2026-06-11. Not blocked — client-only change.

## Summary

The Timmy chat empty state's three suggested prompts were downgraded from `mat-stroked-button` to plain `mat-button` during the button-style standardization (#677), losing the "tappable suggestion" affordance. Replace them with Material **chips** — an outlined, contained pill shape that reads as interactive, conforms to the three-variant button standard (chips are not buttons, so the standard doesn't constrain them), and is already an established pattern in this codebase (admin addons/surveys/webhooks, triage pages).

## Decisions made during design

| Decision | Choice | Rationale |
|---|---|---|
| Affordance | Chips (`mat-chip-*`) | The issue's own proposed direction; restores the contained-shape affordance the stroked variant provided; Material handles theming across all four palettes. Alternatives considered: icon-prefixed text buttons (half-fixes affordance), bespoke suggestion cards (overweight for a Nice-to-Have). |
| Interactivity construction | `mat-chip-option` with `selectable="false"` (or the equivalent interactive-chip construction in the installed Angular Material 21 chip API — verify at implementation) | In MDC-based Material, plain `mat-chip` inside `mat-chip-set` is non-interactive (no click/keyboard semantics). Suggested prompts must be clickable AND keyboard-accessible. |

## Scope

`src/app/pages/chat/components/chat-messages/chat-messages.component.html` lines 8–30 (the `.suggested-prompts` block) and the component SCSS if button-specific styles exist for that block.

## Behavior (unchanged)

- Selecting a suggestion (click, or Enter/Space when focused) sets `messageText` to the localized prompt and calls `onSend()`.
- `[disabled]="isInputDisabled"` is preserved on each chip.
- The three prompts keep their existing i18n keys (`chat.suggestedPrompts.summary|threats|assets`) — **no new localized strings**.

## Acceptance

- Suggestions render as outlined chips in the empty state and visibly read as tappable.
- Click and keyboard (Tab to focus, Enter/Space to activate) both send the prompt.
- Disabled state renders and blocks activation while `isInputDisabled`.
- No selected/checked visual state persists after activation (chips are action triggers, not options).
- Renders correctly in all four palette combinations (light/dark × normal/colorblind); no hard-coded colors.

## Testing

Update `chat-messages.component.spec.ts` empty-state assertions to the new markup; keep/add a test that activating a suggestion sends the message and respects `isInputDisabled`.
