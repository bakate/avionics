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
}

function FlightCard({
  flight,
  isSelected,
  isDisabled,
  onSelect,
  seatsLabel,
}: FlightCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(flight.flightId)}
      disabled={isDisabled}
      className={cn(
        "group relative flex items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-all duration-300",
        isSelected
          ? "border-royal-blue bg-royal-blue/5 shadow-[0_10px_30px_-10px_rgba(30,58,138,0.2)] dark:border-royal-blue/50 dark:bg-royal-blue/10"
          : "border-slate-200 bg-white hover:border-royal-blue/30 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/50",
        isDisabled ? "cursor-not-allowed opacity-50" : "hover:-translate-y-1",
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-widest text-royal-blue/60 uppercase">
            {flight.flightNumber}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {formatDate(new Date(flight.departureTime))}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
          <span>{flight.origin}</span>
          <div className="h-px w-4 bg-slate-200 dark:bg-slate-700" />
          <span>{flight.destination}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span
          className={cn(
            "inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight",
            flight.availableSeats > 0
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
          )}
        >
          {seatsLabel}
        </span>
      </div>

      {isSelected && (
        <div className="absolute -right-1 -top-1 size-3 rounded-full bg-royal-blue shadow-[0_0_10px_rgba(30,58,138,0.5)]" />
      )}
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
  {
    card: string;
    iconWrapper: string;
    label: string;
    value: string;
    glow: string;
    chip: string;
  }
> = {
  neutral: {
    card: "border-slate-200 bg-white dark:border-slate-800/50 dark:bg-slate-900/40",
    iconWrapper:
      "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    label: "text-slate-400 dark:text-slate-500",
    value: "text-slate-900 dark:text-white",
    glow: "group-hover:shadow-[0_20px_50px_-20px_rgba(100,116,139,0.15)]",
    chip: "bg-slate-100/50 text-slate-500 dark:bg-slate-800/30",
  },
  green: {
    card: "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/20 dark:bg-emerald-950/20",
    iconWrapper:
      "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400",
    label: "text-emerald-700/70 dark:text-emerald-400/60",
    value: "text-emerald-600 dark:text-emerald-400",
    glow: "group-hover:shadow-[0_20px_60px_-20px_rgba(16,185,129,0.25)]",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  },
  orange: {
    card: "border-amber-200 bg-amber-50/30 dark:border-amber-900/20 dark:bg-amber-950/20 shadow-[inset_0_0_40px_rgba(245,158,11,0.03)]",
    iconWrapper:
      "bg-amber-100/80 text-amber-600 dark:bg-amber-900/60 dark:text-amber-400",
    label: "text-amber-700/70 dark:text-amber-400/60",
    value: "text-amber-600 dark:text-amber-400",
    glow: "group-hover:shadow-[0_20px_60px_-20px_rgba(245,158,11,0.25)]",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  red: {
    card: "border-rose-200 bg-rose-50/30 dark:border-rose-900/20 dark:bg-rose-950/20",
    iconWrapper:
      "bg-rose-100/80 text-rose-600 dark:bg-rose-900/60 dark:text-rose-400",
    label: "text-rose-700/70 dark:text-rose-300/60",
    value: "text-rose-600 dark:text-rose-400",
    glow: "group-hover:shadow-[0_20px_60px_-20px_rgba(244,63,94,0.25)]",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  },
};

function StatCard({ icon, label, value, colorScheme }: StatCardProps) {
  const colors = colorSchemes[colorScheme];
  return (
    <div
      className={cn(
        "group relative flex flex-col items-center justify-center overflow-hidden rounded-[2.5rem] border p-10 text-center transition-all duration-500",
        colors.card,
        colors.glow,
      )}
    >
      {/* Subtle Halo */}
      <div
        className={cn(
          "absolute -top-10 -right-10 size-40 rounded-full blur-[80px] opacity-0 transition-opacity duration-500 group-hover:opacity-20",
          colorScheme === "green" && "bg-emerald-500",
          colorScheme === "orange" && "bg-amber-500",
          colorScheme === "red" && "bg-rose-500",
          colorScheme === "neutral" && "bg-slate-400",
        )}
      />

      <div
        className={cn(
          "relative flex size-20 items-center justify-center rounded-[2rem] transition-all duration-500 group-hover:scale-105 group-hover:rotate-3",
          colors.iconWrapper,
        )}
      >
        <HugeiconsIcon icon={icon} size={32} />
      </div>

      <div className="relative mt-8 space-y-1">
        <p
          className={cn(
            "text-[10px] font-bold uppercase tracking-[0.3em]",
            colors.label,
          )}
        >
          {label}
        </p>
        <div className="flex items-baseline justify-center gap-1">
          <p
            className={cn("text-6xl font-bold tracking-tighter", colors.value)}
          >
            {value}
          </p>
        </div>
      </div>

      {/* Special tag for Effect mechanism */}
      {colorScheme === "orange" && value > 0 && (
        <div className="absolute top-4 right-6 rounded-full bg-amber-500 px-2 py-0.5 text-[8px] font-bold text-white uppercase tracking-tighter animate-bounce">
          Effect Solidified
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function StressTestPage() {
  const { t } = useTranslation();
  const [state, send] = useMachine(stressTestMachine);
  const { flights, flightId, requestCount, status, results, error } =
    state.context;

  const selectedFlight = flights.find((flight) => flight.flightId === flightId);
  const flightDisplay = selectedFlight
    ? `${selectedFlight.flightNumber} - ${selectedFlight.origin} → ${selectedFlight.destination}`
    : flightId;

  const isRunning = state.hasTag("loading") && status === "running";
  const isFetching = state.matches("fetchingFlights");
  const isIdle = state.hasTag("idle") && !state.matches("completed");
  const isCompleted = status === "completed" && Boolean(results);

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      {/* ── Header ── */}
      <div className="relative mb-16 flex items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-royal-blue/10 bg-royal-blue/5 px-3 py-1 text-[10px] font-bold tracking-widest text-royal-blue uppercase dark:border-royal-blue/20">
            <span className="size-1.5 animate-pulse rounded-full bg-royal-blue" />
            System Intelligence
          </div>
          <Heading
            title={t("demo.stressTest.title")}
            description={t("demo.stressTest.description")}
            headerClassName="bg-clip-text text-transparent bg-linear-to-r from-royal-blue via-royal-blue to-slate-400 dark:to-slate-500 pb-2"
            className="text-balance"
          />
        </div>
        <div className="hidden shrink-0 rounded-3xl bg-royal-blue px-6 py-4 text-white shadow-2xl dark:bg-royal-blue/90 lg:flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
              Status
            </span>
            <span className="font-semibold">
              {isRunning ? "Pressurizing..." : "System Ready"}
            </span>
          </div>
          <div
            className={cn(
              "rounded-xl bg-white/20 p-2 text-white",
              isRunning && "animate-spin",
            )}
          >
            <HugeiconsIcon icon={Activity01Icon} size={24} />
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="grid gap-16 lg:grid-cols-[320px_1fr]">
        {/* ── Sidebar: Control Panel ── */}
        <aside className="space-y-8">
          <div
            className={cn(
              "relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-2xl transition-all duration-500 dark:border-slate-800 dark:bg-slate-900/80",
              isRunning &&
                "ring-2 ring-royal-blue ring-offset-4 dark:ring-offset-slate-950",
            )}
          >
            <div className="absolute inset-0 bg-linear-to-b from-royal-blue/2 to-transparent pointer-events-none" />

            <div className="relative mb-10 flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Control Unit
                </h3>
                <div className="h-0.5 w-6 bg-royal-blue" />
              </div>
              <HugeiconsIcon
                icon={InformationCircleIcon}
                size={18}
                className="text-slate-300"
              />
            </div>

            <div className="relative space-y-8">
              <div className="space-y-3">
                <Label
                  htmlFor="flightId"
                  className="text-[10px] font-bold uppercase tracking-widest opacity-40"
                >
                  Target Asset
                </Label>
                <div className="rounded-2xl bg-slate-50 p-1 dark:bg-slate-800">
                  <Input
                    id="flightId"
                    value={flightDisplay}
                    readOnly
                    disabled={isRunning}
                    className="border-none bg-transparent font-semibold shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label
                  htmlFor="requestCount"
                  className="text-[10px] font-bold uppercase tracking-widest opacity-40"
                >
                  Load Intensity
                </Label>
                <div className="relative rounded-2xl bg-slate-50 p-1 dark:bg-slate-800">
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
                    className="border-none bg-transparent font-bold text-royal-blue shadow-none focus-visible:ring-0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-royal-blue/30 uppercase">
                    REQ
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-4">
                <Button
                  onClick={() => send({ type: "RUN_TEST" })}
                  disabled={isRunning || !flightId || requestCount < 1}
                  className="group relative h-16 overflow-hidden rounded-2xl bg-royal-blue text-sm font-bold tracking-widest shadow-xl transition-all hover:scale-[1.02] hover:bg-royal-blue/90 active:scale-95 disabled:hover:scale-100"
                >
                  <span className="relative z-10">
                    {isRunning
                      ? t("demo.stressTest.running")
                      : t("demo.stressTest.runTest")}
                  </span>
                  {!isRunning && (
                    <div className="absolute inset-0 translate-y-full bg-linear-to-t from-white/10 to-transparent transition-transform duration-500 group-hover:translate-y-0" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => send({ type: "RESET" })}
                  disabled={isRunning || isIdle}
                  className="h-10 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {t("demo.stressTest.reset")}
                </Button>
              </div>
            </div>
          </div>

          {/* Inline Error */}
          {status === "error" && error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-rose-700">
                <HugeiconsIcon icon={Alert02Icon} size={18} />
                <span className="text-xs lowercase">
                  {t("demo.stressTest.error")}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium leading-relaxed">
                {error}
              </p>
            </div>
          )}
        </aside>

        {/* ── Main content: Center Stage ── */}
        <div className="min-w-0 space-y-12">
          {isCompleted && results ? (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
                  {t("demo.stressTest.resultsAnalysis")}
                </h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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
              </div>

              {/* Explanation panel */}
              <div className="glass-premium rounded-[2.5rem] p-10">
                <div className="flex items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-royal-blue text-white">
                    <HugeiconsIcon icon={InformationCircleIcon} size={24} />
                  </div>
                  <h3 className="text-xl font-bold">
                    {t("demo.stressTest.whatDoesThisMean")}
                  </h3>
                </div>
                <div className="mt-8 grid gap-8 md:grid-cols-2">
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-light">
                    {t("demo.stressTest.explanationIntro")}
                  </p>
                  <ul className="space-y-4">
                    {(
                      [
                        "demo.stressTest.explanationPoint1",
                        "demo.stressTest.explanationPoint2",
                        "demo.stressTest.explanationPoint3",
                      ] as const
                    ).map((key, index) => (
                      <li
                        key={key}
                        className="flex gap-3 text-sm text-slate-700 dark:text-slate-300"
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-royal-blue/10 text-[10px] font-bold text-royal-blue">
                          0{index + 1}
                        </span>
                        <span
                          className={cn(
                            index === 2 && "font-bold text-royal-blue",
                          )}
                        >
                          {t(key)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
                  {t("demo.stressTest.availableFlights")}
                </h2>
                {isFetching && (
                  <span className="flex items-center gap-2 text-xs font-bold text-royal-blue animate-pulse">
                    <HugeiconsIcon icon={Activity01Icon} size={12} />
                    {t("demo.stressTest.fetchingFlights")}
                  </span>
                )}
              </div>

              <div className="rounded-[2.5rem] border border-slate-200 bg-slate-50/50 p-8 dark:border-slate-800 dark:bg-slate-900/30">
                {flights.length === 0 && !isFetching ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <HugeiconsIcon
                      icon={InformationCircleIcon}
                      size={48}
                      className="mb-4 opacity-20"
                    />
                    <p className="text-sm font-medium">
                      {t("demo.stressTest.noFlights")}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
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
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
