import { de, enGB, fr, it, mk, sq, type Locale } from "date-fns/locale";

// date-fns language for each app language, so day and month names in
// format(date, "EEE d MMM") follow the language the person is using.
const LOCALES: Record<string, Locale> = { en: enGB, de, fr, it, mk, sq };

export function dateLocale(locale: string): Locale {
  return LOCALES[locale] ?? enGB;
}
