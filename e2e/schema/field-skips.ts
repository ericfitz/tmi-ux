/**
 * Machine-readable reasons a field-coverage spec exempts a schema field from
 * its per-field visibility check.
 *
 * Bare `SKIP_FIELDS: string[]` arrays hide the field-coverage suite's whole
 * purpose (per docs/superpowers/specs/2026-04-10-e2e-comprehensive-test-plan-design.md):
 * failing when an API schema field has no UI exposure. A deliberate exemption
 * and an accidental coverage gap look identical in a plain string list. This
 * type forces every skip to say which one it is (see #819).
 */
export type SkipReason =
  // The field has no UI by design. `trackedBy` must point at the issue that
  // states the decision (e.g. #305 for threat-model alias).
  | 'not-exposed-by-design'
  // The field's control is exercised by a different spec/test file, so
  // skipping it here does not reduce overall coverage.
  | 'covered-elsewhere'
  // The field should be covered by this suite but isn't yet — no test
  // locates or verifies it. This is the only reason that represents an
  // actual hole; `note` should say what's missing (selector, seed data,
  // conditional rendering, etc.) so it can be closed later.
  | 'known-gap';

export interface FieldSkip {
  /** Matches FieldDef.apiName for the field being exempted. */
  apiName: string;
  reason: SkipReason;
  /** Why this field is skipped, with the evidence behind the classification. */
  note: string;
  /** Issue tracking the design decision (required in spirit for 'not-exposed-by-design'). */
  trackedBy?: string;
}

/** Fields whose apiName is not present in `skips`. */
export function withoutSkipped<T extends { apiName: string }>(
  fields: T[],
  skips: FieldSkip[],
): T[] {
  const skipped = new Set(skips.map(s => s.apiName));
  return fields.filter(f => !skipped.has(f.apiName));
}

/**
 * Skips reasoned 'not-exposed-by-design'. These are expected to expire on
 * their own: each spec runs a companion test asserting the field's control
 * is still absent from the UI, so the day the design changes (e.g. #305
 * ships alias UI), that test starts failing instead of the exemption
 * silently staying "correct" forever.
 */
export function byDesignSkips(skips: FieldSkip[]): FieldSkip[] {
  return skips.filter(s => s.reason === 'not-exposed-by-design');
}
