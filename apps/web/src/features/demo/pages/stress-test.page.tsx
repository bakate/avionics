import {
  Activity01Icon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { Heading } from "@workspace/ui/components/heading";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";
import { useMachine } from "@xstate/react";

import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/format";
import { stressTestMachine } from "./../machines/stress-test.machine";

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FlightCardProps {
  flight: {
    flightId: string;
    flightNumber: string;
    origin: string;
    destination: string;
    departureTime: string;
    availableSeats: number;
  };
  isSelected: boolean;
  isDisabled: boolean;
  onSelect: (id: string) => void;
  seatsLabel: string;
  routeLabel: string;
}

function FlightCard({
  flight,
  isSelected,
  isDisabled,
  onSelect,
  seatsLabel,
  routeLabel,
}: FlightCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(flight.flightId)}
      disabled={isDisabled}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-4 text-left",
        "transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        isSelected
          ? "border-blue-500 bg-blue-50 dark:border-blue-500/50 dark:bg-blue-900/20"
          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800",
        isDisabled
          ? "cursor-not-allowed opacity-50"
          : "hover:cursor-pointer hover:scale-[1.02]",
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="font-semibold text-gray-900 dark:text-white">
          {flight.flightNumber}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatDate(new Date(flight.departureTime))}
        </span>
      </div>
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {routeLabel}
      </div>

      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
          flight.availableSeats > 0
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        )}
      >
        {seatsLabel}
      </span>
    </button>
  );
}

interface StatCardProps {
  icon: IconSvgElement;
  label: string;
  value: number;
  colorScheme: "neutral" | "green" | "orange" | "red";
}

const colorSchemes: Record<
  StatCardProps["colorScheme"],
  { card: string; iconWrapper: string; label: string; value: string }
> = {
  neutral: {
    card: "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
    iconWrapper:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    label: "text-gray-500 dark:text-gray-400",
    value: "text-gray-900 dark:text-white",
  },
  green: {
    card: "border-green-200 bg-green-50 dark:border-green-900/20 dark:bg-green-900/10",
    iconWrapper:
      "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    label: "text-green-800 dark:text-green-300",
    value: "text-green-700 dark:text-green-400",
  },
  orange: {
    card: "border-orange-200 bg-orange-50 dark:border-orange-900/20 dark:bg-orange-900/10",
    iconWrapper:
      "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    label: "text-orange-800 dark:text-orange-300",
    value: "text-orange-700 dark:text-orange-400",
  },
  red: {
    card: "border-red-200 bg-red-50 dark:border-red-900/20 dark:bg-red-900/10",
    iconWrapper: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    label: "text-red-800 dark:text-red-300",
    value: "text-red-700 dark:text-red-400",
  },
};

function StatCard({ icon, label, value, colorScheme }: StatCardProps) {
  const colors = colorSchemes[colorScheme];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border p-4 text-center shadow-sm",
        colors.card,
      )}
    >
      <div
        className={cn(
          "flex size-8 items-center justify-center rounded-full",
          colors.iconWrapper,
        )}
      >
        <HugeiconsIcon icon={icon} size={20} />
      </div>
      <p
        className={cn(
          "mt-4 text-xs font-semibold uppercase tracking-wider",
          colors.label,
        )}
      >
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-bold", colors.value)}>{value}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function StressTestPage() {
  const { t } = useTranslation();
  const [state, send] = useMachine(stressTestMachine);
  const { flights, flightId, requestCount, status, results, error } =
    state.context;

  const selectedFlight = flights.find((f) => f.flightId === flightId);
  const flightDisplay = selectedFlight
    ? `${selectedFlight.flightNumber} - ${selectedFlight.origin} → ${selectedFlight.destination}`
    : flightId;

  const isRunning = state.hasTag("loading") && status === "running";
  const isFetching = state.matches("fetchingFlights");
  const isIdle = state.hasTag("idle") && !state.matches("completed");

  const showResults =
    (status === "error" && Boolean(error)) ||
    (status === "completed" && Boolean(results));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      {/* ── Header ── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <Heading
          title={t("demo.stressTest.title")}
          description={t("demo.stressTest.description")}
          withSeparator
        />
        <div className="shrink-0 rounded-full bg-blue-100 p-3 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <HugeiconsIcon icon={Activity01Icon} size={28} />
        </div>
      </div>

      {/* ── Main layout: sidebar + content ── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ── Sidebar: Config + Results ── */}
        <aside className="w-full lg:w-72 xl:w-80 shrink-0">
          <div className="sticky top-6 space-y-4 lg:space-y-16">
            {/* Config panel */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-gray-900 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="flightId">
                  {t("demo.stressTest.targetFlightId")}
                </Label>
                <Input
                  id="flightId"
                  placeholder={t("demo.stressTest.targetFlightIdPlaceholder")}
                  value={flightDisplay}
                  readOnly
                  disabled={isRunning}
                  className="cursor-default bg-gray-50 font-medium text-gray-700 dark:bg-gray-800/50 dark:text-gray-300"
                />
                <p className="text-xs text-gray-500">
                  {t("demo.stressTest.targetFlightIdHelp")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="requestCount">
                  {t("demo.stressTest.requestCount")}
                </Label>
                <Input
                  id="requestCount"
                  type="number"
                  min={1}
                  max={200}
                  value={requestCount}
                  onChange={(e) =>
                    send({
                      type: "SET_REQUEST_COUNT",
                      count: Number.parseInt(e.target.value, 10) || 0,
                    })
                  }
                  disabled={isRunning}
                />
                <p className="text-xs text-gray-500">
                  {t("demo.stressTest.requestCountHelp")}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => send({ type: "RUN_TEST" })}
                  disabled={isRunning || !flightId || requestCount < 1}
                  className="w-full"
                >
                  {isRunning
                    ? t("demo.stressTest.running")
                    : t("demo.stressTest.runTest")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => send({ type: "RESET" })}
                  disabled={isRunning || isIdle}
                  className="w-full"
                >
                  {t("demo.stressTest.reset")}
                </Button>
              </div>
            </div>

            {/* Results: inline in sidebar once available */}
            {showResults && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                {status === "error" && error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
                    <div className="flex items-center gap-2 font-medium">
                      <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4" />
                      <span>{t("demo.stressTest.error")}</span>
                    </div>
                    <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                      {error}
                    </p>
                  </div>
                )}

                {status === "completed" && results && (
                  <>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-1">
                      {t("demo.stressTest.resultsAnalysis")}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard
                        icon={Activity01Icon}
                        label={t("demo.stressTest.totalFired")}
                        value={results.total}
                        colorScheme="neutral"
                      />
                      <StatCard
                        icon={CheckmarkCircle02Icon}
                        label={t("demo.stressTest.successful")}
                        value={results.success}
                        colorScheme="green"
                      />
                      <StatCard
                        icon={InformationCircleIcon}
                        label={t("demo.stressTest.optLocking")}
                        value={results.optimisticLocking}
                        colorScheme="orange"
                      />
                      <StatCard
                        icon={Alert02Icon}
                        label={t("demo.stressTest.flightFull")}
                        value={results.flightFull}
                        colorScheme="red"
                      />
                    </div>

                    {results.otherErrors > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200 shadow-sm">
                        {t("demo.stressTest.otherErrors", {
                          count: results.otherErrors,
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ── Main content: Flight picker + Explanation ── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Flight picker */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <Heading
              title={t("demo.stressTest.availableFlights")}
              description={t("demo.stressTest.availableFlightsHelp")}
              descriptionClassName="mb-6"
            />

            {isFetching ? (
              <div className="flex justify-center p-8 text-sm text-gray-500">
                {t("demo.stressTest.fetchingFlights")}
              </div>
            ) : flights.length === 0 ? (
              <div className="flex justify-center p-8 text-sm text-gray-500">
                {t("demo.stressTest.noFlights")}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {flights.map((flight) => (
                  <FlightCard
                    key={flight.flightId}
                    flight={flight}
                    isSelected={flightId === flight.flightId}
                    isDisabled={isRunning}
                    onSelect={(id) =>
                      send({ type: "SET_FLIGHT_ID", flightId: id })
                    }
                    seatsLabel={t("demo.stressTest.seatsLeft", {
                      count: flight.availableSeats,
                    })}
                    routeLabel={t("demo.stressTest.flightInfo", {
                      origin: flight.origin,
                      destination: flight.destination,
                    })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Explanation panel — always visible */}
          {status === "completed" && results && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 font-semibold">
                <HugeiconsIcon
                  icon={InformationCircleIcon}
                  className="size-5 shrink-0"
                />
                <span>{t("demo.stressTest.whatDoesThisMean")}</span>
              </div>
              <div className="mt-3 text-sm leading-relaxed space-y-2">
                <p>{t("demo.stressTest.explanationIntro")}</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>{t("demo.stressTest.explanationPoint1")}</li>
                  <li>{t("demo.stressTest.explanationPoint2")}</li>
                  <li className="font-semibold">
                    {t("demo.stressTest.explanationPoint3")}
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
