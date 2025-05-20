/**
 * Zone.js setup for Angular testing with Vitest
 * This file properly initializes Zone.js for Angular testing
 */

import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Initialize the Angular testing environment
try {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
    teardown: { destroyAfterEach: true },
  });
} catch (e) {
  console.info('Angular testing environment already initialized: ', e);
}
