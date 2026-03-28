import {
  Airplane01Icon,
  Calendar01Icon,
  PassportIcon,
  Ticket01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchForm } from "./search-form";
import { type SearchFormProps } from "./types";

type TabType = "book" | "trips" | "checkin" | "status";

export const SearchHub = ({
  onSearch,
  isLoading,
  defaultValues,
}: SearchFormProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("book");

  const tabs = [
    { id: "book", label: t("home.hub.book"), icon: Airplane01Icon },
    { id: "trips", label: t("home.hub.trips"), icon: Ticket01Icon },
    { id: "checkin", label: t("home.hub.checkin"), icon: PassportIcon },
    { id: "status", label: t("home.hub.status"), icon: Calendar01Icon },
  ] as const;

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="mb-0 flex flex-wrap items-center gap-1 sm:gap-2 px-2 md:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "group relative flex items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-bold transition-all duration-300 md:px-6 md:py-4",
              activeTab === tab.id
                ? "bg-white text-primary shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] dark:bg-slate-900 dark:text-white"
                : "bg-white/40 text-white/80 hover:bg-white/60 hover:text-white dark:bg-slate-950/40 dark:text-slate-400 dark:hover:bg-slate-950/60",
            )}
          >
            <HugeiconsIcon
              icon={tab.icon}
              size={18}
              className={cn(
                "transition-transform duration-300 group-hover:scale-110",
                activeTab === tab.id ? "text-blue-600" : "text-current",
              )}
            />
            <span className="hidden sm:inline">{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute -bottom-px left-0 right-0 h-1 bg-white dark:bg-slate-900" />
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="rounded-b-[2.5rem] rounded-tr-[2.5rem] bg-white p-6 shadow-2xl shadow-blue-900/10 ring-1 ring-slate-200/60 md:p-10 dark:bg-slate-900 dark:ring-slate-800 dark:shadow-none">
        {activeTab === "book" ? (
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
            <SearchForm
              onSearch={onSearch}
              isLoading={isLoading}
              defaultValues={defaultValues}
            />
          </div>
        ) : (
          <div className="flex min-h-[300px] flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-slate-50 text-slate-300 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:ring-slate-700">
              <HugeiconsIcon
                icon={
                  tabs.find((t) => t.id === activeTab)?.icon ?? Airplane01Icon
                }
                size={40}
              />
            </div>
            <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h3>
            <p className="max-w-xs text-sm font-medium text-slate-500 dark:text-slate-400">
              This feature is coming soon in the next version of Avionics. Stay
              tuned!
            </p>
            <Button
              variant="outline"
              onClick={() => setActiveTab("book")}
              className="mt-8 rounded-full px-8"
            >
              Back to Booking
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
