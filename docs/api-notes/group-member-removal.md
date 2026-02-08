# Group Member Removal API - Nested Group Support Gap

## Issue

The `DELETE /admin/groups/{internal_uuid}/members/{user_uuid}` endpoint uses `{user_uuid}` as the path parameter to identify which member to remove.

With the addition of `subject_type: "group"` support in the `GroupMember` schema, groups can now be members of other groups. However, the removal endpoint's path parameter is named `{user_uuid}`, which implies it only accepts user UUIDs. There is no way to specify a nested group for removal using this parameter.

## Current Frontend Workaround

The frontend is passing the **membership record `id`** (the `GroupMember.id` field) in place of `{user_uuid}` when calling the delete endpoint. This works for both user and group members as long as the server resolves the path parameter against the membership record ID.

**Service method:** `GroupAdminService.removeMember()` in `src/app/core/services/group-admin.service.ts`

## Suggested Resolution

One of:

1. **Rename the path parameter** from `{user_uuid}` to `{member_id}` and resolve it against the membership record `id` field. This is the simplest change and supports both user and group member removal.

2. **Add a separate endpoint** for removing nested groups, e.g., `DELETE /admin/groups/{internal_uuid}/member-groups/{group_uuid}`.

Option 1 is preferred from the frontend perspective since it requires no additional changes.

## Date

2026-02-07
