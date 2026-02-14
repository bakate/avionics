import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { SUPPORTED_LOCALES } from "../../i18n/types.ts";
import { buildRoute } from "../../routes.ts";

const Header = () => {
  const { i18n } = useTranslation();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link
          to={buildRoute.home()}
          className="text-xl font-bold tracking-tight text-blue-600"
        >
          Avionics
        </Link>
        <nav className="flex items-center gap-2">
          {SUPPORTED_LOCALES.map((locale) => (
            <button
              key={locale}
              type="button"
              onClick={() => i18n.changeLanguage(locale)}
              className={`px-2 py-1 text-sm font-medium uppercase transition-colors rounded-md ${
                i18n.resolvedLanguage === locale
                  ? "bg-blue-100 text-blue-600"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {locale}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Header;
