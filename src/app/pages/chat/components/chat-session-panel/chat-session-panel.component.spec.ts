// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { describe, it, expect, beforeEach } from 'vitest';

import { ChatSessionPanelComponent } from './chat-session-panel.component';
import type { ChatSession, SourceSnapshotEntry } from '../../models/chat.model';

describe('ChatSessionPanelComponent', () => {
  let component: ChatSessionPanelComponent;

  function makeSession(overrides: Partial<ChatSession> = {}): ChatSession {
    return {
      id: 's1',
      threat_model_id: 'tm-1',
      title: '',
      source_snapshot: [],
      status: 'active',
      created_at: '2024-01-15T10:30:00Z',
      modified_at: '2024-01-15T10:30:00Z',
      ...overrides,
    };
  }

  beforeEach(() => {
    component = new ChatSessionPanelComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('sourceGroups', () => {
    it('is empty when there is no source snapshot', () => {
      component.sourceSnapshot = [];

      expect(component.sourceGroups).toEqual([]);
    });

    it('groups entries by entity type in the fixed display order', () => {
      component.sourceSnapshot = [
        { entity_type: 'threat', entity_id: 't1' },
        { entity_type: 'asset', entity_id: 'a1' },
        { entity_type: 'asset', entity_id: 'a2' },
        { entity_type: 'note', entity_id: 'n1' },
      ];

      const groups = component.sourceGroups;

      // typeOrder is asset, threat, document, repository, note, diagram
      expect(groups.map(g => g.type)).toEqual(['asset', 'threat', 'note']);
      expect(groups[0].entries).toHaveLength(2);
      expect(groups[0].labelKey).toBe('chat.sourceSummary.assets');
    });
  });

  describe('output events', () => {
    it('onSelect emits the session id', () => {
      let emitted: string | undefined;
      component.sessionSelected.subscribe(id => (emitted = id));

      component.onSelect('s9');

      expect(emitted).toBe('s9');
    });

    it('onCreate emits the create event', () => {
      let fired = false;
      component.sessionCreated.subscribe(() => (fired = true));

      component.onCreate();

      expect(fired).toBe(true);
    });

    it('onDelete stops propagation and emits the session id', () => {
      let emitted: string | undefined;
      component.sessionDeleted.subscribe(id => (emitted = id));
      let stopped = false;
      const event = { stopPropagation: () => (stopped = true) } as Event;

      component.onDelete(event, 's9');

      expect(stopped).toBe(true);
      expect(emitted).toBe('s9');
    });

    it('onSaveAsNote stops propagation and emits the session id', () => {
      let emitted: string | undefined;
      component.sessionSavedAsNote.subscribe(id => (emitted = id));
      let stopped = false;
      const event = { stopPropagation: () => (stopped = true) } as Event;

      component.onSaveAsNote(event, 's9');

      expect(stopped).toBe(true);
      expect(emitted).toBe('s9');
    });
  });

  describe('toggleSourceSummary', () => {
    it('flips the expanded flag', () => {
      expect(component.sourceSummaryExpanded).toBe(false);

      component.toggleSourceSummary();

      expect(component.sourceSummaryExpanded).toBe(true);
    });
  });

  describe('getSessionTitle', () => {
    it('returns the session title when present', () => {
      expect(component.getSessionTitle(makeSession({ title: 'My Chat' }))).toBe('My Chat');
    });

    it('builds a date-based title when the session has no title', () => {
      const title = component.getSessionTitle(makeSession({ title: '' }));

      expect(title.startsWith('Chat — ')).toBe(true);
    });
  });

  describe('formatDate', () => {
    it('returns "Yesterday" for a date one day ago', () => {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString();

      expect(component.formatDate(yesterday)).toBe('Yesterday');
    });

    it('returns an "N days ago" string within the past week', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();

      expect(component.formatDate(threeDaysAgo)).toBe('3 days ago');
    });

    it('returns a time-of-day string for today', () => {
      const result = component.formatDate(new Date().toISOString());

      // Today -> a localized time string, not a relative phrase.
      expect(result).not.toBe('Yesterday');
      expect(result).not.toContain('days ago');
    });
  });

  describe('getGroupNames', () => {
    it('joins entity names, falling back to ids', () => {
      const group = {
        type: 'asset' as const,
        labelKey: 'k',
        entries: [
          { entity_type: 'asset', entity_id: 'a1', entity_name: 'DB' },
          { entity_type: 'asset', entity_id: 'a2' },
        ] as SourceSnapshotEntry[],
      };

      expect(component.getGroupNames(group)).toBe('DB, a2');
    });
  });

  describe('trackBySessionId', () => {
    it('returns the session id', () => {
      expect(component.trackBySessionId(0, makeSession({ id: 's42' }))).toBe('s42');
    });
  });
});
