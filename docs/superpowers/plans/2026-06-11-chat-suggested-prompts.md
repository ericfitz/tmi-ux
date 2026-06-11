# Chat Suggested-Prompt Chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three plain `mat-button` suggested prompts in the Timmy chat empty state with interactive Material chips (tmi-ux#692; spec: `docs/superpowers/specs/2026-06-11-chat-suggested-prompts-design.md`).

**Architecture:** Markup-level swap in one component template plus minor SCSS; behavior, i18n keys, and disabled logic unchanged.

**Tech Stack:** Angular Material chips (MDC), Vitest. Not blocked.

---

### Task 1: Verify the interactive-chip construction

- [ ] **Step 1:** Check the installed Angular Material version (`package.json`) and its chips API (use the Context7 docs tool or https://material.angular.dev/components/chips). Determine the correct construction for an **action chip** (clickable + keyboard-activatable, no persistent selected state). Expected: `<mat-chip-listbox>` containing `<mat-chip-option selectable="false">`, which gives focus/Enter/Space semantics; plain `<mat-chip>` in `<mat-chip-set>` is presentational and will NOT work. If Material 21 offers a dedicated action-chip directive, prefer it.
- [ ] **Step 2:** Check how `mat-chip` is used in `src/app/pages/admin/addons/admin-addons.component.html` and `src/app/pages/triage/components/triage-list/triage-list.component.html` for codebase idiom (those are likely presentational; the construction may differ — that's fine, but match import style).

### Task 2: Swap the markup (TDD)

**Files:**
- Modify: `src/app/pages/chat/components/chat-messages/chat-messages.component.html` (lines 8–30)
- Modify: `src/app/pages/chat/components/chat-messages/chat-messages.component.ts` (imports array)
- Modify: `src/app/pages/chat/components/chat-messages/chat-messages.component.scss` (`.suggested-prompts` rules, if button-specific)
- Modify: `src/app/pages/chat/components/chat-messages/chat-messages.component.spec.ts`

- [ ] **Step 1: Update/extend the component spec first.** Find existing empty-state/suggested-prompt tests. Assert: (a) activating a suggestion sets `messageText` to the translated prompt and calls `onSend()`; (b) suggestions are disabled when `isInputDisabled` is true. If the spec tests class logic directly (this project's idiom), the send-path test likely already exists — keep it green; add the disabled-state coverage if missing. Run the spec; any NEW assertions should fail only if they describe behavior not yet present (the send behavior itself is unchanged, so most assertions stay green through the swap).

- [ ] **Step 2: Replace the markup.** Current block (lines 8–30) is three `<button mat-button ...>` elements. Replace with (adjust per Task 1's verified construction):

```html
<mat-chip-listbox class="suggested-prompts" aria-label="{{ t('chat.emptyState.title') }}">
  <mat-chip-option
    [selectable]="false"
    [disabled]="isInputDisabled"
    (click)="messageText = t('chat.suggestedPrompts.summary'); onSend()"
  >
    {{ t('chat.suggestedPrompts.summary') }}
  </mat-chip-option>
  <mat-chip-option
    [selectable]="false"
    [disabled]="isInputDisabled"
    (click)="messageText = t('chat.suggestedPrompts.threats'); onSend()"
  >
    {{ t('chat.suggestedPrompts.threats') }}
  </mat-chip-option>
  <mat-chip-option
    [selectable]="false"
    [disabled]="isInputDisabled"
    (click)="messageText = t('chat.suggestedPrompts.assets'); onSend()"
  >
    {{ t('chat.suggestedPrompts.assets') }}
  </mat-chip-option>
</mat-chip-listbox>
```

Add `MatChipsModule` (from `@angular/material/chips`) to the component's `imports` array. Keep the `.suggested-prompts` class on the container so existing layout SCSS applies; if the SCSS contains button-specific rules for this block, replace them with chip-appropriate layout (flex, gap, centered) — no colors, no hard-coded hex; chips theme themselves.

Keyboard note: verify Enter/Space on a focused chip triggers the click handler (chip-option emits selection on keyboard activation — if `(click)` doesn't fire on keyboard with `selectable=false` in the installed version, bind `(selectionChange)` or `(keydown.enter)`/`(keydown.space)` equivalently; the acceptance criterion is keyboard activation sends the prompt).

- [ ] **Step 3:** Run the component spec — PASS. Run `pnpm run lint:all` and `pnpm run build` — clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/chat/components/chat-messages/
git commit -m "feat(chat): suggested prompts as chips for clearer affordance (#692)"
```

### Task 3: Visual verification + close-out

- [ ] **Step 1:** Run the app (`pnpm run dev`), open the Timmy chat empty state, and verify in all four palette combinations (light/dark × normal/colorblind via the app's theme switcher): chips render outlined and legible, hover/focus states visible, disabled state distinct, no stuck selected state after clicking.
- [ ] **Step 2:** If visual-regression E2E baselines cover the chat empty state, update baselines per the visual-regression-triage workflow (intentional change).
- [ ] **Step 3:** `pnpm test` full suite; `superpowers:requesting-code-review` per project policy.
- [ ] **Step 4:** Comment on tmi-ux#692 referencing the commit and close it explicitly (`gh issue comment 692` + `gh issue close 692`); commits on `dev/1.4.0` do not auto-close.
