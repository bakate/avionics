// Step indicator placeholder — full implementation in task 13.
// Displays the current position in the booking flow.

import { useTranslation as useI18n } from "react-i18next";

const STEPS = [
  "steps.search",
  "steps.select",
  "steps.passengers",
  "steps.payment",
  "steps.confirmation",
] as const;

type StepIndicatorProps = {
  currentStep?: number;
};

const StepIndicator = ({ currentStep = 0 }: StepIndicatorProps) => {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("steps.aria.label")}
      className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3"
    >
      {STEPS.map((label, index) => {
        const state =
          index < currentStep
            ? t("steps.state.completed")
            : index === currentStep
              ? t("steps.state.current")
              : t("steps.state.upcoming");
        const isCurrent = index === currentStep;

        return (
          <div
            key={label}
            aria-current={isCurrent ? "step" : undefined}
            className="flex items-center gap-2"
          >
            <span className="sr-only">{state}</span>
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                index <= currentStep
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {index + 1}
            </span>
            <span
              className={`hidden text-sm md:inline ${
                index <= currentStep
                  ? "font-medium text-gray-900"
                  : "text-gray-400"
              }`}
            >
              {t(label)}
            </span>
          </div>
        );
      })}
    </nav>
  );
};

export default StepIndicator;
