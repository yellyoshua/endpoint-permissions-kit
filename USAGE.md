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

## Listing the permissions of a role

`pkit.permissions.forRole(role)` lists every permission registered for a role as a module tree, for example to build an admin screen that assigns permissions. It is the catalog of what can be assigned, not what a user can do: use `pkit.permissions.forUser()` or `validate()` for effective access.

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
