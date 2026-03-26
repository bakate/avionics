// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import {
  type AirportCode,
  type CabinClass,
  FlightId,
} from "@workspace/domain/kernel";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBookingMachine } from "../hooks/use-booking-machine";
import { FlightResult } from "../machines/booking.machine";
import { OutboundScreen } from "../screens/outbound.screen";

// Mock the hook and translation
vi.mock("../hooks/use-booking-machine");
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

// Arbitraries for tests
const cabinClassArb = fc.constantFrom<CabinClass>(
  "ECONOMY",
  "BUSINESS",
  "FIRST",
);

const moneyArb = fc.record({
  amount: fc.integer({ min: 1, max: 999 }),
  currency: fc.constantFrom("EUR", "USD"),
});

const flightResultArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 5 }),
    fc.uniqueArray(
      fc
        .tuple(cabinClassArb, moneyArb, fc.integer({ min: 1, max: 10 }))
        .map(([cabin, price, seats]) => ({
          cabin,
          availableSeats: seats,
          price,
        })),
      { minLength: 1, maxLength: 3, selector: (c) => c.cabin },
    ),
  )
  .map(
    ([id, cabins]): FlightResult =>
      new FlightResult({
        flightId: FlightId.make(`FL-${id}`),
        flightNumber: "AF123",
        origin: "CDG",
        destination: "JFK",
        departureTime: new Date().toISOString(),
        arrivalTime: new Date().toISOString(),
        durationMinutes: 120,
        stops: 0,
        cabins,
        lastUpdated: new Date().toISOString(),
      }),
  );

describe("Property 1: Fault Condition - Cabin Click Immediately Dispatches Machine Event Without Fare Panel", () => {
  const mockSend = vi.fn();

  beforeEach(() => {
    mockSend.mockClear();
  });

  it("fails because cabin click immediately dispatches and shows no panel", () => {
    // This test is EXPECTED TO FAIL on unfixed code.
    fc.assert(
      fc.property(flightResultArb, cabinClassArb, (flight, targetCabin) => {
        // Only test if the target cabin exists and has seats
        const cabinData = flight.cabins.find((c) => c.cabin === targetCabin);
        if (!cabinData || cabinData.availableSeats === 0) return true;

        mockSend.mockClear();
        vi.mocked(useBookingMachine).mockReturnValue({
          context: {
            searchParams: {
              tripType: "roundTrip",
              origin: "CDG" as AirportCode,
              destination: "JFK" as AirportCode,
              departureDate: "2026-06-15",
              returnDate: "2026-06-22",
              passengers: { adults: 1, children: 0, infants: 0 },
              cabinClass: "ECONOMY",
            },
            outboundFlights: [flight],
            returnFlights: [],
          } as any,
          send: mockSend,
          reset: vi.fn(),
          isLoading: false,
          is: vi.fn(),
          tags: new Set(),
          actorRef: {} as any,
          state: "selectingOutbound",
          outboundFlights: [flight],
          returnFlights: [],
          filters: { cabinClass: "ECONOMY", maxStops: null, timeRange: null },
          activeAction: null,
          error: null,
          sortField: "price",
          sortOrder: "asc",
        });

        const { unmount } = render(<OutboundScreen />);

        // Find the specific button for the target cabin using its aria-label
        const buttonName = new RegExp(
          `select.${targetCabin} — ${cabinData.price.amount}`,
          "i",
        );
        const cabinButtons = screen.queryAllByRole("button", {
          name: buttonName,
          hidden: true,
        });

        if (cabinButtons.length === 0) {
          unmount();
          return true;
        }

        fireEvent.click(cabinButtons[0] as HTMLElement);

        // --- ASSERTIONS FOR THE FIX ---
        // 1. Should NOT dispatch SELECT_OUTBOUND immediately
        expect(mockSend).not.toHaveBeenCalledWith(
          expect.objectContaining({ type: "SELECT_OUTBOUND" }),
        );

        // 2. Should show fare detail content in the accordion
        const detailTexts = screen.queryAllByText(
          /select\.includedPerPassenger/i,
        );
        expect(detailTexts.length).toBeGreaterThan(0);

        // 3. Should show a "Sélectionner" confirmation button
        const confirmButtons = screen.queryAllByRole("button", {
          name: /select\.continue|Sélectionner|Continuer/i,
        });
        expect(confirmButtons.length).toBeGreaterThan(0);

        // 4. Should have step label in header
        const stepLabel = screen.queryByText(/steps\.outbound/i);
        expect(stepLabel).not.toBeNull();

        unmount();
      }),
      { numRuns: 10 },
    );
  });
});
