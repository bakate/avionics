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
  { border: string; bg: string; accent: string; shadow: string }
> = {
  ECONOMY: {
    border: "border-emerald-200/50",
    bg: "bg-emerald-50/50",
    accent: "text-emerald-700",
    shadow: "hover:shadow-emerald-500/10",
  },
  BUSINESS: {
    border: "border-blue-200/50",
    bg: "bg-blue-50/50",
    accent: "text-blue-700",
    shadow: "hover:shadow-blue-500/10",
  },
  FIRST: {
    border: "border-amber-200/50",
    bg: "bg-amber-50/50",
    accent: "text-amber-700",
    shadow: "hover:shadow-amber-500/10",
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
        "flex flex-col items-center rounded-xl border px-6 py-4 text-center transition-all min-h-[44px] min-w-[44px] premium-shadow",
        soldOut
          ? "cursor-not-allowed border-muted bg-muted/20 text-muted-foreground opacity-60"
          : cn(
              styles.border,
              styles.bg,
              styles.shadow,
              "hover:-translate-y-1 cursor-pointer",
              isSelected &&
                "ring-1 ring-primary border-primary bg-white shadow-lg shadow-primary/5 scale-[1.02]",
            ),
      )}
      aria-label={
        soldOut
          ? `${t(`select.${cabin}`)} — ${t("select.soldOut")}`
          : `${t(`select.${cabin}`)} — ${price.amount} ${price.currency}`
      }
      aria-pressed={isSelected}
    >
      <span
        className={cn(
          "text-sm font-bold uppercase tracking-wider",
          soldOut ? "text-gray-400" : styles.accent,
        )}
      >
        {t(`select.${cabin}`)}
      </span>

      {soldOut ? (
        <span className="mt-2 text-sm font-medium text-gray-400">
          {t("select.soldOut")}
        </span>
      ) : (
        <>
          <span className="mt-2 text-2xl font-black text-foreground">
            {price.amount}
            <span className="ml-1 text-sm font-medium text-muted-foreground">
              {price.currency}
            </span>
          </span>
          <div className="mt-2 flex items-center gap-1.5 ">
            <span
              className={cn(
                "size-1.5 rounded-full",
                availableSeats <= 5
                  ? "bg-orange-500 animate-pulse"
                  : "bg-success animate-pulse",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-tight",
                availableSeats <= 5 ? "text-orange-600" : "text-success",
              )}
            >
              {availableSeats <= 5
                ? t("select.seatsLeft", { count: availableSeats })
                : "Real-time Stock"}
            </span>
          </div>
        </>
      )}
    </button>
  );
};
