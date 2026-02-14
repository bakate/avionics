import { Link } from "react-router";
import { buildRoute } from "../routes.ts";

const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="mt-2 text-lg text-gray-600">
        Oups ! La page que tu cherches n'existe pas.
      </p>
      <Link
        to={buildRoute.home()}
        className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Retour à l'accueil
      </Link>
    </div>
  );
};

export default NotFoundPage;
