/**
 * Flight detail panel — displays complete route info, timeline, duration,
 * layover details, and cabin cards for selection
 */

import { type CabinClass } from "@workspace/domain/kernel";
import { useTranslation } from "react-i18next";
import { type FlightResult } from "@/features/booking/machines/booking.machine";
import { formatDuration, formatTime } from "@/lib/format";
import { CabinCard } from "./cabin-card";

export type FlightDetailPanelProps = {
  readonly flight: FlightResult;
  readonly selectedCabin?: CabinClass;
  readonly onSelectCabin: (cabin: CabinClass) => void;
};

const CABIN_ORDER: ReadonlyArray<CabinClass> = ["ECONOMY", "BUSINESS", "FIRST"];

export const FlightDetailPanel = ({
  flight,
  selectedCabin,
  onSelectCabin,
}: FlightDetailPanelProps) => {
  const { t } = useTranslation();
  const depTime = formatTime(new Date(flight.departureTime));
  const arrTime = formatTime(new Date(flight.arrivalTime));
  const duration = formatDuration(flight.durationMinutes);

  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6"
      aria-label={`${t("confirmation.flightDetails")} ${flight.flightNumber}`}
    >
      {/* Route header */}
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <h3 className="text-lg font-bold text-gray-900">
          {flight.origin}
          <span className="mx-2 text-gray-400">→</span>
          {flight.destination}
        </h3>
        <span className="text-sm text-gray-500">{flight.flightNumber}</span>
      </div>

      {/* Visual timeline */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex flex-col items-center">
          <span className="text-xl font-bold text-gray-900">{depTime}</span>
          <span className="text-xs font-medium text-gray-500">
            {flight.origin}
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs text-gray-400">{duration}</span>
          <div className="relative h-0.5 w-full bg-gray-200">
            <div className="absolute left-0 top-1/2 size-2 -translate-y-1/2 rounded-full bg-blue-600" />
            <div className="absolute right-0 top-1/2 size-2 -translate-y-1/2 rounded-full bg-blue-600" />
            {flight.stops > 0 && (
              <div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400" />
            )}
          </div>
          {flight.stops > 0 && (
            <span className="text-xs font-medium text-orange-500">
              {flight.stops === 1 ? "1 escale" : `${flight.stops} escales`}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xl font-bold text-gray-900">{arrTime}</span>
          <span className="text-xs font-medium text-gray-500">
            {flight.destination}
          </span>
        </div>
      </div>

      {/* Aircraft */}
      {flight.aircraft && (
        <p className="mt-3 text-xs text-gray-400">{flight.aircraft}</p>
      )}

      {/* Cabin cards */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CABIN_ORDER.map((cabinClass) => {
          const cabinData = flight.cabins.find((c) => c.cabin === cabinClass);
          if (!cabinData) return null;
          return (
            <CabinCard
              key={cabinClass}
              cabin={cabinData.cabin}
              price={cabinData.price}
              availableSeats={cabinData.availableSeats}
              isSelected={selectedCabin === cabinClass}
              onSelect={() => onSelectCabin(cabinClass)}
            />
          );
        })}
      </div>
    </section>
  );
};
