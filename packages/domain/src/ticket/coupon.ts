import { Schema } from "effect";
import { CouponStatus, CouponStatusSchema, FlightId } from "../kernel.js";

export class Coupon extends Schema.Class<Coupon>("Coupon")({
  couponNumber: Schema.Number.pipe(Schema.int(), Schema.positive()),
  flightId: FlightId,
  seatNumber: Schema.OptionFromNullOr(Schema.String),
  status: Schema.optionalWith(CouponStatusSchema, {
    default: () => CouponStatus.OPEN,
  }),
}) {}
