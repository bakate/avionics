import { Airplane01Icon, Ticket01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { Heading } from "@workspace/ui/components/heading";
import { ItemGroup } from "@workspace/ui/components/item";
import { SectionCard } from "@workspace/ui/components/section-card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { cn } from "@workspace/ui/lib/utils";
import { motion } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { EmptyState } from "@/components/shared/empty-state";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import { ROUTES } from "@/routes";
import { BookingItem } from "./booking-item";
import { SearchForm } from "./search-form";
import { type SearchHubProps } from "./types";

type HubTab = "book" | "trips";

export const SearchHub = ({
  onSearch,
  isLoading,
  defaultValues,
  allBookings: propBookings = [],
  isFetchingBookings,
  hasBookings,
  onRetryFetchBookings,
  error,
}: SearchHubProps) => {
  const { t } = useTranslation();
  const { context } = useBookingMachine();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<HubTab>("book");
  const isMobile = useIsMobile();

  const allBookings = context.allBookings || propBookings;

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-12 relative duration-500">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as HubTab)}
        className="sm:w-full flex-col items-center flex"
        orientation={isMobile ? "vertical" : "horizontal"}
      >
        {/* Tab Navigation - Sophisticated pill with Framer Motion */}
        <TabsList
          variant="capsule"
          className={cn(
            "relative z-40 mx-auto flex transition-all duration-300 backdrop-blur-2xl bg-white/5",
            isMobile
              ? "flex-col h-auto w-full max-w-[280px] p-2 gap-1 rounded-3xl -mb-12"
              : "flex-row justify-center -mb-8 overflow-hidden",
          )}
        >
          <TabsTrigger
            value="book"
            variant="capsule"
            className={cn(
              "gap-3 relative z-10 transition-colors duration-500",
              activeTab === "book" ? "text-royal-blue" : "text-white/50",
              isMobile && "w-full justify-start px-6 py-4 h-auto",
            )}
          >
            {activeTab === "book" && (
              <motion.div
                layoutId="hub-pill"
                className="absolute inset-x-1 inset-y-1 rounded-full bg-white shadow-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <HugeiconsIcon
              icon={Airplane01Icon}
              size={16}
              className="relative z-20"
            />
            <span className="relative z-20">{t("home.hub.book")}</span>
          </TabsTrigger>

          <TabsTrigger
            value="trips"
            variant="capsule"
            className={cn(
              "gap-3 relative z-10 transition-colors duration-500",
              activeTab === "trips" ? "text-royal-blue" : "text-white/50",
              isMobile && "w-full justify-start px-6 py-4 h-auto",
            )}
          >
            {activeTab === "trips" && (
              <motion.div
                layoutId="hub-pill"
                className="absolute inset-x-1 inset-y-1 rounded-full bg-white shadow-lg"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <HugeiconsIcon
              icon={Ticket01Icon}
              size={16}
              className="relative z-20"
            />
            <span className="relative z-20">{t("home.hub.trips")}</span>
            {hasBookings ? (
              <span
                className={cn(
                  "ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-bold transition-colors relative z-20",
                  activeTab === "trips"
                    ? "bg-royal-blue text-white"
                    : "bg-white/20 text-white/50",
                )}
              >
                {allBookings.length}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* Search Bar Container - Sleek Deep Background */}
        <div className="w-full relative overflow-hidden rounded-[3.5rem] border border-white/10 bg-slate-950/80 p-4 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-700 md:p-6 mt-12 md:mt-0 mb-4 sm:mb-0">
          <div className="absolute inset-0 bg-linear-to-br from-royal-blue/10 to-transparent opacity-30 pointer-events-none" />
          <TabsContent value="book" className="sm:m-0 p-0 outline-none">
            <SearchForm
              onSearch={onSearch}
              isLoading={isLoading}
              defaultValues={defaultValues}
            />
          </TabsContent>

          <TabsContent
            value="trips"
            className="m-0 p-0 outline-none relative z-10 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar"
          >
            {isFetchingBookings && !hasBookings ? (
              <ItemGroup className="gap-3 py-4">
                {[1, 2, 3].map((key) => (
                  <div
                    key={key}
                    className="h-20 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10"
                  />
                ))}
              </ItemGroup>
            ) : error ? (
              <div className="py-8">
                <SectionCard
                  variant="ghost"
                  title={t("common.error")}
                  className="p-0 border-none bg-transparent shadow-none"
                >
                  <EmptyState
                    title={t("common.error")}
                    description={error}
                    isError
                    className="text-white bg-transparent"
                    action={
                      onRetryFetchBookings ? (
                        <Button
                          onClick={() => onRetryFetchBookings?.()}
                          className="mt-6 h-12 rounded-full bg-red-600 px-10 font-bold hover:bg-red-700"
                        >
                          {t("common.retry")}
                        </Button>
                      ) : undefined
                    }
                  />
                </SectionCard>
              </div>
            ) : hasBookings ? (
              <div className="flex flex-col gap-6">
                <ItemGroup className="gap-3 p-1 py-4">
                  {allBookings
                    .slice(0, 3)
                    .map((booking: any, index: number) => (
                      <BookingItem
                        key={booking.id}
                        booking={booking}
                        index={index}
                      />
                    ))}
                </ItemGroup>

                {allBookings.length > 3 && (
                  <div className="flex justify-center pb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/50 hover:text-white hover:bg-white/10 rounded-full px-6 transition-all duration-300"
                      onClick={() => {
                        void navigate(ROUTES.trips);
                      }}
                    >
                      {t("home.hub.viewAll")}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-white/5 text-white/20 border border-white/5">
                  <HugeiconsIcon
                    icon={Airplane01Icon}
                    size={32}
                    className="-rotate-45"
                  />
                </div>
                <Heading
                  level="h3"
                  title={t("home.noBookings")}
                  headerClassName="font-heading text-2xl text-white md:text-3xl"
                  description={t("home.noBookingsSub")}
                  descriptionClassName="max-w-xs mt-3 text-white/40 text-sm"
                  className="mb-8"
                />
                <Button
                  className="h-12 rounded-full border border-white/10 bg-white/5 px-10 font-bold tracking-widest text-xs text-white hover:bg-white hover:text-royal-blue transition-all"
                  onClick={() => setActiveTab("book")}
                >
                  <HugeiconsIcon
                    icon={Airplane01Icon}
                    size={16}
                    className="mr-2 rotate-0"
                  />
                  {t("home.hub.book")}
                </Button>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
