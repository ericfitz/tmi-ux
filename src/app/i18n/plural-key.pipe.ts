import { Pipe, PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { selectPluralKey } from './plural-key';

/**
 * Resolves a plural message's base key to the key for the count's CLDR
 * category in the active language (ADR 0007). Chain it into the transloco pipe:
 *
 *   {{ 'collaboration.participantCount' | pluralKey: n | transloco: { count: n } }}
 *
 * Impure so it re-selects when the active language changes; selection is a
 * cached Intl.PluralRules lookup.
 */
@Pipe({ name: 'pluralKey', standalone: true, pure: false })
export class PluralKeyPipe implements PipeTransform {
  constructor(private transloco: TranslocoService) {}

  /** Returns the full translation key for the count. */
  transform(baseKey: string, count: number): string {
    const lang = this.transloco.getActiveLang();
    const translation = this.transloco.getTranslation(lang);
    return selectPluralKey(baseKey, count, lang, key => typeof translation[key] === 'string');
  }
}
