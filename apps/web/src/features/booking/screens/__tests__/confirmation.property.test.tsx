// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBookingMachine } from "../../hooks/use-booking-machine";
import { ConfirmationScreen } from "../confirmation.screen.tsx";

vi.mock("../../hooks/use-booking-machine");
vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate" data-to={to}>
      Redirected
    </div>
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

describe("ConfirmationScreen Property Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to home if state is not confirmed or bookingResult is missing", () => {
    // Arbitrary state that is NOT 'confirmed'
    const notConfirmedArb = fc.string().filter((s) => s !== "confirmed");
    // Arbitrary for presence or absence of bookingResult
    const bookingResultArb = fc.option(fc.object());

    fc.assert(
      fc.property(
        notConfirmedArb,
        bookingResultArb,
        (stateStr, bookingResult) => {
          vi.mocked(useBookingMachine).mockReturnValue({
            is: (val: unknown) => val === stateStr,
            context: {
              bookingResult,
              passengers: [],
            },
            send: vi.fn(),
            reset: vi.fn(),
          } as any);

          render(<ConfirmationScreen />);
          try {
            expect(screen.getByTestId("navigate")).toBeDefined();
          } finally {
            cleanup();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("renders ConfirmationScreen with BookingSummaryCard when confirmed and result exists", () => {
    const bookingResultArb = fc.record({
      bookingId: fc.uuid(),
      pnrCode: fc.stringMatching(/^[A-Z0-9]{6}$/).map((s) => s || "XXXXXX"),
      status: fc.constantFrom(
        "HELD",
        "CONFIRMED",
        "TICKETED",
        "CANCELLED",
        "EXPIRED",
      ),
      totalPrice: fc.record({
        amount: fc.integer({ min: 10 }),
        currency: fc.constantFrom("USD", "EUR"),
      }),
      confirmedAt: fc.date({
        min: new Date("2026-01-01"),
        max: new Date("2030-01-01"),
      }),
    });

    const passengersArb = fc.array(
      fc.record({
        firstName: fc.string(),
        lastName: fc.string(),
        email: fc.emailAddress(),
      }),
      { minLength: 1, maxLength: 9 },
    );

    fc.assert(
      fc.property(
        bookingResultArb,
        passengersArb,
        (bookingResult, passengers) => {
          vi.mocked(useBookingMachine).mockReturnValue({
            is: ((val: unknown) => val === "confirmed") as any,
            context: {
              bookingResult,
              passengers,
            },
            send: vi.fn(),
            reset: vi.fn(),
          } as any);

          render(<ConfirmationScreen />);

          try {
            // Should not redirect
            expect(screen.queryByTestId("navigate")).toBeNull();

            // Should display success message
            expect(screen.getByText("confirmation.successTitle")).toBeDefined();

            // Should display PNR
            expect(
              screen.getAllByText(bookingResult.pnrCode as string)[0],
            ).toBeDefined();

            // Should display Button
            expect(screen.getByText("confirmation.newBooking")).toBeDefined();
          } finally {
            cleanup();
          }
        },
      ),
    );
  });
});
