# e2e/ — instructions for agents

## 1. Scope

`e2e/` is an independent project that consumes `endpoint-permissions-kit` as an external package (`file:../`). Do not read or apply instruction, convention or configuration files from the repository root. Do not modify anything outside `e2e/`. The root is used only to run `bun run build` (via `bun run build:library`), which produces the `dist/` that the package resolves to. The library behaviour reference is the root `USAGE.md`; nothing else from the root is input.

## 2. Runtime and commands

`bun` runs everything. First time, in this order:

1. `bun run build:library` — builds `dist/` in the repository root.
2. `bun install` — installs dependencies; the library is linked file by file, so later library builds are picked up without reinstalling.
3. `bunx pkit generate` — writes `pkit.generated.d.ts` from `pkit.config.ts`. `bunx pkit generate --check` verifies it is current (exit 0) and is part of `bun run test`.
4. `bunx tsc --noEmit` — typechecks everything including test fixtures.
5. `bun test` — runs the four project suites. `bun test src/project-<name>` runs one.
6. `bun run test` — runs steps 1, 3 (`--check`), 4 and 5 in sequence.
7. `bun run dev` — starts Express on port 3001 and Vite on port 5173.
8. `bunx vite build` — builds the client to `dist/` (ignored by git).

## 3. Folder map

See `docs/architecture.md`. Rule: each project writes only inside `src/project-<name>/` and `docs/project-<name>.md`. Shared code lives in `src/server/`, `src/client/`, `src/testing/` and is promoted there only with two real consumers.

## 4. Library constraints

- One global registry per process. `pkit.context.set('roles', [...])` is called exactly once in `pkit.config.ts` with the union of all roles, before any `registerActions`.
- Module prefixes: `small`, `medium`, `large`, `xl`. Every module path of a project starts with its prefix.
- `pkit.seal()` is called once in `src/server/bootstrap.ts` after importing the four `permissions.ts`. It is idempotent.
- There is no public reset. Tests run against the sealed registry. Registration errors (`DUPLICATE_REGISTRATION`, `ROLE_NOT_DECLARED`, `SEALED`, `INVALID_DEFINITION` at seal) are tested only in a child process (`Bun.spawn`) that imports a deliberately broken configuration.
- Type imports from `endpoint-permissions-kit/types` need `moduleResolution: "bundler"` (already set).
- The role is always explicit; there is no inheritance between roles; `general` is not in the catalog.

## 5. Server contract

Identity by `x-user-id` header resolved in the project store; anonymous identity only in projects that declare it; every route protects a static `{ action, name, method }` triple. The HTTP error table lives in `docs/architecture.md`.

## 6. Code rules (condensed)

- Layers: transport (`routes.ts`) decodes and encodes; use cases (`<module>.ts`) authorize before any effect and return `UseCaseResult`; the store never imports `pkit`; the client decides what to show from the `/me` access map only.
- No comments in code except tool directives (`@ts-expect-error`). No `any`, no `TODO`, no placeholders.
- Booleans prefixed `is`/`has`/`can` (`enabled` is library contract and stays as is).
- `camelCase` functions and variables, `PascalCase` types and components, `CONSTANT_CASE` constants. Module-specific functions and components use `export default`; shared helpers and constants use named exports in their own file; React hooks are `use*` with `export default` in their own file.
- Error translation, identity and `authorize` exist once in `src/server/`; never re-implement permission resolution (use `forUser` and `validate`).
- No mocks of `pkit`, no skipping `seal`, no `test.skip`, no relaxed assertions.
- Meaningful literals in named constants; no dead code; no grab-bag files (`utils.ts`, `helpers.ts`).

## 7. Test policy

- `bun:test`, one suite per project in `src/project-<name>/tests/`, against real HTTP: `startTestServer()` in `beforeAll`, `close()` in `afterAll`, `store.reset()` + `store.seed()` in `beforeEach`.
- `api.test.ts` holds a data table user × route × method → expected status and code; the table is the expectation, not a second resolver.
- `screens.test.ts` crosses the `/me` access map with the project `SCREENS` registry using `visibleScreens`, without rendering React.
- `types.test.ts` runs `tsc --noEmit` on `tests/types.fixture.ts` through `typecheckFixture()` and prints its output on failure.
- Security negatives in every project: `role`/`permissions` in the body are ignored; unknown `x-user-id` is 401; a row of another role gives `403 PERMISSION_ROLE_MISMATCH` on every route.

## 8. Delivery report and acceptance

Every delivery ends with the report block (requirements covered, assumptions, scope, files changed, dependencies, patterns followed, simplicity decisions, fallbacks and error paths, security-relevant changes, performance, validations executed, validations not executed, result, completeness, residual risks, decisions needing approval) with "none" where a section does not apply. Acceptance: library build and `bun install` succeed; `bunx pkit generate --check`, `bunx tsc --noEmit`, `bun test`, `bunx vite build` exit 0; `bun run dev` serves the four projects; numeric minimums per project are documented in `docs/project-*.md`; the coverage matrix in `docs/architecture.md` has no empty cell in the extra-large row; nothing outside `e2e/` changes; zero non-permitted comments, `test.skip`, `TODO`, `any` or placeholders.
