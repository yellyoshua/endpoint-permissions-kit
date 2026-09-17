# Endpoint Permissions Kit

Framework-agnostic endpoint authorization for TypeScript and JavaScript: an explicit `Pkit` instance with typed roles, typed permission identifiers, one-hop grants and validation hooks.

[![npm version](https://img.shields.io/npm/v/endpoint-permissions-kit)](https://www.npmjs.com/package/endpoint-permissions-kit)
[![license](https://img.shields.io/npm/l/endpoint-permissions-kit)](LICENSE)

## Features

- Permissions identified as `[role]::[module]::[name]` strings that your application persists and passes back per request; the request itself carries only the role, the module and the method.
- Per-method (`find`, `update`, `create`, `remove`) definitions with allowed fields, nested paths (`'unicorn.name'`), per-segment wildcards (`'unicorn.*'`), or `'*'` for every field.
- One method-agnostic request shape: every method sends `data` and `context`, and receives `{ data }`.
- One-hop grants: holders of one permission receive a declared subset of actions on another.
- Hooks at module, name and role scope, awaited together with `Promise.allSettled`.
- `validate()` never throws: it always returns `{ result, errors }`.
- The keys of `data` are checked against the permission: denied by default, or cropped with `context.set('cropper', true)`.
- Read-only permission views (`permissions.named`, `permissions.forUser`) for admin screens.
- Roles typed from the constructor: `new Pkit({ roles: ['admin', 'staff'] })` infers `Pkit<'admin' | 'staff'>`, so unknown roles fail to compile with no code generation.
- No global state: your application creates the instance, exports it and imports it wherever it registers permissions or validates requests.
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
import Pkit from 'endpoint-permissions-kit';

export const pkit = new Pkit({
  roles: ['admin', 'staff'],
  cropper: false,
  reservedFields: [],
});

pkit.module('inventory').module('items').name('all').role('staff').registerActions({
  find: { enabled: true, properties: ['id', 'name', 'stock'] },
  update: { enabled: true, properties: ['name', 'stock'] },
});

const validation = await pkit.validate({
  action: 'inventory.items',
  method: 'find',
  role: 'staff',
  permissions: ['staff::inventory.items::all'],
  data: { id: 1, name: 'Wrench' },
});

console.log(validation.result);
console.log(validation.errors);
```

`validation.result` is `{ data: { id: 1, name: 'Wrench' } }` and `validation.errors` is an empty frozen array: `id` and `name` are allowed for `staff::inventory.items::all`. Sending `cost` instead would return `result: null` and one `PROPERTIES_NOT_ALLOWED` error listing it. The same shape serves `update`, `create` and `remove`. `role` and `permissions` come from your session and your stored assignments, never from the request body or query string. The request does not name a permission name: `all` is resolved from the assignment that starts with `staff::inventory.items::`.

`pkit` is `Pkit<'admin' | 'staff'>`: `.role('admn')` or `role: 'nobody'` in `validate()` do not compile. Without `roles` the instance is `Pkit<'general'>`. In a real application the instance lives in one file that exports it, the permission files import it and register on it, and the handlers import it to call `validate()`; see [USAGE.md](USAGE.md#registration-and-startup).

## Concepts

- **Role catalog.** `new Pkit({ roles: [...] })` declares every role and types the instance; `pkit.context.set('roles', [...])` replaces the catalog at runtime. Without a declaration the catalog contains only `general`. `general` is an ordinary role: it must be used explicitly with `.role('general')`, it is not added to a declared catalog, and it does not back other roles. There is no implicit role anywhere: `registerActions`, role hooks, `validate()` and `permissions.forUser()` all require an explicit role.
- **Identifier.** A permission is `[role]::[module]::[name]`, for example `staff::marketing.portals::update-only`. The module is a dot-joined path built with chained `.module(segment)` calls, the name labels a set of actions on that module, and the role is part of the key so stored rows can be audited. A request carries `role`, `action` and `method`; the name is resolved from the assignment that starts with `role::module::`, so the same role can hold `all`, `read-only` or `only-related` on one module without the route knowing which one the caller was given.
- **Definition vs assignment vs grant.** A definition (`.name('all').role('admin').registerActions(...)`) declares what `admin::marketing.portals::all` allows; it assigns nothing. An assignment is the identifier stored among a user's permissions by your application. A grant (`.name('all').grantTo('admin::marketing.dashboard::all').registerActions(...)`) gives holders of the dashboard permission the declared actions on portals. A role alone authorizes nothing.
- **One-hop grants.** Access received through a grant never counts as an assignment that activates another grant. Cycles between different names are allowed; only self-reference is rejected.
- **Data properties.** The keys of `data` are the fields the request touches, walked structurally and compared path by path with the permission. A declared property matches the exact leaf path: `'unicorn'` allows `unicorn` only when it is an empty object or array, and `'unicorn.name'` is what allows `{ unicorn: { name: 'x' } }`. Each `*` stands for exactly one segment and never the first one, so `'unicorn.*'` allows `unicorn.name` but not `unicorn.treasures.id`, and `'*.name'` is rejected at registration. Array elements share their container's path, so `treasures[0].id` is compared as `treasures.id` and `tags: ['a', 'b']` as `tags`; an object key is always a path segment, so `{ treasures: { '0': { id: 1 } } }` is compared as `treasures.0.id`, not `treasures.id`. No key is exempt: `constructor`, `prototype` and `__proto__` are compared and filtered like any other field.
- **Deny or crop.** With the default `cropper: false` any path outside the permission denies the request, and `fields` lists the index-free paths. With `pkit.context.set('cropper', true)` nothing is denied: the allowed part of `data` is copied out, arrays are compacted and the containers the crop emptied are pruned. Containers that arrived empty and are allowed stay. The `data` object you pass is never mutated.
- **Reserved fields.** `pkit.context.set('reservedFields', ['id', 'meta.version'])` adds paths that every permission with a property list allows, in both modes: they are never denied and always kept by the crop. The list starts empty, replaces the previous one on each call, and is validated once with the rules of declared properties. Matching is exact, like any declared property.
- **Direct assignment precedence.** If the user holds a name of the requested module directly, that definition decides completely, even when a grant to the same target would be wider. Only when no name of the module is assigned are the applicable grants combined, and their fields are unioned.
- **One name per module.** A user holds at most one name of a given `role::module`, and at most one name of a module is reachable by grant. Two of either is `AMBIGUOUS_PERMISSION`: the request names no name, so the library denies instead of choosing between a wider and a narrower variant.

## Error contract

`validate()` never throws. It returns `{ result, errors }`: on success `errors` is an empty frozen array and `result` is `{ data }`, the request data unchanged, or cropped to the allowed keys when `cropper` is on; on any failure `result` is `null` and `errors` is a frozen array of `{ code, message }` objects.

| Code | Meaning |
| --- | --- |
| `INVALID_INPUT` | Missing `action`, `role` or `permissions`; malformed identifier; invalid shape of `data` or `context` |
| `UNKNOWN_ROLE` | Role outside the catalog |
| `UNKNOWN_ACTION` | Module not registered |
| `UNKNOWN_PERMISSION` | An assigned identifier is not assignable |
| `AMBIGUOUS_PERMISSION` | Two names of one `role::module` are assigned, or two names of one module are reachable by grant |
| `PERMISSION_ROLE_MISMATCH` | An assigned identifier carries a role different from the authenticated one |
| `PERMISSION_NOT_ASSIGNED` | No assignment under `role::module::` and no active grant for the module |
| `METHOD_DISABLED` | Method absent or disabled on the assigned definition, or not granted by any applicable grant |
| `PROPERTIES_NOT_ALLOWED` | Paths of `data` outside the allowed fields; `fields` lists them without array indexes. Never raised with `cropper` on |
| `HOOK_ERROR` | One entry per failed hook; `cause` keeps the thrown value |
| `VALIDATION_ERROR` | Unexpected failure in another phase; `cause` keeps the original error. Also raised with the message `registry has invalid definitions` and an `INVALID_DEFINITION` `PkitError` as `cause` when the registry fails its lazy cross-checks (missing grant source, name without actions, role hook without a path), and when `data` nests deeper than 1000 levels, or when it contains a cycle and `cropper` is on |

Configuration, registration and the permission views throw a native `PkitError` with a `code` property (`ROLE_NOT_DECLARED`, `DUPLICATE_REGISTRATION`, `INVALID_DEFINITION`, `UNKNOWN_ROLE`, `INVALID_INPUT`, `PERMISSION_ROLE_MISMATCH`, `UNKNOWN_PERMISSION`, `AMBIGUOUS_PERMISSION`). Those are programming errors, not authorization results; reading `pkit.permissions.named` at startup raises the cross-check errors before the first request. The application translates every code to its transport (HTTP status, GraphQL error, RPC failure) and decides what to expose and what to log.

## ESM and CommonJS

```js
import Pkit from 'endpoint-permissions-kit';

export const pkit = new Pkit({ roles: ['admin', 'staff'] });
```

```js
const { Pkit } = require('endpoint-permissions-kit');

module.exports.pkit = new Pkit({ roles: ['admin', 'staff'] });
```

Public types are also available from the `endpoint-permissions-kit/types` subpath. They take the role union as a generic and default to `string`:

```ts
import type { PermissionId, Role, ValidateInput } from 'endpoint-permissions-kit/types';

type AppRole = 'admin' | 'staff';
type AppPermissionId = PermissionId<AppRole>;
```

## Project layout

| Location | Responsibility |
| --- | --- |
| `src/index.ts` | Exports the `Pkit` class as default and named export, `METHODS` and the published types |
| `src/types.ts` | Public contracts, generic in the role: roles, methods, actions, grants, hooks, inputs, results, errors and views; published as `./types` |
| `src/constants.ts` | Available methods, the `general` role, the global hook owner marker and the field wildcard |
| `src/errors.ts` | Creates `PkitError` exceptions with a `code` and renders untrusted values for their messages |
| `src/pkit.ts` | `Pkit` class: per-instance registry, `context`, `module`, `validate` and `permissions` |
| `src/module-builder.ts`, `src/name-builder.ts`, `src/role-builder.ts`, `src/grant-builder.ts` | Builder classes cached by key with bound methods; register actions, grants and hooks on the instance registry |
| `src/registry.ts` | Registry structure and its mutations: roles, `cropper`, `reservedFields`, modules, names, grants and hooks; each mutation validates before writing and invalidates the snapshot |
| `src/identifiers.ts` | The `[role]::[module]::[name]` format: builds identifiers, parses them and checks each segment |
| `src/definitions.ts` | Reads a `registerActions` or grant literal into the frozen definition the registry stores |
| `src/snapshot.ts` | Compiles the registry into frozen views and runs the cross-checks that need every registration loaded; memoized until the next mutation |
| `src/resolve.ts` | Identity checks and access resolution, shared by `validate` and `permissions.forUser` |
| `src/properties.ts` | Walks `data`, checks each path against the permission and denies the disallowed ones, or crops them when `cropper` is on |
| `src/validate.ts` | Runs request validation and hooks; sole owner of the `{ result, errors }` format |
| `src/permissions.ts` | `permissions.named` and `permissions.forUser` over a snapshot |
| `scripts/build.ts` | Cleans `dist`, bundles ESM and CJS with Bun and emits declarations with TypeScript |
| `tests/` | Functional tests for registry, validation, security, permissions, instance isolation, the USAGE example and architecture rules |
| `tests/typecheck/` | Isolated TypeScript program with valid and invalid uses of the public types |

## Scope limits

- No framework adapters: you call `validate()` from your own handlers or middleware.
- No database access: your application loads assignments from a trusted source and passes them in.
- No route discovery: the route decides which module and method it protects.
- No session management: `role` and `permissions` come from your authenticated session.
- No hot reload across processes: registrations after the first `validate()` are allowed and invalidate the internal snapshot, but only inside the process that made them.

## Development

```sh
bun install
bun run typecheck
bun test
bun run build
```

Bun is used for development, tests and building. The published `dist/` runs on Node 20 or newer: the core uses standard JavaScript only.

## Documentation

- [USAGE.md](USAGE.md): model, registration, grants, request validation, hooks, errors, views and role types.
- [CONTRIBUTING.md](CONTRIBUTING.md): setup, conventions and test requirements.
- [SECURITY.md](SECURITY.md): how to report a vulnerability.

## License

[Apache-2.0](LICENSE)
