import { Outlet, useLocation } from "react-router";
import { Header } from "@/components/layout/header";
import { StepIndicator } from "@/components/layout/step-indicator";

export const BaseLayout = () => {
  const pathname = useLocation().pathname;

  const STEPPER_EXCLUDED: Array<string | RegExp> = [
    "/",
    "/cancel",
    "/stress-test",
    /^\/booking\//,
  ];

  const shouldHideStepper = STEPPER_EXCLUDED.some((rule) =>
    typeof rule === "string" ? rule === pathname : rule.test(pathname),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {shouldHideStepper ? null : <StepIndicator />}
      <main className="mx-auto w-full max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
};
