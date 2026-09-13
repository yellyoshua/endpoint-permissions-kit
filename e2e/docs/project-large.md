# project-large: light ERP

Prefix `large`. Four root domains (`inventory`, `sales`, `billing`, `hr`), six modules with submodules up to three levels below the prefix, six roles, three names in `sales.orders`, seven grants (two towards the same name, one cycle), hooks in the three scopes, no anonymous identity (missing header → `401 UNKNOWN_USER`).

## Simulated users

| id | role | permissions |
| --- | --- | --- |
| `ada` | `admin` | `admin::large.hr.employees::accounts`, `admin::large.hr.employees::all`, `admin::large.inventory.items::all`, `admin::large.inventory.warehouses.stock::all`, `admin::large.sales.orders::all`, `admin::large.sales.orders.lines::all`, `admin::large.billing.invoices::all` |
| `max` | `manager` | `manager::large.sales.orders::summary`, `manager::large.sales.orders::all`, `manager::large.hr.employees::all` (items and invoices reached by grant) |
| `meg` | `manager` | `manager::large.inventory.items::all`, `manager::large.sales.orders::summary` (items direct wins over the summary grant) |
| `wes` | `warehouse` | `warehouse::large.inventory.items::all` (stock reached by grant) |
| `wil` | `warehouse` | `warehouse::large.inventory.items::all`, `warehouse::large.inventory.warehouses.stock::all` |
| `sam` | `sales` | `sales::large.sales.orders::all`, `sales::large.sales.orders::update-only` (lines by two grants, invoices by grant) |
| `sue` | `sales` | `sales::large.sales.orders::all`, `sales::large.sales.orders.lines::all` (lines direct, invoices by grant) |
| `cat` | `accountant` | `accountant::large.billing.invoices::all`, `accountant::large.sales.orders::summary` (orders `all` by grant) |
| `hal` | `hr` | `hr::large.hr.employees::all` |
| `nil` | `manager` | (empty) |
| `rex` | `sales` | `sales::large.sales.orders::all`, `admin::large.sales.orders::all` (injected row of another role) |

## Module tree

```text
large
├── inventory
│   ├── items                names: all
│   └── warehouses
│       └── stock            names: all          (3 levels below the prefix)
├── sales
│   └── orders               names: all, summary, update-only
│       └── lines            names: all          (3 levels below the prefix)
├── billing
│   └── invoices             names: all
└── hr
    └── employees            names: all, accounts
```

## Permission matrix

19 assignable identifiers (`permissions.named` filtered to `large.`).

| Identifier | find | create | update | remove |
| --- | --- | --- | --- | --- |
| `admin::large.inventory.items::all` | `*` | sku, name, price, cost | sku, name, price, cost | id |
| `warehouse::large.inventory.items::all` | id, sku, name | — | name | — |
| `manager::large.inventory.items::all` | id, sku, name, price | — | — | — |
| `admin::large.inventory.warehouses.stock::all` | `*` | itemId, warehouse, quantity | quantity, isLocked | — |
| `warehouse::large.inventory.warehouses.stock::all` | id, itemId, warehouse, quantity | — | quantity | — |
| `admin::large.sales.orders::all` | `*` | customer, total | customer, total, status | id |
| `sales::large.sales.orders::all` | id, customer, total, status, owner | customer, total | customer, total | — |
| `manager::large.sales.orders::all` | id, customer, total, status, owner | — | — | id |
| `manager::large.sales.orders::summary` | id, customer, total, status | — | — | — |
| `accountant::large.sales.orders::summary` | id, customer, total, status | — | — | — |
| `sales::large.sales.orders::update-only` | id, customer, status | — | status | — |
| `admin::large.sales.orders.lines::all` | `*` | orderId, sku, quantity, price | quantity, price | id |
| `sales::large.sales.orders.lines::all` | id, orderId, sku, quantity | orderId, sku, quantity, price | quantity | — |
| `admin::large.billing.invoices::all` | `*` | — | — | id |
| `accountant::large.billing.invoices::all` | id, orderId, amount, status, issuedAt | orderId, amount | status | — |
| `admin::large.hr.employees::all` | `*` | name, title, salary | name, title, salary | id |
| `hr::large.hr.employees::all` | id, name, title, salary | name, title, salary | salary | — |
| `manager::large.hr.employees::all` | id, name, title | — | — | — |
| `admin::large.hr.employees::accounts` | `*` | — | permissions | — |

## Grants

| Receiving name | Source identifier | Methods and fields | Exercises |
| --- | --- | --- | --- |
| `large.inventory.items::all` | `manager::large.sales.orders::summary` | find: id, sku, name | derived vs direct precedence (`max` vs `meg`) |
| `large.inventory.warehouses.stock::all` | `warehouse::large.inventory.items::all` | find: id, itemId, quantity; update: quantity | derived-only hook (`wes` vs `wil`) |
| `large.sales.orders::all` | `accountant::large.billing.invoices::all` | find: id, customer, total | cycle half B → A |
| `large.sales.orders.lines::all` | `sales::large.sales.orders::all` | find: id, orderId, sku, quantity | union with the next row |
| `large.sales.orders.lines::all` | `sales::large.sales.orders::update-only` | find: id, sku, price | union: `sam` gets id, orderId, sku, quantity, price; `grantedBy` sorted `[orders::all, orders::update-only]` |
| `large.billing.invoices::all` | `sales::large.sales.orders::all` | find: id, orderId, amount | cycle half A → B |
| `large.billing.invoices::all` | `manager::large.sales.orders::summary` | find: id, orderId, status | second grant towards invoices |

The cycle is `orders all ⇄ invoices all`: each grant resolves on its own. Grants are one hop: `meg` reaches items through summary but items does not enable the stock grant (`PERMISSION_NOT_ASSIGNED`).

## Hooks

| Scope | Registration | Method | Rule | Message |
| --- | --- | --- | --- | --- |
| module | `large.sales.orders` | `update` | `context.resource.status === 'closed'` denies (runs for `all` and `update-only`) | `Closed orders cannot be updated` |
| name | `large.sales.orders::all` | `update` | ownership: `context.resource.owner !== context.user.id` denies | `Only the owner can update this order` |
| name + role | `large.inventory.warehouses.stock::all` + `warehouse` | `update` | acts only when `permission.authorization.direct === false`; denies if `context.resource.isLocked` | `Derived access cannot update stock of a locked warehouse` |
| name + role | `large.sales.orders.lines::all` + `sales` | `find` | acts only when `direct === false` and the server passed `context.revealGrantSources: true` (route `/sales/orders/lines/sources`); throws the sorted `grantedBy` | `granted by: <id>, <id>` |

`sam PATCH /sales/orders/o2` (closed, owned by `sue`) fails the module hook and the name hook at once; `reasons` is `[closed, owner]` in registration order.

## Routes

| Method + route | Guard | Library method |
| --- | --- | --- |
| `GET /api/large/me` | identity | `permissions.forUser` |
| `GET /api/large/catalog` | `<role>::large.hr.employees::accounts` | `find` |
| `GET /api/large/hr/employees/accounts` | `<role>::large.hr.employees::accounts` | `find` (lists users with role and identifiers) |
| `PUT /api/large/users/:id/permissions` | `<role>::large.hr.employees::accounts` | `update` (data = body; only `permissions` allowed) |
| `GET /api/large/inventory/items` | `<role>::large.inventory.items::all` | `find` (`?select=a,b` trimmed) |
| `POST /api/large/inventory/items` | `<role>::large.inventory.items::all` | `create` |
| `PATCH /api/large/inventory/items/:id` | `<role>::large.inventory.items::all` | `update` |
| `DELETE /api/large/inventory/items/:id` | `<role>::large.inventory.items::all` | `remove` |
| `GET /api/large/inventory/warehouses/stock` | `<role>::large.inventory.warehouses.stock::all` | `find` |
| `POST /api/large/inventory/warehouses/stock` | `<role>::large.inventory.warehouses.stock::all` | `create` |
| `PATCH /api/large/inventory/warehouses/stock/:id` | `<role>::large.inventory.warehouses.stock::all` | `update` (context: user, resource) |
| `GET /api/large/sales/orders` | `<role>::large.sales.orders::all` | `find` |
| `POST /api/large/sales/orders` | `<role>::large.sales.orders::all` | `create` (owner = identity, status `open`) |
| `PATCH /api/large/sales/orders/:id` | `<role>::large.sales.orders::all` | `update` (context: user, resource) |
| `DELETE /api/large/sales/orders/:id` | `<role>::large.sales.orders::all` | `remove` (context: user, resource) |
| `GET /api/large/sales/orders/summary` | `<role>::large.sales.orders::summary` | `find` |
| `GET /api/large/sales/orders/status` | `<role>::large.sales.orders::update-only` | `find` |
| `PATCH /api/large/sales/orders/status/:id` | `<role>::large.sales.orders::update-only` | `update` (context: user, resource) |
| `GET /api/large/sales/orders/lines` | `<role>::large.sales.orders.lines::all` | `find` |
| `GET /api/large/sales/orders/lines/sources` | `<role>::large.sales.orders.lines::all` | `find` (context: `revealGrantSources: true`) |
| `POST /api/large/sales/orders/lines` | `<role>::large.sales.orders.lines::all` | `create` |
| `PATCH /api/large/sales/orders/lines/:id` | `<role>::large.sales.orders.lines::all` | `update` |
| `DELETE /api/large/sales/orders/lines/:id` | `<role>::large.sales.orders.lines::all` | `remove` |
| `GET /api/large/billing/invoices` | `<role>::large.billing.invoices::all` | `find` |
| `POST /api/large/billing/invoices` | `<role>::large.billing.invoices::all` | `create` |
| `PATCH /api/large/billing/invoices/:id` | `<role>::large.billing.invoices::all` | `update` |
| `DELETE /api/large/billing/invoices/:id` | `<role>::large.billing.invoices::all` | `remove` |
| `GET /api/large/hr/employees` | `<role>::large.hr.employees::all` | `find` |
| `POST /api/large/hr/employees` | `<role>::large.hr.employees::all` | `create` |
| `PATCH /api/large/hr/employees/:id` | `<role>::large.hr.employees::all` | `update` |
| `DELETE /api/large/hr/employees/:id` | `<role>::large.hr.employees::all` | `remove` |

`PUT /users/:id/permissions` order of checks: body shape (`{ permissions: string[] }`, else `400 INVALID_BODY`) → `authorizeWrite` with the whole body as `data` (extra keys → `403 PROPERTIES_NOT_ALLOWED`) → target user exists (`404 NOT_FOUND`) → every id has the target's role as prefix (`403 PERMISSION_ROLE_MISMATCH`, nothing saved) → every id exists in `permissions.named` (`403 UNKNOWN_PERMISSION`, nothing saved) → the list is replaced in the store and echoed back. The next request of that user is resolved with the new list.

## Screens

Nine screens, grouped by the shared navigation into `inventory`, `sales`, `billing`, `hr`. Eight are `ResourceScreen` instances (table, Edit/Remove buttons and create form driven by `session.can`); `accounts` is bespoke.

| Path | Permission | Shown when | Actions from `access` |
| --- | --- | --- | --- |
| `/large/items` | `large.inventory.items::all` | any method true | table; Edit if `update`; Remove if `remove`; create form if `create` |
| `/large/stock` | `large.inventory.warehouses.stock::all` | any method true | table; Edit if `update`; create form if `create` |
| `/large/orders` | `large.sales.orders::all` | any method true | table; Edit / Remove / create form |
| `/large/orders-summary` | `large.sales.orders::summary` | `find` true | table only |
| `/large/orders-status` | `large.sales.orders::update-only` | any method true | table; Edit if `update` |
| `/large/lines` | `large.sales.orders.lines::all` | any method true | table; Edit / Remove / create form |
| `/large/invoices` | `large.billing.invoices::all` | any method true | table; Edit / Remove / create form |
| `/large/employees` | `large.hr.employees::all` | any method true | table; Edit / Remove / create form |
| `/large/accounts` | `large.hr.employees::accounts` | any method true | lists users from `/hr/employees/accounts`; loads `/catalog`; one checkbox per assignable id of the user's role; Save calls `PUT /users/:id/permissions` when `update` is true |

Form fields are the keys of the records returned by `find` (server projection) minus `id`.

## Scenarios (tests/api.test.ts, tests/screens.test.ts, tests/types.test.ts)

| Scenario | Expected |
| --- | --- |
| no header, any route | 401 `UNKNOWN_USER` |
| `ghost` any route | 401 `UNKNOWN_USER` |
| `max` `GET /inventory/items` | 200, keys `id, name, sku` (grant fields) |
| `meg` `GET /inventory/items` | 200, keys `id, name, price, sku` (direct wins) |
| `max` `PATCH /inventory/items/i1` | 403 `METHOD_DISABLED` (grant only concedes find) |
| `meg` `GET /inventory/warehouses/stock` | 403 `PERMISSION_NOT_ASSIGNED` (one hop) |
| `sam` `GET /sales/orders/lines` | 200, union `id, orderId, price, quantity, sku` |
| `sue` `GET /sales/orders/lines` | 200, direct `id, orderId, quantity, sku` |
| `sam` `GET /sales/orders/lines/sources` | 403 `HOOK_ERROR` reasons `[granted by: sales::large.sales.orders::all, sales::large.sales.orders::update-only]` |
| `sue` / `ada` `GET /sales/orders/lines/sources` | 200 (direct access, hook does not act) |
| `cat` `GET /sales/orders` | 200, keys `customer, id, total` (cycle B → A) |
| `sam` `GET /billing/invoices` | 200, keys `amount, id, orderId` (cycle A → B) |
| `wes` `GET /inventory/items?select=id,sku,cost,secret` | 200, keys `id, sku` (trimmed silently) |
| `wil` / `ada` `GET /inventory/warehouses/stock` | 200, all permitted fields / full record (`*`) |
| `sam` `PATCH /sales/orders/o2 { total }` | 403 `HOOK_ERROR` reasons `[Closed…, Only the owner…]` |
| `sam` `PATCH /sales/orders/o3 { total }` | 403 `HOOK_ERROR` reasons `[Only the owner…]` |
| `sam` `PATCH /sales/orders/status/o2 { status }` | 403 `HOOK_ERROR` reasons `[Closed…]` (name hook of `all` does not run) |
| `sam` `PATCH /sales/orders/status/o1 { status }` | 200 |
| `sam` `PATCH /sales/orders/o1 { status }` | 403 `PROPERTIES_NOT_ALLOWED` fields `[status]` |
| `ada` `PATCH /sales/orders/o1 { total }` | 403 `HOOK_ERROR` (admin is not the owner) |
| `wes` `PATCH /inventory/warehouses/stock/s2` | 403 `HOOK_ERROR` reasons `[Derived access…]` |
| `wil` `PATCH /inventory/warehouses/stock/s2` | 200 (direct access, hook returns) |
| `wes` `PATCH /inventory/items/i1 { price }` | 403 `PROPERTIES_NOT_ALLOWED` |
| `ada` `POST /billing/invoices` | 403 `METHOD_DISABLED` |
| `ada` `PUT /users/sam/permissions [update-only]` | 200; `sam` `GET /sales/orders/lines` keys `id, price, sku`; `GET /billing/invoices` 403 `PERMISSION_NOT_ASSIGNED`; `GET /sales/orders` 403 |
| `ada` `PUT /users/sue/permissions [lines all]` | 200; lines still 200 (direct kept); invoices 403 `PERMISSION_NOT_ASSIGNED` |
| `ada` `PUT /users/sam/permissions [.., admin::…]` | 403 `PERMISSION_ROLE_MISMATCH`, store untouched |
| `ada` `PUT /users/sam/permissions [.., sales::…::nope]` | 403 `UNKNOWN_PERMISSION`, store untouched |
| `ada` `PUT /users/sam/permissions` with `permissions` not a string array, or missing | 400 `INVALID_BODY` |
| `ada` `PUT /users/sam/permissions { permissions, role }` | 403 `PROPERTIES_NOT_ALLOWED` |
| `ada` `PUT /users/ghost/permissions` | 404 `NOT_FOUND` |
| `ada` `PUT /users/rex/permissions [sales::…orders::all]` | 200; `rex` `GET /me` 200 with orders, lines and invoices |
| `max` `PUT /users/sam/permissions` | 403 `PERMISSION_NOT_ASSIGNED` |
| `ada` `GET /catalog` | 200, the 19 assignable ids of the prefix |
| `nil` `GET /me` | 200, empty access map; `GET /sales/orders` 403 `PERMISSION_NOT_ASSIGNED` |
| `rex` any route | 403 `PERMISSION_ROLE_MISMATCH` |
| body `role`/`permissions` for `sam` on items | denial unchanged; on orders rejected as data fields |
| body not an object | 400 `INVALID_BODY` |
| screens per user | `ada` 7 screens, `max` 5, `sam` 4, `hal` 1, `nil` 0 (see tests/screens.test.ts) |
| `types.fixture.ts` | undeclared role, foreign prefix, `select` on update, missing `data`, grant with `enabled: false`, grant with `'*'` all rejected by `tsc` |
