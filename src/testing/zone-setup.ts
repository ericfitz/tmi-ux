/**
 * Zone.js setup for Angular testing with Vitest
 * This file properly initializes Zone.js for Angular testing
 * Note: compiler-setup.ts must be imported before this file
 *
 * IMPORTANT: This file only loads Zone.js. Each test file must initialize
 * TestBed in its own beforeAll() hook because vitest runs test files in separate
 * processes and TestBed state is not serializable.
 */

import 'zone.js';
import 'zone.js/testing'; // Standard import for Zone.js testing bundle
import 'zone.js/dist/zone-patch-rxjs'; // Patch for RxJS operators
import 'zone.js/dist/zone-patch-rxjs-interop'; // Patch for RxJS interop
