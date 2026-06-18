import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS, DATA_MATERIAL_IMPORTS } from '@app/shared/imports';
import { ChatSession, SourceSnapshotEntry, EntityType } from '../../models/chat.model';

interface SourceGroup {
  type: EntityType;
  labelKey: string;
  entries: SourceSnapshotEntry[];
}

@Component({
  selector: 'app-chat-session-panel',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...CORE_MATERIAL_IMPORTS, ...DATA_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './chat-session-panel.component.html',
  styleUrl: './chat-session-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@20f07620df60d6cb0702ab476f86bb23b1d8a4cd: display the list of chat sessions with actions to select, create, delete, or save as note
export class ChatSessionPanelComponent {
  @Input() sessions: ChatSession[] = [];
  @Input() activeSessionId: string | null = null;
  @Input() sourceSnapshot: SourceSnapshotEntry[] = [];
  @Input() savingNote = false;

  @Output() sessionSelected = new EventEmitter<string>();
  @Output() sessionCreated = new EventEmitter<void>();
  @Output() sessionDeleted = new EventEmitter<string>();
  @Output() sessionSavedAsNote = new EventEmitter<string>();

  sourceSummaryExpanded = false;

  get sourceGroups(): SourceGroup[] {
    if (!this.sourceSnapshot.length) return [];

    const groupMap = new Map<EntityType, SourceSnapshotEntry[]>();
    for (const entry of this.sourceSnapshot) {
      const list = groupMap.get(entry.entity_type) ?? [];
      list.push(entry);
      groupMap.set(entry.entity_type, list);
    }

    const typeOrder: EntityType[] = [
      'asset',
      'threat',
      'document',
      'repository',
      'note',
      'diagram',
    ];
    const labelKeys: Record<EntityType, string> = {
      asset: 'chat.sourceSummary.assets',
      threat: 'chat.sourceSummary.threats',
      document: 'chat.sourceSummary.documents',
      repository: 'chat.sourceSummary.repositories',
      note: 'chat.sourceSummary.notes',
      diagram: 'chat.sourceSummary.diagrams',
    };

    return typeOrder
      .filter(type => groupMap.has(type))
      .map(type => ({
        type,
        labelKey: labelKeys[type],
        entries: groupMap.get(type)!,
      }));
  }

  // SEM@0d2745da4e8e3843cd65f62979270c63dc57e657: dispatch the sessionSelected event when a chat session is chosen (pure)
  onSelect(sessionId: string): void {
    this.sessionSelected.emit(sessionId);
  }

  // SEM@0d2745da4e8e3843cd65f62979270c63dc57e657: dispatch the sessionCreated event to request a new chat session (pure)
  onCreate(): void {
    this.sessionCreated.emit();
  }

  // SEM@0d2745da4e8e3843cd65f62979270c63dc57e657: dispatch the sessionDeleted event for a chat session and stop event propagation (pure)
  onDelete(event: Event, sessionId: string): void {
    event.stopPropagation();
    this.sessionDeleted.emit(sessionId);
  }

  // SEM@09c83337b4547e1c81185df472e2ae39dc03d674: dispatch the sessionSavedAsNote event for a chat session and stop event propagation (pure)
  onSaveAsNote(event: Event, sessionId: string): void {
    event.stopPropagation();
    this.sessionSavedAsNote.emit(sessionId);
  }

  // SEM@6d229fa7b7ddc40450b8cbc243557e7328c441bd: toggle the expanded state of the source summary panel (mutates shared state)
  toggleSourceSummary(): void {
    this.sourceSummaryExpanded = !this.sourceSummaryExpanded;
  }

  // SEM@20f07620df60d6cb0702ab476f86bb23b1d8a4cd: return the session title or a formatted fallback from the creation timestamp (pure)
  getSessionTitle(session: ChatSession): string {
    if (session.title) return session.title;
    const date = new Date(session.created_at);
    return `Chat \u2014 ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}, ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
  }

  // SEM@0d2745da4e8e3843cd65f62979270c63dc57e657: convert an ISO timestamp to a human-readable relative or calendar date string (pure)
  formatDate(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // SEM@961e8a66879858c86fe33ec0d572b5ed71dc8cd4: return a comma-separated list of entity names for a source snapshot group (pure)
  getGroupNames(group: SourceGroup): string {
    return group.entries.map(e => e.entity_name || e.entity_id).join(', ');
  }

  // SEM@0d2745da4e8e3843cd65f62979270c63dc57e657: return the session id for Angular ngFor tracking (pure)
  trackBySessionId(_index: number, session: ChatSession): string {
    return session.id;
  }
}
