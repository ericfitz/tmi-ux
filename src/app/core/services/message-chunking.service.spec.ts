/**
 * Test suite for MessageChunkingService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MessageChunkingService } from './message-chunking.service';
import {
  DiagramOperationMessage,
  ChunkedMessage,
} from '../types/websocket-message.types';

describe('MessageChunkingService', () => {
  let service: MessageChunkingService;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    service = new MessageChunkingService(mockLogger);
  });

  afterEach(() => {
    if (service) {
      service.ngOnDestroy();
    }
  });

  describe('needsChunking', () => {
    it('should return false for small messages', () => {
      const smallMessage: DiagramOperationMessage = {
        message_type: 'diagram_operation',
        initiating_user: {
          user_id: 'test-user',
          email: 'test@example.com',
          displayName: 'Test User',
        },
        operation_id: 'test-op-id',
        operation: {
          type: 'patch',
          cells: [
            {
              id: 'cell-1',
              operation: 'add',
              data: {
                id: 'cell-1',
                shape: 'rect',
                x: 100,
                y: 100,
                width: 120,
                height: 60,
                label: 'Test Cell',
              },
            },
          ],
        },
      };

      expect(service.needsChunking(smallMessage)).toBe(false);
    });

    it('should return true for large messages', () => {
      // Create a message with many cells to exceed the size limit
      const largeCells = Array.from({ length: 1000 }, (_, i) => ({
        id: `cell-${i}`,
        operation: 'add' as const,
        data: {
          id: `cell-${i}`,
          shape: 'rect',
          x: i * 10,
          y: i * 10,
          width: 120,
          height: 60,
          label: `Test Cell ${i} with some additional data to increase size`,
          additionalData: 'A'.repeat(100), // Add extra data to increase size
        },
      }));

      const largeMessage: DiagramOperationMessage = {
        message_type: 'diagram_operation',
        initiating_user: {
          user_id: 'test-user',
          email: 'test@example.com',
          displayName: 'Test User',
        },
        operation_id: 'test-op-id',
        operation: {
          type: 'patch',
          cells: largeCells,
        },
      };

      expect(service.needsChunking(largeMessage)).toBe(true);
    });
  });

  describe('getMessageSize', () => {
    it('should calculate message size correctly', () => {
      const message: DiagramOperationMessage = {
        message_type: 'diagram_operation',
        initiating_user: {
          user_id: 'test-user',
          email: 'test@example.com',
          displayName: 'Test User',
        },
        operation_id: 'test-op-id',
        operation: {
          type: 'patch',
          cells: [],
        },
      };

      const size = service.getMessageSize(message);
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });
  });

  describe('chunkMessage', () => {
    it('should chunk a large message correctly', async () => {
      // Create a large message
      const largeCells = Array.from({ length: 1000 }, (_, i) => ({
        id: `cell-${i}`,
        operation: 'add' as const,
        data: {
          id: `cell-${i}`,
          shape: 'rect',
          x: i * 10,
          y: i * 10,
          width: 120,
          height: 60,
          label: `Test Cell ${i}`,
          additionalData: 'A'.repeat(100),
        },
      }));

      const largeMessage: DiagramOperationMessage = {
        message_type: 'diagram_operation',
        initiating_user: {
          user_id: 'test-user',
          email: 'test@example.com',
          displayName: 'Test User',
        },
        operation_id: 'test-op-id',
        operation: {
          type: 'patch',
          cells: largeCells,
        },
      };

      return new Promise<void>((resolve, reject) => {
        service.chunkMessage(largeMessage).subscribe({
          next: chunks => {
            try {
              expect(chunks.length).toBeGreaterThan(1);
              expect(chunks[0].message_type).toBe('chunked_message');
              expect(chunks[0].chunk_info.chunk_index).toBe(0);
              expect(chunks[0].chunk_info.original_message_type).toBe('diagram_operation');
              expect(chunks[0].chunk_info.total_chunks).toBe(chunks.length);

              // Verify chunk indices are sequential
              chunks.forEach((chunk, index) => {
                expect(chunk.chunk_info.chunk_index).toBe(index);
                expect(chunk.chunk_info.chunk_id).toBe(chunks[0].chunk_info.chunk_id);
              });

              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: error => {
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        });
      });
    });

    it('should fail to chunk a small message', async () => {
      const smallMessage: DiagramOperationMessage = {
        message_type: 'diagram_operation',
        initiating_user: {
          user_id: 'test-user',
          email: 'test@example.com',
          displayName: 'Test User',
        },
        operation_id: 'test-op-id',
        operation: {
          type: 'patch',
          cells: [],
        },
      };

      return new Promise<void>((resolve, reject) => {
        service.chunkMessage(smallMessage).subscribe({
          next: () => {
            reject(new Error('Should not succeed chunking a small message'));
          },
          error: error => {
            try {
              expect(error.message).toContain('does not need chunking');
              resolve();
            } catch (assertError) {
              reject(assertError instanceof Error ? assertError : new Error(String(assertError)));
            }
          },
        });
      });
    });
  });

  describe('processChunk', () => {
    it('should reassemble chunks correctly', async () => {
      // First, create a large message and chunk it
      const largeCells = Array.from({ length: 500 }, (_, i) => ({
        id: `cell-${i}`,
        operation: 'add' as const,
        data: {
          id: `cell-${i}`,
          shape: 'rect',
          x: i * 10,
          y: i * 10,
          width: 120,
          height: 60,
          label: `Test Cell ${i}`,
          additionalData: 'A'.repeat(50),
        },
      }));

      const originalMessage: DiagramOperationMessage = {
        message_type: 'diagram_operation',
        initiating_user: {
          user_id: 'test-user',
          email: 'test@example.com',
          displayName: 'Test User',
        },
        operation_id: 'test-op-id',
        operation: {
          type: 'patch',
          cells: largeCells,
        },
      };

      return new Promise<void>((resolve, reject) => {
        service.chunkMessage(originalMessage).subscribe({
          next: chunks => {
            let reassembledMessage: any = null;
            let chunksProcessed = 0;

            // Process each chunk
            chunks.forEach(chunk => {
              service.processChunk(chunk).subscribe({
                next: result => {
                  chunksProcessed++;
                  if (result) {
                    reassembledMessage = result;
                  }

                  // When all chunks are processed, verify the result
                  if (chunksProcessed === chunks.length) {
                    try {
                      expect(reassembledMessage).toBeTruthy();
                      expect(reassembledMessage.message_type).toBe('diagram_operation');
                      expect(reassembledMessage.operation_id).toBe('test-op-id');
                      expect(reassembledMessage.operation.cells.length).toBe(500);
                      resolve();
                    } catch (error) {
                      reject(error instanceof Error ? error : new Error(String(error)));
                    }
                  }
                },
                error: error => {
                  reject(error instanceof Error ? error : new Error(String(error)));
                },
              });
            });
          },
          error: error => {
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        });
      });
    });

    it('should handle duplicate chunks gracefully', async () => {
      // Create a simple chunked message for testing
      const chunk: ChunkedMessage = {
        message_type: 'chunked_message',
        chunk_info: {
          chunk_id: 'test-chunk-id',
          total_chunks: 2,
          chunk_index: 0,
          original_message_type: 'diagram_operation',
          total_size: 1000,
        },
        chunk_data: btoa('{"test": "data"}'),
      };

      return new Promise<void>((resolve, reject) => {
        // Process the same chunk twice
        service.processChunk(chunk).subscribe({
          next: result1 => {
            try {
              expect(result1).toBeNull(); // First chunk should return null

              service.processChunk(chunk).subscribe({
                next: result2 => {
                  try {
                    expect(result2).toBeNull(); // Duplicate should also return null
                    resolve();
                  } catch (error) {
                    reject(error instanceof Error ? error : new Error(String(error)));
                  }
                },
                error: error => {
                  reject(error instanceof Error ? error : new Error(String(error)));
                },
              });
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: error => {
            reject(error instanceof Error ? error : new Error(String(error)));
          },
        });
      });
    });
  });

  describe('getReassemblyStats', () => {
    it('should return correct stats', () => {
      const stats = service.getReassemblyStats();
      expect(stats.activeChunks).toBe(0);
      expect(stats.oldestChunkAge).toBeNull();
      expect(stats.totalChunksReceived).toBe(0);
    });
  });
});