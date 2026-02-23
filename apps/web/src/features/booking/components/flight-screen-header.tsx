import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/format";

export type FlightScreenHeaderProps = {
  readonly origin: string;
  readonly destination: string;
  readonly date: string;
  readonly passengersCount: number;
  readonly stepLabel: string;
  readonly onBack: () => void;
};

export const FlightScreenHeader = ({
  origin,
  destination,
  date,
  passengersCount,
  stepLabel,
  onBack,
}: FlightScreenHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all shrink-0"
            aria-label={t("common.back")}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
          </Button>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-lg font-bold text-foreground md:text-xl">
              <span className="mr-2 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {stepLabel}
              </span>
              {origin}
              <span className="text-muted-foreground">→</span>
              {destination}
            </h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">
              {date ? formatDate(new Date(date)) : ""} • {passengersCount}{" "}
              {t("search.passengers").toLowerCase()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
