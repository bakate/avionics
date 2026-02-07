import { Booking } from "@workspace/domain/booking";
import {
  BookingId,
  CabinClass,
  EmailSchema,
  FlightId,
  Gender,
  Money,
  PassengerType,
  PnrCodeSchema,
  SegmentId,
} from "@workspace/domain/kernel";
import { Passenger } from "@workspace/domain/passenger";
import { BookingSegment } from "@workspace/domain/segment";
import { Option as O, Schema } from "effect";

export interface CreateTestBookingOptions {
  readonly pnrCode?: string;
  readonly passengerCount?: number;
  readonly segmentCount?: number;
  readonly expiresAt?: Date;
}

/**
 * Create a test booking with default values
 */
export const createTestBooking = ({
  pnrCode = "ABC123",
  passengerCount = 1,
  segmentCount = 1,
  expiresAt,
}: CreateTestBookingOptions = {}): Booking => {
  // Create passengers
  const passengers = Array.from(
    { length: passengerCount },
    (_, index) =>
      new Passenger({
        id: Schema.decodeSync(Schema.String.pipe(Schema.brand("PassengerId")))(
          crypto.randomUUID(),
        ),
        firstName: `John${index}`,
        lastName: `Doe${index}`,
        email: Schema.decodeSync(EmailSchema)(`john${index}@example.com`),
        dateOfBirth: new Date("1990-01-01"),
        gender: Gender.MALE,
        type: PassengerType.ADULT,
      }),
  ) as [Passenger, ...Array<Passenger>];

  // Create segments
  const segments = Array.from(
    { length: segmentCount },
    (_, index) =>
      new BookingSegment({
        id: Schema.decodeSync(SegmentId)(crypto.randomUUID()),
        flightId: Schema.decodeSync(FlightId)(
          `FL${String(index).padStart(3, "0")}`,
        ),
        cabin: CabinClass.ECONOMY,
        price: Money.of(100 + index * 10, "EUR"),
        seatNumber: O.some(`1${String.fromCharCode(65 + index)}`),
      }),
  ) as [BookingSegment, ...Array<BookingSegment>];

  // Create booking using factory method
  return Booking.create({
    id: Schema.decodeSync(BookingId)(crypto.randomUUID()),
    pnrCode: Schema.decodeSync(PnrCodeSchema)(pnrCode),
    passengers,
    segments,
    expiresAt: expiresAt ? O.some(expiresAt) : O.none(),
  });
};
