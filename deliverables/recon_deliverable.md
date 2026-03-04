# Reconnaissance Deliverable: TMI-UX Application

## 0) HOW TO READ THIS

This reconnaissance report provides a comprehensive map of the TMI-UX application's attack surface, with special emphasis on authorization and privilege escalation opportunities for downstream security analysis specialists.

**Key Sections for Authorization Analysis:**
- **Section 4 (API Endpoint Inventory):** Contains authorization details for each endpoint - focus on "Required Role" and "Object ID Parameters" columns to identify IDOR candidates.
- **Section 6.4 (Guards Directory):** Catalog of authorization controls - understand what each guard means before analyzing vulnerabilities.
- **Section 7 (Role & Privilege Architecture):** Complete role hierarchy and privilege mapping - use this to understand the privilege lattice and identify escalation targets.
- **Section 8 (Authorization Vulnerability Candidates):** Pre-prioritized lists of endpoints for horizontal, vertical, and context-based authorization testing.

**How to Use the Network Mapping (Section 6):** The entity/flow mapping shows system boundaries and data sensitivity levels. Pay special attention to flows marked with authorization guards and entities handling PII/sensitive data.

**Priority Order for Testing:** Start with Section 8's High-priority horizontal candidates, then vertical escalation endpoints for each role level, finally context-based workflow bypasses.

---

## 1. Executive Summary

The TMI-UX application is an **Angular 21.2-based single-page application (SPA)** serving as the user interface for the TMI (Threat Modeling Improved) platform. The application demonstrates strong security architecture with defense-in-depth practices, comprehensive authentication mechanisms, and robust data protection controls.

### Architecture Overview

The application architecture separates concerns cleanly: a minimal Express.js server (`server.js`) serves static assets and runtime configuration, while the Angular frontend communicates with a separate Go-based backend API for all business logic. This separation limits the frontend's attack surface significantly—the Express server has no business logic, database access, or user input processing beyond static file serving and environment variable injection.

### Critical Security Strengths

- **OAuth 2.0 with PKCE** (RFC 7636 compliant) and SAML 2.0 authentication
- **Client-side AES-GCM encryption** for JWT token storage  
- **DOMPurify-based XSS prevention** in markdown rendering
- **Comprehensive sensitive data redaction** in logging
- **Real-time collaboration** via authenticated WebSocket connections
- **Role-based access control (RBAC)** with admin, reviewer, and user roles
- **Three-tier permission model** for threat models (owner/writer/reader)

### High-Priority Vulnerabilities Identified

1. **CRITICAL - Missing admin route guards:** `/admin/webhooks` and `/admin/addons` routes lack `adminGuard`, allowing any authenticated user to access admin-only functionality
2. **HIGH - Weak token encryption key derivation:** Browser fingerprint components are easily enumerable, providing insufficient protection for localStorage-stored encrypted tokens
3. **MEDIUM - Relaxed OAuth state validation:** State parameter validation is skipped when access tokens are present in callbacks
4. **MEDIUM - Backend SSRF risk:** Webhook test functionality triggers server-side requests with user-controlled URLs (requires backend validation)

### Attack Surface Summary

The application's most critical attack surfaces are the **130+ backend API endpoints** (documented via OpenAPI schema), the **WebSocket collaboration endpoint**, and **OAuth/SAML authentication flows**. The frontend itself is a client-side application with no server-side request functionality, eliminating traditional SSRF vulnerabilities at the frontend layer.

---

## 2. Technology & Service Map

### Frontend Framework & Language

**Primary Technology Stack:**
- **Framework:** Angular 21.2.0 (latest stable release)
- **Language:** TypeScript 5.9.3 with strict compilation enabled
- **Runtime:** Node.js 22.x LTS
- **Package Manager:** pnpm 10.30.1
- **Build System:** Angular CLI with Vite integration for development

**TypeScript Configuration:**
- Strict mode enabled: `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`
- Path aliases: `@app/*` → `src/app/*` for cleaner imports and potential path traversal prevention

### Backend Integration

**Server Component:**
- **File:** `/app/repos/tmi-ux/server.js`
- **Technology:** Express.js 5.2.1
- **Purpose:** Serves compiled Angular SPA and runtime configuration endpoint
- **Port:** 8080 (production), 4200 (development)
- **Security Feature:** express-rate-limit 8.2.1 (1000 requests per 15 minutes per IP)

**Backend API:**
- **Technology:** Go-based microservice (not in this codebase)
- **Location:** Separate service at configurable API URL
- **Endpoints:** 130+ REST API endpoints
- **Schema:** OpenAPI specification with TypeScript types generated for frontend

### Infrastructure & Deployment

**Identified Subdomains:** None discovered (single-domain application)

**Open Ports & Services:**
- **Port 3000/8080:** Express.js serving Angular SPA (not currently running in test environment)
- **WebSocket:** Collaboration endpoint (wss:// in production)

**Deployment Targets:**
- Standard Docker (Dockerfile)
- Chainguard base images (Dockerfile.chainguard)
- OCI-compliant containers (Dockerfile.oci)
- Cloud platforms: Heroku, OCI registries

---

## 3. Authentication & Session Management Flow

### Entry Points

| Entry Point | Purpose | Authentication Method |
|-------------|---------|----------------------|
| `/login` | Primary login page | OAuth 2.0 + PKCE or SAML 2.0 |
| `/oauth2/callback` | OAuth callback handler | Server-side token exchange |
| `/saml/acs` | SAML assertion consumer (backend) | Server-side SAML validation |

### Authentication Mechanism

**OAuth 2.0 with PKCE Flow:**

1. **Provider Discovery:** Frontend fetches available OAuth providers from `GET /oauth2/providers`
2. **PKCE Generation:** 
   - Code verifier: 256-bit CSPRNG value (32 bytes)
   - Code challenge: SHA-256(verifier) base64url-encoded
   - Challenge method: S256
3. **Authorization Request:** Browser redirects to provider with state parameter (CSRF token) and code_challenge
4. **Callback Handling:** 
   - Validate state parameter (CSRF protection)
   - Exchange authorization code for JWT tokens: `POST /oauth2/token` with code_verifier
5. **Token Storage:** 
   - JWT access token + refresh token encrypted with AES-GCM
   - Stored in localStorage (key: `auth_token`)
   - User profile encrypted and stored separately (key: `user_profile`)

**SAML 2.0 Flow:**

1. **Provider Discovery:** Frontend fetches SAML providers from `GET /saml/providers`
2. **SSO Initiation:** Browser redirects to SAML IdP with client callback URL
3. **Assertion Processing:** Backend handles SAML assertion validation
4. **Token Issuance:** Backend returns JWT tokens (same as OAuth flow)

**Code Pointers:**
- Primary auth service: `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (2,047 lines)
- PKCE implementation: `/app/repos/tmi-ux/src/app/auth/services/pkce.service.ts`
- PKCE crypto utilities: `/app/repos/tmi-ux/src/app/auth/utils/pkce-crypto.utils.ts`
- Session manager: `/app/repos/tmi-ux/src/app/auth/services/session-manager.service.ts`

### 3.1 Role Assignment Process

**Role Determination:**
- Roles are embedded in JWT claims by the backend authentication server
- JWT claim `tmi_is_administrator` → Profile field `is_admin`
- JWT claim `tmi_is_security_reviewer` → Profile field `is_security_reviewer`

**Default Role:**
- New users default to **Authenticated User** (non-admin, non-reviewer)
- Both role flags default to `false` if not present in JWT

**Role Upgrade Path:**
- Backend-controlled (not exposed in frontend code)
- Assumed to be via administrative action or external identity provider group membership

**Code Implementation:**
- JWT parsing: `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` lines 1340-1349
- Role extraction: Lines 1347-1348

### 3.2 Privilege Storage & Validation

**Storage Location:**
- **JWT Claims:** `tmi_is_administrator`, `tmi_is_security_reviewer` in JWT payload
- **User Profile:** `is_admin`, `is_security_reviewer` in encrypted localStorage object
- **In-Memory:** `userProfileSubject` observable for reactive updates

**Validation Points:**
- **Route Guards:** `adminGuard`, `reviewerGuard` validate roles before route activation
- **HTTP Interceptor:** `jwtInterceptor` injects Bearer token in API requests
- **Component-Level:** Inline checks using `authService.isAdmin` and `authService.isSecurityReviewer`

**Cache/Session Persistence:**
- Roles cached in localStorage (encrypted) until logout
- Refreshed on every `GET /me` call (triggered by guards)
- Token refresh maintains role claims (server-issued)

**Code Pointers:**
- Admin guard: `/app/repos/tmi-ux/src/app/auth/guards/admin.guard.ts`
- Reviewer guard: `/app/repos/tmi-ux/src/app/auth/guards/reviewer.guard.ts`
- JWT interceptor: `/app/repos/tmi-ux/src/app/auth/interceptors/jwt.interceptor.ts`

### 3.3 Role Switching & Impersonation

**Impersonation Features:** None discovered in frontend code

**Role Switching:** None discovered in frontend code

**Audit Trail:** Not applicable (no impersonation features found)

**Code Implementation:** N/A

---

## 4. API Endpoint Inventory

**Network Surface Focus:** The following endpoints are accessible through the deployed web application's network interface. This excludes development/debug endpoints, local-only utilities, and build tools.

### Authentication Endpoints

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/oauth2/providers` | anon | None | None | List OAuth providers. `auth.service.ts:541` |
| GET | `/saml/providers` | anon | None | None | List SAML providers. `auth.service.ts:587` |
| POST | `/oauth2/token` | anon | None | None | Token exchange with PKCE. `auth.service.ts:1178` |
| POST | `/oauth2/refresh` | user | None | Bearer Token | Refresh access token. `auth.service.ts:1732` |
| GET | `/me` | user | None | Bearer Token | Current user profile. `auth.service.ts:1364` |
| POST | `/me/logout` | user | None | Bearer Token | Logout current session. `auth.service.ts:1896` |

### User Management Endpoints

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| DELETE | `/users/me` | user | None | Bearer Token + challenge | Account deletion (2-step). `user.service.ts:58,68` |
| POST | `/me/transfer` | user | None | Bearer Token | Transfer owned resources. `user.service.ts:76` |
| GET | `/me/preferences` | user | None | Bearer Token | Get user preferences. `user-preferences.service.ts:236` |
| PUT | `/me/preferences` | user | None | Bearer Token | Update preferences. `user-preferences.service.ts:271` |
| GET | `/me/client_credentials` | user | None | Bearer Token | List API credentials. `client-credential.service.ts:30` |
| POST | `/me/client_credentials` | user | None | Bearer Token | Create API credential. `client-credential.service.ts:48` |
| DELETE | `/me/client_credentials/{id}` | user | credential_id | Bearer Token + ownership | Delete API credential. `client-credential.service.ts:67` |
| GET | `/me/groups/{groupUuid}/members` | user | groupUuid | Bearer Token + membership | List group members. `user-group.service.ts:41` |

### Threat Model Endpoints (Core CRUD)

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/threat_models` | user | None | Bearer Token | List accessible threat models. `threat-model.service.ts:165` |
| GET | `/threat_models/{id}` | user | threat_model_id | Bearer Token + (reader\|writer\|owner) | Get threat model details. `threat-model.service.ts:231` |
| POST | `/threat_models` | user | None | Bearer Token | Create threat model (current user = owner). `threat-model.service.ts:472` |
| PUT | `/threat_models/{id}` | user | threat_model_id | Bearer Token + (writer\|owner) | Update threat model. `threat-model.service.ts:674` |
| PATCH | `/threat_models/{id}` | user | threat_model_id | Bearer Token + (writer\|owner) | Partial update (JSON Patch). `threat-model.service.ts:731` |
| DELETE | `/threat_models/{id}` | user | threat_model_id | Bearer Token + owner | Delete threat model. `threat-model.service.ts:809` |

### Threat Model Children (Diagrams, Threats, Documents, etc.)

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/threat_models/{tmId}/diagrams` | user | threat_model_id | Inherited from TM | List diagrams. `threat-model.service.ts:344` |
| GET | `/threat_models/{tmId}/diagrams/{dId}` | user | threat_model_id, diagram_id | Inherited from TM | Get diagram. `threat-model.service.ts:366` |
| POST | `/threat_models/{tmId}/diagrams` | user | threat_model_id | Inherited from TM (writer\|owner) | Create diagram. `threat-model.service.ts:1148` |
| PUT | `/threat_models/{tmId}/diagrams/{dId}` | user | threat_model_id, diagram_id | Inherited from TM (writer\|owner) | Update diagram. `threat-model.service.ts:1175` |
| PATCH | `/threat_models/{tmId}/diagrams/{dId}` | user | threat_model_id, diagram_id | Inherited from TM (writer\|owner) | Partial diagram update. `threat-model.service.ts:1213` |
| DELETE | `/threat_models/{tmId}/diagrams/{dId}` | user | threat_model_id, diagram_id | Inherited from TM (writer\|owner) | Delete diagram. `threat-model.service.ts:1325` |
| GET | `/threat_models/{tmId}/diagrams/{dId}/model` | user | threat_model_id, diagram_id | Inherited from TM | Export diagram (JSON/YAML/GraphML). `threat-model.service.ts:1409` |
| POST | `/threat_models/{tmId}/diagrams/{dId}/collaborate` | user | threat_model_id, diagram_id | Inherited from TM | Start collaboration session. `threat-model.service.ts:1829` |
| GET | `/threat_models/{tmId}/diagrams/{dId}/collaborate` | user | threat_model_id, diagram_id | Inherited from TM | Get collaboration session. `threat-model.service.ts:1911` |
| DELETE | `/threat_models/{tmId}/diagrams/{dId}/collaborate` | user | threat_model_id, diagram_id | Inherited from TM | End collaboration. `threat-model.service.ts:1883` |
| GET | `/threat_models/{tmId}/threats` | user | threat_model_id | Inherited from TM | List threats. `threat-model.service.ts:909` |
| POST | `/threat_models/{tmId}/threats` | user | threat_model_id | Inherited from TM (writer\|owner) | Create threat. `threat-model.service.ts:933` |
| PUT | `/threat_models/{tmId}/threats/{tId}` | user | threat_model_id, threat_id | Inherited from TM (writer\|owner) | Update threat. `threat-model.service.ts:969` |
| DELETE | `/threat_models/{tmId}/threats/{tId}` | user | threat_model_id, threat_id | Inherited from TM (writer\|owner) | Delete threat. `threat-model.service.ts:994` |
| GET | `/threat_models/{tmId}/documents` | user | threat_model_id | Inherited from TM | List documents. `threat-model.service.ts:388` |
| POST | `/threat_models/{tmId}/documents` | user | threat_model_id | Inherited from TM (writer\|owner) | Create document. `threat-model.service.ts:1022` |
| PUT | `/threat_models/{tmId}/documents/{dId}` | user | threat_model_id, document_id | Inherited from TM (writer\|owner) | Update document. `threat-model.service.ts:1047` |
| DELETE | `/threat_models/{tmId}/documents/{dId}` | user | threat_model_id, document_id | Inherited from TM (writer\|owner) | Delete document. `threat-model.service.ts:1062` |
| GET | `/threat_models/{tmId}/repositories` | user | threat_model_id | Inherited from TM | List repositories. `threat-model.service.ts:413` |
| POST | `/threat_models/{tmId}/repositories` | user | threat_model_id | Inherited from TM (writer\|owner) | Create repository. `threat-model.service.ts:1082` |
| PUT | `/threat_models/{tmId}/repositories/{rId}` | user | threat_model_id, repository_id | Inherited from TM (writer\|owner) | Update repository. `threat-model.service.ts:1111` |
| DELETE | `/threat_models/{tmId}/repositories/{rId}` | user | threat_model_id, repository_id | Inherited from TM (writer\|owner) | Delete repository. `threat-model.service.ts:1127` |
| GET | `/threat_models/{tmId}/notes` | user | threat_model_id | Inherited from TM | List notes. `threat-model.service.ts:437` |
| GET | `/threat_models/{tmId}/notes/{nId}` | user | threat_model_id, note_id | Inherited from TM | Get note. `threat-model.service.ts:1566` |
| POST | `/threat_models/{tmId}/notes` | user | threat_model_id | Inherited from TM (writer\|owner) | Create note. `threat-model.service.ts:1551` |
| PUT | `/threat_models/{tmId}/notes/{nId}` | user | threat_model_id, note_id | Inherited from TM (writer\|owner) | Update note. `threat-model.service.ts:1585` |
| DELETE | `/threat_models/{tmId}/notes/{nId}` | user | threat_model_id, note_id | Inherited from TM (writer\|owner) | Delete note. `threat-model.service.ts:1600` |
| GET | `/threat_models/{tmId}/assets` | user | threat_model_id | Inherited from TM | List assets. `threat-model.service.ts:1656` |
| POST | `/threat_models/{tmId}/assets` | user | threat_model_id | Inherited from TM (writer\|owner) | Create asset. `threat-model.service.ts:1679` |
| PUT | `/threat_models/{tmId}/assets/{aId}` | user | threat_model_id, asset_id | Inherited from TM (writer\|owner) | Update asset. `threat-model.service.ts:1701` |
| DELETE | `/threat_models/{tmId}/assets/{aId}` | user | threat_model_id, asset_id | Inherited from TM (writer\|owner) | Delete asset. `threat-model.service.ts:1716` |

### Metadata Endpoints (Bulk Operations)

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/threat_models/{tmId}/metadata` | user | threat_model_id | Inherited from TM | Get TM metadata. `threat-model.service.ts:1338` |
| PUT | `/threat_models/{tmId}/metadata/bulk` | user | threat_model_id | Inherited from TM (writer\|owner) | Bulk update TM metadata. `threat-model.service.ts:1353` |
| GET | `/threat_models/{tmId}/diagrams/{dId}/metadata` | user | threat_model_id, diagram_id | Inherited from TM | Get diagram metadata. `threat-model.service.ts:1367` |
| PUT | `/threat_models/{tmId}/diagrams/{dId}/metadata/bulk` | user | threat_model_id, diagram_id | Inherited from TM (writer\|owner) | Bulk update diagram metadata. `threat-model.service.ts:1386` |
| GET | `/threat_models/{tmId}/threats/{tId}/metadata` | user | threat_model_id, threat_id | Inherited from TM | Get threat metadata. `threat-model.service.ts:1443` |
| PUT | `/threat_models/{tmId}/threats/{tId}/metadata/bulk` | user | threat_model_id, threat_id | Inherited from TM (writer\|owner) | Bulk update threat metadata. `threat-model.service.ts:1463` |

*Note: Similar metadata endpoints exist for documents, repositories, notes, and assets.*

### Survey Endpoints

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/admin/surveys` | admin | None | Bearer Token + adminGuard | List all surveys. `survey.service.ts:39` |
| GET | `/intake/surveys` | user | None | Bearer Token | List active surveys. `survey.service.ts:58` |
| GET | `/intake/surveys/{surveyId}` | user | survey_id | Bearer Token | Get survey (respondent). `survey.service.ts:75` |
| GET | `/admin/surveys/{surveyId}` | admin | survey_id | Bearer Token + adminGuard | Get survey (admin). `survey.service.ts:90` |
| POST | `/admin/surveys` | admin | None | Bearer Token + adminGuard | Create survey. `survey.service.ts:115` |
| PUT | `/admin/surveys/{surveyId}` | admin | survey_id | Bearer Token + adminGuard | Update survey. `survey.service.ts:133` |
| PATCH | `/admin/surveys/{surveyId}` | admin | survey_id | Bearer Token + adminGuard | Partial update. `survey.service.ts:151` |
| DELETE | `/admin/surveys/{surveyId}` | admin | survey_id | Bearer Token + adminGuard | Delete survey. `survey.service.ts:205` |

### Survey Response Endpoints (Intake - Owner Access)

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/intake/survey_responses` | user | None | Bearer Token | List own responses. `survey-response.service.ts:45` |
| GET | `/intake/survey_responses/{responseId}` | user | response_id | Bearer Token + ownership | Get response. `survey-response.service.ts:84` |
| POST | `/intake/survey_responses` | user | None | Bearer Token | Create response. `survey-response.service.ts:122` |
| PUT | `/intake/survey_responses/{responseId}` | user | response_id | Bearer Token + ownership + status | Update response. `survey-response.service.ts:156` |
| PATCH | `/intake/survey_responses/{responseId}` | user | response_id | Bearer Token + ownership | Submit/link response. `survey-response.service.ts:175` |
| DELETE | `/intake/survey_responses/{responseId}` | user | response_id | Bearer Token + ownership + status=draft | Delete response. `survey-response.service.ts:194` |

### Survey Response Endpoints (Triage - Reviewer Access)

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/triage/survey_responses` | reviewer | None | Bearer Token + reviewerGuard | List all responses. `survey-response.service.ts:65` |
| GET | `/triage/survey_responses/{responseId}` | reviewer | response_id | Bearer Token + reviewerGuard | Get response (bypasses ownership). `survey-response.service.ts:102` |
| PATCH | `/triage/survey_responses/{responseId}` | reviewer | response_id | Bearer Token + reviewerGuard | Update status/notes. `survey-response.service.ts:220` |
| POST | `/triage/survey_responses/{responseId}/create_threat_model` | reviewer | response_id | Bearer Token + reviewerGuard | Create TM from response. `survey-response.service.ts:263` |

### Triage Note Endpoints

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/triage/survey_responses/{responseId}/triage_notes` | reviewer | response_id | Bearer Token + reviewerGuard | List triage notes. `triage-note.service.ts:30` |
| GET | `/triage/survey_responses/{responseId}/triage_notes/{noteId}` | reviewer | response_id, note_id | Bearer Token + reviewerGuard | Get triage note. `triage-note.service.ts:50` |
| POST | `/triage/survey_responses/{responseId}/triage_notes` | reviewer | response_id | Bearer Token + reviewerGuard | Create triage note. `triage-note.service.ts:70` |
| GET | `/intake/survey_responses/{responseId}/triage_notes` | user | response_id | Bearer Token + ownership | Owner reads reviewer notes. (Inferred from API types) |

### Admin User Endpoints

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/admin/users` | admin | None | Bearer Token + adminGuard | List all users. `user-admin.service.ts:31` |
| DELETE | `/admin/users/{internal_uuid}` | admin | internal_uuid | Bearer Token + adminGuard | Delete user. `user-admin.service.ts:52` |
| POST | `/admin/users/{sourceUserId}/transfer` | admin | sourceUserId | Bearer Token + adminGuard | Transfer user resources. `user-admin.service.ts:73` |

### Admin Group Endpoints

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/admin/groups` | admin | None | Bearer Token + adminGuard | List all groups. `group-admin.service.ts:38` |
| GET | `/admin/groups/{internal_uuid}` | admin | internal_uuid | Bearer Token + adminGuard | Get group. `group-admin.service.ts:57` |
| POST | `/admin/groups` | admin | None | Bearer Token + adminGuard | Create group. `group-admin.service.ts:73` |
| DELETE | `/admin/groups/{internal_uuid}` | admin | internal_uuid | Bearer Token + adminGuard | Delete group. `group-admin.service.ts:169` |
| GET | `/admin/groups/{internal_uuid}/members` | admin | internal_uuid | Bearer Token + adminGuard | List members. `group-admin.service.ts:96` |
| POST | `/admin/groups/{internal_uuid}/members` | admin | internal_uuid | Bearer Token + adminGuard | Add member. `group-admin.service.ts:118` |
| DELETE | `/admin/groups/{internal_uuid}/members/{member_uuid}` | admin | internal_uuid, member_uuid | Bearer Token + adminGuard | Remove member. `group-admin.service.ts:145` |

### Admin Settings Endpoints

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/admin/settings` | admin | None | Bearer Token + adminGuard | List settings. `settings-admin.service.ts:30` |
| GET | `/admin/settings/{key}` | admin | key | Bearer Token + adminGuard | Get setting. `settings-admin.service.ts:37` |
| PUT | `/admin/settings/{key}` | admin | key | Bearer Token + adminGuard | Update setting. `settings-admin.service.ts:44` |
| DELETE | `/admin/settings/{key}` | admin | key | Bearer Token + adminGuard | Delete setting. `settings-admin.service.ts:51` |
| POST | `/admin/settings/migrate` | admin | None | Bearer Token + adminGuard | Migrate settings. `settings-admin.service.ts:59` |

### Admin Quota Endpoints

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/admin/quotas/users/{userId}` | admin | userId | Bearer Token + adminGuard | Get user API quota. `quota.service.ts:37` |
| PUT | `/admin/quotas/users/{userId}` | admin | userId | Bearer Token + adminGuard | Update user quota. `quota.service.ts:47` |
| DELETE | `/admin/quotas/users/{userId}` | admin | userId | Bearer Token + adminGuard | Delete user quota. `quota.service.ts:54` |
| GET | `/admin/quotas/webhooks/{userId}` | admin | userId | Bearer Token + adminGuard | Get webhook quota. `quota.service.ts:61` |
| PUT | `/admin/quotas/webhooks/{userId}` | admin | userId | Bearer Token + adminGuard | Update webhook quota. `quota.service.ts:71` |
| DELETE | `/admin/quotas/webhooks/{userId}` | admin | userId | Bearer Token + adminGuard | Delete webhook quota. `quota.service.ts:78` |
| GET | `/admin/quotas/users` | admin | None | Bearer Token + adminGuard | List user quotas. `quota.service.ts:88` |
| GET | `/admin/quotas/webhooks` | admin | None | Bearer Token + adminGuard | List webhook quotas. `quota.service.ts:98` |

### Webhook Endpoints (⚠️ CRITICAL - Missing adminGuard)

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/webhooks/subscriptions` | **user** ⚠️ | None | Bearer Token **only** ⚠️ | List webhooks. `webhook.service.ts:40` |
| GET | `/webhooks/subscriptions/{id}` | **user** ⚠️ | webhook_id | Bearer Token **only** ⚠️ | Get webhook. `webhook.service.ts:47` |
| POST | `/webhooks/subscriptions` | **user** ⚠️ | None | Bearer Token **only** ⚠️ | Create webhook. `webhook.service.ts:54` |
| PUT | `/webhooks/subscriptions/{id}` | **user** ⚠️ | webhook_id | Bearer Token **only** ⚠️ | Update webhook. `webhook.service.ts:61` |
| DELETE | `/webhooks/subscriptions/{id}` | **user** ⚠️ | webhook_id | Bearer Token **only** ⚠️ | Delete webhook. `webhook.service.ts:68` |
| POST | `/webhooks/subscriptions/{id}/test` | **user** ⚠️ | webhook_id | Bearer Token **only** ⚠️ | **Test webhook (SSRF risk)**. `webhook.service.ts:75` |

**⚠️ CRITICAL VULNERABILITY:** Route `/admin/webhooks` lacks `adminGuard` - only has parent `authGuard` (Line 118-123 in `app.routes.ts`). Any authenticated user may access webhook management.

### Addon Endpoints (⚠️ CRITICAL - Missing adminGuard)

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/addons` | **user** ⚠️ | None | Bearer Token **only** ⚠️ | List addons. `addon.service.ts:46` |
| GET | `/addons/{id}` | **user** ⚠️ | addon_id | Bearer Token **only** ⚠️ | Get addon. `addon.service.ts:53` |
| POST | `/addons` | **user** ⚠️ | None | Bearer Token **only** ⚠️ | Create addon. `addon.service.ts:60` |
| PUT | `/addons/{id}` | **user** ⚠️ | addon_id | Bearer Token **only** ⚠️ | Update addon. `addon.service.ts:67` |
| DELETE | `/addons/{id}` | **user** ⚠️ | addon_id | Bearer Token **only** ⚠️ | Delete addon. `addon.service.ts:74` |
| POST | `/addons/{id}/invoke` | **user** ⚠️ | addon_id | Bearer Token **only** ⚠️ | Invoke addon. `addon.service.ts:86` |

**⚠️ CRITICAL VULNERABILITY:** Route `/admin/addons` lacks `adminGuard` - only has parent `authGuard` (Line 125-130 in `app.routes.ts`). Any authenticated user may access addon management.

### Team & Project Endpoints

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/teams` | user | None | Bearer Token | List accessible teams. `team.service.ts:34` |
| POST | `/teams` | user | None | Bearer Token | Create team. `team.service.ts:53` |
| GET | `/teams/{team_id}` | user | team_id | Bearer Token + access validation | Get team. (Inferred) |
| PUT | `/teams/{team_id}` | user | team_id | Bearer Token + ownership | Update team. (Inferred) |
| DELETE | `/teams/{team_id}` | user | team_id | Bearer Token + (ownership\|admin) | Delete team. (Inferred) |
| GET | `/projects` | user | None | Bearer Token | List accessible projects. `project.service.ts:39` |
| POST | `/projects` | user | None | Bearer Token | Create project. `project.service.ts:59` |
| GET | `/projects/{project_id}` | user | project_id | Bearer Token + access validation | Get project. (Inferred) |
| PUT | `/projects/{project_id}` | user | project_id | Bearer Token + ownership | Update project. (Inferred) |
| DELETE | `/projects/{project_id}` | user | project_id | Bearer Token + (ownership\|admin) | Delete project. (Inferred) |

### Public/Configuration Endpoints

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
|--------|---------------|---------------|----------------------|------------------------|---------------------------|
| GET | `/config` | anon | None | None | Server branding/UI config. `branding-config.service.ts:135` |
| GET | `/` | anon | None | None | Health check. `server-connection.service.ts:359` |

---

## 5. Potential Input Vectors for Vulnerability Analysis

**Network Surface Focus:** Only input vectors accessible through the target web application's network interface are included. Local-only scripts, build tools, and development utilities are excluded.

### URL Parameters

| Parameter Name | Endpoint Pattern | Data Type | Validation | Purpose | File Location |
|---------------|------------------|-----------|------------|---------|---------------|
| `returnUrl` | `/login`, OAuth callbacks | string | None | Post-login redirect | `auth.service.ts:755, login.component.ts:66` |
| `reason` | `/login` | string | None | Session expiry tracking | `login.component.ts:73` |
| `limit`, `offset` | All list endpoints | number | Type constraint | Pagination | Multiple service files |
| `name`, `description`, `status` | `/threat_models`, `/admin/surveys` | string | None | Search filters | `threat-model.service.ts:143-163` |
| `created_after`, `created_before` | `/threat_models` | string (ISO date) | None | Date filtering | `threat-model.service.ts:148-151` |
| `format` | `/threat_models/{id}/diagrams/{id}/model` | string (json\|yaml\|graphml) | Enum | Export format | `threat-model.service.ts:1409` |
| `token` | WebSocket connection URL | string (JWT) | Backend validates | WebSocket authentication | `websocket.adapter.ts:224-246` |

### POST Body Fields (JSON)

**Authentication:**
| Field Name | Endpoint | Data Type | Validation | Purpose | File Location |
|-----------|----------|-----------|------------|---------|---------------|
| `grant_type` | `/oauth2/token` | string | Enum | OAuth grant type | `auth.service.ts:1136` |
| `code` | `/oauth2/token` | string | None | OAuth authorization code | `auth.service.ts:1138` |
| `code_verifier` | `/oauth2/token` | string | PKCE validation | PKCE verifier | `auth.service.ts:1139` |
| `redirect_uri` | `/oauth2/token` | string | None | Callback URL | `auth.service.ts:1141` |
| `refresh_token` | `/oauth2/refresh` | string | None | Refresh token | `auth.service.ts:1718` |

**Threat Models:**
| Field Name | Endpoint | Data Type | Validation | Purpose | File Location |
|-----------|----------|-----------|------------|---------|---------------|
| `name` | `/threat_models` (POST/PUT) | string | Required, MaxLength(256) | TM name | `create-threat-model-dialog.component.ts:134` |
| `description` | `/threat_models` (POST/PUT) | string | MaxLength(2048) | TM description | `create-threat-model-dialog.component.ts:135` |
| `threat_model_framework` | `/threat_models` (POST/PUT) | string | Enum (STRIDE, CIA, LINDDUN, etc.) | Framework selection | `create-threat-model-dialog.component.ts:136` |
| `is_confidential` | `/threat_models` (POST) | boolean | None | Confidentiality flag | `create-threat-model-dialog.component.ts:137` |
| `authorization` | `/threat_models` (PUT/PATCH) | object[] | Principal validation | Access control list | `threat-model.service.ts:656-683` |
| `owner` | `/threat_models` (PUT/PATCH) | object | Read-only (should be rejected) | Owner principal | `threat-model.service.ts:674` |

**Threats:**
| Field Name | Endpoint | Data Type | Validation | Purpose | File Location |
|-----------|----------|-----------|------------|---------|---------------|
| `name` | `/threat_models/{id}/threats` | string | Required, MaxLength(100) | Threat name | `threat-editor-dialog.component.ts:154` |
| `description` | `/threat_models/{id}/threats` | string | MaxLength(500) | Threat description | `threat-editor-dialog.component.ts:157` |
| `mitigation` | `/threat_models/{id}/threats` | string | MaxLength(1024) | Mitigation description | `threat-editor-dialog.component.ts:166` |
| `issue_uri` | `/threat_models/{id}/threats` | string | None (backend validates) | Issue tracker link | `threat-editor-dialog.component.ts:167` |
| `severity`, `priority`, `status`, `threat_type` | `/threat_models/{id}/threats` | string | Dropdown/Enum | Classification fields | `threat-editor-dialog.component.ts:158-165` |

**Webhooks (⚠️ Admin-only but missing guard):**
| Field Name | Endpoint | Data Type | Validation | Purpose | File Location |
|-----------|----------|-----------|------------|---------|---------------|
| `name` | `/webhooks/subscriptions` | string | Required | Webhook name | `add-webhook-dialog.component.ts:210` |
| `url` | `/webhooks/subscriptions` | string | Required, Pattern(/^https:\/\/.+/) | Webhook URL (SSRF vector) | `add-webhook-dialog.component.ts:212` |
| `events` | `/webhooks/subscriptions` | string[] | Multi-select from list | Event subscriptions | `add-webhook-dialog.component.ts:213` |
| `secret` | `/webhooks/subscriptions` | string | Optional | HMAC secret | `add-webhook-dialog.component.ts:214` |

**Addons (⚠️ Admin-only but missing guard):**
| Field Name | Endpoint | Data Type | Validation | Purpose | File Location |
|-----------|----------|-----------|------------|---------|---------------|
| `name` | `/addons` | string | Required | Addon name | `add-addon-dialog.component.ts:291` |
| `description` | `/addons` | string | None | Addon description | `add-addon-dialog.component.ts:293` |
| `webhook_id` | `/addons` | string | Required, dropdown | Associated webhook | `add-addon-dialog.component.ts:294` |
| `icon` | `/addons` | string | Custom validator (max 64 chars for Material, max 80 for FA) | Icon identifier | `add-addon-dialog.component.ts:295` |
| `objects` | `/addons` | string[] | Enum array | Object types | `add-addon-dialog.component.ts:296` |

**Metadata:**
| Field Name | Endpoint | Data Type | Validation | Purpose | File Location |
|-----------|----------|-----------|------------|---------|---------------|
| `key` | `/*/metadata/bulk` | string | Required, non-empty | Metadata key | `metadata-dialog.component.ts:275-298` |
| `value` | `/*/metadata/bulk` | string | Required, non-empty | Metadata value | `metadata-dialog.component.ts:275-298` |

**Diagrams:**
| Field Name | Endpoint | Data Type | Validation | Purpose | File Location |
|-----------|----------|-----------|------------|---------|---------------|
| `cells` | `/threat_models/{id}/diagrams` | object[] | None (complex cell structure) | Diagram cells | `threat-model.service.ts:1148, 1195-1220` |
| `image` | `/threat_models/{id}/diagrams` | object | SVG data | Rendered diagram | `threat-model.service.ts:1227-1267` |
| `name`, `description` | `/threat_models/{id}/diagrams` | string | None | Diagram metadata | `threat-model.service.ts:1273-1319` |

### HTTP Headers

| Header Name | Purpose | User Control | Validation | File Location |
|------------|---------|--------------|------------|---------------|
| `Authorization` | Bearer token | Indirect (set by interceptor) | Backend validates JWT signature | `jwt.interceptor.ts` |
| `Content-Type` | Request body type | Browser-controlled | Framework handles | N/A |
| `Accept` | Response format | Browser-controlled | Framework handles | N/A |

**Note:** No custom user-controllable headers found. Authorization header is managed by JWT interceptor.

### Cookie Values

**No HTTP cookies used for authentication.** The application stores all session data in localStorage/sessionStorage with client-side encryption. This eliminates cookie-based attacks (CSRF via cookies, session fixation) but increases XSS risk.

### WebSocket Messages

| Message Type | Fields | Validation | Purpose | File Location |
|-------------|--------|------------|---------|---------------|
| `join_session` | sessionId, userId | Structure validation | Join collaboration | `websocket.adapter.ts:337-379` |
| `leave_session` | sessionId, userId | Structure validation | Leave collaboration | `websocket.adapter.ts:337-379` |
| `diagram_operation` | operation_id, operation{type, cells} | Structure validation | Diagram updates | `websocket.adapter.ts:590-640` |
| `presenter_cursor` | cursor_position{x, y} | Structure validation | Cursor sync | `websocket.adapter.ts:590-640` |
| `presenter_selection` | selected_cells[] | Structure validation | Selection sync | `websocket.adapter.ts:590-640` |
| `user_presence_update` | user{user_id, email} | User object validation | Presence tracking | `websocket.adapter.ts:590-640` |

**Validation Location:** `/app/repos/tmi-ux/src/app/core/services/websocket.adapter.ts` lines 1042-1195

**Security Concern:** WebSocket messages parsed with `JSON.parse()` without explicit `__proto__` sanitization. Prototype pollution risk if backend doesn't validate.

### File Uploads

**No traditional file uploads found.** The application uses:
- **File Import (Client-side only):** User selects `.json` file via browser file picker, content parsed with `JSON.parse()`, sent to backend as JSON object
- **Location:** `dashboard.component.ts:779`, `tm.component.ts:398`
- **Risk:** Prototype pollution via malicious JSON file with `__proto__` keys

---

## 6. Network & Interaction Map

### 6.1 Entities

| Title | Type | Zone | Tech | Data | Notes |
|-------|------|------|------|------|-------|
| User Browser | ExternAsset | Internet | Chrome/Firefox/Safari | Encrypted tokens | User's web browser |
| TMI-UX Frontend | Service | Edge | Angular 21.2 SPA | Encrypted tokens, PII (encrypted) | Single-page application |
| Express Static Server | Service | Edge | Express.js 5.2.1 | None (stateless) | Serves compiled Angular SPA |
| TMI Backend API | Service | App | Go microservice | PII, Tokens, Threat Models | Business logic, authentication, database |
| PostgreSQL Database | DataStore | Data | PostgreSQL (assumed) | PII, Tokens, Threat Models, Secrets | Backend database (not in frontend code) |
| OAuth Providers | ThirdParty | Internet | Google, GitHub, custom | OAuth tokens, profile data | External identity providers |
| SAML IdP | ThirdParty | Internet | Enterprise SSO | SAML assertions, profile data | Enterprise identity providers |
| WebSocket Server | Service | App | Go (part of backend) | Collaboration messages | Real-time collaboration |

### 6.2 Entity Metadata

| Title | Metadata |
|-------|----------|
| TMI-UX Frontend | Hosts: `http://host.docker.internal:3000` (or configured URL); Framework: Angular 21.2.0; Auth: OAuth 2.0 + PKCE, SAML 2.0; Token Storage: localStorage (AES-GCM encrypted); Dependencies: TMI Backend API, OAuth Providers, SAML IdP |
| Express Static Server | Port: 8080 (production), 4200 (development); Routes: `/config.json` (runtime config), `/*` (static files); Rate Limit: 1000 req/15min per IP; Dependencies: None |
| TMI Backend API | Protocol: REST over HTTPS; Endpoints: 130+ (see Section 4); Auth: JWT bearer tokens; WebSocket: wss:// for collaboration; Database: PostgreSQL (assumed) |
| PostgreSQL Database | Engine: PostgreSQL (version unknown); Access: Backend only; Data: Users, threat models, surveys, sessions, settings |
| OAuth Providers | Providers: Google, GitHub, custom; Token Format: JWT; Scopes: openid, profile, email; Redirect: `/oauth2/callback` |
| SAML IdP | Providers: Enterprise-configured; Assertion: SAML 2.0; Redirect: `/saml/acs` (backend) |
| WebSocket Server | Protocol: wss:// (production), ws:// (development); Auth: JWT token as query parameter; Message Types: join_session, diagram_operation, presence_update, etc. |

### 6.3 Flows (Connections)

| FROM → TO | Channel | Path/Port | Guards | Touches |
|-----------|---------|-----------|--------|---------|
| User Browser → Express Static Server | HTTPS | `:8080 /` | None | Public |
| User Browser → Express Static Server | HTTPS | `:8080 /config.json` | None | Public (config) |
| TMI-UX Frontend → TMI Backend API | HTTPS | `/oauth2/*` | None (public endpoints) | Tokens |
| TMI-UX Frontend → TMI Backend API | HTTPS | `/me` | auth:user | PII, Tokens |
| TMI-UX Frontend → TMI Backend API | HTTPS | `/threat_models/*` | auth:user, ownership:user/group | PII, Threat Models |
| TMI-UX Frontend → TMI Backend API | HTTPS | `/admin/*` | auth:admin | PII, Secrets, Settings |
| TMI-UX Frontend → TMI Backend API | HTTPS | `/triage/*` | auth:reviewer | PII, Survey Responses |
| TMI-UX Frontend → WebSocket Server | WSS | `/ws/collaborate?token=...` | auth:user (token in URL) | Collaboration messages |
| TMI Backend API → PostgreSQL Database | TCP | `:5432` | vpc-only, mtls (assumed) | PII, Tokens, Secrets |
| TMI Backend API → OAuth Providers | HTTPS | `/oauth/authorize`, `/oauth/token` | None (OAuth protocol) | OAuth tokens |
| TMI Backend API → SAML IdP | HTTPS | `/saml/sso`, `/saml/acs` | None (SAML protocol) | SAML assertions |
| User Browser → OAuth Providers | HTTPS | Provider-specific | None (redirect) | OAuth consent |
| User Browser → SAML IdP | HTTPS | Provider-specific | None (redirect) | SAML authentication |

### 6.4 Guards Directory

| Guard Name | Category | Statement |
|-----------|----------|-----------|
| auth:user | Auth | Requires valid JWT bearer token with authenticated user status. Verified by `authGuard` in frontend routes and backend token validation. |
| auth:admin | Authorization | Requires JWT with `tmi_is_administrator=true` claim. Verified by `adminGuard` in frontend routes (lines 82-163 in app.routes.ts, except webhooks/addons) and backend role checks. |
| auth:reviewer | Authorization | Requires JWT with `tmi_is_security_reviewer=true` claim. Verified by `reviewerGuard` in frontend routes (line 166-189 in app.routes.ts) and backend role checks. |
| ownership:user | ObjectOwnership | Verifies requesting user is the owner of the target resource (threat model, survey response, team, project). Enforced by backend checking `owner` or `owner_id` field. |
| ownership:group | ObjectOwnership | Verifies requesting user belongs to a group with access to the target resource. Enforced by backend checking authorization list with `principal_type=group`. |
| role:reader | Authorization | Grants read-only access to threat models. Part of 3-tier permission model (reader/writer/owner). Enforced by backend authorization list validation. |
| role:writer | Authorization | Grants read and edit access to threat models (but not permission management). Part of 3-tier permission model. Enforced by backend authorization list validation. |
| role:owner | Authorization | Grants full access including permission management and deletion. Part of 3-tier permission model. Enforced by backend authorization list validation or `owner` field match. |
| tenant:isolation | Authorization | Enforces multi-tenant data isolation - users only see threat models they have explicit access to via ownership or authorization list. Backend enforces by filtering queries. |
| context:workflow | Authorization | Survey responses can only be edited in `draft` or `needs_revision` status. Delete only allowed in `draft` status. Backend enforces status-based access control. |
| vpc-only | Network | Backend database connections restricted to VPC (assumed - not visible in frontend code). |
| mtls | Protocol | Mutual TLS for backend-to-database connections (assumed - best practice). |
| rate-limit | RateLimit | Express server rate limit: 1000 requests per 15 minutes per IP address. Applied to all routes. |

---

## 7. Role & Privilege Architecture

### 7.1 Discovered Roles

| Role Name | Privilege Level | Scope/Domain | Code Implementation |
|-----------|----------------|--------------|-------------------|
| anon | 0 | Global | No authentication required. Routes: `/`, `/login`, `/about`, `/tos`, `/privacy`, `/oauth2/callback`. |
| user | 1 | Global | Base authenticated user role. Default for new users. Routes: `/dashboard`, `/tm/*`, `/intake/*`. Guards: `authGuard`. Profile: `is_admin=false, is_security_reviewer=false`. |
| reviewer | 5 | Global | Security reviewer role. Can access all survey responses for triage. Routes: `/triage/*`. Guards: `authGuard, reviewerGuard`. Profile: `is_security_reviewer=true`. JWT claim: `tmi_is_security_reviewer=true`. |
| admin | 5 | Global | Administrator role. Full system access including user/group/settings management. Routes: `/admin/*`. Guards: `authGuard, adminGuard`. Profile: `is_admin=true`. JWT claim: `tmi_is_administrator=true`. |
| owner | - | Per-Resource | Implicit role for threat model/team/project creators. Highest permission on owned resources. Determined by `owner` or `owner_id` field match. |
| writer | - | Per-Resource | Can edit threat models but not manage permissions. Granted via authorization list. |
| reader | - | Per-Resource | Read-only access to threat models. Granted via authorization list. |

### 7.2 Privilege Lattice

```
Privilege Ordering (→ means "can access resources of"):
anon → user → (reviewer || admin)

Parallel Isolation (|| means "not ordered relative to each other"):
reviewer || admin (both have privilege level 5 but different scopes)

Per-Resource Hierarchy (for threat models):
reader → writer → owner

Combined Privilege Example:
- admin + owner on TM1: Full system admin + full TM1 control
- reviewer + reader on TM1: Can triage all surveys + read TM1
- user + owner on TM1: Standard user + full TM1 control
```

**Note on Role Switching:**
- No role switching/impersonation features found in frontend code
- Users can have multiple roles simultaneously (e.g., both admin AND reviewer)
- Landing page priority: reviewer > admin > user (line 279-284 in auth.service.ts)

### 7.3 Role Entry Points

| Role | Default Landing Page | Accessible Route Patterns | Authentication Method |
|------|---------------------|--------------------------|---------------------|
| anon | `/` | `/`, `/login`, `/about`, `/tos`, `/privacy`, `/oauth2/callback` | None |
| user | `/intake` | `/dashboard`, `/tm/*`, `/intake/*`, `/me/*`, `/teams/*`, `/projects/*`, `/webhooks/*` ⚠️, `/addons/*` ⚠️ | JWT bearer token |
| reviewer | `/dashboard` | All user routes + `/triage/*` | JWT bearer token with `tmi_is_security_reviewer=true` |
| admin | `/admin` (if not also reviewer) | All user routes + `/admin/*` | JWT bearer token with `tmi_is_administrator=true` |

**⚠️ Warning:** Webhook and addon routes are under `/admin/webhooks` and `/admin/addons` but lack `adminGuard`, making them accessible to any authenticated user despite the path suggesting admin-only access.

### 7.4 Role-to-Code Mapping

| Role | Middleware/Guards | Permission Checks | Storage Location |
|------|-------------------|------------------|------------------|
| anon | None | None | N/A |
| user | `authGuard` (app.routes.ts:82+) | `authService.isAuthenticated()` | JWT in encrypted localStorage, Profile in encrypted localStorage |
| reviewer | `authGuard, reviewerGuard` (app.routes.ts:166-189) | `authService.isSecurityReviewer()` returns `userProfile.is_security_reviewer === true` | JWT claim `tmi_is_security_reviewer`, Profile field `is_security_reviewer` |
| admin | `authGuard, adminGuard` (app.routes.ts:82-163) | `authService.isAdmin()` returns `userProfile.is_admin === true` | JWT claim `tmi_is_administrator`, Profile field `is_admin` |
| owner | N/A (backend validates) | `threatModelAuthorizationService.getCurrentUserPermission()` returns 'owner' if `owner` field matches current user principal | Threat model `owner` field (Principal-based User object) |
| writer | N/A (backend validates) | `threatModelAuthorizationService.canEdit()` returns true if permission is 'writer' or 'owner' | Threat model `authorization` array |
| reader | N/A (backend validates) | Frontend checks permission !== null for read access | Threat model `authorization` array |

---

## 8. Authorization Vulnerability Candidates

### 8.1 Horizontal Privilege Escalation Candidates

**Ranked list of endpoints with object identifiers that could allow access to other users' resources.**

| Priority | Endpoint Pattern | Object ID Parameter | Data Type | Sensitivity | Notes |
|----------|------------------|---------------------|-----------|-------------|-------|
| **HIGH** | `/threat_models/{threat_model_id}` | threat_model_id | UUID | Threat models (high) | No frontend authorization check before API call. Backend must validate owner/authorization list. |
| **HIGH** | `/threat_models/{tm_id}/diagrams/{diagram_id}` | threat_model_id, diagram_id | UUID | Diagrams (high) | Authorization inherited from parent threat model. Test if backend validates parent ownership. |
| **HIGH** | `/threat_models/{tm_id}/threats/{threat_id}` | threat_model_id, threat_id | UUID | Threats (high) | Authorization inherited from parent threat model. |
| **HIGH** | `/intake/survey_responses/{response_id}` | response_id | UUID | Survey responses (high) | Owner-only access. Backend must validate `owner_id` matches current user. No frontend check. |
| **HIGH** | `/webhooks/subscriptions/{id}` | webhook_id | UUID | Webhooks (critical) | ⚠️ Missing `adminGuard` in frontend route. Any authenticated user could potentially access. Backend validation unknown. |
| **HIGH** | `/addons/{id}` | addon_id | UUID | Addons (critical) | ⚠️ Missing `adminGuard` in frontend route. Any authenticated user could potentially access. Backend validation unknown. |
| **HIGH** | `/teams/{team_id}` | team_id | UUID | Teams (medium-high) | No frontend authorization check. Backend must validate access/ownership. |
| **HIGH** | `/projects/{project_id}` | project_id | UUID | Projects (medium-high) | No frontend authorization check. Backend must validate access/ownership. |
| **MEDIUM** | `/me/credentials/{credential_id}` | credential_id | UUID | API credentials (medium) | Credential ownership validation expected. Backend must validate credential belongs to current user. |
| **MEDIUM** | `/threat_models/{tm_id}/documents/{document_id}` | threat_model_id, document_id | UUID | Documents (medium) | Authorization inherited from parent threat model. |
| **MEDIUM** | `/threat_models/{tm_id}/notes/{note_id}` | threat_model_id, note_id | UUID | Notes (medium) | Authorization inherited from parent threat model. |
| **MEDIUM** | `/threat_models/{tm_id}/assets/{asset_id}` | threat_model_id, asset_id | UUID | Assets (medium) | Authorization inherited from parent threat model. |
| **MEDIUM** | `/threat_models/{tm_id}/repositories/{repository_id}` | threat_model_id, repository_id | UUID | Repositories (medium) | Authorization inherited from parent threat model. |
| **MEDIUM** | `/me/groups/{internal_uuid}/members` | internal_uuid | UUID | Group members (medium) | Must validate current user is member of group. |
| **LOW** | All `/*/metadata` endpoints | Various resource IDs | UUID | Metadata (low) | Authorization inherited from parent resource. Test if metadata access bypasses parent authorization. |

**Testing Strategy:**
1. User A creates resource (threat model, survey response, team, project, webhook, addon)
2. User B (authenticated, non-admin) attempts to:
   - GET resource by ID (should fail with 403)
   - PUT/PATCH resource by ID (should fail with 403)
   - DELETE resource by ID (should fail with 403)
3. Test with various IDs: valid UUID, non-existent UUID, other user's UUID
4. Special attention to webhooks/addons due to missing frontend guard

### 8.2 Vertical Privilege Escalation Candidates

**List of endpoints requiring higher privileges, organized by target role.**

#### **Admin Role (Privilege Level 5)**

| Target Role | Endpoint Pattern | Functionality | Risk Level | Notes |
|------------|------------------|---------------|-----------|-------|
| admin | `/admin/users` | User management (list all users) | **CRITICAL** | Non-admin should receive 403. |
| admin | `/admin/users/{internal_uuid}` (DELETE) | Delete user account | **CRITICAL** | Non-admin should receive 403. |
| admin | `/admin/users/{id}/transfer` | Transfer user resources | **CRITICAL** | Non-admin attempting to transfer another user's resources. |
| admin | `/admin/groups` | Group management (list all groups) | **HIGH** | Non-admin should receive 403. |
| admin | `/admin/groups/{uuid}` (POST/DELETE) | Create/delete groups | **HIGH** | Non-admin should receive 403. |
| admin | `/admin/groups/{uuid}/members` | Manage group membership | **HIGH** | Non-admin adding themselves to admin groups. |
| admin | `/admin/settings` | System settings management | **CRITICAL** | Non-admin modifying system configuration. |
| admin | `/admin/quotas/*` | Quota management | **HIGH** | Non-admin increasing their own quotas. |
| admin | `/admin/surveys` | Survey template management | **MEDIUM** | Non-admin creating/modifying survey templates. |
| admin | **`/webhooks/*`** ⚠️ | **Webhook management** | **CRITICAL** | ⚠️ **Frontend route lacks `adminGuard`** - any authenticated user may access. Backend validation unknown. |
| admin | **`/addons/*`** ⚠️ | **Addon management** | **CRITICAL** | ⚠️ **Frontend route lacks `adminGuard`** - any authenticated user may access. Backend validation unknown. |

#### **Security Reviewer Role (Privilege Level 5)**

| Target Role | Endpoint Pattern | Functionality | Risk Level | Notes |
|------------|------------------|---------------|-----------|-------|
| reviewer | `/triage/survey_responses` | View all survey responses | **HIGH** | Non-reviewer should receive 403. Reviewer can see all users' responses. |
| reviewer | `/triage/survey_responses/{id}` (PATCH) | Update response status (approve/reject) | **HIGH** | Non-reviewer modifying survey workflow. |
| reviewer | `/triage/survey_responses/{id}/create_threat_model` | Create threat model from response | **MEDIUM** | Non-reviewer creating threat models from arbitrary responses. |
| reviewer | `/triage/survey_responses/{id}/triage_notes` | Create internal reviewer notes | **MEDIUM** | Non-reviewer creating notes on responses they don't own. |

**Testing Strategy:**
1. User A (non-admin, non-reviewer) attempts to access each endpoint above
2. Expect 403 Forbidden from backend
3. **Priority testing:**
   - `/admin/webhooks/*` - CRITICAL due to missing frontend guard
   - `/admin/addons/*` - CRITICAL due to missing frontend guard
   - `/admin/users/{id}` (DELETE) - CRITICAL (account deletion)
   - `/admin/settings/*` - CRITICAL (system configuration)
   - `/triage/survey_responses` - HIGH (access to all user data)

### 8.3 Context-Based Authorization Candidates

**Multi-step workflow endpoints that assume prior steps were completed.**

| Workflow | Endpoint | Expected Prior State | Bypass Potential | Risk Level |
|----------|----------|---------------------|------------------|-----------|
| Survey Response Lifecycle | `/intake/survey_responses/{id}` (PUT) | Status = `draft` or `needs_revision` | Direct PUT with `status=submitted` might bypass workflow | **MEDIUM** |
| Survey Response Lifecycle | `/intake/survey_responses/{id}` (DELETE) | Status = `draft` | Direct DELETE might bypass status check | **LOW** |
| Survey Response Lifecycle | `/intake/survey_responses/{id}` (PATCH) | Status allows submission | Submitting unfinished response | **LOW** |
| Threat Model Permissions | `/threat_models/{id}` (PATCH with authorization changes) | Current user is owner | Non-owner attempting to modify authorization list | **HIGH** |
| Threat Model Ownership | `/threat_models/{id}` (PATCH with owner change) | Current user is owner | Non-owner attempting to change owner field | **HIGH** |
| Collaboration Session | `/threat_models/{tm_id}/diagrams/{d_id}/collaborate` (POST) | User has writer/owner access to TM | Starting collaboration without proper TM access | **MEDIUM** |
| Addon Invocation | `/addons/{id}/invoke` | User has appropriate role AND addon is active | Invoking deactivated addon or admin-only addon as non-admin | **MEDIUM** |
| Team/Project Deletion | `/teams/{id}`, `/projects/{id}` (DELETE) | User is owner OR admin | Non-owner, non-admin attempting deletion | **MEDIUM** |

**Testing Strategy:**
1. **Survey Response Workflow Bypass:**
   - Create response in `draft` status
   - Attempt PUT with `status=submitted` without completing required fields
   - Attempt DELETE with `status=submitted` (should fail)
   - Attempt PATCH operations on `submitted` response (should fail for non-reviewers)

2. **Threat Model Authorization Bypass:**
   - User B (reader on TM1) attempts PATCH with new authorization list adding themselves as owner
   - User B attempts PATCH with `owner` field changed to User B's principal

3. **Collaboration Session Bypass:**
   - User B (no access to TM1) attempts POST to start collaboration session
   - User B attempts to join existing collaboration session via WebSocket

4. **Addon Invocation Bypass:**
   - User attempts to invoke admin-only addon
   - User attempts to invoke deactivated addon
   - User provides malicious payload in addon parameters

---

## 9. Injection Sources (Command Injection, SQL Injection, LFI/RFI, SSTI, Path Traversal, Deserialization)

**Network Surface Focus:** Only injection sources accessible through the network-accessible attack surface are included. Local-only scripts, build tools, and CLI applications are excluded.

### Summary

After comprehensive analysis, the TMI-UX frontend has **LIMITED direct injection vulnerabilities** because it is an Angular SPA with no direct backend access (no database, no shell, no file system operations). The main injection risks relate to:

1. **Deserialization (JSON.parse)** - Prototype pollution via WebSocket messages and file imports
2. **Backend injection risks** - Unvalidated input sent to backend that could cause backend SQL injection, command injection, or path traversal
3. **No direct SQL/Command/SSTI vulnerabilities** in frontend code

### 9.1 Deserialization Sources (JSON.parse)

#### **MEDIUM RISK - WebSocket Message Parsing**

**Location:** `/app/repos/tmi-ux/src/app/core/services/websocket.adapter.ts:494, 681`

**Dangerous Sink:** `JSON.parse(rawData as string)`

**User Input Origin:** WebSocket messages from backend collaboration server

**Data Flow Path:**
```
WebSocket event.data → JSON.parse() → _validateTMIMessage() → Emit to subscribers
```

**Input Field Name:** WebSocket message payload (TMI collaborative messages)

**Current Validation:**
- Message structure validation via `_validateTMIMessage()` (lines 1110-1195)
- Message type checking for TMI message format
- Error handling for malformed JSON
- **Does NOT sanitize `__proto__`, `constructor`, `prototype` keys**

**Attack Vector:**
```json
{
  "message_type": "diagram_operation",
  "operation": {
    "__proto__": {
      "polluted": true,
      "isAdmin": true
    }
  }
}
```

**Severity:** MEDIUM (depends on backend validation)

**Recommendation:** Add prototype pollution protection before message validation.

---

#### **MEDIUM RISK - File Import JSON Parsing**

**Location:**
- `/app/repos/tmi-ux/src/app/pages/dashboard/dashboard.component.ts:779`
- `/app/repos/tmi-ux/src/app/pages/tm/tm.component.ts:398`

**Dangerous Sink:** `JSON.parse(content) as Record<string, unknown>`

**User Input Origin:** User selects `.json` file via browser file picker

**Data Flow Path:**
```
File input → FileReader → JSON.parse() → Import orchestrator validation → POST /threat_models
```

**Input Field Name:** Imported threat model JSON file

**Current Validation:**
- Import orchestrator validates structure after parsing
- **Does NOT sanitize `__proto__` keys before parsing**

**Attack Vector:**
```json
{
  "name": "Malicious Threat Model",
  "__proto__": {
    "polluted": true
  },
  "threats": [...]
}
```

**Severity:** MEDIUM (client-side pollution, backend receives polluted object)

**Recommendation:** Sanitize object after parsing to remove dangerous keys before sending to backend.

---

#### **MEDIUM RISK - Addon Payload Parsing**

**Location:** `/app/repos/tmi-ux/src/app/pages/tm/components/invoke-addon-dialog/invoke-addon-dialog.component.ts:68, 187, 188`

**Dangerous Sink:** `JSON.parse(payloadStr)`

**User Input Origin:** User types JSON into addon invocation dialog

**Data Flow Path:**
```
User input → JSON.parse() → API POST /addons/{id}/invoke
```

**Input Field Name:** Addon invocation payload (free-form JSON)

**Current Validation:**
- JSON syntax validation only (try-catch)
- **No content validation**

**Attack Vector:**
```json
{
  "__proto__": {
    "polluted": true
  },
  "malicious_command": "rm -rf /"
}
```

**Severity:** MEDIUM (backend must validate addon payloads)

**Recommendation:** Backend must thoroughly validate addon payloads. Frontend should add basic schema validation.

---

#### **LOW RISK - LocalStorage Data Parsing**

**Location:** `/app/repos/tmi-ux/src/app/pages/dfd/infrastructure/adapters/infra-local-storage.adapter.ts:175`

**Dangerous Sink:** `JSON.parse(item) as LocalStorageData`

**User Input Origin:** localStorage (same-origin controlled)

**Severity:** LOW (localStorage is same-origin, but could be manipulated via XSS)

**Note:** Client-side only, no backend injection possible.

---

#### **LOW RISK - JWT Token Parsing**

**Location:** `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts` (multiple lines)

**Dangerous Sink:** `JSON.parse(atob(payload))`

**User Input Origin:** JWT tokens from authentication server

**Severity:** LOW (JWT tokens are cryptographically signed by backend, integrity verified)

---

### 9.2 Backend Injection Risks (Frontend Sends Unvalidated Input)

#### **MEDIUM RISK - URL Path Parameter Injection**

**Location:** All API service calls with object IDs in URL paths

**Example:** `/app/repos/tmi-ux/src/app/pages/tm/services/threat-model.service.ts:231, 344, 366, 388, 413, 438, 674, 731, 809`

**Pattern:** `` `threat_models/${id}` `` where `${id}` comes from user input

**User Input Origin:** Threat model IDs, diagram IDs, user IDs from UI

**Data Flow Path:**
```
User input → URL template literal → HTTP request to backend
```

**Current Validation:** NO client-side validation of ID format

**Attack Examples:**
```
GET /threat_models/../../../etc/passwd
GET /threat_models/;DROP%20TABLE%20threats--
GET /threat_models/%2e%2e%2fadmin
```

**Severity:** MEDIUM (depends on backend validation)

**Recommendation:** Backend MUST validate ID format (UUIDs/alphanumeric only). Frontend should add ID format validation as defense-in-depth.

---

#### **LOW-MEDIUM RISK - Query Parameter Injection**

**Location:** `/app/repos/tmi-ux/src/app/pages/tm/services/threat-model.service.ts:143-163`

**Pattern:**
```typescript
const params: Record<string, string> = {};
if (listParams.name) params['name'] = listParams.name;
if (listParams.description) params['description'] = listParams.description;
```

**User Input Origin:** Search filters, pagination, sorting parameters

**Data Flow Path:**
```
User input → Query parameters → GET /threat_models?name=...&description=...
```

**Current Validation:** NO client-side sanitization

**Attack Examples:**
```
name=' OR '1'='1' --
description='; DROP TABLE threats--
owner=' UNION SELECT * FROM users--
```

**Severity:** LOW-MEDIUM (Angular HttpClient auto-encodes query params, but backend must use parameterized queries)

**Recommendation:** Backend MUST use parameterized queries for all database operations.

---

#### **LOW RISK - JSON Patch Operation Injection**

**Location:** `/app/repos/tmi-ux/src/app/pages/tm/services/threat-model.service.ts:719-723`

**Pattern:**
```typescript
const operations = Object.entries(filteredUpdates).map(([key, value]) => ({
  op: 'replace' as const,
  path: `/${key}`,
  value,
}));
```

**User Input Origin:** Field updates from UI forms

**Data Flow Path:**
```
User input → JSON Patch operations → PATCH /threat_models/{id}
```

**Current Validation:** Filters out read-only fields, but no path sanitization

**Attack Examples:**
```
path: "/../../../admin/config"
path: "/authorization/../../owner"
```

**Severity:** LOW (backend should validate JSON Patch paths)

**Recommendation:** Backend MUST validate JSON Patch paths match allowed fields.

---

### 9.3 No Injection Vulnerabilities Found

**SQL Injection:** ✅ **NONE**
- This is a frontend application with no direct database access
- All database operations happen on the backend

**Command Injection:** ✅ **NONE**
- No `child_process`, `exec()`, `spawn()` usage in network-accessible code
- Found only in build scripts (excluded from scope)

**Path Traversal (Frontend):** ✅ **NONE**
- No `fs.readFile()`, `fs.writeFile()` in frontend code
- server.js serves static files with `express.static` (safe)

**Server-Side Template Injection (SSTI):** ✅ **NONE**
- No dynamic template compilation in frontend
- Angular templates are compile-time, not runtime
- No `eval()` or `Function()` constructor usage for templates

**Direct XSS Vectors:** ✅ **MINIMAL**
- No `innerHTML`, `dangerouslySetInnerHTML` usage in production code
- Angular automatically sanitizes template interpolation
- DOMPurify used for markdown rendering (properly configured)

---

### 9.4 Injection Source Summary Table

| Injection Type | Severity | Count | Network-Accessible | Mitigation |
|---------------|----------|-------|-------------------|-----------|
| SQL Injection | N/A | 0 | No direct DB access | Backend parameterized queries |
| Command Injection | N/A | 0 | No shell access | N/A |
| Path Traversal (Frontend) | N/A | 0 | No file operations | N/A |
| Path Traversal (Backend via URL) | MEDIUM | ~50 | Yes (IDs in URLs) | Backend ID format validation |
| Deserialization (Prototype Pollution) | MEDIUM | 5 | Yes (WebSocket, file imports) | Sanitize `__proto__` keys |
| SSTI | N/A | 0 | No dynamic templates | N/A |
| XSS | LOW | 0 | Minimal (Angular sanitization) | DOMPurify for markdown |
| Backend SQL Injection (via query params) | LOW-MEDIUM | Multiple | Yes | Backend parameterized queries |

---

## RECONNAISSANCE COMPLETE

This reconnaissance deliverable provides a comprehensive map of the TMI-UX application's attack surface. Key findings include:

1. **CRITICAL:** Missing `adminGuard` on `/admin/webhooks` and `/admin/addons` routes
2. **HIGH:** Weak JWT token encryption key derivation using enumerable browser fingerprint
3. **MEDIUM:** Multiple IDOR candidates requiring horizontal privilege escalation testing
4. **MEDIUM:** Deserialization risks via WebSocket messages and file imports
5. **MEDIUM:** Backend SSRF risk via webhook test functionality

The application demonstrates strong security architecture overall, with comprehensive authentication, role-based access control, and defense-in-depth patterns. However, the identified vulnerabilities require immediate attention before production deployment.

**Next Steps:** Downstream analysis specialists (Injection, XSS, Auth, Authz, SSRF) should use this deliverable to conduct targeted security testing of the identified vulnerabilities and attack surface components.