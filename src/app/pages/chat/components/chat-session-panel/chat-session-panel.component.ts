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

  onSelect(sessionId: string): void {
    this.sessionSelected.emit(sessionId);
  }

  onCreate(): void {
    this.sessionCreated.emit();
  }

  onDelete(event: Event, sessionId: string): void {
    event.stopPropagation();
    this.sessionDeleted.emit(sessionId);
  }

  onSaveAsNote(event: Event, sessionId: string): void {
    event.stopPropagation();
    this.sessionSavedAsNote.emit(sessionId);
  }

  toggleSourceSummary(): void {
    this.sourceSummaryExpanded = !this.sourceSummaryExpanded;
  }

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

  getGroupNames(group: SourceGroup): string {
    return group.entries.map(e => e.entity_name || e.entity_id).join(', ');
  }

  trackBySessionId(_index: number, session: ChatSession): string {
    return session.id;
  }
}
