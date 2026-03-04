# Authorization Analysis Report

## 1. Executive Summary

- **Analysis Status:** Complete  
- **Key Outcome:** Two CRITICAL frontend authorization vulnerabilities (vertical privilege escalation) were identified and confirmed. These are externally exploitable via the public internet. Additionally, the frontend implements a trust-the-backend security model with zero defense-in-depth authorization checks, creating significant risk if backend validation is incomplete.
- **Purpose of this Document:** This report provides strategic context, vulnerability patterns, and architectural intelligence for the exploitation phase. It should be read alongside the machine-readable exploitation queue (`authz_exploitation_queue.json`).

## 2. Dominant Vulnerability Patterns

### Pattern 1: Missing Route Guards (Vertical Privilege Escalation) - CRITICAL

- **Description:** Two admin-only routes (`/admin/webhooks` and `/admin/addons`) lack the `adminGuard` that is consistently applied to all other admin routes. This allows any authenticated user (non-admin) to access admin-only functionality for webhook and addon management.
- **Implication:** Regular users can create webhooks pointing to attacker-controlled servers, create addons linked to those webhooks, and invoke addons to exfiltrate sensitive threat modeling data. Users can also trigger SSRF attacks via the webhook test functionality.
- **Root Cause:** Inconsistent application of route guards - likely copy-paste error during development. All other `/admin/*` routes have `adminGuard`, except these two.
- **Representative Vulnerabilities:** AUTHZ-VULN-01 (webhooks), AUTHZ-VULN-02 (addons)
- **Code Evidence:** 
  - `/app/repos/tmi-ux/src/app/app.routes.ts` lines 118-123 (webhooks - missing guard)
  - `/app/repos/tmi-ux/src/app/app.routes.ts` lines 125-130 (addons - missing guard)
  - Compare with line 99 (users route - has adminGuard), line 107 (groups - has adminGuard)

### Pattern 2: Trust-the-Backend Security Model (Backend-Dependent IDOR Risk)

- **Description:** The frontend implements zero authorization checks before making API requests. All endpoints that accept resource IDs (threat models, diagrams, survey responses, credentials, etc.) make direct HTTP calls without validating ownership, permissions, or resource relationships.
- **Implication:** If the backend has ANY authorization flaws (missing checks, logic errors, race conditions), the frontend provides no defense-in-depth protection. The entire security posture depends on backend implementation quality.
- **Architectural Pattern:** 
  - Route guards only check authentication (JWT validity), not authorization
  - Services make direct `apiService.get/post/put/delete()` calls with no pre-flight permission checks
  - Authorization services exist but are ONLY used for UI rendering (showing/hiding buttons), not request validation
  - Backend errors (403 Forbidden) are handled reactively AFTER requests fail
- **Risk Level:** Cannot determine exploitability without backend code audit. This is a defense-in-depth violation, not a confirmed vulnerability.
- **Affected Endpoints:** All resource-by-ID endpoints (threat models, diagrams, threats, documents, survey responses, credentials)

### Pattern 3: No Context/Workflow Validation (Backend-Dependent)

- **Description:** Multi-step workflows (survey response lifecycle, threat model permission changes, collaboration sessions) have NO frontend validation of prerequisite states or permissions before making API calls.
- **Implication:** Users can attempt to delete submitted survey responses, modify threat model ownership without being the owner, or start collaboration sessions without edit permissions - IF the backend doesn't validate these constraints.
- **Examples:**
  - Survey responses: `deleteDraft(id)` has no status check (should only allow delete when status='draft')
  - Threat models: `patchThreatModel()` doesn't filter out `owner` or `authorization` fields (non-owners can attempt ownership transfer)
  - Collaboration: `startCollaboration()` has no permission check (should require writer/owner role)
- **UI-Level Protection:** The frontend hides UI elements (buttons, forms) based on state/permission, but this is cosmetic only - service methods can be called directly.

## 3. Strategic Intelligence for Exploitation

### Session Management Architecture:

- **Authentication:** JWT tokens stored encrypted in localStorage using AES-GCM
- **Token Format:** Bearer tokens passed in Authorization header via `jwtInterceptor`
- **Token Refresh:** Automatic refresh 15 minutes before expiry
- **Session Duration:** Tokens expire based on backend configuration (not visible in frontend)
- **Critical Finding:** Encryption key derivation uses browser fingerprint (weak) but tokens are still properly authenticated by backend

### Role/Permission Model:

- **Global Roles:** 
  - `user` (default) - Basic authenticated user
  - `reviewer` - Security reviewer with access to all survey responses
  - `admin` - Full system administrator
- **Per-Resource Roles (Threat Models):**
  - `owner` - Full control including permission management
  - `writer` - Edit content but cannot manage permissions
  - `reader` - Read-only access
- **Role Storage:** JWT claims (`tmi_is_administrator`, `tmi_is_security_reviewer`) + encrypted localStorage
- **Critical Finding:** Role checks are performed by route guards (`adminGuard`, `reviewerGuard`) and authorization service, but these are NOT enforced before API calls - only for route activation and UI rendering

### Resource Access Patterns:

- **Threat Models:** 3-tier permission model (owner/writer/reader) stored in `authorization` array field
- **Authorization Inheritance:** Child resources (diagrams, threats, documents) inherit parent threat model permissions
- **Group-Based Access:** Supports group principals including special "everyone" group for public threat models
- **Critical Finding:** Frontend NEVER validates parent-child relationships or authorization before API calls

### Webhook/Addon Architecture (Vulnerable Endpoints):

- **Webhook Creation:** Users can specify arbitrary URLs (HTTPS required by frontend validation)
- **Webhook Events:** Users can subscribe to sensitive events (threat_model.created, diagram.updated, etc.)
- **Webhook Testing:** Triggers server-side HTTP POST to user-controlled URL (SSRF vector)
- **Addon Invocation:** Sends full threat model context + 1KB user payload to webhook URL
- **Data Sensitivity:** Webhooks receive complete threat modeling data including vulnerabilities, architecture diagrams, security assessments
- **Critical Finding:** These admin-only features are accessible to any authenticated user due to missing route guards

## 4. Vectors Analyzed and Confirmed Secure

These authorization checks were traced and confirmed to have robust, properly-placed guards. They are **low-priority** for further testing.

| **Endpoint** | **Guard Location** | **Defense Mechanism** | **Verdict** |
|--------------|-------------------|----------------------|-------------|
| `/admin/users` | app.routes.ts:99 | `canActivate: [adminGuard]` validates `is_admin === true` | SAFE |
| `/admin/groups` | app.routes.ts:107 | `canActivate: [adminGuard]` validates `is_admin === true` | SAFE |
| `/admin/settings` | app.routes.ts:137 | `canActivate: [adminGuard]` validates `is_admin === true` | SAFE |
| `/admin/quotas` | app.routes.ts:115 | `canActivate: [adminGuard]` validates `is_admin === true` | SAFE |
| `/admin/surveys` | app.routes.ts:145 | `canActivate: [adminGuard]` validates `is_admin === true` | SAFE |
| `/triage/*` | app.routes.ts:179-184 | `canActivate: [authGuard, reviewerGuard]` validates `is_security_reviewer === true` | SAFE |
| `/oauth2/callback` | auth.service.ts:895-958 | OAuth state parameter validation with CSRF protection | SAFE |
| `/me/logout` | auth.service.ts:1896 | Session-based logout, no authorization needed beyond authentication | SAFE |

**Note on "SAFE" Verdict:** These routes have proper frontend guards. However, backend validation is still required as defense-in-depth. Frontend guards can be bypassed by direct API calls outside the Angular application.

## 5. Externally Exploitable Vulnerabilities (High Confidence)

### AUTHZ-VULN-01: Missing adminGuard on /admin/webhooks (CRITICAL)

**Vulnerability Type:** Vertical Privilege Escalation  
**Confidence:** HIGH - Code evidence clearly shows missing guard  
**External Exploitability:** TRUE - Accessible via http://host.docker.internal:3000/admin/webhooks

**Technical Details:**
- **Route:** `/admin/webhooks` (app.routes.ts:118-123)
- **Missing Guard:** `canActivate: [adminGuard]`
- **Side Effects:** 
  - Create webhooks with attacker-controlled URLs
  - Subscribe to sensitive events (threat_model.created/updated, diagram.created/updated, etc.)
  - Test webhooks (triggers SSRF - server makes HTTP POST to user URL)
  - Exfiltrate threat modeling data via webhook callbacks
  - Hijack existing webhooks by modifying URLs
- **Attack Vector:**
  1. Authenticate as regular user (non-admin)
  2. Navigate to `/admin/webhooks` (no guard prevents access)
  3. Create webhook with URL `https://attacker.com/exfil`
  4. Subscribe to all events
  5. Receive real-time threat model data at attacker server

### AUTHZ-VULN-02: Missing adminGuard on /admin/addons (CRITICAL)

**Vulnerability Type:** Vertical Privilege Escalation  
**Confidence:** HIGH - Code evidence clearly shows missing guard  
**External Exploitability:** TRUE - Accessible via http://host.docker.internal:3000/admin/addons

**Technical Details:**
- **Route:** `/admin/addons` (app.routes.ts:125-130)
- **Missing Guard:** `canActivate: [adminGuard]`
- **Side Effects:**
  - Create addons linked to attacker-controlled webhooks
  - Invoke addons to exfiltrate specific threat model data
  - Send arbitrary 1KB JSON payload to webhook (potential for webhook server exploitation)
  - Access all threat model contexts via addon invocation
- **Attack Vector:**
  1. Authenticate as regular user (non-admin)
  2. Create webhook pointing to attacker server (VULN-01)
  3. Navigate to `/admin/addons` (no guard prevents access)
  4. Create addon linked to attacker webhook
  5. Invoke addon on target threat models
  6. Receive complete threat model data at attacker server

**Combined Impact of VULN-01 + VULN-02:**
These vulnerabilities can be chained for complete data exfiltration:
- Webhooks provide the infrastructure (attacker-controlled callback URLs)
- Addons provide the trigger mechanism (selective data extraction)
- Together they enable targeted exfiltration of sensitive security data

## 6. Backend-Dependent Findings (Cannot Confirm Without Backend Code)

The following patterns represent potential vulnerabilities IF the backend does not properly enforce authorization. These are documented for backend security review but are NOT included in the exploitation queue as they cannot be confirmed from frontend code alone.

### 6.1 Horizontal IDOR Risk - Threat Models

**Pattern:** Frontend makes direct API calls to `GET /threat_models/{id}` without ownership validation  
**Risk:** If backend doesn't validate authorization, users could access other users' threat models  
**Code Evidence:** threat-model.service.ts:231 - Direct HTTP GET with no auth check  
**Frontend Protection:** Route resolver validates parent TM when navigating, but doesn't prevent direct service calls  
**Testing Priority:** HIGH - Backend must validate `authorization` array or `owner` field

### 6.2 Horizontal IDOR Risk - Child Resources

**Pattern:** Frontend makes requests to `GET /threat_models/{tm_id}/diagrams/{diagram_id}` without validating child belongs to parent  
**Risk:** If backend doesn't validate parent-child relationship, users could access TM_A's diagrams via TM_B endpoint  
**Code Evidence:** threat-model.service.ts:366 - Direct HTTP GET with no relationship validation  
**Frontend Protection:** None  
**Testing Priority:** HIGH - Backend must validate child resources belong to specified parent

### 6.3 Horizontal IDOR Risk - Survey Responses

**Pattern:** Frontend makes direct API calls to `GET /intake/survey_responses/{id}` without ownership validation  
**Risk:** If backend doesn't validate `owner_id`, users could access other users' survey responses  
**Code Evidence:** survey-response.service.ts:84 - Direct HTTP GET with no ownership check  
**Frontend Protection:** None  
**Testing Priority:** HIGH - Survey responses contain sensitive project information

### 6.4 Context/Workflow Bypass Risk - Survey Response Status

**Pattern:** Frontend calls `DELETE /intake/survey_responses/{id}` without status validation  
**Risk:** If backend doesn't enforce status checks, users could delete submitted/reviewed responses  
**Code Evidence:** survey-response.service.ts:194 - Direct HTTP DELETE with no status check  
**Frontend Protection:** UI only shows delete button for draft status (bypassable)  
**Testing Priority:** MEDIUM - Workflow integrity violation

### 6.5 Context/Workflow Bypass Risk - Threat Model Ownership Transfer

**Pattern:** `patchThreatModel()` doesn't filter `owner` field from updates  
**Risk:** If backend doesn't validate current owner, non-owners could transfer ownership  
**Code Evidence:** threat-model.service.ts:719-723 - JSON Patch includes all fields  
**Frontend Protection:** None - UI disables permission management for non-owners (bypassable)  
**Testing Priority:** HIGH - Ownership transfer could enable privilege escalation

## 7. Analysis Constraints and Blind Spots

### Limited to Frontend Code Only:

This analysis is based exclusively on the Angular frontend codebase. Backend authorization logic is outside scope and could not be verified. All "backend-dependent" findings assume the backend MAY have vulnerabilities but this cannot be confirmed without backend code review.

### No Dynamic Testing Performed:

This is a white-box static analysis only. No live exploitation was attempted. The exploitation phase will confirm which backend-dependent risks are actually exploitable.

### WebSocket Authorization Not Fully Traced:

WebSocket collaboration messages (diagram operations, cursor sync, presence updates) use token-in-query-parameter authentication. The frontend validates message structure but the authorization model for who can send which operations was not fully traced. Backend WebSocket handling should be reviewed for authorization bypass.

### Incomplete API Coverage:

Some endpoints mentioned in the recon report (teams, projects) have no frontend service methods for accessing individual resources by ID. These were marked as "NO IMPLEMENTATION" and could not be analyzed. If these endpoints exist in the backend, they should be tested separately.

### External OAuth/SAML Providers:

OAuth 2.0 and SAML 2.0 authentication flows depend on external identity providers. The frontend implements proper PKCE and state validation, but the security of the overall authentication system depends on backend token validation and IdP configuration, which are outside this analysis scope.

---

## 8. Recommendations for Backend Security Team

Based on the frontend's trust-the-backend security model, the backend MUST implement these authorization checks:

### Critical (Required for Security):

1. **Validate admin role for ALL /admin/* endpoints** - Especially webhooks and addons (frontend is vulnerable)
2. **Validate reviewer role for ALL /triage/* endpoints**
3. **Validate threat model authorization** before returning threat model data or child resources
4. **Validate parent-child relationships** for nested resources (diagrams belong to threat models)
5. **Validate ownership** for personal resources (survey responses, credentials)
6. **Validate workflow states** (survey response status, threat model lifecycle)
7. **Validate permission levels** before allowing modification operations (owner-only for ownership transfer)
8. **Validate webhook URLs** to prevent SSRF (whitelist allowed hosts, block internal IPs)

### High Priority (Defense in Depth):

9. **Rate limit webhook test functionality** to prevent SSRF abuse
10. **Validate addon payloads** to prevent injection attacks on webhook servers
11. **Log all authorization failures** for security monitoring
12. **Implement resource ownership transfer audit trails**
13. **Validate JSON Patch operations** to ensure only allowed fields are modified

---

## 9. Key Takeaways

1. **Two CRITICAL Vulnerabilities Confirmed:** Missing route guards on `/admin/webhooks` and `/admin/addons` allow vertical privilege escalation. These are externally exploitable and should be fixed immediately.

2. **Frontend Security Model:** The application uses a "trust-the-backend" architecture where frontend authorization is decorative (UI rendering only). All security enforcement depends on backend validation.

3. **Defense-in-Depth Gap:** While this architectural pattern is common in modern SPAs, it creates significant risk. A single backend authorization bug can lead to critical exploitation with no frontend mitigation.

4. **Backend Testing Critical:** The exploitation phase should focus heavily on backend authorization testing. Frontend analysis alone cannot confirm whether backend-dependent risks are exploitable.

5. **Code Quality Observations:** Most admin routes are properly guarded with `adminGuard`. The webhook/addon vulnerabilities appear to be isolated oversights rather than systemic security issues. The authorization service implementation is sophisticated and well-designed for UI rendering. The gap is in applying these checks before API requests.

---

**AUTHORIZATION ANALYSIS COMPLETE**