import {
  AirplaneLanding01Icon,
  AirplaneTakeOff01Icon,
  CreditCardIcon,
  SearchSquareIcon,
  Tick02Icon,
  UserSquareIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@workspace/ui/components/reui/stepper";
import { useTranslation } from "react-i18next";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import {
  type BookingStateValue,
  stateToStep,
} from "@/features/booking/machines/booking.machine";

const STEPS = [
  {
    title: "steps.search",
    icon: (
      <HugeiconsIcon
        icon={SearchSquareIcon}
        strokeWidth={2}
        className="size-4"
      />
    ),
  },
  {
    title: "steps.outbound",
    icon: (
      <HugeiconsIcon
        icon={AirplaneTakeOff01Icon}
        strokeWidth={2}
        className="size-4"
      />
    ),
  },
  {
    title: "steps.return",
    icon: (
      <HugeiconsIcon
        icon={AirplaneLanding01Icon}
        strokeWidth={2}
        className="size-4"
      />
    ),
  },
  {
    title: "steps.passengers",
    icon: (
      <HugeiconsIcon icon={UserSquareIcon} strokeWidth={2} className="size-4" />
    ),
  },
  {
    title: "steps.payment",
    icon: (
      <HugeiconsIcon icon={CreditCardIcon} strokeWidth={2} className="size-4" />
    ),
  },
] as const;

export const StepIndicator = () => {
  const { t } = useTranslation();
  const { state } = useBookingMachine();

  const activeStep = stateToStep(state as BookingStateValue) + 1;

  return (
    <Stepper
      value={activeStep}
      className="max-w-7xl backdrop-blur-sm mx-auto bg-neutral-50 dark:bg-neutral-900 rounded-sm space-y-8 w-full mt-3 px-3"
    >
      <StepperNav className="gap-3">
        {STEPS.map((step, index) => (
          <StepperItem
            step={index + 1}
            className="flex-1 items-start relative"
            key={step.title}
          >
            <StepperTrigger
              className="flex grow flex-col items-start justify-center gap-2.5"
              asChild
            >
              <StepperIndicator className="data-[state=inactive]:border-border data-[state=inactive]:text-muted-foreground data-[state=completed]:bg-success size-8 border-2 data-[state=completed]:text-white data-[state=inactive]:bg-transparent">
                {activeStep > index + 1 || state === "confirmed" ? (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={2}
                    className="size-4"
                  />
                ) : (
                  step.icon
                )}
              </StepperIndicator>
              <StepperTitle>{t(step.title)}</StepperTitle>
            </StepperTrigger>
            {STEPS.length > index + 1 ? (
              <StepperSeparator className="group-data-[state=completed]/step:bg-success absolute inset-x-0 start-9 top-4 m-0 group-data-[orientation=horizontal]/stepper-nav:w-[calc(100%-2rem)] group-data-[orientation=horizontal]/stepper-nav:flex-none" />
            ) : null}
          </StepperItem>
        ))}
      </StepperNav>
    </Stepper>
  );
};
