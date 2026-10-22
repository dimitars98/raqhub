import { de, enGB, fr, it, mk, sq, srLatn, type Locale } from "date-fns/locale";

// date-fns language for each app language, so day and month names in
// format(date, "EEE d MMM") follow the language the person is using.
const LOCALES: Record<string, Locale> = { en: enGB, de, fr, it, mk, sq, sr: srLatn };

export function dateLocale(locale: string): Locale {
  return LOCALES[locale] ?? enGB;
}

// Locale for Intl.DateTimeFormat / DisplayNames. Plain "sr" means Cyrillic
// to the browser, but the Serbian translation is written in Latin script;
// English dates follow British order ("22 October"), like date-fns enGB.
const INTL: Record<string, string> = { en: "en-GB", sr: "sr-Latn" };

export function intlLocale(locale: string): string {
  return INTL[locale] ?? locale;
}
