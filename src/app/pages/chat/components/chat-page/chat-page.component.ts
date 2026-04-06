import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  OnInit,
  Optional,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { identity, MonoTypeOperatorFunction } from 'rxjs';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '../../../../core/services/logger.service';
import { ThreatModel, Note } from '../../../tm/models/threat-model.model';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { SseEvent } from '../../../../core/interfaces/sse.interface';
import { SseHttpError } from '../../../../core/services/sse-client.service';
import {
  ChatMessage,
  ChatSession,
  PreparationStatus,
  SourceSnapshotEntry,
  SessionCreatedEvent,
  ProgressEvent,
  ReadyEvent,
  MessageStartEvent,
  TokenEvent,
  MessageEndEvent,
  ChatErrorEvent,
} from '../../models/chat.model';
import { TimmyChatService } from '../../services/timmy-chat.service';
import { ChatMessagesComponent } from '../chat-messages/chat-messages.component';
import { ChatSessionPanelComponent } from '../chat-session-panel/chat-session-panel.component';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
    ChatMessagesComponent,
    ChatSessionPanelComponent,
  ],
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe],
})
export class ChatPageComponent implements OnInit {
  threatModel: ThreatModel | null = null;
  threatModelId = '';
  messages: ChatMessage[] = [];
  sessions: ChatSession[] = [];
  activeSessionId: string | null = null;
  activeSourceSnapshot: SourceSnapshotEntry[] = [];
  loading = false;
  sidePanelOpen = true;
  streamingMessageId: string | null = null;
  preparationStatus: PreparationStatus | null = null;
  savingNote = false;

  private sessionSourceCount = 0;
  private progressCounter = 0;

  @ViewChild(ChatMessagesComponent) chatMessages?: ChatMessagesComponent;

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

  ngOnInit(): void {
    this.threatModelId = this.route.snapshot.paramMap.get('id') ?? '';
    this.threatModel = (this.route.snapshot.data['threatModel'] as ThreatModel) ?? null;

    this.loadSessions();
  }

  navigateBack(): void {
    void this.router.navigate(['/tm', this.threatModelId]);
  }

  toggleSidePanel(): void {
    this.sidePanelOpen = !this.sidePanelOpen;
  }

  onMessageSent(text: string): void {
    if (!this.threatModelId) return;

    if (!this.activeSessionId) {
      this.startNewSessionAndSend(text);
    } else {
      this.sendMessageToSession(text);
    }
  }

  onSessionSelected(sessionId: string): void {
    this.activeSessionId = sessionId;
    this.streamingMessageId = null;
    this.preparationStatus = null;

    const session = this.sessions.find(s => s.id === sessionId);
    this.activeSourceSnapshot = session?.sourceSnapshot ?? [];

    this.timmyChat
      .getMessages(this.threatModelId, sessionId)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: messages => {
          this.messages = messages;
          this.cdr.markForCheck();
          setTimeout(() => this.chatMessages?.scrollToBottom(), 0);
        },
        error: err => {
          this.logger.error('Failed to load messages', err);
        },
      });
  }

  onSessionCreated(): void {
    this.activeSessionId = null;
    this.activeSourceSnapshot = [];
    this.messages = [];
    this.streamingMessageId = null;
    this.preparationStatus = null;
    this.cdr.markForCheck();
  }

  onSessionDeleted(sessionId: string): void {
    this.timmyChat
      .deleteSession(this.threatModelId, sessionId)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: () => {
          if (this.activeSessionId === sessionId) {
            this.activeSessionId = null;
            this.activeSourceSnapshot = [];
            this.messages = [];
          }
          this.loadSessions();
        },
        error: err => {
          this.logger.error('Failed to delete session', err);
        },
      });
  }

  onSessionSavedAsNote(sessionId: string): void {
    if (this.savingNote) return;

    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const content = this.formatSessionAsMarkdown(this.messages);
    const name = session.title;

    this.saveAsNote(name, content);
  }

  onMessageSavedAsNote(messageId: string): void {
    if (this.savingNote) return;

    const message = this.messages.find(m => m.id === messageId);
    if (!message || message.role !== 'assistant') return;

    const content = this.formatMessageAsMarkdown(messageId, this.messages);
    const name = this.generateNoteTitle(message.content);

    this.saveAsNote(name, content);
  }

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

  private startNewSessionAndSend(text: string): void {
    const userMessage = this.createUserMessage(text, 'pending-session');
    this.messages = [userMessage];
    this.cdr.markForCheck();

    let sessionId = '';
    this.sessionSourceCount = 0;
    this.progressCounter = 0;

    this.timmyChat
      .createSession(this.threatModelId)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: (event: SseEvent) => {
          this.handleSessionCreationEvent(event, id => {
            sessionId = id;
          });
          this.cdr.markForCheck();
        },
        error: err => {
          this.logger.error('Session creation failed', err);
          this.preparationStatus = {
            phase: '',
            entityName: '',
            progress: 0,
            current: 0,
            total: 0,
            error: this.sessionCreationErrorMessage(err),
          };
          this.cdr.markForCheck();
        },
        complete: () => {
          if (sessionId) {
            this.activeSessionId = sessionId;
            userMessage.sessionId = sessionId;
            this.loadSessions();
            this.sendMessageToSession(text);
          }
        },
      });
  }

  private handleSessionCreationEvent(event: SseEvent, onSessionId: (id: string) => void): void {
    switch (event.event) {
      case 'session_created': {
        const data = JSON.parse(event.data) as SessionCreatedEvent;
        onSessionId(data.sessionId);
        this.sessionSourceCount = data.sourceCount;
        this.preparationStatus = {
          phase: 'loading',
          entityName: '',
          progress: 0,
          current: 0,
          total: data.sourceCount,
        };
        break;
      }
      case 'progress': {
        const data = JSON.parse(event.data) as ProgressEvent;
        if (data.progress === 100) {
          this.progressCounter++;
        }
        this.preparationStatus = {
          phase: data.phase,
          entityName: data.entityName,
          progress: data.progress,
          current: this.progressCounter,
          total: this.sessionSourceCount,
        };
        break;
      }
      case 'ready': {
        const data = JSON.parse(event.data) as ReadyEvent;
        this.preparationStatus = {
          phase: '',
          entityName: '',
          progress: 100,
          current: this.sessionSourceCount,
          total: this.sessionSourceCount,
          ready: true,
          readyStats: data,
        };
        setTimeout(() => {
          this.preparationStatus = null;
          this.cdr.markForCheck();
        }, 2000);
        break;
      }
      case 'error': {
        const data = JSON.parse(event.data) as ChatErrorEvent;
        this.preparationStatus = {
          phase: '',
          entityName: '',
          progress: 0,
          current: 0,
          total: 0,
          error: data.message,
        };
        break;
      }
    }
  }

  private sendMessageToSession(text: string): void {
    if (!this.messages.some(m => m.role === 'user' && m.content === text)) {
      const userMessage = this.createUserMessage(text, this.activeSessionId!);
      this.messages = [...this.messages, userMessage];
    }
    this.loading = true;
    this.cdr.markForCheck();

    let currentMessageId = '';
    let assembledContent = '';

    this.timmyChat
      .sendMessage(this.threatModelId, this.activeSessionId!, text)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: (event: SseEvent) => {
          switch (event.event) {
            case 'message_start': {
              const data = JSON.parse(event.data) as MessageStartEvent;
              currentMessageId = data.messageId;
              assembledContent = '';
              const assistantMessage: ChatMessage = {
                id: currentMessageId,
                sessionId: this.activeSessionId!,
                role: 'assistant',
                content: '',
                sequence: this.messages.length,
                createdAt: new Date().toISOString(),
              };
              this.messages = [...this.messages, assistantMessage];
              this.streamingMessageId = currentMessageId;
              this.loading = false;
              break;
            }
            case 'token': {
              const data = JSON.parse(event.data) as TokenEvent;
              assembledContent += data.content;
              const lastMsg = this.messages[this.messages.length - 1];
              if (lastMsg && lastMsg.id === currentMessageId) {
                lastMsg.content = assembledContent;
                this.messages = [...this.messages];
              }
              break;
            }
            case 'message_end': {
              const data = JSON.parse(event.data) as MessageEndEvent;
              const msg = this.messages.find(m => m.id === currentMessageId);
              if (msg) {
                msg.tokenCount = data.tokenCount;
              }
              this.streamingMessageId = null;
              this.loadSessions();
              break;
            }
            case 'error': {
              const data = JSON.parse(event.data) as ChatErrorEvent;
              this.handleStreamError(data, currentMessageId);
              break;
            }
          }
          this.cdr.markForCheck();
          setTimeout(() => this.chatMessages?.scrollToBottom(), 0);
        },
        error: err => {
          this.logger.error('Message send failed', err);
          this.streamingMessageId = null;
          this.loading = false;

          const sseErr = err as SseHttpError;
          if (sseErr.status === 429) {
            const minutes = sseErr.retryAfter ? Math.ceil(sseErr.retryAfter / 60) : 1;
            this.addErrorMessage(this.transloco.translate('chat.errors.rateLimited', { minutes }));
          } else if (sseErr.status === 503) {
            this.addErrorMessage(this.transloco.translate('chat.errors.serverBusy'));
          } else {
            this.addErrorMessage(this.transloco.translate('chat.errors.interrupted'));
          }
          this.cdr.markForCheck();
        },
      });
  }

  private handleStreamError(data: ChatErrorEvent, currentMessageId: string): void {
    this.streamingMessageId = null;
    this.loading = false;

    if (currentMessageId) {
      const msg = this.messages.find(m => m.id === currentMessageId);
      if (msg && msg.content) {
        msg.content += `\n\n*Error: ${data.message}*`;
      } else {
        this.addErrorMessage(data.message);
      }
    } else {
      this.addErrorMessage(data.message);
    }
  }

  private addErrorMessage(text: string): void {
    const errorMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: this.activeSessionId ?? '',
      role: 'assistant',
      content: `*${text}*`,
      sequence: this.messages.length,
      createdAt: new Date().toISOString(),
    };
    this.messages = [...this.messages, errorMsg];
  }

  private createUserMessage(text: string, sessionId: string): ChatMessage {
    return {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content: text,
      sequence: this.messages.length,
      createdAt: new Date().toISOString(),
    };
  }

  private formatSessionAsMarkdown(messages: ChatMessage[]): string {
    return messages.map(m => this.formatSingleMessage(m)).join('\n\n');
  }

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

  private formatSingleMessage(message: ChatMessage): string {
    const role = message.role === 'user' ? 'You' : 'Timmy';
    const timestamp = this.datePipe.transform(message.createdAt, 'long') ?? message.createdAt;
    return `**${role}** (${timestamp}): ${message.content}`;
  }

  private generateNoteTitle(assistantContent: string): string {
    const stripped = assistantContent.replace(/```[\s\S]*?```/g, '').trim();
    if (!stripped || stripped.length < 5) {
      const date =
        this.datePipe.transform(new Date(), 'mediumDate') ?? new Date().toLocaleDateString();
      return `Timmy response \u2014 ${date}`;
    }
    if (stripped.length <= 50) return stripped;

    const truncated = stripped.substring(0, 50);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + '\u2026';
  }

  private loadSessions(): void {
    this.timmyChat
      .listSessions(this.threatModelId)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: sessions => {
          this.sessions = sessions;
          if (this.activeSessionId) {
            const active = sessions.find(s => s.id === this.activeSessionId);
            this.activeSourceSnapshot = active?.sourceSnapshot ?? [];
          }
          this.cdr.markForCheck();
        },
        error: err => {
          this.logger.error('Failed to load sessions', err);
        },
      });
  }

  private sessionCreationErrorMessage(err: unknown): string {
    const sseErr = err as SseHttpError;
    switch (sseErr.status) {
      case 404:
        return this.transloco.translate('chat.errors.notEnabled');
      case 406:
        return this.transloco.translate('chat.errors.notAcceptable');
      case 429: {
        const minutes = sseErr.retryAfter ? Math.ceil(sseErr.retryAfter / 60) : 1;
        return this.transloco.translate('chat.errors.rateLimited', { minutes });
      }
      case 503:
        return this.transloco.translate('chat.errors.serverBusy');
      default:
        return this.transloco.translate('chat.errors.connectionFailed');
    }
  }

  private untilDestroyed<T>(): MonoTypeOperatorFunction<T> {
    return this.destroyRef ? takeUntilDestroyed<T>(this.destroyRef) : identity;
  }
}
