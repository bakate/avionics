# CQRS Query Services

This directory contains query services that implement the **read side** of the CQRS (Command Query Responsibility Segregation) pattern.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
├──────────────────────────┬──────────────────────────────────┤
│   Command Side (Write)   │    Query Side (Read)             │
├──────────────────────────┼──────────────────────────────────┤
│ • Services               │ • Query Services                  │
│ • Repositories (write)   │ • Read Models                     │
│ • Domain Events          │ • Optimized for reads             │
│ • Business Logic         │ • Denormalized data               │
└──────────────────────────┴──────────────────────────────────┘
```

## Benefits

1. **Performance**: Read models are optimized for queries (denormalized, indexed)
2. **Scalability**: Read and write sides can scale independently
3. **Simplicity**: Queries don't need to navigate complex domain models
4. **Flexibility**: Different read models for different use cases

## Query Services

### BookingQueries

- `getSummaryByPnr()` - Lightweight booking summary
- `listBookings()` - Paginated booking list
- `getPassengerHistory()` - Passenger booking history
- `findExpiredBookings()` - Cleanup queries
- `searchByPassengerName()` - Search functionality

### InventoryQueries

- `getFlightAvailability()` - Flight availability summary
- `getCabinAvailability()` - Specific cabin details
- `findAvailableFlights()` - Search available flights
- `getLowInventoryAlerts()` - Monitoring queries
- `getInventoryStats()` - Analytics queries

## Implementation Pattern

Infrastructure layer will implement these query services using:

- **Optimized database queries** (SQL views, materialized views)
- **Read replicas** for scalability
- **Caching** for frequently accessed data
- **Event handlers** to update read models from domain events

## Example Usage

```typescript
import { BookingQueries } from "@workspace/application/booking-queries";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const queries = yield* BookingQueries;

  // Get paginated bookings
  const result = yield* queries.listBookings({
    page: 1,
    pageSize: 20,
    status: "CONFIRMED",
  });

  console.log(`Found ${result.total} bookings`);
  return result.items;
});
```

## Read Model Updates

Read models are updated via domain events:

```typescript
// When BookingConfirmed event is published
onBookingConfirmed(event) {
  // Update read model
  updateBookingSummary({
    id: event.bookingId,
    status: "CONFIRMED",
    ...
  });
}
```

This ensures eventual consistency between write and read sides.
