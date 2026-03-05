/**
 * CryptoKeyStorageService
 *
 * Manages a non-extractable AES-256-GCM CryptoKey in IndexedDB for token encryption.
 * This replaces the browser-fingerprint-based key derivation approach, providing:
 * - Full cryptographic entropy (not guessable/enumerable by XSS attacker)
 * - Persistence across tab/browser close (unlike sessionStorage)
 * - Non-extractable key (attacker cannot export raw key bytes)
 */

import { Injectable } from '@angular/core';

import { LoggerService } from '../../core/services/logger.service';

const DB_NAME = 'tmi_auth';
const STORE_NAME = 'keys';
const KEY_ID = 'token_encryption_key';
const DB_VERSION = 1;

@Injectable({ providedIn: 'root' })
export class CryptoKeyStorageService {
  private cachedKey: CryptoKey | null = null;

  constructor(private logger: LoggerService) {}

  /**
   * Get or create a non-extractable AES-256-GCM CryptoKey.
   * On first call, generates a new key and persists it to IndexedDB.
   * On subsequent calls, returns the cached/persisted key.
   * @returns CryptoKey or null if IndexedDB is unavailable
   */
  async getOrCreateTokenKey(): Promise<CryptoKey | null> {
    if (this.cachedKey) {
      return this.cachedKey;
    }

    if (typeof indexedDB === 'undefined') {
      this.logger.warn('IndexedDB unavailable - token encryption key cannot be persisted');
      return null;
    }

    try {
      const db = await this.openDatabase();
      try {
        const existingKey = await this.getKey(db);
        if (existingKey) {
          this.cachedKey = existingKey;
          return existingKey;
        }

        const newKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false, // non-extractable
          ['encrypt', 'decrypt'],
        );

        await this.putKey(db, newKey);
        this.cachedKey = newKey;
        return newKey;
      } finally {
        db.close();
      }
    } catch (error) {
      this.logger.error('Failed to access IndexedDB for token encryption key', error);
      return null;
    }
  }

  /**
   * Delete the stored key from IndexedDB and clear cache.
   * Use for explicit key destruction if needed.
   */
  async deleteTokenKey(): Promise<void> {
    this.cachedKey = null;

    if (typeof indexedDB === 'undefined') {
      return;
    }

    try {
      const db = await this.openDatabase();
      try {
        await this.removeKey(db);
      } finally {
        db.close();
      }
    } catch (error) {
      this.logger.error('Failed to delete token encryption key from IndexedDB', error);
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB open failed'));
    });
  }

  private getKey(db: IDBDatabase): Promise<CryptoKey | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(KEY_ID);

      request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
      request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB get failed'));
    });
  }

  private putKey(db: IDBDatabase, key: CryptoKey): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(key, KEY_ID);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(request.error?.message ?? 'IndexedDB put failed'));
    });
  }

  private removeKey(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(KEY_ID);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(request.error?.message ?? 'IndexedDB delete failed'));
    });
  }
}
