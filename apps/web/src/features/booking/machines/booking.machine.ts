import { type BookFlightCommand } from "@workspace/application/booking.commands";
import { createBookingMachine } from "@workspace/application/booking-machine";
import {
  BookingResult,
  FlightResult,
  type PassengerInput,
  type SearchParams,
} from "@workspace/application/booking-types";
import { type BookingSummary } from "@workspace/application/read-models";
import {
  type CabinClass,
  type CurrencyCode,
  FlightId,
  Money,
  type PassengerType,
} from "@workspace/domain/kernel";
import { Effect } from "effect";
import { v4 as uuidv4 } from "uuid";
import {
  bookFlight,
  cancelBooking,
  confirmBooking,
  getBookingByPnr,
  getBookings,
} from "@/api/booking.api";
import { findAvailableFlights } from "@/api/inventory.api";
import { fromEffect } from "@/lib/xstate-effect";
import { loadLastEmail, saveLastEmail } from "./booking.persistence";

// Re-exports for components to use
export * from "@workspace/application/booking-machine";
export * from "@workspace/application/booking-types";

const derivePassengerType = (dateOfBirth: Date): PassengerType => {
  const age = new Date().getFullYear() - dateOfBirth.getFullYear();
  if (age < 2) return "INFANT";
  if (age < 12) return "CHILD";
  if (age < 18) return "YOUNG_ADULT";
  if (age < 65) return "ADULT";
  return "SENIOR";
};

export const bookingMachine = createBookingMachine({
  helpers: {
    isConfirmationPage: () =>
      window.location.pathname.startsWith("/confirmation"),
  },
  actions: {
    persistEmail: saveLastEmail,
    navigate: (url) => {
      window.location.href = url;
    },
  },
  userEmailInitialLoader: loadLastEmail,
  actors: {
    searchFlights: fromEffect((input: SearchParams) =>
      Effect.gen(function* () {
        const flights = yield* findAvailableFlights({
          cabin: "ECONOMY",
          origin: input.origin,
          destination: input.destination,
          departureDate: new Date(input.departureDate),
        });

        return flights.map(
          (flight) =>
            new FlightResult({
              flightId: FlightId.make(flight.flightId.valueOf() ?? ""),
              flightNumber: flight.flightNumber.valueOf() ?? "",
              origin: flight.origin.valueOf() ?? input.origin,
              destination: flight.destination.valueOf() ?? input.destination,
              departureTime:
                flight.departureTime instanceof Date
                  ? flight.departureTime.toISOString()
                  : String(flight.departureTime),
              arrivalTime:
                flight.arrivalTime instanceof Date
                  ? flight.arrivalTime.toISOString()
                  : String(flight.arrivalTime),
              durationMinutes: flight.durationMinutes,
              stops: flight.stops,
              cabins: [
                {
                  cabin: "ECONOMY" as CabinClass,
                  availableSeats: flight.economyAvailable,
                  price: {
                    amount: flight.economyPrice.amount,
                    currency: flight.economyPrice.currency as CurrencyCode,
                  },
                },
                {
                  cabin: "BUSINESS" as CabinClass,
                  availableSeats: flight.businessAvailable,
                  price: {
                    amount: flight.businessPrice.amount,
                    currency: flight.businessPrice.currency as CurrencyCode,
                  },
                },
                {
                  cabin: "FIRST" as CabinClass,
                  availableSeats: flight.firstAvailable,
                  price: {
                    amount: flight.firstPrice.amount,
                    currency: flight.firstPrice.currency as CurrencyCode,
                  },
                },
              ],
              lastUpdated:
                flight.lastUpdated instanceof Date
                  ? flight.lastUpdated.toISOString()
                  : String(flight.lastUpdated),
            }),
        ) as ReadonlyArray<FlightResult>;
      }),
    ),
    searchReturnFlights: fromEffect((input: SearchParams) =>
      Effect.gen(function* () {
        const returnDate = input.returnDate;
        if (!returnDate) return [];

        const flights = yield* findAvailableFlights({
          cabin: "ECONOMY",
          origin: input.destination,
          destination: input.origin,
          departureDate: new Date(returnDate),
        });

        return flights.map(
          (flight) =>
            new FlightResult({
              flightId: FlightId.make(flight.flightId.valueOf() ?? ""),
              flightNumber: flight.flightNumber.valueOf() ?? "",
              origin: flight.origin.valueOf() ?? input.destination,
              destination: flight.destination.valueOf() ?? input.origin,
              departureTime:
                flight.departureTime instanceof Date
                  ? flight.departureTime.toISOString()
                  : String(flight.departureTime),
              arrivalTime:
                flight.arrivalTime instanceof Date
                  ? flight.arrivalTime.toISOString()
                  : String(flight.arrivalTime),
              durationMinutes: flight.durationMinutes,
              stops: flight.stops,
              cabins: [
                {
                  cabin: "ECONOMY" as CabinClass,
                  availableSeats: flight.economyAvailable,
                  price: {
                    amount: flight.economyPrice.amount,
                    currency: flight.economyPrice.currency as CurrencyCode,
                  },
                },
                {
                  cabin: "BUSINESS" as CabinClass,
                  availableSeats: flight.businessAvailable,
                  price: {
                    amount: flight.businessPrice.amount,
                    currency: flight.businessPrice.currency as CurrencyCode,
                  },
                },
                {
                  cabin: "FIRST" as CabinClass,
                  availableSeats: flight.firstAvailable,
                  price: {
                    amount: flight.firstPrice.amount,
                    currency: flight.firstPrice.currency as CurrencyCode,
                  },
                },
              ],
              lastUpdated:
                flight.lastUpdated instanceof Date
                  ? flight.lastUpdated.toISOString()
                  : String(flight.lastUpdated),
            }),
        ) as ReadonlyArray<FlightResult>;
      }),
    ),
    fetchBookings: fromEffect((input?: { email?: string }) =>
      Effect.gen(function* () {
        const response = yield* getBookings(input?.email);
        return response as unknown as ReadonlyArray<BookingSummary>;
      }).pipe(
        Effect.tapError((error) =>
          Effect.logError("Failed to fetch bookings", error),
        ),
      ),
    ),
    fetchBookingDetails: fromEffect((input: { pnr: string }) =>
      getBookingByPnr(input.pnr).pipe(Effect.map((res) => res as unknown)),
    ),
    submitBooking: fromEffect(
      (input: {
        segments: ReadonlyArray<{ flightId: string; cabinClass: CabinClass }>;
        passengers: ReadonlyArray<PassengerInput>;
      }) =>
        Effect.gen(function* () {
          if (input.passengers.length === 0) {
            return yield* Effect.fail(new Error("No passengers provided"));
          }

          const mappedPassengers = input.passengers.map((passenger) => ({
            id: uuidv4(),
            firstName: passenger.firstName,
            lastName: passenger.lastName,
            email: passenger.email,
            dateOfBirth: passenger.dateOfBirth,
            gender: passenger.gender,
            type: derivePassengerType(passenger.dateOfBirth),
          }));

          const command: BookFlightCommand = {
            segments:
              input.segments as unknown as BookFlightCommand["segments"],
            passengers:
              mappedPassengers as unknown as BookFlightCommand["passengers"],
            successUrl: `${window.location.origin}/success?pnr={{PNR}}`,
            cancelUrl: `${window.location.origin}/cancel`,
          };

          const response = yield* Effect.scoped(bookFlight(command));

          const totalPrice = response.booking.segments.reduce(
            (sum, segment) => sum.add(segment.price),
            Money.zero(response.booking.segments[0]?.price.currency ?? "EUR"),
          );

          return new BookingResult({
            bookingId: response.booking.id,
            pnrCode: response.booking.pnrCode.valueOf() as string,
            status: response.booking.status,
            totalPrice: {
              amount: totalPrice.amount,
              currency: totalPrice.currency as CurrencyCode,
            },
            confirmedAt: response.booking.createdAt.toISOString(),
            checkoutUrl: response.checkoutUrl,
          });
        }),
    ),
    confirmBooking: fromEffect((input: { id: string }) =>
      confirmBooking(input.id).pipe(Effect.map((res) => res as unknown)),
    ),
    cancelBooking: fromEffect((input: { id: string; reason: string }) =>
      cancelBooking(input.id, input.reason).pipe(
        Effect.map((res) => res as unknown),
      ),
    ),
  },
});
