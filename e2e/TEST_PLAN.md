# E2E Test Plan for TMI-UX

## Overview

This document outlines the comprehensive end-to-end testing strategy for the TMI-UX application using Playwright.

## Test Categories

### 1. Authentication & Authorization
- **Login Flow**
  - Local provider authentication (mock mode)
  - OAuth provider authentication (when available)
  - Session persistence
  - Logout functionality
- **Authorization**
  - Role-based access (Owner, Writer, Reader)
  - Permission checks on different actions

### 2. Threat Model Management
- **List View**
  - Display threat models
  - Search and filter
  - Sorting
- **CRUD Operations**
  - Create new threat model
  - View threat model details
  - Update threat model metadata
  - Delete threat model
- **Permissions Management**
  - Share threat model with users
  - Modify user permissions
  - Remove user access

### 3. Data Flow Diagrams (DFD)
- **Basic Operations**
  - Create diagram
  - Rename diagram
  - Delete diagram
  - Navigate to diagram editor
- **Diagram Editor**
  - Add nodes (Actor, Process, Store, Security Boundary, Text Box)
  - Add edges between nodes
  - Select and delete elements
  - Move and resize nodes
  - Undo/redo operations
- **Styling and Properties**
  - Apply node styles
  - Edit node properties
  - Apply edge styles
  - Edit edge properties
- **Collaboration**
  - Real-time updates (WebSocket)
  - Multiple user cursors
  - Presenter mode
- **Export**
  - Export as PNG
  - Export as SVG
  - Export as JSON

### 4. Threat Analysis
- **Threat Identification**
  - View auto-generated threats
  - Add manual threats
  - Edit threat details
  - Delete threats
- **Threat Categorization**
  - STRIDE categories
  - Risk levels
  - Mitigation status

### 5. Navigation & Routing
- **Core Routes**
  - Home page
  - Threat models list
  - Threat model detail view
  - DFD editor
  - About page
  - Terms of Service
  - Privacy Policy
- **Route Guards**
  - Authentication required routes
  - Authorization checks
  - Redirect to login when unauthenticated

### 6. UI Components & Interactions
- **Material UI Components**
  - Dialogs
  - Snackbars
  - Menus
  - Buttons
  - Forms
- **Responsive Design**
  - Desktop viewport
  - Tablet viewport (optional)
  - Mobile viewport (optional)

## Test Structure

```
e2e/
├── fixtures/           # Test data and fixtures
├── helpers/           # Shared helper functions
├── pages/             # Page Object Models
└── tests/             # Test specifications
    ├── auth/
    ├── threat-models/
    ├── dfd/
    ├── navigation/
    └── smoke/
```

## Test Execution Strategy

- **Smoke Tests**: Quick validation that core functionality works
- **Feature Tests**: Comprehensive testing of specific features
- **Cross-Browser**: Run on Chromium, Firefox, and WebKit
- **Parallel Execution**: Tests run in parallel for speed
- **Mock Data**: Use local provider and mock data for deterministic tests

## Success Criteria

- All critical user paths covered
- Tests are reliable and not flaky
- Tests run in under 10 minutes
- Clear failure messages for debugging
- Cross-browser compatibility verified
