import { Schema } from "effect";

// Defines the ID for a Todo
export const TodoId = Schema.Number.pipe(Schema.brand("TodoId"));
export type TodoId = Schema.Schema.Type<typeof TodoId>;

// Defines the Todo model
export class Todo extends Schema.Class<Todo>("Todo")({
	id: TodoId,
	title: Schema.NonEmptyString,
	completed: Schema.Boolean,
	createdAt: Schema.Date,
	updatedAt: Schema.OptionFromNullOr(Schema.Date), // Handles optional date that might be null
}) {}
