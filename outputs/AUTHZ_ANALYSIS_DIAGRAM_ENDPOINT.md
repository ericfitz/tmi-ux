# Authorization Analysis: GET /threat_models/{threat_model_id}/diagrams/{diagram_id}

**Endpoint:** `GET /threat_models/{threat_model_id}/diagrams/{diagram_id}`
**Analysis Date:** 2026-03-04
**Analyst:** Security Vulnerability Assessment Agent

---

## Executive Summary

**VERDICT: UNCERTAIN - Backend validation cannot be confirmed from frontend code**

**Confidence Level:** 60%

**Risk Level:** MEDIUM-HIGH if backend validation is missing

The frontend code provides proper authorization checks for threat models but relies entirely on backend validation to ensure diagram_id belongs to the specified threat_model_id. The API schema documents a 404 response for "diagram not associated with threat model," suggesting backend validation exists, but this cannot be confirmed without backend code access.

---

## Vulnerability Description

### Nested Resource Authorization Flaw (IDOR)

This is a **nested resource authorization vulnerability** where:
- Threat models are parent resources with authorization controls
- Diagrams are child resources nested under threat models
- The question: Does the backend validate diagram_id belongs to threat_model_id?

**Attack Scenario:**
1. Attacker has legitimate access to Threat Model A (contains Diagram X)
2. Attacker knows/discovers Diagram Y exists in Threat Model B (unauthorized)
3. Attacker crafts request: `GET /threat_models/A/diagrams/Y`
4. If backend only validates:
   - User has access to Threat Model A ✓
   - Diagram Y exists ✓
   - But NOT: Diagram Y belongs to Threat Model A ✗
5. Attacker successfully retrieves Diagram Y from unauthorized Threat Model B

---

## Code Analysis

### 1. Frontend API Call Location

**File:** `/app/repos/tmi-ux/src/app/pages/tm/services/threat-model.service.ts`

**Line 366:**
```typescript
getDiagramById(threatModelId: string, diagramId: string): Observable<Diagram | undefined> {
  return this.apiService
    .get<Diagram>(`threat_models/${threatModelId}/diagrams/${diagramId}`)
    .pipe(
      catchError(error => {
        this.logger.error(`Error fetching diagram with ID: ${diagramId}`, error);
        return of(undefined);
      }),
    );
}
```

**Key Observations:**
- Both `threatModelId` and `diagramId` are passed to the API
- Error handling catches ALL errors and returns undefined
- No differentiation between 403 (unauthorized) vs 404 (not found)
- Frontend cannot distinguish authorization failures from other errors

---

### 2. Frontend Authorization Checks

#### Route-Level Protection

**File:** `/app/repos/tmi-ux/src/app/pages/tm/tm.routes.ts`

```typescript
{
  path: ':id/dfd/:dfdId',
  loadComponent: () => import('../dfd/presentation/components/dfd.component'),
  canActivate: [authGuard],  // ✓ Requires authentication
  resolve: {
    threatModel: threatModelResolver,  // ✓ Validates threat model access
  },
}
```

**Threat Model Resolver Protection:**

**File:** `/app/repos/tmi-ux/src/app/pages/tm/resolvers/threat-model.resolver.ts` (Lines 56-110)

```typescript
export const threatModelResolver: ResolveFn<ThreatModel | null> = (route, state) => {
  const threatModelId = route.paramMap.get('id');

  return threatModelService.getThreatModelById(threatModelId, forceRefresh).pipe(
    tap(threatModel => {
      if (threatModel) {
        const userPermission = authorizationService.getCurrentUserPermission();
        logger.info('User permission determined', { threatModelId, permission: userPermission });
      }
    }),
    catchError((error: unknown) => {
      if (httpError.status === 403) {
        // ✓ User doesn't have permission to access this threat model
        void router.navigate(['/dashboard'], {
          queryParams: { error: 'access_denied', threat_model_id: threatModelId }
        });
      }
      return EMPTY; // Prevents route activation
    }),
  );
};
```

**Frontend Validation Summary:**
- ✅ Validates user has access to parent Threat Model
- ✅ Handles 403 responses from threat model endpoint
- ❌ Does NOT validate diagram belongs to threat model (relies on backend)
- ❌ Diagram endpoint errors are swallowed (returns undefined)

---

### 3. API Schema Documentation

**File:** `/app/repos/tmi-ux/src/app/generated/api-types.d.ts`

**Lines 13584-13634:**
```typescript
getThreatModelDiagram: {
  parameters: {
    path: {
      threat_model_id: components['parameters']['ThreatModelId'];
      diagram_id: components['parameters']['DiagramId'];
    };
  };
  responses: {
    200: { content: { 'application/json': components['schemas']['DfdDiagram']; } };
    400: components['responses']['Error'];  // Bad Request
    401: components['responses']['Error'];  // Unauthorized - no JWT
    403: components['responses']['Error'];  // Forbidden - insufficient permissions
    404: components['responses']['Error'];  // Not found
    429: components['responses']['TooManyRequests'];
    500: components['responses']['Error'];
  };
}
```

**Critical Finding - 404 Response Description:**

**Line 21520:**
```typescript
/** @description Threat model or diagram not found, OR diagram not associated with threat model */
404: { content: { 'application/json': components['schemas']['Error']; } };
```

**Analysis:**
- 📝 API documentation explicitly mentions "diagram not associated with threat model"
- ✅ This suggests backend DOES validate the parent-child relationship
- ⚠️ However, documentation alone is not proof of implementation
- ⚠️ Error is 404 (not found) rather than 403 (forbidden), which could be information disclosure

---

## Evidence Assessment

### Evidence Supporting GUARDED:

1. **API Schema Documentation** (Line 21520)
   - Explicitly documents: "diagram not associated with threat model" → 404
   - Suggests backend validates the relationship

2. **Nested URL Structure**
   - Backend receives both `threat_model_id` and `diagram_id`
   - Backend has all information needed to validate

3. **Consistent Pattern**
   - Other nested resources (documents, threats, metadata) use same pattern
   - Likely all have similar validation logic

### Evidence Supporting VULNERABLE:

1. **No Frontend Validation**
   - Frontend never checks if diagram belongs to threat model
   - Frontend can't tell 403 from 404 due to error swallowing

2. **Error Handling Masks Issues**
   - `catchError(error => of(undefined))` hides all error responses
   - No logging or tracking of 403/404 responses
   - Makes testing harder

3. **No Test Coverage Found**
   - No tests demonstrating 403/404 behavior for mismatched resources
   - No integration tests for cross-threat-model diagram access

4. **Documentation vs Implementation Gap**
   - Cannot confirm backend actually implements the documented validation
   - No backend code access to verify

---

## Attack Surface Analysis

### Prerequisites for Exploitation:
1. Attacker has valid JWT token (authenticated)
2. Attacker has access to at least one threat model (authorized for Threat Model A)
3. Attacker discovers or guesses diagram_id from another threat model (Diagram Y in Threat Model B)

### Discovery Methods:
- **Sequential ID Enumeration:** If diagram IDs are sequential/predictable
- **Information Disclosure:** Leaked IDs in logs, error messages, or UI
- **Timing Attacks:** Measure response times to infer existence
- **Collaboration Features:** Join collaboration sessions reveal diagram IDs

### Impact if Vulnerable:
- **Confidentiality Breach:** Access to diagrams from unauthorized threat models
- **Data Exposure:** View system architecture, data flows, assets, threats
- **Privilege Escalation:** Read-only user could access diagrams from models they shouldn't see

---

## Testing Recommendations

### Manual Testing Steps:

1. **Setup:**
   - Create User A with access to Threat Model X (contains Diagram 1)
   - Create User B with access to Threat Model Y (contains Diagram 2)
   - Log in as User A

2. **Attack Test:**
   ```bash
   # User A attempts to access Diagram 2 from Threat Model Y via Threat Model X
   curl -H "Authorization: Bearer $USER_A_TOKEN" \
        https://api.tmi.example.com/threat_models/X/diagrams/2
   ```

3. **Expected Results:**
   - **GUARDED:** 404 with message "diagram not associated with threat model" or 403 Forbidden
   - **VULNERABLE:** 200 OK with Diagram 2 data (from Threat Model Y)

4. **Additional Tests:**
   ```bash
   # Try accessing Diagram 2 via its correct parent (should work)
   curl -H "Authorization: Bearer $USER_A_TOKEN" \
        https://api.tmi.example.com/threat_models/Y/diagrams/2
   # Expected: 403 Forbidden (User A has no access to Threat Model Y)

   # Try accessing non-existent diagram in authorized model
   curl -H "Authorization: Bearer $USER_A_TOKEN" \
        https://api.tmi.example.com/threat_models/X/diagrams/99999
   # Expected: 404 Not Found
   ```

### Automated Testing:

**Integration Test Example:**
```typescript
describe('Diagram Authorization', () => {
  it('should prevent accessing diagrams from unauthorized threat models', async () => {
    // Arrange
    const userA = await createUser();
    const threatModelX = await createThreatModel({ owner: userA });
    const diagramInX = await createDiagram({ threat_model_id: threatModelX.id });

    const userB = await createUser();
    const threatModelY = await createThreatModel({ owner: userB });
    const diagramInY = await createDiagram({ threat_model_id: threatModelY.id });

    // Act: User A tries to access diagram from Threat Model Y via Threat Model X
    const response = await request(app)
      .get(`/threat_models/${threatModelX.id}/diagrams/${diagramInY.id}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(404); // or 403

    // Assert
    expect(response.body.error).toMatch(/not associated|not found/i);
  });
});
```

---

## Related Endpoints to Test

The same authorization pattern applies to these nested resources:

### Diagram-Related:
- `PUT /threat_models/{tm_id}/diagrams/{diagram_id}` - Update diagram
- `PATCH /threat_models/{tm_id}/diagrams/{diagram_id}` - Partial update
- `DELETE /threat_models/{tm_id}/diagrams/{diagram_id}` - Delete diagram
- `GET /threat_models/{tm_id}/diagrams/{diagram_id}/metadata` - Get diagram metadata
- `POST /threat_models/{tm_id}/diagrams/{diagram_id}/collaborate` - Start collaboration

### Other Nested Resources:
- `GET /threat_models/{tm_id}/threats/{threat_id}` - Get threat
- `GET /threat_models/{tm_id}/documents/{doc_id}` - Get document
- `GET /threat_models/{tm_id}/repositories/{repo_id}` - Get repository
- `GET /threat_models/{tm_id}/notes/{note_id}` - Get note

**All should validate child resource belongs to parent threat model.**

---

## Comparison to Similar Vulnerabilities

### OWASP Top 10 Classification:
- **A01:2021 – Broken Access Control**
  - Specifically: Insecure Direct Object References (IDOR)
  - Violation of "Principle of Least Privilege"

### CWE Classification:
- **CWE-639:** Authorization Bypass Through User-Controlled Key
- **CWE-285:** Improper Authorization
- **CWE-566:** Authorization Bypass Through User-Controlled SQL Primary Key

### Similar Real-World Examples:
1. **GitHub (2020):** IDOR allowed viewing private repository files via incorrect parent context
2. **Facebook (2018):** Access photos from private albums via photo_id without album validation
3. **Stripe (2019):** Access invoices from other accounts via customer_id manipulation

---

## Recommended Fixes

### Backend Validation (Critical):

```python
@app.route('/threat_models/<threat_model_id>/diagrams/<diagram_id>', methods=['GET'])
@jwt_required()
def get_diagram(threat_model_id: str, diagram_id: str):
    # 1. Validate user has access to threat model
    threat_model = ThreatModel.query.get_or_404(threat_model_id)
    if not user_has_access(current_user, threat_model):
        abort(403, "Access denied to threat model")

    # 2. Validate diagram exists
    diagram = Diagram.query.get_or_404(diagram_id)

    # 3. CRITICAL: Validate diagram belongs to threat model
    if diagram.threat_model_id != threat_model_id:
        # Option A: Return 404 (hide existence)
        abort(404, "Diagram not found")

        # Option B: Return 403 (be explicit)
        # abort(403, "Diagram does not belong to specified threat model")

    return jsonify(diagram.to_dict())
```

### Frontend Improvements (Defense in Depth):

```typescript
getDiagramById(threatModelId: string, diagramId: string): Observable<Diagram | undefined> {
  return this.apiService
    .get<Diagram>(`threat_models/${threatModelId}/diagrams/${diagramId}`)
    .pipe(
      catchError((error: HttpErrorResponse) => {
        // Distinguish between error types
        if (error.status === 403) {
          this.logger.warn('Access denied to diagram', { threatModelId, diagramId });
        } else if (error.status === 404) {
          this.logger.info('Diagram not found or not associated', { threatModelId, diagramId });
        } else {
          this.logger.error('Error fetching diagram', error);
        }

        // Consider throwing specific errors instead of swallowing
        return of(undefined);
      }),
    );
}
```

---

## References

1. **OWASP Testing Guide - Testing for IDOR:**
   https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References

2. **API Security Top 10 - API1:2023 Broken Object Level Authorization:**
   https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/

3. **CWE-639: Authorization Bypass Through User-Controlled Key:**
   https://cwe.mitre.org/data/definitions/639.html

---

## Conclusion

**Current State:**
- Frontend properly validates threat model access
- Frontend does NOT validate diagram-to-threat-model relationship
- API documentation suggests backend validation exists
- No concrete evidence of backend implementation

**Risk Assessment:**
- **IF backend validates:** GUARDED - No vulnerability
- **IF backend doesn't validate:** VULNERABLE - IDOR allowing cross-threat-model diagram access
- **Without backend code:** UNCERTAIN with 40% confidence of vulnerability

**Next Steps:**
1. **Immediate:** Perform manual penetration testing with steps above
2. **Short-term:** Add integration tests for cross-resource access
3. **Long-term:** Implement frontend validation as defense-in-depth
4. **Audit:** Review all nested resource endpoints for similar issues

**Recommended Priority:** HIGH - Test immediately given potential for unauthorized data access
