# ADR 0003: Threat severity, priority and status use canonical lowercase strings; unset is null

- **Status:** Accepted
- **Date:** 2026-09-18 (vocabulary), 2026-09-23 (null when unset)
- **Decision by:** Eric Fitzgerald (human decision)
- **Related:** [ericfitz/tmi#910](https://github.com/ericfitz/tmi/issues/910),
  [ericfitz/tmi#925](https://github.com/ericfitz/tmi/issues/925), #946 (PR #948), #953 (PR #955),
  PR #958, PR #959

## Context

Threat severity, priority and status were stored in more than one form. Older tmi-ux releases wrote
numeric keys (`"0"` = critical through `"5"` = unknown) and title-case labels (`"High"`). The server
ranks severity in the opposite direction from those numeric keys. A client converter
(`ThreatModelService.migrateLegacyThreatFieldValues`) rewrote canonical values back into the
numeric form, so legacy rows kept reappearing and tmi#910 had to special-case them in sorting. New
threats were also given default values such as `high`, so an unassessed threat could not be told
apart from an assessed one.

## Decision

1. **One vocabulary, shared with the server.** tmi-ux and the tmi server use the canonical
   lowercase strings for these fields, both on the wire and in storage:
   - severity: `critical`, `high`, `medium`, `low`, `informational` (`unknown` was retired in #953)
   - priority: `immediate`, `high`, `medium`, `low`, `deferred`
   - status: `open`, `confirmed`, `mitigation_planned`, `mitigation_in_progress`,
     `verification_pending`, `resolved`, `accepted`, `false_positive`, `deferred`, `closed`

   The source of truth in the client is `getFieldKeysForFieldType`
   (`src/app/shared/utils/field-value-helpers.ts`). The server's `severityOrder`
   (`api/threat_store_gorm.go`, `informational` = 1 through `critical` = 5) is a sort rank only and
   never appears on the wire.

2. **Unset is null.** A threat with no severity, priority or status has `null` for that field
   (all three are `nullable` in `ThreatBase` in the OpenAPI spec). Neither create nor edit fills in
   a default.

## Consequences

- New code compares against the canonical strings. It never introduces numeric or title-case keys
  for these fields.
- The client converter that wrote numeric keys was removed in PR #948. `migrateFieldValue` stays as
  a read-only compatibility shim: it maps legacy numeric and title-case values to canonical keys for
  display and never writes them back. tmi#925 migrated the stored rows; the shim can be deleted once
  no deployment still holds legacy values.
- The UI shows an unset severity as "Not set" (`common.notSet`), and sorting places unset values
  below every rank.
