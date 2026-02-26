import { Outlet, useLocation } from "react-router";
import { Header } from "@/components/layout/header";
import { StepIndicator } from "@/components/layout/step-indicator";

export const BaseLayout = () => {
  const pathname = useLocation().pathname;
  const excludedStepperRoutes = ["/", "/cancel", "/stress-test"];

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
