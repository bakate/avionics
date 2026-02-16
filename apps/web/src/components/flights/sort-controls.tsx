/**
 * Sort controls for flight results.
 * Requirements: 2.2
 */
import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type SortField = "price" | "departure" | "duration";
export type SortOrder = "asc" | "desc";

export type SortControlsProps = {
  readonly currentField: SortField;
  readonly currentOrder: SortOrder;
  readonly onSortChange: (field: SortField, order: SortOrder) => void;
};

const SortButton = ({
  active,
  onClick,
  children,
  order,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  order: SortOrder;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
      active
        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
    }`}
  >
    {children}
    {active &&
      (order === "asc" ? (
        <ArrowUpAZ className="h-3 w-3" />
      ) : (
        <ArrowDownAZ className="h-3 w-3" />
      ))}
  </button>
);

export const SortControls = ({
  currentField,
  currentOrder,
  onSortChange,
}: SortControlsProps) => {
  const { t } = useTranslation();

  const handleToggle = (field: SortField) => {
    if (currentField === field) {
      onSortChange(field, currentOrder === "asc" ? "desc" : "asc");
    } else {
      onSortChange(field, "asc");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500 mr-2">
        {t("search.sortBy")}
      </span>
      <SortButton
        active={currentField === "price"}
        order={currentOrder}
        onClick={() => handleToggle("price")}
      >
        {t("search.sortPrice")}
      </SortButton>
      <SortButton
        active={currentField === "departure"}
        order={currentOrder}
        onClick={() => handleToggle("departure")}
      >
        {t("search.sortTime")}
      </SortButton>
      <SortButton
        active={currentField === "duration"}
        order={currentOrder}
        onClick={() => handleToggle("duration")}
      >
        {t("search.sortDuration")}
      </SortButton>
    </div>
  );
};
