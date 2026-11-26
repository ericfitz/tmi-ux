/**
 * Local Oxlint JS plugin for tmi-ux rules that Oxlint has no native equivalent for.
 *
 * Rules:
 *   tmi/no-any-cast  Reports `any` anywhere inside the type of an `as` cast or `<T>` type
 *                    assertion (`x as any`, `x as Array<any>`, `<any>x`). Replaces the ESLint
 *                    no-restricted-syntax selector
 *                    `TSAsExpression TSAnyKeyword, TSTypeAssertion TSAnyKeyword` (#870).
 */

const CAST_TYPES = new Set(['TSAsExpression', 'TSTypeAssertion']);

const noAnyCast = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow casting to any (or a type containing any) in tests.' },
    messages: {
      noAnyCast:
        'Do not cast to any in tests. Type the fixture, use partialMock<T>() from @testing/partial-mock, or `as unknown as T` with a comment for deliberately invalid input.',
    },
    schema: [],
  },
  create(context) {
    return {
      TSAnyKeyword(node) {
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (CAST_TYPES.has(parent.type)) {
            context.report({ node, messageId: 'noAnyCast' });
            return;
          }
        }
      },
    };
  },
};

export default {
  meta: { name: 'tmi' },
  rules: { 'no-any-cast': noAnyCast },
};
