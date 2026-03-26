import { Calendar03Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type BookingSummary } from "@workspace/application/read-models";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { buildRoute } from "@/routes";
import { useBookingMachine } from "../hooks/use-booking-machine";
import { BookingStatusBadge } from "./booking-status-badge";

interface BookingSummaryCardProps {
  booking: BookingSummary;
}

export const BookingSummaryCard = ({ booking }: BookingSummaryCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    send,
    isLoading: isMachineLoading,
    activeAction,
    error: machineError,
  } = useBookingMachine();

  const isUpdating = isMachineLoading && activeAction?.id === booking.id;
  const errorMessage = activeAction?.id === booking.id ? machineError : null;

  const status = booking.status?.toLowerCase();

  const handlePay = (e: React.MouseEvent) => {
    e.stopPropagation();
    send({ type: "CONFIRM_BOOKING_ACTION", id: booking.id });
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: <>
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        void navigate(buildRoute.bookingDetails(booking.pnrCode));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          void navigate(buildRoute.bookingDetails(booking.pnrCode));
        }
      }}
      className={`group relative cursor-pointer overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-900/10 dark:border-slate-800 dark:bg-slate-950 dark:hover:shadow-blue-500/5 ${
        isUpdating ? "opacity-70 pointer-events-none" : ""
      }`}
    >
      {/* Subtle top accent based on status */}
      <div
        className={`absolute inset-x-0 top-0 h-1.5 ${
          status === "confirmed" || status === "ticketed"
            ? "bg-emerald-500"
            : status === "held"
              ? "bg-amber-500"
              : status === "cancelled" || status === "expired"
                ? "bg-rose-500"
                : "bg-slate-300"
        }`}
      />

      <div className="flex flex-col gap-6">
        {/* Header: PNR & Status */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            {t("booking.pnr") || "Booking Ref"}
          </span>
          <h3 className="text-2xl font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
            {booking.pnrCode}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <BookingStatusBadge
            status={booking.status}
            isUpdating={isUpdating}
            className="px-3 py-1 text-[10px] shadow-sm transition-colors"
          />
        </div>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 ring-1 ring-red-100 animate-in fade-in zoom-in-95 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-900/30">
          {errorMessage}
        </div>
      )}

      {/* Content: Date & Passengers */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-800">
              <HugeiconsIcon icon={Calendar03Icon} size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t("booking.date") || "Date"}
              </span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {formatDate(new Date(booking.createdAt))}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-800">
              <HugeiconsIcon icon={UserCircleIcon} size={20} />
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t("booking.passengers") || "Travelers"}
              </span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {booking.passengerCount}{" "}
                {booking.passengerCount === 1
                  ? t("common.passenger")
                  : t("common.passengers")}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: Price & Expiry */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t("booking.totalPrice") || "Total Amount"}
            </span>
            <span className="text-xl font-black text-blue-600 dark:text-blue-400">
              {formatMoney(booking.totalPrice)}
            </span>
          </div>

          {booking.expiresAt._tag === "Some" && status === "held" && (
            <div className="flex flex-col items-end rounded-xl bg-amber-50 px-3 py-1.5 ring-1 ring-amber-100/50 dark:bg-amber-900/20 dark:ring-amber-900/30">
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {t("booking.expiresAt") || "Expires in"}
              </span>
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                {formatDateTime(new Date(booking.expiresAt.value))}
              </span>
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void navigate(buildRoute.bookingDetails(booking.pnrCode));
            }}
            className="mt-2 flex-1 rounded-2xl bg-slate-50 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-blue-600 hover:text-white active:scale-[0.98] dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-blue-600 dark:hover:text-white"
          >
            {t("booking.actions.view", "Consulter la réservation")}
          </button>

          {status === "held" && (
            <button
              type="button"
              onClick={handlePay}
              className="mt-2 flex-1 rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] shadow-lg shadow-blue-600/20"
            >
              {t("booking.actions.payNow", "Payer")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
