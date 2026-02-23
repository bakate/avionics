/**
 * Results page — Displays flight search results with filtering and sorting.
 * Requirements: 1.2, 1.3, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4
 */

import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  FilterHorizontalIcon,
  ReloadIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type CabinClass } from "@workspace/domain/kernel";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { Spinner } from "@workspace/ui/components/spinner";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router";
import {
  FilterPanel,
  type FilterState,
} from "@/features/booking/components/filter-panel";
import { FlightCard } from "@/features/booking/components/flight-card";
import {
  SortControls,
  type SortField,
  type SortOrder,
} from "@/features/booking/components/sort-controls";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import { useFlightStream } from "@/features/booking/hooks/use-flight-stream";
import {
  decodeSearchParams,
  type SearchParams,
} from "@/features/booking/schemas/search.schema";
import { buildRoute } from "@/routes";
import { filterFlights, sortFlights } from "./results-logic";

const ResultsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();
  const { send, context } = useBookingMachine();
  const { flights, isLoading, error, search, isComplete } = useFlightStream();

  // --- Search Params Decoding ---
  const searchParams = useMemo((): SearchParams | null => {
    const raw = Object.fromEntries(urlParams.entries());
    try {
      if (urlParams.size === 0) return context.searchParams;
      return decodeSearchParams(raw);
    } catch (e) {
      console.error("Search params validation failed:", e);
      return context.searchParams;
    }
  }, [urlParams, context.searchParams]);

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

    const cabin = filters.cabinClass as CabinClass;
    const cabinData = flight.cabins.find((c) => c.cabin === cabin);
    if (!cabinData) return;

    send({
      type: "SELECT_OUTBOUND",
      selection: {
        flight,
        cabin,
        price: cabinData.price,
      },
    });
  };

  if (!searchParams) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center p-4">
        <HugeiconsIcon
          icon={AlertCircleIcon}
          size={48}
          className="mb-4 text-red-500"
        />
        <h2 className="text-xl font-bold">{t("error.invalidParams")}</h2>
        <Button onClick={() => navigate(buildRoute.home())}>
          {t("search.backToHome")}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header Info */}
      <div className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(buildRoute.home())}
              className="flex size-10 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 transition-all"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
            </Button>
            <div className="flex-1">
              <h1 className="flex items-center gap-2 text-lg font-bold dark:text-white md:text-xl">
                {searchParams.origin}
                <span className="text-slate-600">→</span>
                {searchParams.destination}
              </h1>
              <p className="text-xs font-medium text-slate-500">
                {new Date(searchParams.departureDate).toLocaleDateString()} •{" "}
                {searchParams.passengers.adults +
                  searchParams.passengers.children +
                  searchParams.passengers.infants}{" "}
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
              <Sheet>
                <SheetTrigger
                  render={
                    <Button
                      variant="outline"
                      className="flex items-center justify-center gap-2 lg:hidden"
                    >
                      <HugeiconsIcon icon={FilterHorizontalIcon} size={16} />
                      {t("search.filters").toUpperCase()}
                    </Button>
                  }
                />
                <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                  <SheetHeader>
                    <SheetTitle>{t("search.filters")}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
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
                </SheetContent>
              </Sheet>
            </div>

            {/* Loading State */}
            {isLoading && flights.length === 0 && (
              <div className="flex h-64 flex-col items-center justify-center gap-4">
                <Spinner className="size-8 text-blue-500" />
                <p className="text-sm font-medium text-slate-500">
                  {t("search.searching")}
                </p>
              </div>
            )}

            {/* Error State */}
            {error && flights.length === 0 && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
                <HugeiconsIcon
                  icon={AlertCircleIcon}
                  size={40}
                  className="mx-auto mb-4 text-red-500"
                />
                <h3 className="mb-2 text-lg font-bold text-white">
                  {t("error.searchFailed")}
                </h3>
                <p className="mb-6 text-sm text-slate-400">{error}</p>
                <Button
                  onClick={() => search(searchParams)}
                  className="rounded-xl bg-red-600 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-red-500"
                >
                  {t("common.retry")}
                </Button>
              </div>
            )}

            {/* Empty State */}
            {isComplete && flights.length === 0 && !error && (
              <Empty className="rounded-2xl border border-white/10 bg-white/5 p-12 backdrop-blur-sm">
                <EmptyMedia>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100/10 text-slate-600">
                    <HugeiconsIcon icon={ReloadIcon} size={32} />
                  </div>
                </EmptyMedia>
                <EmptyTitle className="text-lg font-bold text-white">
                  {t("search.noFlights")}
                </EmptyTitle>
                <EmptyDescription className="text-slate-500">
                  {t("search.tryDifferentDates")}
                </EmptyDescription>
                <Button
                  onClick={() => navigate(buildRoute.home())}
                  className="mt-6 rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-blue-500"
                >
                  {t("search.modifySearch")}
                </Button>
              </Empty>
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
                <Spinner className="size-4 text-blue-500" />
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
