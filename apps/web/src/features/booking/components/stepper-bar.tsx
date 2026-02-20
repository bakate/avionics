/**
 * Stepper bar — 5-step booking progress indicator using reui Stepper.
 * Steps: Recherche, Vol aller, Vol retour, Passagers, Paiement
 * Controlled by booking machine state via stateToStep.
 * Navigation disabled (no step skipping). Responsive.
 */

import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@workspace/ui/components/reui/stepper";
import { cn } from "@workspace/ui/lib/utils";
import { CheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { STEP_LABELS } from "../machines/booking.machine";

export type StepperBarProps = {
  readonly currentStep: number;
};

export const StepperBar = ({ currentStep }: StepperBarProps) => {
  const { t } = useTranslation();

  // 1-indexed value for the Stepper component
  const activeValue = Math.max(1, currentStep + 1);

  return (
    <Stepper value={activeValue} orientation="horizontal">
      <StepperNav className="flex items-center gap-1">
        {STEP_LABELS.map((labelKey, idx) => {
          const step = idx + 1;
          const isCompleted = currentStep > idx;

          return (
            <StepperItem
              key={labelKey}
              step={step}
              completed={isCompleted}
              disabled
            >
              <StepperTrigger asChild className="flex items-center gap-2">
                <span className="flex items-center gap-2">
                  <StepperIndicator
                    className={cn(
                      "size-7 text-xs",
                      isCompleted && "bg-emerald-600 text-white",
                    )}
                  >
                    {isCompleted ? <CheckIcon className="size-3.5" /> : step}
                  </StepperIndicator>
                  <StepperTitle className="hidden text-xs md:inline">
                    {t(labelKey)}
                  </StepperTitle>
                </span>
              </StepperTrigger>
              {idx < STEP_LABELS.length - 1 && <StepperSeparator />}
            </StepperItem>
          );
        })}
      </StepperNav>
    </Stepper>
  );
};
