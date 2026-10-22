import { routing } from "@/i18n/routing";

export type Locale = (typeof routing.locales)[number];

/** A supported locale, or the default. */
export function pickLocale(value: string | null | undefined): Locale {
  return (routing.locales as readonly string[]).includes(value ?? "")
    ? (value as Locale)
    : routing.defaultLocale;
}

/** Best guess for people we have no language for (members, club owners). */
export function localeForCountry(country: string | null | undefined): Locale {
  switch ((country ?? "").toUpperCase()) {
    case "MK":
      return "mk";
    case "AL":
    case "XK":
      return "sq";
    case "DE":
    case "AT":
    case "CH":
      return "de";
    case "FR":
    case "BE":
      return "fr";
    case "IT":
      return "it";
    case "RS":
    case "ME":
    case "BA":
      return "sr";
    default:
      return routing.defaultLocale;
  }
}
