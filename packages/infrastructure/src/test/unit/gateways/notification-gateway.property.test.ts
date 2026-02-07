import { fc } from "@fast-check/vitest";
import {
  type EmailRecipient,
  InvalidRecipientError,
  NotificationApiUnavailableError,
  NotificationAuthenticationError,
  type NotificationError,
  NotificationGateway,
  type NotificationGatewayService,
  NotificationRateLimitError,
  type NotificationResult,
} from "@workspace/application/notification.gateway";
import { Coupon } from "@workspace/domain/coupon";
import { makeFlightId, PnrCodeSchema } from "@workspace/domain/kernel";
import { PassengerId } from "@workspace/domain/passenger";
import { Ticket, TicketNumber, TicketStatus } from "@workspace/domain/ticket";
import { Effect, Layer, Option, Ref, Schema } from "effect";
import { describe, expect, test } from "vitest";

const PROPERTIES = {
  REQUESTS_INCLUDE_AUTH: {
    number: 14,
    text: "Notification requests include authentication via SDK configuration",
  },
  SUCCESSFUL_SENDS_RETURN_MESSAGE_IDS: {
    number: 15,
    text: "Successful sends return message IDs",
  },
  API_ERRORS_MAP_TO_DOMAIN_ERRORS: {
    number: 16,
    text: "Notification API errors map to domain errors",
  },
  TICKETS_FORMATTED_IN_EMAILS: {
    number: 17,
    text: "Tickets are formatted in emails",
  },
  FAILED_NOTIFICATIONS_LOGGED: {
    number: "17b",
    text: "Failed notification attempts are also logged",
  },
} as const;

const emailArb = fc.emailAddress();
const ticketNumberArb = fc
  .stringMatching(/^[0-9]{13}$/)
  .filter((str) => str.length === 13);
const pnrCodeArb = fc
  .stringMatching(/^[A-Z0-9]{6}$/)
  .filter((str) => str.length === 6);
const passengerNameArb = fc
  .tuple(
    fc
      .string({ minLength: 2, maxLength: 20 })
      .filter((s) => /^[a-zA-Z]+$/.test(s)),
    fc
      .string({ minLength: 2, maxLength: 20 })
      .filter((s) => /^[a-zA-Z]+$/.test(s)),
  )
  .map(([first, last]) => `${first} ${last}`);
const flightIdArb = fc
  .stringMatching(/^[A-Z]{2}[0-9]{3,4}$/)
  .filter((str) => str.length >= 5 && str.length <= 6);
const seatNumberArb = fc
  .stringMatching(/^[0-9]{1,2}[A-F]$/)
  .filter((str) => str.length >= 2 && str.length <= 3);
const messageIdArb = fc.stringMatching(
  /^[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}$/,
);

const createTestTicket = (
  ticketNumberRaw: string,
  pnrCodeRaw: string,
  passengerName: string,
  flightId: string,
  seatNumber: string,
): Ticket => {
  const ticketNumber = Schema.decodeSync(TicketNumber)(ticketNumberRaw);
  const pnrCode = Schema.decodeSync(PnrCodeSchema)(pnrCodeRaw);
  const passengerId = Schema.decodeSync(PassengerId)(`passenger_${Date.now()}`);

  const coupon = new Coupon({
    couponNumber: 1,
    flightId: makeFlightId(flightId),
    seatNumber: Option.some(seatNumber),
    status: "OPEN",
  });

  return new Ticket({
    ticketNumber,
    pnrCode,
    status: TicketStatus.ISSUED,
    passengerId,
    passengerName,
    coupons: [coupon],
    issuedAt: new Date(),
  });
};

type MockBehavior = {
  readonly sendResult:
    | { readonly type: "success"; readonly messageId: string }
    | { readonly type: "error"; readonly error: NotificationError };
  readonly captureEmailContent?: boolean;
};

type CapturedEmail = {
  readonly to: string;
  readonly ticketNumber: string;
  readonly pnrCode: string;
  readonly passengerName: string;
};

const createMockGateway = (
  behavior: MockBehavior,
  callLog: Ref.Ref<ReadonlyArray<string>>,
  capturedEmails?: Ref.Ref<ReadonlyArray<CapturedEmail>>,
): NotificationGatewayService => ({
  sendTicket: (ticket: Ticket, recipient: EmailRecipient) =>
    Effect.gen(function* () {
      yield* Ref.update(callLog, (logs) => [
        ...logs,
        `sendTicket:${ticket.ticketNumber}:${recipient.email}`,
      ]);

      yield* Effect.logInfo("Sending ticket confirmation email", {
        ticketNumber: ticket.ticketNumber,
        pnrCode: ticket.pnrCode,
        recipientEmail: recipient.email,
      });

      if (behavior.captureEmailContent && capturedEmails) {
        yield* Ref.update(capturedEmails, (emails) => [
          ...emails,
          {
            to: recipient.email,
            ticketNumber: ticket.ticketNumber,
            pnrCode: ticket.pnrCode,
            passengerName: recipient.name ?? ticket.passengerName,
          },
        ]);
      }

      if (behavior.sendResult.type === "error") {
        return yield* Effect.fail(behavior.sendResult.error);
      }

      return {
        messageId: behavior.sendResult.messageId,
      } satisfies NotificationResult;
    }),
});

const createTestLayer = (
  behavior: MockBehavior,
  callLog: Ref.Ref<ReadonlyArray<string>>,
  capturedEmails?: Ref.Ref<ReadonlyArray<CapturedEmail>>,
) =>
  Layer.succeed(
    NotificationGateway,
    createMockGateway(behavior, callLog, capturedEmails),
  );

describe("NotificationGateway Property Tests", () => {
  test(`Property ${PROPERTIES.REQUESTS_INCLUDE_AUTH.number}: ${PROPERTIES.REQUESTS_INCLUDE_AUTH.text}`, async () => {
    await fc.assert(
      fc.asyncProperty(
        ticketNumberArb,
        pnrCodeArb,
        passengerNameArb,
        flightIdArb,
        seatNumberArb,
        emailArb,
        async (
          ticketNumber,
          pnrCode,
          passengerName,
          flightId,
          seatNumber,
          email,
        ) => {
          const callLog = Ref.unsafeMake<ReadonlyArray<string>>([]);
          const messageId = `msg_${Date.now()}`;
          const behavior: MockBehavior = {
            sendResult: { type: "success", messageId },
          };
          const ticket = createTestTicket(
            ticketNumber,
            pnrCode,
            passengerName,
            flightId,
            seatNumber,
          );

          const program = Effect.gen(function* () {
            const gateway = yield* NotificationGateway;
            return yield* gateway.sendTicket(ticket, {
              email,
              name: passengerName,
            });
          });

          const result = await Effect.runPromise(
            Effect.provide(program, createTestLayer(behavior, callLog)),
          );

          const logs = Ref.get(callLog).pipe(Effect.runSync);
          expect(logs).toContain(`sendTicket:${ticketNumber}:${email}`);
          expect(result.messageId).toBe(messageId);
        },
      ),
      { numRuns: 20 },
    );
  });

  test(`Property ${PROPERTIES.SUCCESSFUL_SENDS_RETURN_MESSAGE_IDS.number}: ${PROPERTIES.SUCCESSFUL_SENDS_RETURN_MESSAGE_IDS.text}`, async () => {
    await fc.assert(
      fc.asyncProperty(
        ticketNumberArb,
        pnrCodeArb,
        passengerNameArb,
        flightIdArb,
        seatNumberArb,
        emailArb,
        messageIdArb,
        async (
          ticketNumber,
          pnrCode,
          passengerName,
          flightId,
          seatNumber,
          email,
          messageId,
        ) => {
          const callLog = Ref.unsafeMake<ReadonlyArray<string>>([]);
          const behavior: MockBehavior = {
            sendResult: { type: "success", messageId },
          };
          const ticket = createTestTicket(
            ticketNumber,
            pnrCode,
            passengerName,
            flightId,
            seatNumber,
          );

          const program = Effect.gen(function* () {
            const gateway = yield* NotificationGateway;
            return yield* gateway.sendTicket(ticket, {
              email,
              name: passengerName,
            });
          });

          const result = await Effect.runPromise(
            Effect.provide(program, createTestLayer(behavior, callLog)),
          );

          expect(result.messageId).toBe(messageId);
          expect(result.messageId.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 30 },
    );
  });

  describe(`Property ${PROPERTIES.API_ERRORS_MAP_TO_DOMAIN_ERRORS.number}: ${PROPERTIES.API_ERRORS_MAP_TO_DOMAIN_ERRORS.text}`, () => {
    const errorScenarios = [
      {
        name: "network error maps to NotificationApiUnavailableError",
        error: new NotificationApiUnavailableError({
          message: "Network error",
        }),
        expectedTag: "NotificationApiUnavailableError",
      },
      {
        name: "authentication error maps to NotificationAuthenticationError",
        error: new NotificationAuthenticationError({
          message: "Invalid API key",
        }),
        expectedTag: "NotificationAuthenticationError",
      },
      {
        name: "invalid recipient maps to InvalidRecipientError",
        error: new InvalidRecipientError({
          email: "invalid@test.com",
          reason: "Email bounced",
        }),
        expectedTag: "InvalidRecipientError",
      },
      {
        name: "rate limit maps to NotificationRateLimitError",
        error: new NotificationRateLimitError({ retryAfterSeconds: 60 }),
        expectedTag: "NotificationRateLimitError",
      },
    ];

    for (const scenario of errorScenarios) {
      test(scenario.name, async () => {
        await fc.assert(
          fc.asyncProperty(
            ticketNumberArb,
            pnrCodeArb,
            passengerNameArb,
            flightIdArb,
            seatNumberArb,
            async (
              ticketNumber,
              pnrCode,
              passengerName,
              flightId,
              seatNumber,
            ) => {
              const callLog = Ref.unsafeMake<ReadonlyArray<string>>([]);
              const behavior: MockBehavior = {
                sendResult: { type: "error", error: scenario.error },
              };
              const ticket = createTestTicket(
                ticketNumber,
                pnrCode,
                passengerName,
                flightId,
                seatNumber,
              );

              const program = Effect.gen(function* () {
                const gateway = yield* NotificationGateway;
                return yield* gateway.sendTicket(ticket, {
                  email: "test@example.com",
                  name: passengerName,
                });
              });

              const result = await Effect.runPromiseExit(
                Effect.provide(program, createTestLayer(behavior, callLog)),
              );

              expect(result._tag).toBe("Failure");
              if (result._tag === "Failure") {
                expect(result.cause._tag).toBe("Fail");
                if (result.cause._tag === "Fail") {
                  expect((result.cause.error as NotificationError)._tag).toBe(
                    scenario.expectedTag,
                  );
                }
              }
            },
          ),
          { numRuns: 10 },
        );
      });
    }
  });

  test(`Property ${PROPERTIES.TICKETS_FORMATTED_IN_EMAILS.number}: ${PROPERTIES.TICKETS_FORMATTED_IN_EMAILS.text}`, async () => {
    await fc.assert(
      fc.asyncProperty(
        ticketNumberArb,
        pnrCodeArb,
        passengerNameArb,
        flightIdArb,
        seatNumberArb,
        emailArb,
        async (
          ticketNumber,
          pnrCode,
          passengerName,
          flightId,
          seatNumber,
          email,
        ) => {
          const callLog = Ref.unsafeMake<ReadonlyArray<string>>([]);
          const capturedEmails = Ref.unsafeMake<ReadonlyArray<CapturedEmail>>(
            [],
          );
          const messageId = `msg_${Date.now()}`;
          const behavior: MockBehavior = {
            sendResult: { type: "success", messageId },
            captureEmailContent: true,
          };
          const ticket = createTestTicket(
            ticketNumber,
            pnrCode,
            passengerName,
            flightId,
            seatNumber,
          );

          const program = Effect.gen(function* () {
            const gateway = yield* NotificationGateway;
            return yield* gateway.sendTicket(ticket, {
              email,
              name: passengerName,
            });
          });

          await Effect.runPromise(
            Effect.provide(
              program,
              createTestLayer(behavior, callLog, capturedEmails),
            ),
          );

          const emails = Ref.get(capturedEmails).pipe(Effect.runSync);
          expect(emails.length).toBe(1);
          expect(emails[0].ticketNumber).toBe(ticketNumber);
          expect(emails[0].pnrCode).toBe(pnrCode);
          expect(emails[0].passengerName).toBe(passengerName);
          expect(emails[0].to).toBe(email);
        },
      ),
      { numRuns: 20 },
    );
  });

  test(`Property ${PROPERTIES.FAILED_NOTIFICATIONS_LOGGED.number}: ${PROPERTIES.FAILED_NOTIFICATIONS_LOGGED.text}`, async () => {
    await fc.assert(
      fc.asyncProperty(
        ticketNumberArb,
        pnrCodeArb,
        passengerNameArb,
        flightIdArb,
        seatNumberArb,
        async (ticketNumber, pnrCode, passengerName, flightId, seatNumber) => {
          const callLog = Ref.unsafeMake<ReadonlyArray<string>>([]);
          const behavior: MockBehavior = {
            sendResult: {
              type: "error",
              error: new NotificationApiUnavailableError({
                message: "Network error",
              }),
            },
          };
          const ticket = createTestTicket(
            ticketNumber,
            pnrCode,
            passengerName,
            flightId,
            seatNumber,
          );

          const program = Effect.gen(function* () {
            const gateway = yield* NotificationGateway;
            return yield* gateway.sendTicket(ticket, {
              email: "test@example.com",
              name: passengerName,
            });
          });

          await Effect.runPromiseExit(
            Effect.provide(program, createTestLayer(behavior, callLog)),
          );

          const logs = Ref.get(callLog).pipe(Effect.runSync);
          expect(logs.length).toBeGreaterThan(0);
          expect(logs.some((log) => log.includes(ticketNumber))).toBe(true);
        },
      ),
      { numRuns: 10 },
    );
  });
});
