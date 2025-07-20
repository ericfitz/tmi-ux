/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Custom command to mount Angular components
     * @example cy.mount(MyComponent)
     */
    mount: typeof import('cypress/angular').mount;

    /**
     * Custom command to add a node to the graph
     * @example cy.addNodeToGraph('process', { x: 100, y: 100 })
     */
    addNodeToGraph(nodeType: string, position: { x: number; y: number }): Chainable<Element>;

    /**
     * Custom command to connect two nodes with an edge
     * @example cy.connectNodes('node1', 'node2')
     */
    connectNodes(sourceId: string, targetId: string): Chainable<Element>;

    /**
     * Custom command to select a node in the graph
     * @example cy.selectNode('node1')
     */
    selectNode(nodeId: string): Chainable<Element>;

    /**
     * Custom command to login with a specific role
     * @example cy.login('user@example.com', 'owner')
     */
    login(email: string, role?: 'owner' | 'writer' | 'reader'): Chainable<Element>;
  }
}
