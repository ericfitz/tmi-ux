/**
 * CLDR plural selection for Transloco keys (ADR 0007).
 *
 * A plural message is an object whose keys are CLDR plural categories, and each
 * locale defines the categories its language uses:
 *
 *   "participantCount": { "one": "{{count}} participant", "other": "{{count}} participants" }
 *
 * selectPluralKey() picks the category for a count with Intl.PluralRules and
 * returns the full key (`collaboration.participantCount.few`) to pass to the
 * transloco pipe. Missing categories fall back to `other`, because browser CLDR
 * data can differ from the data the locale files were written against.
 */

/** The six CLDR plural categories, in canonical order. */
export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

const rulesCache = new Map<string, Intl.PluralRules>();

/** Returns a cached cardinal Intl.PluralRules for the language. */
export function pluralRulesFor(lang: string): Intl.PluralRules {
  let rules = rulesCache.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang, { type: 'cardinal' });
    rulesCache.set(lang, rules);
  }
  return rules;
}

/**
 * Returns `${baseKey}.${category}` for the count in the language, or
 * `${baseKey}.other` when the translation has no entry for that category.
 *
 * @param hasKey Reports whether the active translation defines a full key.
 */
export function selectPluralKey(
  baseKey: string,
  count: number,
  lang: string,
  hasKey: (key: string) => boolean,
): string {
  const category = pluralRulesFor(lang).select(count);
  const key = `${baseKey}.${category}`;
  return hasKey(key) ? key : `${baseKey}.other`;
}
