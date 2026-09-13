# Architecture of `e2e/`

`e2e/` is an independent consumer of `endpoint-permissions-kit`. One Express process serves four simulated applications under `/api/<project>`; one Vite process serves a React harness with routes `/`, `/small`, `/medium`, `/large`, `/extra-large`.

## Map

```text
e2e/
├── pkit.config.ts          single context.set('roles', ...) with the union of roles of the four projects
├── pkit.generated.d.ts     output of bunx pkit generate; never edited by hand
├── scripts/                build-library, generate-types, dev, test
├── docs/                   this file plus one specification per project
└── src/
    ├── ports.ts            API_PORT (3001) and VITE_PORT (5173)
    ├── server/             shared server layer (identity, authorize, assignments, body, errors, respond, meRoute, catalogRoute, bootstrap, app, index)
    ├── client/             shared client shell (router, project index, user selector, nav, generic table and form)
    ├── testing/            shared test helpers (ephemeral server, HTTP client, tsc fixture runner)
    └── project-*/          one folder per project: server/, client/, tests/
```

Each project writes only inside its own folder and its `docs/project-*.md`. `src/server/` and `src/client/` hold only code with at least two consumers.

## Role catalog (single, declared once)

| Project | Module prefix | Roles | Anonymous identity |
| --- | --- | --- | --- |
| small | `small` | `public`, `member`, `editor` | yes (`public`) |
| medium | `medium` | `admin`, `staff`, `analyst`, `intern` | no (401) |
| large | `large` | `admin`, `manager`, `warehouse`, `sales`, `accountant`, `hr` | no (401) |
| extra-large | `xl` | `public`, `owner`, `admin`, `agent`, `analyst`, `finance`, `author`, `auditor` | yes (`public`) |

Union declared in `pkit.config.ts` (17 roles): accountant, admin, agent, analyst, auditor, author, editor, finance, hr, intern, manager, member, owner, public, sales, staff, warehouse. `admin` and `public` are shared names; modules never collide because of the prefix.

## Layers on the server

| Layer | Files | Knows |
| --- | --- | --- |
| transport | `project-*/server/routes.ts`, `src/server/respond.ts`, `body.ts`, `meRoute.ts`, `catalogRoute.ts` | Express, HTTP codes |
| shared application helpers | `src/server/authorize.ts` (`authorizeFind`, `authorizeWrite`, `projectRecord`), `src/server/assignments.ts` (`checkAssignments`: role prefix and assignability of a list to save, delegated to `permissions.forUser`) | `pkit`, identity |
| application (use cases) | `project-*/server/<module>.ts` | `authorize`, the store, the failure contract |
| domain rules | hooks in `project-*/server/permissions.ts` | resource and user data passed as `context` |
| persistence | `project-*/server/store.ts` | `Map`s, `seed()`, `reset()`; never imports `pkit` |

Flow of a use case: the route decodes params/body, builds the request context with `buildRequestContext(req, res)` and calls the use case; the use case calls `authorizeFind` or `authorizeWrite` with the static `{ action, name }` guard, the identity from `res.locals`, `data`, `select` and that context; a non-empty `errors` returns `deny(errors)` before touching the store; on `find` the use case projects records with `projectRecord(record, result)`; on writes it loads the target after authorization (404 if missing) and applies `data`. The route hands the `UseCaseResult` to `respond(res, result, status)`.

## Request context for hooks (`src/server/requestContext.ts`)

Every route passes the same base context to `validate()`, so every hook receives it:

| Field | Value |
| --- | --- |
| `user` | the session identity `{ id, role, permissions }`, or `null` for the anonymous identity |
| `path` | the accessed path, e.g. `/api/small/notes/n1` |
| `permissions` | the identifier list used for the authorization (anonymous: the fixed public list) |
| `params` | the route params, e.g. `{ id: 'n1' }` |

Rules:

- Use cases never load a resource to feed a hook. A hook that needs a record (ownership, status, locks) queries the project store itself using `context.params.id` (helpers `resourceIdOf`, `sessionUserIdOf`) or a key from `data` (e.g. `data.ticketId`). A missing record makes the hook skip; the use case answers `404` afterwards.
- Server-computed request flags that are not stored data stay in the context on top of the base: `revealGrantSources` (large, route `/sales/orders/lines/sources`) and `isInternalScope` (extra-large, `?scope=internal`). They are spread over the base context, never replace it.
- One deliberate exception: `POST /api/extra-large/platform/tenants/members/import` calls its use case without any context to prove the library reports a hook that requires context as `HOOK_ERROR`.
- Hooks live in `permissions.ts` and import the store directly; `store.ts` still never imports `pkit`.

## Identity contract

- Header `x-user-id` looked up in the store of the project that owns the route; result placed in `res.locals.identity` as `{ id, role, permissions }`.
- Unknown id: `401 { error: { code: 'UNKNOWN_USER' } }`.
- Missing header: projects with an anonymous identity (`small`, `extra-large`) use a fixed `public` identity decided by the server; the others answer `401`.
- Nothing from the body or query ever reaches `validate()` as identity; tests send `role`/`permissions` in bodies and prove they are ignored.
- Read parameters from the client are allow-listed: `?select=a,b` (trimmed by the library) and, in extra-large, `?scope=internal` (a filter flag the server turns into `context.isInternalScope`; hooks may deny it, never widen access).

## HTTP error contract (`src/server/errors.ts`)

| Library code | HTTP | Body |
| --- | --- | --- |
| `INVALID_INPUT` | 400 | `{ error: { code, message } }` |
| `PERMISSION_NOT_ASSIGNED`, `METHOD_DISABLED` | 403 | `{ error: { code } }` |
| `PROPERTIES_NOT_ALLOWED` | 403 | `{ error: { code, fields } }` |
| `UNKNOWN_ROLE`, `PERMISSION_ROLE_MISMATCH`, `UNKNOWN_PERMISSION` | 403 | `{ error: { code } }`, logged as corrupt identity |
| `HOOK_ERROR` (one or many) | 403 | `{ error: { code: 'HOOK_ERROR', reasons: [hook messages in registration order] } }`; `cause` never leaves the server |
| `UNKNOWN_ACTION`, `NOT_SEALED`, `VALIDATION_ERROR` | 500 | `{ error: { code: 'INTERNAL' } }`, detail only in the server log |

Application codes with the same body shape: `NOT_FOUND` (404), `INVALID_BODY` (400, malformed JSON or wrong body shape), `UNKNOWN_USER` (401).

`/me` uses `pkit.permissions.forUser`, which throws `PkitError` for corrupt identities; `thrownErrorToHttp` applies the same table.

## Common routes

| Route | Guard | Response |
| --- | --- | --- |
| `GET /api/<project>/me` | identity only | `{ user, role, access }` with `access = permissions.forUser(identity)` |
| `GET /api/<project>/catalog` | an administrative permission of the project | `permissions.named` filtered to the project prefix |
| `PUT /api/<project>/users/:id/permissions` (large, extra-large) | an administrative permission of the project | rewrites the user's identifier list; rejects rows whose role prefix differs from the user's role with `403 PERMISSION_ROLE_MISMATCH` |

## Client

`src/client/projects.ts` registers the four projects (slug, title, simulated user ids, anonymous flag, `SCREENS`). Each screen declares `{ path, title, permission: { action, name, methods }, Component }`. Navigation is `visibleScreens(screens, role, access)`: a screen is listed when at least one of its methods is `true` in the `/me` map, grouped by the domain segment of `action`. Screens read the session through `useProjectSession()` and decide buttons with `session.can(action, name, method)`. Form fields come from the keys of the records the server returned for `find` (its projection); the client never re-resolves permissions.

## Route tables per project

See `docs/project-small.md`, `docs/project-medium.md`, `docs/project-large.md`, `docs/project-extra-large.md`.

## Coverage matrix

`api` = `tests/api.test.ts`, `screens` = `tests/screens.test.ts`, `types` = `tests/types.test.ts`, `startup` = `tests/startup.test.ts` (child processes). A dash means the feature is not exercised by that project; every extra-large cell is filled.

| Library feature | small | medium | large | extra-large |
| --- | --- | --- | --- | --- |
| `ROLE_NOT_DECLARED` | — | — | — | startup `role-not-declared` |
| `DUPLICATE_REGISTRATION` | — | — | — | startup `duplicate-registration` |
| `INVALID_DEFINITION` (name without actions, self-grant, grant `'*'`, role hook without path, `context.set` after registering) | — | — | — | startup, five fixtures |
| `INVALID_INPUT` | — | — | — | api `PUT /users/:id/permissions` malformed id (400) |
| `SEALED` | — | — | — | startup `sealed` |
| `NOT_SEALED` | — | — | — | startup `not-sealed` |
| `UNKNOWN_ROLE` | — | — | — | startup `unknown-role` |
| `UNKNOWN_ACTION` | — | — | — | startup `unknown-action` |
| `UNKNOWN_PERMISSION` | — | api `old` (USAGE row 11) on every route and `/me` | api `PUT` with unknown id | api `PUT` with unknown id (`author::xl.content.pages::draft`) |
| `PERMISSION_ROLE_MISMATCH` | api `rook` on every route and `/me` | api `mal` (USAGE row 10) | api injected row user, `PUT` with foreign prefix | api injected row user, `PUT` with foreign prefix |
| `PERMISSION_NOT_ASSIGNED` | api anonymous on `/notes`, `noah` on `/tags`, `zed` | api `eve` (row 8), `nil` (row 9) | api matrix | api matrix |
| `METHOD_DISABLED` | api `mia DELETE /notes`, `POST /tags` | api `sam PATCH update-only` (row 6) | api matrix | api auditor writes (`enabled: false, properties: []`) |
| `PROPERTIES_NOT_ALLOWED` with `fields` | api `PATCH /notes { pinned }` fields asserted | api | api `PUT` extra body key, matrix | api matrix |
| `HOOK_ERROR` with stable `reasons`, `cause` hidden | api pinned note, duplicate tag | api owner, published, dashboard-access hooks | api two hooks at once | api three scopes, context-missing hook |
| `VALIDATION_ERROR` | — | — | — | startup `validation-error` (Proxy data) |
| Hook scope: module | api (sync remove, async create) | api `portals.hook('remove')` | api orders module hook | api 3 module hooks |
| Hook scope: name | — | api assets update-only hook | api orders `all` ownership | api 3 name hooks |
| Hook scope: name + role | — | api `checkPortalOwner`, `checkDashboardPortalAccess` | api stock warehouse, lines sales | api 3 name+role hooks |
| Hook error order (module, name, role; registration order) | — | — | api `sam PATCH /sales/orders/o2` two reasons in order | api `DELETE /finance/ledger/entries/le2` two reasons |
| Direct definition wins over grant | — | api rows 2 and 4 | api direct `sue` vs derived `sam` | api matrix |
| Field union across grants, `grantedBy` sorted | — | — | api lines `all` from two sources; hook reveals `granted by: a, b` | api multi-source grants |
| One-hop grants (derived access does not chain) | — | api row 8 (`all` does not give `update-only`) | api | api |
| Valid cycle between two modules | — | — | api orders ↔ invoices | api grants table cycle |
| Self-reference rejected | — | — | — | startup `self-referencing-grant` |
| `properties: '*'` | api editor full record | api admin `*` ignored when access is derived (row 1) | api admin | api owner `*` in several methods |
| `select` trimmed silently | api `?select=id,title,pinned` | api | api `?select=id,sku,cost,secret` | api |
| `find` without `select` returns all permitted fields | api | api | api | api |
| `data` mandatory on writes / body shape | api `INVALID_BODY` | api | api `PUT` non-array | api `INVALID_BODY` non-array, non-primitive values |
| Anonymous identity with fixed list | api `/me` anonymous | — (401) | — (401) | api anonymous on `/me` and routes |
| `permissions.forUser` (`/me`) | api, screens | api, screens | api, screens | api, screens, deduplication (`dupe` ≡ `gia`) |
| `permissions.named` (`/catalog`) | api key list | api key list | api 19 ids, admin screen | api ≥ 25 ids, admin screen |
| `pkit generate` (types) | types fixture | types fixture | types fixture | types fixture |
| `pkit generate --check` | scripts/test.ts step | scripts/test.ts step | scripts/test.ts step | startup test spawns it |
| Hot reassignment `PUT /users/:id/permissions` | — | — | api immediate effect; grant source removal keeps direct | api immediate effect; grant source removal |
| Identity never from body | api | api | api | api |
| Concurrency (≥ 50 parallel requests) | — | — | — | api 60 requests via `Promise.all`, wall time logged |

## Contextual exceptions

```txt
Exception name: project-local generic CRUD screen and use case
Related rule: DUP-2 / AIS-7 (four projects follow the same file shape)
Context: project-large has 9 screens and project-extra-large has 11 CRUD modules with identical list/create/update/remove shape.
Why the exception is needed: the third copy of the small-project screen pattern triggers the rule of three; each large project extracts its own ResourceScreen.tsx / CollectionScreen.tsx (client) and collection.ts (server, extra-large only) instead of copying the pattern 9 or 11 times.
Scope: src/project-large/client/ResourceScreen.tsx, src/project-extra-large/client/CollectionScreen.tsx, src/project-extra-large/server/collection.ts. Not promoted to src/client or src/server because small and medium keep hand-written screens (DUP-5: they change for different reasons).
Expiration or review date: review if a fifth project is added.
Risks: a bug in the generic screen affects every screen of that project.
Required safeguards: screens.test.ts and api.test.ts per project cover every screen and route.
Approved by: user, 2026-09-12 (second delivery).
```

```txt
Exception name: project-small built by the main agent
Related rule: section 7 phase 2 (one sub-agent per project)
Context: the sub-agents needed a complete reference implementation to keep the four projects uniform (AIS-7).
Why the exception is needed: writing project-small first fixed the store/use case/route/test/doc shape that sub-agents B, C and D followed.
Scope: src/project-small/**, docs/project-small.md.
Expiration or review date: not applicable.
Risks: none beyond the deviation from the phase plan.
Required safeguards: the same phase 4 review applies to all four projects.
Approved by: user, 2026-09-12 (second delivery).
```

## Phase 4 review findings

| Finding | Verdict | Status |
| --- | --- | --- |
| `seed()` runs at module load in every `store.ts` (reviewer asked to remove it) | OBSERVACIÓN | kept (approved by user 2026-09-12): `bun run dev` needs seeded data without tests; tests still call `reset()` + `seed()` in `beforeEach`; no section 8 rule forbids module-load seeding |
| Use cases in `<module>.ts` use named exports instead of `export default` (NT-6) | OBSERVACIÓN | kept (approved by user 2026-09-12): the prompt fixes one file per module with several use cases; a default-exported object would hide the functions behind a namespace |
| `seed()` in large and extra-large stores exceeds ~30 lines (FN-2) | OBSERVACIÓN | kept (approved by user 2026-09-12): declarative fixture data, no branching |
| Shared layer (`src/server`, `src/client`, `scripts`) | no findings | — |
| project-large, project-extra-large | no INCUMPLIMIENTO | — |

## Development reload

`bun run dev` starts the API with `bun --watch src/server/index.ts`: every change under `src/server` or `src/project-*/server` restarts the whole process. A full restart is required, not hot module replacement: the library keeps its registry in `globalThis[Symbol.for('endpoint-permissions-kit')]`, seals it once and exposes no reset, so re-evaluating a `permissions.ts` inside a live process would throw `SEALED` or `DUPLICATE_REGISTRATION`. Vite keeps HMR for the client.

## Library documentation finding (proposed upstream, not applied)

`USAGE.md`, table "Con las definiciones del ejemplo", row 5 (`admin`, only dashboard → portals `update-only`, `find` → `id, name, assetId`) is not reachable with the example code, which only declares `portalsUpdateOnly.grantTo('staff::marketing.dashboard::all')`. Either add `portalsUpdateOnly.grantTo('admin::marketing.dashboard::all').registerActions({ find: { enabled: true, properties: ['id', 'name', 'assetId'] } })` to the example, or change the row to `PERMISSION_NOT_ASSIGNED`. project-medium declares that grant so the row passes literally.
