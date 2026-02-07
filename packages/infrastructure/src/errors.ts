import { Data } from "effect";

// Base infrastructure error
export class InfrastructureError extends Data.TaggedError(
  "InfrastructureError",
)<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: Record<string, unknown>;
  readonly timestamp: Date;
}> {}

// Persistence errors
export class OptimisticLockingError extends Data.TaggedError(
  "OptimisticLockingError",
)<{
  readonly aggregateId: string;
  readonly expectedVersion: number;
  readonly timestamp: Date;
}> {}

export class PersistenceError extends Data.TaggedError("PersistenceError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly timestamp: Date;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly entityType: string;
  readonly id: string;
  readonly timestamp: Date;
}> {}

export class DuplicateEntityError extends Data.TaggedError(
  "DuplicateEntityError",
)<{
  readonly entityType: string;
  readonly id: string;
  readonly timestamp: Date;
}> {}

export class ReferenceNotFoundError extends Data.TaggedError(
  "ReferenceNotFoundError",
)<{
  readonly referencedEntity: string;
  readonly referencedId: string;
  readonly timestamp: Date;
}> {}

export class PersistenceTimeoutError extends Data.TaggedError(
  "PersistenceTimeoutError",
)<{
  readonly operation: string;
  readonly duration: number;
  readonly timestamp: Date;
}> {}

export class DataIntegrityError extends Data.TaggedError("DataIntegrityError")<{
  readonly field: string;
  readonly value: unknown;
  readonly message: string;
  readonly timestamp: Date;
}> {}

// External service errors
export class ExternalServiceError extends Data.TaggedError(
  "ExternalServiceError",
)<{
  readonly service: string;
  readonly message: string;
  readonly cause?: unknown;
  readonly timestamp: Date;
}> {}

export class ExternalServiceTimeoutError extends Data.TaggedError(
  "ExternalServiceTimeoutError",
)<{
  readonly service: string;
  readonly duration: number;
  readonly timestamp: Date;
}> {}

export class ExternalServiceClientError extends Data.TaggedError(
  "ExternalServiceClientError",
)<{
  readonly service: string;
  readonly status: number;
  readonly message: string;
  readonly timestamp: Date;
}> {}

export class ExternalServiceServerError extends Data.TaggedError(
  "ExternalServiceServerError",
)<{
  readonly service: string;
  readonly status: number;
  readonly message: string;
  readonly timestamp: Date;
}> {}

export class ExternalServiceUnavailableError extends Data.TaggedError(
  "ExternalServiceUnavailableError",
)<{
  readonly service: string;
  readonly timestamp: Date;
}> {}

export class ExternalServiceUnexpectedStatusError extends Data.TaggedError(
  "ExternalServiceUnexpectedStatusError",
)<{
  readonly service: string;
  readonly status: number;
  readonly message: string;
  readonly timestamp: Date;
}> {}

// Network errors
export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly timestamp: Date;
}> {}

// Configuration errors
export class ConfigurationError extends Data.TaggedError("ConfigurationError")<{
  readonly message: string;
  readonly missingKeys?: Array<string>;
  readonly timestamp: Date;
}> {}
