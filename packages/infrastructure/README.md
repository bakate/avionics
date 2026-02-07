# Infrastructure Layer

The infrastructure layer provides concrete implementations of ports defined in the application layer, following hexagonal architecture principles. All implementations use Effect for error handling, dependency injection, and observability.

## Quick Start

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run integration tests
pnpm test:integration

# Run property-based tests
pnpm test -- infrastructure-config.property.test.ts error-mapper.property.test.ts
```

## Architecture

```
Application Layer (Ports)
         ↓ implements
Infrastructure Layer
  ├── Gateways (Currency, Payment, Notification)
  ├── Repositories (Booking, Inventory)
  ├── Queries (CQRS read models)
  ├── Events (Outbox, Processor)
  ├── Services (Audit, Health, Shutdown)
  └── Config (Environment variables)
```

## Error Handling

### Two Error Hierarchies

**Domain Errors** (`@workspace/domain/src/errors.ts`)

- Business logic violations
- Examples: `FlightFullError`, `BookingExpiredError`
- Used by: Domain layer
- Created with: `Schema.TaggedError`

**Infrastructure Errors** (`packages/infrastructure/src/errors.ts`)

- Technical/system failures
- Examples: `PersistenceTimeoutError`, `NetworkError`
- Used by: Infrastructure layer
- Created with: `Data.TaggedError`

**Why two?** Domain errors represent business concepts, infrastructure errors represent technical failures. Infrastructure errors get mapped to domain errors when appropriate.

### Error Mapper

Maps low-level errors to typed domain errors:

- `mapDatabaseError()` - PostgreSQL → domain errors
- `mapNetworkError()` - Network → typed errors
- `mapHttpError()` - HTTP status → client/server errors
- `sanitizeErrorMessage()` - Removes sensitive data

## Property-Based Testing

### What are Properties?

**Properties** are formal specifications that describe what should be true for **all valid inputs**.

Example:

```typescript
// Property 21: Missing required config fails fast
test.prop([fc.constantFrom("DB_HOST", "DB_PASSWORD", ...)], { numRuns: 100 })(
  "Property 21: Missing required config fails fast",
  (missingKey) => {
    // Tests ALL required keys, 100 times with random combinations
  }
)
```

### Property Numbering

Properties are numbered (1-33) and link to requirements:

- **Property 21-23**: Configuration
- **Property 29-34**: Error Mapping

**Full list:** See [PROPERTIES.md](./PROPERTIES.md)

### Why Property-Based Testing?

- Tests **all** cases, not just specific examples
- Finds edge cases automatically
- Better coverage with less code
- Documents expected behavior formally

## Configuration

### Required

- `DB_HOST`, `DB_PASSWORD` - Database
- `CURRENCY_API_KEY` - Currency API
- `POLAR_API_KEY` - Payment gateway
- `RESEND_API_KEY` - Email service

### Optional (with defaults)

- `DB_PORT` (5432)
- `DB_NAME` ("avionics")
- `CURRENCY_CACHE_TTL` (3600s)
- `POLAR_TIMEOUT` (30s)

**See:** `src/config/infrastructure-config.ts`

## Testing

### Test Structure

```
src/
├── config/
│   └── infrastructure-config.property.test.ts  # Properties 21-23
├── errors/
│   └── error-mapper.property.test.ts           # Properties 29-33
└── test/repositories/
    ├── booking-repository.integration.test.ts
    └── inventory-repository.integration.test.ts
```

### Guidelines

**Property Tests:**

- Reference property number in comments
- Run at least 100 iterations (`numRuns: 100`)
- Use descriptive names matching property statement
- Test universal properties, not specific examples

**Integration Tests:**

- Use `.env.test` for test database
- Clean database between tests
- Test end-to-end flows

## Traceability

```
Requirements (7.2)
    ↓
Property (21)
    ↓
Property Test (infrastructure-config.property.test.ts)
    ↓
Implementation (infrastructure-config.ts)
```

**To trace a property:**

1. Find property number in test (e.g., "Property 21")
2. Look up in [PROPERTIES.md](./PROPERTIES.md)
3. Follow requirement reference

## External Dependencies

- **Database:** PostgreSQL (Neon)
- **Currency API:** exchangerate-api.com
- **Payment:** Polar API
- **Email:** Resend API

## Further Reading

- [PROPERTIES.md](./PROPERTIES.md) - Complete property list
- [Effect Documentation](https://effect.website)
- [fast-check Documentation](https://fast-check.dev)
