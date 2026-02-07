import { Effect } from "effect";
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
} from "../errors.js";

/**
 * Maps database errors to domain errors
 */
export function mapDatabaseError(
  error: unknown,
): Effect.Effect<
  never,
  | PersistenceError
  | DuplicateEntityError
  | ReferenceNotFoundError
  | PersistenceTimeoutError
  | DataIntegrityError
> {
  const timestamp = new Date();

  // PostgreSQL error codes
  if (typeof error === "object" && error !== null && "code" in error) {
    const pgError = error as {
      code: string;
      constraint?: string;
      detail?: string;
    };

    // Unique constraint violation
    if (pgError.code === "23505") {
      const entityType = extractEntityTypeFromConstraint(pgError.constraint);
      const id = extractIdFromDetail(pgError.detail);
      return Effect.fail(
        new DuplicateEntityError({
          entityType,
          id,
          timestamp,
        }),
      );
    }

    // Foreign key constraint violation
    if (pgError.code === "23503") {
      const referencedEntity = extractEntityTypeFromConstraint(
        pgError.constraint,
      );
      const referencedId = extractIdFromDetail(pgError.detail);
      return Effect.fail(
        new ReferenceNotFoundError({
          referencedEntity,
          referencedId,
          timestamp,
        }),
      );
    }

    // Query timeout
    if (pgError.code === "57014") {
      return Effect.fail(
        new PersistenceTimeoutError({
          operation: "database query",
          duration: 0, // Duration not available from error
          timestamp,
        }),
      );
    }

    // Data type mismatch or invalid input
    if (pgError.code === "22P02" || pgError.code === "22003") {
      return Effect.fail(
        new DataIntegrityError({
          field: "unknown",
          value: undefined,
          message: pgError.detail || "Invalid data format",
          timestamp,
        }),
      );
    }
  }

  // Generic persistence error
  return Effect.fail(
    new PersistenceError({
      message: error instanceof Error ? error.message : String(error),
      cause: error,
      timestamp,
    }),
  );
}

/**
 * Maps network/HTTP errors to domain errors
 */
export function mapNetworkError(
  service: string,
  error: unknown,
): Effect.Effect<
  never,
  NetworkError | ExternalServiceTimeoutError | ExternalServiceUnavailableError
> {
  const timestamp = new Date();

  // Timeout errors
  if (
    error instanceof Error &&
    (error.message.includes("timeout") ||
      error.message.includes("ETIMEDOUT") ||
      error.name === "TimeoutError")
  ) {
    return Effect.fail(
      new ExternalServiceTimeoutError({
        service,
        duration: 0, // Duration not available from error
        timestamp,
      }),
    );
  }

  // Connection refused / unavailable
  if (
    error instanceof Error &&
    (error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("ECONNRESET"))
  ) {
    return Effect.fail(
      new ExternalServiceUnavailableError({
        service,
        timestamp,
      }),
    );
  }

  // Generic network error
  return Effect.fail(
    new NetworkError({
      message: error instanceof Error ? error.message : String(error),
      cause: error,
      timestamp,
    }),
  );
}

/**
 * Maps HTTP response errors to domain errors
 */
export function mapHttpError(
  service: string,
  status: number,
  body: unknown,
): Effect.Effect<
  never,
  | ExternalServiceClientError
  | ExternalServiceServerError
  | ExternalServiceUnexpectedStatusError
> {
  const timestamp = new Date();
  const message = extractErrorMessage(body);

  // Client errors (4xx)
  if (status >= 400 && status < 500) {
    return Effect.fail(
      new ExternalServiceClientError({
        service,
        status,
        message: sanitizeErrorMessage(message),
        timestamp,
      }),
    );
  }

  // Server errors (5xx)
  if (status >= 500) {
    return Effect.fail(
      new ExternalServiceServerError({
        service,
        status,
        message: sanitizeErrorMessage(message),
        timestamp,
      }),
    );
  }

  // Unexpected status code (e.g. 2xx, 3xx treated as error)
  return Effect.fail(
    new ExternalServiceUnexpectedStatusError({
      service,
      status,
      message: `Unexpected status code: ${status}`,
      timestamp,
    }),
  );
}

/**
 * Sanitizes error messages to prevent exposing internal details
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove connection strings (must be first to catch credentials)
  let sanitized = message.replace(
    /postgres:\/\/[^@\s]+:[^@\s]+@[^/\s]+\/[^\s]+/g,
    "<connection-string>",
  );

  // Also catch connection strings with explicit protocol
  sanitized = sanitized.replace(
    /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s@]+:[^\s@]+@[^\s]+/g,
    "<connection-string>",
  );

  // Remove values after "API key", "token", "password", "secret" keywords
  sanitized = sanitized.replace(
    /(API key|token|password|secret|key)\s+[^\s]+/gi,
    "$1 <redacted>",
  );

  // Remove API keys (long alphanumeric strings with mix of letters and numbers)
  sanitized = sanitized.replace(/[a-zA-Z0-9_-]{20,}/g, (match) => {
    // Only redact if it looks like a key (contains mix of chars and numbers)
    if (/[a-zA-Z]/.test(match) && /[0-9]/.test(match)) {
      return "<redacted>";
    }
    return match;
  });

  // Remove file paths
  sanitized = sanitized.replace(
    /\/[a-zA-Z0-9_\-./]+\.(ts|js|json)/g,
    "<file-path>",
  );

  // Remove IP addresses
  sanitized = sanitized.replace(
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    "<ip-address>",
  );

  return sanitized;
}

/**
 * Preserves error stack traces while mapping
 */
export function preserveStackTrace(
  originalError: unknown,
  mappedError: Error,
): Error {
  if (originalError instanceof Error && originalError.stack) {
    // Append original stack to mapped error
    mappedError.stack = `${mappedError.stack}\n\nCaused by:\n${originalError.stack}`;
  }
  return mappedError;
}

// Helper functions

function extractEntityTypeFromConstraint(constraint?: string): string {
  if (!constraint) return "unknown";
  // Extract table name from constraint like "bookings_pnr_key"
  // TODO: Handle cases where table names legitimately contain underscores (e.g. use a known-tables lookup or parsing based on known suffixes like _key/_pkey/_fkey)
  const match = constraint.match(/^([^_]+)_/);
  return match?.[1] ?? constraint;
}

function extractIdFromDetail(detail?: string): string {
  if (!detail) return "unknown";
  // Extract ID from detail like "Key (pnr)=(ABC123) already exists"
  const match = detail.match(/\(([^)]+)\)=\(([^)]+)\)/);
  return match?.[2] ?? "unknown";
}

function extractErrorMessage(body: unknown): string {
  if (typeof body === "string") return body;
  if (typeof body === "object" && body !== null) {
    if ("message" in body && typeof body.message === "string") {
      return body.message;
    }
    if ("error" in body && typeof body.error === "string") {
      return body.error;
    }
  }
  return "Unknown error";
}
