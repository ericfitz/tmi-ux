import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS, DATA_MATERIAL_IMPORTS } from '@app/shared/imports';
import { ChatSession } from '../../models/chat.model';

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

  @Output() sessionSelected = new EventEmitter<string>();
  @Output() sessionCreated = new EventEmitter<void>();
  @Output() sessionDeleted = new EventEmitter<string>();

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

  trackBySessionId(_index: number, session: ChatSession): string {
    return session.id;
  }
}
