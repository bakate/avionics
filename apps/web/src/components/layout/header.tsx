import {
  Activity01Icon,
  Airplane01Icon,
  Cancel01Icon,
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ModeToggle } from "@workspace/ui/components/mode-toggle";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { LanguageSelector } from "@/components/layout/language-selector";
import { buildRoute } from "@/routes";

export const Header = () => {
  const { t } = useTranslation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 glass-premium">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link
          to={buildRoute.home()}
          className="flex items-center gap-2 text-xl font-bold tracking-tight text-primary transition-all hover:scale-105 active:scale-95"
        >
          <HugeiconsIcon
            icon={Airplane01Icon}
            size={20}
            className="rotate-45"
          />
          Avionics
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-4">
          <Link
            to={buildRoute.stressTest()}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
          >
            <HugeiconsIcon icon={Activity01Icon} size={18} />
            Stress Test
          </Link>
          <div className="h-6 w-px bg-border/60" aria-hidden="true" />
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

        {/* Mobile Nav Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <LanguageSelector />
          <button
            type="button"
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors duration-200"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <HugeiconsIcon icon={Cancel01Icon} size={24} />
            ) : (
              <HugeiconsIcon icon={Menu01Icon} size={24} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen ? (
        <div className="md:hidden border-t border-gray-200/60 dark:border-gray-800/60 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-4 py-4 space-y-4 shadow-lg top-16 absolute w-full left-0 z-40">
          <Link
            to={buildRoute.stressTest()}
            className="flex items-center gap-2 text-base font-medium text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-colors duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <HugeiconsIcon icon={Activity01Icon} size={20} />
            Stress Test
          </Link>
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Theme
            </span>
            <ModeToggle
              labels={{
                light: t("theme.light"),
                dark: t("theme.dark"),
                system: t("theme.system"),
                toggle: t("theme.toggle"),
              }}
            />
          </div>
        </div>
      ) : null}
    </header>
  );
};
