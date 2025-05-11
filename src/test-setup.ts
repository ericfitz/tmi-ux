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

// Import Vitest globals
import { expect, vi } from 'vitest';

// Initialize the Angular testing environment
getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
  teardown: { destroyAfterEach: true },
});

// Set up global jasmine-like APIs for compatibility with existing tests
(window as any).jasmine = {
  createSpyObj: (baseName: string, methodNames: string[]) => {
    const obj: any = {};

    for (const method of methodNames) {
      obj[method] = vi.fn();
      obj[method].and = {
        returnValue: (value: any) => {
          obj[method].mockReturnValue(value);
          return obj[method];
        },
        callFake: (implementationFn: (...args: any[]) => any) => {
          obj[method].mockImplementation(implementationFn);
          return obj[method];
        },
      };
    }

    return obj;
  },
};

// Set up spyOn global
(window as any).spyOn = (obj: any, method: string) => {
  const spy = vi.spyOn(obj, method);
  (spy as any).and = {
    returnValue: (value: any) => {
      spy.mockReturnValue(value);
      return spy;
    },
    callFake: (implementationFn: (...args: any[]) => any) => {
      spy.mockImplementation(implementationFn);
      return spy;
    },
  };
  return spy;
};
