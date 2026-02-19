import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { buildRoute } from "../../routes.ts";

import { LanguageSelector } from "./language-selector";

const Header = () => {
  const { t } = useTranslation();

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
          <LanguageSelector />
          <ModeToggle
            labels={{
              light: t("theme.light"),
              dark: t("theme.dark"),
              system: t("theme.system"),
              toggle: t("theme.toggle"),
            }}
          />
        </nav>
      </div>
    </header>
  );
};

export default Header;
