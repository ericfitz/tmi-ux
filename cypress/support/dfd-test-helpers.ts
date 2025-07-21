/**
 * Shared helper functions for DFD integration tests
 */

/**
 * Robust navigation to DFD diagram that handles authentication and mock data
 * Based on the working simple-authentication-test pattern
 */
export function navigateToDfdDiagram() {
  // Step 1: Visit root with clean state and enable mock data + auth
  cy.visit('/', {
    onBeforeLoad: (win) => {
      win.localStorage.clear();
      win.sessionStorage.clear();
      
      // Set mock data flag
      win.localStorage.setItem('useMockData', 'true');
      
      // Set mock authentication token
      const mockAuthToken = {
        "token": "mock.jwt.token",
        "expiresIn": 3600,
        "expiresAt": new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour from now
      };
      win.localStorage.setItem('auth_token', JSON.stringify(mockAuthToken));
      
      // Set mock user profile
      const mockUserProfile = {
        "email": "user1@example.com",
        "name": "user1"
      };
      win.localStorage.setItem('user_profile', JSON.stringify(mockUserProfile));
    }
  });
  
  cy.wait(1000);
  
  // Step 2: Navigate directly to threat models page (should work with auth token)
  cy.visit('/tm');
  cy.wait(2000);
  
  // Step 3: Verify we're authenticated and on threat models page
  cy.url().should('include', '/tm');
  cy.url().should('not.include', '/login');
  
  // Step 4: Navigate to DFD diagram
  // Look for "System Authentication" threat model card and click it
  cy.get('.threat-model-card').contains('System Authentication').should('exist').click();
  cy.wait(2000);
  
  // Step 5: Click on a diagram in the diagram list to navigate to DFD
  // Click on the diagram name "System Architecture" (not the edit/delete buttons)
  cy.get('.mat-mdc-list-item-title').contains('System Architecture').should('exist').click();
  cy.wait(3000);
  
  // Step 6: Verify we're on DFD page with the expected URL pattern
  cy.url().should('include', '/tm/550e8400-e29b-41d4-a716-446655440000/dfd/123e4567-e89b-12d3-a456-426614174000');
  
  // Step 7: Verify the DFD component is present and visible
  cy.get('app-dfd', { timeout: 15000 }).should('be.visible');
  
  // Step 8: Wait for the page to load and examine what elements are actually available
  cy.wait(5000); // Give more time for the graph to initialize
  
  // Log the current page state for debugging
  cy.get('body').then(($body) => {
    cy.log('Page loaded, examining available elements...');
    cy.log(`Current URL: ${Cypress.config().baseUrl + $body[0].ownerDocument.location.pathname}`);
    
    // Check for any error messages or loading states
    const errors = $body.find('[class*="error"], .error');
    const loading = $body.find('[class*="loading"], .loading, [class*="spinner"]');
    
    cy.log(`Found ${errors.length} error elements`);
    cy.log(`Found ${loading.length} loading elements`);
    
    // Check specifically for graph-related elements
    const graphContainers = $body.find('.graph-container, .x6-graph, [class*="graph"]');
    cy.log(`Found ${graphContainers.length} graph container elements`);
    
    if (graphContainers.length > 0) {
      graphContainers.each((i, el) => {
        cy.log(`Graph container ${i}: ${el.className}`);
      });
    }
  });
  
  cy.log('Successfully navigated to DFD diagram');
}

