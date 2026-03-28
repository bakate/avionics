import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import { I18nextProvider as I18nProvider } from "react-i18next";
import { createBrowserRouter, RouterProvider } from "react-router";
import { BaseLayout } from "@/components/layout/base-layout";
import { GlobalErrorFallback } from "@/components/shared/global-error-fallback";
import { bookingActor } from "@/features/booking/machines/booking.actor";
import { BookingDetailsPage } from "@/features/booking/pages/booking-details.page";
import { OutboundScreen } from "@/features/booking/screens/outbound.screen";
import { ReturnScreen } from "@/features/booking/screens/return.screen";
import HomePage from "@/features/search/screens/home.screen";
import NotFoundPage from "@/features/search/screens/not-found.screen";
import i18n from "@/i18n/config";
import CancelPage from "@/pages/cancel.page";
import ConfirmationPage from "@/pages/confirmation.page";
import PassengersPage from "@/pages/passengers.page";
import PaymentPage from "@/pages/payment.page";
import SuccessPage from "@/pages/success.page";
import { ROUTES } from "@/routes";
import { LAST_EMAIL_KEY } from "./features/booking/machines/booking.persistence";
import { StressTestPage } from "./features/stress-test/pages/stress-test.page";

const router = createBrowserRouter([
  {
    element: <BaseLayout />,
    errorElement: <GlobalErrorFallback />,
    children: [
      {
        path: ROUTES.home,
        loader: async () => {
          const state = bookingActor.getSnapshot();
          if (state.matches("idle") || state.matches("error")) {
            const savedEmail = localStorage.getItem(LAST_EMAIL_KEY);
            bookingActor.send({
              type: "FETCH_BOOKINGS",
              email: savedEmail ?? undefined,
            });
          }
          return null;
        },
        element: <HomePage />,
      },
      { path: ROUTES.outbound, element: <OutboundScreen /> },
      { path: ROUTES.return, element: <ReturnScreen /> },
      { path: ROUTES.passengers, element: <PassengersPage /> },
      { path: ROUTES.payment, element: <PaymentPage /> },
      { path: ROUTES.confirmation, element: <ConfirmationPage /> },
      { path: ROUTES.success, element: <SuccessPage /> },
      { path: ROUTES.cancel, element: <CancelPage /> },
      { path: ROUTES.stressTest, element: <StressTestPage /> },
      {
        path: ROUTES.bookingDetails,
        loader: async ({ params }) => {
          if (params.id) {
            const state = bookingActor.getSnapshot();
            // Don't refetch if already fetched/fetching this PNR
            if (
              state.context.pnrToFetch !== params.id ||
              state.matches("idle") ||
              state.matches("error")
            ) {
              bookingActor.send({
                type: "FETCH_BOOKING_DETAILS",
                pnr: params.id,
              });
            }
          }
          return null;
        },
        element: <BookingDetailsPage />,
      },
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
