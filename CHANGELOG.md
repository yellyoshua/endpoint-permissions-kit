# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-09-16

### Added

- `pkit.context.set('reservedFields', paths)` and `pkit.context.get('reservedFields')`: property paths allowed by every permission with a property list, on every method, in both modes and for grants too. Empty by default, each path checked like a declared property, replaced on each call and frozen by `seal()`.

## [0.2.0] - 2026-09-15

### Added

- `AMBIGUOUS_PERMISSION` in `PkitErrorCode`, raised when the identity holds two names of the same `role::module`, or when the user's grants reach two names of the requested module. `validate()` returns it with `result: null`; `permissions.forUser()` throws it. It denies instead of choosing a variant.
- `pkit.context.set('cropper', boolean)` and `pkit.context.get('cropper')`: with `true`, `validate()` crops `result.data` to the keys allowed by the permission instead of denying the request. Frozen by `seal()`, `false` by default.
- `src/properties.ts`: walks the paths of `data` and, with one algorithm per mode, denies or crops them against the properties of the permission.
- Nested properties in `registerActions`: literal paths (`'unicorn.name'`) and per-segment wildcards (`'unicorn.*'`), never in the first segment. A literal path is the exact leaf, never a prefix: a property declared as `'unicorn'` no longer covers `unicorn.name`. Array elements share the path of their array at every depth, so `treasures[0].id` is compared as `treasures.id` and `tags: ['a', 'b']` as `tags`, while an object key that reads like an index stays a segment. An index, an empty segment or a leading wildcard in a declared property throws `INVALID_DEFINITION`.
- Cropping with `cropper: true` copies out the allowed leaves, compacts the punctured arrays and prunes the containers it emptied; containers that arrived empty and are allowed stay, and the `data` passed in is never mutated. `data` deeper than 1000 levels, or cyclic while cropping, fails with `VALIDATION_ERROR`.

### Changed

- **Breaking.** `validate()` no longer takes `name`. The request carries `role`, `action` and `method`, and the name comes from the assignments of the user: the identifier under the `role::module::` prefix, or the only name of that module their grants reach. This lets one role hold `all`, `read-only` or `only-related` on the same module without the route knowing which variant the caller was given. Remove `name` from every `validate()` call and check that no user holds two permissions of the same `role::module`, which is now denied with `AMBIGUOUS_PERMISSION`. `.name(...)`, the `PermissionId` format and the `permissions.named` catalog keep the name.
- `permissions.forUser()` returns one name per module, the same one `validate()` resolves, so a `UserPermissionMap` can no longer hold two keys with the same `role::module`.
- `UNKNOWN_PERMISSION` is no longer reachable from a request. The code stays, raised for an assigned identifier that is not in the sealed catalog.
- `validate()` takes a single method-agnostic `ValidateInput` and returns `ValidateResult` with `result: { data }` for every method; the `find` and write overloads are gone.
- The keys of `data` are compared with the permission on the four methods. `PROPERTIES_NOT_ALLOWED` lists the root keys outside it and is never raised with `cropper: true`.
- `data` and `context` are optional and normalized once to `{}` at the start of `validate()`; hooks always receive objects.
- Hooks receive `(data, context, permissions)`, where `permissions` is the identifier list of the requesting user.

### Removed

- **Breaking.** The `name` key of `ValidateInput`. It is not optional and not ignored: a field accepted and unused would be a lie at the trust boundary.
- The `select` key of `validate()`. The request no longer declares the fields it wants: they are read from `data`.
- The `FindInput`, `WriteInput`, `FindResult`, `ResolvedPermission` and `Authorization` types, and the resolved permission argument of the hooks.

## [0.1.0] - 2026-09-15

### Added

- In-memory permission registry with chained `module`, `name`, `role` and `grantTo` builders.
- `pkit.context.set('roles', [...])` to declare the role catalog; `general` is an ordinary explicit role.
- `registerActions` per `(role, module, name)` with `find`, `update`, `create` and `remove` methods and allowed `properties` or the `'*'` wildcard.
- One-hop grants with `grantTo(permissionId).registerActions(...)`; direct assignments take precedence over grants.
- Hooks at module, name and role scope, awaited together with `Promise.allSettled`.
- `pkit.seal()` to check cross-references and orphan role hooks and to materialize frozen views; idempotent.
- `pkit.validate()` returning the `{ result, errors }` contract without throwing, including `NOT_SEALED`, `INVALID_INPUT`, `UNKNOWN_ROLE`, `UNKNOWN_ACTION`, `UNKNOWN_PERMISSION`, `PERMISSION_ROLE_MISMATCH`, `PERMISSION_NOT_ASSIGNED`, `METHOD_DISABLED`, `PROPERTIES_NOT_ALLOWED`, `HOOK_ERROR` and `VALIDATION_ERROR` codes.
- `pkit.permissions.named` catalog of assignable identifiers and `pkit.permissions.forUser()` per-user method access map.
- `pkit generate` CLI with `--config`, `--out` and `--check`, generating a `RoleRegistry` augmentation for `endpoint-permissions-kit/types`.
- ESM, CommonJS and TypeScript declaration output; `endpoint-permissions-kit/types` subpath; Node 20 or newer.

[0.2.1]: https://github.com/yellyoshua/endpoint-permissions-kit/releases/tag/v0.2.1
[0.2.0]: https://github.com/yellyoshua/endpoint-permissions-kit/releases/tag/v0.2.0
[0.1.0]: https://github.com/yellyoshua/endpoint-permissions-kit/releases/tag/v0.1.0
