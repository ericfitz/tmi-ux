// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { describe, it, expect, beforeEach } from 'vitest';
import type { TranslocoService } from '@jsverse/transloco';

import { PluralKeyPipe } from './plural-key.pipe';

describe('PluralKeyPipe', () => {
  let activeLang: string;
  let pipe: PluralKeyPipe;

  const translations: Record<string, Record<string, string>> = {
    'en-US': { 'x.count.one': '{{count}} note', 'x.count.other': '{{count}} notes' },
    'ru-RU': {
      'x.count.one': '{{count}} заметка',
      'x.count.few': '{{count}} заметки',
      'x.count.many': '{{count}} заметок',
      'x.count.other': '{{count}} заметки',
    },
  };

  beforeEach(() => {
    activeLang = 'en-US';
    const transloco = {
      getActiveLang: (): string => activeLang,
      getTranslation: (lang: string): Record<string, string> => translations[lang] ?? {},
    } as unknown as TranslocoService;
    pipe = new PluralKeyPipe(transloco);
  });

  it('selects the category key for the active language', () => {
    expect(pipe.transform('x.count', 1)).toBe('x.count.one');
    expect(pipe.transform('x.count', 3)).toBe('x.count.other');
  });

  it('re-selects after the active language changes', () => {
    expect(pipe.transform('x.count', 3)).toBe('x.count.other');
    activeLang = 'ru-RU';
    expect(pipe.transform('x.count', 3)).toBe('x.count.few');
    expect(pipe.transform('x.count', 5)).toBe('x.count.many');
  });

  it('falls back to other while the translation is not loaded', () => {
    activeLang = 'ar-SA';
    expect(pipe.transform('x.count', 2)).toBe('x.count.other');
  });
});
