import { FetchHttpClient } from "@effect/platform";
import { type BookingResponse } from "@workspace/api/booking-api";
import { Effect } from "effect";
import { useEffect, useState } from "react";
import { getBookings } from "@/api/booking.api";

const HomePage = () => {
  const [bookings, setBookings] = useState<ReadonlyArray<BookingResponse>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const program = getBookings().pipe(
      Effect.tap((res) => Effect.sync(() => setBookings(res))),
      Effect.tap(() => Effect.sync(() => setLoading(false))),
      Effect.catchAll(() => Effect.sync(() => setLoading(false))),
      Effect.provide(FetchHttpClient.layer),
    );

    void Effect.runPromise(program);
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 px-4 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold md:text-5xl">
          Trouvez votre prochain vol
        </h1>
        <p className="mt-2 text-gray-500">
          Gérez vos réservations en toute simplicité
        </p>
      </div>

      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Réservations récentes</h2>
          <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
            {bookings.length} vols
          </span>
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 w-full animate-pulse rounded-2xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            {bookings.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50 p-8 text-center text-gray-400">
                <p>Aucune réservation trouvée</p>
              </div>
            ) : (
              bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:border-blue-200 hover:shadow-md md:flex-row md:items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <title>Flight Icon</title>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900">
                          {booking.pnrCode}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            booking.status === "Confirmed"
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {booking.passengers.length} passager(s) •{" "}
                        {booking.segments.length} segment(s)
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-50 pt-4 md:mt-0 md:border-none md:pt-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Créé le</p>
                      <p className="text-sm font-medium">
                        {new Date(booking.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ml-6 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition-colors group-hover:bg-blue-600 group-hover:text-white"
                      aria-label="Voir les détails"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <title>Details Icon</title>
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
