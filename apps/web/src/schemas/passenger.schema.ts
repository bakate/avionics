import { EmailSchema, GenderSchema } from "@workspace/domain/kernel";
import { Schema } from "effect";

export const PassengerInput = Schema.Struct({
  firstName: Schema.String.pipe(Schema.trimmed(), Schema.minLength(1)),
  lastName: Schema.String.pipe(Schema.trimmed(), Schema.minLength(1)),
  email: EmailSchema,
  dateOfBirth: Schema.Date.pipe(
    Schema.filter((d) => d <= new Date(), {
      message: () => "Date of birth must not be in the future",
    }),
  ),
  gender: GenderSchema,
});

export type PassengerInput = typeof PassengerInput.Type;
export type PassengerInputEncoded = typeof PassengerInput.Encoded;

export const decodePassengerInput = Schema.decodeUnknownSync(PassengerInput);
export const encodePassengerInput = Schema.encodeSync(PassengerInput);
