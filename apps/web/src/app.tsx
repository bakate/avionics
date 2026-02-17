import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import { I18nextProvider as I18nProvider } from "react-i18next";
import { createBrowserRouter, RouterProvider } from "react-router";
import BaseLayout from "./components/layout/base-layout.tsx";
import i18n from "./i18n/config.ts";
import { bookingActor } from "./machines/booking.actor.ts";
import ConfirmationPage from "./pages/confirmation.page.tsx";
import HomePage from "./pages/home.page.tsx";
import NotFoundPage from "./pages/not-found.page.tsx";
import PassengersPage from "./pages/passengers.page.tsx";
import PaymentPage from "./pages/payment.page.tsx";
import ResultsPage from "./pages/results.page.tsx";
import SelectPage from "./pages/select.page.tsx";
import { ROUTES } from "./routes.ts";

const router = createBrowserRouter([
  {
    element: <BaseLayout />,
    children: [
      {
        path: ROUTES.home,
        loader: async () => {
          const state = bookingActor.getSnapshot();
          if (state.matches("idle") || state.matches("error")) {
            bookingActor.send({ type: "FETCH_BOOKINGS" });
          }
          return null;
        },
        element: <HomePage />,
      },
      { path: ROUTES.results, element: <ResultsPage /> },
      { path: ROUTES.select, element: <SelectPage /> },
      { path: ROUTES.passengers, element: <PassengersPage /> },
      { path: ROUTES.payment, element: <PaymentPage /> },
      { path: ROUTES.confirmation, element: <ConfirmationPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

const App = () => {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <I18nProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nProvider>
    </ThemeProvider>
  );
};

export default App;
