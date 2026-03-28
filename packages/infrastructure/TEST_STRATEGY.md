# Test Strategy - Infrastructure Package

## Overview

This package contains integration tests that interact with a real PostgreSQL database. We use different database configurations for local development vs CI/CD to optimize for speed and cost. We use Neon in Production

## Strategy Summary

- **Local Development:** Docker PostgreSQL (fast, free, no Neon credits consumed)
- **CI/CD:** Neon test branch (isolated from production, managed infrastructure)

## Database Options

### 1. Docker PostgreSQL (Default for Local Development)

**When to use:** Local development, quick iteration

**Why Docker locally?**

- Avoids consuming Neon's free computation credits during development
- Faster execution (no network latency)
- Complete isolation from cloud resources
- Easy to reset and recreate

**Setup:**

```bash
# 1. Start PostgreSQL container
docker run -d \
  --name avionics-test-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=avionics-db-test \
  -p 5433:5432 \
  postgres:16-alpine

# 2. Initialize test database schema
pnpm test:setup

# 3. Run tests
pnpm test:integration

# 4. Stop container when done (optional)
docker stop avionics-test-db
docker rm avionics-test-db
```

**Configuration:** See `.env.test` (Docker settings)

**Pros:**

- ✅ Fast execution (no network latency)
- ✅ Preserves Neon free tier credits
- ✅ Complete isolation
- ✅ Easy to reset (recreate container)
- ✅ Works offline

**Cons:**

- ❌ Requires Docker installation
- ❌ Manual container management

---

### 2. Neon Branch (Required for CI/CD)

**When to use:** GitHub Actions, CI/CD pipelines

**Why Neon in CI/CD?**

- No Docker daemon required in GitHub Actions
- Instant branch creation/deletion
- Same infrastructure as production
- Automatic connection pooling
- Built-in backups
- Isolated from production database

**Setup:**

```bash
# 1. Create a dedicated test branch in Neon console
#    Name: "test-integration" or "ci-test"
#    Parent: main branch

# 2. For CI/CD, configure GitHub Secrets:
#    NEON_TEST_HOST
#    NEON_TEST_DATABASE
#    NEON_TEST_USER
#    NEON_TEST_PASSWORD

# 3. Tests will automatically use Neon in CI
```

**GitHub Actions Configuration:**

```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      PGHOST: ${{ secrets.NEON_TEST_HOST }}
      PGDATABASE: ${{ secrets.NEON_TEST_DATABASE }}
      PGUSER: ${{ secrets.NEON_TEST_USER }}
      PGPASSWORD: ${{ secrets.NEON_TEST_PASSWORD }}
      PGSSLMODE: "require"
    steps:
      - uses: actions/checkout@v4
      - name: Run migrations
        run: pnpm --filter @workspace/infrastructure run db:migrate
      - name: Run integration tests
        run: pnpm test:integration
```

**Pros:**

- ✅ Instant branching (copy-on-write)
- ✅ Isolated from production database
- ✅ No Docker required in CI
- ✅ Managed infrastructure
- ✅ Consistent with production setup

**Cons:**

- ❌ Network dependency (slower than local)
- ❌ Consumes computation credits
- ❌ Requires Neon account

---

### 3. Testcontainers (Future Consideration)

**Status:** Not yet implemented (package installed but not configured)

**When to consider:**

- Need to test against multiple PostgreSQL versions
- Want automatic container lifecycle management
- Require maximum test isolation

**Pros:**

- ✅ Automatic container management
- ✅ Test against different DB versions
- ✅ Perfect isolation per test suite

**Cons:**

- ❌ Requires Docker
- ❌ Slower startup time
- ❌ More complex configuration

---

## Test Database Lifecycle

### Before Each Test (`beforeEach`)

All integration tests use `cleanDatabase` helper which:

1. Deletes all data from tables (in correct order for FK constraints)
2. Resets sequences
3. Leaves schema intact

**Tables cleaned:**

- `segments`
- `passengers`
- `bookings`
- `event_outbox`
- `flight_inventory`
- `audit_log`

### Test Isolation

Each test starts with a clean database state. This ensures:

- No test pollution
- Predictable test results
- Parallel test execution safety (when using separate databases)

---

## Current Recommendation

**For local development:**

- Use Docker PostgreSQL (default in `.env.test`)
- Preserves Neon credits for production/staging
- Faster iteration cycle

**For CI/CD:**

- Use Neon test branch (configured via GitHub Secrets)
- Isolated from production database
- No Docker daemon required

**Cost Optimization:**

- Local development uses Docker → zero Neon credits consumed
- CI/CD uses Neon → minimal credit usage, only during test runs
- Production uses separate Neon branch → complete isolation

---

## Troubleshooting

### "Database cleaned" but data still exists

**Cause:** You're connected to the wrong database (likely production/dev)

**Solution:**

1. Check `.env.test` configuration
2. Verify `PGDATABASE` points to test database
3. For Docker: Ensure container is running (`docker ps`)
4. For Neon: Verify you're using the test branch credentials

### Tests are slow

**Cause:** Network latency (if using Neon) or database not optimized

**Solutions:**

- Use Docker PostgreSQL for local development (recommended)
- Ensure Docker container is running locally
- If using Neon locally, switch to Docker to improve speed

### Connection errors in CI/CD

**Cause:** Missing or incorrect GitHub Secrets

**Solution:**

1. Verify all `NEON_TEST_*` secrets are set in GitHub
2. Check Neon test branch is active and accessible
3. Verify SSL mode is set to 'require'
4. Test connection manually using provided credentials

### Docker container not starting

**Cause:** Port 5432 already in use or Docker not running

**Solution:**

```bash
# Check if port is in use
lsof -i :5432

# Stop any existing PostgreSQL instances
docker stop avionics-test-db

# Remove old container
docker rm avionics-test-db

# Restart Docker daemon if needed
```

---

## Migration Strategy

When adding new tables or modifying schema:

1. Generate migration: `pnpm db:generate`
2. Apply to test database:
   - **Docker (local):** `pnpm test:setup` (recreates from scratch)
   - **Neon (CI):** A separate GitHub Actions step is required **before** running tests. Migrations do **not** run internally within `pnpm test:integration`. See the workflow example in the [GitHub Actions Configuration](#github-actions-configuration) section below (specifically lines 108-109).
3. Update `cleanDatabase` in `test/helpers/db-test-helper.ts` if new tables added
4. Run tests to verify: `pnpm test:integration`

---

## Best Practices

1. **Never use production database for tests** - Always use dedicated test database/branch
2. **Use Docker locally** - Preserves Neon credits and improves speed
3. **Use Neon in CI/CD** - Leverages managed infrastructure without Docker
4. **Keep test data minimal** - Only create data needed for specific test
5. **Clean up in beforeEach, not afterEach** - Ensures clean state even if test fails
6. **Use factories for test data** - See `test/factories/` for examples
7. **Test isolation** - Each test should be independent and runnable in any order
8. **Monitor Neon usage** - Check dashboard to ensure test branch isn't consuming excessive credits

---

## Quick Start

### Local Development (Docker)

```bash
# Start Docker container
docker run -d --name avionics-test-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=avionics-db-test \
  -p 5433:5432 postgres:16-alpine

# Setup and run tests
pnpm test:setup
pnpm test:integration
```

### CI/CD (Neon)

```bash
# Configure GitHub Secrets (one time):
# - NEON_TEST_HOST
# - NEON_TEST_DATABASE
# - NEON_TEST_USER
# - NEON_TEST_PASSWORD

# Tests run automatically in GitHub Actions
# No additional setup required
```
