import { BrowserRouter, Route, Routes } from "react-router";
import BaseLayout from "./components/layout/base-layout.tsx";
import ConfirmationPage from "./pages/confirmation.page.tsx";
import HomePage from "./pages/home.page.tsx";
import NotFoundPage from "./pages/not-found.page.tsx";
import PassengersPage from "./pages/passengers.page.tsx";
import PaymentPage from "./pages/payment.page.tsx";
import ResultsPage from "./pages/results.page.tsx";
import SelectPage from "./pages/select.page.tsx";
import { ROUTES } from "./routes.ts";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<BaseLayout />}>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.results} element={<ResultsPage />} />
          <Route path={ROUTES.select} element={<SelectPage />} />
          <Route path={ROUTES.passengers} element={<PassengersPage />} />
          <Route path={ROUTES.payment} element={<PaymentPage />} />
          <Route path={ROUTES.confirmation} element={<ConfirmationPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
