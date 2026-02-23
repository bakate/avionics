import { Outlet, useLocation } from "react-router";
import Header from "./header.tsx";
import { StepIndicator } from "./step-indicator.tsx";

export const BaseLayout = () => {
  const pathname = useLocation().pathname;
  const excludedStepperRoutes = ["/", "/cancel"];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {excludedStepperRoutes.includes(pathname) ? null : <StepIndicator />}
      <main className="mx-auto w-full max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
};
