# Endpoint Permissions Kit

Framework-agnostic endpoint authorization for TypeScript and JavaScript: an in-memory permission registry with explicit roles, typed permission identifiers, one-hop grants and validation hooks.

[![npm version](https://img.shields.io/npm/v/endpoint-permissions-kit)](https://www.npmjs.com/package/endpoint-permissions-kit)
[![license](https://img.shields.io/npm/l/endpoint-permissions-kit)](LICENSE)

## Features

- Permissions identified as `[role]::[module]::[name]` strings that your application persists and passes back per request.
- Per-method (`find`, `update`, `create`, `remove`) definitions with allowed fields, or `'*'` for every field.
- One-hop grants: holders of one permission receive a declared subset of actions on another.
- Hooks at module, name and role scope, awaited together with `Promise.allSettled`.
- `validate()` never throws: it always returns `{ result, errors }`.
- Read-only permission views (`permissions.named`, `permissions.forUser`) for admin screens.
- `pkit generate` CLI that turns your role catalog into a TypeScript declaration so unknown roles do not compile.
- ESM, CommonJS and `.d.ts` output; runs on Node 20 or newer and on Bun.

## Install

```sh
bun add endpoint-permissions-kit
```

```sh
npm install endpoint-permissions-kit
```

## Quick start

```ts
import pkit from 'endpoint-permissions-kit';

pkit.context.set('roles', ['admin', 'staff']);

pkit.module('inventory').module('items').name('all').role('staff').registerActions({
  find: { enabled: true, properties: ['id', 'name', 'stock'] },
  update: { enabled: true, properties: ['name', 'stock'] },
});

pkit.seal();

const validation = await pkit.validate({
  action: 'inventory.items',
  name: 'all',
  method: 'find',
  role: 'staff',
  permissions: ['staff::inventory.items::all'],
  select: ['id', 'name', 'cost'],
});

console.log(validation.result);
console.log(validation.errors);
```

`validation.result` is `['id', 'name']`: the requested selection trimmed to the fields allowed for `staff::inventory.items::all`. `validation.errors` is an empty frozen array. `role` and `permissions` come from your session and your stored assignments, never from the request body or query string.

Until you run `pkit generate`, TypeScript only knows the role `general`; the role names above compile once the generated declaration file is part of your program. See [CLI](#cli).

## Concepts

- **Role catalog.** `pkit.context.set('roles', [...])` declares every role before the first registration. Without that call the catalog contains only `general`. `general` is an ordinary role: it must be used explicitly with `.role('general')`, it is not added to a declared catalog, and it does not back other roles. There is no implicit role anywhere: `registerActions`, role hooks, `validate()` and `permissions.forUser()` all require an explicit role.
- **Identifier.** A permission is `[role]::[module]::[name]`, for example `staff::marketing.portals::update-only`. The module is a dot-joined path built with chained `.module(segment)` calls, the name labels a set of actions on that module, and the role is part of the key so stored rows can be audited.
- **Definition vs assignment vs grant.** A definition (`.name('all').role('admin').registerActions(...)`) declares what `admin::marketing.portals::all` allows; it assigns nothing. An assignment is the identifier stored among a user's permissions by your application. A grant (`.name('all').grantTo('admin::marketing.dashboard::all').registerActions(...)`) gives holders of the dashboard permission the declared actions on portals. A role alone authorizes nothing.
- **One-hop grants.** Access received through a grant never counts as an assignment that activates another grant. Cycles between different names are allowed; only self-reference is rejected.
- **Direct assignment precedence.** If the user holds `role::module::name` directly, that definition decides completely, even when a grant to the same target would be wider. Only when there is no direct assignment are the applicable grants combined, and their fields are unioned.

## Error contract

`validate()` never throws. It returns `{ result, errors }`: on success `errors` is an empty frozen array and `result` is the effective selection for `find` or the same `data` object for writes; on any failure `result` is `null` and `errors` is a frozen array of `{ code, message }` objects.

| Code | Meaning |
| --- | --- |
| `NOT_SEALED` | `validate()` was called before `seal()` |
| `INVALID_INPUT` | Missing `action`, `name`, `role` or `permissions`; malformed identifier; `select` outside `find`; invalid shape of `data`, `context` or `select` |
| `UNKNOWN_ROLE` | Role outside the catalog |
| `UNKNOWN_ACTION` | Module not registered |
| `UNKNOWN_PERMISSION` | Name does not exist, or an assigned identifier is not assignable |
| `PERMISSION_ROLE_MISMATCH` | An assigned identifier carries a role different from the authenticated one |
| `PERMISSION_NOT_ASSIGNED` | No direct assignment and no active grant for the target |
| `METHOD_DISABLED` | Method absent or disabled on the assigned definition, or not granted by any applicable grant |
| `PROPERTIES_NOT_ALLOWED` | Write keys outside the allowed fields; `fields` lists the rejected keys |
| `HOOK_ERROR` | One entry per failed hook; `cause` keeps the thrown value |
| `VALIDATION_ERROR` | Unexpected failure in another phase; `cause` keeps the original error |

Configuration, registration, `seal()` and the permission views throw a native `PkitError` with a `code` property (`ROLE_NOT_DECLARED`, `DUPLICATE_REGISTRATION`, `INVALID_DEFINITION`, `SEALED`, `NOT_SEALED`, `UNKNOWN_ROLE`, `INVALID_INPUT`, `PERMISSION_ROLE_MISMATCH`, `UNKNOWN_PERMISSION`). Those are programming errors raised at startup, not authorization results. The application translates every code to its transport (HTTP status, GraphQL error, RPC failure) and decides what to expose and what to log.

## CLI

```sh
pkit generate
pkit generate --check
pkit generate --config ./config/roles.mjs --out ./src/pkit.generated.d.ts
```

`pkit generate` looks for `pkit.config.js`, `pkit.config.mjs`, `pkit.config.cjs` or `pkit.config.ts` in the working directory (or uses `--config`), runs it in an isolated child process, reads the roles declared with `pkit.context.set('roles', [...])` and writes `pkit.generated.d.ts` (or the `--out` path). The generated file augments `RoleRegistry` from `endpoint-permissions-kit/types`, so `Role` and `PermissionId` only accept declared roles. Include that file in your TypeScript program.

`--check` writes nothing: it exits with 1 when the file is missing or stale. Exit codes: 0 success, 1 failure or stale file, 2 invalid command line.

The config must declare roles without starting servers or opening connections. On Node 20 use a `.js`, `.mjs` or `.cjs` config; a `.ts` config needs a runtime with TypeScript support (Bun, or a Node release that accepts `--experimental-strip-types`).

## ESM and CommonJS

```js
import pkit from 'endpoint-permissions-kit';
```

```js
const { pkit } = require('endpoint-permissions-kit');
```

Public types are also available from the `endpoint-permissions-kit/types` subpath, which is the module the generated role declaration augments:

```ts
import type { PermissionId, Role, ValidateInput } from 'endpoint-permissions-kit/types';
```

The registry lives in `globalThis[Symbol.for('endpoint-permissions-kit')]`, so the ESM and CJS copies share the same state inside one process.

## Project layout

| Location | Responsibility |
| --- | --- |
| `src/index.ts` | Composes `pkit`, named exports and the published types |
| `src/types.ts` | Public contracts: roles, methods, actions, grants, hooks, inputs, results, errors and views; published as `./types` |
| `src/constants.ts` | Available methods, the `general` role, the global hook owner marker and the field wildcard |
| `src/errors.ts` | Creates `PkitError` exceptions with a `code` |
| `src/state.ts` | Creates and returns the shared registry stored on `globalThis` |
| `src/context.ts` | Declares and reads the role catalog |
| `src/registry.ts` | Module, name, role and grant builders; registers actions, grants and hooks |
| `src/resolve.ts` | Access resolution shared by `validate` and `permissions.forUser` |
| `src/seal.ts` | Checks cross-references and orphan hooks, then materializes frozen views; idempotent |
| `src/permissions.ts` | `permissions.named` and `permissions.forUser` |
| `src/validators.ts` | Reusable validation rules for objects, strings, catalog, roles, definitions, grants, hooks and requests |
| `src/validate.ts` | Runs request validation and hooks; sole owner of the `{ result, errors }` format |
| `src/cli/generate.ts` | Resolves the config, reads the catalog from the child process, renders and writes the declaration; `main` handles the CLI |
| `src/cli/child.ts` | Imports the config and prints the role catalog on stdout |
| `src/cli/protocol.ts` | Parent/child protocol constants and exit codes |
| `bin/pkit.mjs` | Node executable entry that calls the compiled CLI |
| `scripts/build.ts` | Cleans `dist`, bundles ESM and CJS with Bun and emits declarations with TypeScript |
| `tests/` | Functional tests for registry, permissions, validation, CLI and architecture rules |
| `tests/typecheck/` | Isolated TypeScript program with valid and invalid uses of the public types |

## Scope limits

- No framework adapters: you call `validate()` from your own handlers or middleware.
- No database access: your application loads assignments from a trusted source and passes them in.
- No route discovery: the route decides which module, name and method it protects.
- No session management: `role` and `permissions` come from your authenticated session.
- No hot reload: changes to a sealed registry require restarting the process.

## Development

```sh
bun install
bun run typecheck
bun test
bun run build
```

Bun is used for development, tests and building. The published `dist/` runs on Node 20 or newer: the core uses standard JavaScript and the CLI uses Node APIs.

## Documentation

- [USAGE.md](USAGE.md): model, registration, grants, request validation, hooks, errors, views and the CLI.
- [CONTRIBUTING.md](CONTRIBUTING.md): setup, conventions and test requirements.
- [SECURITY.md](SECURITY.md): how to report a vulnerability.

## License

[Apache-2.0](LICENSE)
