export type Locale = "fr" | "en";

export const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ["fr", "en"] as const;

export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALE_STORAGE_KEY = "avionics:locale";
