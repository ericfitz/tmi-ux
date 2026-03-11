import { Observable } from 'rxjs';

import { ChatContextPayload, ChatMessage } from '../models/chat.model';

/**
 * Abstract chat service that defines the contract for sending messages
 * to an AI backend. Implementations may be a mock, a server proxy,
 * or a direct API client.
 */
export abstract class ChatService {
  abstract sendMessage(
    message: string,
    context: ChatContextPayload,
    history: ChatMessage[],
  ): Observable<ChatMessage>;
}
