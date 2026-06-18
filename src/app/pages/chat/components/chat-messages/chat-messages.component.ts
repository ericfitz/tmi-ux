import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatChipsModule } from '@angular/material/chips';
import { TranslocoModule } from '@jsverse/transloco';
import { MarkdownModule } from 'ngx-markdown';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { ChatMessage, PreparationStatus } from '../../models/chat.model';

@Component({
  selector: 'app-chat-messages',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatChipsModule,
    MarkdownModule,
    TextFieldModule,
    TranslocoModule,
  ],
  templateUrl: './chat-messages.component.html',
  styleUrl: './chat-messages.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@0a1d2a7278c33259db2e092e3c9acd5863bfbb9b: render a scrollable chat message list with streaming support and save-as-note actions
export class ChatMessagesComponent implements AfterViewChecked, OnChanges {
  @Input() messages: ChatMessage[] = [];
  @Input() loading = false;
  @Input() streamingMessageId: string | null = null;
  @Input() preparationStatus: PreparationStatus | null = null;
  @Input() inputDisabled = false;
  @Input() savingNote = false;

  @Output() messageSent = new EventEmitter<string>();
  @Output() messageSavedAsNote = new EventEmitter<string>();

  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLDivElement>;

  messageText = '';
  private shouldScroll = false;

  get isInputDisabled(): boolean {
    return this.inputDisabled || this.loading || this.preparationStatus !== null;
  }

  get isSendDisabled(): boolean {
    return !this.messageText.trim() || this.isInputDisabled;
  }

  // SEM@ca308fb03ad87332d0865bc40ee7c392e48f78a1: flag a scroll-to-bottom when messages or streaming message id changes (mutates shared state)
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages'] || changes['streamingMessageId']) {
      this.shouldScroll = true;
    }
  }

  // SEM@0c0cfc02c69ad6635cb9aa494c949c7595861481: check whether a chat message is the currently streaming message (pure)
  isStreaming(message: ChatMessage): boolean {
    return message.id === this.streamingMessageId;
  }

  // SEM@f5d77aa13c635037c5d38d3df500b2617385c355: emit a save-as-note event for the given message ID
  onSaveAsNote(messageId: string): void {
    this.messageSavedAsNote.emit(messageId);
  }

  /**
   * Handle a suggested-prompt chip activation (click or keyboard).
   * Sets the message text and immediately sends it, unless the input is disabled.
   */
  // SEM@0a1d2a7278c33259db2e092e3c9acd5863bfbb9b: dispatch a suggested prompt chip selection as a sent message (mutates shared state)
  onSuggestedPrompt(prompt: string): void {
    if (this.isInputDisabled) return;
    this.messageText = prompt;
    this.onSend();
  }

  // SEM@0c0cfc02c69ad6635cb9aa494c949c7595861481: emit the composed chat message text and reset the input field (mutates shared state)
  onSend(): void {
    const text = this.messageText.trim();
    if (!text || this.isInputDisabled) return;

    this.messageSent.emit(text);
    this.messageText = '';
    this.shouldScroll = true;
  }

  // SEM@0d2745da4e8e3843cd65f62979270c63dc57e657: send the chat message on Enter keypress, ignoring Shift+Enter (pure)
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  // SEM@0d2745da4e8e3843cd65f62979270c63dc57e657: scroll the message list to the bottom after new messages render (mutates shared state)
  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  // SEM@0d2745da4e8e3843cd65f62979270c63dc57e657: return the unique message id for ngFor change tracking (pure)
  trackByMessageId(_index: number, message: ChatMessage): string {
    return message.id;
  }

  /**
   * Resolve a phase-specific localized label for the message-status bubble.
   * Falls back to the snake_case phase identifier verbatim when no key is
   * defined — the server is free to add or rename phases at any time.
   */
  // SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: resolve a localized label for a message status phase, falling back to the raw phase key (pure)
  messageStatusLabel(
    t: (key: string, params?: Record<string, unknown>) => string,
    phase: string,
    entityName: string,
  ): string {
    const key = `chat.messageStatus.${phase}`;
    const translated = t(key, { entityName });
    return translated === key ? phase : translated;
  }

  // SEM@0c0cfc02c69ad6635cb9aa494c949c7595861481: scroll the message container element to its bottom (mutates shared state)
  scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
