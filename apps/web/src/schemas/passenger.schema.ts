import { Schema } from "effect";

export const PassengerInput = Schema.Struct({
  firstName: Schema.String,
  lastName: Schema.String,
  email: Schema.String,
  dateOfBirth: Schema.String,
  gender: Schema.Literal("male", "female"),
});

export type PassengerInput = Schema.Schema.Type<typeof PassengerInput>;
