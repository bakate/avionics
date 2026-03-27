import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from "@/i18n/types";
import English from "./dictionaries/en-GB.json";
import French from "./dictionaries/fr.json";

// Migrate existing 'en' preference to 'en-GB' automatically
try {
  const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (storedLocale === "en") {
    localStorage.setItem(LOCALE_STORAGE_KEY, "en-GB");
  }
} catch {
  // Ignore localStorage access errors (e.g. strict privacy modes)
}

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "en-GB": { translation: English },
      fr: { translation: French },
    },
    fallbackLng: DEFAULT_LOCALE,
    detection: {
      order: ["querystring", "localStorage", "navigator"],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

export default i18next;
