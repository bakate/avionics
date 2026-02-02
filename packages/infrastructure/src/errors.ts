export class OptimisticLockingError extends Error {
  readonly _tag = "OptimisticLockingError";
  constructor(
    readonly aggregateId: string,
    readonly expectedVersion: number,
  ) {
    super(
      `Optimistic locking failure for aggregate ${aggregateId}. Expected version ${expectedVersion}`,
    );
  }
}

export class PersistenceError extends Error {
  readonly _tag = "PersistenceError";
  constructor(readonly reason: unknown) {
    super(`Persistence error: ${reason}`);
  }
}

export class NotFoundError extends Error {
  readonly _tag = "NotFoundError";
  constructor(
    readonly entityType: string,
    readonly id: string,
  ) {
    super(`${entityType} with ID ${id} not found`);
  }
}
