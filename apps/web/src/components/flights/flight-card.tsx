/**
 * Flight selection card.
 * Requirements: 2.1, 6.2
 */

import { type CabinClass } from "@workspace/domain/kernel";
import { Clock, Plane } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type FlightResult } from "../../machines/booking.machine";

export type FlightCardProps = {
  readonly flight: FlightResult;
  readonly selectedCabin: CabinClass;
  readonly origin: string;
  readonly destination: string;
  readonly onSelect: (flightId: string) => void;
};

/**
 * Premium flight card with glassmorphism effects.
 */
export const FlightCard = ({
  flight,
  selectedCabin,
  origin,
  destination,
  onSelect,
}: FlightCardProps) => {
  const { t } = useTranslation();

  // Simulated times for prototype
  // In a real system, these would come from the Flight read model
  const departureDate = new Date();
  departureDate.setHours(10, 30, 0, 0);
  const arrivalDate = new Date(
    departureDate.getTime() + 2 * 60 * 60 * 1000 + 45 * 60 * 1000,
  ); // +2h45

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const duration = "2h 45m";

  const getPrice = () => {
    switch (selectedCabin) {
      case "ECONOMY":
        return flight.economyPrice;
      case "BUSINESS":
        return flight.businessPrice;
      case "FIRST":
        return flight.firstPrice;
      default:
        return flight.economyPrice;
    }
  };

  const price = getPrice();

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 transition-all hover:bg-white/10 hover:shadow-xl">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        {/* Flight info */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
            <Plane className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase">
              {flight.flightId}
            </h3>
            <p className="text-xs text-slate-500">Operated by Avionics</p>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex flex-1 items-center justify-center gap-8 px-4">
          <div className="text-center">
            <p className="text-xl font-bold text-white">
              {formatTime(departureDate)}
            </p>
            <p className="text-sm font-medium text-slate-400">{origin}</p>
          </div>

          <div className="relative flex flex-1 flex-col items-center">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter text-slate-500">
              <Clock className="h-3 w-3" />
              {duration}
            </div>
            <div className="relative h-[2px] w-full bg-slate-700">
              <div className="absolute top-1/2 left-0 h-2 w-2 -translate-y-1/2 rounded-full bg-slate-600" />
              <div className="absolute top-1/2 right-0 h-2 w-2 -translate-y-1/2 rounded-full bg-slate-600" />
              <Plane className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-90 text-blue-500" />
            </div>
            <div className="mt-1 text-[10px] font-medium text-slate-500">
              Direct
            </div>
          </div>

          <div className="text-center">
            <p className="text-xl font-bold text-white">
              {formatTime(arrivalDate)}
            </p>
            <p className="text-sm font-medium text-slate-400">{destination}</p>
          </div>
        </div>

        {/* Price and CTA */}
        <div className="flex items-center justify-between border-t border-white/5 pt-4 md:flex-col md:items-end md:border-t-0 md:pt-0">
          <div className="text-right">
            <p className="text-xs font-medium text-slate-400">
              {t(`select.${selectedCabin}` as any)}
            </p>
            <p className="text-2xl font-black text-white">
              {price.amount}
              <span className="ml-1 text-sm font-medium text-slate-400">
                {price.currency}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelect(flight.flightId)}
            className="mt-2 rounded-xl bg-white px-6 py-2.5 text-xs font-bold text-slate-900 transition-all hover:bg-slate-200 active:scale-95"
          >
            {t("search.select").toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
};
