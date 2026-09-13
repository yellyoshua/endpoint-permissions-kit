# project-extra-large: multi-area platform

Prefix `xl`. Six root domains, one module four levels below the prefix (`xl.crm.accounts.contacts.notes`), eight roles (one anonymous), 30 assignable identifiers, 12 grants, nine hooks across the three scopes (sync and async), hot permission administration, startup fixtures in a child process and a concurrency test.

## Simulated users

| id | role | permissions |
| --- | --- | --- |
| anonymous (no header) | `public` | `public::xl.content.pages::published` |
| `olivia` | `owner` | `owner::xl.platform.tenants.settings::all`, `owner::xl.platform.tenants.members::all`, `owner::xl.support.tickets.replies::all`, `owner::xl.finance.ledger.entries::all`, `owner::xl.content.pages.blocks::all`, `owner::xl.analytics.reports::all` (6) |
| `oscar` | `owner` | `owner::xl.platform.tenants.settings::all` (reaches members and ledger summary only by grant) |
| `adam` | `admin` | `admin::xl.platform.tenants.settings::all`, `admin::xl.platform.tenants.members::all`, `admin::xl.crm.accounts.contacts.notes::all`, `admin::xl.support.tickets.replies::all`, `admin::xl.content.pages.blocks::all`, `admin::xl.analytics.reports::all` (6) |
| `ana` | `admin` | `admin::xl.platform.tenants.members::all` (reaches notes and replies only by grant) |
| `gus` | `agent` | `agent::xl.crm.accounts.contacts.notes::all`, `agent::xl.support.tickets.replies::all`, `agent::xl.analytics.reports::read-only` |
| `gia` | `agent` | `agent::xl.crm.accounts.contacts.notes::all`, `agent::xl.analytics.reports::read-only` (replies by the union of two grants) |
| `dupe` | `agent` | the two identifiers of `gia`, each repeated twice (deduplication) |
| `nina` | `analyst` | `analyst::xl.analytics.reports::all`, `analyst::xl.crm.accounts.contacts.notes::read-only`, `analyst::xl.finance.ledger.entries::summary` |
| `fin` | `finance` | `finance::xl.finance.ledger.entries::all`, `finance::xl.finance.ledger.entries::summary`, `finance::xl.analytics.reports::read-only` |
| `aria` | `author` | `author::xl.content.pages.blocks::all` (published pages only by grant) |
| `audrey` | `auditor` | `auditor::xl.platform.tenants.settings::all`, `auditor::xl.platform.tenants.members::all`, `auditor::xl.crm.accounts.contacts.notes::read-only`, `auditor::xl.support.tickets.replies::all`, `auditor::xl.finance.ledger.entries::all`, `auditor::xl.analytics.reports::read-only` (6) |
| `zero` | `author` | (empty) |
| `rook` | `agent` | `agent::xl.crm.accounts.contacts.notes::all`, `admin::xl.platform.tenants.members::all` (injected row of another role) |

## Module tree

```text
xl
├── platform
│   └── tenants
│       ├── settings        names: all
│       └── members         names: all
├── crm
│   └── accounts
│       └── contacts
│           └── notes       names: all, read-only      (4 levels below the prefix)
├── support
│   └── tickets
│       └── replies         names: all
├── finance
│   └── ledger
│       └── entries         names: all, summary
├── content
│   └── pages               names: published
│       └── blocks          names: all
└── analytics
    └── reports             names: all, read-only
```

## Permission matrix (30 assignable identifiers)

| Identifier | find | create | update | remove |
| --- | --- | --- | --- | --- |
| `owner::xl.platform.tenants.settings::all` | `*` | `*` | `*` | `*` |
| `admin::xl.platform.tenants.settings::all` | id, name, plan, locale | — | name, locale | — |
| `auditor::xl.platform.tenants.settings::all` | id, name, plan | — | disabled (`false`, `[]`) | disabled (`false`, `[]`) |
| `owner::xl.platform.tenants.members::all` | `*` | `*` | `*` | `*` |
| `admin::xl.platform.tenants.members::all` | id, email, role, tenantId | email, role, tenantId | — | id |
| `auditor::xl.platform.tenants.members::all` | id, email, role | disabled (`false`, `[]`) | — | — |
| `agent::xl.crm.accounts.contacts.notes::all` | id, contactId, body, author | contactId, body | body | — |
| `admin::xl.crm.accounts.contacts.notes::all` | `*` | — | — | id |
| `analyst::xl.crm.accounts.contacts.notes::read-only` | id, contactId, author | — | — | — |
| `auditor::xl.crm.accounts.contacts.notes::read-only` | id, contactId | — | — | — |
| `agent::xl.support.tickets.replies::all` | id, ticketId, body, author, internal | ticketId, body, internal | body | id |
| `admin::xl.support.tickets.replies::all` | `*` | — | — | id |
| `owner::xl.support.tickets.replies::all` | `*` | — | — | `*` |
| `auditor::xl.support.tickets.replies::all` | id, ticketId, author | — | disabled (`false`, `[]`) | disabled (`false`, `[]`) |
| `finance::xl.finance.ledger.entries::all` | `*` | amount, memo, account | memo | disabled (`false`, `[]`) |
| `owner::xl.finance.ledger.entries::all` | `*` | — | — | id |
| `auditor::xl.finance.ledger.entries::all` | id, amount, account | disabled (`false`, `[]`) | disabled (`false`, `[]`) | disabled (`false`, `[]`) |
| `analyst::xl.finance.ledger.entries::summary` | id, amount, account | — | — | — |
| `finance::xl.finance.ledger.entries::summary` | id, amount, account, memo | — | — | — |
| `public::xl.content.pages::published` | id, title, slug | — | — | — |
| `author::xl.content.pages::published` | id, title, slug, body | — | — | — |
| `author::xl.content.pages.blocks::all` | id, pageId, kind, text | pageId, kind, text | kind, text | id |
| `admin::xl.content.pages.blocks::all` | `*` | — | — | id |
| `owner::xl.content.pages.blocks::all` | `*` | `*` | `*` | `*` |
| `analyst::xl.analytics.reports::all` | `*` | title, query | title, query | id |
| `admin::xl.analytics.reports::all` | id, title, owner | — | — | — |
| `owner::xl.analytics.reports::all` | `*` | — | `*` | `*` |
| `auditor::xl.analytics.reports::read-only` | id, title | — | — | — |
| `finance::xl.analytics.reports::read-only` | id, title, owner | — | — | — |
| `agent::xl.analytics.reports::read-only` | id, title | — | — | — |

Roles with registered actions: `public`, `owner`, `admin`, `agent`, `analyst`, `finance`, `author`, `auditor` (8). `owner` uses `'*'` in several methods; `auditor` has empty disabled lists on every write it declares.

## Grants (12)

| Receiving name | Enabling identifier | Block | Exercises |
| --- | --- | --- | --- |
| `xl.platform.tenants.members::all` | `owner::xl.platform.tenants.settings::all` | find: id, email, role | direct precedence (`olivia` `*` vs `oscar` grant) |
| `xl.finance.ledger.entries::summary` | `owner::xl.platform.tenants.settings::all` | find: id, amount, account | second grant from the same origin |
| `xl.content.pages.blocks::all` | `admin::xl.platform.tenants.settings::all` | find: id, pageId, kind; remove: id | grant with two methods |
| `xl.crm.accounts.contacts.notes::all` | `admin::xl.platform.tenants.members::all` | find: id, contactId, author | `ana` reads notes without a direct row; `METHOD_DISABLED` on remove |
| `xl.support.tickets.replies::all` | `admin::xl.platform.tenants.members::all` | find: id, ticketId, author | role hook acting only when `direct === false` |
| `xl.support.tickets.replies::all` | `agent::xl.crm.accounts.contacts.notes::all` | find: id, ticketId, body | union of fields with the next row (`gia`) |
| `xl.support.tickets.replies::all` | `agent::xl.analytics.reports::read-only` | find: id, author | union of fields; `grantedBy` with two identifiers |
| `xl.crm.accounts.contacts.notes::read-only` | `agent::xl.support.tickets.replies::all` | find: id, contactId | one hop: `gia` (replies by grant) does not reach it, `gus` does |
| `xl.analytics.reports::all` | `finance::xl.finance.ledger.entries::all` | find: id, title | cycle A→B |
| `xl.finance.ledger.entries::all` | `analyst::xl.analytics.reports::all` | find: id, amount, account | cycle B→A |
| `xl.content.pages::published` | `author::xl.content.pages.blocks::all` | find: id, title, slug | `aria` reads published pages by grant only |
| `xl.platform.tenants.settings::all` | `auditor::xl.finance.ledger.entries::all` | find: id, name | grant toward the administrative name |

## Hooks

Module scope:

| Module | Method | Kind | Rule | Message |
| --- | --- | --- | --- | --- |
| `xl.platform.tenants.members` | `create` | synchronous | `context === undefined` denies (the `/import` variant omits it) | `Member invitations require a tenant context` |
| `xl.support.tickets.replies` | `create` | asynchronous | store lookup of `tickets` by `data.ticketId`: status `closed` denies | `Closed tickets do not accept replies` |
| `xl.finance.ledger.entries` | `remove` | synchronous | store lookup by `context.params.id`: `reconciled` denies | `Reconciled entries cannot be removed` |
| `xl.platform.tenants.settings` | `update` | synchronous, data validator | `data.name` present and blank denies | `Tenant name cannot be blank` |
| `xl.content.pages.blocks` | `create` | synchronous, data validator | `data.kind` missing or blank denies | `Block kind is required` |

Name scope:

| Name | Method | Kind | Rule | Message |
| --- | --- | --- | --- | --- |
| `xl.finance.ledger.entries::all` | `remove` | synchronous | store lookup by `context.params.id`: `amount > 10000` denies (fails together with the module hook on `le2`) | `Entries above the removal threshold cannot be removed` |
| `xl.crm.accounts.contacts.notes::all` | `update` | synchronous | store lookup by `context.params.id`, `author !== context.user.id` denies | `Only the author can edit a contact note` |
| `xl.analytics.reports::all` | `remove` | asynchronous | store lookup by `context.params.id`: `pinned` denies | `Pinned reports cannot be removed` |
| `xl.crm.accounts.contacts.notes::all` | `create` | synchronous, data validator | `data.body` missing or blank denies | `Note body is required` |

Name + role scope:

| Name and role | Method | Kind | Rule | Message |
| --- | --- | --- | --- | --- |
| `xl.platform.tenants.members::all`, `admin` | `remove` | synchronous | store lookup by `context.params.id`: member role `owner` denies | `Owner members cannot be removed by an admin` |
| `xl.finance.ledger.entries::all`, `finance` | `create` | asynchronous | `data.amount` missing or `<= 0` denies | `Entry amount must be positive` |
| `xl.support.tickets.replies::all`, `admin` | `find` | synchronous | only when `permission.authorization.direct === false` and `context.isInternalScope === true` | `Granted reply access excludes the internal scope` |

## Routes

| Method + route | Guard | Library method |
| --- | --- | --- |
| `GET /api/extra-large/me` | identity | `permissions.forUser` |
| `GET /api/extra-large/catalog` | `<role>::xl.platform.tenants.settings::all` | `find` |
| `PUT /api/extra-large/users/:id/permissions` | `<role>::xl.platform.tenants.settings::all` | `update` with `data: {}`; then `forUser` on the target to reject `PERMISSION_ROLE_MISMATCH`, `UNKNOWN_PERMISSION`, `INVALID_INPUT` before saving |
| `GET /api/extra-large/platform/tenants/settings` | `<role>::xl.platform.tenants.settings::all` | `find` (`?select=a,b` trimmed) |
| `POST /api/extra-large/platform/tenants/settings` | same | `create` |
| `PATCH /api/extra-large/platform/tenants/settings/:id` | same | `update`  |
| `DELETE /api/extra-large/platform/tenants/settings/:id` | same | `remove`  |
| `GET /api/extra-large/platform/tenants/members` | `<role>::xl.platform.tenants.members::all` | `find` |
| `POST /api/extra-large/platform/tenants/members` | same | `create` (context: user, tenantIds) |
| `POST /api/extra-large/platform/tenants/members/import` | same | `create` without context (module hook fails) |
| `PATCH /api/extra-large/platform/tenants/members/:id` | same | `update` |
| `DELETE /api/extra-large/platform/tenants/members/:id` | same | `remove`  |
| `GET /api/extra-large/crm/accounts/contacts/notes` | `<role>::xl.crm.accounts.contacts.notes::all` | `find` |
| `GET /api/extra-large/crm/accounts/contacts/notes/read-only` | `<role>::xl.crm.accounts.contacts.notes::read-only` | `find` |
| `POST /api/extra-large/crm/accounts/contacts/notes` | `…notes::all` | `create` |
| `PATCH /api/extra-large/crm/accounts/contacts/notes/:id` | `…notes::all` | `update`  |
| `DELETE /api/extra-large/crm/accounts/contacts/notes/:id` | `…notes::all` | `remove` |
| `GET /api/extra-large/support/tickets/replies[?scope=internal]` | `<role>::xl.support.tickets.replies::all` | `find` (context: isInternalScope) |
| `POST /api/extra-large/support/tickets/replies` | same | `create` (context: user, ticket from `data.ticketId`; unknown ticket → 404) |
| `PATCH /api/extra-large/support/tickets/replies/:id` | same | `update` |
| `DELETE /api/extra-large/support/tickets/replies/:id` | same | `remove` |
| `GET /api/extra-large/finance/ledger/entries` | `<role>::xl.finance.ledger.entries::all` | `find` |
| `GET /api/extra-large/finance/ledger/entries/summary` | `<role>::xl.finance.ledger.entries::summary` | `find` |
| `POST /api/extra-large/finance/ledger/entries` | `…entries::all` | `create` |
| `PATCH /api/extra-large/finance/ledger/entries/:id` | `…entries::all` | `update` |
| `DELETE /api/extra-large/finance/ledger/entries/:id` | `…entries::all` | `remove`  |
| `GET /api/extra-large/content/pages/published` | `<role>::xl.content.pages::published` | `find` |
| `GET /api/extra-large/content/pages/blocks` | `<role>::xl.content.pages.blocks::all` | `find` |
| `POST /api/extra-large/content/pages/blocks` | same | `create` |
| `PATCH /api/extra-large/content/pages/blocks/:id` | same | `update` |
| `DELETE /api/extra-large/content/pages/blocks/:id` | same | `remove` |
| `GET /api/extra-large/analytics/reports` | `<role>::xl.analytics.reports::all` | `find` |
| `GET /api/extra-large/analytics/reports/read-only` | `<role>::xl.analytics.reports::read-only` | `find` |
| `POST /api/extra-large/analytics/reports` | `…reports::all` | `create` |
| `PATCH /api/extra-large/analytics/reports/:id` | `…reports::all` | `update` |
| `DELETE /api/extra-large/analytics/reports/:id` | `…reports::all` | `remove`  |

Writes accept only string, number or boolean values; any other value shape is `400 INVALID_BODY`. Unknown keys are rejected by the library (`PROPERTIES_NOT_ALLOWED`), never discarded.

## Screens (12)

| Path | Permission | Shown when | Actions from `access` |
| --- | --- | --- | --- |
| `/extra-large/settings` | `xl.platform.tenants.settings::all` | any method true | table; Edit if `update`; Remove if `remove`; create form if `create` |
| `/extra-large/users` | `xl.platform.tenants.settings::all` (`update`) | `update` true | target user selector; checkbox list fed by `/catalog`; `PUT /users/:id/permissions` |
| `/extra-large/members` | `xl.platform.tenants.members::all` | any method true | table; Edit / Remove / create form per method |
| `/extra-large/notes` | `xl.crm.accounts.contacts.notes::all` | any method true | table; Edit / Remove / create form per method |
| `/extra-large/notes-read-only` | `xl.crm.accounts.contacts.notes::read-only` | `find` true | table |
| `/extra-large/replies` | `xl.support.tickets.replies::all` | any method true | table; Edit / Remove / create form per method |
| `/extra-large/entries` | `xl.finance.ledger.entries::all` | any method true | table; Edit / Remove / create form per method |
| `/extra-large/entries-summary` | `xl.finance.ledger.entries::summary` | `find` true | table |
| `/extra-large/published` | `xl.content.pages::published` | `find` true (anonymous) | table |
| `/extra-large/blocks` | `xl.content.pages.blocks::all` | any method true | table; Edit / Remove / create form per method |
| `/extra-large/reports` | `xl.analytics.reports::all` | any method true | table; Edit / Remove / create form per method |
| `/extra-large/reports-read-only` | `xl.analytics.reports::read-only` | `find` true | table |

The side menu is `visibleScreens(SCREENS, role, access)` grouped by the domain segment of `action` (platform, crm, support, finance, content, analytics); there is no hand-written route list beyond `SCREENS`. Eleven screens render the project-local `CollectionScreen` (list, create, edit, remove driven by `session.can`); form fields are the keys of the records returned by `find` minus `id`.

## Scenarios (tests/api.test.ts, tests/screens.test.ts, tests/types.test.ts, tests/startup.test.ts)

| Scenario | Expected |
| --- | --- |
| anonymous `GET /content/pages/published` | 200, keys `id`, `slug`, `title` |
| anonymous `GET /content/pages/blocks` | 403 `PERMISSION_NOT_ASSIGNED` |
| anonymous `GET /me` | `{ user: 'anonymous', role: 'public', access: { 'public::xl.content.pages::published': find only } }` |
| `olivia` `GET /platform/tenants/settings` | 200, full record including `apiKey` (`*`) |
| `adam` `GET /platform/tenants/settings?select=id,apiKey,name` | 200, `apiKey` trimmed |
| `adam` `PATCH /settings/tn1 { plan }` | 403 `PROPERTIES_NOT_ALLOWED`; store untouched |
| `adam` `POST /settings` | 403 `METHOD_DISABLED` |
| `audrey` `PATCH`/`DELETE /settings/tn1` | 403 `METHOD_DISABLED` (empty disabled lists) |
| `olivia` vs `oscar` `GET /platform/tenants/members` | direct `*` (5 keys) vs grant projection `email, id, role` |
| `oscar` `POST /members` | 403 `METHOD_DISABLED` (grant only concedes `find`) |
| `gia` `GET /support/tickets/replies` | 200, union `author, body, id, ticketId` from two grants |
| `gia` `GET /notes/read-only` | 403 `PERMISSION_NOT_ASSIGNED` (one hop) |
| `gus` `GET /notes/read-only` | 200, `contactId, id` (grant from replies) |
| `fin` `GET /analytics/reports` and `nina` `GET /finance/ledger/entries` | 200 both (valid cycle) |
| `fin` `/entries/summary` vs `/entries` | different projections (names do not merge) |
| `aria` `GET /content/pages/published` | 200 via the blocks grant |
| `olivia` `POST /members/import` | 403 `HOOK_ERROR` reasons `[Member invitations require a tenant context]` |
| `gus` `POST /replies { ticketId: 'tk2' }` | 403 `HOOK_ERROR` `[Closed tickets do not accept replies]` |
| `gus` `POST /replies { ticketId: 'tk9' }` | 404 `NOT_FOUND` |
| `olivia` `DELETE /entries/le2` | 403 `HOOK_ERROR` `[Reconciled…, Entries above…]` (module then name) |
| `olivia` `DELETE /entries/le3` | 403 `HOOK_ERROR` `[Reconciled entries cannot be removed]` |
| `gus` `PATCH /notes/cn2` | 403 `HOOK_ERROR` `[Only the author can edit a contact note]` |
| `nina`/`olivia` `DELETE /reports/rt1` | 403 `HOOK_ERROR` `[Pinned reports cannot be removed]` |
| `adam` `DELETE /members/mb1` vs `olivia` | 403 `HOOK_ERROR` `[Owner members…]` vs 204 (role hook) |
| `fin` `POST /entries { amount: 0 }` | 403 `HOOK_ERROR` `[Entry amount must be positive]` |
| `ana` vs `adam` `GET /replies?scope=internal` | 403 `HOOK_ERROR` `[Granted reply access…]` vs 200 (`direct === false`) |
| `dupe` `/me` and `/replies` | identical to `gia`; three access keys |
| `zero` `/me` | 200, empty access map |
| `rook` any route | 403 `PERMISSION_ROLE_MISMATCH` |
| `ghost` any route | 401 `UNKNOWN_USER` |
| body `role`/`permissions` for `ana` | denial unchanged; for `adam` rejected as data fields |
| body not an object / nested value | 400 `INVALID_BODY` |
| `adam` `PUT /users/zero/permissions [author blocks]` | 200; `zero` then reads blocks and published pages |
| `adam` `PUT /users/aria/permissions [author…, admin…]` | 403 `PERMISSION_ROLE_MISMATCH`; nothing saved |
| `adam` `PUT /users/zero/permissions [author::xl.content.pages::draft]` | 403 `UNKNOWN_PERMISSION` |
| `adam` `PUT /users/zero/permissions ['not-an-id']` | 400 `INVALID_INPUT` |
| `adam` `PUT /users/zero/permissions "string"` | 400 `INVALID_BODY` |
| `audrey` `PUT /users/zero/permissions` | 403 `METHOD_DISABLED` |
| `adam` `PUT /users/fin/permissions [summary only]` | `fin` loses reports (derived) but keeps summary (direct) |
| `/catalog` | ≥ 25 ids, all `xl.`, eight roles, no grant-only identities |
| 60 parallel `GET`s over the matrix rows | every status/code matches its row; wall time printed with `console.log` |
| `screens.test.ts` | per-user visible screens match the `/me` map; ≥ 12 screens across six domains |
| `types.fixture.ts` | undeclared role, foreign prefix, `select` on update, missing `data`, grant `enabled: false`, grant `'*'` all rejected by `tsc` |

## Startup fixtures (tests/startup/*.ts, spawned with `Bun.spawn(['bun', fixture], { cwd: e2e })`)

| Fixture | Broken registration | Code printed |
| --- | --- | --- |
| `duplicate-registration.ts` | second `registerActions` for `admin` on `settings::all` | `DUPLICATE_REGISTRATION` |
| `role-not-declared.ts` | `.role('owner')` with catalog `['admin']` | `ROLE_NOT_DECLARED` |
| `sealed.ts` | `registerActions` after `seal()` | `SEALED` |
| `name-without-actions.ts` | `settings.name('archive')` with only a hook, fails at `seal()` | `INVALID_DEFINITION` |
| `self-referencing-grant.ts` | `settings::all.grantTo('admin::xl.platform.tenants.settings::all')` | `INVALID_DEFINITION` |
| `grant-with-wildcard.ts` | grant block with `properties: '*'` (cast past the type) | `INVALID_DEFINITION` |
| `role-hook-without-path.ts` | `settings.role('auditor').hook('find')` without actions or grant for `auditor`, fails at `seal()` | `INVALID_DEFINITION` |
| `context-after-registration.ts` | `context.set('roles')` after a `registerActions` | `INVALID_DEFINITION` |
| `not-sealed.ts` | reads `permissions.named` before `seal()` | `NOT_SEALED` |
| `unknown-role.ts` | sealed registry, `validate` with a session role outside the catalog | `UNKNOWN_ROLE` |
| `unknown-action.ts` | sealed registry, `validate` on a module that was never registered | `UNKNOWN_ACTION` |
| `validation-error.ts` | sealed registry, `data` is a Proxy whose `ownKeys` throws; the unexpected failure is wrapped | `VALIDATION_ERROR` |

Plus `bunx pkit generate --check` spawned from `e2e/` exits 0.
