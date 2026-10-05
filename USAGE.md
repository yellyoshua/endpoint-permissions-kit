# Using Endpoint Permissions Kit

## Registration and startup

Create a shared `Pkit` instance, register permissions across module files, and re-export the configured instance.

`pkit.ts`:

```ts
import Pkit from 'endpoint-permissions-kit';

export const pkit = new Pkit({
  roles: ['admin', 'staff', 'public'],
  cropper: false,
  reservedFields: [], // ["id", "updatedAt", "createdAt", "_v"]
});
```

`permissions.ts`:

```ts
import './modules/marketing/portals/permissions.js';
import './modules/marketing/dashboard/permissions.js';
import './modules/account/permissions.js';

export { pkit } from './pkit.js';
```

`modules/marketing/portals/permissions.js`:

```js
import { pkit } from '../../../pkit.js';

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

portalsAll.grantTo('staff::marketing.dashboard::all').registerActions({
  find: { enabled: true, properties: ['id', 'name', 'assetId'] },
});
```

`modules/marketing/dashboard/permissions.js`:

```js
import { pkit } from '../../../pkit.js';

const dashboard = pkit.module('marketing').module('dashboard').name('all');

dashboard.role('staff').registerActions({
  find: { enabled: true, properties: '*' },
});

dashboard.role('admin').registerActions({
  find: { enabled: true, properties: '*' },
});
```

## Validating requests

Validate incoming endpoint requests against the configured instance using session credentials from a trusted source.

`app.js`:

```js
import { pkit } from './permissions.js';

// Application session placeholder: values must come from a trusted session
const session = {
  role: 'staff',
  permissions: [
    'staff::marketing.dashboard::all' // [role]::[module]::[name]
  ],
  user: { id: 7 },
};

const { result } = await pkit.validate({
  action: 'marketing.portals',
  method: 'find', // find, update, create, remove
  role: session.role,
  permissions: session.permissions,
  data: {
    id: 1,
    name: 'Landing',
    assetId: 'a-7',
  },
  context: {
    user: session.user,
  },
});

if (result) {
  console.log(result.data);
}
```

## Permissions every user of a role holds

Routes such as logout or the user's own sessions are open to every user of a role. Register them with `assignToAllUsers()` instead of `.name(...)`: the identifier is `[role]::[module]::required`, your application never stores it, and `validate()` adds it for every user whose role registers actions on it.

`modules/account/permissions.js`:

```js
import { pkit } from '../../pkit.js';

const account = pkit.module('account');
const logout = account.module('logout').assignToAllUsers();
const sessions = account.module('sessions').assignToAllUsers();

logout.role('staff').registerActions({
  create: { enabled: true, properties: [] },
});

logout.role('admin').registerActions({
  create: { enabled: true, properties: [] },
});

sessions.role('staff').registerActions({
  find: { enabled: true, properties: ['userId'] },
});

function checkOwnSessions(data, context) {
  if (data.userId !== context.user.id) {
    throw new Error('Only your own sessions can be listed');
  }
}

sessions.role('staff').hook('find', checkOwnSessions);
```

`app.js`:

```js
const { result } = await pkit.validate({
  action: 'account.sessions',
  method: 'find',
  role: session.role,
  permissions: session.permissions,
  data: { userId: session.user.id },
  context: { user: session.user },
});
```

A stored name of the same module, such as `staff::account.sessions::all`, replaces `required` for that user. To stop storing existing rows: register `assignToAllUsers()` next to the old name and copy its hooks, deploy, delete the stored rows, then remove the old name.

`required` names are never stored: a stored `staff::account.sessions::required` row fails with `UNKNOWN_PERMISSION`, and the `permissions` argument of hooks holds only the stored identifiers.

## Permissions reached only through a grant

A name can have grants and no `registerActions` for any role. Holders of the source permission reach it; nobody can be assigned it, so `staff::marketing.reports::all` below is `UNKNOWN_PERMISSION` when stored and is absent from every view.

```js
const reports = pkit.module('marketing').module('reports').name('all');

reports.grantTo('staff::marketing.dashboard::all').registerActions({
  find: { enabled: true, properties: ['id', 'title', 'ownerId'] },
});

function checkReportOwner(data, context) {
  if (data.ownerId !== context.user.id) {
    throw new Error('Only your own reports can be read');
  }
}

reports.hook('find', checkReportOwner);
```

A staff user who stores `staff::marketing.dashboard::all` passes `validate()` on `marketing.reports` `find` with the fields of the grant, and its hooks run with the stored identifiers.

## Listing the permissions of a role

`pkit.permissions.forRole(role)` lists every permission registered for a role as a module tree, for example to build an admin screen that assigns permissions. It is the catalog of what can be assigned, not what a user can do: use `validate()` for effective access. `pkit.permissions.forUser()` lists only the identifiers the user has stored, with the methods each one enables; access received through `required` or a grant appears only in `validate()`. Names registered with `assignToAllUsers()` and names that only have grants are left out: nobody assigns them.

`roles-screen.js`:

```js
import { pkit } from './permissions.js';

const { modules } = pkit.permissions.forRole('staff');
```

With the registrations above, `modules` is:

```js
[
  {
    name: 'marketing',
    identifier: 'marketing',
    actions: [],
    modules: [
      {
        name: 'portals',
        identifier: 'portals',
        actions: [
          { name: 'all', identifier: 'all', resourceName: 'staff::marketing.portals::all' },
          { name: 'update-only', identifier: 'update-only', resourceName: 'staff::marketing.portals::update-only' },
        ],
      },
      {
        name: 'dashboard',
        identifier: 'dashboard',
        actions: [
          { name: 'all', identifier: 'all', resourceName: 'staff::marketing.dashboard::all' },
        ],
      },
    ],
  },
]
```
