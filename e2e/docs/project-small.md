# project-small: team notebook

Prefix `small`. Three flat modules, two names in `notes`, three roles (one anonymous), no grants, module-scoped hooks only.

## Simulated users

| id | role | permissions |
| --- | --- | --- |
| anonymous (no header) | `public` | `public::small.notes::read-only` |
| `mia` | `member` | `member::small.notes::all`, `member::small.tags::all`, `member::small.profile::all` |
| `eli` | `editor` | `editor::small.notes::all`, `editor::small.tags::all`, `editor::small.profile::all` |
| `noah` | `member` | `member::small.notes::all` |
| `zed` | `member` | (empty) |
| `rook` | `member` | `member::small.notes::all`, `editor::small.tags::all` (injected row of another role) |

## Module tree

```text
small
├── notes      names: read-only, all
├── tags       names: all
└── profile    names: all
```

## Permission matrix

| Identifier | find | create | update | remove |
| --- | --- | --- | --- | --- |
| `public::small.notes::read-only` | id, title | — | — | — |
| `member::small.notes::all` | id, title, body, author | title, body | title, body | disabled (`enabled: false`, `[]`) |
| `editor::small.notes::all` | `*` | title, body, pinned | title, body, pinned | id |
| `member::small.tags::all` | id, label | — | — | — |
| `editor::small.tags::all` | `*` | label, color | — | id |
| `member::small.profile::all` | id, displayName | — | displayName | — |
| `editor::small.profile::all` | `*` | — | displayName, bio | — |

Hooks (module scope):

| Module | Method | Kind | Rule | Message |
| --- | --- | --- | --- | --- |
| `small.notes` | `remove` | synchronous | `context.resource.pinned === true` denies | `Pinned notes cannot be removed` |
| `small.tags` | `create` | asynchronous | `data.label` already in `context.existingLabels` denies | `Tag label already exists` |

## Routes

| Method + route | Guard | Library method |
| --- | --- | --- |
| `GET /api/small/me` | identity | `permissions.forUser` |
| `GET /api/small/catalog` | `<role>::small.tags::all` | `find` |
| `GET /api/small/notes/published` | `<role>::small.notes::read-only` | `find` |
| `GET /api/small/notes` | `<role>::small.notes::all` | `find` (`?select=a,b` trimmed) |
| `POST /api/small/notes` | `<role>::small.notes::all` | `create` |
| `PATCH /api/small/notes/:id` | `<role>::small.notes::all` | `update` (context: user, resource) |
| `DELETE /api/small/notes/:id` | `<role>::small.notes::all` | `remove` (context: user, resource) |
| `GET /api/small/tags` | `<role>::small.tags::all` | `find` |
| `POST /api/small/tags` | `<role>::small.tags::all` | `create` (context: existingLabels) |
| `DELETE /api/small/tags/:id` | `<role>::small.tags::all` | `remove` |
| `GET /api/small/profile` | `<role>::small.profile::all` | `find` (own profile) |
| `PATCH /api/small/profile` | `<role>::small.profile::all` | `update` (own profile) |

## Screens

| Path | Permission | Shown when | Actions from `access` |
| --- | --- | --- | --- |
| `/small/published` | `small.notes::read-only` | `find` true (anonymous) | table |
| `/small/notes` | `small.notes::all` | any method true | table; Edit if `update`; Remove if `remove`; create form if `create` |
| `/small/tags` | `small.tags::all` | any method true | table; Remove if `remove`; create form if `create` |
| `/small/profile` | `small.profile::all` | any method true | own record; edit form if `update` |

Form fields are the keys of the records returned by `find` (server projection) minus `id`.

## Scenarios (tests/api.test.ts, tests/screens.test.ts, tests/types.test.ts)

| Scenario | Expected |
| --- | --- |
| anonymous `GET /notes/published` | 200, keys `id`, `title` |
| anonymous `GET /notes` | 403 `PERMISSION_NOT_ASSIGNED` |
| `mia` `GET /notes?select=id,title,pinned` | 200, `pinned` trimmed |
| `mia` `GET /notes` without select | 200, all four permitted fields |
| `mia` `DELETE /notes/n2` | 403 `METHOD_DISABLED` |
| `mia` `PATCH /notes/n2 { pinned: true }` | 403 `PROPERTIES_NOT_ALLOWED` fields `[pinned]`, store untouched |
| `mia` `PATCH /profile { bio }` | 403 `PROPERTIES_NOT_ALLOWED` |
| `eli` `DELETE /notes/n1` (pinned) | 403 `HOOK_ERROR` reasons `[Pinned notes cannot be removed]` |
| `eli` `POST /tags { label: 'idea' }` | 403 `HOOK_ERROR` reasons `[Tag label already exists]` |
| `eli` `GET /notes` | 200, full record (`*`) |
| `noah` `GET /tags` | 403 `PERMISSION_NOT_ASSIGNED` |
| `zed` `GET /me` | 200, empty access map; `GET /notes` 403 `PERMISSION_NOT_ASSIGNED` |
| `rook` any route | 403 `PERMISSION_ROLE_MISMATCH` |
| `ghost` any route | 401 `UNKNOWN_USER` |
| body `role`/`permissions` for `noah` | denial unchanged; for `mia` rejected as data fields |
| body not an object | 400 `INVALID_BODY` |
| `types.fixture.ts` | undeclared role, foreign prefix, `select` on update, missing `data`, grant with `enabled: false`, grant with `'*'` all rejected by `tsc` |
