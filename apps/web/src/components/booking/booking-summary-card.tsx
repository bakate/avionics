import { type BookingSummary } from "@workspace/application/read-models";
import { Calendar, CreditCard, PlaneTakeoff, User } from "lucide-react";
import { useTranslation } from "react-i18next";

interface BookingSummaryCardProps {
  booking: BookingSummary;
}

export const BookingSummaryCard = ({ booking }: BookingSummaryCardProps) => {
  const { t } = useTranslation();

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "held":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "confirmed":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "ticketed":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "cancelled":
        return "bg-rose-100 text-rose-700 border-rose-200";
      case "expired":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/40 p-5 shadow-xl backdrop-blur-md transition-all hover:bg-white/60 hover:shadow-2xl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200">
            <PlaneTakeoff className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{booking.pnrCode}</h3>
            <p className="text-sm text-slate-500">
              {new Date(booking.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getStatusColor(
            booking.status,
          )}`}
        >
          {booking.status}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <User className="h-4 w-4 text-slate-400" />
          <span>
            {booking.passengerCount}{" "}
            {booking.passengerCount === 1
              ? t("common.passenger" as any)
              : t("common.passengers" as any)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CreditCard className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-900">
            {booking.totalPrice.amount} {booking.totalPrice.currency}
          </span>
        </div>
      </div>

      {booking.expiresAt._tag === "Some" && booking.status === "Held" && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50/50 p-2 text-xs text-amber-700">
          <Calendar className="h-3.5 w-3.5" />
          <span>
            {t("booking.expiresAt" as any)}:{" "}
            {new Date(booking.expiresAt.value).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};
