/** biome-ignore-all lint/style/noRestrictedImports: <explanation> */
/**
 * Results page — Displays flight search results with filtering and sorting.
 * Requirements: 1.2, 1.3, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4
 */

import { type CabinClass } from "@workspace/domain/kernel";
import { Option } from "effect";
import {
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import {
  FilterPanel,
  type FilterState,
} from "../components/flights/filter-panel";
import { FlightCard } from "../components/flights/flight-card";
import {
  SortControls,
  type SortField,
  type SortOrder,
} from "../components/flights/sort-controls";
import { useBookingMachine } from "../hooks/use-booking-machine";
import { useFlightStream } from "../hooks/use-flight-stream";
import { buildRoute } from "../routes";
import { type SearchParams } from "../schemas/search.schema";
import { filterFlights, sortFlights } from "./results-logic";

const ResultsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const { send } = useBookingMachine();
  const { flights, isLoading, error, search, isComplete } = useFlightStream();

  // --- Search Params Decoding ---
  const searchParams = useMemo((): SearchParams | null => {
    try {
      const raw: Record<string, unknown> = {
        origin: urlParams.get("origin"),
        destination: urlParams.get("destination"),
        departureDate: urlParams.get("departureDate")
          ? new Date(urlParams.get("departureDate") ?? "")
          : undefined,
        passengerCount: Number.parseInt(
          urlParams.get("passengerCount") || "1",
          10,
        ),
      };

      const retDate = urlParams.get("returnDate");
      if (retDate) raw.returnDate = new Date(retDate);

      const cabin = urlParams.get("cabinClass");
      if (cabin) raw.cabinClass = cabin;

      // We use a lenient decode here or manual check because URL params are strings
      // For brevity in prototype, we'll assume they are mostly correct if they come from SearchForm
      return {
        origin: raw.origin as string as any,
        destination: raw.destination as string as any,
        departureDate: raw.departureDate as Date,
        returnDate: raw.returnDate
          ? Option.some(raw.returnDate as Date)
          : Option.none(),
        passengerCount: raw.passengerCount as number,
        cabinClass: raw.cabinClass
          ? Option.some(raw.cabinClass as CabinClass)
          : Option.none(),
      };
    } catch (_e) {
      return null;
    }
  }, [urlParams]);

  // Trigger search on mount or params change
  useEffect(() => {
    if (searchParams) {
      search(searchParams);
    }
  }, [searchParams, search]);

  // --- Local State: Sorting & Filtering ---
  const [sortField, setSortField] = useState<SortField>("price");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filters, setFilters] = useState<FilterState>({
    cabinClass: urlParams.get("cabinClass") || "ECONOMY",
    maxStops: 1,
    timeRange: null,
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // --- Logic: Filter & Sort ---
  const filteredAndSortedFlights = useMemo(() => {
    const filtered = filterFlights(flights, filters);
    return sortFlights(
      filtered,
      sortField,
      sortOrder,
      filters.cabinClass as CabinClass,
    );
  }, [flights, sortField, sortOrder, filters]);

  const handleSelect = (flightId: string) => {
    const flight = flights.find((f) => f.flightId === flightId);
    if (!flight) return;

    send({
      type: "SELECT_FLIGHT",
      flight,
    });

    send({
      type: "SELECT_CABIN",
      cabin: filters.cabinClass as CabinClass,
    });
  };

  if (!searchParams) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center p-4">
        <AlertCircle className="mb-4 h-12 w-12 text-red-500" />
        <h2 className="text-xl font-bold text-white">
          {t("error.invalidParams")}
        </h2>
        <button
          type="button"
          onClick={() => navigate(buildRoute.home())}
          className="mt-4 rounded-xl bg-blue-600 px-6 py-2 text-sm font-bold text-white"
        >
          {t("search.backToHome")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header Info */}
      <div className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(buildRoute.home())}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h1 className="flex items-center gap-2 text-lg font-bold text-white md:text-xl">
                {searchParams.origin}
                <span className="text-slate-600">→</span>
                {searchParams.destination}
              </h1>
              <p className="text-xs font-medium text-slate-500">
                {new Date(searchParams.departureDate).toLocaleDateString()} •{" "}
                {searchParams.passengerCount}{" "}
                {t("search.passengers").toLowerCase()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar / Filters (Desktop) */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <FilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              onClear={() =>
                setFilters({
                  cabinClass: "ECONOMY",
                  maxStops: 1,
                  timeRange: null,
                })
              }
            />
          </aside>

          {/* Main List */}
          <div className="flex-1 space-y-6">
            <div className="flex flex-col gap-4 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <SortControls
                currentField={sortField}
                currentOrder={sortOrder}
                onSortChange={(f, o) => {
                  setSortField(f);
                  setSortOrder(o);
                }}
              />
              <button
                type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center justify-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-xs font-bold text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {t("search.filters").toUpperCase()}
              </button>
            </div>

            {/* Mobile Filter Panel (Collapsible) */}
            {isFilterOpen && (
              <div className="lg:hidden">
                <FilterPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  onClear={() =>
                    setFilters({
                      cabinClass: "ECONOMY",
                      maxStops: 1,
                      timeRange: null,
                    })
                  }
                />
              </div>
            )}

            {/* Loading State */}
            {isLoading && flights.length === 0 && (
              <div className="flex h-64 flex-col items-center justify-center gap-4">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm font-medium text-slate-500">
                  {t("search.searching")}
                </p>
              </div>
            )}

            {/* Error State */}
            {error && flights.length === 0 && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
                <h3 className="mb-2 text-lg font-bold text-white">
                  {t("error.searchFailed")}
                </h3>
                <p className="mb-6 text-sm text-slate-400">{error}</p>
                <button
                  type="button"
                  onClick={() => search(searchParams)}
                  className="rounded-xl bg-red-600 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-red-500"
                >
                  {t("common.retry")}
                </button>
              </div>
            )}

            {/* Empty State */}
            {isComplete && flights.length === 0 && !error && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-sm">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                  <RefreshCw className="h-8 w-8 text-slate-600" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-white">
                  {t("search.noFlights")}
                </h3>
                <p className="mb-8 text-sm text-slate-500">
                  {t("search.tryDifferentDates")}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(buildRoute.home())}
                  className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-blue-500"
                >
                  {t("search.modifySearch")}
                </button>
              </div>
            )}

            {/* Flight List */}
            <div className="grid gap-4">
              {filteredAndSortedFlights.map((flight) => (
                <FlightCard
                  key={flight.flightId}
                  flight={flight}
                  selectedCabin={filters.cabinClass as CabinClass}
                  origin={searchParams.origin}
                  destination={searchParams.destination}
                  onSelect={handleSelect}
                />
              ))}
            </div>

            {/* Streaming Indicator */}
            {isLoading && flights.length > 0 && (
              <div className="flex items-center justify-center gap-3 py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-xs font-medium text-slate-500">
                  {t("search.loadingMore")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
