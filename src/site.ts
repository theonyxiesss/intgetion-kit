export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}

export function localePrefix(locale: string, defaultLocale = "en"): string {
  return locale === defaultLocale ? "" : `/${locale}`;
}
