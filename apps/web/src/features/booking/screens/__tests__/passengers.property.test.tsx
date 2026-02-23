// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBookingMachine } from "../../hooks/use-booking-machine";
import { PassengersScreen } from "../passengers.screen";

vi.mock("../../hooks/use-booking-machine");
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// We mock PassengerForm to isolate rendering logic of the screen itself
vi.mock("../../components/passenger-form", () => ({
  PassengerForm: ({ type }: any) => (
    <div data-testid="passenger-form" data-type={type} />
  ),
}));

const searchParamsArb = fc.record({
  origin: fc.constant("CDG"),
  destination: fc.constant("JFK"),
  departureDate: fc.date().map((d) => d.toISOString().split("T")[0]),
  returnDate: fc
    .option(
      fc.date().map((d) => d.toISOString().split("T")[0]),
      { nil: undefined },
    )
    .map((d) => d || undefined),
  passengers: fc.record({
    adults: fc.integer({ min: 1, max: 4 }),
    children: fc.integer({ min: 0, max: 4 }),
    infants: fc.integer({ min: 0, max: 2 }),
  }),
  cabin: fc.constant("ECONOMY"),
});

describe("PassengersScreen Property Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the correct number of PassengerForm components based on searchParams", () => {
    fc.assert(
      fc.property(searchParamsArb, (searchParams) => {
        vi.mocked(useBookingMachine).mockReturnValue({
          context: {
            searchParams,
            passengers: [], // initial empty
          },
          send: vi.fn(),
        } as any);

        render(<PassengersScreen />);

        try {
          const forms = screen.queryAllByTestId("passenger-form");

          const totalExpected =
            searchParams.passengers.adults +
            searchParams.passengers.children +
            searchParams.passengers.infants;
          expect(forms.length).toBe(totalExpected);

          const adults = forms.filter(
            (f) => f.getAttribute("data-type") === "ADULT",
          ).length;
          expect(adults).toBe(searchParams.passengers.adults);

          const children = forms.filter(
            (f) => f.getAttribute("data-type") === "CHILD",
          ).length;
          expect(children).toBe(searchParams.passengers.children);

          const infants = forms.filter(
            (f) => f.getAttribute("data-type") === "INFANT",
          ).length;
          expect(infants).toBe(searchParams.passengers.infants);
        } finally {
          cleanup();
        }
      }),
      { numRuns: 50 },
    );
  });
});
