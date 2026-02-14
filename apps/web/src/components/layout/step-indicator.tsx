// Step indicator placeholder — full implementation in task 13.
// Displays the current position in the booking flow.

const STEPS = [
  "Recherche",
  "Sélection",
  "Passagers",
  "Paiement",
  "Confirmation",
] as const;

type StepIndicatorProps = {
  currentStep?: number;
};

const StepIndicator = ({ currentStep = 0 }: StepIndicatorProps) => {
  return (
    <nav
      aria-label="Étapes de réservation"
      className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3"
    >
      {STEPS.map((label, index) => {
        const state =
          index < currentStep
            ? "completed"
            : index === currentStep
              ? "current step"
              : "not started";
        const isCurrent = index === currentStep;

        return (
          <div key={label} className="flex items-center gap-2">
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                index <= currentStep
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              <span className="sr-only">{state}</span>
              {index + 1}
            </span>
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={`hidden text-sm md:inline ${
                index <= currentStep
                  ? "font-medium text-gray-900"
                  : "text-gray-400"
              }`}
            >
              <span className="sr-only">{state}</span>
              {label}
            </span>
          </div>
        );
      })}
    </nav>
  );
};

export default StepIndicator;
