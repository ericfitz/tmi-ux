/**
 * Utility functions for handling asynchronous operations in tests
 * These utilities help ensure tests run in the correct Zone.js context
 */

import { fakeAsync, flush, tick } from '@angular/core/testing';

/**
 * Wraps an async test in a fakeAsync zone and handles completion
 * @param fn The test function to wrap
 * @param timeout Optional timeout in milliseconds
 * @returns A function that can be used as a test case
 */
// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: wrap a test function in a fakeAsync zone with optional timeout (pure)
export function runInTestZone(fn: () => Promise<unknown> | void, timeout = 5000): () => void {
  return fakeAsync(() => {
    const result = fn();
    if (result instanceof Promise) {
      tick(timeout);
      flush();
    }
  });
}

/**
 * Wraps an Observable test to properly handle async operations
 * @param fn The test function that may contain async operations
 * @returns A function that can be used as a test case
 */
// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: wrap a test function to handle async/promise completion (pure)
export function waitForAsync(fn: () => void | Promise<void>): () => Promise<void> {
  return async () => {
    const result = fn();
    if (result instanceof Promise) {
      await result;
    }
  };
}

/**
 * Creates a promise that resolves after the specified time
 * @param ms Time to wait in milliseconds
 * @returns A promise that resolves after the specified time
 */
// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: build a promise that resolves after a specified duration (pure)
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
