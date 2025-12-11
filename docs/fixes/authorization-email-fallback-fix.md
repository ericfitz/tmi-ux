# Authorization Email Fallback Fix

**Date**: 2025-12-11
**Issue**: Users shown as read-only when creating threat models
**Root Cause**: Backend bug - owner.provider_id contains email instead of OAuth provider ID

## Problem

When users created a new threat model, the tm-edit page showed them as having read-only access even though they were the owner.

## Root Cause

The backend API was returning the owner object with `provider_id` set to the user's **email address** instead of the **OAuth provider ID**:

```javascript
// What the backend returned:
owner: {
  provider: "google",
  provider_id: "hobobarbarian@gmail.com"  // ← EMAIL (wrong!)
}

// What the frontend expected:
currentUser: {
  provider: "google",
  provider_id: "101155414856250184779"    // ← OAUTH PROVIDER ID
}
```

The authorization service at [threat-model-authorization.service.ts:201-204](../src/app/pages/tm/services/threat-model-authorization.service.ts#L201-L204) was comparing these values and failing the match, causing permissions to be calculated as `null`.

## Solution

Added an email fallback comparison in the authorization service. The service now:

1. **Primary match**: Compares `provider` and `provider_id` (OAuth ID)
2. **Fallback match**: If provider_id doesn't match, compares the owner's `provider_id` against the user's email
3. **Logs warning**: When fallback is used, warns that the backend has a bug

This allows the frontend to work correctly while the backend bug is being fixed.

## Changes

**File**: [src/app/pages/tm/services/threat-model-authorization.service.ts](../src/app/pages/tm/services/threat-model-authorization.service.ts)

- Lines 201-242: Added email fallback logic with detailed logging
- Lines 187-199: Added diagnostic logging to help identify similar issues in the future

## Testing

- All existing tests pass (1215 tests)
- Build successful
- Verified fix works with newly created threat models
- Warning log appears when email fallback is used

## Backend Fix Required

The backend should be updated to store and return the actual OAuth provider ID in the `provider_id` field instead of the email address. The email should only be in the `email` field.

## References

- Console logs showing the issue: [User-provided logs from 2025-12-11]
- Authorization architecture: [docs/reference/architecture/AUTHORIZATION.md](../docs/reference/architecture/AUTHORIZATION.md)
