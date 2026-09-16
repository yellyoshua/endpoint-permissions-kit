# endpoint-permissions-kit

Framework-agnostic endpoint authorization library: in-memory permission registry, typed roles, validation hooks, `seal()` closes the registry, `pkit generate` CLI emits role types.

## Runtime

- Bun for development, tests and build.
- `dist/` (ESM + CJS + `.d.ts`) must run on Node >=20. No Bun APIs in `src/` core; Node APIs only in `src/cli/` and `scripts/`.
- No runtime dependencies. The CJS bundle is built self-contained (`scripts/build.ts` builds CJS with `packages: 'bundle'`).

## Commands

```sh
bun install
bun run typecheck
bun test
bun run build
```

## Layout

- `src/`: one module per responsibility; `src/cli/` is the type generator. Public API composed in `src/index.ts`.
- `src/properties.ts` owns the paths of `data`: it walks the structure, compares each path with the permission and crops them.
- `tests/`: `*.test.ts` with `bun test`; `tests/typecheck/` holds type-contract fixtures checked by `tsc`; `tests/security.test.ts` holds the adversarial suite.
- `bin/pkit.mjs`: Node entry that calls the built CLI. `scripts/build.ts`: build pipeline.

## Conventions

- File names in dash-case. Identifiers camelCase, types PascalCase, constants CONSTANT_CASE.
- Every `src/` module exposes one `export default`: a single object whose methods are the module's API. No named runtime exports.
- That object holds only what another file calls. Logic used solely inside the file lives in a non-exported module-level function below the object; a trivial single-use helper is inlined at its call site instead.
- Export a type or interface only when another file imports it; keep the rest non-exported in the file that uses them.
- No arrow functions, no parameter defaults, no default bindings (`tests/architecture.test.ts` enforces the export shape and these rules).
- Blank line between methods and between the logical blocks inside a method.
- Exceptions to the single default export, listed in `tests/architecture.test.ts`: `src/index.ts` (published named exports plus `export default pkit`), `src/types.ts` (types only) and `src/cli/child.ts` (script).
- No prose comments in code. Allowed: `@ts-expect-error`, shebang, JSDoc.
- No new dependencies without justification.
- Behavior changes require a test.

## Error contract

`validate()` never throws; it returns `{ result, errors }`, where `result` is `{ data }` on success and `null` on any failure. Registration, `seal()` and views throw `PkitError` with `code`.

`validate()` is the trust boundary: it checks the shape of `data` and `context`, the method, the role and the assigned identifiers. The declared property paths are swept at `registerActions`, so nothing re-validates them per request.

## Do not

- Publish (`npm publish`, `bun publish`) or add CI workflows unless asked.
- Edit `pkit.generated.d.ts` files by hand; they are CLI output.
- Add framework adapters, database access or route discovery.
