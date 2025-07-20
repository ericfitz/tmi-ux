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
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
