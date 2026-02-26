import {
  Activity01Icon,
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
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white dark:bg-gray-900">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link
          to={buildRoute.home()}
          className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400"
        >
          Avionics
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-4">
          <Link
            to={buildRoute.stressTest()}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
          >
            <HugeiconsIcon icon={Activity01Icon} size={18} />
            Stress Test
          </Link>
          <div
            className="h-6 w-px bg-gray-200 dark:bg-gray-800"
            aria-hidden="true"
          />
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
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
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
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 space-y-4 shadow-lg top-16 absolute w-full left-0 z-40">
          <Link
            to={buildRoute.stressTest()}
            className="flex items-center gap-2 text-base font-medium text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
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
      )}
    </header>
  );
};
