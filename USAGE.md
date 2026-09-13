# Uso de Endpoint Permissions Kit

## Modelo

Un permiso se identifica con tres componentes:

```text
[role]::[module]::[name]

staff::marketing.portals::all
staff::marketing.portals::update-only
admin::marketing.dashboard::all
```

El módulo identifica el recurso. El nombre distingue conjuntos de acciones sobre ese recurso. El rol identifica la variante del conjunto. Los métodos (`find`, `update`, `create`, `remove`) y sus propiedades se declaran con `registerActions`.

La librería separa tres conceptos:

| Concepto | Ejemplo | Qué significa |
| --- | --- | --- |
| Definición | `portals.name('all').role('admin').registerActions(...)` | Declara qué permite `admin::marketing.portals::all`; no lo asigna a nadie |
| Asignación | Guardar `admin::marketing.dashboard::all` entre los permisos de un usuario | El usuario tiene ese permiso concreto, además de pertenecer al rol |
| Concesión | `portalsAll.grantTo('admin::marketing.dashboard::all').registerActions(...)` | Quien tenga ese permiso de dashboard recibe sobre portales las acciones del bloque |

El rol por sí solo no autoriza nada. Un administrador sin asignaciones no accede a ningún permiso, aunque existan definiciones para `admin`.

## Registro y arranque

La configuración debe evaluarse antes que los módulos de permisos. Un módulo separado evita que el orden de evaluación de imports ESM adelante el registro al catálogo.

`pkit.config.js`:

```js
import pkit from 'endpoint-permissions-kit';

pkit.context.set('roles', ['admin', 'staff', 'public']);
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

function checkPublishedPortal(_data, context) {
  if (context.resource.status === 'published') {
    throw new Error('Published portals cannot be removed');
  }
}

portals.hook('remove', checkPublishedPortal);

function checkPortalOwner(_data, context) {
  if (context.resource.owner !== context.user.id) {
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

Las concesiones pueden registrarse antes de importar el módulo al que referencian. `seal()` resuelve las referencias cruzadas con todos los archivos cargados, comprueba los hooks de rol y materializa las vistas. Es idempotente. Registrar permisos, concesiones, hooks o roles después de sellar lanza `SEALED`. Cada registro valida el literal completo antes de modificar el estado.

`all` y `update-only` son etiquetas. `all` no activa todos los métodos y `update-only` contiene `find` y `update` porque así se declaró; la librería no interpreta los nombres.

Un nombre existe solo cuando algún rol registra acciones en él. `.name(...)` construye un builder, pero un nombre que solo tiene hooks o concesiones hace fallar `seal()` con `INVALID_DEFINITION`: ni un hook ni un `grantTo` crean la capacidad que luego usan como prueba de existencia.

## Roles

`context.set('roles', [...])` declara el catálogo completo. Si la integración no lo llama, el catálogo contiene únicamente `general`, que se usa de forma explícita con `.role('general')`. `general` es un rol ordinario: no se añade al catálogo declarado y no respalda a otros roles.

El rol siempre es explícito. `registerActions` y los hooks de rol exigen `.role(x)`; `validate` y `permissions.forUser` exigen `role`. Un rol fuera del catálogo produce `ROLE_NOT_DECLARED` al registrar y `UNKNOWN_ROLE` al validar.

`*` está reservado para los hooks globales: declararlo en `context.set` o usarlo como nombre de permiso lanza `INVALID_DEFINITION`.

## Identificadores y asignaciones

El identificador se persiste como string completo. La relación entre el usuario y su lista de identificadores pertenece a la aplicación:

```json
[
  "staff::marketing.dashboard::all",
  "staff::marketing.portals::update-only"
]
```

Formato:

- Exactamente tres componentes separados por `::`, sin componentes vacíos.
- Roles y nombres sin `:` ni espacios en los extremos. `*` no puede ser rol ni nombre.
- Módulos formados por segmentos no vacíos unidos por puntos; `module()` recibe un segmento, no una ruta.
- Los nombres admiten guiones, como `update-only`, y no tienen interpretación jerárquica.
- Sensibles a mayúsculas. La librería valida y rechaza; nunca corrige una clave persistida.

Existe `rol::módulo::nombre` como identificador asignable si hay un `registerActions` para ese rol, módulo y nombre. Un identificador alcanzable solo por concesión no es asignable: persistirlo eliminaría la dependencia de su origen.

El rol forma parte de la clave a propósito: permite auditar a qué rol pertenece cada fila y detectar filas inyectadas. Un usuario `staff` con `admin::marketing.dashboard::all` guardado se rechaza con `PERMISSION_ROLE_MISMATCH`. La aplicación debe aplicar la misma comparación al guardar.

Cambiar el rol, módulo o nombre cambia la clave persistida y exige migrar las filas antes de desplegar: una fila desconocida bloquea al usuario, como describe la validación. Cambiar acciones bajo la misma clave no toca la base. Un cambio de rol del usuario también exige reescribir sus identificadores; la librería no sustituye prefijos. No se guardan los identificadores derivados de una concesión; retirar el origen retira el acceso derivado al volver a resolver. Retirar el origen no retira una asignación directa que exista además.

La librería no consulta la base de datos ni administra sesiones. La aplicación carga las asignaciones desde una fuente confiable y refresca sesiones o cachés cuando las revoca. Un cambio en los registros sellados requiere recargar el proceso; la revocación no se propaga por sí sola a procesos o sesiones existentes.

## Concesiones

`grantTo(permissionId)` declara que los titulares de ese identificador reciben, sobre el nombre receptor, las acciones del bloque. El rol del identificador vale para ambos extremos: `staff::marketing.dashboard::all` concede a un usuario `staff` sobre `staff::marketing.portals::all`.

```text
admin::marketing.dashboard::all
    → admin::marketing.portals::all
        → find: id, name, assetId
```

El bloque acepta la forma de `registerActions` con dos restricciones: `enabled` debe ser `true` y `properties` debe ser una lista explícita. Un grant es opt-in; `enabled: false` o `'*'` lanzan `INVALID_DEFINITION`. Concede solo los métodos que declara: apuntar a `update-only` no concede `update`.

No hace falta una definición directa del rol receptor: `portalsUpdateOnly.grantTo('admin::marketing.dashboard::all')` es válido sin `portalsUpdateOnly.role('admin')`. El bloque declara lo que podrá hacer ese administrador; no copia las acciones de `staff`.

La relación es entre permisos, no entre métodos homónimos: un identificador cuyo origen solo declara `find` puede conceder `update` sobre otro nombre si el bloque lo declara. Tampoco hace falta haber validado antes una operación del origen; basta con tener asignado su identificador.

Las concesiones son de un salto. Un acceso recibido por concesión no cuenta como asignación para activar otra concesión. Para extender el acceso a un tercer permiso se declara otro `grantTo` al mismo identificador asignable. Los ciclos son válidos: dashboard puede conceder sobre portales y portales sobre dashboard, porque cada grant se evalúa por separado. Solo la autorreferencia se rechaza.

Al registrar se valida el formato del identificador, su rol, la autorreferencia, la forma del bloque y que no exista otro bloque para el mismo identificador en ese nombre (`DUPLICATE_REGISTRATION`). Al sellar se comprueba que el identificador habilitante exista como asignable, que el nombre receptor tenga acciones registradas para algún rol y que cada método del bloque lo declare algún rol de ese nombre. Los campos del bloque no se contrastan con otras definiciones: el grant es la autoridad sobre sus campos.

## Validación de una petición

El servidor obtiene `role` y `permissions` de la sesión y de las asignaciones cargadas. Nunca los acepta desde el body o el query. La ruta fija el módulo, nombre y método que protege.

```js
const validation = await pkit.validate({
  action: 'marketing.portals',
  name: 'all',
  method: 'find',
  role: 'staff',
  permissions: ['staff::marketing.dashboard::all'],
  select: ['id', 'name', 'assetId', 'internalNotes'],
  context: {
    user: { id: 7 },
    resource: { id: 1, owner: 7 },
  },
});
```

El resultado con la configuración del ejemplo es `['id', 'name', 'assetId']`. `errors` vacío indica éxito. Si una fase falla, `result` es `null`.

`action`, `name`, `role` y `permissions` son obligatorios; omitir cualquiera es `INVALID_INPUT`. No hay rol implícito: el caso anónimo envía `role: 'public'` y la lista fija de identificadores que el servidor decide para esa identidad.

La lista de asignaciones se valida completa, en este orden por identificador: formato (`INVALID_INPUT`), rol igual al autenticado (`PERMISSION_ROLE_MISMATCH`) y existencia como asignable (`UNKNOWN_PERMISSION`). Cualquier fallo deniega la petición entera, aunque el destino no dependa de la fila defectuosa: una fila obsoleta en la base bloquea al usuario hasta limpiarla. Una lista vacía deniega con `PERMISSION_NOT_ASSIGNED`. Los repetidos se deduplican.

Orden de evaluación: registro sellado, forma de la entrada, rol, asignaciones, módulo (`UNKNOWN_ACTION`), nombre (`UNKNOWN_PERMISSION`), resolución del acceso, datos o selección y hooks.

Resolución de `(rol, módulo, nombre, método)`:

1. Si `rol::módulo::nombre` está en la lista del usuario, la definición directa decide por completo. Método ausente o `enabled: false` es `METHOD_DISABLED`. Las concesiones hacia ese destino se ignoran, aunque fueran más amplias.
2. Si no está asignado directamente, se reúnen los bloques `grantTo` del destino cuyo identificador habilitante esté en la lista. Ninguno: `PERMISSION_NOT_ASSIGNED`. Ninguno con ese método: `METHOD_DISABLED`. Los campos son la unión de los bloques que declaran el método.

Una definición directa que el usuario no tiene asignada no participa: ni aporta campos ni deniega. El administrador que solo tiene dashboard recibe los tres campos del grant, aunque `portalsAll.role('admin')` declare `'*'`. El estado de los métodos del origen tampoco influye: deshabilitar `dashboard.find` no retira el acceso derivado; retirar la asignación sí.

Nombres distintos no se unen: tener `all` no concede `update-only`.

Para `find`, `result` es la selección efectiva: los campos pedidos se recortan a los permitidos y omitir `select` devuelve todos. Con `'*'`, `result` es `select` o `'*'`. La librería no consulta la base de datos ni filtra respuestas; el handler usa esa selección.

En `update`, `create` y `remove`, cualquier clave de `data` fuera de los campos efectivos produce `PROPERTIES_NOT_ALLOWED` con la lista `fields`. En éxito se devuelve el mismo objeto `data`. `select` fuera de `find` produce `INVALID_INPUT`. `data` es obligatoria para escritura y opcional en `find`; `context` es opcional. `data`, `context` y `select` deben tener la forma correcta aunque las propiedades sean `'*'`; los valores omitidos llegan a los hooks como `undefined`.

Con las definiciones del ejemplo:

| Rol y asignaciones del usuario | Destino | Resultado antes de hooks |
| --- | --- | --- |
| `admin`, solo dashboard | Portales `all`, `find` | `id`, `name`, `assetId`; el comodín de `portalsAll.role('admin')` no participa |
| `admin`, dashboard y portales `all` | Portales `all`, `find` | `'*'`: la asignación directa manda |
| `staff`, solo dashboard | Portales `all`, `find` | Los tres campos del grant; corren los hooks de `portalsAll.role('staff')` |
| `staff`, dashboard y portales `all` | Portales `all`, `find` | Campos de `portalsAll.role('staff')`, aunque fueran menos que los del grant |
| `admin`, solo dashboard | Portales `update-only`, `find` | `id`, `name`, `assetId`; no requiere `portalsUpdateOnly.role('admin')` |
| `staff`, solo dashboard | Portales `update-only`, `update` | `METHOD_DISABLED`: el grant solo concede `find` |
| `staff`, portales `update-only` | Portales `update-only`, `update` | Permitido con sus tres campos |
| `staff`, portales `all` | Portales `update-only`, `find` | `PERMISSION_NOT_ASSIGNED` |
| `admin`, sin asignaciones | Portales `all`, `find` | `PERMISSION_NOT_ASSIGNED` |
| `staff`, fila con prefijo `admin` | Cualquiera | `PERMISSION_ROLE_MISMATCH` |
| `staff`, fila cuyo nombre ya no existe | Cualquiera | `UNKNOWN_PERMISSION` |

## Hooks

La ubicación del hook determina su alcance:

| Registro | Alcance |
| --- | --- |
| `pkit.module(...).hook(method, fn)` | Todos los nombres del módulo, todos los roles |
| `.name(x).hook(method, fn)` | Ese nombre, todos los roles |
| `.name(x).role(r).hook(method, fn)` | Ese nombre y rol, tanto en acceso directo como derivado |

Un hook de `portalsAll.role('staff')` corre al autorizar `marketing.portals`, nombre `all`, rol `staff`, venga el acceso de una asignación directa o de una concesión desde dashboard. No corre para `admin` ni para `update-only`. Los hooks de dashboard no corren al consultar portales. No hay herencia de hooks entre nombres ni roles.

Un hook de rol es válido al sellar si existe algún camino para ese rol, nombre y método: una definición directa o un grant cuyo identificador tenga ese rol. Sin camino lanza `INVALID_DEFINITION`.

Orden: hooks del módulo, hooks del nombre y hooks del nombre para el rol autenticado. Todos corren con `Promise.allSettled`; los errores conservan el orden de grupo y de registro aunque terminen en otro orden. Cada registro corre una vez por petición. Un fallo deniega la operación completa. Los valores de retorno se ignoran.

El tercer argumento contiene el permiso resuelto:

```text
role, action, name, permissionId, method, enabled, properties,
authorization: { direct: boolean, grantedBy: readonly PermissionId[] }
```

`permissionId` es el destino efectivo, aunque no sea asignable. `direct` indica si el acceso viene de la asignación directa; `grantedBy` lista, ordenados y congelados, los identificadores cuyos grants aportaron campos. `direct: true` implica `grantedBy: []`.

```js
portalsAll.role('staff').hook('find', checkDashboardPortalAccess);

function checkDashboardPortalAccess(_data, context, permission) {
  if (!permission.authorization.grantedBy.includes('staff::marketing.dashboard::all')) return;
  if (!context || context.allowDashboardPortalAccess !== true) {
    throw new Error('Portal access from dashboard is not allowed');
  }
}
```

`allowDashboardPortalAccess` es un dato calculado por el servidor para esa petición, no un campo de la librería ni un valor confiable si llega del cliente. Si la condición debe restringir cualquier lectura de portales, se elimina el filtro por origen y se registra como hook del nombre.

## Errores

Los métodos de configuración, registro, sellado y vistas lanzan excepciones `PkitError` con `code`. Solo `validate()` devuelve `{ result, errors }`; la aplicación traduce los códigos al transporte y decide qué exponer.

| Código | Información |
| --- | --- |
| `INVALID_DEFINITION` | Segmento, nombre o identificador mal formado; grant con `enabled: false`, `'*'`, autorreferencia o referencia inexistente; nombre sin acciones; hook de rol sin camino |
| `DUPLICATE_REGISTRATION` | Segundo `registerActions` para `(rol, módulo, nombre)` o segundo bloque para la misma concesión |
| `ROLE_NOT_DECLARED` | Rol fuera del catálogo al registrar, incluido el prefijo de `grantTo` |
| `SEALED` / `NOT_SEALED` | Registro tras `seal()` / uso antes de `seal()` |
| `INVALID_INPUT` | Petición sin `action`, `name`, `role` o `permissions`; identificador mal formado; `data`, `context` o `select` con forma inválida |
| `UNKNOWN_ROLE` / `UNKNOWN_ACTION` | Rol o módulo desconocidos en ejecución |
| `UNKNOWN_PERMISSION` | Nombre inexistente o identificador asignado que no es asignable |
| `PERMISSION_ROLE_MISMATCH` | Identificador asignado de un rol distinto del autenticado |
| `PERMISSION_NOT_ASSIGNED` | Destino sin asignación directa ni concesión activa |
| `METHOD_DISABLED` | Destino asignado sin ese método habilitado, o concesiones que no conceden ese método |
| `PROPERTIES_NOT_ALLOWED` | `fields` enumera las claves rechazadas |
| `HOOK_ERROR` | `cause` conserva lo lanzado por el hook |
| `VALIDATION_ERROR` | Fallo inesperado, con su `cause` original |

## Vistas de permisos

```js
const catalog = pkit.permissions.named;
const access = pkit.permissions.forUser({ role: 'staff', permissions: ['staff::marketing.dashboard::all'] });
```

`named` es el catálogo de identificadores asignables con sus acciones registradas. Sirve para construir la selección administrativa de permisos. No incluye identidades alcanzables solo por concesión.

`forUser` devuelve, por identificador efectivo, un mapa de los cuatro métodos a booleano, aplicando la misma precedencia y validación de identidad que `validate`, sin ejecutar hooks. Incluye los destinos asignados directamente y los alcanzables por concesión; omite el resto. Con el ejemplo, el usuario `staff` con dashboard obtiene:

```js
{
  'staff::marketing.portals::all': { find: true, update: false, create: false, remove: false },
  'staff::marketing.portals::update-only': { find: true, update: false, create: false, remove: false },
  'staff::marketing.dashboard::all': { find: true, update: false, create: false, remove: false },
}
```

Las vistas están congeladas y no tienen prototipo; antes de `seal()` lanzan `NOT_SEALED`. Describen configuración: los hooks y datos de cada petición siguen requiriendo `validate()`.

## Tipos de roles

```sh
pkit generate
pkit generate --config ./config/roles.mjs --out ./src/pkit.generated.d.ts
pkit generate --check
```

El generador importa el config en un proceso aislado y amplía `RoleRegistry` de `endpoint-permissions-kit/types` con los roles declarados, o con `general` si el config no declara ninguno. `Role` y `PermissionId` derivan de ese registro: `'nobody::x::y'` no compila. El archivo generado debe estar incluido en el programa TypeScript del consumidor.

`--check` no escribe: sale con 1 si falta el archivo o está desactualizado. Éxito sale con 0; un comando incorrecto sale con 2; los errores de ejecución salen con 1. El config debe declarar roles sin iniciar servidores ni conexiones.

## Implementación funcional

Las funciones de la librería se declaran con `function` en el ámbito del módulo. No hay arrow functions, funciones anidadas ni valores por defecto en parámetros. Los builders vinculan argumentos mediante `bind` y conservan su identidad al encadenar llamadas o extraer métodos. Las definiciones se copian y congelan al registrar; las vistas se materializan una vez al sellar. `src/Validators.ts` concentra las reglas de validación y recibe estado explícito; `src/resolve.ts` contiene la resolución compartida por `validate` y `forUser`.
