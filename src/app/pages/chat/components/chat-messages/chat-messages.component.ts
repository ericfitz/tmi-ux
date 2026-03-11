import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { TextFieldModule } from '@angular/cdk/text-field';
import { TranslocoModule } from '@jsverse/transloco';
import { MarkdownModule } from 'ngx-markdown';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { ChatMessage } from '../../models/chat.model';

@Component({
  selector: 'app-chat-messages',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MarkdownModule,
    TextFieldModule,
    TranslocoModule,
  ],
  templateUrl: './chat-messages.component.html',
  styleUrl: './chat-messages.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessagesComponent implements AfterViewChecked {
  @Input() messages: ChatMessage[] = [];
  @Input() loading = false;

  @Output() messageSent = new EventEmitter<string>();

  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLDivElement>;

  messageText = '';
  private shouldScroll = false;

  onSend(): void {
    const text = this.messageText.trim();
    if (!text) return;

    this.messageSent.emit(text);
    this.messageText = '';
    this.shouldScroll = true;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  trackByMessageId(_index: number, message: ChatMessage): string {
    return message.id;
  }

  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
