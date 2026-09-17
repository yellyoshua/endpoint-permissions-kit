# endpoint-permissions-kit

Framework-agnostic endpoint authorization library: an explicit `Pkit` instance created by the consumer, roles typed from the constructor generic, one-hop grants, validation hooks and lazy cross-checks of the registry.

## Runtime

- Bun for development, tests and build.
- `dist/` (ESM + CJS + `.d.ts`) must run on Node >=20. No Bun or Node APIs in `src/`; Node APIs only in `scripts/`.
- No runtime dependencies. The CJS bundle is built self-contained (`scripts/build.ts` builds CJS with `packages: 'bundle'`).

## Commands

```sh
bun install
bun run typecheck
bun test
bun run build
```

## Layout

- `src/`: one module per responsibility. Public API composed in `src/index.ts` (`export default Pkit`, `export { Pkit }`, `METHODS`, types); `src/types.ts` holds the public contracts, generic in the role.
- Classes: `src/pkit.ts` (`Pkit`: per-instance registry, `context`, `module`, `validate`, `permissions`) and the builders `src/module-builder.ts`, `src/name-builder.ts`, `src/role-builder.ts`, `src/grant-builder.ts` (cached by key, methods bound in the constructor).
- Objects of functions receiving the registry or the snapshot as an argument: `src/registry.ts` (structure and mutations), `src/identifiers.ts` (identifier format), `src/definitions.ts` (`registerActions` and grant literals), `src/snapshot.ts` (lazy cross-checks and frozen views, memoized until the next mutation), `src/resolve.ts` (identity check and access resolution), `src/properties.ts` (walks `data`, compares each path with the permission and crops), `src/validate.ts` (phases and the `{ result, errors }` contract), `src/permissions.ts` (`named` and `forUser` views). `src/constants.ts` and `src/errors.ts` support them.
- `tests/`: `*.test.ts` with `bun test` (`registry`, `validate`, `security` for the adversarial suite, `audit-fixes`, `permissions`, `instances`, `usage-example`, `architecture`, `typecheck`); `tests/typecheck/` holds type-contract fixtures checked by `tsc`.
- `scripts/build.ts`: build pipeline.

## Conventions

- File names in dash-case. Identifiers camelCase, types PascalCase, constants CONSTANT_CASE.
- Every `src/` module exposes one `export default`: a single object whose methods are the module's API. No named runtime exports.
- That object holds only what another file calls. Logic used solely inside the file lives in a non-exported module-level function below the object; a trivial single-use helper is inlined at its call site instead.
- Export a type or interface only when another file imports it; keep the rest non-exported in the file that uses them.
- No arrow functions, no parameter defaults, no default bindings (`tests/architecture.test.ts` enforces the export shape and these rules).
- Blank line between methods and between the logical blocks inside a method.
- Exceptions to the single default export, listed in `tests/architecture.test.ts`: `src/index.ts` (published named exports plus `export default Pkit`) and `src/types.ts` (types only). `CLASS_EXPORT_FILES` in the same test lists the only files allowed to declare a class.
- Contextual exception for classes:

  ```txt
  Exception name: Classes for the instance and the builders
  Related rule: NT-6 / "one object per module" convention
  Context: the instance and the builders hold per-instance state and chain with identity
  Why the exception is needed: without global state, the state must live in an object the consumer creates
  Scope: src/pkit.ts, src/module-builder.ts, src/name-builder.ts, src/role-builder.ts, src/grant-builder.ts; no other file
  Expiration or review date: permanent while the instance API exists
  Risks: pure logic migrating into class methods
  Required safeguards: tests/architecture.test.ts lists the files authorized to export a class (CLASS_EXPORT_FILES)
  Approved by: the user, on approving REWRITE-PLAN.md
  ```
- No prose comments in code. Allowed: `@ts-expect-error`, shebang, JSDoc.
- No new dependencies without justification.
- Behavior changes require a test.

## Error contract

`validate()` never throws; it returns `{ result, errors }`, where `result` is `{ data }` on success and `null` on any failure. Registration and views throw `PkitError` with `code`. The cross-checks that need every registration loaded run lazily on the first `validate()` or view after the last mutation: `validate()` reports them as `VALIDATION_ERROR` with the `INVALID_DEFINITION` `PkitError` as `cause`; views throw it.

`validate()` is the trust boundary: it checks the shape of `data` and `context`, the method, the role and the assigned identifiers. The declared property paths are swept at `registerActions`, so nothing re-validates them per request.

## Do not

- Publish (`npm publish`, `bun publish`) or add CI workflows unless asked.
- Add framework adapters, database access or route discovery.
