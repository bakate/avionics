import { LanguageSquareIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { SUPPORTED_LOCALES } from "../../i18n/types.ts";
import { buildRoute } from "../../routes.ts";

const FLAGS: Record<string, string> = {
  fr: "🇫🇷",
  en: "🇺🇸",
};

const Header = () => {
  const { i18n } = useTranslation();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white dark:bg-gray-900">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link
          to={buildRoute.home()}
          className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400"
        >
          Avionics
        </Link>
        <nav className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon">
                  <HugeiconsIcon
                    icon={LanguageSquareIcon}
                    size={24}
                    color="currentColor"
                    strokeWidth={1.5}
                  />
                  <span className="sr-only">Switch Language</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {SUPPORTED_LOCALES.map((locale) => (
                <DropdownMenuItem
                  key={locale}
                  onClick={() => i18n.changeLanguage(locale)}
                  className="cursor-pointer"
                >
                  <span className="mr-2 text-lg">{FLAGS[locale]}</span>
                  <span className="uppercase">{locale}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ModeToggle />
        </nav>
      </div>
    </header>
  );
};

export default Header;
