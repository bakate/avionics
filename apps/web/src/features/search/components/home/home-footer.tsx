import { Airplane01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export const HomeFooter = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-slate-100 py-24 text-center dark:border-slate-900 bg-white dark:bg-background">
      {/* Brand / Logo Section */}
      <div className="flex items-center justify-center gap-4 text-4xl font-medium tracking-tighter text-slate-200 dark:text-slate-800 transition-colors hover:text-slate-300">
        <HugeiconsIcon icon={Airplane01Icon} size={36} className="rotate-45" />
        <span className="font-heading uppercase tracking-widest text-shadow-premium">
          {t("header.brand")}
        </span>
      </div>

      <p className="mt-4 text-[9px] font-bold tracking-[0.5em] text-slate-400 uppercase">
        {t("home.footer.tagline")}
      </p>

      {/* Navigation Section */}
      <nav className="mt-12 flex items-center justify-center gap-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        <Link
          to="/"
          className="hover:text-royal-blue transition-colors cursor-pointer"
        >
          {t("home.footer.privacy")}
        </Link>

        <span
          className="w-1 h-1 rounded-full bg-slate-200"
          aria-hidden="true"
        />

        <Link
          to="/"
          className="hover:text-royal-blue transition-colors cursor-pointer"
        >
          {t("home.footer.terms")}
        </Link>

        <span
          className="w-1 h-1 rounded-full bg-slate-200"
          aria-hidden="true"
        />

        <Link
          to="/"
          className="hover:text-royal-blue transition-colors cursor-pointer"
        >
          {t("home.footer.contact")}
        </Link>
      </nav>
    </footer>
  );
};
