import { fc, test } from "@fast-check/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  mapDatabaseError,
  mapHttpError,
  mapNetworkError,
  preserveStackTrace,
  sanitizeErrorMessage,
} from "../../../errors/error-mapper.js";
import {
  DataIntegrityError,
  DuplicateEntityError,
  ExternalServiceClientError,
  ExternalServiceServerError,
  ExternalServiceTimeoutError,
  ExternalServiceUnavailableError,
  ExternalServiceUnexpectedStatusError,
  NetworkError,
  PersistenceError,
  PersistenceTimeoutError,
  ReferenceNotFoundError,
} from "../../../errors.js";

describe("Error Mapper Property Tests", () => {
  /**
   * Property 29: Constraint violations map to domain errors
   * Feature: infrastructure-layer, Property 29: Constraint violations map to domain errors
   */
  test.prop(
    [
      fc.constantFrom("23505", "23503"), // PostgreSQL constraint violation codes
      fc.string({ minLength: 5, maxLength: 30 }),
      fc.string({ minLength: 5, maxLength: 30 }),
    ],
    { numRuns: 30 },
  )(
    "Property 29: Constraint violations map to domain errors",
    (errorCode, constraint, detail) => {
      // Create a PostgreSQL-like error
      const pgError = {
        code: errorCode,
        constraint: constraint,
        detail: detail,
      };

      const result = Effect.runSyncExit(mapDatabaseError(pgError));

      // Should fail with a domain error (not a generic error)
      expect(result._tag).toBe("Failure");

      if (result._tag === "Failure") {
        const cause = result.cause;

        // Effect.fail creates a Fail cause, not a Die defect
        if (cause._tag === "Fail") {
          const error = cause.error;

          // Should be a specific domain error type
          if (errorCode === "23505") {
            expect(error).toBeInstanceOf(DuplicateEntityError);
          } else if (errorCode === "23503") {
            expect(error).toBeInstanceOf(ReferenceNotFoundError);
          }
        }
      }
    },
  );

  /**
   * Property 30: Network timeouts return typed errors
   * Feature: infrastructure-layer, Property 30: Network timeouts return typed errors
   */
  test.prop(
    [
      fc.string({ minLength: 3, maxLength: 20 }), // service name
      fc.constantFrom(
        "timeout",
        "ETIMEDOUT",
        "TimeoutError",
        "Request timeout",
        "Connection timeout",
      ),
    ],
    { numRuns: 30 },
  )(
    "Property 30: Network timeouts return typed errors",
    (serviceName, timeoutMessage) => {
      // Create a timeout error
      const timeoutError = new Error(timeoutMessage);
      if (timeoutMessage === "TimeoutError") {
        timeoutError.name = "TimeoutError";
      }

      const result = Effect.runSyncExit(
        mapNetworkError(serviceName, timeoutError),
      );

      // Should fail with a timeout error
      expect(result._tag).toBe("Failure");

      if (result._tag === "Failure") {
        const cause = result.cause;
        if (cause._tag === "Fail") {
          const error = cause.error;
          expect(error).toBeInstanceOf(ExternalServiceTimeoutError);
          const timeoutErr = error as ExternalServiceTimeoutError;
          expect(timeoutErr.service).toBe(serviceName);
          expect(timeoutErr.timestamp).toBeInstanceOf(Date);
        }
      }
    },
  );

  /**
   * Property 31: External API errors map to domain errors
   * Feature: infrastructure-layer, Property 31: External API errors map to domain errors
   */
  test.prop(
    [
      fc.string({ minLength: 3, maxLength: 20 }), // service name
      fc.integer({ min: 400, max: 599 }), // HTTP status codes
      fc.string({ minLength: 5, maxLength: 50 }), // error message
    ],
    { numRuns: 30 },
  )(
    "Property 31: External API errors map to domain errors",
    (serviceName, statusCode, errorMessage) => {
      const result = Effect.runSyncExit(
        mapHttpError(serviceName, statusCode, { message: errorMessage }),
      );

      // Should fail with a domain error
      expect(result._tag).toBe("Failure");

      if (result._tag === "Failure") {
        const cause = result.cause;
        if (cause._tag === "Fail") {
          const error = cause.error;

          // Should be either client or server error based on status code
          if (statusCode >= 400 && statusCode < 500) {
            expect(error).toBeInstanceOf(ExternalServiceClientError);
            const clientErr = error as ExternalServiceClientError;
            expect(clientErr.service).toBe(serviceName);
            expect(clientErr.status).toBe(statusCode);
          } else if (statusCode >= 500) {
            expect(error).toBeInstanceOf(ExternalServiceServerError);
            const serverErr = error as ExternalServiceServerError;
            expect(serverErr.service).toBe(serviceName);
            expect(serverErr.status).toBe(statusCode);
          }
        }
      }
    },
  );

  /**
   * Property 32: Errors preserve stack traces
   * Feature: infrastructure-layer, Property 32: Errors preserve stack traces
   */
  test.prop([fc.string({ minLength: 10, maxLength: 50 })], { numRuns: 30 })(
    "Property 32: Errors preserve stack traces",
    (errorMessage) => {
      // Create an error with a stack trace
      const originalError = new Error(errorMessage);
      const originalStack = originalError.stack;

      // Create a mapped error
      const mappedError = new Error("Mapped error");

      // Preserve stack trace
      const result = preserveStackTrace(originalError, mappedError);

      // Should have both stack traces
      expect(result.stack).toBeDefined();
      expect(result.stack).toContain("Mapped error");
      expect(result.stack).toContain("Caused by:");
      if (originalStack) {
        expect(result.stack).toContain(errorMessage);
      }
    },
  );

  /**
   * Property 33: Error messages don't expose internals
   * Feature: infrastructure-layer, Property 33: Error messages don't expose internals
   */
  test.prop(
    [
      fc
        .string({ minLength: 20, maxLength: 40 })
        .filter((s) => s.trim().length > 0 && !/\s/.test(s)), // API key without spaces
      fc
        .string({ minLength: 10, maxLength: 20 })
        .filter((s) => s.trim().length > 0 && /^[a-zA-Z0-9_-]+$/.test(s)), // Alphanumeric username
      fc
        .string({ minLength: 10, maxLength: 20 })
        .filter((s) => s.trim().length > 0 && /^[a-zA-Z0-9_-]+$/.test(s)), // Alphanumeric password
      fc.ipV4(),
    ],
    { numRuns: 30 },
  )(
    "Property 33: Error messages don't expose internals",
    (apiKey, username, password, ipAddress) => {
      // Create an error message with sensitive information
      const sensitiveMessage = `Connection failed to postgres://${username}:${password}@${ipAddress}/database using API key ${apiKey} at /path/to/file.ts`;

      // Sanitize the message
      const sanitized = sanitizeErrorMessage(sensitiveMessage);

      // Should not contain sensitive information
      expect(sanitized).not.toContain(username);
      expect(sanitized).not.toContain(password);
      expect(sanitized).not.toContain(ipAddress);
      expect(sanitized).not.toContain("/path/to/file.ts");

      // Should contain redaction markers
      expect(sanitized).toContain("<connection-string>");
      expect(sanitized).toContain("<file-path>");

      // API key should be redacted if it looks like a key
      if (/[a-zA-Z]/.test(apiKey) && /[0-9]/.test(apiKey)) {
        expect(sanitized).not.toContain(apiKey);
      }
    },
  );

  /**
   * Additional test: Connection refused errors map correctly
   */
  test.prop([fc.string({ minLength: 3, maxLength: 20 })], { numRuns: 30 })(
    "Property 30 (additional): Connection refused errors map correctly",
    (serviceName) => {
      const connectionError = new Error("ECONNREFUSED");

      const result = Effect.runSyncExit(
        mapNetworkError(serviceName, connectionError),
      );

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        const cause = result.cause;
        if (cause._tag === "Fail") {
          expect(cause.error).toBeInstanceOf(ExternalServiceUnavailableError);
        }
      }
    },
  );

  /**
   * Additional test: Database timeout errors map correctly
   */
  test.prop([fc.string({ minLength: 5, maxLength: 30 })], { numRuns: 30 })(
    "Property 29 (additional): Database timeout errors map correctly",
    (detail) => {
      const timeoutError = {
        code: "57014", // PostgreSQL query timeout
        detail: detail,
      };

      const result = Effect.runSyncExit(mapDatabaseError(timeoutError));

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        const cause = result.cause;
        if (cause._tag === "Fail") {
          expect(cause.error).toBeInstanceOf(PersistenceTimeoutError);
        }
      }
    },
  );

  /**
   * Additional test: Data integrity errors map correctly
   */
  test.prop([fc.string({ minLength: 5, maxLength: 30 })], { numRuns: 30 })(
    "Property 29 (additional): Data integrity errors map correctly",
    (detail) => {
      const dataError = {
        code: "22P02", // Invalid text representation
        detail: detail,
      };

      const result = Effect.runSyncExit(mapDatabaseError(dataError));

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        const cause = result.cause;
        if (cause._tag === "Fail") {
          expect(cause.error).toBeInstanceOf(DataIntegrityError);
        }
      }
    },
  );

  /**
   * Additional test: Generic database errors map to PersistenceError
   */
  test.prop([fc.string({ minLength: 10, maxLength: 50 })], { numRuns: 30 })(
    "Property 29 (additional): Generic database errors map to PersistenceError",
    (errorMessage) => {
      const genericError = new Error(errorMessage);

      const result = Effect.runSyncExit(mapDatabaseError(genericError));

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        const cause = result.cause;
        if (cause._tag === "Fail") {
          expect(cause.error).toBeInstanceOf(PersistenceError);
          const persistErr = cause.error as PersistenceError;
          expect(persistErr.message).toContain(errorMessage);
        }
      }
    },
  );

  /**
   * Additional test: Generic network errors map to NetworkError
   */
  test.prop(
    [
      fc.string({ minLength: 3, maxLength: 20 }),
      fc
        .string({ minLength: 10, maxLength: 50 })
        .filter(
          (msg) => !/timeout|econnrefused|enotfound|econnreset/i.test(msg),
        ),
    ],
    { numRuns: 30 },
  )(
    "Property 30 (additional): Generic network errors map to NetworkError",
    (serviceName, errorMessage) => {
      const genericError = new Error(errorMessage);

      const result = Effect.runSyncExit(
        mapNetworkError(serviceName, genericError),
      );

      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure") {
        const cause = result.cause;
        if (cause._tag === "Fail") {
          expect(cause.error).toBeInstanceOf(NetworkError);
          const netErr = cause.error as NetworkError;
          expect(netErr.message).toContain(errorMessage);
        }
      }
    },
  );

  /**
   * Property 34: Unexpected status codes map to ExternalServiceUnexpectedStatusError
   */
  test.prop(
    [
      fc.string({ minLength: 3, maxLength: 20 }), // service name
      fc.integer({ min: 100, max: 399 }), // Unexpected status codes (1xx, 2xx, 3xx)
      fc.string({ minLength: 5, maxLength: 50 }), // error message
    ],
    { numRuns: 30 },
  )(
    "Property 34: Unexpected status codes map to ExternalServiceUnexpectedStatusError",
    (serviceName, statusCode, errorMessage) => {
      const result = Effect.runSyncExit(
        mapHttpError(serviceName, statusCode, { message: errorMessage }),
      );

      expect(result._tag).toBe("Failure");

      if (result._tag === "Failure") {
        const cause = result.cause;
        if (cause._tag === "Fail") {
          const error = cause.error;
          expect(error).toBeInstanceOf(ExternalServiceUnexpectedStatusError);
          const unexpectedErr = error as ExternalServiceUnexpectedStatusError;
          expect(unexpectedErr.service).toBe(serviceName);
          expect(unexpectedErr.status).toBe(statusCode);
        }
      }
    },
  );
  test("Entity type extraction returns first segment before underscore", () => {
    const pgError = {
      code: "23505", // Unique constraint violation
      constraint: "bookings_pnr_key",
      detail: "Key (pnr)=(ABC123) already exists",
    };

    const result = Effect.runSyncExit(mapDatabaseError(pgError));

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const cause = result.cause;
      if (cause._tag === "Fail") {
        expect(cause.error).toBeInstanceOf(DuplicateEntityError);
        const error = cause.error as DuplicateEntityError;
        expect(error.entityType).toBe("bookings");
      }
    }
  });
});
