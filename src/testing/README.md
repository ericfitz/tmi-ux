# Testing Utilities

This directory contains utilities for testing the TMI-UX application. These utilities are designed to make testing easier, more consistent, and more maintainable.

## Directory Structure

```
src/testing/
├── helpers/          # Test helpers for common testing tasks
├── matchers/         # Custom matchers for assertions
├── mocks/            # Mock services for testing in isolation
└── page-objects/     # Page objects for encapsulating UI interactions
```

## Helpers

The `helpers` directory contains utility functions for common testing tasks. These functions are designed to be reused across tests to reduce duplication and improve maintainability.

### Graph Test Helpers

The `graph-test.helper.ts` file contains utility functions for testing AntV/X6 graph components. These functions make it easier to test graph-related functionality, such as checking if a node exists, getting the number of nodes, and checking if a node is selected.

Example:

```typescript
import { hasNode, getNodeCount } from '../../testing/helpers/graph-test.helper';

// Check if a node exists
const nodeExists = hasNode(graph, 'node1');

// Get the number of nodes
const nodeCount = getNodeCount(graph);
```

## Matchers

The `matchers` directory contains custom matchers for assertions. These matchers extend the Chai assertion library with application-specific assertions.

### Graph Matchers

The `graph-matchers.ts` file contains custom matchers for testing AntV/X6 graph components. These matchers make it easier to write assertions about graph-related functionality.

Example:

```typescript
import { graphMatchers, registerGraphMatchers } from '../../testing/matchers/graph-matchers';

// Register the graph matchers
registerGraphMatchers();

// Use the graph matchers in tests
expect(graph).to.haveNode('node1');
expect(graph).to.haveNodeCount(3);
```

## Mocks

The `mocks` directory contains mock services for testing in isolation. These services provide test doubles for application services, allowing tests to run without depending on external services.

### Mock Auth Service

The `mock-auth.service.ts` file contains a mock implementation of the authentication service. This service provides methods for simulating user authentication and authorization.

Example:

```typescript
import { MockAuthService } from '../../testing/mocks/mock-auth.service';

// Create a mock auth service
const authService = new MockAuthService();

// Login as an owner
authService.login('user@example.com', 'owner');

// Check if the user is authenticated
const isAuthenticated = authService.isAuthenticated();

// Check if the user can edit
const canEdit = authService.canEdit();
```

### Mock Graph Service

The `mock-graph.service.ts` file contains a mock implementation of the graph service. This service provides methods for simulating graph operations, such as adding nodes, removing nodes, and selecting nodes.

Example:

```typescript
import { MockGraphService } from '../../testing/mocks/mock-graph.service';

// Create a mock graph service
const graphService = new MockGraphService();

// Add a node
const node = graphService.addNode({ id: 'node1', shape: 'process' });

// Select the node
graphService.selectCell('node1');

// Check if the node is selected
const selectedCells = graphService.getSelectedCells$().value;
const isSelected = selectedCells.some(cell => cell.id === 'node1');
```

### Mock WebSocket Service

The `mock-websocket.service.ts` file contains a mock implementation of the WebSocket service. This service provides methods for simulating WebSocket communication, such as connecting, disconnecting, sending messages, and receiving messages.

Example:

```typescript
import { MockWebSocketService } from '../../testing/mocks/mock-websocket.service';

// Create a mock WebSocket service
const wsService = new MockWebSocketService();

// Connect to the WebSocket server
wsService.connect('ws://localhost:8080', 'auth-token');

// Send a message
wsService.send({ type: 'update', data: { id: 'node1', position: { x: 100, y: 100 } } });

// Simulate receiving a message from another user
wsService.simulateIncomingMessage({
  type: 'update',
  data: { id: 'node2', position: { x: 200, y: 200 } },
  userId: 'other-user-id',
  userName: 'Other User',
});
```

## Page Objects

The `page-objects` directory contains page objects for encapsulating UI interactions. Page objects provide a higher-level API for interacting with the UI, which makes tests more readable and maintainable.

### Base Page Object

The `page-object.base.ts` file contains a base class for page objects. This class provides common methods for interacting with the UI, such as navigating to a page, getting elements, clicking elements, and typing text.

Example:

```typescript
import { PageObject } from '../../testing/page-objects/page-object.base';

class MyPage extends PageObject {
  constructor() {
    super('/my-page');
  }

  getTitle(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.getBySelector('h1');
  }

  clickButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.clickBySelector('button');
  }
}
```

### Threat Model List Page Object

The `threat-model-list.page.ts` file contains a page object for the threat model list page. This page object provides methods for interacting with the threat model list page, such as getting threat model cards, clicking on a threat model, and searching for threat models.

Example:

```typescript
import { ThreatModelListPage } from '../../testing/page-objects/threat-model-list.page';

// Create a page object
const page = new ThreatModelListPage();

// Navigate to the page
page.visit();

// Get the page title
page.getPageTitle().should('contain.text', 'Threat Models');

// Get all threat model cards
page.getThreatModelCards().should('have.length.at.least', 1);

// Click on a threat model
page.clickThreatModelCardByName('System Architecture');
```

## Further Reading

For more information about the UI testing framework, see the [UI Testing Framework](../../docs/testing/ui-testing-framework.md) documentation.
