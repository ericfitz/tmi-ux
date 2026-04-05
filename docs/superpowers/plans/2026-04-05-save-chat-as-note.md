# Save Timmy Chat as Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "save as note" buttons to Timmy chat sessions and assistant messages, creating threat model notes via direct save with snackbar confirmation.

**Architecture:** Two new `@Output()` events bubble from child components to `ChatPageComponent`, which formats messages as markdown and calls `ThreatModelService.createNote()`. No new components or services. Formatting logic lives as private methods in `ChatPageComponent`.

**Tech Stack:** Angular 19, Angular Material, Transloco i18n, Vitest, RxJS

**Spec:** `docs/superpowers/specs/2026-04-05-save-chat-as-note-design.md`

---

### Task 1: Add i18n keys to en-US.json

**Files:**
- Modify: `src/assets/i18n/en-US.json` (inside the `"chat"` object, around line 544)

- [ ] **Step 1: Add new chat i18n keys**

Add these keys inside the `"chat"` object in `src/assets/i18n/en-US.json`, after the existing `"deleteSession"` key (line 546):

```json
"saveSessionAsNote": "Save session as note",
"saveMessageAsNote": "Save message as note",
"savedAsNote": "Saved as note",
"savedAsNoteView": "View",
"saveAsNoteError": "Could not save as note. Please try again.",
```

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all`
Expected: PASS (no lint errors)

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "feat(i18n): add save-as-note chat keys (#556)"
```

---

### Task 2: Backfill i18n keys to all locales

**Files:**
- Modify: All 15 non-English locale files in `src/assets/i18n/`

- [ ] **Step 1: Run localization backfill**

Use the `/localization-backfill` skill to backfill the new `chat.saveSessionAsNote`, `chat.saveMessageAsNote`, `chat.savedAsNote`, `chat.savedAsNoteView`, and `chat.saveAsNoteError` keys to all 15 non-English locale files. The skill handles translation and formatting.

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/*.json
git commit -m "chore(i18n): backfill save-as-note keys to all locales (#556)"
```

---

### Task 3: Add "Save as Note" button to ChatSessionPanelComponent

**Files:**
- Modify: `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.ts`
- Modify: `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.html`

- [ ] **Step 1: Add output and handler to the component class**

In `chat-session-panel.component.ts`, add a new `@Input()` and `@Output()` after the existing `sessionDeleted` output (line 28):

```typescript
@Input() savingNote = false;
@Output() sessionSavedAsNote = new EventEmitter<string>();
```

Add a handler method after the existing `onDelete` method (after line 79):

```typescript
onSaveAsNote(event: Event, sessionId: string): void {
  event.stopPropagation();
  this.sessionSavedAsNote.emit(sessionId);
}
```

- [ ] **Step 2: Add the button to the template**

In `chat-session-panel.component.html`, add a `note_add` button before the existing delete button (before line 52), inside the `mat-list-item` for each session. The button is hidden when `messages` is empty (the session panel doesn't have access to messages per session, so we always show the button since only active sessions with loaded messages will have it be meaningful). The button is disabled while a save is in flight:

```html
<button
  mat-icon-button
  class="save-note-btn"
  [matTooltip]="t('chat.saveSessionAsNote')"
  [disabled]="savingNote"
  (click)="onSaveAsNote($event, session.id)"
>
  <mat-icon>note_add</mat-icon>
</button>
```

- [ ] **Step 3: Run lint and build**

Run: `pnpm run lint:all && pnpm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/chat/components/chat-session-panel/
git commit -m "feat(chat): add save-session-as-note button to session panel (#556)"
```

---

### Task 4: Add "Save as Note" button to ChatMessagesComponent

**Files:**
- Modify: `src/app/pages/chat/components/chat-messages/chat-messages.component.ts`
- Modify: `src/app/pages/chat/components/chat-messages/chat-messages.component.html`
- Modify: `src/app/pages/chat/components/chat-messages/chat-messages.component.scss`

- [ ] **Step 1: Add output and helper to the component class**

In `chat-messages.component.ts`, add a new `@Output()` after the existing `messageSent` output (line 46):

```typescript
@Output() messageSavedAsNote = new EventEmitter<string>();
```

Add a new `@Input()` and a method to check if a message should show the save button (after the `isStreaming` method, after line 63):

```typescript
@Input() savingNote = false;
```

```typescript
canSaveAsNote(message: ChatMessage): boolean {
  return message.role === 'assistant' && !this.isStreaming(message);
}

onSaveAsNote(messageId: string): void {
  this.messageSavedAsNote.emit(messageId);
}
```

- [ ] **Step 2: Add the button to the template**

In `chat-messages.component.html`, add the save button inside the `.message-content` div for assistant messages. After the closing tag of the `@if (message.role === 'assistant' && !isStreaming(message))` block's markdown (after line 50, within the message-content div), add:

```html
@if (canSaveAsNote(message)) {
  <button
    mat-icon-button
    class="save-note-btn"
    [matTooltip]="t('chat.saveMessageAsNote')"
    (click)="onSaveAsNote(message.id)"
  >
    <mat-icon>note_add</mat-icon>
  </button>
}
```

The button should be placed after the `</markdown>` tag and before the `} @else {` block. Restructure the template so the button is inside the assistant message block:

Replace lines 49-58:
```html
@if (message.role === 'assistant' && !isStreaming(message)) {
  <markdown [data]="message.content"></markdown>
  <button
    mat-icon-button
    class="save-note-btn"
    [matTooltip]="t('chat.saveMessageAsNote')"
    [disabled]="savingNote"
    (click)="onSaveAsNote(message.id)"
  >
    <mat-icon>note_add</mat-icon>
  </button>
} @else {
  <p>
    {{ message.content }}
    @if (isStreaming(message)) {
      <span class="typing-cursor"></span>
    }
  </p>
}
```

- [ ] **Step 3: Add hover styling for the save button**

In `chat-messages.component.scss`, add styles for the save button to appear on hover:

```scss
.message .save-note-btn {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message:hover .save-note-btn,
.message .save-note-btn:focus {
  opacity: 1;
}
```

- [ ] **Step 4: Run lint and build**

Run: `pnpm run lint:all && pnpm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/chat/components/chat-messages/
git commit -m "feat(chat): add save-message-as-note button on assistant messages (#556)"
```

---

### Task 5: Write failing tests for transcript formatting logic

**Files:**
- Modify: `src/app/pages/chat/components/chat-page/chat-page.component.spec.ts`

- [ ] **Step 1: Write tests for formatSessionAsMarkdown**

Add a new `describe` block after the existing `session creation error handling` block (after line 191) in `chat-page.component.spec.ts`:

```typescript
describe('save as note formatting', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'user',
      content: 'What threats exist?',
      sequence: 0,
      createdAt: '2026-04-05T14:34:00.000Z',
    },
    {
      id: 'msg-2',
      sessionId: 'session-1',
      role: 'assistant',
      content: 'There are **three** main threats.',
      tokenCount: 42,
      sequence: 1,
      createdAt: '2026-04-05T14:34:05.000Z',
    },
    {
      id: 'msg-3',
      sessionId: 'session-1',
      role: 'user',
      content: 'Tell me more about the first one.',
      sequence: 2,
      createdAt: '2026-04-05T14:35:00.000Z',
    },
    {
      id: 'msg-4',
      sessionId: 'session-1',
      role: 'assistant',
      content: 'The first threat involves injection attacks.',
      tokenCount: 30,
      sequence: 3,
      createdAt: '2026-04-05T14:35:10.000Z',
    },
  ];

  beforeEach(() => {
    component.messages = mockMessages;
  });

  describe('formatSessionAsMarkdown', () => {
    it('should include all messages with role labels and timestamps', () => {
      const result = (component as any).formatSessionAsMarkdown(mockMessages);

      expect(result).toContain('**You**');
      expect(result).toContain('**Timmy**');
      expect(result).toContain('What threats exist?');
      expect(result).toContain('There are **three** main threats.');
      expect(result).toContain('Tell me more about the first one.');
      expect(result).toContain('The first threat involves injection attacks.');
    });

    it('should separate messages with blank lines', () => {
      const result = (component as any).formatSessionAsMarkdown(mockMessages);
      const blocks = result.split('\n\n').filter((b: string) => b.trim());

      expect(blocks.length).toBe(4);
    });
  });

  describe('formatMessageAsMarkdown', () => {
    it('should include the assistant message and preceding user message', () => {
      const result = (component as any).formatMessageAsMarkdown('msg-2', mockMessages);

      expect(result).toContain('**You**');
      expect(result).toContain('What threats exist?');
      expect(result).toContain('**Timmy**');
      expect(result).toContain('There are **three** main threats.');
    });

    it('should include only two messages', () => {
      const result = (component as any).formatMessageAsMarkdown('msg-4', mockMessages);
      const blocks = result.split('\n\n').filter((b: string) => b.trim());

      expect(blocks.length).toBe(2);
      expect(result).toContain('Tell me more about the first one.');
      expect(result).toContain('The first threat involves injection attacks.');
      expect(result).not.toContain('What threats exist?');
    });

    it('should handle first assistant message with no preceding user message', () => {
      const messagesWithoutUser: ChatMessage[] = [
        {
          id: 'msg-solo',
          sessionId: 'session-1',
          role: 'assistant',
          content: 'Hello, I am Timmy.',
          tokenCount: 10,
          sequence: 0,
          createdAt: '2026-04-05T14:34:00.000Z',
        },
      ];
      const result = (component as any).formatMessageAsMarkdown('msg-solo', messagesWithoutUser);

      expect(result).toContain('**Timmy**');
      expect(result).toContain('Hello, I am Timmy.');
      expect(result).not.toContain('**You**');
    });
  });

  describe('generateNoteTitle', () => {
    it('should truncate at word boundary and add ellipsis', () => {
      const longContent =
        'This is a very long message that goes well beyond fifty characters and should be truncated';
      const result = (component as any).generateNoteTitle(longContent);

      expect(result.length).toBeLessThanOrEqual(53); // 50 + '...' or '…'
      expect(result).toContain('…');
      expect(result).not.toContain('truncated');
    });

    it('should return short content as-is', () => {
      const result = (component as any).generateNoteTitle('Short message');

      expect(result).toBe('Short message');
    });

    it('should fall back for code-only content', () => {
      const result = (component as any).generateNoteTitle('```javascript\nconsole.log("hi")\n```');

      expect(result).toMatch(/^Timmy response/);
    });
  });
});
```

Add the `ChatMessage` import at the top of the spec file (after line 10):

```typescript
import { ChatMessage } from '../../models/chat.model';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --reporter=verbose src/app/pages/chat/components/chat-page/chat-page.component.spec.ts`
Expected: FAIL — `formatSessionAsMarkdown`, `formatMessageAsMarkdown`, `generateNoteTitle` do not exist yet

- [ ] **Step 3: Commit failing tests**

```bash
git add src/app/pages/chat/components/chat-page/chat-page.component.spec.ts
git commit -m "test(chat): add failing tests for save-as-note formatting (#556)"
```

---

### Task 6: Implement transcript formatting methods in ChatPageComponent

**Files:**
- Modify: `src/app/pages/chat/components/chat-page/chat-page.component.ts`

- [ ] **Step 1: Add the DatePipe import and injection**

In `chat-page.component.ts`, add `DatePipe` to the imports at the top of the file:

```typescript
import { DatePipe } from '@angular/common';
```

Add `DatePipe` to the component's `providers` array (add after `changeDetection` line 54):

```typescript
providers: [DatePipe],
```

Inject it in the constructor (add after `transloco` parameter, before `@Optional()`):

```typescript
private datePipe: DatePipe,
```

- [ ] **Step 2: Add formatSessionAsMarkdown method**

Add after the `createUserMessage` method (after line 381):

```typescript
private formatSessionAsMarkdown(messages: ChatMessage[]): string {
  return messages.map(m => this.formatSingleMessage(m)).join('\n\n');
}
```

- [ ] **Step 3: Add formatMessageAsMarkdown method**

Add after `formatSessionAsMarkdown`:

```typescript
private formatMessageAsMarkdown(assistantMessageId: string, messages: ChatMessage[]): string {
  const msgIndex = messages.findIndex(m => m.id === assistantMessageId);
  if (msgIndex === -1) return '';

  const assistantMsg = messages[msgIndex];
  const precedingUserMsg =
    msgIndex > 0 && messages[msgIndex - 1].role === 'user' ? messages[msgIndex - 1] : null;

  const parts: string[] = [];
  if (precedingUserMsg) {
    parts.push(this.formatSingleMessage(precedingUserMsg));
  }
  parts.push(this.formatSingleMessage(assistantMsg));
  return parts.join('\n\n');
}
```

- [ ] **Step 4: Add formatSingleMessage helper**

Add after `formatMessageAsMarkdown`:

```typescript
private formatSingleMessage(message: ChatMessage): string {
  const role = message.role === 'user' ? 'You' : 'Timmy';
  const timestamp = this.datePipe.transform(message.createdAt, 'long') ?? message.createdAt;
  return `**${role}** (${timestamp}): ${message.content}`;
}
```

- [ ] **Step 5: Add generateNoteTitle method**

Add after `formatSingleMessage`:

```typescript
private generateNoteTitle(assistantContent: string): string {
  const stripped = assistantContent.replace(/```[\s\S]*?```/g, '').trim();
  if (!stripped || stripped.length < 5) {
    const date = this.datePipe.transform(new Date(), 'mediumDate') ?? new Date().toLocaleDateString();
    return `Timmy response \u2014 ${date}`;
  }
  if (stripped.length <= 50) return stripped;

  const truncated = stripped.substring(0, 50);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '\u2026';
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test -- --reporter=verbose src/app/pages/chat/components/chat-page/chat-page.component.spec.ts`
Expected: PASS

- [ ] **Step 7: Run lint and build**

Run: `pnpm run lint:all && pnpm run build`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/chat/components/chat-page/chat-page.component.ts
git commit -m "feat(chat): implement transcript formatting for save-as-note (#556)"
```

---

### Task 7: Write failing tests for save-as-note handlers

**Files:**
- Modify: `src/app/pages/chat/components/chat-page/chat-page.component.spec.ts`

- [ ] **Step 1: Add MockThreatModelService and MockSnackBar to test setup**

In `chat-page.component.spec.ts`, add new mock interfaces after the existing `MockTranslocoService` interface (after line 37):

```typescript
interface MockThreatModelService {
  createNote: ReturnType<typeof vi.fn>;
}

interface MockSnackBar {
  open: ReturnType<typeof vi.fn>;
}

interface MockDatePipe {
  transform: ReturnType<typeof vi.fn>;
}
```

Add mock declarations inside the `describe` block (after line 50):

```typescript
let mockThreatModelService: MockThreatModelService;
let mockSnackBar: MockSnackBar;
let mockDatePipe: MockDatePipe;
```

Initialize the mocks in `beforeEach` (after `mockTransloco` initialization, before `component = new ChatPageComponent`):

```typescript
mockThreatModelService = {
  createNote: vi.fn().mockReturnValue(of({ id: 'note-1', name: 'Test', content: '' })),
};

mockSnackBar = {
  open: vi.fn().mockReturnValue({ onAction: vi.fn().mockReturnValue(EMPTY) }),
};

mockDatePipe = {
  transform: vi.fn().mockImplementation((date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }),
};
```

Update the `new ChatPageComponent(...)` constructor call to include the new dependencies. The new constructor signature will be:

```typescript
component = new ChatPageComponent(
  mockRoute as any,
  mockRouter as any,
  mockTimmyChat as any,
  mockLogger as any,
  mockCdr as any,
  mockTransloco as any,
  mockThreatModelService as any,
  mockSnackBar as any,
  mockDatePipe as any,
  null, // destroyRef
);
```

- [ ] **Step 2: Write tests for onSessionSavedAsNote**

Add a new `describe` block after the `save as note formatting` block:

```typescript
describe('onSessionSavedAsNote', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'user',
      content: 'What threats?',
      sequence: 0,
      createdAt: '2026-04-05T14:34:00.000Z',
    },
    {
      id: 'msg-2',
      sessionId: 'session-1',
      role: 'assistant',
      content: 'Three threats found.',
      tokenCount: 20,
      sequence: 1,
      createdAt: '2026-04-05T14:34:05.000Z',
    },
  ];

  beforeEach(() => {
    component.messages = mockMessages;
    component.sessions = [
      {
        id: 'session-1',
        threatModelId: 'tm-123',
        title: 'What threats?',
        sourceSnapshot: [],
        status: 'active',
        createdAt: '2026-04-05T14:34:00.000Z',
        modifiedAt: '2026-04-05T14:34:05.000Z',
      },
    ];
    component.activeSessionId = 'session-1';
  });

  it('should call createNote with session title and formatted content', () => {
    component.onSessionSavedAsNote('session-1');

    expect(mockThreatModelService.createNote).toHaveBeenCalledWith(
      'tm-123',
      expect.objectContaining({
        name: 'What threats?',
        include_in_report: false,
        timmy_enabled: false,
      }),
    );
  });

  it('should show success snackbar on save', () => {
    component.onSessionSavedAsNote('session-1');

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'chat.savedAsNote',
      'chat.savedAsNoteView',
      expect.objectContaining({ duration: 5000 }),
    );
  });

  it('should show error snackbar on failure', () => {
    mockThreatModelService.createNote.mockReturnValue(throwError(() => new Error('API error')));

    component.onSessionSavedAsNote('session-1');

    expect(mockSnackBar.open).toHaveBeenCalledWith('chat.saveAsNoteError', '', expect.any(Object));
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe('onMessageSavedAsNote', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'user',
      content: 'What threats?',
      sequence: 0,
      createdAt: '2026-04-05T14:34:00.000Z',
    },
    {
      id: 'msg-2',
      sessionId: 'session-1',
      role: 'assistant',
      content: 'Three threats found.',
      tokenCount: 20,
      sequence: 1,
      createdAt: '2026-04-05T14:34:05.000Z',
    },
  ];

  beforeEach(() => {
    component.messages = mockMessages;
    component.activeSessionId = 'session-1';
  });

  it('should call createNote with generated title and formatted content', () => {
    component.onMessageSavedAsNote('msg-2');

    expect(mockThreatModelService.createNote).toHaveBeenCalledWith(
      'tm-123',
      expect.objectContaining({
        name: 'Three threats found.',
        include_in_report: false,
        timmy_enabled: false,
      }),
    );
  });

  it('should include preceding user message in content', () => {
    component.onMessageSavedAsNote('msg-2');

    const call = mockThreatModelService.createNote.mock.calls[0];
    const noteContent = call[1].content as string;
    expect(noteContent).toContain('What threats?');
    expect(noteContent).toContain('Three threats found.');
  });

  it('should show success snackbar on save', () => {
    component.onMessageSavedAsNote('msg-2');

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'chat.savedAsNote',
      'chat.savedAsNoteView',
      expect.objectContaining({ duration: 5000 }),
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- --reporter=verbose src/app/pages/chat/components/chat-page/chat-page.component.spec.ts`
Expected: FAIL — `onSessionSavedAsNote` and `onMessageSavedAsNote` do not exist yet, constructor signature mismatch

- [ ] **Step 4: Commit failing tests**

```bash
git add src/app/pages/chat/components/chat-page/chat-page.component.spec.ts
git commit -m "test(chat): add failing tests for save-as-note handlers (#556)"
```

---

### Task 8: Implement save-as-note handlers in ChatPageComponent

**Files:**
- Modify: `src/app/pages/chat/components/chat-page/chat-page.component.ts`

- [ ] **Step 1: Add new imports**

Add `MatSnackBar` import:

```typescript
import { MatSnackBar } from '@angular/material/snack-bar';
```

Add `ThreatModelService` import:

```typescript
import { ThreatModelService } from '../../../tm/services/threat-model.service';
```

Add `Note` to the imports from the threat model models (if not already imported):

```typescript
import { Note } from '../../../tm/models/threat-model.model';
```

- [ ] **Step 2: Inject new dependencies in the constructor**

Update the constructor to add `ThreatModelService`, `MatSnackBar` after the existing `transloco` parameter (before `@Optional() private destroyRef`):

```typescript
constructor(
  private route: ActivatedRoute,
  private router: Router,
  private timmyChat: TimmyChatService,
  private logger: LoggerService,
  private cdr: ChangeDetectorRef,
  private transloco: TranslocoService,
  private threatModelService: ThreatModelService,
  private snackBar: MatSnackBar,
  private datePipe: DatePipe,
  @Optional() private destroyRef: DestroyRef,
) {}
```

- [ ] **Step 3: Add savingNote flag**

Add a state flag after `preparationStatus` (after line 66):

```typescript
savingNote = false;
```

- [ ] **Step 4: Add onSessionSavedAsNote method**

Add after the `onSessionDeleted` method (after line 157):

```typescript
onSessionSavedAsNote(sessionId: string): void {
  if (this.savingNote) return;

  const session = this.sessions.find(s => s.id === sessionId);
  if (!session) return;

  const content = this.formatSessionAsMarkdown(this.messages);
  const name = session.title;

  this.saveAsNote(name, content);
}
```

- [ ] **Step 5: Add onMessageSavedAsNote method**

Add after `onSessionSavedAsNote`:

```typescript
onMessageSavedAsNote(messageId: string): void {
  if (this.savingNote) return;

  const message = this.messages.find(m => m.id === messageId);
  if (!message || message.role !== 'assistant') return;

  const content = this.formatMessageAsMarkdown(messageId, this.messages);
  const name = this.generateNoteTitle(message.content);

  this.saveAsNote(name, content);
}
```

- [ ] **Step 6: Add private saveAsNote method**

Add after `onMessageSavedAsNote`:

```typescript
private saveAsNote(name: string, content: string): void {
  this.savingNote = true;
  this.cdr.markForCheck();

  this.threatModelService
    .createNote(this.threatModelId, {
      name,
      content,
      include_in_report: false,
      timmy_enabled: false,
    })
    .pipe(this.untilDestroyed())
    .subscribe({
      next: (note: Note) => {
        this.savingNote = false;
        this.cdr.markForCheck();

        const snackBarRef = this.snackBar.open(
          this.transloco.translate('chat.savedAsNote'),
          this.transloco.translate('chat.savedAsNoteView'),
          { duration: 5000 },
        );

        snackBarRef.onAction().subscribe(() => {
          void this.router.navigate(['/tm', this.threatModelId, 'note', note.id]);
        });
      },
      error: (err: unknown) => {
        this.savingNote = false;
        this.cdr.markForCheck();
        this.logger.error('Failed to save as note', err);
        this.snackBar.open(this.transloco.translate('chat.saveAsNoteError'), '', {
          duration: 5000,
        });
      },
    });
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm test -- --reporter=verbose src/app/pages/chat/components/chat-page/chat-page.component.spec.ts`
Expected: PASS

- [ ] **Step 8: Run lint and build**

Run: `pnpm run lint:all && pnpm run build`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/chat/components/chat-page/
git commit -m "feat(chat): implement save-as-note handlers with snackbar navigation (#556)"
```

---

### Task 9: Wire up outputs in ChatPageComponent template

**Files:**
- Modify: `src/app/pages/chat/components/chat-page/chat-page.component.html`

- [ ] **Step 1: Add sessionSavedAsNote binding to session panel**

In `chat-page.component.html`, add the new output binding to `<app-chat-session-panel>` (after the `(sessionDeleted)` binding, around line 38):

```html
(sessionSavedAsNote)="onSessionSavedAsNote($event)"
```

The full `<app-chat-session-panel>` should now look like:

```html
<app-chat-session-panel
  [sessions]="sessions"
  [activeSessionId]="activeSessionId"
  [sourceSnapshot]="activeSourceSnapshot"
  [savingNote]="savingNote"
  (sessionSelected)="onSessionSelected($event)"
  (sessionCreated)="onSessionCreated()"
  (sessionDeleted)="onSessionDeleted($event)"
  (sessionSavedAsNote)="onSessionSavedAsNote($event)"
></app-chat-session-panel>
```

- [ ] **Step 2: Add messageSavedAsNote binding to chat messages**

In `chat-page.component.html`, add the new output binding to `<app-chat-messages>` (after the `(messageSent)` binding, around line 27):

```html
(messageSavedAsNote)="onMessageSavedAsNote($event)"
```

The full `<app-chat-messages>` should now look like:

```html
<app-chat-messages
  [messages]="messages"
  [loading]="loading"
  [streamingMessageId]="streamingMessageId"
  [preparationStatus]="preparationStatus"
  [inputDisabled]="!!preparationStatus && !preparationStatus.ready"
  [savingNote]="savingNote"
  (messageSent)="onMessageSent($event)"
  (messageSavedAsNote)="onMessageSavedAsNote($event)"
></app-chat-messages>
```

- [ ] **Step 3: Run lint and build**

Run: `pnpm run lint:all && pnpm run build`
Expected: PASS

- [ ] **Step 4: Run all chat tests**

Run: `pnpm test -- --reporter=verbose src/app/pages/chat/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/chat/components/chat-page/chat-page.component.html
git commit -m "feat(chat): wire save-as-note outputs in chat page template (#556)"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full lint**

Run: `pnpm run lint:all`
Expected: PASS

- [ ] **Step 2: Run full build**

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 4: Comment on the GitHub issue**

```bash
gh issue comment 556 --repo ericfitz/tmi-ux --body "Implementation complete. Save session as note and save message as note buttons added to Timmy chat. Commits on dev/1.4.0 branch."
```

- [ ] **Step 5: Close the issue**

```bash
gh issue close 556 --repo ericfitz/tmi-ux --reason completed
```
