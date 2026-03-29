import { type BookingSummary } from "@workspace/application/read-models";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item";
import { cn } from "@workspace/ui/lib/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookingStatusBadge } from "@/features/booking/components/booking-status-badge";
import { formatDate, formatMoney } from "@/lib/format";

interface BookingItemProps {
  booking: BookingSummary;
  index: number;
}

export const BookingItem = ({ booking, index }: BookingItemProps) => {
  const { t } = useTranslation();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const imageSrc = hasError
    ? "/images/destinations/default.jpg"
    : `/images/destinations/${booking.destination}.jpg`;

  return (
    <Item
      key={booking.id}
      className="border-white/5 bg-white/5 text-white transition-all hover:bg-white/10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <ItemMedia variant="image" className="bg-slate-800/50 overflow-hidden relative">
        {!imageLoaded && !hasError && (
          <div className="absolute inset-0 bg-slate-800/50 animate-pulse" />
        )}
        <img
          src={imageSrc}
          alt={booking.destination}
          className={cn(
            "size-full object-cover transition-opacity duration-500",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            if (!hasError) setHasError(true);
            setImageLoaded(true); // Show the default image
          }}
        />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="text-white font-black tracking-tight">
          {booking.pnrCode}
          <BookingStatusBadge
            status={booking.status}
            className="ml-3 px-2 py-0.5 text-[8px] uppercase tracking-widest border-none bg-white/10 text-white"
          />
        </ItemTitle>
        <ItemDescription className="text-slate-400 text-xs font-medium uppercase tracking-wider">
          {booking.origin} → {booking.destination} • {formatDate(new Date(booking.createdAt))}
        </ItemDescription>
        <ItemDescription className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter">
          {booking.passengerCount}{" "}
          {booking.passengerCount === 1
            ? t("common.passenger")
            : t("common.passengers")}
        </ItemDescription>
      </ItemContent>
      <ItemContent className="flex-none text-right">
        <ItemTitle className="text-blue-400 font-black text-xl justify-end">
          {formatMoney(booking.totalPrice)}
        </ItemTitle>
        <ItemDescription className="text-[10px] text-slate-500 uppercase font-black">
          {t("booking.totalPrice")}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
};
