# Uso de Endpoint Permissions Kit

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

portals.registerActions({
  find: { properties: ['id', 'name', 'link'], enabled: true },
  update: { properties: [], enabled: false },
  create: { properties: [], enabled: false },
});

portals.role('staff').registerActions({
  update: { properties: ['id', 'name', 'description'], enabled: true },
});

portals.role('admin').registerActions({
  find: { properties: '*', enabled: true },
  update: { properties: '*', enabled: true },
  create: { properties: ['name', 'link'], enabled: true },
  remove: { properties: ['id'], enabled: true },
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

portals.role('staff').hook('update', checkPortalOwner);
```

`app.js`:

```js
import pkit from 'endpoint-permissions-kit';
import './pkit.config.js';
import './modules/marketing/portals/permissions.js';

pkit.seal();
```

`seal()` comprueba los hooks de rol sin método declarado ni heredado y materializa las vistas. Es idempotente. Registrar permisos, hooks o roles después de sellar lanza `SEALED`. El registro valida el literal completo antes de modificar el estado.

## Rol general

`general` siempre existe, incluso sin llamar a `context.set`. `registerActions` sin `.role()` registra en `general`. `validate` sin `role` y `permissions.forRole()` sin argumento también usan `general`.

Para un rol explícito declarado, cada método se busca primero en sus acciones y después en `general`. Un método con `enabled: false` no hereda el método habilitado de `general`. Si ninguno lo declara, se deniega. Un rol desconocido produce `UNKNOWN_ROLE`.

En el ejemplo, `staff.find` y `public.find` heredan de `general`; `staff.update` usa su propia definición; `staff.remove` se deniega.

## Validación de una petición

La aplicación obtiene el rol de la sesión autenticada. No debe aceptar el rol enviado en el body o el query. Omitirlo significa solicitar los permisos de `general`, no autenticar al usuario.

```js
const validation = await pkit.validate({
  action: 'marketing.portals',
  method: 'update',
  role: 'staff',
  data: { id: 1, name: 'Portal' },
  context: {
    user: { id: 7 },
    resource: { id: 1, owner: 7, status: 'draft' },
  },
});
```

`errors` vacío indica éxito. Si una fase falla, `result` es `null`. El orden es registro sellado, compatibilidad de `select`, rol, permiso, método, datos/campos y hooks. Los fallos anteriores a los hooks detienen la evaluación.

Para `find`, `result` es la selección efectiva. Los campos pedidos se recortan a `properties`; omitir `select` usa todos los campos permitidos.

```js
const validation = await pkit.validate({
  action: 'marketing.portals',
  method: 'find',
  role: 'staff',
  select: ['id', 'name', 'owner'],
});
```

El resultado es `['id', 'name']`. El handler debe usar esa selección al consultar o construir la respuesta; la librería no consulta la base de datos ni filtra automáticamente una respuesta externa.

En `update`, `create` y `remove`, cualquier clave de `data` fuera de `properties` produce `PROPERTIES_NOT_ALLOWED` con la lista `fields`. En éxito se devuelve el mismo objeto `data`, conservando su tipo. `select` fuera de `find` produce `INVALID_INPUT`.

`properties: '*'` permite cualquier campo. No permite datos con forma inválida: `data` y `context` deben ser objetos; `select` debe ser un array de strings. `data` es obligatoria para escritura. En `find`, `data` es opcional; `context` es opcional en todos los métodos. Los valores omitidos llegan a los hooks como `undefined`, sin fabricar objetos vacíos. Si el hook necesita contexto y este falta, su fallo aparece en `errors`. Los valores `null` se rechazan.

## Hooks y errores

Un hook sin `.role()` es global al permiso. Un hook con `.role()` se ejecuta solo para ese rol. Los hooks de `general` no se heredan por otros roles; usa un hook global para restricciones de todos los usuarios.

Todos los hooks aplicables se ejecutan con `Promise.allSettled`. El orden de errores es globales por registro y después hooks del rol por registro, aunque terminen en distinto orden. Sus valores de retorno se ignoran. El tercer argumento contiene `{ role, action, method, enabled, properties }` del permiso resuelto.

`src/Validators.ts` concentra las reglas de validación; sus métodos reciben datos y estado explícitos, y lanzan excepciones. `validate()` ejecuta esas reglas y los hooks, y es el único método que devuelve errores formateados de validación:

| Código | Información |
| --- | --- |
| `NOT_SEALED` | No se llamó a `seal()` |
| `INVALID_INPUT` | Entrada incompatible con el contrato |
| `UNKNOWN_ROLE` | Rol fuera del catálogo |
| `UNKNOWN_ACTION` | Permiso no registrado |
| `METHOD_DISABLED` | Método ausente o deshabilitado |
| `PROPERTIES_NOT_ALLOWED` | `fields` enumera las claves rechazadas |
| `HOOK_ERROR` | `cause` conserva lo lanzado por el hook |
| `VALIDATION_ERROR` | Fallo inesperado, con su `cause` original |

Los métodos de configuración, registro, sellado y consulta de vistas lanzan excepciones al fallar. No fabrican respuestas `{ result, errors }`. La aplicación traduce los códigos al transporte y decide qué mensajes y causas son aptos para exponer al cliente.

## Vistas de permisos

```js
const permissionsByRole = pkit.permissions.all;
const staffPermissions = pkit.permissions.forRole('staff');
const generalPermissions = pkit.permissions.forRole();
```

`all` contiene definiciones resueltas agrupadas por rol. `forRole` contiene un mapa plano de `'action.method'` a booleano para los cuatro métodos de cada módulo. Las vistas están congeladas y no tienen prototipo; antes de `seal()` lanzan `NOT_SEALED`.

Entrega al cliente solo el mapa de su rol. Un path ausente debe tratarse como denegado. Estas vistas describen configuración; los hooks y datos de cada petición siguen requiriendo `validate()` en el servidor.

## Tipos de roles

```sh
pkit generate
pkit generate --config ./config/roles.mjs --out ./src/pkit.generated.d.ts
pkit generate --check
```

El generador importa el config en un proceso aislado y amplía `RoleRegistry` de `endpoint-permissions-kit/types`. El archivo generado debe estar incluido en el programa TypeScript del consumidor. No necesita comentarios para funcionar.

`--check` no escribe: sale con 1 si falta el archivo o está desactualizado. Éxito sale con 0; un comando incorrecto sale con 2; los errores de ejecución salen con 1. El config debe declarar roles sin iniciar servidores ni conexiones.

## Implementación funcional

Las funciones de la librería se declaran con `function` en el ámbito del módulo. No hay arrow functions ni funciones definidas dentro de otras. Los builders vinculan argumentos mediante `bind` y conservan su identidad y alcance al encadenar llamadas o extraer métodos.

Los valores por defecto de parámetros y destructuring se eliminaron. El rol general, la selección completa de campos permitidos y los nombres convencionales del CLI siguen siendo reglas explícitas. Las funciones internas `generate` y `checkGenerated` requieren un objeto de opciones con `cwd`; el binario entrega el directorio real de ejecución.
