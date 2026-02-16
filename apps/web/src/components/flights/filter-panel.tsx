/**
 * Filter panel for flight results.
 * Requirements: 2.3
 */
import { Filter } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cabinOptions } from "../search/types";

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
          <Filter className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            {t("search.filters")}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-slate-500 hover:text-white transition-colors"
        >
          {t("search.clearAll")}
        </button>
      </div>

      {/* Cabin Class */}
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {t("search.cabinClass")}
        </p>
        <div className="flex flex-wrap gap-2">
          {cabinOptions
            .filter((opt) => opt.value !== "")
            .map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleCabinChange(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  filters.cabinClass === opt.value
                    ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/50"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
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
            <button
              key={stop}
              type="button"
              onClick={() => onFiltersChange({ ...filters, maxStops: stop })}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                filters.maxStops === stop
                  ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/50"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {stop === 0 ? "Non-stop" : "1 stop max"}
            </button>
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
            <button
              key={item.label}
              type="button"
              onClick={() =>
                onFiltersChange({ ...filters, timeRange: item.range })
              }
              className={`rounded-lg py-2 text-xs font-medium transition-all ${
                filters.timeRange?.[0] === item.range[0]
                  ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/50"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
