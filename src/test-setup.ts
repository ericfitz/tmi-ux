// This file is required by vitest.config.ts and will be used for test setup

// Import zone.js for Angular testing
import 'zone.js';
import 'zone.js/testing';

// Import Angular testing APIs
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Initialize the Angular testing environment
getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
  teardown: { destroyAfterEach: true },
});
