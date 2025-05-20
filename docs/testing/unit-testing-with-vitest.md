# Unit Testing with Vitest in Angular 19

This document outlines the unit testing methodology for the TMI-UX application using Vitest with Angular 19. It provides a comprehensive approach to setting up and writing unit tests that properly handle Angular's Zone.js requirements.

## Table of Contents

- [Overview](#overview)
- [Setup and Configuration](#setup-and-configuration)
- [Common Issues and Solutions](#common-issues-and-solutions)
  - [ProxyZone Error](#proxyzone-error)
- [Testing Utilities](#testing-utilities)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Overview

The TMI-UX application uses Vitest as its unit testing framework for Angular 19. Vitest offers several advantages over traditional Angular testing setups (Jasmine/Karma):

- Faster test execution
- Better developer experience
- Modern features like watch mode and UI
- Compatibility with Vite for a unified tooling experience

However, integrating Vitest with Angular requires careful setup to ensure proper handling of Angular's Zone.js requirements, particularly for asynchronous operations.

## Setup and Configuration

### Zone.js Setup

Angular's change detection relies on Zone.js, which needs special handling in the test environment. Create a dedicated file to properly initialize Zone.js:

```typescript
// src/testing/zone-setup.ts
import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

// Initialize the Angular testing environment
TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
  teardown: { destroyAfterEach: true },
});
```

### Test Setup File

Update the test setup file to ensure proper Zone.js initialization:

```typescript
// src/test-setup.ts
import './testing/zone-setup';

// Additional global test setup can go here
```

### Vitest Configuration

Update the Vitest configuration to ensure proper handling of Zone.js:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@app': resolve(__dirname, './src/app'),
      '@assets': resolve(__dirname, './src/assets'),
      '@environments': resolve(__dirname, './src/environments'),
      '@testing': resolve(__dirname, './src/testing'),
    },
  },
  plugins: [
    angular({
      tsconfig: './tsconfig.spec.json',
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    deps: {
      inline: [/^@angular/, /^@jsverse/],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/environments/**',
      ],
    },
    // Add these options for better Zone.js compatibility
    isolate: false,
    pool: 'forks', // Use 'forks' instead of 'threads' for better Zone.js compatibility
  },
});
```

## Common Issues and Solutions

### ProxyZone Error

One common issue when testing Angular applications with Vitest is the "ProxyZone" error:

```
Error: Expected to be running in 'ProxyZone', but it was not found. Please make sure that your test includes the 'zone.js/testing' import and is running in a test environment.
```

This error occurs when tests with asynchronous operations (like HTTP requests or Observables) are not properly set up to run in Angular's ProxyZone.

#### Solution

1. Create utility functions to properly handle async operations in tests:

```typescript
// src/testing/async-utils.ts
import { fakeAsync, flush, tick } from '@angular/core/testing';

/**
 * Wraps an async test in a fakeAsync zone and handles completion
 * @param fn The test function to wrap
 * @param timeout Optional timeout in milliseconds
 */
export function runInTestZone(fn: () => Promise<any> | void, timeout = 5000): () => void {
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
 * @param fn The test function that returns an Observable
 */
export function waitForAsync(fn: () => void): () => Promise<void> {
  return async () => {
    await fn();
  };
}
```

2. Use these utilities in your test files:

```typescript
// Example test file
import 'zone.js';
import 'zone.js/testing';

import { HttpClient } from '@angular/common/http';
import { ThreatModelService } from './threat-model.service';
import { LoggerService } from '../../../core/services/logger.service';
import { MockDataService } from '../../../mocks/mock-data.service';
import { BehaviorSubject, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { runInTestZone, waitForAsync } from '@testing/async-utils';

// Import mock data
import {
  mockThreatModel1,
  mockThreatModel2,
  mockThreatModel3,
} from '../../../mocks/instances/threat-models';

describe('ThreatModelService', () => {
  // Test setup...

  it('should return mock threat models', waitForAsync(() => {
    service.getThreatModels().subscribe(threatModels => {
      expect(threatModels.length).toBe(3);
      expect(threatModels).toContain(mockThreatModel1);
      expect(threatModels).toContain(mockThreatModel2);
      expect(threatModels).toContain(mockThreatModel3);
    });
  }));

  // More tests...
});
```

## Testing Utilities

### Component Test Harness

For component testing, create a test harness that properly sets up the Angular testing environment:

```typescript
// src/testing/component-test-harness.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Type } from '@angular/core';

/**
 * Creates a component fixture with the provided configuration
 * @param component The component type to create
 * @param providers Optional providers for the test module
 * @param declarations Optional declarations for the test module
 * @param imports Optional imports for the test module
 */
export function createComponentFixture<T>(
  component: Type<T>,
  {
    providers = [],
    declarations = [],
    imports = [],
  }: {
    providers?: any[];
    declarations?: any[];
    imports?: any[];
  } = {},
): ComponentFixture<T> {
  TestBed.configureTestingModule({
    imports,
    declarations: [component, ...declarations],
    providers,
  }).compileComponents();

  return TestBed.createComponent(component);
}
```

## Best Practices

### General

- Always import 'zone.js' and 'zone.js/testing' at the top of your test files
- Use the provided async utilities for tests with asynchronous operations
- Keep tests isolated and independent
- Use meaningful test descriptions
- Clean up after tests

### Service Tests

- Mock dependencies using Vitest's mocking capabilities
- Test both success and error scenarios
- Test edge cases
- Use waitForAsync or runInTestZone for tests with Observables or Promises

### Component Tests

- Use the component test harness to create component fixtures
- Test component behavior, not implementation details
- Test component interactions with the user
- Test component interactions with services

## Examples

### Service Test Example

```typescript
// src/app/services/data.service.spec.ts
import 'zone.js';
import 'zone.js/testing';

import { HttpClient } from '@angular/common/http';
import { DataService } from './data.service';
import { LoggerService } from '../core/services/logger.service';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { waitForAsync } from '@testing/async-utils';

describe('DataService', () => {
  let service: DataService;
  let httpClient: HttpClient;
  let loggerService: LoggerService;

  beforeEach(() => {
    httpClient = {
      get: vi.fn(),
      post: vi.fn(),
    } as unknown as HttpClient;

    loggerService = {
      debug: vi.fn(),
      error: vi.fn(),
    } as unknown as LoggerService;

    service = new DataService(httpClient, loggerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch data successfully', waitForAsync(() => {
    const mockData = { id: 1, name: 'Test' };
    vi.spyOn(httpClient, 'get').mockReturnValue(of(mockData));

    service.getData().subscribe(data => {
      expect(data).toEqual(mockData);
      expect(httpClient.get).toHaveBeenCalledWith('/api/data');
    });
  }));

  it('should handle errors when fetching data', waitForAsync(() => {
    const error = new Error('Network error');
    vi.spyOn(httpClient, 'get').mockReturnValue(throwError(() => error));

    service.getData().subscribe({
      next: () => fail('Should have failed'),
      error: err => {
        expect(err).toBe(error);
        expect(loggerService.error).toHaveBeenCalled();
      },
    });
  }));
});
```

### Component Test Example

```typescript
// src/app/components/user-profile/user-profile.component.spec.ts
import 'zone.js';
import 'zone.js/testing';

import { UserProfileComponent } from './user-profile.component';
import { UserService } from '../../services/user.service';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createComponentFixture } from '@testing/component-test-harness';
import { waitForAsync } from '@testing/async-utils';

describe('UserProfileComponent', () => {
  let component: UserProfileComponent;
  let fixture: ComponentFixture<UserProfileComponent>;
  let userService: UserService;

  beforeEach(() => {
    userService = {
      getCurrentUser: vi.fn().mockReturnValue(of({ id: 1, name: 'Test User' })),
    } as unknown as UserService;

    fixture = createComponentFixture(UserProfileComponent, {
      providers: [{ provide: UserService, useValue: userService }],
    });

    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display user name', waitForAsync(() => {
    fixture.detectChanges();
    const element = fixture.nativeElement;
    expect(element.querySelector('.user-name').textContent).toContain('Test User');
  }));
});
```
