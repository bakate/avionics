import {
  EmailSchema,
  GenderSchema,
  isAtLeast18,
} from "@workspace/domain/kernel";
import { Schema } from "effect";

const firstNameSchema = Schema.String.pipe(
  Schema.trimmed(),
  Schema.minLength(1),
  Schema.annotations({
    message: () => "first_name_required",
    title: "First Name",
    description: "Given name as seen on passport",
  }),
);

const lastNameSchema = Schema.String.pipe(
  Schema.trimmed(),
  Schema.minLength(1),
  Schema.annotations({
    message: () => "last_name_required",
    title: "Last Name",
    description: "Family name as seen on passport",
  }),
);

const emailSchemaWithMessage = EmailSchema.pipe(
  Schema.annotations({ message: () => "invalid_email" }),
);

const baseDateOfBirthSchema = Schema.Date.pipe(
  Schema.filter((d) => d <= new Date(), {
    message: () => "future_date_of_birth",
  }),
  Schema.annotations({ title: "Date of Birth" }),
);

export const PassengerInput = Schema.Struct({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchemaWithMessage,
  dateOfBirth: baseDateOfBirthSchema,
  gender: GenderSchema,
});

export type PassengerInput = typeof PassengerInput.Type;
export type PassengerInputEncoded = typeof PassengerInput.Encoded;

/**
 * Creates a PassengerInput schema with age validation for solo travelers.
 * Used when we need to validate individual passenger age against departure date.
 */
export const createPassengerInputSchema = (
  departureDate: string,
  isSoloTraveler: boolean,
) => {
  const dateOfBirthSchema = isSoloTraveler
    ? baseDateOfBirthSchema.pipe(
        Schema.filter((d) => isAtLeast18(d, new Date(departureDate)), {
          message: () => "solo_passenger_min_age",
        }),
      )
    : baseDateOfBirthSchema;

  return Schema.Struct({
    firstName: firstNameSchema,
    lastName: lastNameSchema,
    email: emailSchemaWithMessage,
    dateOfBirth: dateOfBirthSchema,
    gender: GenderSchema,
  });
};

/**
 * Creates a schema for a list of passengers with business rules based on departure date.
 * Rule: A solo traveler must be at least 18 years old.
 */
export const createPassengersSchema = (departureDate: string) =>
  Schema.Struct({
    passengers: Schema.mutable(
      Schema.Array(PassengerInput).pipe(Schema.minItems(1)),
    ),
  }).pipe(
    Schema.filter(
      (data) => {
        if (data.passengers.length === 1 && data.passengers[0]) {
          const { dateOfBirth } = data.passengers[0];
          return isAtLeast18(new Date(dateOfBirth), new Date(departureDate));
        }
        return true;
      },
      {
        message: () => "solo_passenger_min_age",
      },
    ),
  );
