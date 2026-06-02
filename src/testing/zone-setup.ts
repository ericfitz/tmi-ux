/**
 * Zone.js setup for Angular testing with Vitest
 * This file properly initializes Zone.js for Angular testing
 * Note: compiler-setup.ts must be imported before this file
 *
 * IMPORTANT: This file only loads Zone.js. Each test file must initialize
 * TestBed in its own beforeAll() hook because vitest runs test files in separate
 * processes and TestBed state is not serializable.
 *
 * The zone-patch-rxjs / zone-patch-rxjs-interop patches are intentionally NOT
 * loaded here. zone.js 0.16 no longer ships them under `dist/` (the old import
 * paths resolved to nothing), and zone-patch-rxjs collides with Vitest's
 * `expect(...).toThrow` matcher under the current toolchain.
 */

import 'zone.js';
import 'zone.js/testing'; // Standard import for Zone.js testing bundle
