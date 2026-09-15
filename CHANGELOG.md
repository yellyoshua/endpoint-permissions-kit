# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/yellyoshua/endpoint-permissions-kit/releases/tag/v0.1.0
