# project-medium: marketing

Prefix `medium`. Two root domains (`marketing`, `campaigns`), submodules of two levels, four roles, names `all` and `update-only` in the same module, three grants, hooks of module, name and name+role scope, `properties: '*'` in several roles. The `medium.marketing.*` definitions reproduce the USAGE.md example under the prefix; `medium.campaigns.assets` extends it for `analyst` and `intern`. No anonymous identity: a missing `x-user-id` answers `401`.

## Simulated users

| id | role | permissions | USAGE.md row |
| --- | --- | --- | --- |
| `ava` | `admin` | `admin::medium.marketing.dashboard::all` | 1, 5 |
| `ben` | `admin` | `admin::medium.marketing.dashboard::all`, `admin::medium.marketing.dashboard::settings`, `admin::medium.marketing.portals::all`, `admin::medium.campaigns.assets::all` | 2 |
| `sam` | `staff` | `staff::medium.marketing.dashboard::all` (listed as dashboard portal viewer) | 3, 6 |
| `tess` | `staff` | `staff::medium.marketing.dashboard::all` (not a dashboard portal viewer) | 3 (hook denies) |
| `cleo` | `staff` | `staff::medium.marketing.dashboard::all`, `staff::medium.marketing.portals::all` | 4 |
| `dev` | `staff` | `staff::medium.marketing.portals::update-only` | 7 |
| `eve` | `staff` | `staff::medium.marketing.portals::all` | 8 |
| `nil` | `admin` | (empty) | 9 |
| `mal` | `staff` | `staff::medium.marketing.dashboard::all`, `admin::medium.marketing.portals::all` (injected row) | 10 |
| `old` | `staff` | `staff::medium.marketing.portals::legacy` (name no longer exists) | 11 |
| `ana` | `analyst` | `analyst::medium.marketing.dashboard::all`, `analyst::medium.campaigns.assets::all` | — |
| `ian` | `intern` | `intern::medium.campaigns.assets::update-only` | — |

`dev` owns portal `p1` (draft); `cleo` owns `p2` (published). Asset `a1` is draft, `a2` is published.

## Module tree

```text
medium
├── marketing
│   ├── portals      names: all, update-only
│   └── dashboard    names: all, settings
└── campaigns
    └── assets       names: all, update-only
```

## Permission matrix

Direct definitions (assignable identifiers, 10 in `permissions.named`):

| Identifier | find | create | update | remove |
| --- | --- | --- | --- | --- |
| `staff::medium.marketing.portals::all` | id, name, assetId | — | — | — |
| `admin::medium.marketing.portals::all` | `*` | — | — | id |
| `staff::medium.marketing.portals::update-only` | id, name, assetId | — | id, name, assetId | — |
| `staff::medium.marketing.dashboard::all` | `*` | — | — | — |
| `admin::medium.marketing.dashboard::all` | `*` | — | — | — |
| `analyst::medium.marketing.dashboard::all` | `*` | — | — | — |
| `admin::medium.marketing.dashboard::settings` | `*` | — | — | — |
| `admin::medium.campaigns.assets::all` | `*` | title, campaign, status | title, campaign, status | id |
| `analyst::medium.campaigns.assets::all` | id, title, campaign, status | — | — | — |
| `intern::medium.campaigns.assets::update-only` | id, title, campaign | — | title | — |

Grants (one hop, `enabled: true`, explicit lists):

| Receiver | `grantTo` | Block |
| --- | --- | --- |
| `medium.marketing.portals::all` | `admin::medium.marketing.dashboard::all` | find: id, name, assetId |
| `medium.marketing.portals::all` | `staff::medium.marketing.dashboard::all` | find: id, name, assetId |
| `medium.marketing.portals::update-only` | `staff::medium.marketing.dashboard::all` | find: id, name, assetId |
| `medium.marketing.portals::update-only` | `admin::medium.marketing.dashboard::all` | find: id, name, assetId |

The fourth grant is not in the USAGE.md example code but is required for its table row 5 (`admin`, only dashboard → portals `update-only` find succeeds "without `portalsUpdateOnly.role('admin')`"); the "Concesiones" section describes exactly this grant as valid.

Hooks:

| Scope | Registration | Method | Rule | Message |
| --- | --- | --- | --- | --- |
| module | `portals.hook` | `remove` | `context.resource.status === 'published'` denies | `Published portals cannot be removed` |
| name | `assets.name('update-only').hook` | `update` | `context.resource.status === 'published'` denies | `Published assets cannot be edited` |
| name + role | `portalsUpdateOnly.role('staff').hook` | `update` | `context.resource.owner !== context.user.id` denies | `Only the owner can update this portal` |
| name + role | `portalsAll.role('staff').hook` | `find` | only when `permission.authorization.grantedBy` includes `staff::medium.marketing.dashboard::all`; denies unless `context.allowDashboardPortalAccess === true` (server computes it from the store's dashboard portal viewer list) | `Portal access from dashboard is not allowed` |

## Routes

| Method + route | Guard | Library method |
| --- | --- | --- |
| `GET /api/medium/me` | identity | `permissions.forUser` |
| `GET /api/medium/catalog` | `<role>::medium.marketing.dashboard::settings` | `find` |
| `GET /api/medium/marketing/dashboard` | `<role>::medium.marketing.dashboard::all` | `find` |
| `GET /api/medium/marketing/portals` | `<role>::medium.marketing.portals::all` | `find` (context: user, allowDashboardPortalAccess; `?select=a,b` trimmed) |
| `DELETE /api/medium/marketing/portals/:id` | `<role>::medium.marketing.portals::all` | `remove` (context: user, resource) |
| `GET /api/medium/marketing/portals/editable` | `<role>::medium.marketing.portals::update-only` | `find` |
| `PATCH /api/medium/marketing/portals/editable/:id` | `<role>::medium.marketing.portals::update-only` | `update` (context: user, resource) |
| `GET /api/medium/campaigns/assets` | `<role>::medium.campaigns.assets::all` | `find` |
| `POST /api/medium/campaigns/assets` | `<role>::medium.campaigns.assets::all` | `create` |
| `PATCH /api/medium/campaigns/assets/:id` | `<role>::medium.campaigns.assets::all` | `update` |
| `DELETE /api/medium/campaigns/assets/:id` | `<role>::medium.campaigns.assets::all` | `remove` |
| `GET /api/medium/campaigns/assets/editable` | `<role>::medium.campaigns.assets::update-only` | `find` |
| `PATCH /api/medium/campaigns/assets/editable/:id` | `<role>::medium.campaigns.assets::update-only` | `update` (context: user, resource) |

## Screens

| Path | Permission | Shown when | Actions from `access` |
| --- | --- | --- | --- |
| `/medium/dashboard` | `medium.marketing.dashboard::all` | `find` true | widget table plus the portal table returned by `GET /marketing/portals`; its columns are the server projection, so a grant-only user (`ava`, `sam`) sees `id, name, assetId` and a direct admin (`ben`) sees the full record; a hook denial (`tess`) shows the error |
| `/medium/portals` | `medium.marketing.portals::all` | any method true | table; Remove if `remove` |
| `/medium/portals-editable` | `medium.marketing.portals::update-only` | any method true | table; Edit form if `update` |
| `/medium/assets` | `medium.campaigns.assets::all` | any method true | table; Edit if `update`; Remove if `remove`; create form if `create` |
| `/medium/assets-editable` | `medium.campaigns.assets::update-only` | any method true | table; Edit form if `update` |

Form fields are the keys of the records returned by `find` (server projection) minus `id`.

## Scenarios (tests/api.test.ts, tests/screens.test.ts, tests/types.test.ts)

Rows marked USAGE are the eleven literal rows of the table "Con las definiciones del ejemplo".

| Scenario | Expected |
| --- | --- |
| USAGE 1: `ava` `GET /marketing/portals` | 200, keys `id, name, assetId`; admin `*` does not participate |
| USAGE 2: `ben` `GET /marketing/portals` | 200, full record (`*`, direct wins) |
| USAGE 3: `sam` `GET /marketing/portals` | 200, three grant fields; `tess` same route 403 `HOOK_ERROR` `[Portal access from dashboard is not allowed]` (staff hook runs on granted access) |
| USAGE 4: `cleo` `GET /marketing/portals` | 200, direct staff fields `id, name, assetId`; hook does not act (`grantedBy` empty) |
| USAGE 5: `ava` `GET /marketing/portals/editable` | 200, three fields, no admin definition of `update-only` |
| USAGE 6: `sam` `PATCH /marketing/portals/editable/p1` | 403 `METHOD_DISABLED` |
| USAGE 7: `dev` `PATCH /marketing/portals/editable/p1 { name, assetId }` | 200, both fields updated |
| USAGE 8: `eve` `GET /marketing/portals/editable` | 403 `PERMISSION_NOT_ASSIGNED` |
| USAGE 9: `nil` `GET /me` / `GET /marketing/portals` | 200 empty access map / 403 `PERMISSION_NOT_ASSIGNED` |
| USAGE 10: `mal` every route incl. `/me` and `/catalog` | 403 `PERMISSION_ROLE_MISMATCH` |
| USAGE 11: `old` every route incl. `/me` and `/catalog` | 403 `UNKNOWN_PERMISSION` |
| `ava` `GET /marketing/portals?select=id,name,internalNotes` | 200, `internalNotes` trimmed |
| `ben` `GET /marketing/portals?select=id,status` | 200, `[{ id, status }]` (wildcard honours select) |
| `ben` `DELETE /marketing/portals/p2` (published) | 403 `HOOK_ERROR` `[Published portals cannot be removed]`, store untouched |
| `ben` `DELETE /marketing/portals/p1` | 204 |
| `dev` `PATCH /marketing/portals/editable/p2` (owner `cleo`) | 403 `HOOK_ERROR` `[Only the owner can update this portal]` |
| `dev` `PATCH /marketing/portals/editable/p1 { owner, name, status }` | 403 `PROPERTIES_NOT_ALLOWED` fields `[owner, status]`, store untouched |
| `ian` `PATCH /campaigns/assets/editable/a2` (published) | 403 `HOOK_ERROR` `[Published assets cannot be edited]` |
| `ian` `PATCH /campaigns/assets/editable/a1 { status }` | 403 `PROPERTIES_NOT_ALLOWED` |
| `ana` `POST /campaigns/assets` with body `role`/`permissions` | 403 `METHOD_DISABLED` unchanged |
| `ben` `POST /campaigns/assets` with body `role`/`permissions` | 403 `PROPERTIES_NOT_ALLOWED` fields `[role, permissions]` |
| `ben` `POST /campaigns/assets { ...ASSET_BODY, budget }` | 403 `PROPERTIES_NOT_ALLOWED` |
| dashboard `find` for `ava`, `sam`, `ana` | 200, full widget (`*`) |
| `ana` `GET /campaigns/assets` / `ian` `GET /campaigns/assets/editable` | keys `id, title, campaign, status` / `id, title, campaign` |
| `sam` `GET /me` | access map equal to the USAGE.md `forUser` example under the prefix |
| `ben` `GET /catalog` | the 10 assignable ids of the prefix |
| no header / `ghost` | 401 `UNKNOWN_USER` |
| body not an object | 400 `INVALID_BODY` |
| screens per user | `ava`/`sam`/`cleo`: dashboard, portals, portals-editable; `ben`: + assets; `dev`: portals-editable with update; `eve`: portals; `nil`: none; `ana`: dashboard, assets; `ian`: assets-editable with update; `mal`/`old`: `/me` 403 |
| `types.fixture.ts` | undeclared role, foreign prefix, `select` on update, missing `data`, grant with `enabled: false`, grant with `'*'` all rejected by `tsc` |
