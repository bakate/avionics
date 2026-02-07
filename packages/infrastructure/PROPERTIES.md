# Correctness Properties

This document lists all correctness properties for the infrastructure layer. Each property is a formal specification of system behavior that is verified through property-based testing.

## Format

Each property includes:

- **Property Number**: Unique identifier
- **Statement**: Universal quantification ("For any...")
- **Validates**: The actual requirement text (EARS format)

## Currency Converter Properties

**Property 1: Same-currency identity** ✅
_For any_ amount and currency, converting from that currency to itself should return the original amount unchanged.
**Validates:** WHEN a currency conversion is requested for the same currency, THE Currency_Gateway SHALL return the original amount without calling external APIs

**Property 2: Invalid currency rejection** ✅
_For any_ invalid currency code (not in ISO 4217), the converter should return a validation error.
**Validates:** WHEN invalid currency codes are provided, THE Currency_Gateway SHALL return a validation error

**Property 3: Valid conversion produces non-zero result** ✅
_For any_ positive amount and valid different currencies, the conversion should produce a positive result.
**Validates:** WHEN a currency conversion is requested with valid currencies, THE Currency_Gateway SHALL return the converted amount using current exchange rates

**Property 4: Conversion round-trip preserves approximate value** ✅
_For any_ valid amount and two different currencies, converting from A to B and back to A should return the original amount within floating-point tolerance.
**Validates:** THE Currency_Gateway conversion SHALL be invertible with high precision

## Outbox Processor Properties

**Property 5a: All unpublished events are fetched** ✅
_For any_ set of unpublished events in the outbox, running the processor should fetch all of them.
**Validates:** WHEN the Outbox_Processor runs, THE System SHALL fetch all unpublished events from the outbox table

**Property 5b: Published events have timestamps** ✅
_For any_ event that is successfully published, it should be marked with a non-null publishedAt timestamp.
**Validates:** WHEN an event is successfully published, THE System SHALL mark it as published with a timestamp

**Property 5c: Retry logic increments retry count on failure** ✅
_For any_ publishing failure, the retry count should be incremented.
**Validates:** WHEN publishing fails, THE System SHALL increment the retry count for that outbox event

**Property 5d: Events with max retries are skipped** ✅
_For any_ event that has reached the maximum retry count, it should be skipped in subsequent runs.
**Validates:** WHEN an event reaches the configured max retry count, THE System SHALL skip publishing it (not attempt further retries)

## Query Handler Properties

**Property 6: Booking queries don't load full aggregates**✅
_For any_ booking query execution, the result should not contain domain events (indicating no aggregate was loaded).
**Validates:** WHEN a booking query is executed, THE Query_Handler SHALL return data optimized for read operations without loading full aggregates

**Property 7: Inventory queries don't trigger domain logic**✅
_For any_ inventory query execution, no domain events should be generated in the outbox.
**Validates:** WHEN an inventory query is executed, THE Query_Handler SHALL return availability data without triggering domain logic

**Property 8: Query failures return typed errors**✅
_For any_ query that fails, the error should be an instance of a known error type with diagnostic information.
**Validates:** WHEN query execution fails, THE System SHALL return a typed error with diagnostic information

**Property 9: findAvailableFlights respects cabin and minSeats filter** ✅
_For any_ availability search, the result should respect cabin and minimum seats filters.
**Validates:** THE Query_Handler SHALL support filtering by cabin and minimum seats

## Payment Gateway Properties

**Property 10: Payment requests include authentication**
_For any_ payment charge request, the HTTP call should include an Authorization header with the API key.
**Validates:** THE Payment_Gateway SHALL include proper authentication headers using the configured API key

**Property 11: Successful payments return transaction IDs**
_For any_ successful payment response, the result should contain a non-empty transaction ID.
**Validates:** WHEN the Polar API returns success, THE Payment_Gateway SHALL return a success result with transaction ID

**Property 12: Payment API errors map to domain errors**
_For any_ Polar API error response, the gateway should return a domain error (not throw an exception).
**Validates:** IF the Polar API returns an error, THEN THE Payment_Gateway SHALL map it to a domain error

**Property 13: All payment attempts are logged**
_For any_ payment charge request, an audit log entry should be created regardless of success or failure.
**Validates:** THE Payment_Gateway SHALL log all payment attempts for audit purposes

## Notification Gateway Properties

**Property 14: Notification requests include authentication**
_For any_ email send request, the HTTP call should include an Authorization header with the API key.
**Validates:** THE Notification_Gateway SHALL include proper authentication using the configured API key

**Property 15: Successful sends return message IDs**
_For any_ successful email send response, the result should contain a non-empty message ID.
**Validates:** WHEN the email is successfully sent, THE Notification_Gateway SHALL return success with message ID

**Property 16: Notification API errors map to domain errors**
_For any_ Resend API error response, the gateway should return a domain error (not throw an exception).
**Validates:** IF the Resend API returns an error, THEN THE Notification_Gateway SHALL map it to a domain error

**Property 17: Tickets are formatted in emails**
_For any_ ticket notification, the email body should contain the ticket number and PNR code.
**Validates:** THE Notification_Gateway SHALL format ticket information into a readable email template

## Audit Logger Properties

**Property 18: Aggregate saves create audit records**
_For any_ aggregate save operation, an audit record should be created with operation type, aggregate ID, and changes.
**Validates:** WHEN an aggregate is saved, THE Audit_Logger SHALL record the operation type, aggregate ID, and changes

**Property 19: User context is captured when available**
_For any_ operation with user context, the audit record should contain the user ID.
**Validates:** THE Audit_Logger SHALL capture the user ID if available in the execution context

**Property 20: Audit records have timestamps**
_For any_ audit record, it should have a non-null timestamp.
**Validates:** THE Audit_Logger SHALL include timestamps for all audit entries

## Configuration Properties

**Property 21: Missing required config fails fast** ✅
_For any_ required configuration key that is missing, the system should fail at startup with a descriptive error.
**Validates:** WHEN required configuration is missing, THE System SHALL fail fast with a descriptive error

**Property 22: Optional config uses defaults** ✅
_For any_ optional configuration key that is missing, the system should use the documented default value.
**Validates:** THE System SHALL provide default values for optional configuration

**Property 23: Sensitive values are redacted in logs** ✅
_For any_ log output containing configuration, sensitive values (API keys, passwords) should be redacted.
**Validates:** THE System SHALL redact sensitive values (API keys, passwords) in logs

## Health Check Properties

**Property 24: Health checks verify database**
_For any_ health check request, the response should include database connectivity status.
**Validates:** WHEN a health check is requested, THE System SHALL verify database connectivity

**Property 25: Health checks verify outbox processor**
_For any_ health check request, the response should include outbox processor status.
**Validates:** WHEN a health check is requested, THE System SHALL verify outbox processor status

**Property 26: Unhealthy services return unhealthy status**
_For any_ health check where a critical service is down, the overall status should be "unhealthy".
**Validates:** WHEN any critical service is unhealthy, THE System SHALL return an unhealthy status

**Property 27: Health responses include version**
_For any_ health check response, it should contain the system version.
**Validates:** THE System SHALL include version information in health check responses

## Graceful Shutdown Properties

**Property 28: Shutdown closes database connections**
_For any_ shutdown sequence, all database connections should be closed cleanly.
**Validates:** THE System SHALL close database connections cleanly

## Error Mapping Properties

**Property 29: Constraint violations map to domain errors** ✅
_For any_ database constraint violation, the system should return a domain error (not a SQL error).
**Validates:** WHEN a database constraint violation occurs, THE System SHALL map it to the appropriate domain error

**Property 30: Network timeouts return typed errors** ✅
_For any_ network timeout, the system should return a timeout error with service context.
**Validates:** WHEN a network timeout occurs, THE System SHALL return a typed timeout error

**Property 31: External API errors map to domain errors** ✅
_For any_ external API error, the system should return a domain error with context.
**Validates:** WHEN an external API returns an error, THE System SHALL map it to a domain error with context

**Property 32: Errors preserve stack traces** ✅
_For any_ error, the stack trace should be preserved for debugging.
**Validates:** THE System SHALL preserve error stack traces for debugging

**Property 33: Error messages don't expose internals** ✅
_For any_ error message, it should not contain sensitive information (connection strings, API keys, internal paths).
**Validates:** THE System SHALL never expose internal implementation details in error messages

**Property 34: Unexpected status codes map to ExternalServiceUnexpectedStatusError** ✅
_For any_ unexpected HTTP status code, the system should return an ExternalServiceUnexpectedStatusError.
**Validates:** WHEN an external service returns an unexpected status code, THE System SHALL return a typed ExternalServiceUnexpectedStatusError

## Implementation Status

| Properties | Status         | Test File                                                                                                     |
| ---------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| 1-4        | ✅ Implemented | `test/unit/gateways/currency-converter.property.test.ts`                                                      |
| 5a-5d      | ✅ Implemented | `test/unit/events/outbox-processor.property.test.ts`                                                          |
| 6          | ✅ Implemented | `test/unit/queries/booking-queries.property.test.ts`                                                          |
| 7          | ✅ Implemented | `test/unit/queries/inventory-queries.property.test.ts`                                                        |
| 8          | ✅ Implemented | `test/unit/queries/booking-queries.property.test.ts` & `test/unit/queries/inventory-queries.property.test.ts` |
| 9          | ✅ Implemented | `test/unit/queries/booking-queries.property.test.ts` & `test/unit/queries/inventory-queries.property.test.ts` |
| 10-13      | ✅ Implemented | `test/unit/gateways/payment-gateway.property.test.ts`                                                         |
| 14-17      | ✅ Implemented | `test/unit/gateways/notification-gateway.property.test.ts`                                                    |
| 18-20      | ⏳ Pending     | -                                                                                                             |
| 21-23      | ✅ Implemented | `config/infrastructure-config.property.test.ts`                                                               |
| 24-27      | ⏳ Pending     | -                                                                                                             |
| 28         | ⏳ Pending     | -                                                                                                             |
| 29-33      | ✅ Implemented | `errors/error-mapper.property.test.ts`                                                                        |

## Common Property Patterns

### 1. Invariants

Properties that remain constant despite changes.

- Example: Property 6 (queries don't load aggregates)

### 2. Round Trip

Combining an operation with its inverse returns to original.

- Example: Property 1 (same-currency identity)

### 3. Idempotence

Doing it twice = doing it once.

- Example: Property 5b (published events stay published)

### 4. Error Conditions

Generate bad inputs and ensure proper error handling.

- Example: Property 2 (invalid currency rejection)

### 5. Metamorphic

Relationships between components without knowing specifics.

- Example: Property 9 (pagination respects parameters)

## Writing Property Tests

### Template

```typescript
/**
 * Property N: [Property Statement]
 * Feature: infrastructure-layer, Property N: [Property Statement]
 * Validates: [Requirement text]
 */
test.prop(
  [
    // Generators for random inputs
    fc.string({ minLength: 5, maxLength: 20 }),
    fc.integer({ min: 0, max: 10 }),
  ],
  { numRuns: 10 },
)("Property N: [Property Statement]", (input1, input2) => {
  // Test implementation
  // Should verify the property holds for these inputs
});
```

### Best Practices

1. **Reference property number** in comments
2. **Use descriptive names** matching the property statement
3. **Run at least 10 iterations** to find edge cases
4. **Use appropriate generators** from fast-check
5. **Test universal properties**, not specific examples
6. **Keep tests focused** on one property at a time

### Common Generators

```typescript
// Strings
fc.string({ minLength: 5, maxLength: 20 });
fc.constantFrom("value1", "value2", "value3");

// Numbers
fc.integer({ min: 0, max: 10 });
fc.double({ min: 0.01, max: 100000 });

// Dates
fc.date();

// Custom
fc.record({ field1: fc.string(), field2: fc.integer() });
```

## Traceability

Each property maintains a clear traceability chain:

```text
Requirement (EARS format)
    ↓
Property (formal specification)
    ↓
Property Test (automated verification)
    ↓
Implementation (actual code)
```

To trace a property:

1. Find property number in this document
2. Read the requirement it validates
3. Find the test file in the status table
4. Locate the implementation in the codebase
