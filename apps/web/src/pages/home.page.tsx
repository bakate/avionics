import { History, Loader2, Plane } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BookingSummaryCard } from "../components/booking/booking-summary-card";
import { SearchForm } from "../components/search/search-form";
import { useBookingMachine } from "../hooks/use-booking-machine";

const HomePage = () => {
  const { t } = useTranslation();
  const { state, send, context, isLoading } = useBookingMachine();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative flex min-h-[60vh] flex-col items-center justify-center px-4 pt-20 pb-32">
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url("/hero-bg.png")' }}
        >
          <div className="absolute inset-0 bg-linear-to-b from-slate-900/60 via-slate-900/40 to-slate-50" />
        </div>

        <div className="relative z-10 w-full max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-4 py-1.5 text-sm font-semibold text-blue-100 backdrop-blur-md ring-1 ring-blue-500/30">
            <Plane className="h-4 w-4" />
            <span>{t("home.badge") || "New routes available to Paris"}</span>
          </div>

          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-white md:text-6xl lg:text-7xl">
            {t("home.title") || "Where excellence meets the horizon"}
          </h1>
          <p className="mx-auto mb-12 max-w-2xl text-lg text-slate-200 md:text-xl">
            {t("home.subtitle") ||
              "Experience high-assurance travel with Avionics. Seamless booking for the demanding traveler."}
          </p>

          <div className="mx-auto w-full max-w-4xl transform transition-all hover:scale-[1.01]">
            <SearchForm
              onSearch={(params) => send({ type: "SEARCH", params })}
              isLoading={isLoading && state === "searching"}
            />
          </div>
        </div>
      </section>

      {/* Bookings Section */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 text-blue-600">
              <History className="size-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {t("home.recentBookings" as any) || "Recent Bookings"}
              </h2>
              <p className="text-sm text-slate-500">
                {t("home.recentBookingsSub" as any) ||
                  "Manage your existing reservations"}
              </p>
            </div>
          </div>

          {isLoading && state === "fetchingBookings" && (
            <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("common.loading") || "Refresing..."}</span>
            </div>
          )}
        </div>

        {context.error && state === "error" ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-red-200 bg-red-50/50 py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500">
              <Plane className="h-8 w-8 -rotate-45" />
            </div>
            <h3 className="text-lg font-semibold text-red-900">
              {t("common.error") || "An error occurred"}
            </h3>
            <p className="mt-2 max-w-md text-red-500">{context.error}</p>
            <button
              type="button"
              onClick={() => send({ type: "FETCH_BOOKINGS" })}
              className="mt-6 rounded-xl bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:bg-red-700 active:scale-95"
            >
              {t("common.retry") || "Retry"}
            </button>
            <p className="mt-4 text-[10px] text-slate-300 opacity-50">
              API: http://127.0.0.1:3000/api
            </p>
          </div>
        ) : context.allBookings.length > 0 ? (
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
        ) : !isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Plane className="h-8 w-8 -rotate-45" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {t("home.noBookings" as any) || "No bookings yet"}
            </h3>
            <p className="mt-2 text-slate-500">
              {t("home.noBookingsSub" as any) ||
                "Your future journeys will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
              />
            ))}
          </div>
        )}
      </section>

      {/* Footer-like Gradient */}
      <div className="pointer-events-none fixed bottom-0 left-0 right-0 h-32 bg-linear-to-t from-slate-50 to-transparent" />
    </div>
  );
};

export default HomePage;
