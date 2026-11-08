/** Site languages (D335, D336). English lives at the root. */
export const APP_LOCALES = ["en", "ru", "es", "pt-BR", "de", "fr", "it"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

export function isAppLocale(value: unknown): value is AppLocale {
  return (APP_LOCALES as readonly unknown[]).includes(value);
}

export function toAppLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}

/** BCP 47 tag for Intl number and date formatting. */
export function intlLocale(locale: string): string {
  switch (locale) {
    case "ru":
      return "ru-RU";
    case "es":
      return "es-ES";
    case "pt-BR":
      return "pt-BR";
    case "de":
      return "de-DE";
    case "fr":
      return "fr-FR";
    case "it":
      return "it-IT";
    default:
      return "en-US";
  }
}
