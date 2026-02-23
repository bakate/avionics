/**
 * Filter panel for flight results.
 */

import { FilterHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useTranslation } from "react-i18next";
import { cabinOptions } from "@/features/search/components/types";

export type FilterState = {
  cabinClass: string;
  maxStops: number | null;
  timeRange: [number, number] | null; // [minHour, maxHour]
};

export type FilterPanelProps = {
  readonly filters: FilterState;
  readonly onFiltersChange: (filters: FilterState) => void;
  readonly onClear: () => void;
};

export const FilterPanel = ({
  filters,
  onFiltersChange,
  onClear,
}: FilterPanelProps) => {
  const { t } = useTranslation();

  const handleCabinChange = (cabin: string) => {
    onFiltersChange({ ...filters, cabinClass: cabin });
  };

  return (
    <div className="space-y-8 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={FilterHorizontalIcon}
            size={16}
            className="text-blue-400"
          />
          <h3 className="text-sm font-bold uppercase tracking-wider dark:text-white">
            {t("search.filters")}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-auto p-0 text-xs font-medium text-slate-500 hover:bg-transparent hover:dark:text-white transition-colors"
        >
          {t("search.clearAll")}
        </Button>
      </div>

      {/* Cabin Class */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {t("search.cabinClass")}
        </p>
        <div className="flex flex-wrap gap-2">
          {cabinOptions
            .filter((opt) => opt.value !== "ALL")
            .map((opt) => (
              <Button
                key={opt.value}
                variant="ghost"
                size="sm"
                onClick={() => handleCabinChange(opt.value)}
                className={cn(
                  "h-auto px-3 py-1.5 text-xs font-medium transition-all",
                  filters.cabinClass === opt.value
                    ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/50 hover:bg-blue-600/30 hover:text-blue-300"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:dark:text-white",
                )}
              >
                {opt.label}
              </Button>
            ))}
        </div>
      </div>

      {/* Stops */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {t("search.stops")}
        </p>
        <div className="flex gap-2">
          {[0, 1].map((stop) => (
            <Button
              key={stop}
              variant="ghost"
              size="sm"
              onClick={() => onFiltersChange({ ...filters, maxStops: stop })}
              className={cn(
                "flex-1 py-2 text-xs font-medium transition-all",
                filters.maxStops === stop
                  ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/50 hover:bg-blue-600/30 hover:text-blue-300"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:dark:text-white",
              )}
            >
              {stop === 0 ? "Non-stop" : "1 stop max"}
            </Button>
          ))}
        </div>
      </div>
      {/* Time Range (Simplified for prototype) */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {t("search.departureTime")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Morning", range: [6, 12] as [number, number] },
            { label: "Afternoon", range: [12, 18] as [number, number] },
            { label: "Evening", range: [18, 24] as [number, number] },
            { label: "Night", range: [0, 6] as [number, number] },
          ].map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              size="sm"
              onClick={() =>
                onFiltersChange({ ...filters, timeRange: item.range })
              }
              className={cn(
                "w-full py-2 text-xs font-medium transition-all",
                filters.timeRange?.[0] === item.range[0]
                  ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/50 hover:bg-blue-600/30 hover:text-blue-300"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:dark:text-white",
              )}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
