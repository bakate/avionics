import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { cn } from "@workspace/ui/lib/utils";
import { useTranslation } from "react-i18next";

import { SUPPORTED_LOCALES } from "../../i18n/types";

export function LanguageSelector() {
  const { i18n, t } = useTranslation();

  const languages = SUPPORTED_LOCALES.map(
    (locale) =>
      ({
        code: locale,
        name: locale,
        flag: locale === "fr" ? "fr" : "us",
      }) as const,
  );

  const currentLanguage =
    languages.find((lang) => lang.code === i18n.language) ?? languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 p-0 hover:bg-accent"
        >
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
        </Button>
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
