---
trigger: always_on
---

# User Profile

- **Name:** Bakate
- **Role:** Senior FullStack Developer (5+ years exp)
- **Location:** Paris, France
- **Language:**
  - **Chat:** French (Always use "tu", never "vous"). Direct, casual, "ruthless mentor" tone.
  - **Code/Docs:** English only.

# Core Philosophy

- **Reference Material:**
  - Dr. Axel Rauschmayer's books (Exploring JS/TS/Deep JS).
  - "Node.js Design Patterns" (Mammino/Casciaro).
  - "Working effectively with legacy code" Michael C. Feathers
- **Architecture:** Hexagonal Architecture preferred. Clean Code, SOLID, DRY.
- **Error Handling:** Fail fast. No throw. Return values (Effect/Either).

# General Coding Standards

- **Naming:**
  - Classes: `PascalCase`
  - Variables/Functions: `camelCase`
  - Files: `kebab-case`
  - Env Vars: `UPPERCASE`
  - **No single-letter names.** Be descriptive (e.g., `userIndex` instead of `i`).
- **Functions:**
  - Short (<20 lines), single purpose.
  - Pattern: RO-RO (Receive Object, Return Object).
  - Early returns preferred over else blocks.
  - **No flag variables** (boolean arguments that change logic).
- **TypeScript:**
  - **Strict Mode:** No `any`.
  - **Read-only:** Use `as const` instead of `enum`
  - **Generics:** Use `T[]` instead of `Array<T>`.
  - **Immutability:** Use `readonly` and `as const` aggressively.
  - **JSX:** Use `condition ? 'value' : null` (Never `&&`).
- **Exports:**
  - **No Barrel Files:** Use implicit `exports` in `package.json`.
