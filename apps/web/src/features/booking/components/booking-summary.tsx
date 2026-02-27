import {
  AirplaneTakeOff01Icon,
  ArrowRight01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CreditCardIcon,
  Menu01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { type BookingSummary } from "@workspace/application/read-models";
import { Badge } from "@workspace/ui/components/badge";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { SectionCard } from "@workspace/ui/components/section-card";
import { Spinner } from "@workspace/ui/components/spinner";
import { Effect } from "effect";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { cancelBooking, confirmBooking } from "@/api/booking.api";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { buildRoute } from "@/routes";

interface BookingSummaryCardProps {
  booking: BookingSummary;
  onUpdate?: () => void;
}

export const BookingSummaryCard = ({
  booking,
  onUpdate,
}: BookingSummaryCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePay = () => {
    setIsUpdating(true);
    setErrorMessage(null);
    Effect.runPromise(confirmBooking(booking.id))
      .then(() => onUpdate?.())
      .catch((error) => {
        console.error("Payment failed", error);
        setErrorMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setIsUpdating(false));
  };

  const handleCancel = () => {
    setIsUpdating(true);
    setErrorMessage(null);
    Effect.runPromise(cancelBooking(booking.id, "User requested cancellation"))
      .then(() => onUpdate?.())
      .catch((error) => {
        console.error("Cancellation failed", error);
        setErrorMessage(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setIsUpdating(false));
  };

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
        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${getStatusColor(
              booking.status,
            )}`}
          >
            {isUpdating ? <Spinner className="size-3 mr-1" /> : null}
            {booking.status}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={isUpdating}
              className="inline-flex items-center justify-center h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              <HugeiconsIcon icon={Menu01Icon} size={16} />
              <span className="sr-only">Actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() =>
                  navigate(buildRoute.bookingDetails(booking.pnrCode))
                }
              >
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={16}
                  className="mr-2"
                />
                {t("booking.actions.view", "Consulter")}
              </DropdownMenuItem>

              {booking.status.toLowerCase() === "held" && (
                <>
                  <DropdownMenuItem onClick={handlePay}>
                    <HugeiconsIcon
                      icon={CreditCardIcon}
                      size={16}
                      className="mr-2 text-blue-600"
                    />
                    {t("booking.actions.pay", "Payer")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleCancel}
                  >
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      size={16}
                      className="mr-2"
                    />
                    {t("booking.actions.cancel", "Annuler")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      description={formatDate(new Date(booking.createdAt))}
      className="group relative overflow-hidden border-white/20 bg-white/40 shadow-xl backdrop-blur-md transition-all hover:bg-white/60 hover:shadow-2xl"
    >
      {errorMessage && (
        <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm font-medium text-destructive dark:bg-destructive/10 dark:text-red-400">
          {errorMessage}
        </div>
      )}
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
