/**
 * Return flight selection screen.
 * Same interface as outbound but for the return direction.
 * Dispatches SELECT_RETURN / CHANGE_RETURN_DATE to the booking machine.
 * Back button returns to outbound selection.
 */

import { FilterHorizontalIcon, ReloadIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type CabinClass } from "@workspace/domain/kernel";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import { SectionCard } from "@workspace/ui/components/section-card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { Spinner } from "@workspace/ui/components/spinner";
import { Effect } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { type DatePrice, getDatePrices } from "../../../api/inventory.api";
import { ErrorDisplay } from "../../../components/error-display";
import { filterFlights, sortFlights } from "../../../pages/results-logic";
import { buildRoute } from "../../../routes";
import { DateCarousel } from "../components/date-carousel";
import { FilterPanel, type FilterState } from "../components/filter-panel";
import { FlightResultsTable } from "../components/flight-results-table";
import { FlightScreenHeader } from "../components/flight-screen-header";
import {
  SortControls,
  type SortField,
  type SortOrder,
} from "../components/sort-controls";
import { useBookingMachine } from "../hooks/use-booking-machine";
import {
  createFlightSelection,
  type FlightResult,
} from "../machines/booking.machine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build ~7 day ISO strings centered on the selected date. */
const buildDateRange = (selectedDate: string): ReadonlyArray<string> => {
  if (!selectedDate || Number.isNaN(new Date(selectedDate).getTime())) {
    return [];
  }
  const center = new Date(selectedDate);
  const days: Array<string> = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(center);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split("T")[0] as string;
    days.push(iso);
  }
  return days;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ReturnScreen = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { context, send, isLoading } = useBookingMachine();

  const searchParams = context.searchParams;
  const flights = context.returnFlights;
  const selectedDate =
    searchParams?.returnDate ?? searchParams?.departureDate ?? "";

  // --- Date Carousel State ---
  const [referenceDate, setReferenceDate] = useState(
    () => selectedDate || (new Date().toISOString().split("T")[0] as string),
  );

  useEffect(() => {
    if (!selectedDate) return;
    const ref = new Date(referenceDate).getTime();
    const sel = new Date(selectedDate).getTime();
    if (Number.isNaN(ref) || Number.isNaN(sel)) return;

    if (Math.abs(ref - sel) >= 7 * 24 * 60 * 60 * 1000) {
      setReferenceDate(selectedDate);
    }
  }, [selectedDate, referenceDate]);

  const handlePreviousDays = useCallback(() => {
    setReferenceDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d.toISOString().split("T")[0] as string;
    });
  }, []);

  const handleNextDays = useCallback(() => {
    setReferenceDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d.toISOString().split("T")[0] as string;
    });
  }, []);

  // --- Local state: sorting, filtering, date prices ---
  const [sortField, setSortField] = useState<SortField>("price");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [filters, setFilters] = useState<FilterState>({
    cabinClass: searchParams?.cabinClass ?? "ECONOMY",
    maxStops: null,
    timeRange: null,
  });
  const [datePrices, setDatePrices] = useState<ReadonlyArray<DatePrice>>([]);
  const [pendingSelection, setPendingSelection] = useState<{
    flight: FlightResult;
    cabin: CabinClass;
  } | null>(null);

  // --- Fetch real date prices from API for the carousel ---
  useEffect(() => {
    if (!searchParams) return;
    const dates = buildDateRange(referenceDate);
    if (dates.length === 0) return;

    let cancelled = false;
    const effect = getDatePrices({
      origin: searchParams.destination,
      destination: searchParams.origin,
      dates,
    });
    Effect.runPromise(effect)
      .then((prices) => {
        if (!cancelled) setDatePrices(prices);
      })
      .catch(() => {
        if (!cancelled) {
          setDatePrices(dates.map((d) => ({ date: d, lowestPrice: null })));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, searchParams]);

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

  // --- Handlers ---
  const handleSelectCabin = useCallback(
    (flight: FlightResult, cabin: CabinClass) => {
      setPendingSelection((prev) => {
        if (prev?.flight.flightId === flight.flightId && prev.cabin === cabin) {
          return null; // Toggle off if clicked again
        }
        return { flight, cabin };
      });
    },
    [],
  );

  const handleConfirmSelection = useCallback(() => {
    if (!pendingSelection) return;
    const selection = createFlightSelection(
      pendingSelection.flight,
      pendingSelection.cabin,
    );
    if (selection) {
      send({ type: "SELECT_RETURN", selection });
    }
  }, [send, pendingSelection]);

  const handleDateChange = useCallback(
    (date: string) => {
      send({ type: "CHANGE_RETURN_DATE", date });
    },
    [send],
  );

  const handleBack = useCallback(() => {
    send({ type: "BACK" });
  }, [send]);

  // --- Guard: no search params ---
  if (!searchParams) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center p-4">
        <h2 className="text-lg font-bold">{t("error.invalidParams")}</h2>
        <Button onClick={() => void navigate(buildRoute.home())}>
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
      <FlightScreenHeader
        origin={searchParams.destination}
        destination={searchParams.origin}
        date={selectedDate}
        passengersCount={totalPassengers}
        stepLabel={t("steps.return")}
        onBack={handleBack}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        {/* Date Carousel */}
        <div className="mb-6">
          <DateCarousel
            selectedDate={selectedDate}
            prices={datePrices}
            onDateChange={handleDateChange}
            onPrevious={handlePreviousDays}
            onNext={handleNextDays}
            passengers={searchParams.passengers}
            isLoading={isLoading}
          />
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar filters (desktop) */}
          <aside className="hidden w-72 shrink-0 lg:block">
            <SectionCard
              title={t("search.filters")}
              icon={<HugeiconsIcon icon={FilterHorizontalIcon} size={18} />}
              className="sticky top-24"
            >
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
            </SectionCard>
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
              <ErrorDisplay
                title={t("error.searchFailed")}
                message={context.error}
                onRetry={() => send({ type: "RETRY" })}
              />
            )}

            {/* Empty state */}
            {!isLoading && flights.length === 0 && !context.error && (
              <Empty className="rounded-2xl border border-white/10 bg-white/5 p-12 backdrop-blur-sm">
                <EmptyMedia>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100/10 text-slate-600">
                    <HugeiconsIcon icon={ReloadIcon} size={32} />
                  </div>
                </EmptyMedia>
                <EmptyTitle className="text-lg font-bold dark:text-white">
                  {t("search.noFlights")}
                </EmptyTitle>
                <EmptyDescription className="text-slate-500 dark:text-slate-400">
                  {t("search.tryDifferentDates")}
                </EmptyDescription>
                <Button
                  onClick={handleBack}
                  className="mt-6 rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold dark:text-white transition-all hover:bg-blue-500"
                >
                  {t("common.back")}
                </Button>
              </Empty>
            )}

            {filteredAndSorted.length > 0 && (
              <FlightResultsTable
                flights={filteredAndSorted}
                pendingSelection={pendingSelection}
                passengers={searchParams.passengers}
                onSelectCabin={handleSelectCabin}
                onConfirmCabin={handleConfirmSelection}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
