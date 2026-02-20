// Date carousel — ~7 days centered on selected date with lowest price per day

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@workspace/ui/lib/utils";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

export type DatePrice = {
  readonly date: string;
  readonly lowestPrice: {
    readonly amount: number;
    readonly currency: string;
  } | null;
};

export type DateCarouselProps = {
  readonly selectedDate: string;
  readonly prices: ReadonlyArray<DatePrice>;
  readonly onDateChange: (date: string) => void;
  readonly isLoading?: boolean;
};

const formatDay = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short" });
};

const formatShortDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export const DateCarousel = ({
  selectedDate,
  prices,
  onDateChange,
  isLoading,
}: DateCarouselProps) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 120, behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Desktop arrows */}
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        className="hidden md:flex size-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 min-h-[44px] min-w-[44px]"
        aria-label={t("common.back")}
      >
        <ArrowLeft01Icon style={{ width: 16, height: 16 }} />
      </button>

      <div
        ref={scrollRef}
        className="flex flex-1 gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-1 px-1"
      >
        {prices.map((dp) => {
          const isSelected = dp.date === selectedDate;
          return (
            <button
              key={dp.date}
              type="button"
              onClick={() => onDateChange(dp.date)}
              disabled={isLoading}
              className={cn(
                "flex min-w-[90px] snap-center flex-col items-center rounded-lg px-3 py-2 text-center transition-all min-h-[44px]",
                isSelected
                  ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-300"
                  : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-blue-200 hover:bg-blue-50",
                isLoading && "opacity-60 cursor-wait",
              )}
              aria-current={isSelected ? "date" : undefined}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                {formatDay(dp.date)}
              </span>
              <span className="text-xs font-semibold">
                {formatShortDate(dp.date)}
              </span>
              {dp.lowestPrice ? (
                <span
                  className={cn(
                    "text-sm font-bold mt-0.5",
                    isSelected ? "text-white" : "text-gray-900",
                  )}
                >
                  {dp.lowestPrice.amount} {dp.lowestPrice.currency}
                </span>
              ) : (
                <span className="text-[10px] mt-0.5 opacity-50">—</span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => scrollBy(1)}
        className="hidden md:flex size-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 min-h-[44px] min-w-[44px]"
        aria-label={t("common.back")}
      >
        <ArrowRight01Icon style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
};
