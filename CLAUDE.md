# endpoint-permissions-kit

Framework-agnostic endpoint authorization library: in-memory permission registry, typed roles, validation hooks, `seal()` closes the registry, `pkit generate` CLI emits role types.

## Runtime

- Bun for development, tests and build.
- `dist/` (ESM + CJS + `.d.ts`) must run on Node >=20. No Bun APIs in `src/` core; Node APIs only in `src/cli/` and `scripts/`.

## Commands

```sh
bun install
bun run typecheck
bun test
bun run build
```

## Layout

- `src/`: one module per responsibility; `src/cli/` is the type generator. Public API composed in `src/index.ts`.
- `tests/`: `*.test.ts` with `bun test`; `tests/typecheck/` holds type-contract fixtures checked by `tsc`.
- `bin/pkit.mjs`: Node entry that calls the built CLI. `scripts/build.ts`: build pipeline.

## Conventions

- File names in dash-case. Identifiers camelCase, types PascalCase, constants CONSTANT_CASE.
- `src/index.ts` keeps named exports for every public piece plus `export default pkit`.
- Module-level `function` declarations only: no arrow functions, nested functions or parameter defaults (`tests/architecture.test.ts` enforces this).
- No prose comments in code. Allowed: `@ts-expect-error`, shebang, JSDoc.
- No new dependencies without justification.
- Behavior changes require a test.

## Error contract

`validate()` never throws; it returns `{ result, errors }`. Registration, `seal()` and views throw `PkitError` with `code`.

## Do not

- Publish (`npm publish`, `bun publish`) or add CI workflows unless asked.
- Edit `pkit.generated.d.ts` files by hand; they are CLI output.
- Add framework adapters, database access or route discovery.
