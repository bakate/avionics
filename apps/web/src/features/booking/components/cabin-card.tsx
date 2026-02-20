// Cabin card — displays cabin name, price, seats, sold-out state 3)

import { type CabinClass } from "@workspace/domain/kernel";
import { cn } from "@workspace/ui/lib/utils";
import { useTranslation } from "react-i18next";

export type CabinCardProps = {
  readonly cabin: CabinClass;
  readonly price: { readonly amount: number; readonly currency: string };
  readonly availableSeats: number;
  readonly isSelected?: boolean;
  readonly onSelect: () => void;
};

const CABIN_STYLES: Record<
  CabinClass,
  { border: string; bg: string; accent: string }
> = {
  ECONOMY: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    accent: "text-emerald-700",
  },
  BUSINESS: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    accent: "text-blue-700",
  },
  FIRST: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    accent: "text-amber-700",
  },
};

export const CabinCard = ({
  cabin,
  price,
  availableSeats,
  isSelected,
  onSelect,
}: CabinCardProps) => {
  const { t } = useTranslation();
  const styles = CABIN_STYLES[cabin];
  const soldOut = availableSeats === 0;

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center rounded-xl border-2 px-6 py-4 text-center transition-all min-h-[44px] min-w-[44px]",
        soldOut
          ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400 opacity-60"
          : cn(
              styles.border,
              styles.bg,
              "hover:shadow-lg cursor-pointer",
              isSelected && "ring-2 ring-offset-2 ring-blue-500 shadow-md",
            ),
      )}
      aria-label={
        soldOut
          ? `${t(`select.${cabin}` as any)} — ${t("select.soldOut")}`
          : `${t(`select.${cabin}` as any)} — ${price.amount} ${price.currency}`
      }
      aria-pressed={isSelected}
    >
      <span
        className={cn(
          "text-sm font-bold uppercase tracking-wider",
          soldOut ? "text-gray-400" : styles.accent,
        )}
      >
        {t(`select.${cabin}` as any)}
      </span>

      {soldOut ? (
        <span className="mt-2 text-sm font-medium text-gray-400">
          {t("select.soldOut")}
        </span>
      ) : (
        <>
          <span className="mt-2 text-2xl font-bold text-gray-900">
            {price.amount}
            <span className="ml-1 text-sm font-medium text-gray-500">
              {price.currency}
            </span>
          </span>
          <span
            className={cn(
              "mt-1 text-xs",
              availableSeats <= 5
                ? "font-semibold text-orange-500"
                : "text-gray-500",
            )}
          >
            {t("select.seatsLeft_other", { count: availableSeats })}
          </span>
        </>
      )}
    </button>
  );
};
