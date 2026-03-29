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
  variant?: "default" | "compact";
}

export const BookingSummaryCard = ({
  booking,
  variant = "default",
}: BookingSummaryCardProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const navigate = useNavigate();
  const {
    send,
    isLoading: isMachineLoading,
    activeAction,
    error: machineError,
  } = useBookingMachine();

  const isUpdating = isMachineLoading && activeAction?.id === booking.id;
  const errorMessage = activeAction?.id === booking.id ? machineError : null;
  const isCompact = variant === "compact";

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
      className={`group relative cursor-pointer overflow-hidden rounded-[2rem] border border-slate-100 bg-white transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] premium-shadow dark:border-slate-800 dark:bg-slate-900 ${
        isCompact ? "p-5" : "p-8"
      } ${isUpdating ? "opacity-70 pointer-events-none" : ""}`}
    >
      {/* Subtle top accent based on status */}
      <div
        className={`absolute inset-x-0 top-0 h-2 ${
          status === "confirmed" || status === "ticketed"
            ? "bg-emerald-500/80"
            : status === "held"
              ? "bg-amber-500/80"
              : status === "cancelled" || status === "expired"
                ? "bg-rose-500/80"
                : "bg-slate-300"
        }`}
      />

      <div className={`flex flex-col ${isCompact ? "gap-4" : "gap-8"}`}>
        {/* Header: PNR & Status */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
              {t("booking.pnr")}
            </span>
            <h3
              className={`${
                isCompact ? "text-xl" : "text-3xl"
              } font-black tracking-tighter text-slate-900 transition-colors group-hover:text-primary dark:text-white`}
            >
              {booking.pnrCode}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <BookingStatusBadge
              status={booking.status}
              isUpdating={isUpdating}
              className={`${
                isCompact ? "px-2 py-1 text-[8px]" : "px-4 py-1.5 text-[10px]"
              } font-black uppercase tracking-widest shadow-sm transition-all`}
            />
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="rounded-2xl bg-red-50 p-4 text-xs font-bold text-red-600 ring-1 ring-red-100 animate-in fade-in zoom-in-95 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-900/30">
            {errorMessage}
          </div>
        )}

        {/* Content: Date & Passengers */}
        <div className={`flex flex-col ${isCompact ? "gap-4" : "gap-6"}`}>
          <div
            className={`flex items-center justify-between border-y border-slate-50 dark:border-slate-800/50 ${
              isCompact ? "py-4" : "py-6"
            }`}
          >
            <div
              className={`flex items-center ${isCompact ? "gap-3" : "gap-4"}`}
            >
              <div
                className={`flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-100 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-700 dark:group-hover:bg-blue-900/20 ${
                  isCompact ? "size-10" : "size-14"
                }`}
              >
                <HugeiconsIcon
                  icon={Calendar03Icon}
                  size={isCompact ? 18 : 24}
                />
              </div>
              <div className="flex flex-col">
                <span className="mb-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {t("booking.date")}
                </span>
                <span
                  className={`${
                    isCompact ? "text-xs" : "text-sm"
                  } font-black text-slate-900 dark:text-slate-100`}
                >
                  {formatDate(new Date(booking.createdAt))}
                </span>
              </div>
            </div>

            <div
              className={`flex items-center ${isCompact ? "gap-3" : "gap-4"}`}
            >
              <div
                className={`flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-slate-100 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-700 dark:group-hover:bg-blue-900/20 ${
                  isCompact ? "size-10" : "size-14"
                }`}
              >
                <HugeiconsIcon
                  icon={UserCircleIcon}
                  size={isCompact ? 18 : 24}
                />
              </div>
              <div className="flex flex-col items-end text-right">
                <span className="mb-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  {t("booking.passengers")}
                </span>
                <span
                  className={`${
                    isCompact ? "text-xs" : "text-sm"
                  } font-black text-slate-900 dark:text-slate-100`}
                >
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
              <span className="mb-1 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
                {t("booking.totalPrice")}
              </span>
              <span
                className={`${
                  isCompact ? "text-xl" : "text-3xl"
                } font-black tracking-tight text-blue-600 dark:text-blue-500`}
              >
                {formatMoney(booking.totalPrice)}
              </span>
            </div>

            {booking.expiresAt._tag === "Some" && status === "held" && (
              <div
                className={`flex flex-col items-end rounded-2xl bg-amber-50 ring-1 ring-amber-100 transition-colors group-hover:bg-amber-100 dark:bg-amber-950/30 dark:ring-amber-900/30 ${
                  isCompact ? "px-3 py-1.5" : "px-4 py-2"
                }`}
              >
                <span className="mb-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                  {t("booking.expiresAt")}
                </span>
                <span
                  className={`${
                    isCompact ? "text-[10px]" : "text-[11px]"
                  } font-black text-amber-900 dark:text-amber-100`}
                >
                  {formatDateTime(new Date(booking.expiresAt.value), locale)}
                </span>
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void navigate(buildRoute.bookingDetails(booking.pnrCode));
              }}
              className={`${
                isCompact ? "h-10 text-[8px]" : "h-14 text-[10px]"
              } flex-1 rounded-2xl bg-slate-50 px-4 font-black uppercase tracking-[0.2em] text-slate-500 transition-all hover:bg-slate-900 hover:text-white dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-white dark:hover:text-black`}
            >
              {t("booking.actions.view")}
            </button>

            {status === "held" && (
              <button
                type="button"
                onClick={handlePay}
                className={`${
                  isCompact ? "h-10 text-[8px]" : "h-14 text-[10px]"
                } flex-1 rounded-2xl bg-blue-600 px-4 font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 hover:shadow-blue-700/40 active:scale-95`}
              >
                {t("booking.actions.payNow")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
