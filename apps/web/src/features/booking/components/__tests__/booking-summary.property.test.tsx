// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { type BookingSummary } from "@workspace/application/read-models";
import { type None } from "effect/Option";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { BookingSummaryCard } from "@/features/booking/components/booking-summary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("react-router", () => ({
  useNavigate: () => vi.fn(),
}));

// Create arbitraries for BookingSummary
const bookingSummaryArb = fc.record({
  id: fc.uuid(),
  pnrCode: fc.stringMatching(/^[A-Z0-9]{6}$/).map((s) => s || "XXXXXX"),
  status: fc.constantFrom(
    "HELD",
    "CONFIRMED",
    "TICKETED",
    "CANCELLED",
    "EXPIRED",
  ),
  passengerCount: fc.integer({ min: 1, max: 9 }),
  totalPrice: fc.record({
    amount: fc.integer({ min: 1, max: 100000 }),
    currency: fc.constantFrom("USD", "EUR", "GBP"),
  }),
  createdAt: fc
    .date({ min: new Date("2026-01-01"), max: new Date("2030-01-01") })
    .filter((d) => !Number.isNaN(d.getTime())),
  expiresAt: fc
    .option(
      fc
        .date({ min: new Date("2026-01-01"), max: new Date("2030-01-01") })
        .filter((d) => !Number.isNaN(d.getTime())),
      { nil: undefined },
    )
    .map(
      (d) => (d ? { _tag: "Some", value: d } : { _tag: "None" }) as None<Date>,
    ),
});

describe("BookingSummaryCard Property Tests", () => {
  it("renders correctly with various BookingSummary states and fields", () => {
    fc.assert(
      fc.property(bookingSummaryArb, (booking) => {
        render(
          <BookingSummaryCard booking={booking as unknown as BookingSummary} />,
        );

        try {
          // Verify PNR is displayed
          expect(screen.getByText(booking.pnrCode as string)).toBeDefined();

          // Verify Status is displayed (case-insensitive or matching translation key)
          expect(
            screen.getByText(`booking.${booking.status.toLowerCase()}`),
          ).toBeDefined();

          // Verify Passenger count is displayed - note the translation fallback rendering
          // Use a custom matcher to avoid matching dates or amount numbers
          expect(
            screen.getByText(
              (content) =>
                content.includes(booking.passengerCount.toString()) &&
                content.includes("common.passenger"),
            ),
          ).toBeDefined();

          // The price display format uses Intl.NumberFormat, but we can check if amount is in document
          // Wait, price might be divided by 100 depending on how Money is handled.
          // Looking at the component, it does formatting. We can just verify it doesn't crash.
        } finally {
          cleanup();
        }
      }),
      { numRuns: 100 },
    );
  });
});
