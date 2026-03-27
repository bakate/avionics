import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
import { useTranslation } from "react-i18next";

import { type Locale, SUPPORTED_LOCALES } from "@/i18n/types";

const LOCALE_METADATA: Record<Locale, { name: string; flag: string }> = {
  fr: { name: "fr", flag: "fr" },
  "en-GB": { name: "en", flag: "gb" },
};

export function LanguageSelector() {
  const { i18n, t } = useTranslation();

  const languages = SUPPORTED_LOCALES.map((locale) => {
    const fallback = { name: locale, flag: "gb" };
    return {
      code: locale,
      ...(LOCALE_METADATA[locale] ?? fallback),
    };
  });

  const currentLanguage =
    languages.find((lang) => lang.code === i18n.language) ?? languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:cursor-pointer">
        {currentLanguage && (
          <img
            src={`https://flagcdn.com/${currentLanguage.flag}.svg`}
            alt={`Flag of ${currentLanguage.name}`}
            width={20}
            height={20}
            className="size-6 object-contain"
          />
        )}
        <span className="sr-only">{t("language.switch")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[100px]">
        {languages.map((lang) => (
          <DropdownMenuCheckboxItem
            key={lang.code}
            className={cn(
              "flex items-center gap-2 hover:bg-accent hover:cursor-pointer",
              i18n.language === lang.code ? "bg-accent" : "",
            )}
            checked={i18n.language === lang.code}
            onCheckedChange={() => i18n.changeLanguage(lang.code)}
          >
            <img
              src={`https://flagcdn.com/${lang.flag}.svg`}
              alt={`Flag of ${lang.name}`}
              width={16}
              height={16}
              className="size-5 object-contain"
            />
            {lang.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
