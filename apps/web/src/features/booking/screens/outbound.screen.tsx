/**
 * Outbound flight selection screen.
 * Displays Date_Carousel, Flight_Results_Table, sort controls, and filter panel.
 * Dispatches SELECT_OUTBOUND / CHANGE_OUTBOUND_DATE to the booking machine.
 *
 */

import { FilterHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type CabinClass } from "@workspace/domain/kernel";
import { Button } from "@workspace/ui/components/button";
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
import { type DatePrice, getDatePrices } from "@/api/inventory.api";
import { EmptyState } from "@/components/shared/empty-state";
import { DateCarousel } from "@/features/booking/components/date-carousel";
import { FilterPanel } from "@/features/booking/components/filter-panel";
import { FlightResultsTable } from "@/features/booking/components/flight-results-table";
import { FlightScreenHeader } from "@/features/booking/components/flight-screen-header";
import { SortControls } from "@/features/booking/components/sort-controls";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import {
  createFlightSelection,
  type FlightResult,
} from "@/features/booking/machines/booking.machine";
import {
  type FilterState,
  type SortField,
  type SortOrder,
} from "@/features/booking/schemas/ui.schema";
import { toISODate } from "@/lib/format";
import { filterFlights, sortFlights } from "@/pages/results-logic";
import { buildRoute } from "@/routes";

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
    const iso = toISODate(d);
    days.push(iso);
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

  const [referenceDate, setReferenceDate] = useState(
    () => selectedDate || toISODate(new Date()),
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
      return toISODate(d);
    });
  }, []);

  const handleNextDays = useCallback(() => {
    setReferenceDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return toISODate(d);
    });
  }, []);

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
      origin: searchParams.origin,
      destination: searchParams.destination,
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
      send({ type: "SELECT_OUTBOUND", selection });
    }
  }, [send, pendingSelection]);

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

  const showControls = flights.length > 0 || isLoading;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <FlightScreenHeader
        origin={searchParams.origin}
        destination={searchParams.destination}
        date={selectedDate}
        passengersCount={totalPassengers}
        stepLabel={t("steps.outbound")}
        onBack={handleBack}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        {/* Date Carousel */}
        {showControls ? (
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
        ) : null}

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar filters (desktop) */}
          {showControls ? (
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
          ) : null}

          {/* Main content */}
          <div className="flex-1 space-y-6">
            {/* Sort + mobile filter toggle */}
            {showControls ? (
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
            ) : null}

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
            {context.error && flights.length === 0 ? (
              <EmptyState
                isError
                title={t("error.searchFailed")}
                description={context.error}
                action={
                  <Button onClick={() => send({ type: "RETRY" })}>
                    {t("common.retry")}
                  </Button>
                }
              />
            ) : null}

            {/* Empty state */}
            {!isLoading && flights.length === 0 && !context.error ? (
              <EmptyState
                action={
                  <Button onClick={() => void navigate(buildRoute.home())}>
                    {t("search.modifySearch")}
                  </Button>
                }
              />
            ) : null}

            {filteredAndSorted.length > 0 ? (
              <FlightResultsTable
                flights={filteredAndSorted}
                pendingSelection={pendingSelection}
                passengers={searchParams.passengers}
                onSelectCabin={handleSelectCabin}
                onConfirmCabin={handleConfirmSelection}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
