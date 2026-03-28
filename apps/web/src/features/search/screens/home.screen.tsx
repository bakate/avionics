import {
  Airplane01Icon,
  GlobalIcon,
  Loading02Icon,
  SecurityIcon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { Heading } from "@workspace/ui/components/heading";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/shared/empty-state";
import { BookingSummaryCard } from "@/features/booking/components/booking-summary";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import { DestinationCard } from "../components/destination-card";
import { SearchHub } from "../components/search-hub";

const HomePage = () => {
  const { t } = useTranslation();
  const { state, send, context, isLoading } = useBookingMachine();

  const isFetchingBookings = isLoading && state === "fetchingBookings";
  const hasBookings = context.allBookings.length > 0;

  return (
    <div className="min-h-screen bg-white transition-colors duration-500 dark:bg-slate-950">
      {/* Hero Section - Full Width */}
      <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden pt-16 pb-32">
        {/* Background image + subtle overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/hero_premium.png"
            alt="Avionics Premium Experience"
            className="h-full w-full object-cover transition-transform duration-[10000ms] hover:scale-110"
          />
          {/* Lighter, more premium overlay - Air France style */}
          <div className="absolute inset-0 bg-linear-to-b from-black/40 via-transparent to-white dark:to-slate-950" />
        </div>

        <div className="relative z-10 w-full px-4 text-center">
          {/* Exclusive Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-2.5 text-[10px] font-black tracking-[0.2em] text-white uppercase backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-1000">
            <HugeiconsIcon
              icon={StarIcon}
              size={12}
              className="text-yellow-400"
            />
            <span>{t("home.badge")}</span>
          </div>

          {/* Heading with Elegant Typography */}
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <h1 className="mx-auto max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl lg:text-8xl drop-shadow-md">
              {t("home.title")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg font-medium text-white/90 drop-shadow-sm md:text-xl">
              {t("home.subtitle")}
            </p>
          </div>

          {/* Search Hub Integration */}
          <div className="relative mx-auto w-full max-w-5xl animate-in fade-in zoom-in-95 duration-1000 delay-500">
            <SearchHub
              onSearch={(values) =>
                send({
                  type: "SEARCH",
                  params: values,
                })
              }
              isLoading={isLoading && state === "searching"}
              defaultValues={context.searchParams ?? undefined}
            />
          </div>
        </div>
      </section>

      {/* Main Content Area - Centered max-w-7xl */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 xl:px-0">
        {/* Destinations Showcase */}
        <section className="py-24">
          <div className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between">
            <Heading
              title={t("home.destinations.title")}
              description={t("home.destinations.subtitle")}
              className="mb-0"
              headerClassName="text-4xl font-black"
            />
            <Button variant="ghost" className="mt-4 font-bold md:mt-0">
              View All{" "}
              <HugeiconsIcon icon={GlobalIcon} size={18} className="ml-2" />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <DestinationCard
              city="Paris"
              country="France"
              price="€840"
              image="/images/paris.png"
              promo={t("home.destinations.promoText")}
            />
            <DestinationCard
              city="Tokyo"
              country="Japan"
              price="€1,240"
              image="/images/tokyo.png"
            />
            <DestinationCard
              city="Dakar"
              country="Sénégal"
              price="€620"
              image="/images/dakar.png"
              promo={t("home.destinations.promoText")}
            />
            <DestinationCard
              city="New York"
              country="USA"
              price="€950"
              image="/images/newyork.png"
            />
          </div>
        </section>

        <hr className="border-slate-100 dark:border-slate-900" />

        {/* My Trips / Recent Bookings */}
        <section className="py-24">
          <div className="mb-12 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/20">
                <HugeiconsIcon icon={Airplane01Icon} size={28} />
              </div>
              <Heading
                title={t("home.recentBookings")}
                description={t("home.recentBookingsSub")}
                className="mb-0"
                headerClassName="text-3xl font-black"
              />
            </div>

            {isFetchingBookings && hasBookings && (
              <div className="flex items-center gap-3 rounded-full bg-slate-100 px-6 py-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
                <HugeiconsIcon
                  icon={Loading02Icon}
                  size={18}
                  className="animate-spin text-blue-600"
                />
                <span>{t("common.loading")}</span>
              </div>
            )}
          </div>

          {isFetchingBookings && !hasBookings ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-[2rem] bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
                />
              ))}
            </div>
          ) : context.error && state === "error" ? (
            <div className="rounded-[3rem] border border-red-100 bg-red-50/20 p-20 text-center dark:border-red-900/10 dark:bg-red-900/5">
              <EmptyState
                title={t("common.error")}
                description={context.error}
                isError
                action={
                  <Button
                    onClick={() => send({ type: "FETCH_BOOKINGS" })}
                    size="lg"
                    className="mt-8 rounded-full bg-red-600 font-bold px-10"
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
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <BookingSummaryCard booking={booking} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-[3rem] bg-slate-50/50 py-32 text-center ring-1 ring-slate-200/50 dark:bg-slate-900/50 dark:ring-slate-800/50">
              <div className="mb-8 flex size-24 items-center justify-center rounded-full bg-white text-slate-200 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:text-slate-700 dark:ring-slate-700">
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
                descriptionClassName="max-w-sm mt-2"
              />
            </div>
          )}
        </section>

        {/* Brand Values / The Avionics Difference */}
        <section className="pb-32">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                <HugeiconsIcon icon={SecurityIcon} size={32} />
              </div>
              <h4 className="mb-2 text-xl font-black">
                {t("home.values.reliability.title")}
              </h4>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {t("home.values.reliability.desc")}
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                <HugeiconsIcon icon={StarIcon} size={32} />
              </div>
              <h4 className="mb-2 text-xl font-black">
                {t("home.values.comfort.title")}
              </h4>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {t("home.values.comfort.desc")}
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                <HugeiconsIcon icon={GlobalIcon} size={32} />
              </div>
              <h4 className="mb-2 text-xl font-black">
                {t("home.values.network.title")}
              </h4>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {t("home.values.network.desc")}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Branding Area */}
      <div className="py-20 text-center">
        <div className="flex items-center justify-center gap-3 text-2xl font-black tracking-tighter text-slate-200 dark:text-slate-800">
          <HugeiconsIcon
            icon={Airplane01Icon}
            size={32}
            className="rotate-45"
          />
          <span>AVIONICS</span>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
