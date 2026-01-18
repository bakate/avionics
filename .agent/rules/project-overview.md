---
trigger: always_on
---

# Tech Stack

The project name is "avionics"

- **Runtime:** Node.js (>=22), Pnpm preferred.
- **Monorepo:** Turborepo.
- **Frameworks:** Next.js 16+ (App Router) or Vite.
- **Library:** Effect 3+ (Standard Library).
- **State:** xstate, Effect/Atom (React).
- **Styling:** TailwindCSS, Shadcn UI, OriginUI.

# Effect Ecosystem Rules

- **Paradigm:** Treat everything as a program. No raw Promises if possible.
- **Syntax:** Use `Effect.gen` and `yield*` over `pipe` chaining for logic flow.
- **Functions:** Prefer const expression (`const foo = () => ...`) over `function foo()`.
- **Constructors:**
  - Use `Effect.succeed` / `Effect.fail`.
  - Use `Data.TaggedError` for domain errors.
  - Use `Schema` from Effectfor validation (replace Zod).

# Next.js & React Rules

- **Structure:** Feature-based architecture (`src/features/auth`, `src/features/dashboard`).
- **Components:** Named exports only. `kebab-case` filenames.
- **Data Fetching:** Prefer Effect for logic, allow TanStack Query for UI state if needed.
- **Forms:** React Hook Form + Effect Schema resolver.

# Testing Strategy

- **Unit:** Vitest.
- **E2E:** Playwright.
- **Mocking:** MSW.
- **Philosophy:** Test the domain logic (pure Effect) extensively.

# Product Overview

Avionics - High-Assurance Airline Reservation System
Avionics is a distributed Flight Booking Engine designed to demonstrate the robustness of TypeScript paired with Effect in a high-concurrency environment with strict reliability constraints.

Core Purpose
Simulate the critical lifecycle of a commercial airline reservation:
Inventory Management: Real-time management of seat availability with strict consistency (zero accidental overbooking).
Complex Booking Lifecycle: Orchestration of the PNR (Passenger Name Record) flow: Hold → Payment → Ticketing.
Dynamic Pricing: Stateless pricing engine based on complex business rules (cabin class, baggage, passenger type).
Resiliency & Recovery: Handling distributed failures (e.g., successful payment but failed ticket issuance) via compensation mechanisms (Sagas).
Temporal Constraints: Massive management of reservation expirations ("Time Limit") to release inventory back to the pool.

Key Concepts
PNR !== Ticket
A reservation (PNR) is a promise to purchase (status is CONFIRMED but not paid).
The Ticket (e-ticket) is the final contract. The system must handle the critical intermediate state where the PNR exists, but the ticket does not.
The "Atomic Hold"
Between flight selection and payment, a seat is "blocked" temporarily.
Utilization of Software Transactional Memory (STM) to guarantee the atomicity of concurrent reservations without locking the entire database.
Bounded Contexts The system is divided into strict domains (Monorepo):
Inventory: The source of truth for stock/seats.
Booking: The Saga orchestrator.
Pricing: The pure calculation engine.
Target Users
End User: The traveler looking to book a flight (Simulated from Front-end or CLI).
System Actors: The "Cancellation Robot" (Garbage Collector) that releases unpaid seats.
Support Agent: Ability to visualize the state of a stuck saga.

Architecture Philosophy
Effect-First & Hexagonal The application rejects the default "Optimistic" model of JavaScript.
Zero-Throw Policy: No exceptions are thrown. All errors (business or technical) are typed and returned as values (Effect<A, E, R>).
Structured Concurrency: Aggressive use of Fibers to manage parallel tasks (pricing) and timeouts.
Dependency Injection: Utilization of Effect Layers to totally decouple business logic (Domain) from infrastructure (Postgres, Redis, Polar for the payment).

# Technical Stack Overview

Build System
Turborepo Monorepo with pnpm workspaces. Designed for strict boundary enforcement between Hexagonal layers.

Package Manager: pnpm@10.x (Strict hoisting enabled)

Runtime: Node.js >=22 (LTS)

Orchestration: Turbo (Remote Caching enabled)

Architecture Strategy
We adhere to strict Hexagonal Architecture (Ports & Adapters). Dependencies flow inwards. The Domain knows nothing about the DB or the Web.

## 📦 Workspace Packages

### packages/domain (The Core)

Role: Pure business logic, types, and errors.
Dependencies: effect library only. No IO, no frameworks.
Key Tech: Effect/Schema (Validation), Effect/Data.

### packages/application (The Orchestrator)

Role: Use Cases (Booking Flow, Pricing Logic), Ports interfaces (Repository, Notifier).
Dependencies: @opensky/domain.
Key Tech: Effect/Stream, Effect/Concurrency (Fibers, Queue).

### packages/infrastructure (The Adapters)

Role: Concrete implementations (Postgres, Redis, Stripe, SendGrid).
Dependencies: @opensky/application.
Key Tech: @effect/sql-pg, @effect/platform, @effect/opentelemetry.

### packages/backend

Role: Concrete backend
Key Tech: @effect/platform and @effect/platform-node

### apps/web (The Interface)

Role: Presentation layer and input mechanism.
Framework: Vite (with react).

Core Technologies
The "Effect" Ecosystem (Replacing the Glue)
Instead of disparate libraries, we use the standard library for TypeScript:
Validation & Serialization: Effect/Schema (Replaces Zod/Joi).
Error Handling: Effect<A, E, R> (Replaces try/catch and throw).
Dependency Injection: Effect/Layer & Effect/Context (Replaces NestJS DI or Inversify).
HTTP Client: @effect/platform/HttpClient (Replaces Axios/Fetch).
Observability: Effect/Tracer & Effect/Metric (Native OpenTelemetry).
Infrastructure Services
Database: PostgreSQL (Structured relational data) via Neon.
Concurrency Control: Effect.makeSemaphore or Redis (Distributed Semaphores & Locking for Inventory) .
Queues: Queue from "effect" library for asynchronous tasks (e.g., Ticket issuance).

Frontend (apps/web)
Framework: Vite.
Styling: Tailwind CSS (Keep it simple, focus on logic).
State Management: URL-based state + xstate (Minimize client-side complexity).
UI Library: Shadcn/ui.

- Development Tools
  Strict Typing: tsconfig with strict: true, noUncheckedIndexedAccess: true.
  Linting: Biome.
  Testing: Vitest.
  Unit: Heavy focus on domain logic using Effect.runSync.
  Integration: Testing application layers using TestContext (Simulated time) and Mock Layers.

Common Commands
Bash

# Start infrastructure (Postgres/Redis) via Docker

pnpm services:up

# Start development environment

pnpm dev

# Run full test suite with coverage

pnpm test:coverage

# Build all packages with cache

pnpm build

# Typecheck entire monorepo (The ultimate truth)

pnpm typecheck
Why this stack?
We are demonstrating "Robust TypeScript". Every piece of this stack is chosen to eliminate runtime exceptions and guarantee that if it compiles, it handles every edge case (Network failure, Database timeout, Parsing error).
