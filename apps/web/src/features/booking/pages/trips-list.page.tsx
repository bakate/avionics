import {
  Airplane01Icon,
  ArrowLeft01Icon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { Heading } from "@workspace/ui/components/heading";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import { BookingItem } from "@/features/search/components/booking-item";
import { ROUTES } from "@/routes";

export const TripsListPage = () => {
  const { t } = useTranslation();
  const { context, is } = useBookingMachine();
  const navigate = useNavigate();

  const allBookings = context.allBookings;
  const isLoading = is("fetchingBookings");
  const hasBookings = allBookings.length > 0;

  const handleBack = () => {
    void navigate(ROUTES.home);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
        </Button>
        <div className="flex flex-col">
          <Heading
            level="h1"
            title={t("home.hub.trips")}
            description={t("home.recentBookingsSub")}
            className="mb-0"
          />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="absolute -inset-4 animate-spin rounded-full border-2 border-blue-600/20 border-t-blue-600" />
              <div className="flex size-16 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-xl ring-1 ring-slate-100 dark:ring-slate-700">
                <HugeiconsIcon
                  icon={Airplane01Icon}
                  size={32}
                  className="text-blue-600 dark:text-blue-400"
                />
              </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              {t("common.loading")}
            </p>
          </div>
        ) : hasBookings ? (
          <div className="grid gap-6">
            {allBookings.map((booking: any, index: number) => (
              <BookingItem key={booking.id} booking={booking} index={index} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 border-dashed text-center">
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800 mb-6">
              <HugeiconsIcon
                icon={Calendar03Icon}
                size={48}
                className="text-slate-400"
              />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              {t("home.noBookings")}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm px-6">
              {t("home.noBookingsSub")}
            </p>
            <Button
              onClick={() => navigate(ROUTES.home)}
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-10 py-6 text-base font-bold shadow-lg shadow-blue-600/20"
            >
              {t("home.hub.book")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
