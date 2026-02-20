/**
 * Flight selection card.
 */

import { Airplane01Icon, Time01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type CabinClass } from "@workspace/domain/kernel";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { useTranslation } from "react-i18next";
import { type FlightResult } from "../../features/booking/machines/booking.machine";

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
    <Card className="group relative overflow-hidden border-white/10 bg-white/5 transition-all hover:bg-white/10 hover:shadow-xl">
      <CardContent className="p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* Flight info */}
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
              <HugeiconsIcon icon={Airplane01Icon} size={24} />
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
              <Badge
                variant="outline"
                className="mb-2 flex items-center gap-2 border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-tighter text-slate-500"
              >
                <HugeiconsIcon icon={Time01Icon} size={12} />
                {duration}
              </Badge>
              <div className="relative h-[2px] w-full bg-slate-700">
                <div className="absolute top-1/2 left-0 size-2 -translate-y-1/2 rounded-full bg-slate-600" />
                <div className="absolute top-1/2 right-0 size-2 -translate-y-1/2 rounded-full bg-slate-600" />
                <HugeiconsIcon
                  icon={Airplane01Icon}
                  size={16}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 text-blue-500"
                />
              </div>
              <div className="mt-1 text-[10px] font-medium text-slate-500">
                Direct
              </div>
            </div>

            <div className="text-center">
              <p className="text-xl font-bold text-white">
                {formatTime(arrivalDate)}
              </p>
              <p className="text-sm font-medium text-slate-400">
                {destination}
              </p>
            </div>
          </div>

          {/* Price and CTA */}
          <div className="flex items-center justify-between border-t border-white/5 pt-4 md:flex-col md:items-end md:border-t-0 md:pt-0">
            <div className="text-right">
              <p className="text-xs font-medium text-slate-400">
                {t(`select.${selectedCabin}` as any)}
              </p>
              <p className="text-2xl font-black">
                {price.amount}
                <span className="ml-1 text-sm font-medium text-slate-400">
                  {price.currency}
                </span>
              </p>
            </div>
            <Button
              onClick={() => onSelect(flight.flightId)}
              className="mt-2 rounded-xl bg-white text-slate-900 hover:bg-slate-200"
            >
              {t("search.select").toUpperCase()}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
