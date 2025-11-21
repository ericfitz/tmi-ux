/**
 * Message Chunking Service
 *
 * Handles chunking and reassembly of WebSocket messages that exceed the 64KB size limit.
 * This service ensures that large collaborative messages (like diagram operations with many cells)
 * can be transmitted reliably over WebSocket connections.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, of, throwError } from 'rxjs';

import { LoggerService } from './logger.service';
import {
  TMIWebSocketMessage,
  TMIMessageType,
  ChunkedMessage,
  ChunkReassemblyInfo,
  MESSAGE_CHUNK_CONSTANTS,
} from '../types/websocket-message.types';

/**
 * Service for chunking and reassembling WebSocket messages
 */
@Injectable({
  providedIn: 'root',
})
export class MessageChunkingService implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _reassemblyMap = new Map<string, ChunkReassemblyInfo>();
  private readonly _cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private _logger: LoggerService) {
    // Clean up stale chunk reassembly data every 30 seconds
    this._cleanupInterval = setInterval(() => {
      this._cleanupStaleChunks();
    }, 30000);
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    clearInterval(this._cleanupInterval);
  }

  /**
   * Check if a message needs to be chunked based on its serialized size
   */
  needsChunking(message: TMIWebSocketMessage): boolean {
    try {
      const serialized = JSON.stringify(message);
      const sizeBytes = new TextEncoder().encode(serialized).length;
      return sizeBytes > MESSAGE_CHUNK_CONSTANTS.MAX_MESSAGE_SIZE;
    } catch (error) {
      this._logger.error('Failed to serialize message for size check', { error, message });
      return false;
    }
  }

  /**
   * Get the size of a serialized message in bytes
   */
  getMessageSize(message: TMIWebSocketMessage): number {
    try {
      const serialized = JSON.stringify(message);
      return new TextEncoder().encode(serialized).length;
    } catch (error) {
      this._logger.error('Failed to calculate message size', { error, message });
      return 0;
    }
  }

  /**
   * Chunk a large message into smaller pieces
   */
  chunkMessage(message: TMIWebSocketMessage): Observable<ChunkedMessage[]> {
    try {
      // Extract the message type from the message
      const messageData = message as { message_type?: string };
      const messageType = messageData.message_type as TMIMessageType;

      if (!messageType) {
        return throwError(() => new Error('Message must have a message_type field'));
      }

      const serialized = JSON.stringify(message);
      const messageBytes = new TextEncoder().encode(serialized);
      const totalSize = messageBytes.length;

      if (totalSize <= MESSAGE_CHUNK_CONSTANTS.MAX_MESSAGE_SIZE) {
        return throwError(() => new Error('Message does not need chunking'));
      }

      const chunkSize = MESSAGE_CHUNK_CONSTANTS.CHUNK_SIZE;
      const totalChunks = Math.ceil(totalSize / chunkSize);
      const chunkId = this._generateChunkId();

      this._logger.info('Chunking large message', {
        messageType,
        totalSize,
        totalChunks,
        chunkId,
        chunkSizeBytes: chunkSize,
      });

      const chunks: ChunkedMessage[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, totalSize);
        const chunkBytes = messageBytes.slice(start, end);
        const chunkData = this._bytesToBase64(chunkBytes);

        const chunk: ChunkedMessage = {
          message_type: 'chunked_message',
          chunk_info: {
            chunk_id: chunkId,
            total_chunks: totalChunks,
            chunk_index: i,
            original_message_type: messageType,
            total_size: totalSize,
          },
          chunk_data: chunkData,
        };

        chunks.push(chunk);
      }

      this._logger.debugComponent('MessageChunkingService', 'Message chunked successfully', {
        chunkId,
        chunksCreated: chunks.length,
        totalSize,
      });

      return of(chunks);
    } catch (error) {
      this._logger.error('Failed to chunk message', { error, message });
      return throwError(() => error);
    }
  }

  /**
   * Process a received chunk and reassemble if complete
   */
  processChunk(chunk: ChunkedMessage): Observable<TMIWebSocketMessage | null> {
    try {
      const { chunk_info, chunk_data } = chunk;
      const { chunk_id, total_chunks, chunk_index, original_message_type, total_size } = chunk_info;

      this._logger.debugComponent('MessageChunkingService', 'Processing message chunk', {
        chunkId: chunk_id,
        chunkIndex: chunk_index,
        totalChunks: total_chunks,
        originalMessageType: original_message_type,
      });

      // Get or create reassembly info
      let reassemblyInfo = this._reassemblyMap.get(chunk_id);
      if (!reassemblyInfo) {
        reassemblyInfo = {
          chunks: new Map(),
          totalChunks: total_chunks,
          originalMessageType: original_message_type,
          totalSize: total_size,
          receivedAt: Date.now(),
        };
        this._reassemblyMap.set(chunk_id, reassemblyInfo);
      }

      // Validate chunk info consistency
      if (
        reassemblyInfo.totalChunks !== total_chunks ||
        reassemblyInfo.originalMessageType !== original_message_type ||
        reassemblyInfo.totalSize !== total_size
      ) {
        this._logger.error('Chunk info mismatch', {
          chunkId: chunk_id,
          expected: {
            totalChunks: reassemblyInfo.totalChunks,
            messageType: reassemblyInfo.originalMessageType,
            totalSize: reassemblyInfo.totalSize,
          },
          received: { total_chunks, original_message_type, total_size },
        });
        this._reassemblyMap.delete(chunk_id);
        return throwError(() => new Error('Chunk info mismatch'));
      }

      // Check for duplicate chunk
      if (reassemblyInfo.chunks.has(chunk_index)) {
        this._logger.warn('Received duplicate chunk', {
          chunkId: chunk_id,
          chunkIndex: chunk_index,
        });
        return of(null); // Ignore duplicate
      }

      // Store the chunk
      reassemblyInfo.chunks.set(chunk_index, chunk_data);

      this._logger.debugComponent('MessageChunkingService', 'Chunk stored', {
        chunkId: chunk_id,
        chunkIndex: chunk_index,
        receivedChunks: reassemblyInfo.chunks.size,
        totalChunks: total_chunks,
      });

      // Check if we have all chunks
      if (reassemblyInfo.chunks.size === total_chunks) {
        return this._reassembleMessage(chunk_id, reassemblyInfo);
      }

      // Not complete yet
      return of(null);
    } catch (error) {
      this._logger.error('Failed to process chunk', { error, chunk });
      return throwError(() => error);
    }
  }

  /**
   * Reassemble a complete message from chunks
   */
  private _reassembleMessage(
    chunkId: string,
    reassemblyInfo: ChunkReassemblyInfo,
  ): Observable<TMIWebSocketMessage> {
    try {
      this._logger.info('Reassembling message from chunks', {
        chunkId,
        totalChunks: reassemblyInfo.totalChunks,
        originalMessageType: reassemblyInfo.originalMessageType,
        totalSize: reassemblyInfo.totalSize,
      });

      // Sort chunks by index and concatenate
      const sortedChunks = Array.from(reassemblyInfo.chunks.entries())
        .sort(([a], [b]) => a - b)
        .map(([, data]) => data);

      // Convert base64 chunks back to bytes
      const allBytes = new Uint8Array(reassemblyInfo.totalSize);
      let offset = 0;

      for (const chunkData of sortedChunks) {
        const chunkBytes = this._base64ToBytes(chunkData);
        allBytes.set(chunkBytes, offset);
        offset += chunkBytes.length;
      }

      // Convert bytes back to string and parse JSON
      const reassembledString = new TextDecoder().decode(allBytes);
      const reassembledMessage = JSON.parse(reassembledString) as TMIWebSocketMessage;

      // Clean up reassembly data
      this._reassemblyMap.delete(chunkId);

      this._logger.info('Message reassembled successfully', {
        chunkId,
        originalMessageType: reassemblyInfo.originalMessageType,
        reassembledSize: reassembledString.length,
      });

      return of(reassembledMessage);
    } catch (error) {
      this._logger.error('Failed to reassemble message', { error, chunkId, reassemblyInfo });
      this._reassemblyMap.delete(chunkId);
      return throwError(() => error);
    }
  }

  /**
   * Clean up stale chunk reassembly data
   */
  private _cleanupStaleChunks(): void {
    const now = Date.now();
    const staleThreshold = MESSAGE_CHUNK_CONSTANTS.CHUNK_TIMEOUT_MS;
    const staleChunks: string[] = [];

    for (const [chunkId, info] of this._reassemblyMap.entries()) {
      if (now - info.receivedAt > staleThreshold) {
        staleChunks.push(chunkId);
      }
    }

    if (staleChunks.length > 0) {
      this._logger.info('Cleaning up stale chunks', {
        staleChunkCount: staleChunks.length,
        staleChunks,
      });

      for (const chunkId of staleChunks) {
        this._reassemblyMap.delete(chunkId);
      }
    }
  }

  /**
   * Generate a unique chunk ID
   */
  private _generateChunkId(): string {
    return `chunk_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Convert bytes to base64 string
   */
  private _bytesToBase64(bytes: Uint8Array): string {
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    return btoa(binary);
  }

  /**
   * Convert base64 string to bytes
   */
  private _base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    return new Uint8Array(Array.from(binary, char => char.charCodeAt(0)));
  }

  /**
   * Get current reassembly statistics (for debugging)
   */
  getReassemblyStats(): {
    activeChunks: number;
    oldestChunkAge: number | null;
    totalChunksReceived: number;
  } {
    const now = Date.now();
    let oldestAge: number | null = null;
    let totalChunks = 0;

    for (const info of this._reassemblyMap.values()) {
      const age = now - info.receivedAt;
      if (oldestAge === null || age > oldestAge) {
        oldestAge = age;
      }
      totalChunks += info.chunks.size;
    }

    return {
      activeChunks: this._reassemblyMap.size,
      oldestChunkAge: oldestAge,
      totalChunksReceived: totalChunks,
    };
  }
}
