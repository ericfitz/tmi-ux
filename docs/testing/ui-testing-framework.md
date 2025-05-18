# UI Testing Framework

This document outlines the comprehensive UI testing framework for the TMI-UX application. The framework is designed to provide a robust, maintainable, and efficient approach to testing the user interface of the application.

## Table of Contents

- [Overview](#overview)
- [Technologies](#technologies)
- [Directory Structure](#directory-structure)
- [Test Types](#test-types)
- [Page Objects](#page-objects)
- [Custom Commands](#custom-commands)
- [Mock Services](#mock-services)
- [Test Helpers](#test-helpers)
- [Running Tests](#running-tests)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The UI testing framework is built on top of Cypress, a modern JavaScript end-to-end testing framework. It provides a comprehensive set of tools and utilities for testing the user interface of the TMI-UX application, including:

- End-to-end (E2E) tests for testing complete user flows
- Component tests for testing individual Angular components
- Page objects for encapsulating UI interactions
- Custom commands for common operations
- Mock services for testing in isolation
- Test helpers for common testing tasks

## Technologies

The UI testing framework uses the following technologies:

- [Cypress](https://www.cypress.io/) - Modern JavaScript end-to-end testing framework
- [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript
- [Angular](https://angular.io/) - Web application framework
- [RxJS](https://rxjs.dev/) - Reactive programming library
- [AntV/X6](https://x6.antv.vision/en) - Graph visualization library

## Directory Structure

The UI testing framework is organized into the following directory structure:

```
├── cypress/
│   ├── e2e/                  # End-to-end tests
│   ├── fixtures/             # Test fixtures
│   └── support/              # Support files
│       ├── commands.ts       # Custom Cypress commands
│       ├── component.ts      # Component test support
│       ├── e2e.ts            # E2E test support
│       └── index.d.ts        # TypeScript definitions
├── src/
│   └── testing/              # Testing utilities
│       ├── helpers/          # Test helpers
│       ├── matchers/         # Custom matchers
│       ├── mocks/            # Mock services
│       └── page-objects/     # Page objects
└── scripts/
    └── run-cypress-tests.js  # Script to run Cypress tests
```

## Test Types

The UI testing framework supports two types of tests:

### End-to-End (E2E) Tests

E2E tests verify the functionality of the application from the user's perspective. They simulate user interactions with the application and verify that the application behaves as expected.

E2E tests are located in the `cypress/e2e/` directory and have the `.cy.ts` extension.

Example:

```typescript
// cypress/e2e/threat-model-list.cy.ts
import { ThreatModelListPage } from '../../src/testing/page-objects/threat-model-list.page';

describe('Threat Model List', () => {
  const page = new ThreatModelListPage();

  beforeEach(() => {
    page.visit();
    // ...
  });

  it('should display the list of threat models', () => {
    page.getPageTitle().should('contain.text', 'Threat Models');
    page.getThreatModelCards().should('have.length.at.least', 1);
  });

  // ...
});
```

### Component Tests

Component tests verify the functionality of individual Angular components in isolation. They mount the component in a test environment and verify that it behaves as expected.

Component tests are located in the same directory as the component they test and have the `.cy.ts` extension.

Example:

```typescript
// src/app/pages/tm/tm.component.cy.ts
import { MountConfig } from 'cypress/angular';
import { TmComponent } from './tm.component';
import { MockDataService } from '../../mocks/mock-data.service';
// ...

describe('TmComponent', () => {
  const mountConfig: MountConfig<TmComponent> = {
    // ...
  };

  it('should display the threat model list', () => {
    cy.mount(TmComponent, mountConfig);
    // ...
  });

  // ...
});
```

## Page Objects

Page objects are a design pattern for encapsulating UI interactions in tests. They provide a higher-level API for interacting with the UI, which makes tests more readable and maintainable.

Page objects are located in the `src/testing/page-objects/` directory.

Example:

```typescript
// src/testing/page-objects/threat-model-list.page.ts
import { PageObject } from './page-object.base';

export class ThreatModelListPage extends PageObject {
  constructor() {
    super('/tm');
  }

  getPageTitle(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector('h1');
  }

  getThreatModelCards(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector('.threat-model-card');
  }

  // ...
}
```

## Custom Commands

Custom commands extend the Cypress API with application-specific commands. They provide a convenient way to perform common operations in tests.

Custom commands are defined in the `cypress/support/commands.ts` file.

Example:

```typescript
// cypress/support/commands.ts
Cypress.Commands.add('login', (email: string, role: 'owner' | 'writer' | 'reader' = 'owner') => {
  // ...
});
```

## Mock Services

Mock services provide test doubles for application services. They allow tests to run in isolation without depending on external services.

Mock services are located in the `src/testing/mocks/` directory.

Example:

```typescript
// src/testing/mocks/mock-auth.service.ts
import { BehaviorSubject, Observable } from 'rxjs';

export class MockAuthService {
  private _currentUser = new BehaviorSubject<User | null>(null);

  get currentUser$(): Observable<User | null> {
    return this._currentUser.asObservable();
  }

  // ...
}
```

## Test Helpers

Test helpers provide utility functions for common testing tasks. They make tests more concise and maintainable.

Test helpers are located in the `src/testing/helpers/` directory.

Example:

```typescript
// src/testing/helpers/graph-test.helper.ts
import { Graph, Node, Edge } from '@antv/x6';

export function hasNode(graph: Graph, nodeId: string): boolean {
  const node = graph.getCellById(nodeId);
  return node !== null && node.isNode();
}

// ...
```

## Running Tests

Tests can be run using the following npm scripts:

- `npm run test:e2e` - Run all E2E tests
- `npm run test:e2e:open` - Open the Cypress UI for E2E tests
- `npm run test:component` - Run all component tests
- `npm run test:component:open` - Open the Cypress UI for component tests

You can also run specific tests by providing a spec pattern:

```bash
npm run test:e2e -- --spec="cypress/e2e/threat-model-list.cy.ts"
```

## Best Practices

### General

- Use TypeScript for all test files
- Use page objects to encapsulate UI interactions
- Use custom commands for common operations
- Use mock services for testing in isolation
- Use test helpers for common testing tasks
- Use meaningful test descriptions
- Keep tests independent and isolated
- Clean up after tests

### E2E Tests

- Test complete user flows
- Use page objects to interact with the UI
- Use custom commands for common operations
- Use mock data for testing
- Verify the application state after each action

### Component Tests

- Test components in isolation
- Use mock services for dependencies
- Test component behavior, not implementation details
- Test component interactions with the user
- Test component interactions with other components

## Troubleshooting

### Common Issues

- **Tests are flaky**: Use `cy.wait()` to wait for asynchronous operations to complete
- **Tests fail with "element not found"**: Use `cy.contains()` or `cy.get()` with a more specific selector
- **Tests fail with "element not visible"**: Use `cy.scrollIntoView()` to scroll the element into view
- **Tests fail with "element not interactable"**: Use `cy.wait()` to wait for the element to become interactable

### Debugging

- Use `cy.debug()` to pause test execution and inspect the state
- Use `cy.log()` to log messages to the Cypress console
- Use `cy.screenshot()` to take screenshots during test execution
- Use the Cypress UI to inspect the application state and DOM
