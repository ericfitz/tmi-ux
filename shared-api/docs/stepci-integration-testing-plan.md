# StepCI Integration Testing Plan for TMI API

## Overview

This document outlines a comprehensive integration testing strategy using StepCI for the TMI (Threat Modeling Interface) API. The plan covers all 87+ REST endpoints with both success and failure scenarios to ensure API robustness and proper error handling.

## Project Structure

```
stepci/
├── workflow.yml                   # Existing - basic setup
├── auth/
│   ├── oauth-flow.yml            # Complete OAuth authentication flow
│   ├── token-management.yml      # JWT token lifecycle management
│   ├── user-operations.yml       # User info and logout operations
│   └── auth-failures.yml         # Authentication failure scenarios
├── threat-models/
│   ├── crud-operations.yml       # Standard CRUD lifecycle
│   ├── bulk-operations.yml       # Bulk create/update operations
│   ├── metadata-operations.yml   # Extensible metadata CRUD
│   ├── search-filtering.yml      # Search, filter, pagination
│   └── validation-failures.yml   # Input validation and error cases
├── threats/
│   ├── crud-operations.yml       # Threat CRUD within threat models
│   ├── bulk-operations.yml       # Bulk threat operations
│   ├── batch-operations.yml      # Batch patch/delete operations
│   └── validation-failures.yml   # Threat-specific validation errors
├── diagrams/
│   ├── crud-operations.yml       # Diagram lifecycle management
│   ├── collaboration.yml         # Collaboration session management
│   ├── metadata-operations.yml   # Diagram metadata CRUD
│   └── validation-failures.yml   # Diagram validation and errors
├── documents/
│   ├── crud-operations.yml       # Document CRUD within threat models
│   ├── bulk-operations.yml       # Bulk document operations
│   └── validation-failures.yml   # Document validation errors
├── sources/
│   ├── crud-operations.yml       # Source CRUD within threat models
│   ├── bulk-operations.yml       # Bulk source operations
│   └── validation-failures.yml   # Source validation errors
├── integration/
│   ├── full-workflow.yml         # End-to-end user journeys
│   ├── cross-entity-tests.yml    # Inter-entity relationship testing
│   ├── rbac-permissions.yml      # Role-based access control
│   └── error-handling.yml        # Comprehensive error response testing
└── utils/
    ├── common-variables.yml      # Shared configuration and variables
    ├── test-data.yml             # Test fixtures and sample data
    └── cleanup.yml               # Test environment cleanup
```

## Test Categories

### 1. Authentication Tests (`auth/`)

#### Success Cases (`oauth-flow.yml`, `token-management.yml`, `user-operations.yml`):

- **OAuth Flow**: `GET /oauth2/providers` → `GET /oauth2/authorize?idp={provider}` → `GET /oauth2/callback` → `POST /oauth2/token?idp={provider}`
- **Token Management**: `POST /oauth2/refresh` with valid refresh tokens
- **User Operations**: `GET /oauth2/me`, `POST /oauth2/logout` with valid JWT
- **State Parameter**: OAuth state parameter validation and security

#### Failure Cases (`auth-failures.yml`):

- **Invalid Providers**: Non-existent OAuth provider IDs
- **Malformed Tokens**: Invalid JWT formats, expired tokens, wrong signatures
- **Missing Headers**: Missing Authorization header, malformed Bearer tokens
- **Invalid Refresh**: Expired/invalid refresh tokens, reused refresh tokens
- **CSRF Protection**: Invalid/missing state parameters in OAuth flow

### 2. Threat Models Tests (`threat-models/`)

#### Success Cases:

- **CRUD Operations**: Complete lifecycle (create → read → update → delete)
- **Bulk Operations**: Bulk create/update where supported
- **Metadata**: Key-value metadata extensibility
- **Search & Filter**: Owner, name, description, date range filtering
- **Pagination**: Limit/offset with large datasets
- **JSON Patch**: Partial updates using RFC 6902 JSON Patch format

#### Failure Cases (`validation-failures.yml`):

- **Schema Violations**:
  - Invalid field types (string where UUID expected, etc.)
  - Missing required fields (`name`, `description`)
  - Extra/unknown fields in request payload
  - Invalid UUID formats in `id` fields
  - Invalid ISO8601 dates in timestamp fields
- **Read-Only Fields**:
  - Attempting to set `id` in creation requests
  - Setting `created_at`, `modified_at` in input
  - Modifying system-generated fields
- **Business Logic**:
  - Empty/whitespace-only names
  - Extremely long field values exceeding limits
  - Invalid ownership/permission scenarios
- **Resource Not Found**: Operations on non-existent threat model IDs
- **Permission Denied**: Reader/writer attempting owner-only operations

### 3. Threats Tests (`threats/`)

#### Success Cases:

- **CRUD Operations**: Full threat lifecycle within threat models
- **Bulk Operations**: `POST/PUT /threat_models/{id}/threats/bulk`
- **Batch Operations**: `POST .../threats/batch/patch`, `DELETE .../threats/batch`
- **Metadata Management**: Threat-specific metadata CRUD

#### Failure Cases:

- **Invalid Parent**: Creating threats in non-existent threat models
- **Schema Violations**: Invalid threat properties, missing required fields
- **Bulk Operation Limits**: Exceeding batch size limits
- **JSON Patch Errors**: Invalid patch operations, targeting non-existent fields
- **Permission Violations**: Insufficient access to modify threats

### 4. Diagrams Tests (`diagrams/`)

#### Success Cases (`crud-operations.yml`, `collaboration.yml`):

- **CRUD Operations**: Diagram lifecycle within threat models
- **Collaboration Session Management**:
  - `GET .../collaborate` - Check current session status
  - `POST .../collaborate` - Create new collaboration session
  - `PUT .../collaborate` - Join existing collaboration session
  - `DELETE .../collaborate` - End collaboration session
- **Node/Edge Management**: Complex diagram structure validation
- **WebSocket Integration**: Real-time collaboration testing

#### Failure Cases:

- **Collaboration Conflicts**:
  - `POST .../collaborate` when session already exists (expect 409)
  - `PUT .../collaborate` when no session exists (expect 404)
- **Invalid Diagram Structure**: Malformed nodes, edges, or cells
- **Permission Violations**: Reader attempting to modify diagrams
- **Resource Constraints**: Exceeding diagram complexity limits

### 5. Documents & Sources Tests

#### Success Cases:

- **CRUD Operations**: Document/source lifecycle within threat models
- **Bulk Operations**: Bulk create/update operations
- **Metadata Management**: Document/source-specific metadata

#### Failure Cases:

- **File Validation**: Invalid file formats, sizes, or content types
- **URL Validation**: Malformed URIs, unreachable URLs
- **Duplicate Prevention**: Creating duplicate documents/sources
- **Reference Integrity**: Broken relationships to threat models

### 6. Integration Tests (`integration/`)

#### Full Workflow Testing (`full-workflow.yml`):

- **Complete User Journey**: Login → Create TM → Add Threats → Create Diagram → Collaborate → Cleanup
- **Multi-User Scenarios**: Multiple users collaborating on same resources
- **Resource Cascading**: Proper cleanup when deleting parent resources

#### Cross-Entity Testing (`cross-entity-tests.yml`):

- **Relationship Integrity**: Threats ↔ Threat Models ↔ Diagrams relationships
- **Metadata Consistency**: Metadata inheritance and scoping
- **Bulk Operations**: Cross-entity bulk operations and transaction integrity

#### RBAC Testing (`rbac-permissions.yml`):

- **Role-Based Access**: Reader/Writer/Owner permission validation
- **Resource Ownership**: Owner-only operations (delete, permission changes)
- **Inheritance Testing**: Permission inheritance in nested resources

## API Hardening - Comprehensive Failure Testing

### Input Validation Categories

#### 1. Schema Violation Tests

For every request schema, test:

- **Type Mismatches**:
  - String where UUID expected: `"id": "not-a-uuid"`
  - Number where string expected: `"name": 12345`
  - Array where object expected: `"metadata": []`
- **Missing Required Fields**:
  - Omit required fields like `name`, `description`
  - Test each required field individually
- **Unknown Fields**:
  - Add fields not in schema: `"unknown_field": "value"`
  - Test server ignores or rejects extra fields
- **Format Violations**:
  - Invalid UUID formats: `"id": "123-456"`
  - Malformed dates: `"created_at": "not-a-date"`
  - Invalid URIs: `"url": "not://valid"`

#### 2. Constraint Violation Tests

- **String Length Limits**:
  - Empty strings where content required: `"name": ""`
  - Exceeding maximum length: 1000+ character names
  - Null values in required fields: `"name": null`
- **Number Range Validation**:
  - Negative values where positive expected
  - Values exceeding defined ranges
  - Floating point where integer expected
- **Enum Validation**:
  - Invalid enum values: `"role": "invalid_role"`
  - Case sensitivity: `"role": "READER"` vs `"reader"`

#### 3. Read-Only Field Tests

Test attempting to set these fields in input:

- **System Fields**: `id`, `created_at`, `modified_at`
- **Computed Fields**: `participant_count`, `threat_count`
- **Relationship Fields**: Auto-generated relationship IDs

#### 4. Business Logic Validation

- **Resource State Conflicts**:
  - Creating collaboration session when one exists
  - Deleting resources with dependent entities
- **Permission Boundaries**:
  - Reader attempting write operations
  - Non-owner attempting ownership transfer
- **Data Integrity**:
  - Circular references in hierarchical data
  - Invalid foreign key references

#### 5. Edge Case Testing

- **Boundary Conditions**:
  - Maximum allowed entities (threats per model, etc.)
  - Minimum required data for operations
- **Special Characters**:
  - Unicode characters in text fields
  - SQL injection patterns (should be safely handled)
  - XSS patterns in user input
- **Large Payload Testing**:
  - Maximum request size limits
  - Bulk operation size limits
  - Complex nested object structures

### Error Response Validation

#### Expected Error Codes and Responses:

- **400 Bad Request**: Schema validation errors, malformed input
- **401 Unauthorized**: Missing/invalid authentication tokens
- **403 Forbidden**: Insufficient permissions for operation
- **404 Not Found**: Resource doesn't exist
- **409 Conflict**: Resource state conflicts (collaboration sessions)
- **422 Unprocessable Entity**: JSON Patch operation errors
- **500 Internal Server Error**: Unexpected server failures

#### Error Response Schema Validation:

- Consistent error message format
- Helpful error descriptions for developers
- Proper HTTP status codes
- No sensitive information leakage

## Test Execution Strategy

### Sequential Test Phases:

1. **Setup Phase**: Authentication, test data creation
2. **Core Functionality**: Individual endpoint success cases
3. **Integration Phase**: Cross-entity and workflow testing
4. **Hardening Phase**: Comprehensive failure case testing
5. **Cleanup Phase**: Resource cleanup and teardown

### Parallel Execution:

- Independent CRUD operations can run in parallel
- Use test isolation to prevent interference
- Separate test data sets for concurrent tests

### Test Data Management:

- **Fixtures**: Predefined test data for common scenarios
- **Dynamic Data**: Generated data for scale testing
- **Cleanup**: Automated cleanup after test completion
- **Isolation**: Each test uses unique resource identifiers

## Expected Benefits

### API Robustness:

- **Input Validation**: Comprehensive validation of all input scenarios
- **Error Handling**: Consistent and helpful error responses
- **Security**: Protection against malformed/malicious input
- **Reliability**: Predictable behavior under error conditions

### Development Quality:

- **Regression Prevention**: Catch API changes that break clients
- **Documentation**: Live examples of API behavior
- **Confidence**: High confidence in API stability and correctness
- **Maintenance**: Easy to add tests for new endpoints or scenarios

### Client Development:

- **Error Handling**: Clear understanding of expected error scenarios
- **Integration**: Proven patterns for successful API integration
- **Troubleshooting**: Better error messages and debugging information

## Implementation Priority

### Phase 1 (High Priority):

1. Authentication flow testing
2. Core CRUD operations for all entities
3. Basic error handling (401, 403, 404)
4. Collaboration session management

### Phase 2 (Medium Priority):

1. Comprehensive input validation testing
2. Bulk and batch operations
3. Complex integration workflows
4. RBAC permission testing

### Phase 3 (Nice to Have):

1. Performance testing with large datasets
2. WebSocket integration testing
3. Advanced error scenarios
4. Security penetration testing

This comprehensive testing approach will significantly improve the robustness and reliability of the TMI API while providing excellent documentation of expected behavior for both success and failure scenarios.
