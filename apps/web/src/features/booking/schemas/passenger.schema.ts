import { EmailSchema, GenderSchema } from "@workspace/domain/kernel";
import { Schema } from "effect";

export const PassengerInput = Schema.Struct({
  firstName: Schema.String.pipe(
    Schema.trimmed(),
    Schema.minLength(1),
    Schema.annotations({
      title: "First Name",
      description: "Given name as seen on passport",
    }),
  ),
  lastName: Schema.String.pipe(
    Schema.trimmed(),
    Schema.minLength(1),
    Schema.annotations({
      title: "Last Name",
      description: "Family name as seen on passport",
    }),
  ),
  email: EmailSchema,
  dateOfBirth: Schema.Date.pipe(
    Schema.filter((d) => d <= new Date(), {
      message: () => "Date of birth must not be in the future",
    }),
    Schema.annotations({ title: "Date of Birth" }),
  ),
  gender: GenderSchema,
});

export type PassengerInput = typeof PassengerInput.Type;
export type PassengerInputEncoded = typeof PassengerInput.Encoded;
