import { PnrStatus } from "@workspace/domain/booking";
import { Badge } from "@workspace/ui/components/badge";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/utils";
import type React from "react";
import { useTranslation } from "react-i18next";

export interface BookingStatusBadgeProps extends React.ComponentProps<
  typeof Badge
> {
  status?: PnrStatus;
  isUpdating?: boolean;
}

export function BookingStatusBadge({
  status = PnrStatus.HELD,
  isUpdating,
  className,
  ...props
}: BookingStatusBadgeProps) {
  const { t } = useTranslation();
  const normalizedStatus = status.toLowerCase();

  const getStatusClasses = () => {
    switch (normalizedStatus) {
      case "held":
        return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "confirmed":
        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "ticketed":
        return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "cancelled":
        return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400";
      case "expired":
        return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400";
      default:
        return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  // We check for `booking.status.${normalizedStatus}` and fall back to `booking.${normalizedStatus}` if not found.
  // Finally fallback to the string passed.
  const translatedStatus = t(`booking.${normalizedStatus}`, {
    defaultValue: status,
  });

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border font-bold uppercase tracking-wider",
        getStatusClasses(),
        className,
      )}
      {...props}
    >
      {isUpdating && <Spinner className="mr-1.5 size-3" />}
      {translatedStatus}
    </Badge>
  );
}
