import { Outlet } from "react-router";
import Header from "./header.tsx";
import StepIndicator from "./step-indicator.tsx";

const BaseLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <Header />
      <StepIndicator />
      <main className="mx-auto w-full max-w-7xl flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default BaseLayout;
