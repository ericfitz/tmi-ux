// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { PLURAL_CATEGORIES, selectPluralKey } from './plural-key';

const I18N_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../assets/i18n');
const LOCALE_FILE = /^[a-z]{2}-[A-Z]{2}\.json$/;
const CATEGORY_SET = new Set<string>(PLURAL_CATEGORIES);

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** A plural group is an object whose keys are all CLDR categories, including `other`. */
function isPluralGroup(value: Json): value is Record<string, Json> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.includes('other') && keys.every(k => CATEGORY_SET.has(k));
}

/** Returns dotted path -> plural group for every plural group in a translation tree. */
function findPluralGroups(obj: Json, prefix = ''): Map<string, Record<string, Json>> {
  const groups = new Map<string, Record<string, Json>>();
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return groups;
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPluralGroup(value)) {
      groups.set(path, value);
    } else {
      for (const [p, g] of findPluralGroups(value, path)) groups.set(p, g);
    }
  }
  return groups;
}

const locales = readdirSync(I18N_DIR)
  .filter(f => LOCALE_FILE.test(f))
  .map(f => ({
    lang: f.replace(/\.json$/, ''),
    data: JSON.parse(readFileSync(join(I18N_DIR, f), 'utf8')) as Json,
  }));

const has = (keys: string[]) => (key: string) => keys.includes(key);

describe('selectPluralKey', () => {
  const ru = ['n.one', 'n.few', 'n.many', 'n.other'];

  it.each([
    [1, 'n.one'],
    [21, 'n.one'],
    [2, 'n.few'],
    [4, 'n.few'],
    [22, 'n.few'],
    [0, 'n.many'],
    [5, 'n.many'],
    [11, 'n.many'],
    [12, 'n.many'],
    [25, 'n.many'],
    [1.5, 'n.other'],
  ])('ru-RU: %d selects %s', (count, expected) => {
    expect(selectPluralKey('n', count, 'ru-RU', has(ru))).toBe(expected);
  });

  const ar = ['n.zero', 'n.one', 'n.two', 'n.few', 'n.many', 'n.other'];

  it.each([
    [0, 'n.zero'],
    [1, 'n.one'],
    [2, 'n.two'],
    [3, 'n.few'],
    [10, 'n.few'],
    [11, 'n.many'],
    [99, 'n.many'],
    [100, 'n.other'],
    [102, 'n.other'],
  ])('ar-SA: %d selects %s', (count, expected) => {
    expect(selectPluralKey('n', count, 'ar-SA', has(ar))).toBe(expected);
  });

  it('fr-FR treats 0 as singular', () => {
    expect(selectPluralKey('n', 0, 'fr-FR', has(['n.one', 'n.many', 'n.other']))).toBe('n.one');
  });

  it('he-IL selects the dual for 2', () => {
    expect(selectPluralKey('n', 2, 'he-IL', has(['n.one', 'n.two', 'n.other']))).toBe('n.two');
  });

  it('falls back to other when the category is missing from the translation', () => {
    expect(selectPluralKey('n', 2, 'ru-RU', has(['n.one', 'n.other']))).toBe('n.other');
  });

  it('uses other for languages without plural forms', () => {
    expect(selectPluralKey('n', 1, 'ja-JP', has(['n.other']))).toBe('n.other');
  });
});

describe('locale plural groups', () => {
  const en = locales.find(l => l.lang === 'en-US');
  const enGroups = [...findPluralGroups(en!.data).keys()].sort();

  it('finds the 16 locale files and the en-US plural groups', () => {
    expect(locales).toHaveLength(16);
    expect(enGroups).toEqual([
      'adminSurveys.templateCount',
      'collaboration.participantCount',
      'surveys.responses.responseCount',
      'triage.detail.noteCount',
    ]);
  });

  it.each(locales.map(l => [l.lang, l.data] as const))(
    '%s defines exactly its CLDR categories for every plural group',
    (lang, data) => {
      const expected = [...new Intl.PluralRules(lang).resolvedOptions().pluralCategories].sort();
      const groups = findPluralGroups(data);
      expect([...groups.keys()].sort()).toEqual(enGroups);
      for (const [path, group] of groups) {
        expect({ path, categories: Object.keys(group).sort() }).toEqual({
          path,
          categories: expected,
        });
        for (const value of Object.values(group)) expect(typeof value).toBe('string');
      }
    },
  );
});
