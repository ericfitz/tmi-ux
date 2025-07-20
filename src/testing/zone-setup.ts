/**
 * Zone.js setup for Angular testing with Vitest
 * This file properly initializes Zone.js for Angular testing
 */

import 'zone.js';
import 'zone.js/testing'; // Standard import for Zone.js testing bundle
import 'zone.js/dist/zone-patch-rxjs'; // Patch for RxJS operators
import 'zone.js/dist/zone-patch-rxjs-interop'; // Patch for RxJS interop

import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Initialize the Angular testing environment
TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
  teardown: { destroyAfterEach: true },
});
