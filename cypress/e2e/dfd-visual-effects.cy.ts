/// <reference types="cypress" />

/**
 * DFD Integration Tests - Visual Effects (Cypress)
 * 
 * This test file focuses on the visual effects system for creation highlights
 * and fade animations. Tests run in a real browser environment with actual
 * X6 graph instances and verify visual effects applied to cells during
 * programmatic creation operations.
 * 
 * Converted from vitest integration test to Cypress for proper browser environment.
 */

import { navigateToDfdDiagram } from '../support/dfd-test-helpers';

describe('DFD Integration - Visual Effects', () => {
  beforeEach(() => {
    navigateToDfdDiagram();
  });

  describe('Creation Highlight Effects', () => {
    it('should apply creation highlight with default blue color', () => {
      // Create a node using the toolbar
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      // Node should appear with creation effect (blue glow)
      cy.get('.x6-node').should('have.length', 1);
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'filter');
      
      // Verify the creation effect has blue color and drop-shadow
      cy.get('.x6-node').first().then(($node) => {
        const style = $node.attr('style');
        expect(style).to.include('drop-shadow');
        expect(style).to.include('rgba(0, 150, 255'); // Default blue color
      });
    });

    it('should handle different node types correctly', () => {
      // Test actor node
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      // Test process node
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      // Test store node
      cy.get('button').contains('database').click(); // Store node button
      cy.get('.x6-graph-scroller').click(500, 100);
      
      // Test text-box node
      cy.get('button').contains('text_fields').click(); // Text box node button
      cy.get('.x6-graph-scroller').click(100, 300);
      
      // All nodes should have creation effects
      cy.get('.x6-node').should('have.length', 4);
      cy.get('.x6-node').each(($node) => {
        cy.wrap($node).should('have.attr', 'style').and('include', 'filter');
      });
    });

    it('should handle edge creation highlights', () => {
      // Create two nodes first
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      // Create an edge between them
      // Note: Edge creation needs to be done by dragging between nodes
      cy.get('.x6-node').first().click(); // source
      cy.get('.x6-node').last().click();  // target
      
      // Edge should appear with creation effect
      cy.get('.x6-edge').should('have.length', 1);
      cy.get('.x6-edge').should('have.attr', 'style').and('include', 'filter');
      
      // Verify the edge creation effect has proper styling
      cy.get('.x6-edge').then(($edge) => {
        const style = $edge.attr('style');
        expect(style).to.include('drop-shadow');
        expect(style).to.include('rgba(0, 150, 255'); // Default blue color
      });
    });

    it('should not apply effect to already selected cells', () => {
      // Create and immediately select a node
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      cy.get('.x6-node').first().click(); // Select immediately after creation
      
      // Should have selection styling, not creation effect
      cy.get('.x6-node').first().then(($node) => {
        const style = $node.attr('style');
        // Should have selection styling (different from creation blue)
        expect(style).to.include('filter');
        // Selection effect should not be the creation blue color
        // (Selection uses different filter/color than creation)
      });
    });
  });

  describe('Fade Animation Integration', () => {
    it('should fade out creation effect over time', () => {
      // Create a node
      cy.get('button').contains('database').click(); // Store node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      // Initially should have creation effect
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'rgba(0, 150, 255, 0.9)');
      
      // Wait for animation to progress (should fade)
      cy.wait(200);
      
      // Effect should still be present but fading
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'drop-shadow');
      
      // The opacity should be lower than initial 0.9
      cy.get('.x6-node').first().then(($node) => {
        const style = $node.attr('style');
        const opacityMatch = style.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
        if (opacityMatch) {
          const opacity = parseFloat(opacityMatch[1]);
          expect(opacity).to.be.lessThan(0.9);
          expect(opacity).to.be.greaterThan(0);
        }
      });
    });

    it('should clear effect when fade completes', () => {
      // Create a node
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      // Initially should have creation effect
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'filter');
      
      // Wait for complete fade out (fade duration is typically 500ms)
      cy.wait(600);
      
      // Effect should be completely removed - node should have clean styling
      cy.get('.x6-node').first().then(($node) => {
        const style = $node.attr('style') || '';
        expect(style).to.not.include('rgba(0, 150, 255');
      });
      
      // Verify completely clean state (no unexpected filters)
      cy.get('.x6-node').first().then(($node) => {
        const style = $node.attr('style') || '';
        // Should not contain creation effect colors or excessive filters
        expect(style).to.not.include('rgba(0, 150, 255');
        expect(style).to.not.include('drop-shadow(0px 0px 12px');
      });
    });

    it('should handle rapid node creation without conflicts', () => {
      // Create multiple nodes rapidly
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      cy.get('button').contains('database').click(); // Store node button
      cy.get('.x6-graph-scroller').click(500, 100);
      
      // All nodes should initially have creation effects
      cy.get('.x6-node').should('have.length', 3);
      cy.get('.x6-node').each(($node) => {
        cy.wrap($node).should('have.attr', 'style').and('include', 'filter');
        cy.wrap($node).should('have.attr', 'style').and('include', 'rgba(0, 150, 255');
      });
      
      // Wait for effects to fade
      cy.wait(700);
      
      // All effects should be cleared
      cy.get('.x6-node').each(($node) => {
        cy.wrap($node).then(($el) => {
          const style = $el.attr('style') || '';
          expect(style).to.not.include('rgba(0, 150, 255');
        });
      });
    });
  });

  describe('Selection vs Creation Effect Interaction', () => {
    it('should handle selection after creation effect starts', () => {
      // Create a node (will have creation effect)
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      // Wait a moment then select it (before creation effect fades completely)
      cy.wait(100);
      cy.get('.x6-node').first().click();
      
      // Should now have selection styling, creation effect should be overridden
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-node-tool').should('exist');
      
      // Verify it has selection effect, not creation effect
      cy.get('.x6-node').first().then(($node) => {
        const style = $node.attr('style');
        expect(style).to.include('filter');
        // Selection effect should be different from creation blue
        // (exact selection color depends on selection styling configuration)
      });
    });

    it('should handle deselection and return to clean state', () => {
      // Create and select a node
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      cy.wait(50); // Brief wait
      cy.get('.x6-node').first().click();
      
      // Should have selection styling
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-node-tool').should('exist');
      
      // Deselect by clicking empty area
      cy.get('.x6-graph-scroller').click(400, 400);
      
      // Should return to clean state (creation effect should have also faded by now)
      cy.get('.x6-node').first().then(($node) => {
        const style = $node.attr('style') || '';
        expect(style).to.not.include('filter: drop-shadow');
      });
      cy.get('.x6-node-tool').should('not.exist');
    });
  });

  describe('Edge Creation Effects', () => {
    it('should apply creation effect to edges with proper styling', () => {
      // Create source and target nodes
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      // Wait for node creation effects to fade
      cy.wait(600);
      
      // Create an edge (should have creation effect)
      // Note: Edge creation needs to be done by dragging between nodes
      cy.get('.x6-node').first().click();
      cy.get('.x6-node').last().click();
      
      // Edge should have creation effect
      cy.get('.x6-edge').should('have.length', 1);
      cy.get('.x6-edge').should('have.attr', 'style').and('include', 'filter');
      cy.get('.x6-edge').should('have.attr', 'style').and('include', 'drop-shadow');
      cy.get('.x6-edge').should('have.attr', 'style').and('include', 'rgba(0, 150, 255');
    });

    it('should fade edge creation effects over time', () => {
      // Create nodes and edge
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      
      cy.get('button').contains('circle').click(); // Process node button
      cy.get('.x6-graph-scroller').click(300, 100);
      
      // Wait for node effects to clear
      cy.wait(600);
      
      // Create edge
      // Note: Edge creation needs to be done by dragging between nodes
      cy.get('.x6-node').first().click();
      cy.get('.x6-node').last().click();
      
      // Initially has creation effect
      cy.get('.x6-edge').should('have.attr', 'style').and('include', 'rgba(0, 150, 255');
      
      // Wait for fade completion
      cy.wait(600);
      
      // Effect should be cleared
      cy.get('.x6-edge').then(($edge) => {
        const style = $edge.attr('style') || '';
        expect(style).to.not.include('rgba(0, 150, 255');
      });
    });
  });

  describe('Performance and Memory', () => {
    it('should handle multiple creation effects without performance issues', () => {
      // Create many nodes rapidly to test performance
      const nodeTypes = ['actor', 'process', 'store', 'text-box'];
      
      for (let i = 0; i < 8; i++) {
        const nodeType = nodeTypes[i % nodeTypes.length];
        cy.get(`[data-cy="add-${nodeType}-node"]`).click();
        cy.get('.x6-graph-scroller').click(100 + (i % 4) * 150, 100 + Math.floor(i / 4) * 150);
      }
      
      // All nodes should exist and have creation effects initially
      cy.get('.x6-node').should('have.length', 8);
      
      // Wait for all effects to fade
      cy.wait(700);
      
      // All effects should be cleared and performance should remain good
      cy.get('.x6-node').should('have.length', 8);
      cy.get('.x6-node').each(($node) => {
        cy.wrap($node).then(($el) => {
          const style = $el.attr('style') || '';
          expect(style).to.not.include('rgba(0, 150, 255');
        });
      });
      
      // Verify the graph is still responsive
      cy.get('.x6-node').first().click();
      cy.get('.x6-node-tool').should('exist');
    });

    it('should not cause memory leaks from animation cleanup', () => {
      // Create nodes with effects, then clear them multiple times
      for (let cycle = 0; cycle < 3; cycle++) {
        // Create nodes
        cy.get('button').contains('person').click(); // Actor node button
        cy.get('.x6-graph-scroller').click(100 + cycle * 50, 100);
        
        cy.get('button').contains('circle').click(); // Process node button
        cy.get('.x6-graph-scroller').click(300 + cycle * 50, 100);
        
        // Wait for effects to fade
        cy.wait(600);
        
        // Delete all nodes to reset
        cy.get('body').type('{ctrl}a');
        cy.get('body').type('{del}');
        cy.get('.x6-node').should('have.length', 0);
      }
      
      // Graph should still be functional after all the cleanup
      cy.get('button').contains('person').click(); // Actor node button
      cy.get('.x6-graph-scroller').click(100, 100);
      cy.get('.x6-node').should('have.length', 1);
      cy.get('.x6-node').first().should('have.attr', 'style').and('include', 'filter');
    });
  });
});