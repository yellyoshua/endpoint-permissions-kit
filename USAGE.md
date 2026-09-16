# Using Endpoint Permissions Kit

## Model

A permission is identified by three components:

```text
[role]::[module]::[name]

staff::marketing.portals::all
staff::marketing.portals::update-only
admin::marketing.dashboard::all
```

The module identifies the resource. The name distinguishes sets of actions on that resource. The role identifies the variant of the set. The methods (`find`, `update`, `create`, `remove`) and their properties are declared with `registerActions`. A property is a path: `'id'`, `'unicorn.name'`, `'unicorn.*'`, or `'*'` for every field.

A request never carries the name. It carries `role`, `action` and `method`, and the name is resolved from the assignments of that user: among the identifiers that start with `role::module::`, the one the user holds. This is what lets the same role hold `all`, `read-only` or `only-related` on the same module without the route knowing which variant the caller was given. One user cannot hold two names of the same `role::module`: that is `AMBIGUOUS_PERMISSION` and it denies the request.

The library separates three concepts:

| Concept | Example | Meaning |
| --- | --- | --- |
| Definition | `portals.name('all').role('admin').registerActions(...)` | Declares what `admin::marketing.portals::all` allows; it assigns it to nobody |
| Assignment | Storing `admin::marketing.dashboard::all` among a user's permissions | The user holds that specific permission, in addition to belonging to the role |
| Grant | `portalsAll.grantTo('admin::marketing.dashboard::all').registerActions(...)` | Whoever holds that dashboard permission receives the block's actions on portals |

The role alone authorizes nothing. An administrator without assignments has access to no permission, even if definitions for `admin` exist.

## Registration and startup

The configuration must be evaluated before the permission modules. A separate module prevents ESM import evaluation order from running a registration before the catalog.

`pkit.config.js`:

```js
import pkit from 'endpoint-permissions-kit';

pkit.context.set('roles', ['admin', 'staff', 'public']);
pkit.context.set('cropper', false);
```

`modules/marketing/portals/permissions.js`:

```js
import pkit from 'endpoint-permissions-kit';

const portals = pkit.module('marketing').module('portals');
const portalsAll = portals.name('all');
const portalsUpdateOnly = portals.name('update-only');

portalsAll.role('staff').registerActions({
  find: { enabled: true, properties: ['id', 'name', 'assetId'] },
});

portalsAll.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
  remove: { enabled: true, properties: ['id'] },
});

portalsUpdateOnly.role('staff').registerActions({
  find: { enabled: true, properties: ['id', 'name', 'assetId'] },
  update: { enabled: true, properties: ['id', 'name', 'assetId'] },
});

portalsAll.grantTo('admin::marketing.dashboard::all').registerActions({
  find: { enabled: true, properties: ['id', 'name', 'assetId'] },
});

portalsAll.grantTo('staff::marketing.dashboard::all').registerActions({
  find: { enabled: true, properties: ['id', 'name', 'assetId'] },
});

portalsUpdateOnly.grantTo('staff::marketing.dashboard::all').registerActions({
  find: { enabled: true, properties: ['id', 'name', 'assetId'] },
});

function checkPublishedPortal(data, context) {
  if (data.status === 'published') {
    throw new Error('Published portals cannot be removed');
  }
}

portals.hook('remove', checkPublishedPortal);

function checkPortalOwner(data, context) {
  if (context.owner !== context.user.id) {
    throw new Error('Only the owner can update this portal');
  }
}

portalsUpdateOnly.role('staff').hook('update', checkPortalOwner);
```

`modules/marketing/dashboard/permissions.js`:

```js
import pkit from 'endpoint-permissions-kit';

const dashboard = pkit.module('marketing').module('dashboard').name('all');

dashboard.role('staff').registerActions({
  find: { enabled: true, properties: '*' },
});

dashboard.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
});
```

`app.js`:

```js
import pkit from 'endpoint-permissions-kit';
import './pkit.config.js';
import './modules/marketing/portals/permissions.js';
import './modules/marketing/dashboard/permissions.js';

pkit.seal();
```

Grants may be registered before the module they reference is imported. `seal()` resolves cross-references once every file is loaded, checks role hooks and materializes the views. It is idempotent. Registering permissions, grants, hooks or roles after sealing throws `SEALED`. Every registration validates the whole literal before modifying state.

`all` and `update-only` are labels. `all` does not enable every method and `update-only` contains `find` and `update` because it was declared that way; the library does not interpret names.

A name exists only when some role registers actions on it. `.name(...)` builds a builder, but a name that only has hooks or grants makes `seal()` fail with `INVALID_DEFINITION`: neither a hook nor a `grantTo` creates the capability they later use as proof of existence.

## Roles

`context.set('roles', [...])` declares the whole catalog. If the integration does not call it, the catalog contains only `general`, which is used explicitly with `.role('general')`. `general` is an ordinary role: it is not added to a declared catalog and it does not back other roles.

The role is always explicit. `registerActions` and role hooks require `.role(x)`; `validate` and `permissions.forUser` require `role`. A role outside the catalog produces `ROLE_NOT_DECLARED` when registering and `UNKNOWN_ROLE` when validating.

`*` is reserved for global hooks: declaring it in `context.set` or using it as a permission name throws `INVALID_DEFINITION`.

## Context keys

`context.set(key, value)` accepts two keys and `context.get(key)` reads them back. Both are frozen by `seal()`: setting them afterwards throws `SEALED`.

| Key | Value | Default | Effect |
| --- | --- | --- | --- |
| `roles` | `string[]` | `['general']` | The role catalog, declared before the first registration |
| `cropper` | `boolean` | `false` | How `validate()` compares the keys of `data` with the permission |

With `cropper: false` a path of `data` outside the permission denies the request with `PROPERTIES_NOT_ALLOWED`. With `cropper: true` nothing is denied: `result.data` keeps only the allowed paths. A non-boolean value throws `INVALID_DEFINITION`.

## Identifiers and assignments

The identifier is persisted as the full string. The relation between the user and the list of identifiers belongs to the application:

```json
[
  "staff::marketing.dashboard::all",
  "staff::marketing.portals::update-only"
]
```

Format:

- Exactly three components separated by `::`, with no empty component.
- Roles and names without `:` and without leading or trailing spaces. `*` can be neither a role nor a name.
- Modules made of non-empty segments joined by dots; `module()` receives one segment, not a path.
- Names accept dashes, such as `update-only`, and have no hierarchical interpretation.
- Case-sensitive. The library validates and rejects; it never corrects a persisted key.

`role::module::name` exists as an assignable identifier when there is a `registerActions` for that role, module and name. An identifier reachable only through a grant is not assignable: persisting it would drop the dependency on its source.

The role is part of the key on purpose: it allows auditing which role each row belongs to and detecting injected rows. A `staff` user with `admin::marketing.dashboard::all` stored is rejected with `PERMISSION_ROLE_MISMATCH`. The application must apply the same comparison when saving.

Changing the role, module or name changes the persisted key and requires migrating the rows before deploying: an unknown row blocks the user, as described under validation. Changing actions under the same key does not touch the database. Changing a user's role also requires rewriting their identifiers; the library does not replace prefixes. Identifiers derived from a grant are not stored; removing the source removes the derived access on the next resolution. Removing the source does not remove a direct assignment that also exists.

The library does not query the database and does not manage sessions. The application loads assignments from a trusted source and refreshes sessions or caches when it revokes them. A change in the sealed registrations requires reloading the process; revocation does not propagate on its own to existing processes or sessions.

## Grants

`grantTo(permissionId)` declares that holders of that identifier receive, on the receiving name, the actions of the block. The role of the identifier applies to both ends: `staff::marketing.dashboard::all` grants a `staff` user access on `staff::marketing.portals::all`.

```text
admin::marketing.dashboard::all
    → admin::marketing.portals::all
        → find: id, name, assetId
```

The block accepts the shape of `registerActions` with two restrictions: `enabled` must be `true` and `properties` must be an explicit list. A grant is opt-in; `enabled: false` or `'*'` throw `INVALID_DEFINITION`. It grants only the methods it declares: pointing at `update-only` does not grant `update`.

No direct definition for the receiving role is required: `portalsUpdateOnly.grantTo('admin::marketing.dashboard::all')` is valid without `portalsUpdateOnly.role('admin')`. The block declares what that administrator will be able to do; it does not copy the `staff` actions.

The relation is between permissions, not between methods of the same name: an identifier whose source only declares `find` can grant `update` on another name if the block declares it. It is also not necessary to have validated an operation on the source before; holding its identifier is enough.

Grants are one hop. Access received through a grant does not count as an assignment that activates another grant. To extend access to a third permission, declare another `grantTo` for the same assignable identifier. Cycles are valid: dashboard can grant on portals and portals on dashboard, because each grant is evaluated separately. Only self-reference is rejected.

At registration time the identifier format, its role, self-reference, the block shape and the absence of another block for the same identifier on that name (`DUPLICATE_REGISTRATION`) are validated. At seal time it is checked that the enabling identifier exists as assignable, that the receiving name has actions registered for some role and that every method of the block is declared by some role of that name. The block's fields are not compared with other definitions: the grant is the authority over its fields.

## Validating a request

The server obtains `role` and `permissions` from the session and from the loaded assignments. It never accepts them from the body or the query string. The route fixes the module and the method it protects; the name comes from the assignments.

```js
const validation = await pkit.validate({
  action: 'marketing.portals',
  method: 'find',
  role: 'staff',
  permissions: ['staff::marketing.dashboard::all'],
  data: {
    id: 1,
    name: 'Landing',
    assetId: 'a-7',
  },
  context: {
    user: { id: 7 },
  },
});
```

The shape is the same for the four methods: `data` carries the fields of that method and `context` carries whatever the hooks need. With the example configuration the result is `{ data }`, the same object that was sent. Adding `internalNotes` to `data` returns `result: null` and one `PROPERTIES_NOT_ALLOWED` error. An empty `errors` indicates success. If a phase fails, `result` is `null`.

`action`, `role` and `permissions` are required; omitting any of them is `INVALID_INPUT`. The request does not accept `name`. There is no implicit role: the anonymous case sends `role: 'public'` and the fixed list of identifiers the server decides for that identity.

The assignment list is validated in full, in this order per identifier: format (`INVALID_INPUT`), role equal to the authenticated one (`PERMISSION_ROLE_MISMATCH`), existence as assignable (`UNKNOWN_PERMISSION`) and a single name per `role::module` (`AMBIGUOUS_PERMISSION`). Any failure denies the whole request, even if the target does not depend on the faulty row: a stale row in the database blocks the user until it is cleaned up. An empty list denies with `PERMISSION_NOT_ASSIGNED`. Repeated identical identifiers are deduplicated.

Evaluation order: sealed registry, input shape, role, assignments (`AMBIGUOUS_PERMISSION`), module (`UNKNOWN_ACTION`), name resolution, access resolution, data properties, and hooks.

Resolution of `(role, module, method)`:

1. The name is looked up by prefix. The prefix is `role::module::`, built from the request with the separator at the end, and the assignment of the user that starts with it decides which name the request is about. The final separator is part of the prefix: `staff::marketing.portals::` never matches `staff::marketing.portals.assets::all`, which is a submodule, nor `staff::marketing.portal::all`, which is an unrelated module whose name is a textual prefix of this one.
2. With that name assigned, the direct definition decides completely. A missing method or `enabled: false` is `METHOD_DISABLED`. Grants towards that target are ignored, even if they were wider.
3. Without an assignment under the prefix, the names of the module whose `grantTo` blocks have an enabling identifier in the list are collected. None: `PERMISSION_NOT_ASSIGNED`. More than one: `AMBIGUOUS_PERMISSION`. Exactly one: its blocks decide. None with that method: `METHOD_DISABLED`. The fields are the union of the blocks that declare the method.

A direct definition the user does not hold does not participate: it neither contributes fields nor denies. The administrator who only holds dashboard receives the three fields of the grant, even though `portalsAll.role('admin')` declares `'*'`. The state of the source's methods does not matter either: disabling `dashboard.find` does not remove the derived access; removing the assignment does.

Different names are not merged: holding `all` does not grant `update-only`. That matters more now that the name is resolved instead of requested: the variant the user holds is the whole of their access to that module, and the library never falls back to a wider or a narrower sibling. When the choice is not unique it denies with `AMBIGUOUS_PERMISSION` instead of picking one.

The keys of `data` are the fields the request touches, and they are compared with the effective fields of the permission the same way for the four methods. `src/properties.ts` walks the structure and builds the path as it descends, so `{ unicorn: { name: 'Rainbow Dash', treasures: ['sparkles'] } }` is compared as `unicorn.name` and `unicorn.treasures`. An empty `data` passes, and so does a permission declared with `'*'`.

Matching is per path and per segment:

| Declared property | Matches | Does not match |
| --- | --- | --- |
| `'id'` | `id` | `id.value` |
| `'unicorn'` | `unicorn` when it arrives as `{}` or `[]` | `unicorn.name` |
| `'unicorn.name'` | `unicorn.name` | `unicorn.color`, `unicorn.name.first` |
| `'unicorn.*'` | `unicorn.name`, `unicorn.color`, `unicorn.treasures` when it arrives as `{}` or `[]` | `unicorn.treasures.id` |
| `'unicorn.*.*'` | `unicorn.treasures.id` | `unicorn.name` |

A literal path is the exact leaf, never a prefix: allowing `unicorn` does not allow what hangs below it. Each `*` stands for exactly one segment, and it can never be the first one: a path that starts with a wildcard would grant that leaf under every root key, so `'*.name'` and `'*.*'` throw `INVALID_DEFINITION`. `'*'` on its own is not a path either: it is the wildcard of the whole `properties` value and cannot appear inside the list.

Values the library does not walk, such as `Date` instances or class instances, are a single leaf path: they are allowed or denied whole, and the crop keeps them by reference.

Array elements share the path of the array that holds them, at every depth, so indexes never appear in a path: `unicorn.treasures[0].id` and `unicorn.treasures[1].id` are both compared as `unicorn.treasures.id`, a scalar array such as `tags: ['a', 'b']` is compared as `tags`, and `matrix: [[1, 2]]` as `matrix`. An index in `registerActions` (`'treasures[0]'`) throws `INVALID_DEFINITION`, and so do an empty segment (`'unicorn..name'`) and a leading wildcard (`'*.name'`).

Only a real array collapses that way. A key of an object is always a segment, even when it reads like an index, so `{ treasures: { '0': { id: 1 } } }` is compared as `treasures.0.id` and does not satisfy `'treasures.id'`. No key is exempt from the comparison either: `constructor`, `prototype` and `__proto__` arrive from `JSON.parse` as ordinary own keys and are denied or cropped like any other field.

The two modes run different algorithms:

- `cropper: false` compares the index-free paths. Every path outside the permission denies the request with `PROPERTIES_NOT_ALLOWED`; `fields` lists those paths without indexes and without repeating one that several array elements produce.
- `cropper: true` never denies. It copies out the allowed part of `data`, compacts the arrays it punctured and prunes the objects and arrays the crop emptied. A container that arrived empty and is allowed stays. The hooks receive that cropped object; the `data` you passed is never mutated.

Both modes walk `data` once. A node already open above the one being visited closes a cycle: with `cropper: false` it is reported as a leaf at that path, so `payload.escalation.loop = payload.escalation` denies with `fields: ['escalation.loop']`; with `cropper: true` a cycle cannot be represented in a filtered copy, so the request fails with `VALIDATION_ERROR` instead of copying the node by reference. `data` nested deeper than 1000 levels fails with `VALIDATION_ERROR` in both modes.

`data` and `context` are optional and are replaced by `{}` once, at the start of `validate()`; from there every layer and every hook receives an object. Sending `null`, a string or any other shape for them is `INVALID_INPUT`. `role`, `action` and `permissions` have no default and are always required.

The library does not query the database and does not filter responses; the handler uses the fields it authorized.

With the definitions of the example:

| User role and assignments | Target | Effective fields |
| --- | --- | --- |
| `admin`, dashboard only | Portals, `find` | `id`, `name`, `assetId` of the grant to `all`; the wildcard of `portalsAll.role('admin')` does not participate |
| `admin`, dashboard and portals `all` | Portals, `find` | `'*'`: the direct assignment rules, every requested field passes |
| `staff`, dashboard only | Portals, `find` | The three fields of the grant; the hooks of `portalsAll.role('staff')` run |
| `staff`, dashboard and portals `all` | Portals, `find` | Fields of `portalsAll.role('staff')`, even if fewer than the grant's |
| `staff`, dashboard only | Portals, `update` | `METHOD_DISABLED`: the grant only grants `find` |
| `staff`, portals `update-only` | Portals, `update` | Allowed with the three fields of `portalsUpdateOnly.role('staff')` |
| `staff`, portals `all` | Portals, `update` | Fields of `portalsAll.role('staff')`: `update-only` does not participate |
| `admin`, no assignments | Portals, `find` | `PERMISSION_NOT_ASSIGNED` |
| `staff`, portals `all` and `update-only` | Portals, any | `AMBIGUOUS_PERMISSION` |
| `staff`, row with `admin` prefix | Any | `PERMISSION_ROLE_MISMATCH` |
| `staff`, row whose name no longer exists | Any | `UNKNOWN_PERMISSION` |

## Hooks

The location of the hook determines its scope:

| Registration | Scope |
| --- | --- |
| `pkit.module(...).hook(method, fn)` | Every name of the module, every role |
| `.name(x).hook(method, fn)` | That name, every role |
| `.name(x).role(r).hook(method, fn)` | That name and role, for both direct and derived access |

A hook on `portalsAll.role('staff')` runs when authorizing `marketing.portals`, name `all`, role `staff`, whether the access comes from a direct assignment or from a grant from dashboard. It does not run for `admin` nor for `update-only`. Dashboard hooks do not run when querying portals. There is no hook inheritance between names or roles.

A role hook is valid at seal time if some path exists for that role, name and method: a direct definition or a grant whose identifier has that role. Without a path it throws `INVALID_DEFINITION`.

Order: module hooks, name hooks and name hooks for the authenticated role. All of them run with `Promise.allSettled`; errors keep the group and registration order even if they finish in another order. Each registration runs once per request. One failure denies the whole operation. Return values are ignored.

Every hook receives the same three arguments, whatever the method:

```text
(data, context, permissions)
```

`data` is the request payload, already cropped when `cropper` is on. `context` is the bag the caller passed to `validate()`; the library never reads it. `permissions` is the list of identifiers of the user making the request, exactly as it arrived; the library does not resolve it for the hook. `data` and `context` are always objects and `permissions` is always an array.

With `cropper: true` a hook only reads the paths the permission allows: anything else was already removed from `data`. A check on a value the request does not send, such as the current owner of the row, belongs in `context`, computed by the server for that request.

```js
portalsAll.role('staff').hook('find', checkDashboardPortalAccess);

function checkDashboardPortalAccess(data, context, permissions) {
  if (!permissions.includes('staff::marketing.dashboard::all')) return;
  if (data.allowDashboardPortalAccess !== true) {
    throw new Error('Portal access from dashboard is not allowed');
  }
}
```

`allowDashboardPortalAccess` is a value computed by the server for that request, not a library field and not a trustworthy value if it comes from the client. If the condition must restrict any read of portals, drop the filter by origin and register it as a name hook.

## Errors

The configuration, registration, sealing and view methods throw `PkitError` exceptions with a `code`. Only `validate()` returns `{ result, errors }`; the application translates the codes to its transport and decides what to expose.

| Code | Information |
| --- | --- |
| `INVALID_DEFINITION` | Malformed segment, name, identifier or property path; grant with `enabled: false`, `'*'`, self-reference or missing reference; name without actions; role hook without a path |
| `DUPLICATE_REGISTRATION` | Second `registerActions` for `(role, module, name)` or second block for the same grant |
| `ROLE_NOT_DECLARED` | Role outside the catalog when registering, including the `grantTo` prefix |
| `SEALED` / `NOT_SEALED` | Registration after `seal()` / use before `seal()` |
| `INVALID_INPUT` | Request without `action`, `role` or `permissions`; malformed identifier; `data` or `context` with an invalid shape |
| `UNKNOWN_ROLE` / `UNKNOWN_ACTION` | Unknown role or module at runtime |
| `UNKNOWN_PERMISSION` | An assigned identifier that is not assignable |
| `AMBIGUOUS_PERMISSION` | Two names of the same `role::module` assigned, or two names of one module reached by grant: the request names none, so it cannot choose |
| `PERMISSION_ROLE_MISMATCH` | Assigned identifier of a role different from the authenticated one |
| `PERMISSION_NOT_ASSIGNED` | Module without an assignment under its prefix and without an active grant |
| `METHOD_DISABLED` | Assigned target without that method enabled, or grants that do not grant that method |
| `PROPERTIES_NOT_ALLOWED` | `fields` enumerates the index-free paths of `data` outside the permission; never raised with `cropper: true` |
| `HOOK_ERROR` | `cause` keeps what the hook threw |
| `VALIDATION_ERROR` | Unexpected failure, with its original `cause`; also `data` nested deeper than 1000 levels, or a cycle in `data` with `cropper` on |

Flow:

```text
config → context.set → registerActions / hook → seal
request → validate → sealed → input shape → role → action → method → data properties → hooks
```

`validate()` catches the exceptions of its phases and returns a single contract. It never turns a failure into a successful result. Per failure, `validate` responds:

| Failure | `validate` response |
| --- | --- |
| Open registry | `NOT_SEALED` |
| Invalid shape of `data` or `context` | `INVALID_INPUT` |
| Role outside the catalog | `UNKNOWN_ROLE` |
| Module not registered | `UNKNOWN_ACTION` |
| Method missing or disabled | `METHOD_DISABLED` |
| Paths of `data` outside the permission, with `cropper: false` | `PROPERTIES_NOT_ALLOWED`, with `fields` |
| One or more hooks fail | One `HOOK_ERROR` per failed hook, with `cause` |
| Unexpected exception from another phase | `VALIDATION_ERROR`, stable message and original `cause` |
| `data` too deep to walk, or cyclic with `cropper` on | `VALIDATION_ERROR`, with the `RangeError` as `cause` |

Every failure produces `result: null`. Success produces `{ data }`: the same `data` object, or a copy with the allowed keys when `cropper` is on. The `errors` arrays are frozen. Hooks keep their message and cause; the consumer decides what to expose and what to log.

## Permission views

```js
const catalog = pkit.permissions.named;
const access = pkit.permissions.forUser({ role: 'staff', permissions: ['staff::marketing.dashboard::all'] });
```

`named` is the catalog of assignable identifiers with their registered actions. It serves to build the administrative permission picker. It does not include identities reachable only through a grant.

`forUser` returns, per effective identifier, a map from the four methods to a boolean, applying the same precedence and identity validation as `validate`, without running hooks. It includes directly assigned targets and those reachable through a grant; it omits the rest. With the example, the `staff` user with dashboard gets:

```js
{
  'staff::marketing.portals::all': { find: true, update: false, create: false, remove: false },
  'staff::marketing.portals::update-only': { find: true, update: false, create: false, remove: false },
  'staff::marketing.dashboard::all': { find: true, update: false, create: false, remove: false },
}
```

The views are frozen and have no prototype; before `seal()` they throw `NOT_SEALED`. They describe configuration: the hooks and data of each request still require `validate()`.

## Role types

```sh
pkit generate
pkit generate --config ./config/roles.mjs --out ./src/pkit.generated.d.ts
pkit generate --check
```

The generator imports the config in an isolated process and augments `RoleRegistry` from `endpoint-permissions-kit/types` with the declared roles, or with `general` if the config declares none. `Role` and `PermissionId` derive from that registry: `'nobody::x::y'` does not compile. The generated file must be included in the consumer's TypeScript program.

`--check` writes nothing: it exits with 1 if the file is missing or stale. Success exits with 0; an invalid command exits with 2; runtime errors exit with 1. The config must declare roles without starting servers or connections.

## Functional implementation

The library's functions are declared with `function` at module scope. There are no arrow functions, nested functions or parameter defaults. Builders bind arguments with `bind` and keep their identity when chaining calls or extracting methods. Definitions are copied and frozen at registration; views are materialized once at seal time. Each input is checked by the API that receives it: `src/context.ts`, `src/registry.ts`, `src/validate.ts` and `src/permissions.ts` own their own boundaries, and the rules they share live in `src/identifiers.ts` (the identifier format), `src/definitions.ts` (the `registerActions` literal) and `src/state.ts` (the open/sealed lifecycle). `src/resolve.ts` contains the identity check and the resolution shared by `validate` and `forUser`; `src/properties.ts` owns the comparison and the cropping of the paths of `data`, with one algorithm per mode. The README "Project layout" section describes the responsibility of every file.

## Scope

The library does not provide framework adapters, does not access databases, does not discover routes in the filesystem, does not manage sessions and does not hot-reload the sealed registry. The application keeps those responsibilities: it calls `validate()` from its handlers, loads assignments from a trusted source, decides which module and method each route protects, authenticates users, and restarts the process after changing sealed registrations.

The registry state lives in `globalThis[Symbol.for('endpoint-permissions-kit')]`. The ESM and CJS copies of the package share that state within one process, so a config loaded through `import` and a module loaded through `require` register into the same catalog.
