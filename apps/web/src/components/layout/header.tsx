import { Link } from "react-router";
import { buildRoute } from "../../routes.ts";

const Header = () => {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link
          to={buildRoute.home()}
          className="text-xl font-bold tracking-tight text-blue-600"
        >
          Avionics
        </Link>
        <nav className="flex items-center gap-4">
          {/* Language switcher placeholder — implemented in task 15 */}
        </nav>
      </div>
    </header>
  );
};

export default Header;
