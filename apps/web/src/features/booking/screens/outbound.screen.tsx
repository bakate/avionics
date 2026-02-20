/**
 * Outbound flight selection screen.
 * Displays Date_Carousel, Flight_Results_Table, sort controls, and filter panel.
 * Dispatches SELECT_OUTBOUND / CHANGE_OUTBOUND_DATE to the booking machine.
 *
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  FilterPanel,
  type FilterState,
} from "../../../components/flights/filter-panel";
import {
  SortControls,
  type SortField,
  type SortOrder,
} from "../../../components/flights/sort-controls";
import { filterFlights, sortFlights } from "../../../pages/results-logic";
import { buildRoute } from "../../../routes";
import { DateCarousel, type DatePrice } from "../components/date-carousel";
import { FlightResultsTable } from "../components/flight-results-table";
import { useBookingMachine } from "../hooks/use-booking-machine";
import {
  createFlightSelection,
  type FlightResult,
} from "../machines/booking.machine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build ~7 day date prices from the flights currently loaded. */
const buildDatePrices = (
  selectedDate: string,
  flights: ReadonlyArray<FlightResult>,
): ReadonlyArray<DatePrice> => {
  if (!selectedDate || Number.isNaN(new Date(selectedDate).getTime())) {
    return [];
  }
  const center = new Date(selectedDate);
  const days: Array<DatePrice> = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split("T")[0] as string;

    // Only the selected date has real flight data; others show null
    if (iso === selectedDate && flights.length > 0) {
      const lowest = flights.reduce<number | null>((min, f) => {
        const cheapest = f.cabins.reduce<number | null>((m, c) => {
          if (c.availableSeats <= 0) return m;
          return m === null ? c.price.amount : Math.min(m, c.price.amount);
        }, null);
        if (cheapest === null) return min;
        return min === null ? cheapest : Math.min(min, cheapest);
      }, null);

      const currency = flights[0]?.cabins[0]?.price.currency ?? "EUR";
      days.push({
        date: iso,
        lowestPrice: lowest !== null ? { amount: lowest, currency } : null,
      });
    } else {
      days.push({ date: iso, lowestPrice: null });
    }
  }
  return days;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const OutboundScreen = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { context, send, isLoading } = useBookingMachine();

  const searchParams = context.searchParams;
  const flights = context.outboundFlights;
  const selectedDate = searchParams?.departureDate ?? "";

  // --- Local state: sorting & filtering ---
  const [sortField, setSortField] = useState<SortField>("price");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filters, setFilters] = useState<FilterState>({
    cabinClass: searchParams?.cabinClass ?? "ECONOMY",
    maxStops: null,
    timeRange: null,
  });

  // Reset filters when search params change
  useEffect(() => {
    if (searchParams?.cabinClass) {
      setFilters((prev) => ({
        ...prev,
        cabinClass: searchParams.cabinClass ?? prev.cabinClass,
      }));
    }
  }, [searchParams?.cabinClass]);

  // --- Derived data ---
  const filteredAndSorted = useMemo(() => {
    const filtered = filterFlights(flights, filters);
    return sortFlights(
      filtered,
      sortField,
      sortOrder,
      filters.cabinClass as CabinClass,
    );
  }, [flights, sortField, sortOrder, filters]);

  const datePrices = useMemo(
    () => buildDatePrices(selectedDate, flights),
    [selectedDate, flights],
  );

  // --- Handlers ---
  const handleSelectCabin = useCallback(
    (flight: FlightResult, cabin: CabinClass) => {
      const selection = createFlightSelection(flight, cabin);
      if (selection) {
        send({ type: "SELECT_OUTBOUND", selection });
      }
    },
    [send],
  );

  const handleDateChange = useCallback(
    (date: string) => {
      send({ type: "CHANGE_OUTBOUND_DATE", date });
    },
    [send],
  );

  const handleBack = useCallback(() => {
    send({ type: "BACK" });
    void navigate(buildRoute.home());
  }, [send, navigate]);

  // --- Guard: no search params ---
  if (!searchParams) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center p-4">
        <p className="text-lg font-bold text-white">
          {t("error.invalidParams")}
        </p>
        <Button
          onClick={() => void navigate(buildRoute.home())}
          className="mt-4 rounded-xl bg-blue-600 px-6 py-2 text-sm font-bold text-white"
        >
          {t("search.backToHome")}
        </Button>
      </div>
    );
  }

  const totalPassengers =
    searchParams.passengers.adults +
    searchParams.passengers.children +
    searchParams.passengers.infants;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-all"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
            </Button>
            <div className="flex-1">
              <h1 className="flex items-center gap-2 text-lg font-bold text-white md:text-xl">
                {searchParams.origin}
                <span className="text-slate-600">→</span>
                {searchParams.destination}
              </h1>
              <p className="text-xs font-medium text-slate-500">
                {new Date(searchParams.departureDate).toLocaleDateString()} •{" "}
                {totalPassengers} {t("search.passengers").toLowerCase()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        {/* Date Carousel */}
        <div className="mb-6">
          <DateCarousel
            selectedDate={selectedDate}
            prices={datePrices}
            onDateChange={handleDateChange}
            isLoading={isLoading}
          />
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar filters (desktop) */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <FilterPanel
              filters={filters}
              onFiltersChange={setFilters}
              onClear={() =>
                setFilters({
                  cabinClass: "ECONOMY",
                  maxStops: null,
                  timeRange: null,
                })
              }
            />
          </aside>

          {/* Main content */}
          <div className="flex-1 space-y-6">
            {/* Sort + mobile filter toggle */}
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
                          maxStops: null,
                          timeRange: null,
                        })
                      }
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Loading state */}
            {isLoading && flights.length === 0 && (
              <div className="flex h-64 flex-col items-center justify-center gap-4">
                <Spinner className="size-8 text-blue-500" />
                <p className="text-sm font-medium text-slate-500">
                  {t("search.searching")}
                </p>
              </div>
            )}

            {/* Error state */}
            {context.error && flights.length === 0 && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
                <HugeiconsIcon
                  icon={AlertCircleIcon}
                  size={40}
                  className="mx-auto mb-4 text-red-500"
                />
                <h3 className="mb-2 text-lg font-bold text-white">
                  {t("error.searchFailed")}
                </h3>
                <p className="mb-6 text-sm text-slate-400">{context.error}</p>
                <Button
                  onClick={() => send({ type: "RETRY" })}
                  className="rounded-xl bg-red-600 px-6 py-2 text-sm font-bold text-white transition-all hover:bg-red-500"
                >
                  {t("common.retry")}
                </Button>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && flights.length === 0 && !context.error && (
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
                  onClick={() => void navigate(buildRoute.home())}
                  className="mt-6 rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-blue-500"
                >
                  {t("search.modifySearch")}
                </Button>
              </Empty>
            )}

            {/* Flight results table */}
            {filteredAndSorted.length > 0 && (
              <FlightResultsTable
                flights={filteredAndSorted}
                onSelectCabin={handleSelectCabin}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutboundScreen;
