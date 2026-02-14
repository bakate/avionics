import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import English from "./dictionaries/en.json";
import French from "./dictionaries/fr.json";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from "./types.ts";

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: English },
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
