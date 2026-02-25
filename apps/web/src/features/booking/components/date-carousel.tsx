// Date carousel — ~7 days centered on selected date with lowest price per day

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@workspace/ui/lib/utils";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { type DatePrice } from "@/api/inventory.api";

export type DateCarouselProps = {
  readonly selectedDate: string;
  readonly prices: ReadonlyArray<DatePrice>;
  readonly onDateChange: (date: string) => void;
  readonly onPrevious?: () => void;
  readonly onNext?: () => void;
  readonly passengers: { adults: number; children: number; infants: number };
  readonly isLoading?: boolean;
};

const formatDay = (iso: string, locale?: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { weekday: "short" });
};

const formatShortDate = (iso: string, locale?: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
};

export const DateCarousel = ({
  selectedDate,
  prices,
  onDateChange,
  onPrevious,
  onNext,
  passengers,
  isLoading,
}: DateCarouselProps) => {
  const { t, i18n } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 120, behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Desktop arrows */}
      <button
        type="button"
        onClick={onPrevious ? onPrevious : () => scrollBy(-1)}
        className="hidden md:flex size-10 items-center justify-center rounded-full border border-border/50 bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95 transition-all shadow-sm shrink-0"
        aria-label={t("common.back")}
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
      </button>

      <div
        ref={scrollRef}
        className="flex flex-1 gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-2 px-1"
      >
        {prices
          .filter((dp) => dp.lowestPrice !== null)
          .map((dp) => {
            const isSelected = dp.date === selectedDate;
            const hasFlights = dp.lowestPrice !== null;
            return (
              <button
                key={dp.date}
                type="button"
                onClick={() => onDateChange(dp.date)}
                disabled={isLoading || !hasFlights}
                className={cn(
                  "flex flex-1 min-w-[90px] snap-center flex-col items-center justify-center rounded-xl px-2 py-3 text-center transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/30 scale-[1.02]"
                    : "bg-card text-card-foreground ring-1 ring-border/50",
                  !isSelected &&
                    hasFlights &&
                    "hover:bg-accent hover:text-accent-foreground hover:ring-accent",
                  !hasFlights &&
                    "opacity-40 cursor-not-allowed bg-muted/50 grayscale",
                  isLoading && "opacity-60 cursor-wait",
                )}
                aria-current={isSelected ? "date" : undefined}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80 mb-1">
                  {formatDay(dp.date, i18n.language)}
                </span>
                <span className="text-sm font-bold">
                  {formatShortDate(dp.date, i18n.language)}
                </span>
                {dp.lowestPrice ? (
                  <span
                    className={cn(
                      "text-xs font-semibold mt-1",
                      isSelected
                        ? "text-primary-foreground/90"
                        : "text-muted-foreground",
                    )}
                  >
                    {Number(
                      (
                        dp.lowestPrice.amount *
                        (passengers.adults * 1.0 + passengers.children * 0.75)
                      ).toFixed(2),
                    )}{" "}
                    {dp.lowestPrice.currency}
                  </span>
                ) : (
                  <span className="text-[10px] mt-1 opacity-50">—</span>
                )}
              </button>
            );
          })}
      </div>

      <button
        type="button"
        onClick={onNext ? onNext : () => scrollBy(1)}
        className="hidden md:flex size-10 items-center justify-center rounded-full border border-border/50 bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground active:scale-95 transition-all shadow-sm shrink-0"
        aria-label={t("common.next")}
      >
        <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
      </button>
    </div>
  );
};
