# Authorization Analysis: Threat Model Sub-Resources (Batch Analysis)

**Endpoints Analyzed:**
- GET /threat_models/{tm_id}/threats/{threat_id}
- GET /threat_models/{tm_id}/notes/{note_id}
- GET /threat_models/{tm_id}/documents/{document_id}
- GET /threat_models/{tm_id}/assets/{asset_id}
- GET /threat_models/{tm_id}/repositories/{repository_id}

**Analysis Date:** 2026-03-04
**Analyst:** Security Vulnerability Assessment Agent
**Parent Endpoint Status:** GUARDED (confirmed in prior analysis)

---

## Executive Summary

```
ENDPOINT GROUP: Threat Model Sub-Resources
PATTERN: Shared authorization (inherit from parent threat model)
AUTHORIZATION FLOW: Parent threat model authorization → Backend validation of parent-child relationship (presumed but unconfirmed)
VERDICT: UNCERTAIN (HIGH confidence for Notes, MEDIUM-LOW for others)
CONFIDENCE:
  - Notes: HIGH (60%) - Has individual GET method, similar to diagrams
  - Others: MEDIUM-LOW (40%) - No individual GET methods in frontend, limited evidence
REASONING: Only Notes endpoint has an individual GET method similar to diagrams. Other sub-resources (threats, documents, assets, repositories) lack individual GET methods in the frontend, suggesting they're accessed via parent GET or list endpoints. API documentation lacks explicit "not associated" language for non-diagram/note endpoints.
```

---

## Analysis Findings

### 1. Frontend Implementation Patterns

#### Sub-Resources WITH Individual GET Methods:
1. **Notes** - `getNoteById(threatModelId, noteId)` (Line 1566)
2. **Diagrams** - `getDiagramById(threatModelId, diagramId)` (Line 366) [Previously analyzed]

#### Sub-Resources WITHOUT Individual GET Methods:
1. **Threats** - Only `getThreatsForThreatModel()` list method exists (Line 899)
2. **Documents** - Only `getDocumentsForThreatModel()` list method exists (Line 378)
3. **Assets** - Only `getAssetsForThreatModel()` list method exists (Line 1646)
4. **Repositories** - Only `getRepositoriesForThreatModel()` list method exists (Line 403)

**Key Finding:** The absence of individual GET methods suggests these resources are typically accessed either:
- Via the parent `GET /threat_models/{id}` endpoint (which includes nested arrays)
- Via list endpoints only
- This reduces the attack surface for IDOR vulnerabilities on individual resources

---

### 2. API Schema Documentation Analysis

#### Diagram Endpoint (Reference - Previously Analyzed):
**Line 21520 of api-types.d.ts:**
```typescript
/** @description Threat model or diagram not found, or diagram not associated with threat model */
404: { ... }
```
✅ **Explicit language** about parent-child validation

#### Notes Endpoint:
**Line 14754-14784 of api-types.d.ts:**
```typescript
getThreatModelNote: {
  parameters: {
    path: {
      threat_model_id: components['parameters']['ThreatModelId'];
      note_id: components['parameters']['NoteId'];
    };
  };
  responses: {
    200: { ... }
    400: { ... }
    401: components['responses']['Error'];
    403: components['responses']['Error'];
    404: components['responses']['Error'];  // Generic error, no explicit description
    429: components['responses']['TooManyRequests'];
    500: components['responses']['Error'];
  };
}
```
⚠️ **Generic 404 error** - no explicit "not associated" language
✅ **Has individual GET method** in frontend (similar pattern to diagrams)

#### Threats, Documents, Assets, Repositories:
**Similar pattern for all:**
```typescript
getThreatModel[Threat|Document|Asset|Repository]: {
  parameters: {
    path: {
      threat_model_id: ...;
      [resource]_id: ...;
    };
  };
  responses: {
    404: components['responses']['Error'];  // Generic error only
  };
}
```
⚠️ **Generic 404 errors** for all
❌ **No frontend individual GET methods** implemented

---

### 3. Code Evidence: getNoteById Implementation

**File:** `/app/repos/tmi-ux/src/app/pages/tm/services/threat-model.service.ts`
**Lines 1565-1572:**

```typescript
/**
 * Get a single note by ID with full content
 */
getNoteById(threatModelId: string, noteId: string): Observable<Note | undefined> {
  return this.apiService.get<Note>(`threat_models/${threatModelId}/notes/${noteId}`).pipe(
    catchError(error => {
      this.logger.error(`Error fetching note with ID: ${noteId}`, error);
      return of(undefined);
    }),
  );
}
```

**Observations:**
- ✅ Follows same pattern as `getDiagramById`
- ❌ Error swallowing: All errors return `undefined` (403 vs 404 indistinguishable)
- ❌ No validation that note belongs to threat model in frontend
- ⚠️ Relies entirely on backend validation

---

### 4. Authorization Flow Analysis

#### Current Authorization Flow:

```
User Request
    ↓
[1] Angular Route Guard (authGuard) - Checks JWT validity
    ↓
[2] Threat Model Resolver - Validates access to parent threat model
    ↓  ← GET /threat_models/{id} → Backend checks authorization
    ↓
[3] Component loads sub-resource
    ↓
[4] API Call: GET /threat_models/{tm_id}/[resource]/{resource_id}
    ↓
[5] Backend validates (PRESUMED):
    ├── User has access to threat model {tm_id}
    ├── Resource {resource_id} exists
    └── Resource {resource_id} belongs to {tm_id} ← CRITICAL CHECK
    ↓
[6] Return 200 (success) or 404/403 (failure)
```

**Critical Question:** Does step [5] validate parent-child relationship?

---

## Vulnerability Assessment by Resource Type

### A. Notes Endpoint: GET /threat_models/{tm_id}/notes/{note_id}

**Risk Level:** MEDIUM-HIGH (if backend validation missing)

**Evidence Supporting GUARDED:**
- ✅ Frontend has individual GET method (similar to diagrams)
- ✅ Nested URL structure provides both IDs to backend
- ✅ Parent threat model authorization is validated first
- ✅ API endpoint exists and is documented

**Evidence Supporting VULNERABLE:**
- ❌ No explicit "not associated" language in API docs (unlike diagrams)
- ❌ Error swallowing prevents distinguishing 403 from 404
- ❌ No frontend validation of parent-child relationship
- ❌ No test coverage found for cross-threat-model note access

**Attack Scenario:**
1. Attacker has access to Threat Model A
2. Attacker discovers Note Y exists in Threat Model B (unauthorized)
3. Attacker crafts: `GET /threat_models/A/notes/Y`
4. If backend only validates:
   - User has access to Threat Model A ✓
   - Note Y exists ✓
   - But NOT: Note Y belongs to Threat Model A ✗
5. Attacker retrieves Note Y from unauthorized Threat Model B

**Verdict:** **UNCERTAIN** - Likely GUARDED based on pattern similarity to diagrams, but requires backend confirmation

**Confidence:** **60%** - Higher confidence due to individual GET method implementation

---

### B. Threats Endpoint: GET /threat_models/{tm_id}/threats/{threat_id}

**Risk Level:** LOW-MEDIUM

**Evidence Supporting GUARDED:**
- ✅ Parent threat model authorization validated
- ✅ Nested URL structure
- ✅ Likely accessed via parent GET (includes full threat array)
- ✅ No individual GET method = reduced attack surface

**Evidence Supporting VULNERABLE:**
- ❌ API endpoint exists but not used by frontend
- ❌ Generic 404 error documentation
- ❌ If endpoint IS accessible directly, no validation confirmed

**Special Consideration:**
- Frontend primarily uses `getThreatsForThreatModel()` list method
- Individual threats accessed via parent: `GET /threat_models/{id}` returns full model including threats array
- This pattern is MORE secure as it inherently validates parent-child relationship

**Verdict:** **UNCERTAIN-GUARDED** - Lower risk due to access pattern, but endpoint exists

**Confidence:** **40%** - Limited evidence of backend validation

---

### C. Documents, Assets, Repositories Endpoints

**Pattern:** Same as Threats

**Risk Level:** LOW-MEDIUM

**Key Findings:**
- ❌ No individual GET methods in frontend for any of these
- ✅ Only list methods exist: `getDocumentsForThreatModel()`, `getAssetsForThreatModel()`, `getRepositoriesForThreatModel()`
- ✅ Individual resources accessed via parent GET endpoint
- ⚠️ API endpoints exist but are unused by frontend

**Access Patterns:**
1. **List Access:** `GET /threat_models/{tm_id}/documents` - Returns only documents for that threat model
2. **Parent Access:** `GET /threat_models/{id}` - Returns full model including documents/assets/repositories arrays
3. **Individual Access:** API endpoints exist but frontend doesn't use them

**Verdict:** **UNCERTAIN-GUARDED** - Lower risk due to access patterns, but endpoints exist

**Confidence:** **35%** - Very limited evidence

---

## Common Vulnerabilities Across All Sub-Resources

### 1. Error Handling Masking
**Location:** All service methods that access sub-resources

```typescript
.pipe(
  catchError(error => {
    this.logger.error(`Error fetching...`, error);
    return of(undefined);  // ← Swallows ALL errors
  }),
);
```

**Issue:**
- Cannot distinguish 403 (forbidden) from 404 (not found)
- Makes testing and debugging harder
- Hides authorization failures from monitoring

**Impact:** Makes it difficult to detect if IDOR attacks are occurring

---

### 2. No Frontend Validation
**Issue:** Frontend never validates that child resource belongs to parent

```typescript
// Frontend just trusts the backend to validate
getNoteById(threatModelId: string, noteId: string) {
  // No check: Does noteId belong to threatModelId?
  return this.apiService.get<Note>(`threat_models/${threatModelId}/notes/${noteId}`);
}
```

**Defense-in-Depth Concern:** While backend validation is primary defense, frontend validation provides additional security layer

---

### 3. Inconsistent API Documentation

**Issue:** Only diagram endpoint has explicit "not associated" language

| Endpoint | Has "Not Associated" Language? |
|----------|-------------------------------|
| Diagrams | ✅ Yes (Line 21520) |
| Notes    | ❌ No (Generic 404) |
| Threats  | ❌ No (Generic 404) |
| Documents | ❌ No (Generic 404) |
| Assets   | ❌ No (Generic 404) |
| Repositories | ❌ No (Generic 404) |

**Implication:** Unclear if backend validates parent-child relationships for all resource types

---

## Testing Recommendations

### Priority 1: Notes Endpoint (Highest Risk)

**Manual Test:**
```bash
# Setup:
# - User A has access to Threat Model X (contains Note 1)
# - User B has access to Threat Model Y (contains Note 2)

# Test 1: User A attempts to access Note 2 via Threat Model X
curl -H "Authorization: Bearer $USER_A_TOKEN" \
     https://api.tmi.example.com/threat_models/X/notes/2

# Expected (GUARDED): 404 "Note not found" or 403 "Forbidden"
# Vulnerable: 200 OK with Note 2 content (from Threat Model Y)

# Test 2: User A attempts to access Note 2 via correct parent (should fail)
curl -H "Authorization: Bearer $USER_A_TOKEN" \
     https://api.tmi.example.com/threat_models/Y/notes/2

# Expected: 403 Forbidden (no access to Threat Model Y)

# Test 3: User A accesses own note (should succeed)
curl -H "Authorization: Bearer $USER_A_TOKEN" \
     https://api.tmi.example.com/threat_models/X/notes/1

# Expected: 200 OK with Note 1 content
```

### Priority 2: Threats, Documents, Assets, Repositories

**Test ALL endpoints with same pattern:**
```bash
# Test each resource type:
GET /threat_models/X/threats/2       (threat from Model Y)
GET /threat_models/X/documents/2     (document from Model Y)
GET /threat_models/X/assets/2        (asset from Model Y)
GET /threat_models/X/repositories/2  (repository from Model Y)

# All should return 404 or 403, NOT 200 with data
```

### Automated Integration Tests

```typescript
describe('Sub-Resource Authorization - Batch Tests', () => {
  let userA, userB, modelX, modelY;
  let noteInX, noteInY, threatInY, docInY, assetInY, repoInY;

  beforeEach(async () => {
    userA = await createUser();
    userB = await createUser();

    modelX = await createThreatModel({ owner: userA });
    modelY = await createThreatModel({ owner: userB });

    noteInX = await createNote({ threat_model_id: modelX.id });
    noteInY = await createNote({ threat_model_id: modelY.id });
    threatInY = await createThreat({ threat_model_id: modelY.id });
    docInY = await createDocument({ threat_model_id: modelY.id });
    assetInY = await createAsset({ threat_model_id: modelY.id });
    repoInY = await createRepository({ threat_model_id: modelY.id });
  });

  describe('Cross-Threat-Model Access Prevention', () => {
    const resources = [
      { name: 'notes', path: 'notes', id: () => noteInY.id },
      { name: 'threats', path: 'threats', id: () => threatInY.id },
      { name: 'documents', path: 'documents', id: () => docInY.id },
      { name: 'assets', path: 'assets', id: () => assetInY.id },
      { name: 'repositories', path: 'repositories', id: () => repoInY.id },
    ];

    resources.forEach(resource => {
      it(`should prevent accessing ${resource.name} from unauthorized threat model`, async () => {
        const response = await request(app)
          .get(`/threat_models/${modelX.id}/${resource.path}/${resource.id()}`)
          .set('Authorization', `Bearer ${userA.token}`)
          .expect(res => {
            // Accept either 404 or 403, but NOT 200
            expect([404, 403]).toContain(res.status);
          });

        expect(response.body.error).toBeDefined();
      });
    });
  });

  describe('Correct Parent-Child Access', () => {
    it('should allow accessing note via correct parent', async () => {
      await request(app)
        .get(`/threat_models/${modelX.id}/notes/${noteInX.id}`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200)
        .expect(res => {
          expect(res.body.id).toBe(noteInX.id);
          expect(res.body.threat_model_id).toBe(modelX.id);
        });
    });
  });
});
```

---

## Related Analysis

### Previously Analyzed:
- **Diagrams Endpoint:** See `/app/repos/tmi-ux/outputs/AUTHZ_ANALYSIS_DIAGRAM_ENDPOINT.md`
  - Verdict: UNCERTAIN (60% confidence of GUARDED)
  - Has explicit "not associated" language in API docs
  - Same pattern as Notes endpoint

### Pattern Comparison:

| Endpoint | Individual GET Method? | "Not Associated" Docs? | Frontend Usage | Risk Level |
|----------|------------------------|------------------------|----------------|-----------|
| Diagrams | ✅ Yes | ✅ Yes | Direct GET | HIGH |
| Notes | ✅ Yes | ❌ No | Direct GET | MEDIUM-HIGH |
| Threats | ❌ No | ❌ No | Parent GET / List | LOW-MEDIUM |
| Documents | ❌ No | ❌ No | Parent GET / List | LOW-MEDIUM |
| Assets | ❌ No | ❌ No | Parent GET / List | LOW-MEDIUM |
| Repositories | ❌ No | ❌ No | Parent GET / List | LOW-MEDIUM |

---

## Recommendations

### Immediate Actions (Manual Testing):
1. **Test Notes endpoint** - Highest priority due to individual GET method
2. **Test all other sub-resource endpoints** - Even if unused by frontend, APIs exist
3. **Document results** - Build evidence of backend validation (or lack thereof)

### Short-Term Fixes (Frontend):

#### 1. Improve Error Handling
```typescript
getNoteById(threatModelId: string, noteId: string): Observable<Note | undefined> {
  return this.apiService.get<Note>(`threat_models/${threatModelId}/notes/${noteId}`).pipe(
    catchError((error: HttpErrorResponse) => {
      // Distinguish error types
      if (error.status === 403) {
        this.logger.warn('Access denied to note', { threatModelId, noteId });
      } else if (error.status === 404) {
        this.logger.info('Note not found or not associated with threat model', {
          threatModelId,
          noteId
        });
      } else {
        this.logger.error('Error fetching note', error);
      }

      // Consider throwing specific errors instead of swallowing
      return throwError(() => error);
    }),
  );
}
```

#### 2. Add Frontend Validation (Defense-in-Depth)
```typescript
getNoteById(threatModelId: string, noteId: string): Observable<Note | undefined> {
  // First, verify note is in the threat model's notes list
  return this.getThreatModelById(threatModelId).pipe(
    switchMap(threatModel => {
      if (!threatModel) {
        return throwError(() => new Error('Threat model not found'));
      }

      // Check if note exists in threat model's notes array
      const noteExists = threatModel.notes?.some(n => n.id === noteId);
      if (!noteExists) {
        this.logger.warn('Note not found in threat model', { threatModelId, noteId });
        return of(undefined);
      }

      // Proceed with API call
      return this.apiService.get<Note>(`threat_models/${threatModelId}/notes/${noteId}`);
    })
  );
}
```

### Long-Term Fixes (Backend):

#### 1. Consistent Validation Pattern
Ensure ALL sub-resource endpoints validate parent-child relationships:

```go
// Example Go backend validation
func GetThreatModelNote(c *gin.Context) {
    threatModelID := c.Param("threat_model_id")
    noteID := c.Param("note_id")

    // 1. Validate user has access to threat model
    threatModel, err := GetThreatModel(threatModelID, currentUser)
    if err != nil {
        c.JSON(403, gin.H{"error": "access_denied"})
        return
    }

    // 2. Fetch note
    note, err := GetNote(noteID)
    if err != nil {
        c.JSON(404, gin.H{"error": "note_not_found"})
        return
    }

    // 3. CRITICAL: Validate note belongs to threat model
    if note.ThreatModelID != threatModelID {
        c.JSON(404, gin.H{
            "error": "not_found",
            "error_description": "Note not found or not associated with threat model",
        })
        return
    }

    c.JSON(200, note)
}
```

#### 2. Update API Documentation
Add explicit "not associated" language to ALL sub-resource endpoints:

```yaml
/threat_models/{threat_model_id}/notes/{note_id}:
  get:
    responses:
      '404':
        description: "Threat model or note not found, or note not associated with threat model"
```

---

## OWASP & CWE Mappings

### OWASP Top 10:
- **A01:2021 – Broken Access Control**
  - Insecure Direct Object References (IDOR)
  - Missing Function Level Access Control

### OWASP API Security Top 10:
- **API1:2023 – Broken Object Level Authorization**
  - Exactly matches this vulnerability pattern
  - Object-level authorization checks missing/incomplete

### CWE:
- **CWE-639:** Authorization Bypass Through User-Controlled Key
- **CWE-285:** Improper Authorization
- **CWE-284:** Improper Access Control

---

## Conclusion

### Summary by Resource Type:

| Resource | Verdict | Confidence | Priority |
|----------|---------|------------|----------|
| Notes | UNCERTAIN (likely GUARDED) | 60% | HIGH |
| Threats | UNCERTAIN-GUARDED | 40% | MEDIUM |
| Documents | UNCERTAIN-GUARDED | 35% | MEDIUM |
| Assets | UNCERTAIN-GUARDED | 35% | MEDIUM |
| Repositories | UNCERTAIN-GUARDED | 35% | MEDIUM |

### Key Findings:

1. **Shared Pattern:** All sub-resources inherit authorization from parent threat model
2. **Unconfirmed Backend Validation:** Cannot confirm backend validates parent-child relationships without testing
3. **Inconsistent Documentation:** Only diagrams endpoint has explicit validation language
4. **Limited Frontend Usage:** Most resources accessed via parent GET or list endpoints (lower risk)
5. **Notes Endpoint:** Highest risk due to individual GET method similar to diagrams

### Next Steps:

**Critical:** Perform manual penetration testing on ALL sub-resource endpoints, starting with Notes

**High Priority:** Add integration tests for cross-threat-model access prevention

**Medium Priority:** Improve error handling to distinguish 403 from 404

**Long-Term:** Implement frontend validation as defense-in-depth

### Overall Risk Assessment:

**IF backend validates parent-child relationships:** **GUARDED** - All endpoints are secure

**IF backend doesn't validate:** **VULNERABLE** - All endpoints susceptible to IDOR attacks

**Current State:** **UNCERTAIN** - Testing required to confirm backend behavior

**Recommended Action:** Test immediately, prioritize Notes endpoint

---

## References

1. **OWASP API Security Top 10 - API1:2023 Broken Object Level Authorization:**
   https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/

2. **OWASP Testing Guide - Testing for IDOR:**
   https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References

3. **CWE-639: Authorization Bypass Through User-Controlled Key:**
   https://cwe.mitre.org/data/definitions/639.html

4. **Previous Analysis - Diagram Endpoint:**
   `/app/repos/tmi-ux/outputs/AUTHZ_ANALYSIS_DIAGRAM_ENDPOINT.md`

---

**Analysis Complete**
**Date:** 2026-03-04
**Requires:** Manual testing to confirm backend validation behavior
