import { Outlet } from "react-router";
import Header from "./header.tsx";
import StepIndicator from "./step-indicator.tsx";

export const BaseLayout = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <StepIndicator />
      <main className="mx-auto w-full max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
};
