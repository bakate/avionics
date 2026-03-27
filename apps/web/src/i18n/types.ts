export type Locale = "fr" | "en-GB";

export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = [
  "fr",
  "en-GB",
] as const;

export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_STORAGE_KEY = "avionics:locale";
