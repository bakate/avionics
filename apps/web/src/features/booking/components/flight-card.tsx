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
import { formatDuration, formatTime } from "../../../lib/format";
import { type FlightResult } from "../machines/booking.machine";

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

  const departureDate = new Date(flight.departureTime);
  const arrivalDate = new Date(flight.arrivalTime);

  const duration = formatDuration(flight.durationMinutes);

  const cabinData = flight.cabins.find((c) => c.cabin === selectedCabin);
  const price = cabinData?.price ?? { amount: 0, currency: "EUR" };

  return (
    <Card className="group relative overflow-hidden border-border/40 bg-card transition-all hover:bg-accent/5 hover:shadow-2xl hover:-translate-y-1 duration-300">
      <CardContent className="p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          {/* Flight info */}
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
              <HugeiconsIcon icon={Airplane01Icon} size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-widest text-muted-foreground uppercase">
                {flight.flightNumber}
              </h3>
              <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-tight">
                Operated by Avionics Air
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex flex-1 items-center justify-center gap-8 px-4">
            <div className="text-center group-hover:scale-110 transition-transform">
              <p className="text-2xl font-black text-foreground">
                {formatTime(departureDate)}
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {origin}
              </p>
            </div>

            <div className="relative flex flex-1 flex-col items-center">
              <Badge
                variant="outline"
                className="mb-2 flex items-center gap-2 border-border/40 bg-accent/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
              >
                <HugeiconsIcon icon={Time01Icon} size={12} />
                {duration}
              </Badge>
              <div className="relative h-px w-full bg-border">
                <div className="absolute top-1/2 left-0 size-1.5 -translate-y-1/2 rounded-full bg-primary" />
                <div className="absolute top-1/2 right-0 size-1.5 -translate-y-1/2 rounded-full bg-primary" />
                <HugeiconsIcon
                  icon={Airplane01Icon}
                  size={16}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 text-primary animate-in slide-in-from-left duration-1000"
                />
              </div>
              <div className="mt-1 text-[10px] font-medium text-slate-500">
                {flight.stops === 0
                  ? "Direct"
                  : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
              </div>
            </div>

            <div className="text-center group-hover:scale-110 transition-transform">
              <p className="text-2xl font-black text-foreground">
                {formatTime(arrivalDate)}
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {destination}
              </p>
            </div>
          </div>

          {/* Price and CTA */}
          <div className="flex items-center justify-between border-t border-border/40 pt-4 md:flex-col md:items-end md:border-t-0 md:pt-0">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">
                {t(`select.${selectedCabin}`)}
              </p>
              <p className="text-3xl font-black text-primary">
                {price.amount}
                <span className="ml-1 text-sm font-medium text-muted-foreground">
                  {price.currency}
                </span>
              </p>
            </div>
            <Button
              onClick={() => onSelect(flight.flightId)}
              className="mt-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-widest px-8 transition-all hover:scale-105"
            >
              {t("search.select").toUpperCase()}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
