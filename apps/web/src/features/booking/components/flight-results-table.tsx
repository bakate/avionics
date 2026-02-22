// Flight results table — Air France style

import { Airplane01Icon, Time01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type CabinClass } from "@workspace/domain/kernel";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDuration } from "../../../lib/format";
import { type FlightResult } from "../machines/booking.machine";
import { FareDetailPanel } from "./fare-detail-panel";

export type FlightResultsTableProps = {
  readonly flights: ReadonlyArray<FlightResult>;
  readonly pendingSelection: { flight: FlightResult; cabin: CabinClass } | null;
  readonly passengers: { adults: number; children: number; infants: number };
  readonly onSelectCabin: (flight: FlightResult, cabin: CabinClass) => void;
  readonly onConfirmCabin: () => void;
};

const calculateTotal = (
  baseAmount: number,
  passengers: { adults: number; children: number; infants: number },
) => {
  return Number(
    (
      baseAmount *
      (passengers.adults * 1.0 + passengers.children * 0.75)
    ).toFixed(2),
  );
};

const CABIN_COLORS: Record<
  CabinClass,
  { bg: string; text: string; ring: string }
> = {
  ECONOMY: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  BUSINESS: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  FIRST: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
};

const CABIN_ORDER: ReadonlyArray<CabinClass> = ["ECONOMY", "BUSINESS", "FIRST"];

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

type CabinPriceCellProps = {
  readonly cabin: CabinClass;
  readonly price: { readonly amount: number; readonly currency: string };
  readonly availableSeats: number;
  readonly passengers: { adults: number; children: number; infants: number };
  readonly onSelect: () => void;
};

const CabinPriceCell = ({
  cabin,
  price,
  availableSeats,
  passengers,
  onSelect,
}: CabinPriceCellProps) => {
  const { t } = useTranslation();
  const colors = CABIN_COLORS[cabin];
  const soldOut = availableSeats === 0;
  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={onSelect}
      className={cn(
        "flex min-h-[60px] min-w-[44px] flex-col items-center justify-center rounded-lg px-3 py-2 text-center transition-all ring-1 ring-inset",
        soldOut
          ? "cursor-not-allowed bg-gray-50 text-gray-400 ring-gray-200 opacity-60"
          : cn(
              colors.bg,
              colors.text,
              colors.ring,
              "hover:shadow-md hover:ring-2 cursor-pointer",
            ),
      )}
      aria-label={
        soldOut
          ? `${t(`select.${cabin}` as any)} — ${t("select.soldOut")}`
          : `${t(`select.${cabin}` as any)} — ${calculateTotal(price.amount, passengers)} ${price.currency}`
      }
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
        {t(`select.${cabin}` as any)}
      </span>
      {soldOut ? (
        <span className="text-xs font-medium">{t("select.soldOut")}</span>
      ) : (
        <>
          <span className="text-base font-bold">
            {calculateTotal(price.amount, passengers)}
            <span className="ml-0.5 text-[10px] font-medium opacity-70">
              {price.currency}
            </span>
          </span>
          {availableSeats <= 5 && (
            <span className="text-[10px] opacity-60">
              {t("select.seatsLeft_other", { count: availableSeats })}
            </span>
          )}
        </>
      )}
    </button>
  );
};

type FlightRowProps = {
  readonly flight: FlightResult;
  readonly pendingSelection: { flight: FlightResult; cabin: CabinClass } | null;
  readonly passengers: { adults: number; children: number; infants: number };
  readonly onSelectCabin: (f: FlightResult, c: CabinClass) => void;
  readonly onConfirmCabin: () => void;
};

const FlightRow = ({
  flight,
  pendingSelection,
  passengers,
  onSelectCabin,
  onConfirmCabin,
}: FlightRowProps) => {
  const dur = formatDuration(flight.durationMinutes);
  const isExpanded = pendingSelection?.flight.flightId === flight.flightId;

  return (
    <>
      <tr
        className={cn(
          "border-b border-gray-100 dark:border-white/5 transition-colors hover:bg-gray-50/50 dark:hover:bg-white/5",
          isExpanded && "bg-slate-50/50 dark:bg-slate-900/20",
        )}
      >
        <td className="px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                {fmtTime(flight.departureTime)}
              </p>
              <p className="text-xs font-medium text-gray-500">
                {flight.origin}
              </p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-medium text-gray-400">
                {dur}
              </span>
              <div className="relative h-px w-16 bg-gray-300">
                <div className="absolute top-1/2 left-0 size-1.5 -translate-y-1/2 rounded-full bg-gray-400" />
                <div className="absolute top-1/2 right-0 size-1.5 -translate-y-1/2 rounded-full bg-gray-400" />
              </div>
              <span className="text-[10px] text-gray-400">
                {flight.stops === 0
                  ? "Direct"
                  : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
              </span>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                {fmtTime(flight.arrivalTime)}
              </p>
              <p className="text-xs font-medium text-gray-500">
                {flight.destination}
              </p>
            </div>
          </div>
        </td>
        <td className="px-4 py-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {flight.flightNumber}
          </span>
        </td>
        {CABIN_ORDER.map((cab) => {
          const cd = flight.cabins.find((c) => c.cabin === cab);
          return (
            <td key={cab} className="px-2 py-4">
              {cd ? (
                <CabinPriceCell
                  cabin={cab}
                  price={cd.price}
                  availableSeats={cd.availableSeats}
                  passengers={passengers}
                  onSelect={() => onSelectCabin(flight, cab)}
                />
              ) : (
                <span className="text-xs text-gray-300 dark:text-gray-600">
                  —
                </span>
              )}
            </td>
          );
        })}
      </tr>
      {isExpanded && (
        <tr>
          <td
            colSpan={5}
            className="p-0 border-b border-gray-100 dark:border-white/5"
          >
            <FareDetailPanel
              flight={flight}
              cabin={pendingSelection.cabin}
              passengers={passengers}
              onConfirm={onConfirmCabin}
            />
          </td>
        </tr>
      )}
    </>
  );
};

const FlightMobileCard = ({
  flight,
  pendingSelection,
  passengers,
  onSelectCabin,
  onConfirmCabin,
}: FlightRowProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<CabinClass>("ECONOMY");
  const dur = formatDuration(flight.durationMinutes);
  const isExpanded = pendingSelection?.flight.flightId === flight.flightId;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 dark:bg-slate-950 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <HugeiconsIcon icon={Airplane01Icon} size={18} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {flight.flightNumber}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <HugeiconsIcon icon={Time01Icon} size={12} />
          <span>{dur}</span>
          <span className="mx-1">·</span>
          <span>
            {flight.stops === 0
              ? "Direct"
              : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
          </span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-gray-900">
            {fmtTime(flight.departureTime)}
          </p>
          <p className="text-xs text-gray-500">{flight.origin}</p>
        </div>
        <div className="mx-4 h-px flex-1 bg-gray-200" />
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">
            {fmtTime(flight.arrivalTime)}
          </p>
          <p className="text-xs text-gray-500">{flight.destination}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {CABIN_ORDER.map((cab) => (
          <button
            key={cab}
            type="button"
            onClick={() => setActiveTab(cab)}
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all min-h-[44px]",
              activeTab === cab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
          >
            {t(`select.${cab}` as any)}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {(() => {
          const cd = flight.cabins.find((c) => c.cabin === activeTab);
          if (!cd) return <p className="text-sm text-gray-400">—</p>;
          const soldOut = cd.availableSeats === 0;
          return (
            <div className="flex items-center justify-between">
              <div>
                {soldOut ? (
                  <span className="text-sm font-medium text-gray-400">
                    {t("select.soldOut")}
                  </span>
                ) : (
                  <>
                    <span className="text-xl font-bold text-gray-900">
                      {calculateTotal(cd.price.amount, passengers)}
                      <span className="ml-1 text-sm font-medium text-gray-400">
                        {cd.price.currency}
                      </span>
                    </span>
                    {cd.availableSeats <= 5 && (
                      <p className="text-xs text-orange-500">
                        {t("select.seatsLeft_other", {
                          count: cd.availableSeats,
                        })}
                      </p>
                    )}
                  </>
                )}
              </div>
              <Button
                size="sm"
                disabled={soldOut}
                onClick={() => onSelectCabin(flight, activeTab)}
                className="min-h-[44px] min-w-[44px] rounded-lg"
              >
                {t("search.select")}
              </Button>
            </div>
          );
        })()}
      </div>
      {isExpanded && pendingSelection.cabin === activeTab && (
        <div className="mt-4 -mx-4 -mb-4 border-t border-gray-200 dark:border-white/10">
          <FareDetailPanel
            flight={flight}
            cabin={pendingSelection.cabin}
            passengers={passengers}
            onConfirm={onConfirmCabin}
          />
        </div>
      )}
    </div>
  );
};

export const FlightResultsTable = ({
  flights,
  pendingSelection,
  passengers,
  onSelectCabin,
  onConfirmCabin,
}: FlightResultsTableProps) => {
  const { t } = useTranslation();
  if (flights.length === 0) return null;
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {t("flight.duration")}
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Vol
              </th>
              {CABIN_ORDER.map((cab) => (
                <th
                  key={cab}
                  className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  {t(`select.${cab}` as any)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {flights.map((f) => (
              <FlightRow
                key={f.flightId}
                flight={f}
                pendingSelection={pendingSelection}
                passengers={passengers}
                onSelectCabin={onSelectCabin}
                onConfirmCabin={onConfirmCabin}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {flights.map((f) => (
          <FlightMobileCard
            key={f.flightId}
            flight={f}
            pendingSelection={pendingSelection}
            passengers={passengers}
            onSelectCabin={onSelectCabin}
            onConfirmCabin={onConfirmCabin}
          />
        ))}
      </div>
    </>
  );
};
