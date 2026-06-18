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
  MessageStartEvent,
  MessageStatusEvent,
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
// SEM@80267eb3b6af8d2f1d6798d8fb1796201823108b: host the AI chat page: manage sessions, messages, and note-saving for a threat model
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

  @ViewChild(ChatMessagesComponent) chatMessages?: ChatMessagesComponent;

  // SEM@d656c0d1e7e92b92cd02daf759043a393ab4ddc9: inject dependencies for routing, chat, logging, i18n, and note creation (pure)
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

  // SEM@8341a7f78b37ef24d80f728f524b67d13874ea8b: resolve the threat model id from the route and load existing chat sessions (mutates shared state)
  ngOnInit(): void {
    this.threatModelId = this.route.snapshot.paramMap.get('id') ?? '';
    this.threatModel = (this.route.snapshot.data['threatModel'] as ThreatModel) ?? null;

    this.loadSessions();
  }

  // SEM@0d2745da4e8e3843cd65f62979270c63dc57e657: route back to the threat model edit page (mutates shared state)
  navigateBack(): void {
    void this.router.navigate(['/tm', this.threatModelId]);
  }

  // SEM@0d2745da4e8e3843cd65f62979270c63dc57e657: toggle the session list side panel open or closed (mutates shared state)
  toggleSidePanel(): void {
    this.sidePanelOpen = !this.sidePanelOpen;
  }

  // SEM@8341a7f78b37ef24d80f728f524b67d13874ea8b: dispatch a user message to an active session, or create a new session first (mutates shared state)
  onMessageSent(text: string): void {
    if (!this.threatModelId) return;

    if (!this.activeSessionId) {
      this.startNewSessionAndSend(text);
    } else {
      this.sendMessageToSession(text);
    }
  }

  // SEM@961e8a66879858c86fe33ec0d572b5ed71dc8cd4: fetch and display messages for a selected chat session (reads DB)
  onSessionSelected(sessionId: string): void {
    this.activeSessionId = sessionId;
    this.streamingMessageId = null;
    this.preparationStatus = null;

    const session = this.sessions.find(s => s.id === sessionId);
    this.activeSourceSnapshot = session?.source_snapshot ?? [];

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

  // SEM@8341a7f78b37ef24d80f728f524b67d13874ea8b: reset active session state when a new chat session is started (mutates shared state)
  onSessionCreated(): void {
    this.activeSessionId = null;
    this.activeSourceSnapshot = [];
    this.messages = [];
    this.streamingMessageId = null;
    this.preparationStatus = null;
    this.cdr.markForCheck();
  }

  // SEM@d656c0d1e7e92b92cd02daf759043a393ab4ddc9: delete a chat session and clear active state if it was selected (reads DB)
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

  // SEM@20f07620df60d6cb0702ab476f86bb23b1d8a4cd: save an entire chat session as a threat model note in markdown format (reads DB)
  onSessionSavedAsNote(sessionId: string): void {
    if (this.savingNote) return;

    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const content = this.formatSessionAsMarkdown(this.messages);
    const name = session.title || this.generateSessionTitle(session.created_at);

    this.saveAsNote(name, content);
  }

  // SEM@20f07620df60d6cb0702ab476f86bb23b1d8a4cd: save a single assistant message as a threat model note with a generated title (reads DB)
  onMessageSavedAsNote(messageId: string): void {
    if (this.savingNote) return;

    const msgIndex = this.messages.findIndex(m => m.id === messageId);
    const message = msgIndex >= 0 ? this.messages[msgIndex] : null;
    if (!message || message.role !== 'assistant') return;

    const content = this.formatMessageAsMarkdown(messageId, this.messages);

    const precedingUserMsg =
      msgIndex > 0 && this.messages[msgIndex - 1].role === 'user'
        ? this.messages[msgIndex - 1]
        : null;
    const name = precedingUserMsg
      ? this.generateNoteTitle(precedingUserMsg.content)
      : this.generateNoteTitle(message.content);

    this.saveAsNote(name, content);
  }

  // SEM@d656c0d1e7e92b92cd02daf759043a393ab4ddc9: persist chat content as a new threat model note and offer a navigation snackbar (reads DB)
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

  // SEM@4db2dd0a222a4f8a791726648870e8e04861a57b: create a new chat session via SSE then send the queued user message when ready (reads DB)
  private startNewSessionAndSend(text: string): void {
    const userMessage = this.createUserMessage(text, 'pending-session');
    this.messages = [userMessage];
    this.cdr.markForCheck();

    let sessionId = '';
    let messageSent = false;

    // SEM@4db2dd0a222a4f8a791726648870e8e04861a57b: send the pending user message once a new session id is available, guarded against double-send (mutates shared state)
    const sendQueuedMessage = (): void => {
      if (!sessionId || messageSent) return;
      messageSent = true;
      this.activeSessionId = sessionId;
      userMessage.session_id = sessionId;
      this.loadSessions();
      this.sendMessageToSession(text);
    };

    this.timmyChat
      .createSession(this.threatModelId)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: (event: SseEvent) => {
          this.handleSessionCreationEvent(event, id => {
            sessionId = id;
          });

          // Send the message as soon as the session is ready, rather than
          // waiting for the SSE stream to close.  Some servers keep the
          // connection open after the 'ready' event, which would prevent
          // the complete callback from ever firing.
          if (event.event === 'ready') {
            sendQueuedMessage();
          }

          this.cdr.markForCheck();
        },
        error: err => {
          this.logger.error('Session creation failed', err);
          this.preparationStatus = {
            phase: '',
            entityName: '',
            progress: 0,
            error: this.sessionCreationErrorMessage(err),
          };
          this.cdr.markForCheck();
        },
        complete: () => {
          // Fallback: if the stream completes without a 'ready' event
          // (e.g. server closes immediately after session_created)
          sendQueuedMessage();
        },
      });
  }

  // SEM@80267eb3b6af8d2f1d6798d8fb1796201823108b: update preparation status from session creation SSE events (session_created, progress, ready, error) (mutates shared state)
  private handleSessionCreationEvent(event: SseEvent, onSessionId: (id: string) => void): void {
    switch (event.event) {
      case 'session_created': {
        const data = JSON.parse(event.data) as SessionCreatedEvent;
        onSessionId(data.id);
        this.activeSourceSnapshot = data.source_snapshot ?? [];
        this.preparationStatus = {
          phase: 'loading',
          entityName: '',
          progress: 0,
        };
        break;
      }
      case 'progress': {
        const data = JSON.parse(event.data) as ProgressEvent;
        // The server emits `progress` as a single 0–100 percentage per
        // phase (see the Timmy backend design doc). It is not part of an
        // m/n counter — render the percentage directly.
        this.preparationStatus = {
          phase: data.phase,
          entityName: data.entity_name,
          progress: data.progress,
        };
        break;
      }
      case 'ready': {
        // The "Ready!" bubble persists across the handoff to the message
        // stream. The next preparationStatus mutation — a `status` event
        // (mode: 'message-status'), or `message_start` clearing it to null —
        // replaces it. A previous setTimeout cleared it after 2s, which
        // produced a bare loading spinner for the rest of the LLM wait when
        // status events were delayed (see issue #690).
        this.preparationStatus = {
          phase: '',
          entityName: '',
          progress: 100,
          ready: true,
        };
        break;
      }
      case 'error': {
        const data = JSON.parse(event.data) as ChatErrorEvent;
        this.preparationStatus = {
          phase: '',
          entityName: '',
          progress: 0,
          error: data.message,
        };
        break;
      }
    }
  }

  // SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: dispatch a user message to the active chat session and stream the assistant reply (mutates shared state)
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
            case 'status': {
              const data = JSON.parse(event.data) as MessageStatusEvent;
              this.preparationStatus = {
                phase: data.phase,
                entityName: data.entity_name ?? '',
                progress: 0,
                mode: 'message-status',
              };
              this.loading = false;
              break;
            }
            case 'message_start': {
              const data = JSON.parse(event.data) as MessageStartEvent;
              currentMessageId = data.message_id ?? '';
              assembledContent = '';
              const assistantMessage: ChatMessage = {
                id: currentMessageId,
                session_id: this.activeSessionId!,
                role: 'assistant',
                content: '',
                sequence: this.messages.length,
                created_at: new Date().toISOString(),
              };
              this.messages = [...this.messages, assistantMessage];
              this.streamingMessageId = currentMessageId;
              this.loading = false;
              this.preparationStatus = null;
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
              this.reconcileMessage(data, currentMessageId, assembledContent);
              this.streamingMessageId = null;
              const userTurnCount = this.messages.filter(m => m.role === 'user').length;
              this.loadSessions();
              if (userTurnCount === 1) {
                // First user turn: the server generates the session title
                // out-of-band, so reload again shortly to pick it up if it
                // wasn't persisted in time for the immediate refresh.
                setTimeout(() => this.loadSessions(), 1500);
              }
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
          this.preparationStatus = null;

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

  // SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: handle a server-sent stream error event and append an error message to the chat (mutates shared state)
  private handleStreamError(data: ChatErrorEvent, currentMessageId: string): void {
    this.streamingMessageId = null;
    this.loading = false;
    this.preparationStatus = null;

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

  /**
   * Reconcile the in-memory assistant message with the server's authoritative
   * message_end payload. Updates the message id, content, and metadata so that
   * the displayed text always matches what the server persisted.
   *
   * Logs a warning when the token-assembled content diverges from the server
   * content so that truncation issues are visible in the application log.
   */
  // SEM@7196e42d2530d6d9837ac1fc41d3f5208aa78e06: reconcile the in-memory assistant chat message with the server-authoritative message_end payload (mutates shared state)
  private reconcileMessage(
    data: MessageEndEvent,
    clientMessageId: string,
    assembledContent: string,
  ): void {
    const msg = this.findMessageForReconciliation(clientMessageId, data.id);
    if (!msg) {
      this.logger.warn('[chat] message_end received but no matching message found', {
        clientMessageId,
        serverId: data.id,
      });
      return;
    }

    // Reconcile content: server payload is authoritative
    if (data.content !== assembledContent) {
      this.logger.warn('[chat] Token-assembled content differs from server content', {
        assembledLength: assembledContent.length,
        serverLength: data.content.length,
        delta: data.content.length - assembledContent.length,
      });
      msg.content = data.content;
    }

    // Backfill fields from the server's persisted message
    msg.id = data.id;
    msg.token_count = data.token_count;
    msg.created_at = data.created_at;
    msg.sequence = data.sequence;

    // Always create a new array reference so OnPush children detect the
    // updated id, token_count, and (possibly corrected) content.
    this.messages = [...this.messages];
  }

  /**
   * Locate the assistant message to reconcile. Tries the client-assigned id
   * first, then falls back to the server-assigned id (in case message_start
   * included it), and finally falls back to the last assistant message.
   */
  // SEM@7196e42d2530d6d9837ac1fc41d3f5208aa78e06: locate the assistant chat message to reconcile using client id, server id, or last assistant fallback (pure)
  private findMessageForReconciliation(
    clientMessageId: string,
    serverId: string,
  ): ChatMessage | undefined {
    return (
      this.messages.find(m => m.id === clientMessageId) ??
      this.messages.find(m => m.id === serverId) ??
      [...this.messages].reverse().find(m => m.role === 'assistant')
    );
  }

  // SEM@961e8a66879858c86fe33ec0d572b5ed71dc8cd4: append a formatted error chat message to the current message list (mutates shared state)
  private addErrorMessage(text: string): void {
    const errorMsg: ChatMessage = {
      id: crypto.randomUUID(),
      session_id: this.activeSessionId ?? '',
      role: 'assistant',
      content: `*${text}*`,
      sequence: this.messages.length,
      created_at: new Date().toISOString(),
    };
    this.messages = [...this.messages, errorMsg];
  }

  // SEM@961e8a66879858c86fe33ec0d572b5ed71dc8cd4: build a new user chat message object for the given session (pure)
  private createUserMessage(text: string, sessionId: string): ChatMessage {
    return {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role: 'user',
      content: text,
      sequence: this.messages.length,
      created_at: new Date().toISOString(),
    };
  }

  // SEM@e4560728b1da3f75b025ebd023e9c2d5fd097b11: convert all chat session messages to a combined markdown string (pure)
  private formatSessionAsMarkdown(messages: ChatMessage[]): string {
    return messages.map(m => this.formatSingleMessage(m)).join('\n\n');
  }

  // SEM@e4560728b1da3f75b025ebd023e9c2d5fd097b11: format a single assistant message and its preceding user prompt as markdown (pure)
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

  // SEM@961e8a66879858c86fe33ec0d572b5ed71dc8cd4: format a single chat message as a labeled markdown line with timestamp (pure)
  private formatSingleMessage(message: ChatMessage): string {
    const role = message.role === 'user' ? 'You' : 'Timmy';
    const timestamp = this.datePipe.transform(message.created_at, 'long') ?? message.created_at;
    return `**${role}** (${timestamp}): ${message.content}`;
  }

  // SEM@20f07620df60d6cb0702ab476f86bb23b1d8a4cd: build a default chat session title from the session creation timestamp (pure)
  private generateSessionTitle(createdAt: string): string {
    const date = new Date(createdAt);
    const dateStr = this.datePipe.transform(date, 'mediumDate') ?? date.toLocaleDateString();
    const timeStr = this.datePipe.transform(date, 'shortTime') ?? date.toLocaleTimeString();
    return `Chat \u2014 ${dateStr}, ${timeStr}`;
  }

  // SEM@e4560728b1da3f75b025ebd023e9c2d5fd097b11: build a note title from assistant message content, truncating to 50 chars (pure)
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

  // SEM@961e8a66879858c86fe33ec0d572b5ed71dc8cd4: fetch chat sessions for the current threat model and refresh the session list (mutates shared state)
  private loadSessions(): void {
    this.timmyChat
      .listSessions(this.threatModelId)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: sessions => {
          this.sessions = sessions;
          if (this.activeSessionId) {
            const active = sessions.find(s => s.id === this.activeSessionId);
            this.activeSourceSnapshot = active?.source_snapshot ?? [];
          }
          this.cdr.markForCheck();
        },
        error: err => {
          this.logger.error('Failed to load sessions', err);
        },
      });
  }

  // SEM@61f7c7b8452d540fd09fdab08c148b61ba2e2a69: map a session-creation HTTP error to a localized user-facing error message (pure)
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

  // SEM@0d2745da4e8e3843cd65f62979270c63dc57e657: return an RxJS operator that completes the stream when the component is destroyed (pure)
  private untilDestroyed<T>(): MonoTypeOperatorFunction<T> {
    return this.destroyRef ? takeUntilDestroyed<T>(this.destroyRef) : identity;
  }
}
