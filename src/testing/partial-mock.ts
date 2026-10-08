/**
 * Helper for injecting a deliberately partial mock where a full service type is expected.
 */

/**
 * Builds a partial mock of `T` and presents it as `T`.
 *
 * Typos in keys are compile errors only when `partial` is an object literal (TypeScript's
 * excess-property check); a variable argument only gets the weak-type check (at least one
 * key must overlap with `T`). Values are never checked against the real member types: a mock
 * typically supplies `vi.fn()` spies or subjects. This is the single audited place where a
 * partial mock is widened to the full type, so specs do not need ad-hoc casts for
 * constructor-injected dependencies. For deliberately invalid input, use `as unknown as T`
 * with a comment instead.
 *
 * @param partial - The members the code under test actually uses
 * @returns The same object typed as `T`
 */
export function partialMock<T extends object>(partial: { [K in keyof T]?: unknown }): T {
  return partial as unknown as T;
}
