import { Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { Todo } from "./todos";

describe("Todo Schema", () => {
	it("should decode a valid todo", () => {
		const validTodo = {
			id: 1,
			title: "Test V8 Coverage",
			completed: false,
			createdAt: new Date().toISOString(),
			updatedAt: null,
		};

		const result = Schema.decodeUnknownSync(Todo)(validTodo);

		expect(result).toBeDefined();
		expect(result.title).toBe("Test V8 Coverage");
	});

	it("should fail on invalid data", () => {
		const invalidTodo = {
			id: "not-a-number",
			title: "", // empty strings not allowed by NonEmptyString
		};

		const result = Schema.decodeUnknownEither(Todo)(invalidTodo);

		expect(Either.isLeft(result)).toBe(true); // Should be a failure (left side of Either)
		// In Effect 3 (and recent Schema), decodeUnknownEither returns an Either.
		// We check if it is Left (error).
		expect(result._tag).toBe("Left");
	});
});
