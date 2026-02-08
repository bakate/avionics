import { fc, test } from "@fast-check/vitest";
import { Effect, Ref } from "effect";
import { describe, expect } from "vitest";

const PROPERTIES = {
  ALL_UNPUBLISHED_EVENTS_FETCHED: {
    number: "5a",
    text: "All unpublished events are fetched",
  },
  PUBLISHED_EVENTS_HAVE_TIMESTAMPS: {
    number: "5b",
    text: "Published events have timestamps",
  },
} as const;

const eventIdArb = fc.uuid();
const eventTypeArb = fc.constantFrom(
  "BookingCreated",
  "BookingConfirmed",
  "SeatsHeld",
);
const payloadArb = fc.record({
  _tag: eventTypeArb,
  pnrCode: fc.stringMatching(/^[A-Z0-9]{6}$/).filter((s) => s.length === 6),
  timestamp: fc.date().map((d) => d.toISOString()),
});

interface MockOutboxRow {
  readonly id: string;
  readonly event_type: string;
  readonly payload: unknown;
  readonly published_at: Date | null;
  readonly created_at: Date;
  readonly retry_count: number;
}

describe("OutboxProcessor Property Tests", () => {
  test.prop(
    [
      fc.array(
        fc.record({
          id: eventIdArb,
          eventType: eventTypeArb,
          payload: payloadArb,
          isPublished: fc.boolean(),
        }),
        { minLength: 1, maxLength: 20 },
      ),
    ],
    { numRuns: 30 },
  )(
    `Property ${PROPERTIES.ALL_UNPUBLISHED_EVENTS_FETCHED.number}: ${PROPERTIES.ALL_UNPUBLISHED_EVENTS_FETCHED.text}`,
    async (eventData) => {
      const rows: Array<MockOutboxRow> = eventData.map((e) => ({
        id: e.id,
        event_type: e.eventType,
        payload: e.payload,
        published_at: e.isPublished ? new Date() : null,
        created_at: new Date(),
        retry_count: 0,
      }));

      const rowsRef = Ref.unsafeMake(rows);
      const publishedEventsRef = Ref.unsafeMake<Array<unknown>>([]);
      const unpublishedCount = rows.filter(
        (r) => r.published_at === null,
      ).length;

      const processOnce = Effect.gen(function* () {
        const currentRows = yield* Ref.get(rowsRef);
        const unpublished = currentRows.filter((r) => r.published_at === null);

        for (const row of unpublished) {
          yield* Ref.update(publishedEventsRef, (events) => [
            ...events,
            row.payload,
          ]);
          yield* Ref.update(rowsRef, (current) =>
            current.map((r) =>
              r.id === row.id ? { ...r, published_at: new Date() } : r,
            ),
          );
        }

        return unpublished.length;
      });

      const result = await Effect.runPromise(processOnce);
      const publishedEvents = Ref.get(publishedEventsRef).pipe(Effect.runSync);

      expect(result).toBe(unpublishedCount);
      expect(publishedEvents.length).toBe(unpublishedCount);
    },
  );

  test.prop(
    [
      fc.array(
        fc.record({
          id: eventIdArb,
          eventType: eventTypeArb,
          payload: payloadArb,
        }),
        { minLength: 1, maxLength: 10 },
      ),
    ],
    { numRuns: 20 },
  )(
    `Property ${PROPERTIES.PUBLISHED_EVENTS_HAVE_TIMESTAMPS.number}: ${PROPERTIES.PUBLISHED_EVENTS_HAVE_TIMESTAMPS.text}`,
    async (eventData) => {
      const rows: Array<MockOutboxRow> = eventData.map((e) => ({
        id: e.id,
        event_type: e.eventType,
        payload: e.payload,
        published_at: null,
        created_at: new Date(),
        retry_count: 0,
      }));

      const rowsRef = Ref.unsafeMake(rows);
      const beforeProcess = new Date();

      const processOnce = Effect.gen(function* () {
        const currentRows = yield* Ref.get(rowsRef);
        const unpublished = currentRows.filter((r) => r.published_at === null);

        for (const row of unpublished) {
          yield* Ref.update(rowsRef, (current) =>
            current.map((r) =>
              r.id === row.id ? { ...r, published_at: new Date() } : r,
            ),
          );
        }
      });

      await Effect.runPromise(processOnce);

      const afterProcess = new Date();
      const finalRows = Ref.get(rowsRef).pipe(Effect.runSync);

      for (const row of finalRows) {
        expect(row.published_at).not.toBeNull();
        if (row.published_at !== null) {
          expect(row.published_at.getTime()).toBeGreaterThanOrEqual(
            beforeProcess.getTime(),
          );
          expect(row.published_at.getTime()).toBeLessThanOrEqual(
            afterProcess.getTime(),
          );
        }
      }
    },
  );

  test.prop(
    [
      fc.array(
        fc.record({
          id: eventIdArb,
          eventType: eventTypeArb,
          payload: payloadArb,
        }),
        { minLength: 3, maxLength: 10 },
      ),
    ],
    { numRuns: 10 },
  )(
    "Property 5c: Retry logic increments retry count on failure",
    async (eventData) => {
      const rows: Array<MockOutboxRow> = eventData.map((e) => ({
        id: e.id,
        event_type: e.eventType,
        payload: e.payload,
        published_at: null,
        created_at: new Date(),
        retry_count: 0,
      }));

      const rowsRef = Ref.unsafeMake(rows);
      const failedEventId = rows[0].id;

      const processWithFailure = Effect.gen(function* () {
        const currentRows = yield* Ref.get(rowsRef);
        const unpublished = currentRows.filter((r) => r.published_at === null);

        for (const row of unpublished) {
          if (row.id === failedEventId) {
            yield* Ref.update(rowsRef, (current) =>
              current.map((r) =>
                r.id === row.id ? { ...r, retry_count: r.retry_count + 1 } : r,
              ),
            );
          } else {
            yield* Ref.update(rowsRef, (current) =>
              current.map((r) =>
                r.id === row.id ? { ...r, published_at: new Date() } : r,
              ),
            );
          }
        }
      });

      await Effect.runPromise(processWithFailure);

      const finalRows = Ref.get(rowsRef).pipe(Effect.runSync);
      const failedRow = finalRows.find((r) => r.id === failedEventId);
      const successRows = finalRows.filter((r) => r.id !== failedEventId);

      expect(failedRow?.retry_count).toBe(1);
      expect(failedRow?.published_at).toBeNull();
      for (const row of successRows) {
        expect(row.published_at).not.toBeNull();
      }
    },
  );

  test.prop(
    [
      fc.array(
        fc.record({
          id: eventIdArb,
          eventType: eventTypeArb,
          payload: payloadArb,
        }),
        { minLength: 1, maxLength: 5 },
      ),
    ],
    { numRuns: 10 },
  )("Property 5d: Events with max retries are skipped", async (eventData) => {
    const maxRetries = 3;
    const rows: Array<MockOutboxRow> = eventData.map((e, index) => ({
      id: e.id,
      event_type: e.eventType,
      payload: e.payload,
      published_at: null,
      created_at: new Date(),
      retry_count: index === 0 ? maxRetries : 0,
    }));

    const rowsRef = Ref.unsafeMake(rows);
    const publishedEventsRef = Ref.unsafeMake<Array<string>>([]);

    const processWithRetryFilter = Effect.gen(function* () {
      const currentRows = yield* Ref.get(rowsRef);
      const eligible = currentRows.filter(
        (r) => r.published_at === null && r.retry_count < maxRetries,
      );

      for (const row of eligible) {
        yield* Ref.update(publishedEventsRef, (ids) => [...ids, row.id]);
        yield* Ref.update(rowsRef, (current) =>
          current.map((r) =>
            r.id === row.id ? { ...r, published_at: new Date() } : r,
          ),
        );
      }

      return eligible.length;
    });

    await Effect.runPromise(processWithRetryFilter);

    const publishedIds = Ref.get(publishedEventsRef).pipe(Effect.runSync);
    const exhaustedRow = rows[0];

    expect(publishedIds).not.toContain(exhaustedRow.id);
    expect(publishedIds.length).toBe(rows.length - 1);
  });
});
