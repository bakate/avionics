import { Schema } from "effect";
import { EmailSchema, GenderSchema, PassengerTypeSchema } from "../kernel.js";

export const PassengerId = Schema.String.pipe(Schema.brand("PassengerId"));

export class Passenger extends Schema.Class<Passenger>("Passenger")({
	id: PassengerId,
	firstName: Schema.String,
	lastName: Schema.String,
	email: EmailSchema,
	dateOfBirth: Schema.Date,
	gender: GenderSchema,
	type: PassengerTypeSchema,
}) {}
