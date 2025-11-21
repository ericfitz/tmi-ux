/// <reference types="cypress" />

import { MountConfig } from 'cypress/angular';
import { DfdComponent } from './dfd.component';
import { provideHttpClient } from '@angular/common/http';
import { LoggerService } from '../../../../../core/services/logger.service';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ThreatModelService } from '../tm/services/threat-model.service';

describe('DfdComponent', () => {
  const loggerServiceStub = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  const activatedRouteStub = {
    paramMap: of({
      get: (param: string) => {
        if (param === 'id') return 'threat-model-id';
        if (param === 'dfdId') return 'diagram-id';
        return null;
      },
    }),
  };

  const threatModelServiceStub = {
    getDiagramById: () =>
      of({
        id: 'diagram-id',
        name: 'Test Diagram',
        cells: [
          {
            id: 'node1',
            value: 'Process 1',
            geometry: { x: 100, y: 100, width: 120, height: 60 },
            style: 'shape=process',
            vertex: true,
            edge: false,
          },
          {
            id: 'node2',
            value: 'Store 1',
            geometry: { x: 300, y: 100, width: 120, height: 60 },
            style: 'shape=store',
            vertex: true,
            edge: false,
          },
          {
            id: 'edge1',
            value: 'Data Flow',
            source: 'node1',
            target: 'node2',
            vertex: false,
            edge: true,
          },
        ],
      }),
  };

  const mountConfig: MountConfig<DfdComponent> = {
    providers: [
      provideHttpClient(),
      { provide: LoggerService, useValue: loggerServiceStub },
      { provide: ActivatedRoute, useValue: activatedRouteStub },
      { provide: ThreatModelService, useValue: threatModelServiceStub },
    ],
  };

  it('should display the graph with nodes and edges', () => {
    cy.mount(DfdComponent, mountConfig);

    // Wait for the graph to be initialized
    cy.get('.x6-graph-scroller').should('exist');

    // Check that the nodes are rendered
    cy.get('.x6-node').should('have.length', 2);

    // Check that the edge is rendered
    cy.get('.x6-edge').should('have.length', 1);

    // Check that the node labels are displayed
    cy.contains('Process 1').should('be.visible');
    cy.contains('Store 1').should('be.visible');
  });

  it('should select a node when clicked', () => {
    cy.mount(DfdComponent, mountConfig);

    // Wait for the graph to be initialized
    cy.get('.x6-graph-scroller').should('exist');

    // Click on the first node
    cy.get('.x6-node').first().click();

    // Check that the node is selected (has the selected class or style)
    cy.get('.x6-node').first().should('have.class', 'selected');
  });

  it('should show the toolbar with node creation tools', () => {
    cy.mount(DfdComponent, mountConfig);

    // Check that the toolbar is displayed
    cy.get('.dfd-toolbar').should('be.visible');

    // Check that the node creation tools are displayed
    cy.get('.dfd-toolbar').contains('Process').should('be.visible');
    cy.get('.dfd-toolbar').contains('Store').should('be.visible');
    cy.get('.dfd-toolbar').contains('Actor').should('be.visible');
  });

  it('should add a new node when using the toolbar', () => {
    cy.mount(DfdComponent, mountConfig);

    // Wait for the graph to be initialized
    cy.get('.x6-graph-scroller').should('exist');

    // Get the initial node count
    cy.get('.x6-node').then($nodes => {
      const initialCount = $nodes.length;

      // Click on the Process tool
      cy.get('.dfd-toolbar').contains('Process').click();

      // Click on the graph to place the node
      cy.get('.x6-graph-scroller').click(200, 200);

      // Check that a new node was added
      cy.get('.x6-node').should('have.length', initialCount + 1);
    });
  });
});
