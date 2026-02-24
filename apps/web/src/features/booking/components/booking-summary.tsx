import {
  AirplaneTakeOff01Icon,
  Calendar03Icon,
  CreditCardIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type BookingSummary } from "@workspace/application/read-models";
import { Badge } from "@workspace/ui/components/badge";
import { SectionCard } from "@workspace/ui/components/section-card";
import { useTranslation } from "react-i18next";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

interface BookingSummaryCardProps {
  booking: BookingSummary;
}

export const BookingSummaryCard = ({ booking }: BookingSummaryCardProps) => {
  const { t } = useTranslation();

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "held":
        return "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100/80";
      case "confirmed":
        return "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80";
      case "ticketed":
        return "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100/80";
      case "cancelled":
        return "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100/80";
      case "expired":
        return "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100/80";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100/80";
    }
  };

  return (
    <SectionCard
      title={booking.pnrCode}
      icon={
        <div className="flex size-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200">
          <HugeiconsIcon icon={AirplaneTakeOff01Icon} size={20} />
        </div>
      }
      action={
        <Badge
          variant="outline"
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getStatusColor(
            booking.status,
          )}`}
        >
          {booking.status}
        </Badge>
      }
      description={formatDate(new Date(booking.createdAt))}
      className="group relative overflow-hidden border-white/20 bg-white/40 shadow-xl backdrop-blur-md transition-all hover:bg-white/60 hover:shadow-2xl"
    >
      <div className="mt-2 grid grid-cols-2 gap-4 text-muted-foreground dark:text-white">
        <div className="flex items-center gap-2 text-sm">
          <HugeiconsIcon
            icon={UserCircleIcon}
            size={16}
            className="text-slate-400"
          />
          <span>
            {booking.passengerCount}{" "}
            {booking.passengerCount === 1
              ? t("common.passenger")
              : t("common.passengers")}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm justify-self-end">
          <HugeiconsIcon icon={CreditCardIcon} size={16} />
          <span className="font-medium">{formatMoney(booking.totalPrice)}</span>
        </div>
      </div>

      {booking.expiresAt._tag === "Some" && booking.status === "Held" && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50/50 p-2 text-xs text-amber-700">
          <HugeiconsIcon icon={Calendar03Icon} size={14} />
          <span>
            {t("booking.expiresAt")}:{" "}
            {formatDateTime(new Date(booking.expiresAt.value))}
          </span>
        </div>
      )}
    </SectionCard>
  );
};
