import { Injectable } from '@angular/core';

import { LoggerService } from '../../../core/services/logger.service';
import { ChatMessage, ChatSession } from '../models/chat.model';

const DB_NAME = 'tmi-chat';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

/**
 * Persists chat sessions in IndexedDB with an in-memory fallback
 * for environments where IndexedDB is unavailable (e.g., private browsing).
 */
@Injectable({ providedIn: 'root' })
export class ChatSessionStorageService {
  private db: IDBDatabase | null = null;
  private fallbackStore = new Map<string, ChatSession>();
  private usingFallback = false;
  private initPromise: Promise<void> | null = null;

  constructor(private logger: LoggerService) {}

  private init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>(resolve => {
      if (typeof indexedDB === 'undefined') {
        this.logger.warn('IndexedDB not available, using in-memory fallback');
        this.usingFallback = true;
        resolve();
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('threatModelId', 'threatModelId', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        this.logger.warn('Failed to open IndexedDB, using in-memory fallback', request.error);
        this.usingFallback = true;
        resolve();
      };
    });

    return this.initPromise;
  }

  async createSession(threatModelId: string, title: string): Promise<ChatSession> {
    await this.init();
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: crypto.randomUUID(),
      threatModelId,
      title,
      createdAt: now,
      lastMessageAt: now,
      messages: [],
    };
    await this.putSession(session);
    return session;
  }

  async listSessions(threatModelId: string): Promise<ChatSession[]> {
    await this.init();

    if (this.usingFallback) {
      return Array.from(this.fallbackStore.values())
        .filter(s => s.threatModelId === threatModelId)
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    }

    return new Promise<ChatSession[]>((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('threatModelId');
      const request = index.getAll(threatModelId);

      request.onsuccess = () => {
        const sessions = (request.result as ChatSession[]).sort((a, b) =>
          b.lastMessageAt.localeCompare(a.lastMessageAt),
        );
        resolve(sessions);
      };
      request.onerror = () =>
        reject(new Error(request.error?.message ?? 'IndexedDB operation failed'));
    });
  }

  async getSession(id: string): Promise<ChatSession | undefined> {
    await this.init();

    if (this.usingFallback) {
      return this.fallbackStore.get(id);
    }

    return new Promise<ChatSession | undefined>((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result as ChatSession | undefined);
      request.onerror = () =>
        reject(new Error(request.error?.message ?? 'IndexedDB operation failed'));
    });
  }

  async appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
    await this.init();
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.messages.push(message);
    session.lastMessageAt = message.timestamp;
    await this.putSession(session);
  }

  async deleteSession(id: string): Promise<void> {
    await this.init();

    if (this.usingFallback) {
      this.fallbackStore.delete(id);
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const request = tx.objectStore(STORE_NAME).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(request.error?.message ?? 'IndexedDB operation failed'));
    });
  }

  async updateSessionTitle(id: string, title: string): Promise<void> {
    await this.init();
    const session = await this.getSession(id);
    if (!session) return;

    session.title = title;
    await this.putSession(session);
  }

  private async putSession(session: ChatSession): Promise<void> {
    if (this.usingFallback) {
      this.fallbackStore.set(session.id, session);
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const request = tx.objectStore(STORE_NAME).put(session);
      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(request.error?.message ?? 'IndexedDB operation failed'));
    });
  }
}
