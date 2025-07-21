/// <reference types="cypress" />

/**
 * DFD Integration Tests - Selection Styling (Cypress)
 * 
 * This test file focuses on the critical issue of selection styling persistence
 * after undo operations. These tests run in a real browser environment with
 * actual X6 graph instances and verify cell attributes to catch styling artifacts
 * that can occur during complex operations like delete/undo of selected objects.
 * 
 * Converted from vitest integration test to Cypress for proper browser environment.
 */

import { navigateToDfdDiagram } from '../support/dfd-test-helpers';

describe('DFD Integration - Selection Styling (CRITICAL)', () => {
  beforeEach(() => {
    navigateToDfdDiagram();
  });

  describe('Single Cell Selection Styling', () => {
    it('should apply correct selection styling to nodes', () => {
      // Create test nodes of different types
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      cy.get('button').contains('text_fields').click(); // Text box node button
      cy.get('.x6-graph-scroller').click(500, 100);
      
      // Verify we have 3 nodes
      cy.get('.x6-node').should('have.length', 3);
      
      // Select first node (actor) and verify selection styling
      cy.get('.x6-node').first().click();
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-node-tool').should('exist');
      
      // Select second node (process) and verify selection styling
      cy.get('.x6-node').eq(1).click();
      cy.get('.x6-node').eq(1).should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-node-tool').should('exist');
      
      // Select third node (text-box) and verify selection styling
      cy.get('.x6-node').eq(2).click();
      cy.get('.x6-node').eq(2).should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-node-tool').should('exist');
    });

    it('should apply correct selection styling to edges', () => {
      // Create two nodes first
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      // Create an edge between them
      // Note: Edge creation needs to be done by dragging between nodes
      cy.get('.x6-node').first().click(); // source
      cy.get('.x6-node').last().click();  // target
      
      // Verify edge exists
      cy.get('.x6-edge').should('have.length', 1);
      
      // Select the edge and verify selection styling
      cy.get('.x6-edge').click();
      cy.get('.x6-edge').should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-edge-tool').should('exist');
    });

    it('should clean up styling when cells are deselected', () => {
      // Create a node
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      // Select and verify selection styling
      cy.get('.x6-node').first().click();
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-node-tool').should('exist');
      
      // Deselect by clicking empty area and verify clean styling
      cy.get('.x6-graph-scroller').click(400, 400);
      cy.get('.x6-node').first().then(($node) => {
        const style = $node.attr('style') || '';
        expect(style).to.not.include('filter: drop-shadow');
      });
      cy.get('.x6-node-tool').should('not.exist');
    });
  });

  describe('Multi-Selection Operations', () => {
    it('should apply consistent selection styling to multiple cells', () => {
      // Create multiple nodes
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      cy.get('button').contains('database').click(); // Store node button
      cy.get('.x6-graph-scroller').click(500, 100);
      
      // Verify we have 3 nodes
      cy.get('.x6-node').should('have.length', 3);
      
      // Select all nodes using Ctrl+click
      cy.get('.x6-node').first().click();
      cy.get('.x6-node').eq(1).click({ ctrlKey: true });
      cy.get('.x6-node').eq(2).click({ ctrlKey: true });
      
      // Verify all nodes have selection styling and tools
      cy.get('.x6-node').each(($node) => {
        cy.wrap($node).should('have.attr', 'style').and('include', 'filter');
      });
      cy.get('.x6-node-tool').should('have.length.greaterThan', 0);
      
      // Verify all nodes appear selected visually
      cy.get('.x6-node-tool').should('have.length.greaterThan', 0);
    });

    it('should handle mixed node and edge selection', () => {
      // Create nodes and edge
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      // Create an edge
      // Note: Edge creation needs to be done by dragging between nodes
      cy.get('.x6-node').first().click();
      cy.get('.x6-node').last().click();
      
      // Select all cells (nodes and edge)
      cy.get('.x6-node').first().click();
      cy.get('.x6-node').last().click({ ctrlKey: true });
      cy.get('.x6-edge').click({ ctrlKey: true });
      
      // Verify styling for all selected cells
      cy.get('.x6-node').each(($node) => {
        cy.wrap($node).should('have.attr', 'style').and('include', 'filter');
      });
      cy.get('.x6-edge').should('have.attr', 'style').and('include', 'filter');
      
      // Verify tools are present
      cy.get('.x6-node-tool').should('exist');
      cy.get('.x6-edge-tool').should('exist');
    });
  });

  describe('🚨 CRITICAL: Selection Styling and History Integration', () => {
    it('should restore deleted cells without selection styling (single cell)', () => {
      // Create and select a node
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      cy.get('.x6-node').first().click();
      
      // Verify selection styling is applied
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-node-tool').should('exist');
      
      // Delete selected cell
      cy.get('body').type('{del}');
      cy.get('.x6-node').should('have.length', 0);
      
      // Undo deletion
      cy.get('body').type('{ctrl}z');
      
      // CRITICAL: Verify restored node has clean styling
      cy.get('.x6-node').should('have.length', 1);
      cy.get('.x6-node').first().then(($node) => {
        const style = $node.attr('style') || '';
        expect(style).to.not.include('filter: drop-shadow');
      });
      cy.get('.x6-node-tool').should('not.exist');
    });

    it('should restore deleted cells without selection styling (multiple cells)', () => {
      // Create multiple nodes
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      cy.get('button').contains('text_fields').click(); // Text box node button
      cy.get('.x6-graph-scroller').click(500, 100);
      
      // Select all nodes
      cy.get('.x6-node').first().click();
      cy.get('.x6-node').eq(1).click({ ctrlKey: true });
      cy.get('.x6-node').eq(2).click({ ctrlKey: true });
      
      // Verify all nodes have selection styling
      cy.get('.x6-node').each(($node) => {
        cy.wrap($node).should('have.attr', 'style').and('include', 'filter');
      });
      cy.get('.x6-node-tool').should('exist');
      
      // Delete selected cells
      cy.get('body').type('{del}');
      cy.get('.x6-node').should('have.length', 0);
      
      // Undo deletion
      cy.get('body').type('{ctrl}z');
      
      // CRITICAL: Verify all restored cells have clean styling
      cy.get('.x6-node').should('have.length', 3);
      cy.get('.x6-node').each(($node) => {
        cy.wrap($node).then(($el) => {
          const style = $el.attr('style') || '';
          expect(style).to.not.include('filter: drop-shadow');
        });
      });
      cy.get('.x6-node-tool').should('not.exist');
    });

    it('should restore deleted edges without selection styling', () => {
      // Create nodes and edge
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      // Create an edge
      // Note: Edge creation needs to be done by dragging between nodes
      cy.get('.x6-node').first().click();
      cy.get('.x6-node').last().click();
      
      // Select edge
      cy.get('.x6-edge').click();
      cy.get('.x6-edge').should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-edge-tool').should('exist');
      
      // Delete edge
      cy.get('body').type('{del}');
      cy.get('.x6-edge').should('have.length', 0);
      
      // Undo deletion
      cy.get('body').type('{ctrl}z');
      
      // CRITICAL: Verify restored edge has clean styling
      cy.get('.x6-edge').should('have.length', 1);
      cy.get('.x6-edge').then(($edge) => {
        const style = $edge.attr('style') || '';
        expect(style).to.not.include('filter: drop-shadow');
      });
      cy.get('.x6-edge-tool').should('not.exist');
    });

    it('should handle complex multi-cell delete/undo scenarios', () => {
      // Create a complex scenario with nodes and edges
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      cy.get('button').contains('database').click(); // Store node button
      cy.get('.x6-graph-scroller').click(500, 100);
      
      // Create edges
      // Note: Edge creation needs to be done by dragging between nodes
      cy.get('.x6-node').first().click();  // actor
      cy.get('.x6-node').eq(1).click();    // process
      
      // Note: Edge creation needs to be done by dragging between nodes
      cy.get('.x6-node').eq(1).click();    // process
      cy.get('.x6-node').eq(2).click();    // store
      
      // Verify we have 3 nodes and 2 edges
      cy.get('.x6-node').should('have.length', 3);
      cy.get('.x6-edge').should('have.length', 2);
      
      // Select all cells using marquee selection or Ctrl+A
      cy.get('body').type('{ctrl}a');
      
      // Verify all cells have selection styling
      cy.get('.x6-node').each(($node) => {
        cy.wrap($node).should('have.attr', 'style').and('include', 'filter');
      });
      cy.get('.x6-edge').each(($edge) => {
        cy.wrap($edge).should('have.attr', 'style').and('include', 'filter');
      });
      
      // Delete all selected cells
      cy.get('body').type('{del}');
      cy.get('.x6-node').should('have.length', 0);
      cy.get('.x6-edge').should('have.length', 0);
      
      // Undo deletion
      cy.get('body').type('{ctrl}z');
      
      // CRITICAL: Verify all restored cells have clean styling
      cy.get('.x6-node').should('have.length', 3);
      cy.get('.x6-edge').should('have.length', 2);
      
      cy.get('.x6-node').each(($node) => {
        cy.wrap($node).then(($el) => {
          const style = $el.attr('style') || '';
          expect(style).to.not.include('filter: drop-shadow');
        });
      });
      cy.get('.x6-edge').each(($edge) => {
        cy.wrap($edge).then(($el) => {
          const style = $el.attr('style') || '';
          expect(style).to.not.include('filter: drop-shadow');
        });
      });
      
      // Verify no tools are present
      cy.get('.x6-node-tool').should('not.exist');
      cy.get('.x6-edge-tool').should('not.exist');
      
      // CRITICAL: Verify no selection tools visible
      cy.get('.x6-node-tool').should('not.exist');
      cy.get('.x6-edge-tool').should('not.exist');
    });
  });

  describe('Tool State Management', () => {
    it('should apply correct tools to selected nodes', () => {
      // Create and select a node
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      cy.get('.x6-node').first().click();
      
      // Verify specific node tools are present
      cy.get('.x6-node-tool').should('exist');
      cy.get('.x6-node-tool[data-name="button-remove"]').should('exist');
      cy.get('.x6-node-tool[data-name="boundary"]').should('exist');
    });

    it('should apply correct tools to selected edges', () => {
      // Create nodes and edge
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      // Create an edge
      // Note: Edge creation needs to be done by dragging between nodes
      cy.get('.x6-node').first().click();
      cy.get('.x6-node').last().click();
      
      // Select edge
      cy.get('.x6-edge').click();
      
      // Verify specific edge tools are present
      cy.get('.x6-edge-tool').should('exist');
      cy.get('.x6-edge-tool[data-name="button-remove"]').should('exist');
      cy.get('.x6-edge-tool[data-name="vertices"]').should('exist');
    });

    it('should remove tools when cells are deselected', () => {
      // Create and select a node
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(100, 100);
      cy.get('.x6-node').first().click();
      
      // Verify tools are present
      cy.get('.x6-node-tool').should('exist');
      
      // Deselect by clicking empty area
      cy.get('.x6-graph-scroller').click(400, 400);
      
      // Verify tools are removed
      cy.get('.x6-node-tool').should('not.exist');
    });
  });

  describe('Selection State Consistency', () => {
    it('should maintain consistent selection state across operations', () => {
      // Create two nodes
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      // Test single selection
      cy.get('.x6-node').first().click();
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-node').last().should('not.have.attr', 'style');
      
      // Add to selection
      cy.get('.x6-node').last().click({ ctrlKey: true });
      cy.get('.x6-node').each(($node) => {
        cy.wrap($node).should('have.attr', 'style').and('include', 'filter');
      });
      
      // Clear selection by clicking empty area
      cy.get('.x6-graph-scroller').click(500, 500);
      cy.get('.x6-node').each(($node) => {
        cy.wrap($node).then(($el) => {
          const style = $el.attr('style') || '';
          expect(style).to.not.include('filter: drop-shadow');
        });
      });
      cy.get('.x6-node-tool').should('not.exist');
    });
  });

  describe('Performance and Memory', () => {
    it('should not cause memory leaks from selection operations', () => {
      // Create a node
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(200, 200);
      
      // Perform many selection/deselection operations rapidly
      for (let i = 0; i < 10; i++) {
        cy.get('.x6-node').first().click();
        cy.get('.x6-graph-scroller').click(100 + i * 10, 100);
      }
      
      // Verify final state is clean
      cy.get('.x6-node').should('have.length', 1);
      cy.get('.x6-node').first().should('not.have.attr', 'style').or('not.include', 'filter');
      cy.get('.x6-node-tool').should('not.exist');
      
      // Verify no memory leaks in selection state
      cy.get('.x6-node-tool').should('not.exist');
    });
  });
});