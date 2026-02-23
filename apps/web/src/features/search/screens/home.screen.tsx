import {
  Airplane01Icon,
  Loading02Icon,
  Sparkles,
  Time01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@workspace/ui/components/button";
import { Heading } from "@workspace/ui/components/heading";
import { SectionCard } from "@workspace/ui/components/section-card";
import { useTranslation } from "react-i18next";
import { BookingSummaryCard } from "@/features/booking/components/booking-summary";
import { useBookingMachine } from "@/features/booking/hooks/use-booking-machine";
import { SearchForm } from "@/features/search/components/search-form";

const HomePage = () => {
  const { t } = useTranslation();
  const { state, send, context, isLoading } = useBookingMachine();

  const isFetchingBookings = isLoading && state === "fetchingBookings";
  const hasBookings = context.allBookings.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative flex min-h-[62vh] flex-col items-center justify-center px-4 pt-20 pb-32">
        {/* Background image + overlay */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url("/hero-bg.jpg")' }}
        >
          {/* Overlay that adapts: warm dark overlay in light mode, deeper overlay in dark mode */}
          <div className="absolute inset-0 bg-linear-to-b from-foreground/60 via-foreground/40 to-background" />
        </div>

        <div className="relative z-10 w-full max-w-5xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-4 py-1.5 text-sm font-semibold text-primary-foreground backdrop-blur-md">
            <HugeiconsIcon icon={Sparkles} size={16} />
            <span>Nouvelles destinations disponibles</span>
          </div>

          {/* Heading */}

          <Heading
            title={t("home.title") || "Where excellence meets the horizon"}
            description={
              t("home.subtitle") ||
              "Experience high-assurance travel with Avionics. Seamless booking for the demanding traveler."
            }
            className="mb-12 flex flex-col items-center"
            headerClassName="text-4xl text-white md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4"
            descriptionClassName="text-slate-200 text-lg md:text-xl mx-auto max-w-2xl"
          />

          {/* push this section all the way to the bottom */}

          <div className="mx-auto mt-4 w-full max-w-4xl transform transition-all hover:scale-[1.01]">
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
      </section>

      {/* Bookings Section */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionCard
          title={t("home.recentBookings") || "Recent Bookings"}
          description={
            t("home.recentBookingsSub") || "Manage your existing reservations"
          }
          icon={
            <div className="flex size-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 text-blue-600">
              <HugeiconsIcon icon={Time01Icon} size={20} />
            </div>
          }
          variant="ghost"
          loading={isFetchingBookings && !hasBookings}
          action={
            isFetchingBookings && hasBookings ? (
              <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
                <HugeiconsIcon
                  icon={Loading02Icon}
                  size={16}
                  className="animate-spin"
                />
                <span>{t("common.loading") || "Refresing..."}</span>
              </div>
            ) : null
          }
          empty={
            !isFetchingBookings && !hasBookings
              ? {
                  title: t("home.noBookings") || "No bookings yet",
                  description:
                    t("home.noBookingsSub") ||
                    "Your future journeys will appear here.",
                  action: (
                    <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <HugeiconsIcon
                        icon={Airplane01Icon}
                        size={32}
                        className="-rotate-45"
                      />
                    </div>
                  ),
                }
              : undefined
          }
        >
          {context.error && state === "error" ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-red-200 bg-red-50/50 py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500">
                <HugeiconsIcon
                  icon={Airplane01Icon}
                  size={32}
                  className="-rotate-45"
                />
              </div>
              <h3 className="text-lg font-semibold text-red-900">
                {t("common.error") || "An error occurred"}
              </h3>
              <p className="mt-2 max-w-md text-red-500">{context.error}</p>
              <Button
                onClick={() => send({ type: "FETCH_BOOKINGS" })}
                className="mt-6 rounded-xl bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:bg-red-700 active:scale-95"
              >
                {t("common.retry") || "Retry"}
              </Button>
            </div>
          ) : hasBookings ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {context.allBookings.map((booking, index) => (
                <div
                  key={booking.id}
                  className="animate-in fade-in slide-in-from-bottom-4 transition-all"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <BookingSummaryCard booking={booking} />
                </div>
              ))}
            </div>
          ) : null}
        </SectionCard>
      </section>

      {/* Bottom gradient fade */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-32 bg-linear-to-t from-background to-transparent" />
    </div>
  );
};

export default HomePage;
