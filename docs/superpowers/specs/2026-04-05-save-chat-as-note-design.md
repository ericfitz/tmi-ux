# Save Timmy Chat Sessions and Messages as Threat Model Notes

**Issue:** [#556](https://github.com/ericfitz/tmi-ux/issues/556)
**Date:** 2026-04-05
**Status:** Approved

## Overview

Add the ability to save Timmy chat content as notes on the threat model. Two actions:

1. **Save Session as Note** — saves the full session transcript
2. **Save Message as Note** — saves a single assistant message with its preceding user message

Both use direct save (no dialog) with a snackbar confirmation. This provides a low-friction sharing mechanism for private chat sessions, since notes inherit permissions from the threat model.

## Markdown Formatting

### Session Transcript Format

```markdown
**You** (Apr 5, 2026 2:34 PM PDT): What threats have been identified?

**Timmy** (Apr 5, 2026 2:34 PM PDT): Based on the threat model, there are three main threats...

**You** (Apr 5, 2026 2:35 PM PDT): Can you elaborate on the first one?

**Timmy** (Apr 5, 2026 2:35 PM PDT): The first threat involves...
```

- Role labels bolded, timestamps include timezone (Angular `DatePipe` with `'long'` format)
- Assistant message content included as-is (already markdown)
- User messages included as plain text
- Messages separated by blank lines

### Single Message Format

Includes the preceding user message for context:

```markdown
**You** (Apr 5, 2026 2:34 PM PDT): What threats have been identified?

**Timmy** (Apr 5, 2026 2:34 PM PDT): Based on the threat model, there are three main threats...
```

### Note Titles

- **Session** → session title (auto-generated from first user message)
- **Single message** → first ~50 characters of the assistant message content, or `"Timmy response — {date}"` if content is too short or only contains code/formatting

### Note Defaults

- `include_in_report: false` — chat transcripts should not appear in reports by default
- `timmy_enabled: false` — chat transcripts should not feed back into Timmy context

## Component Changes

### ChatSessionPanelComponent

**File:** `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.ts`

- Add `note_add` action button on each session row (alongside existing delete button)
- New `@Output() sessionSavedAsNote = new EventEmitter<string>()` — emits session ID
- Button uses `matTooltip` with localized label (follows action button pattern)
- Button hidden when session has no messages

### ChatMessagesComponent

**File:** `src/app/pages/chat/components/chat-messages/chat-messages.component.ts`

- Add `note_add` action button on each **complete** assistant message bubble
- Not shown on: streaming messages, user messages, error messages
- New `@Output() messageSavedAsNote = new EventEmitter<string>()` — emits message ID
- Button appears on hover or focus

### ChatPageComponent

**File:** `src/app/pages/chat/components/chat-page/chat-page.component.ts`

- Handles both output events from child components
- For session save: formats all messages in the active session into transcript markdown, calls `ThreatModelService.createNote()`, shows snackbar
- For message save: finds the assistant message + preceding user message by ID, formats them, calls `ThreatModelService.createNote()`, shows snackbar
- Formatting logic as private methods in the component
- Injects `ThreatModelService`, `MatSnackBar`, `Router`, `DatePipe`

### No New Components or Services

All logic fits within existing component boundaries.

## Snackbar Behavior

- Duration: 5 seconds
- Text: localized "Saved as note"
- Action: "View" — navigates to `/tm/{threatModelId}/note/{noteId}` (note page in view mode)
- Uses `MatSnackBar` with localized strings

## Error Handling

- If `ThreatModelService.createNote()` fails: show error snackbar with localized message, log via `LoggerService`
- No retry logic — user can click the button again
- Button disabled while a save is in flight (prevents duplicate notes from double-clicks)

## Edge Cases

- Session with no messages → save button hidden
- Streaming message in progress → `note_add` button not shown on that message
- Very long sessions → no truncation (note content field supports up to 262,144 chars)

## i18n

New keys under `chat`:

```json
"saveSessionAsNote": "Save session as note",
"saveMessageAsNote": "Save message as note",
"savedAsNote": "Saved as note",
"savedAsNoteView": "View",
"saveAsNoteError": "Could not save as note. Please try again."
```

Backfill to all 15 locales.

## Future Consideration

[#558](https://github.com/ericfitz/tmi-ux/issues/558) tracks investigating whether these actions should optionally open a pre-populated note editor dialog instead of saving automatically.
