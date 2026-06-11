// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ChatMessagesComponent } from './chat-messages.component';
import type { ChatMessage, PreparationStatus } from '../../models/chat.model';

describe('ChatMessagesComponent', () => {
  let component: ChatMessagesComponent;

  function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
      id: 'm1',
      session_id: 's1',
      role: 'user',
      content: 'hello',
      sequence: 1,
      created_at: '2024-01-01T00:00:00Z',
      ...overrides,
    };
  }

  function makePreparationStatus(overrides: Partial<PreparationStatus> = {}): PreparationStatus {
    return {
      phase: 'building_context',
      entityName: 'Asset A',
      progress: 0,
      ...overrides,
    };
  }

  beforeEach(() => {
    component = new ChatMessagesComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('isInputDisabled', () => {
    it('is false in the default idle state', () => {
      expect(component.isInputDisabled).toBe(false);
    });

    it('is true while loading', () => {
      component.loading = true;
      expect(component.isInputDisabled).toBe(true);
    });

    it('is true while a preparation status is active', () => {
      component.preparationStatus = makePreparationStatus();
      expect(component.isInputDisabled).toBe(true);
    });

    it('is true when explicitly disabled by the parent', () => {
      component.inputDisabled = true;
      expect(component.isInputDisabled).toBe(true);
    });
  });

  describe('isSendDisabled', () => {
    it('is true when the message text is empty', () => {
      component.messageText = '   ';
      expect(component.isSendDisabled).toBe(true);
    });

    it('is false when there is text and the input is enabled', () => {
      component.messageText = 'a question';
      expect(component.isSendDisabled).toBe(false);
    });

    it('is true when there is text but the input is disabled', () => {
      component.messageText = 'a question';
      component.loading = true;
      expect(component.isSendDisabled).toBe(true);
    });
  });

  describe('isStreaming', () => {
    it('is true only for the streaming message id', () => {
      component.streamingMessageId = 'm5';

      expect(component.isStreaming(makeMessage({ id: 'm5' }))).toBe(true);
      expect(component.isStreaming(makeMessage({ id: 'm6' }))).toBe(false);
    });
  });

  describe('onSend', () => {
    it('emits the trimmed message and clears the input', () => {
      let emitted: string | undefined;
      component.messageSent.subscribe(t => (emitted = t));
      component.messageText = '  what is STRIDE?  ';

      component.onSend();

      expect(emitted).toBe('what is STRIDE?');
      expect(component.messageText).toBe('');
    });

    it('does nothing when the message is empty', () => {
      let fired = false;
      component.messageSent.subscribe(() => (fired = true));
      component.messageText = '   ';

      component.onSend();

      expect(fired).toBe(false);
    });

    it('does nothing when the input is disabled', () => {
      let fired = false;
      component.messageSent.subscribe(() => (fired = true));
      component.messageText = 'a question';
      component.loading = true;

      component.onSend();

      expect(fired).toBe(false);
      expect(component.messageText).toBe('a question');
    });
  });

  describe('onKeydown', () => {
    it('sends on Enter without shift', () => {
      let emitted: string | undefined;
      component.messageSent.subscribe(t => (emitted = t));
      component.messageText = 'hello';
      const event = {
        key: 'Enter',
        shiftKey: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;

      component.onKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(emitted).toBe('hello');
    });

    it('does not send on Shift+Enter (newline)', () => {
      let fired = false;
      component.messageSent.subscribe(() => (fired = true));
      component.messageText = 'hello';
      const event = {
        key: 'Enter',
        shiftKey: true,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent;

      component.onKeydown(event);

      expect(fired).toBe(false);
    });
  });

  describe('onSuggestedPrompt', () => {
    it('sets messageText and sends it', () => {
      let emitted: string | undefined;
      component.messageSent.subscribe(t => (emitted = t));

      component.onSuggestedPrompt('Summarize this threat model');

      expect(emitted).toBe('Summarize this threat model');
      expect(component.messageText).toBe('');
    });

    it('does nothing when the input is disabled', () => {
      let fired = false;
      component.messageSent.subscribe(() => (fired = true));
      component.loading = true;

      component.onSuggestedPrompt('Summarize this threat model');

      expect(fired).toBe(false);
      expect(component.messageText).toBe('');
    });

    it('trims the prompt before sending', () => {
      let emitted: string | undefined;
      component.messageSent.subscribe(t => (emitted = t));

      component.onSuggestedPrompt('  What are the main threats?  ');

      expect(emitted).toBe('What are the main threats?');
    });
  });

  describe('onSaveAsNote', () => {
    it('emits the message id', () => {
      let emitted: string | undefined;
      component.messageSavedAsNote.subscribe(id => (emitted = id));

      component.onSaveAsNote('m9');

      expect(emitted).toBe('m9');
    });
  });

  describe('ngOnChanges', () => {
    /** Attach a stub messages container so a flagged scroll is observable. */
    function attachContainer(): { scrollTop: number; scrollHeight: number } {
      const el = { scrollTop: 0, scrollHeight: 500 };
      component.messagesContainer = { nativeElement: el } as never;
      return el;
    }

    it('scrolls on the next view-check when the messages input changes', () => {
      const el = attachContainer();

      component.ngOnChanges({ messages: {} as never });
      component.ngAfterViewChecked();

      expect(el.scrollTop).toBe(500);
    });

    it('scrolls on the next view-check when the streaming message id changes', () => {
      const el = attachContainer();

      component.ngOnChanges({ streamingMessageId: {} as never });
      component.ngAfterViewChecked();

      expect(el.scrollTop).toBe(500);
    });

    it('does not scroll for an unrelated input change', () => {
      const el = attachContainer();

      component.ngOnChanges({ loading: {} as never });
      component.ngAfterViewChecked();

      expect(el.scrollTop).toBe(0);
    });

    it('clears the scroll flag after a single view-check', () => {
      const el = attachContainer();
      component.ngOnChanges({ messages: {} as never });
      component.ngAfterViewChecked();

      // A second view-check without a new change must not re-scroll.
      el.scrollTop = 0;
      component.ngAfterViewChecked();

      expect(el.scrollTop).toBe(0);
    });
  });

  describe('messageStatusLabel', () => {
    it('returns the translated label when a key exists', () => {
      const t = (key: string): string =>
        key === 'chat.messageStatus.gathering' ? 'Gathering context' : key;

      expect(component.messageStatusLabel(t, 'gathering', 'Asset A')).toBe('Gathering context');
    });

    it('falls back to the raw phase when no translation key is defined', () => {
      // identity translate -> translated === key -> fall back to phase
      const t = (key: string): string => key;

      expect(component.messageStatusLabel(t, 'unknown_phase', 'X')).toBe('unknown_phase');
    });
  });

  describe('trackByMessageId', () => {
    it('returns the message id', () => {
      expect(component.trackByMessageId(0, makeMessage({ id: 'm42' }))).toBe('m42');
    });
  });

  describe('scrollToBottom', () => {
    it('does not throw when there is no container', () => {
      component.messagesContainer = undefined;

      expect(() => component.scrollToBottom()).not.toThrow();
    });

    it('scrolls the container to its full height', () => {
      const el = { scrollTop: 0, scrollHeight: 500 };
      component.messagesContainer = { nativeElement: el } as never;

      component.scrollToBottom();

      expect(el.scrollTop).toBe(500);
    });
  });
});
