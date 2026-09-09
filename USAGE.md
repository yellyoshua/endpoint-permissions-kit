Los archivos de permisos se llegan a cargar a nivel raiz del donde se encuentra el index, generalmente se lo hace desde un archivo main.js. De esa forma se precargan los permisos en memoria y genera un árbol de permisos que puede ser accedido desde cualquier parte de la aplicación con la libreria.

Todo está precargardo de manera que la librería pueda ser usada en cualquier parte de la aplicación sin necesidad de precargar los permisos nuevamente. La libreria contiene un método `pkit.permissions.all = {}`, este método devuelve un objeto que contiene todos los permisos de la aplicación, agrupados por rol. Es configuración del sistema, de solo lectura: describe cómo está organizada la autorización, no qué puede hacer el usuario de la petición en curso.

```js
pkit.permissions.all = {
    'admin': {
        'module.submodule.action.find':   { enabled: true, properties: [] },
        'module.submodule.action.update': { enabled: true, properties: [] },
        'module.submodule.action.create': { enabled: true, properties: [] },
        'module.submodule.action.remove': { enabled: true, properties: [] }
    },
    'staff': {
        'module.submodule.action.find':   { enabled: true,  properties: [] },
        'module.submodule.action.update': { enabled: true,  properties: [] },
        'module.submodule.action.create': { enabled: false, properties: [] },
        'module.submodule.action.remove': { enabled: false, properties: [] }
    }
    ...
}
```

Para el cliente existe la vista materializada de un solo rol. El cliente nunca conoce el catálogo completo ni el nombre de otros roles: recibe un mapa plano y responde con una sola lectura. Un path ausente es `false`.

```js
pkit.permissions.forRole('staff') = {
    'module.submodule.action.find':   true,
    'module.submodule.action.update': true,
    'module.submodule.action.create': false,
    'module.submodule.action.remove': false
    ...
}
```

Los roles se declaran en un archivo de configuración propio. Tiene que ser un módulo aparte porque ESM evalúa todos los imports antes del cuerpo del archivo que los importa: poner `pkit.context.set` arriba de los imports en `app.js` no adelanta su ejecución.

```js
// path: pkit.config.js
import pkit from 'permission-lib-name';

// Un usuario tiene exactamente un rol. No hay unión de roles.
// Si nunca se llama, el catálogo queda en ['general'].
// 'general' es el destino de los registerActions sin .role(), solo hace falta mientras existan.
pkit.context.set('roles', ['general', 'admin', 'staff', 'public']);
```

Para ejecutar todas las capas de un permiso se manda a llamar de la siguiente forma:

```js
import pkit from 'permission-lib-name';

const { result, errors } = await pkit.validate({
    action: 'module.submodule.action', // permiso base. debe existir en pkit.permissions
    method: 'update', // 'find' | 'update' | 'create' | 'remove'
    role: 'staff', // rol del usuario. debe existir en el catálogo. resolver siempre desde la sesión, nunca desde el request
    select: ['id', 'name'], // solo en find. si se omite, se toma select = properties
    data: {
        id: 1,
        name: 'Test',
        description: 'Test',
        owner: 1,
        status: 'draft'
    },
    context: {
        user: {
            id: 1,
            name: 'Test'
        }
    }
});

// errors vacío = pasó. result es null cuando errors tiene algo.
// result en find    = el select efectivo, para que el handler consulte con él.
// result en el resto = la data recortada a properties.
```

El orden de resolución corta en el primer paso que falla: rol conocido, permiso registrado para ese rol, método habilitado, campos, hooks. Sin registro explícito no hay permiso: la ausencia deniega.

Para definir los permisos de un modulo se lo realiza desde un archivo de permisos, por lo general se encuentra en la misma carpeta del modulo. El eslabón `.role()` es opcional y va antes de `registerActions`:

```js
// path: modules/marketing/portals/portals.permissions.js
import pkit from 'permission-lib-name';

const portals = pkit.module('marketing').module('portals');

portals.role('admin').registerActions({
    find: {
        properties: ['id', 'name', 'link', 'description', 'owner', 'status'],
        enabled: true,
    },
    update: {
        properties: ['id', 'name', 'link', 'description', 'status'],
        enabled: true,
    },
    create: {
        properties: ['name', 'link', 'description', 'status'],
        enabled: true,
    },
    remove: {
        properties: ['id'],
        enabled: true,
    }
});

portals.role('staff').registerActions({
    find: {
        properties: ['id', 'name', 'link', 'description'],
        enabled: true,
    },
    update: {
        properties: ['id', 'name', 'description'],
        enabled: true,
    },
    create: {
        properties: [],
        enabled: false,
    },
    remove: {
        properties: [],
        enabled: false,
    }
});

// Un rol que no aparece en el módulo no hereda nada. No hay rol base ni extends.
portals.role('public').registerActions({
    find:   { properties: ['id', 'name', 'link'], enabled: true },
    update: { properties: [], enabled: false },
    create: { properties: [], enabled: false },
    remove: { properties: [], enabled: false }
});

// Sin .role() el destino es 'general'.
// portals.registerActions({...}) === portals.role('general').registerActions({...})
```

`properties` se compara siempre igual: lo que se pide debe ser subconjunto de lo declarado. En `find` aplica sobre `select` y filtra la salida; en `update`, `create` y `remove` aplica sobre las keys de `data`, y es lo que impide que mandar `owner` o `status` en el body los cuele.

`properties: '*'` es un string, no un array. Desactiva la evaluación de campos para ese método: cualquier campo pasa, tanto en `select` como en `data`.

```js
portals.role('admin').registerActions({
    find:   { properties: '*',  enabled: true }, // devuelve todos los campos, sin evaluar
    update: { properties: '*',  enabled: true }, // acepta cualquier key del body
    ...
});
```

`registerActions` valida en el momento del registro solo lo que puede saber: que el rol exista en el catálogo, que el destino no se haya registrado antes, y la forma del literal. Si el rol no existe, lanza y la app no arranca:

```text
PkitError: role "admin" no está declarado. Roles disponibles: general.
¿Falta pkit.context.set('roles', [...]) en pkit.config.js, o se importó antes que este archivo?
```

Los hooks tienen las dos formas. Sin `.role()` son globales al permiso y corren para cualquier rol; con `.role()` corren solo para ese rol. Un rol no puede anular un hook global: si una regla necesita excepción por rol, no es global.

```js
// path: modules/marketing/portals-admin/permissions.js
import pkit from 'permission-lib-name';

const portalsAdmin = pkit.module('marketing').module('portals-admin');

portalsAdmin.role('admin').registerActions({
    find: {
        properties: ['id','name', 'link', 'description', 'owner', 'status'],
        enabled: true,
    },
    update: {
        properties: ['id', 'name', 'link', 'description', 'status'],
        enabled: true,
    },
    create: {
        properties: ['id', 'name', 'link', 'description', 'status'],
        enabled: true,
    },
    remove: {
        properties: ['id'],
        enabled: true,
    }
});

portalsAdmin
// Se puede repetir el mismo metodo para agregar mas restricciones a un mismo permiso. Esto se ejecuta una vez valide que se tenga el permiso y que las acciones esten habilitadas. Si alguna de estas no se cumple no se ejecuta el hook. Si el hook lanza un error se detiene el proceso y devuelve el error. Todas las funciones de el hook se ejecutan en paralelo y el resultado final es la union de todos los resultados.
// Global: invariante del recurso, independiente de quién pide.
.hook('remove', (data, context, permissions) => {
    if (data.status === 'published') {
        throw new Error('Portal is published, cannot remove');
    }
})
.hook('update', (data, context, permissions) => {
    if (data.status === 'published') {
        throw new Error('Portal is published, cannot update');
    }
});

// Por rol: "solo borras lo tuyo" es del rol, no del recurso. Declarado global bloquearía también al admin.
portalsAdmin.role('staff')
.hook('remove', (data, context, permissions) => {
    if (data.owner !== context.user.id) {
        throw new Error('You do not have permission to remove this portal');
    }
})
.hook('update', (data, context, permissions) => {
    if (data.owner !== context.user.id) {
        throw new Error('You do not have permission to update this portal');
    }
});

// permissions es el permiso ya resuelto para el rol de la petición:
// { role: 'staff', action: 'marketing.portals-admin', method: 'remove', enabled: true, properties: ['id'] }
```

```js
// path: modules/marketing/portals/route.js
import pkit from 'permission-lib-name';
import abstractRoute from '@/core/route.js';

export const portalsRoute = abstractRoute({
    // body|query = request.body | request.query
    // options = request.query (page, perPage, sort, etc...)
    // params = {user, permissions, session}
    // el rol sale de params.session, nunca del body ni del query
    handler: {
        find: (query, options, params) => {
        },
        create: (body, options, params) => {
        },
        update: (body, options, params) => {
        },
        remove: (query, options, params) => {
        }
    },
    permissions: 'marketing.portals'
})
```

```js
// path: modules/marketing/portals-admin/route.js
import pkit from 'permission-lib-name';
import abstractRoute from '@/core/route.js';

export const portalsAdminRoute = abstractRoute({
    // body|query = request.body | request.query
    // options = request.query (page, perPage, sort, etc...)
    // params = {user, permissions, session}
    handler: {
        find: (query, options, params) => {
        },
        create: (body, options, params) => {
        },
        update: (body, options, params) => {
        },
        remove: (query, options, params) => {
        }
    },
    permissions: 'marketing.portals-admin'
});
```

El orden de `app.js` importa: la config va primero para que los archivos de permisos vean el catálogo de roles al registrarse.

```js
// app.js
import pkit from 'permission-lib-name'
import './pkit.config.js';                                  // 1. catálogo de roles disponible

import './modules/marketing/portals/permissions.js';        // 2. los registros ya ven el catálogo
import './modules/marketing/portals-admin/permissions.js';

import { portalsRoute } from './modules/marketing/portals/route.js';
import { portalsAdminRoute } from './modules/marketing/portals-admin/route.js';

// 3. cierra el registro, valida el conjunto y materializa los mapas por rol.
// registerActions solo ve su propio módulo; la cobertura de roles y la coherencia
// ruta <-> permiso solo se pueden comprobar cuando terminó de registrarse todo.
// Cualquier registerActions o hook posterior a seal() lanza.
pkit.seal();
```

```js
// routes.js
export const routes = {
    'portals': portalsRoute,
    'portals-admin': portalsAdminRoute
}
```
