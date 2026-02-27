import {
  Airplane01Icon,
  Loading02Icon,
  Sparkles,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { Heading } from "@workspace/ui/components/heading";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/shared/empty-state";
import { BookingSummaryCard } from "@/features/booking/components/booking-summary";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import { SearchForm } from "@/features/search/components/search-form";

const HomePage = () => {
  const { t } = useTranslation();
  const { state, send, context, isLoading } = useBookingMachine();

  const isFetchingBookings = isLoading && state === "fetchingBookings";
  const hasBookings = context.allBookings.length > 0;

  return (
    <div className="min-h-screen bg-[#F7F9FC] dark:bg-slate-950">
      {/* Hero Section */}
      <section className="relative flex min-h-[75vh] flex-col items-center justify-center px-4 pt-20 pb-40 overflow-hidden">
        {/* Background image + overlay */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 hover:scale-105"
          style={{ backgroundImage: 'url("/hero-bg.jpg")' }}
        >
          {/* Advanced Overlay with Air France vibe: dark gradient to focus on the search form */}
          <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/20 to-[#F7F9FC] dark:to-slate-950" />
        </div>

        <div className="relative z-10 w-full max-w-6xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold tracking-widest text-white uppercase backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-700">
            <HugeiconsIcon
              icon={Sparkles}
              size={14}
              className="text-blue-300"
            />
            <span>{t("home.badge")}</span>
          </div>

          {/* Heading with better typography */}
          <div className="mb-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            <Heading
              title={t("home.title")}
              description={t("home.subtitle")}
              headerClassName="text-5xl font-black tracking-tight text-white md:text-7xl lg:text-8xl drop-shadow-sm"
              descriptionClassName="mx-auto mt-6 max-w-2xl text-lg font-medium text-slate-100/90 md:text-xl drop-shadow-sm"
              className="mb-0"
            />
          </div>

          {/* Search form with better positioning and container */}
          <div className="relative mx-auto w-full max-w-5xl animate-in fade-in zoom-in-95 duration-700 delay-500">
            <div className="absolute -inset-1 rounded-[2.5rem] bg-linear-to-r from-blue-600/20 to-indigo-600/20 blur-xl" />
            <div className="relative">
              <SearchForm
                onSearch={(values) =>
                  send({
                    type: "SEARCH",
                    params: values,
                  })
                }
                isLoading={isLoading && state === "searching"}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Bookings Section - Modern Travel Dashboard style */}
      <section className="relative z-20 -mt-20 mx-auto max-w-6xl px-4 pb-24">
        <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl shadow-blue-900/5 ring-1 ring-slate-200/60 md:p-12 dark:bg-slate-900 dark:ring-slate-800 dark:shadow-none">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <Heading
              title={t("home.recentBookings")}
              description={t("home.recentBookingsSub")}
              className="mb-0"
            />

            {isFetchingBookings && hasBookings && (
              <div className="flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
                <HugeiconsIcon
                  icon={Loading02Icon}
                  size={16}
                  className="animate-spin text-blue-600"
                />
                <span>{t("common.loading")}</span>
              </div>
            )}
          </div>

          {isFetchingBookings && !hasBookings ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-3xl bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
                />
              ))}
            </div>
          ) : context.error && state === "error" ? (
            <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-red-200 bg-red-50/30 py-16 text-center dark:border-red-900/30 dark:bg-red-900/10">
              <div className="mb-4 flex size-20 items-center justify-center rounded-full bg-red-100 text-red-600 shadow-inner dark:bg-red-900/50 dark:text-red-400">
                <HugeiconsIcon
                  icon={Airplane01Icon}
                  size={36}
                  className="-rotate-45"
                />
              </div>
              <EmptyState
                title={t("common.error")}
                description={context.error}
                isError
                action={
                  <Button
                    onClick={() => send({ type: "FETCH_BOOKINGS" })}
                    className="mt-8 rounded-full bg-red-600 px-8 py-6 text-base font-bold text-white shadow-xl shadow-red-200 transition-all hover:bg-red-700 hover:shadow-2xl active:scale-95 dark:shadow-none"
                  >
                    {t("common.retry")}
                  </Button>
                }
              />
            </div>
          ) : hasBookings ? (
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {context.allBookings.map((booking, index) => (
                <div
                  key={booking.id}
                  className="animate-in fade-in slide-in-from-bottom-8 transition-all duration-700 fill-mode-both"
                  style={{
                    animationDelay: `${index * 150}ms`,
                  }}
                >
                  <BookingSummaryCard
                    booking={booking}
                    onUpdate={() => send({ type: "FETCH_BOOKINGS" })}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-slate-50/50 py-20 text-center dark:border-slate-800 dark:bg-slate-800/50">
              <div className="mb-6 flex size-24 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-700 dark:ring-slate-800">
                <HugeiconsIcon
                  icon={Airplane01Icon}
                  size={48}
                  className="-rotate-45"
                />
              </div>
              <Heading
                title={t("home.noBookings")}
                headerClassName="text-2xl"
                description={t("home.noBookingsSub")}
                descriptionClassName="max-w-sm"
              />
            </div>
          )}
        </div>
      </section>

      {/* Bottom subtle accent */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-40 bg-linear-to-t from-[#F7F9FC] to-transparent dark:from-slate-950" />
    </div>
  );
};

export default HomePage;
