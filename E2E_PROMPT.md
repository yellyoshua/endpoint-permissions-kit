# Prompt: suite e2e de `endpoint-permissions-kit`

Prompt para un agente de IA. Construye en `e2e/` cuatro aplicaciones simuladas (backend Express + frontend React) que consumen la librería `endpoint-permissions-kit` como un usuario real y la someten a pruebas de integración intensivas.

---

## 1. Rol y objetivo

Actúas como ingeniero senior que integra la librería de permisos de este repositorio en cuatro aplicaciones de distinto tamaño, como lo haría un equipo que adopta la librería en producción. El objetivo no es probar la librería unitariamente (eso pertenece a la propia librería), sino comprobar que su configuración aguanta implementaciones reales, con módulos, submódulos, roles, concesiones, hooks y pantallas relacionadas entre sí, y que un consumidor externo puede usarla exclusivamente a través de su API pública y su distribución compilada.

Entregable: la carpeta `e2e/` completa, ejecutable con `bun`, con sus cuatro proyectos, sus pruebas en verde, su documentación y el informe de entrega del apartado 10.

---

## 2. Contexto del proyecto

### 2.1 Qué es la librería

`endpoint-permissions-kit` es una librería privada de autorización por endpoint, agnóstica del framework. Mantiene un registro de permisos en memoria, lo cierra con `seal()` y resuelve por petición qué campos puede leer o escribir un usuario. No autentica, no consulta bases de datos, no filtra respuestas ni conoce rutas HTTP: la aplicación decide todo eso.

### 2.1.1 Aislamiento respecto de la raíz del repositorio

`e2e/` es un proyecto independiente que vive dentro de este repositorio solo por comodidad. Trátalo como si fuera otro repositorio que consume la librería desde un registro de paquetes:

- No leas ni apliques ningún archivo de instrucciones, convenciones o configuración de la raíz: `CLAUDE.md`, `README.md`, `docs/`, `tests/`, `scripts/`, `tsconfig*.json`, `.claude/`, `skills/`, `agents/`, memorias, hooks o cualquier otro que exista o aparezca en el futuro. Sus reglas (runtime, prohibiciones de dependencias, estilo de funciones, estructura de pruebas) gobiernan la librería, no `e2e/`.
- No modifiques nada fuera de `e2e/`. La única interacción con la raíz es ejecutar `bun install` y `bun run build` para producir `dist/`, que es lo que `file:../` consume.
- `e2e/` tiene su propio `CLAUDE.md`, `README.md`, `.gitignore`, `package.json`, `tsconfig.json`, dependencias, scripts, documentación y pruebas. Un agente que trabaje mañana dentro de `e2e/` debe poder hacerlo leyendo solo `e2e/CLAUDE.md` y `e2e/README.md`.
- Las convenciones de `e2e/` son las de este prompt (apartados 2.4 y 8) y quedan escritas en `e2e/CLAUDE.md`. Ninguna se hereda de la raíz.

### 2.1.2 Lo único de la raíz que sí es entrada

La librería se consume por su contrato público, como haría cualquier integrador. Lectura obligatoria antes de escribir código, en este orden:

1. `USAGE.md`: modelo, registro, roles, concesiones, validación, hooks, errores, vistas y CLI. Es la fuente de verdad del comportamiento. Si cualquier otra fuente del repositorio la contradice, manda `USAGE.md`.
2. `src/types.ts` (idéntico a `dist/types/types.d.ts` tras el build): contratos públicos exactos (`ValidateInput`, `ValidateResult`, `HookFn`, `ResolvedPermission`, `PkitErrorCode`, `UserPermissionMap`, `RoleRegistry`).
3. `src/index.ts` (idéntico a `dist/types/index.d.ts` tras el build): lo único que exporta el paquete (`pkit.context`, `pkit.module`, `pkit.seal`, `pkit.validate`, `pkit.permissions`, `METHODS` y los tipos).
4. `package.json` de la raíz, solo para confirmar `exports`, `bin` y `engines` del paquete que se instala.

Comportamiento a fijar desde `USAGE.md` y el código público, porque otras fuentes del repositorio lo describen de forma distinta: el rol siempre es explícito, no existe herencia de métodos entre roles y `general` es un rol ordinario que desaparece del catálogo en cuanto `context.set('roles', [...])` lo sustituye. No implementes nada que dependa de un rol implícito.

### 2.2 Modelo en diez líneas

- Un permiso se identifica como `rol::módulo.submódulo::nombre`, por ejemplo `staff::marketing.portals::update-only`.
- `pkit.module('a').module('b')` construye la ruta `a.b`; `.name(x)` abre un conjunto de acciones; `.role(r).registerActions({...})` declara métodos (`find`, `update`, `create`, `remove`) con `enabled` y `properties` (lista o `'*'`).
- Definir no asigna. La aplicación guarda por usuario una lista de identificadores completos; sin asignación no hay acceso aunque exista definición.
- `grantTo(id).registerActions({...})` concede a los titulares de `id` las acciones del bloque sobre el nombre receptor. Un salto, opt-in, `enabled: true` y lista explícita de campos. Un identificador alcanzable solo por concesión no es asignable.
- Resolución: si `rol::módulo::nombre` está asignado, la definición directa manda por completo (aunque los grants fueran más amplios). Si no, se unen los grants cuyo origen esté asignado; los campos son la unión.
- Hooks en tres alcances (módulo, nombre, nombre+rol), ejecutados con `Promise.allSettled`, todos corren, cualquier fallo deniega, cada fallo es un `HOOK_ERROR` con `cause`.
- `validate()` devuelve `{ result, errors }` y nunca lanza. Todo lo demás (`context.set`, `registerActions`, `grantTo`, `hook`, `seal`, `permissions.*`) lanza `PkitError` con `code`.
- `permissions.named` es el catálogo asignable; `permissions.forUser({ role, permissions })` devuelve por identificador efectivo un mapa `{ find, update, create, remove }` de booleanos sin ejecutar hooks. Es lo que un frontend usa para decidir qué pantallas y botones mostrar.
- Para `find`, `result` es la selección efectiva (`select` recortado a los campos permitidos, o `properties`, o `'*'`). Para escritura, cualquier clave de `data` fuera de los campos produce `PROPERTIES_NOT_ALLOWED` con `fields`.
- `pkit generate` lee un `pkit.config.(js|mjs|cjs|ts)` en un proceso hijo y escribe `pkit.generated.d.ts`, que amplía `RoleRegistry` para que `Role` y `PermissionId` rechacen en compilación roles no declarados.

### 2.3 Restricciones de la librería que condicionan el diseño de `e2e/`

Estas restricciones vienen del código y deciden la arquitectura. No las descubras a mitad de camino.

1. Estado global único por proceso. El registro vive en `globalThis[Symbol.for('endpoint-permissions-kit')]`. Los cuatro proyectos, si corren en el mismo servidor Express, comparten un solo registro, un solo catálogo de roles y un solo `seal()`. Consecuencias:
   - `pkit.context.set('roles', [...])` se llama una sola vez, con la unión de los roles de los cuatro proyectos, y antes de cualquier `registerActions`. Llamarlo después de registrar lanza `INVALID_DEFINITION`.
   - Cada proyecto usa un primer segmento de módulo propio (`small`, `medium`, `large`, `xl`) para que sus rutas lógicas no colisionen.
   - `seal()` es idempotente; se llama una vez en el arranque del servidor, después de importar los cuatro archivos de permisos.
   - No existe API pública para reiniciar el estado (`src/state.ts` no se exporta). Las pruebas no pueden re-registrar permisos; prueban contra el registro sellado. Los errores de registro (`DUPLICATE_REGISTRATION`, `ROLE_NOT_DECLARED`, `SEALED`, `INVALID_DEFINITION` al sellar) solo pueden probarse en un proceso hijo (`Bun.spawn`) que importe una configuración deliberadamente rota.
2. Dependencia `file:../`. El `package.json` de la librería apunta a `dist/` (`main`, `module`, `types`, `exports`, `bin`). `dist/` no está versionado. Antes de `bun install` en `e2e/` hay que ejecutar `bun run build` en la raíz. `bun install` con `file:` crea enlaces simbólicos por archivo hacia la carpeta de la librería (verificado en esta sesión): un `bun run build` posterior se refleja sin reinstalar.
3. Tipos de roles. `e2e/` necesita su propio `pkit.config.ts` (solo `context.set`, sin arrancar servidores) y su `pkit.generated.d.ts` generado con `bunx pkit generate`, incluido en `e2e/tsconfig.json`. Sin ese archivo, `Role` solo admite `'general'` y nada compila.
4. Identidad. `role` y `permissions` llegan a `validate()` desde la sesión del servidor, nunca desde body o query. Una fila asignada con rol distinto del autenticado deniega la petición entera (`PERMISSION_ROLE_MISMATCH`); una fila que ya no existe también (`UNKNOWN_PERMISSION`); lista vacía es `PERMISSION_NOT_ASSIGNED`.
5. Subpath de tipos. `import type { ... } from 'endpoint-permissions-kit/types'` requiere `moduleResolution: "bundler"` (o `node16`) en `e2e/tsconfig.json`.

### 2.4 Convenciones propias de `e2e/`

Estas convenciones nacen aquí y se escriben en `e2e/CLAUDE.md`; no proceden de la raíz.

- Runtime y herramientas: `bun` para instalar, ejecutar scripts y correr pruebas (`bun install`, `bun run`, `bun test`, `bunx`). Motivo: ya está instalado en el entorno, trae runner de pruebas y `Bun.spawn` sin dependencias extra. Alternativa no elegida: Node + Vitest; si el usuario la prefiere, lo indicará.
- Servidor HTTP con Express y frontend con React servido por Vite, por petición explícita del usuario. `bun` ejecuta ambos (`bun run`, `bunx vite`).
- TypeScript y React idiomáticos: `function` o arrow según convenga, hooks de React, callbacks inline donde la API lo pide. Sin clases.
- Nombres en inglés y `camelCase`; constantes en `CONSTANT_CASE`; tipos y componentes en `PascalCase`. Sin comentarios en el código (apartado 8).
- Pruebas con `bun:test`, una suite por proyecto, contra HTTP real. Sin mocks de la librería.

---

## 3. Estructura exacta del entregable

```text
e2e/
├── CLAUDE.md                 instrucciones propias para agentes que trabajen dentro de e2e/ (apartado 3.1)
├── README.md                 qué es e2e/, cómo se instala, se ejecuta y se prueba (apartado 3.2)
├── .gitignore                node_modules, dist, *.log, .vite
├── package.json              dependencias propias; "endpoint-permissions-kit": "file:../"
├── bun.lock
├── tsconfig.json             strict, moduleResolution bundler, incluye pkit.generated.d.ts
├── vite.config.ts            react plugin, proxy /api → servidor Express
├── index.html                entrada de Vite (necesaria aunque no estaba en la lista original)
├── pkit.config.ts            único context.set con la unión de roles de los cuatro proyectos
├── pkit.generated.d.ts       generado con bunx pkit generate; no se edita a mano
├── scripts/
│   ├── build-library.ts      bun run build en la raíz
│   ├── generate-types.ts     bunx pkit generate y --check
│   ├── dev.ts                arranca Express y Vite
│   └── test.ts               construye la librería, comprueba tipos y corre bun test
├── docs/
│   ├── architecture.md       mapa de e2e/, capas, contrato de errores HTTP, tabla de rutas, excepciones
│   ├── project-small.md      especificación: dominio, módulos, roles, matriz de permisos, pantallas, escenarios
│   ├── project-medium.md
│   ├── project-large.md
│   └── project-extra-large.md
└── src/
    ├── server/
    │   ├── app.ts            createApp(): Express con identidad, routers de los 4 proyectos y traducción de errores
    │   ├── index.ts          app.listen para desarrollo
    │   ├── bootstrap.ts      importa pkit.config, los 4 permissions.ts y llama a pkit.seal() una vez
    │   ├── identity.ts       middleware: x-user-id → { role, permissions } desde el store; anónimo → identidad fija
    │   ├── authorize.ts      envoltorio de pkit.validate para casos de uso (action, name, method, data, select, context)
    │   └── errors.ts         PkitErrorCode → status HTTP y cuerpo { error: { code, message, fields? } }
    ├── client/
    │   ├── main.tsx          createRoot + RouterProvider
    │   ├── App.tsx           shell: selector de usuario simulado, navegación derivada de /me
    │   ├── Route.tsx         "/" lista botones a cada proyecto; "/:project/*" delega en las pantallas del proyecto
    │   └── api.ts            fetch tipado hacia /api con cabecera x-user-id
    ├── project-small/
    │   ├── server/
    │   │   ├── permissions.ts   registro de módulos, nombres, roles, grants y hooks del proyecto
    │   │   ├── store.ts         base de datos en memoria (Map) con seed() y reset()
    │   │   ├── <modulo>.ts      casos de uso por módulo (autorizan con authorize y leen/escriben el store)
    │   │   └── routes.ts        Router de Express: una ruta por (módulo, nombre, método)
    │   ├── client/
    │   │   └── screens/         una pantalla por módulo; botones y campos según el mapa de /me
    │   └── tests/
    │       ├── api.test.ts      matriz completa de roles × rutas × métodos contra HTTP real
    │       ├── screens.test.ts  mapa de /me ↔ pantallas y acciones visibles
    │       └── types.test.ts    lanza tsc sobre types.fixture.ts con @ts-expect-error (apartado 6)
    ├── project-medium/       misma forma
    ├── project-large/        misma forma
    └── project-extra-large/  misma forma; añade tests/startup.test.ts (errores de registro en proceso hijo)
```

Decisiones fijadas sobre la estructura (el usuario listó `src/server/` y `src/client/` como carpetas de configuración; el resto se deriva de ellas):

- El código de cada proyecto vive bajo su carpeta `src/project-*/`, separado en `server/`, `client/` y `tests/`. `src/server/` y `src/client/` contienen solo lo compartido por los cuatro.
- Cada proyecto tiene su propia suite de pruebas (`bun:test`) en su carpeta. No hay una suite común.
- Un único proceso Express sirve los cuatro proyectos bajo `/api/<project>/...`. Un único Vite sirve el frontend con rutas `/`, `/small`, `/medium`, `/large`, `/extra-large`.
- Base de datos: estructuras en memoria (`Map`) por proyecto, con `seed()` determinista y `reset()`. `bun:sqlite` en modo `:memory:` es aceptable solo si un proyecto necesita consultas relacionales reales; justifícalo en el informe si lo usas. Ninguna base de datos externa.
- Dependencias de `e2e/package.json` (todas propias, ninguna compartida con la raíz): `endpoint-permissions-kit` (`file:../`), `express`, `react`, `react-dom`, `react-router-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `@types/express`, `@types/react`, `@types/react-dom`, `@types/bun`. Cualquier otra requiere la justificación de AIS-6 (apartado 8.8).

### 3.1 Contenido de `e2e/CLAUDE.md`

Archivo de instrucciones autosuficiente para cualquier agente que trabaje dentro de `e2e/`. Debe contener, en este orden y sin remitir a la raíz:

1. Ámbito: `e2e/` es un proyecto independiente; no se leen ni aplican instrucciones de la raíz del repositorio; no se modifica nada fuera de `e2e/`; la raíz solo se usa para `bun run build`.
2. Runtime y comandos: `bun install`, `bun run test`, `bun run dev`, `bunx pkit generate --check`, `bunx tsc --noEmit`, `bunx vite build`, con lo que hace cada uno y en qué orden se ejecutan la primera vez.
3. Mapa de carpetas del apartado 3 y la regla de que cada proyecto escribe solo en su carpeta.
4. Restricciones de la librería del apartado 2.3 (registro global único, `context.set` una vez, prefijos de módulo, `seal` una vez, sin reset, errores de registro solo en proceso hijo).
5. Contrato del servidor del apartado 4 (identidad por `x-user-id`, tripleta estática por ruta, tabla de errores HTTP) o enlace a `docs/architecture.md` donde vive la tabla.
6. Reglas de código del apartado 8 condensadas: capas, sin comentarios, booleanos con prefijo, exports, sin duplicar la resolución de permisos, sin mocks de `pkit`, sin `test.skip`.
7. Política de pruebas del apartado 6.
8. Formato del informe de entrega del apartado 10 y criterios del apartado 11.

### 3.2 Contenido de `e2e/README.md`

Para una persona: qué es `e2e/`, los cuatro proyectos y su tamaño en una tabla (dominio, módulos, roles, identificadores asignables, pantallas), requisitos (`bun`, build previo de la librería), instalación y ejecución paso a paso, cómo elegir usuario simulado en el frontend, dónde está la especificación de cada proyecto (`docs/project-*.md`) y la matriz de cobertura (`docs/architecture.md`). Sin repetir las reglas de `CLAUDE.md`.

---

## 4. Contrato del servidor

### 4.1 Identidad simulada

- Cabecera `x-user-id`. El middleware busca el usuario en el store del proyecto de la ruta y coloca `{ id, role, permissions }` en `res.locals.identity`. Usuario desconocido: `401` con `{ error: { code: 'UNKNOWN_USER' } }`.
- Sin cabecera: identidad anónima fija por proyecto, solo en los proyectos que declaren un rol `public` (o equivalente) con una lista fija de identificadores decidida por el servidor. Proyectos sin rol anónimo responden `401`.
- Nada de la identidad se lee del body ni del query. Las pruebas verifican que enviar `role` o `permissions` en el body no cambia el resultado.

### 4.2 Rutas

Cada ruta declara estáticamente la tripleta `{ action, name, method }` que protege y no acepta que el cliente la altere. Convención de URL: `/api/<project>/<segmentos-del-módulo>/<recurso>` con `GET` para `find`, `POST` para `create`, `PATCH /:id` para `update`, `DELETE /:id` para `remove`. Cuando un módulo tiene varios nombres (`all`, `update-only`, `summary`...), cada endpoint decide cuál protege; la tabla `método + ruta → rol::módulo::nombre + método` de cada proyecto se escribe en `e2e/docs/project-*.md` y en `e2e/docs/architecture.md`.

Rutas comunes a todo proyecto:

- `GET /api/<project>/me` → `{ user, role, access }` donde `access` es `pkit.permissions.forUser(identity)`.
- `GET /api/<project>/catalog` → `pkit.permissions.named` filtrado al prefijo del proyecto; protegida por un permiso administrativo del propio proyecto.
- En `large` y `extra-large`: `PUT /api/<project>/users/:id/permissions` (administración) que reescribe la lista de identificadores de un usuario en el store aplicando la misma comprobación de prefijo de rol que la librería (`PERMISSION_ROLE_MISMATCH` al guardar), de modo que la siguiente petición de ese usuario ya cambie de resultado.

### 4.3 Flujo de un caso de uso

`transport (routes.ts)` decodifica la petición y llama al caso de uso → `caso de uso (<modulo>.ts)` llama a `authorize()` con la tripleta, `data`, `select` y el `context` que necesiten los hooks (usuario, recurso cargado del store) → si `errors` no está vacío, devuelve el error al transporte sin tocar el store → si `find`, usa `result` como lista de campos para proyectar la respuesta (`'*'` devuelve el registro completo) → si escritura, aplica `data` al store. El transporte traduce con `errors.ts`. El caso de uso nunca conoce Express; el store nunca conoce `pkit`.

### 4.4 Contrato de errores HTTP

Un solo lugar (`src/server/errors.ts`) traduce `PkitErrorCode` a HTTP. Tabla de partida; si la cambias, documenta el motivo:

| Código de la librería | HTTP | Cuerpo |
| --- | --- | --- |
| `INVALID_INPUT` | 400 | `{ error: { code, message } }` |
| `PERMISSION_NOT_ASSIGNED`, `METHOD_DISABLED` | 403 | `{ error: { code } }` |
| `PROPERTIES_NOT_ALLOWED` | 403 | `{ error: { code, fields } }` |
| `UNKNOWN_ROLE`, `PERMISSION_ROLE_MISMATCH`, `UNKNOWN_PERMISSION` | 403 | `{ error: { code } }`; se registra en servidor como identidad corrupta |
| `HOOK_ERROR` (uno o varios) | 403 | `{ error: { code: 'HOOK_ERROR', reasons: [mensajes estables de cada hook] } }`; `cause` nunca sale al cliente |
| `UNKNOWN_ACTION`, `NOT_SEALED`, `VALIDATION_ERROR` | 500 | `{ error: { code: 'INTERNAL' } }`; el detalle solo al log del servidor |

Errores propios de la aplicación (recurso no encontrado `404`, validación de forma del body `400`) siguen el mismo cuerpo con códigos estables propios.

---

## 5. Los cuatro proyectos

Cada proyecto es una aplicación distinta, con dominio propio, y su tamaño se mide por la configuración de permisos que ejercita. Los mínimos son obligatorios; superarlos es bienvenido si añade cobertura real. Cada proyecto se documenta en `e2e/docs/project-*.md` con: dominio y usuarios simulados (id, rol, lista de identificadores), árbol de módulos, matriz rol × módulo × nombre × método × campos, tabla de rutas, pantallas y qué muestra cada una según el mapa de `/me`, lista de escenarios de prueba con el código de error esperado.

### 5.1 `project-small`: aplicación pequeña

- Dominio sugerido: bloc de notas de equipo (`notes`, `tags`, `profile`). Puedes cambiarlo; lo que no cambia son los mínimos.
- Mínimos: 3 módulos planos (sin submódulos), 2 nombres en al menos un módulo, 3 roles (uno anónimo), sin concesiones, hooks solo de módulo (1 síncrono, 1 asíncrono).
- Ejercita: asignación directa, `METHOD_DISABLED`, `PERMISSION_NOT_ASSIGNED`, recorte de `select`, `PROPERTIES_NOT_ALLOWED`, identidad anónima con lista fija, `find` sin `select`.
- Pantallas: índice del proyecto, una pantalla por módulo, formulario de creación y edición que solo muestra los campos permitidos según `access`.

### 5.2 `project-medium`: aplicación mediana

- Dominio sugerido: marketing (`marketing.portals`, `marketing.dashboard`, `marketing.campaigns.assets`), reproduciendo y ampliando el ejemplo de `USAGE.md`.
- Mínimos: 2 dominios raíz, submódulos de 2 niveles, 4 roles, nombres `all` y `update-only` en el mismo módulo, 2 concesiones (`dashboard → portals`, `dashboard → portals update-only`), hooks de nombre y de nombre+rol, `properties: '*'` en algún rol.
- Ejercita, con las once filas de la tabla "Con las definiciones del ejemplo" de `USAGE.md` como casos de prueba literales: precedencia de la definición directa sobre el grant, unión de campos, grant que no concede el método (`METHOD_DISABLED`), nombres que no se unen, `PERMISSION_ROLE_MISMATCH` por fila inyectada, `UNKNOWN_PERMISSION` por fila obsoleta.
- Pantallas: dashboard cuyo listado de portales depende de si el acceso llega por grant o por asignación directa (campos visibles distintos).

### 5.3 `project-large`: aplicación grande

- Dominio sugerido: ERP ligero (`inventory.items`, `inventory.warehouses.stock`, `sales.orders`, `sales.orders.lines`, `billing.invoices`, `hr.employees`).
- Mínimos: 4 dominios raíz, submódulos de 3 niveles, 6 roles, 3 nombres en algún módulo, 5 concesiones incluyendo dos grants distintos hacia el mismo nombre (unión de campos y `grantedBy` con dos identificadores ordenados), ciclo válido entre dos módulos (A concede sobre B y B sobre A), hooks en los tres alcances con al menos dos hooks que fallan a la vez en una misma petición (dos `HOOK_ERROR` en orden de registro), hook de propiedad (`context.resource.owner === context.user.id`), hook que solo actúa cuando `permission.authorization.direct === false`.
- Ejercita además: administración de permisos en caliente (`PUT /users/:id/permissions`) y su efecto inmediato; retirada del origen de un grant que retira el acceso derivado pero no la asignación directa; `permissions.named` para construir la pantalla administrativa de asignación; `select` con campos fuera de los permitidos que se recortan en silencio.
- Pantallas: ≥ 8, con navegación anidada por dominio y una pantalla administrativa de asignación de permisos alimentada por `/catalog`.

### 5.4 `project-extra-large`: aplicación extra grande

- Dominio sugerido: plataforma multi-área (`platform.tenants.settings`, `platform.tenants.members`, `crm.accounts.contacts.notes`, `support.tickets.replies`, `finance.ledger.entries`, `content.pages.blocks`, `analytics.reports`).
- Mínimos: 6 dominios raíz, submódulos de 4 niveles, 8 roles, ≥ 25 identificadores asignables en `permissions.named`, ≥ 10 concesiones, todos los tipos de hook, usuarios con ≥ 6 identificadores asignados, un rol con `'*'` en varios métodos y un rol con listas vacías (`enabled: false, properties: []`).
- Ejercita todo lo anterior más: `tests/startup.test.ts` con configuraciones rotas cargadas en proceso hijo mediante `Bun.spawn` (`DUPLICATE_REGISTRATION`, `ROLE_NOT_DECLARED`, `SEALED`, `INVALID_DEFINITION` por nombre sin acciones, por grant autorreferente, por grant con `'*'`, por hook de rol sin camino, por `context.set` después de registrar); `pkit generate --check` en verde; identidad anónima; deduplicación de identificadores repetidos; `context` ausente en hooks que lo exigen (el hook falla y el fallo llega como `HOOK_ERROR`); carga concurrente (≥ 50 peticiones en paralelo con `Promise.all` sobre distintos usuarios sin interferencia).
- Pantallas: ≥ 12, con menú lateral por dominio generado íntegramente desde `access`, sin lista de rutas escrita a mano en el cliente.

### 5.5 Matriz de cobertura obligatoria

Al terminar, `e2e/docs/architecture.md` incluye una tabla `característica de la librería × proyecto` marcando dónde se prueba cada una: los 13 códigos de `PkitErrorCode`, `HOOK_ERROR`, `VALIDATION_ERROR`, tres alcances de hooks, orden de errores de hooks, precedencia directa/grant, unión de campos, un salto, ciclo válido, autorreferencia rechazada, `'*'`, `select` recortado, `find` sin `select`, `data` obligatoria en escritura, identidad anónima, `forUser`, `named`, `generate`, `generate --check`. Ninguna celda de la fila `extra-large` queda vacía.

---

## 6. Pruebas

- Runner: `bun test` (`bun:test`). Cada proyecto tiene su carpeta `tests/` y se ejecuta desde `e2e/` con `bun test src/project-<n>` o completo con `bun run test`.
- Las pruebas de API arrancan `createApp()` en un puerto efímero (`listen(0)`) en `beforeAll`, hacen peticiones con `fetch` real y cierran en `afterAll`. Cada `beforeEach` llama a `store.reset()` y `store.seed()` del proyecto. El registro de permisos, sellado en el `bootstrap`, es compartido y no se toca.
- Cada proyecto incluye una matriz generada por datos: para cada usuario simulado × cada ruta × cada método, el resultado esperado (`200`/`201`/`204`, `400`, `403` con código, `404`) declarado en una tabla del propio test, sin lógica que reconstruya la precedencia de la librería (la tabla es la expectativa, no un segundo resolvedor).
- `screens.test.ts` comprueba que, para cada usuario, el mapa `access` de `/me` coincide con la lista de pantallas y acciones que el cliente muestra. Para ello las pantallas exponen su tripleta de permiso como dato (por ejemplo, un registro `SCREENS` por proyecto que asocia ruta de pantalla → `{ action, name, methods }`), de modo que la prueba pueda cruzarlo con `access` sin renderizar React. Sin librerías de testing de DOM.
- `types.test.ts` lanza `tsc --noEmit` con `Bun.spawn` sobre un fixture `types.fixture.ts` del proyecto, cuyo `tsconfig` incluye `pkit.generated.d.ts`; el fixture contiene llamadas válidas y llamadas marcadas con `@ts-expect-error` que deben fallar: rol no declarado, identificador con prefijo de rol ajeno, `select` en `update`, `update` sin `data`, `grantTo` con `enabled: false`, `grantTo` con `properties: '*'`. La prueba pasa solo si `tsc` sale con 0 y no oculta su salida.
- Pruebas negativas de seguridad en todos los proyectos: `role`/`permissions` en body ignorados; `x-user-id` desconocido → `401`; usuario con fila de otro rol → `403 PERMISSION_ROLE_MISMATCH` en cualquier ruta, incluidas las que no dependen de esa fila.
- Prohibido: mocks de `pkit`, saltarse `seal`, reimplementar la resolución en el test, `test.skip`, aserciones relajadas para poner en verde.
- Verificación visual opcional al final: con el skill `agent-browser`, abrir `http://localhost:<vite>/`, entrar en cada proyecto con dos usuarios distintos y capturar que la navegación y los botones cambian. No sustituye a las pruebas automáticas.

---

## 7. Fases, paralelización y sub-agentes

Usa sub-agentes solo donde el trabajo es independiente. Cada sub-agente recibe este prompt completo, el número de fase y su encargo; devuelve la lista de archivos creados, los comandos ejecutados con su resultado real y las dudas abiertas. En Claude Code: `Agent` con `subagent_type: general-purpose` para construir, `caveman:cavecrew-reviewer` o el skill `code-review` para revisar.

### Fase 0 (secuencial, agente principal): comprensión

1. Leer los archivos del apartado 2.1.2 completos. Nada más de la raíz.
2. Ejecutar en la raíz únicamente `bun install` y `bun run build`; comprobar que existen `dist/esm/index.js`, `dist/types/index.d.ts` y `dist/esm/cli/generate.js`. Anotar los resultados reales.
3. Confirmar la lista de exports públicos y de códigos de error contra `src/index.ts` y `src/types.ts`.

### Fase 1 (secuencial, agente principal): esqueleto compartido

Crear todo lo que los cuatro proyectos comparten y dejarlo funcionando con un proyecto vacío: `e2e/CLAUDE.md`, `e2e/README.md`, `.gitignore`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `pkit.config.ts` (con la unión de roles ya decidida en el apartado 5, escrita en `e2e/docs/architecture.md` antes de codificar), `pkit.generated.d.ts`, `scripts/*`, `src/server/*`, `src/client/*`, `docs/architecture.md` con el contrato de errores. Verificar desde `e2e/`: `bun install`, `bunx pkit generate --check`, `bunx tsc --noEmit`, arranque del servidor y respuesta `401` a `/api/small/me` sin cabecera.

Esta fase no se paraleliza: fija el catálogo de roles único, los prefijos de módulo y los contratos de los que dependen los cuatro sub-agentes.

### Fase 2 (paralela, 4 sub-agentes): un proyecto por sub-agente

Tareas independientes, lanzadas a la vez:

| Sub-agente | Encargo | Entradas | Salidas |
| --- | --- | --- | --- |
| A | `project-small` completo (apartado 5.1) | esqueleto de la fase 1, prefijo `small`, roles reservados | `src/project-small/**`, `docs/project-small.md`, pruebas en verde con `bun test e2e/src/project-small` |
| B | `project-medium` completo (5.2) | ídem, prefijo `medium` | ídem |
| C | `project-large` completo (5.3) | ídem, prefijo `large` | ídem |
| D | `project-extra-large` completo (5.4) | ídem, prefijo `xl` | ídem, más `startup.test.ts` |

Reglas de aislamiento para los sub-agentes: solo escriben dentro de su carpeta `src/project-*/` y su `docs/project-*.md`; no tocan `src/server/`, `src/client/`, `pkit.config.ts` ni `package.json`. Si necesitan un cambio compartido (un rol nuevo, un helper), lo devuelven como propuesta con la justificación y el agente principal lo aplica en la fase 3. Cada sub-agente registra sus rutas en su propio `routes.ts` exportando un `Router`, y sus pantallas en su propio registro `SCREENS`; la integración la hace el agente principal.

### Fase 3 (secuencial, agente principal): integración

1. Aplicar las propuestas compartidas devueltas por A–D, deduplicando.
2. Montar los cuatro routers en `src/server/app.ts` y las cuatro pantallas en `src/client/Route.tsx`.
3. Ejecutar desde `e2e/`: `bun run test` completo, `bunx tsc --noEmit`, `bunx pkit generate --check`, `bunx vite build` (sin desplegar nada) y el arranque conjunto con `scripts/dev.ts`.
5. Completar `e2e/CLAUDE.md` y `e2e/README.md` con lo que la integración haya fijado (puertos, usuarios simulados, comandos definitivos).
4. Rellenar la matriz de cobertura del apartado 5.5 con las pruebas reales que cubren cada celda.

### Fase 4 (paralela, revisión): un revisor por proyecto más uno transversal

Cinco revisores en paralelo, de solo lectura, con el formato de hallazgos del apartado 8.10: uno por proyecto y uno para `src/server/`, `src/client/` y `scripts/`. Cada uno audita contra las reglas del apartado 8 y contra los mínimos del apartado 5. El agente principal corrige los `INCUMPLIMIENTO`, vuelve a ejecutar la fase 3.3 y produce el informe del apartado 10.

---

## 8. Reglas de arquitectura y calidad (skill `pro-architecture`)

El skill `pro-architecture` es obligatorio para este trabajo y solo el usuario puede invocarlo; no intentes invocarlo. Sus reglas se reproducen aquí de forma condensada y son de obligado cumplimiento en todo `e2e/`. Verdictos: `INCUMPLIMIENTO` (bloquea) y `OBSERVACIÓN` (se reporta con justificación). Evalúa cada regla por sus disparadores literales; si un caso no está cubierto, dilo en lugar de inventar una regla.

### 8.1 Prohibiciones duras

1. No saltarse capas. Reglas de negocio fuera de los handlers de transporte; reglas de dominio fuera de componentes visuales; persistencia accesible solo desde su frontera.
2. No introducir contratos sin tipo. Peticiones, respuestas, DTOs y modelos con tipos explícitos; nada de `any` ni `Record<string, unknown>` donde se puede definir la forma. Excepción documentada: `Data` y `Context` de la librería son `Record<string, unknown>` por contrato de la propia librería.
3. No introducir patrones arquitectónicos nuevos en silencio. Un patrón nuevo se documenta con su motivo o no se añade.
4. No escribir comentarios en el código. Solo directivas leídas por herramientas (`@ts-expect-error`, `eslint-disable`), cabeceras de intérprete y bloques JSDoc/TSDoc. Nada de explicaciones, separadores, `TODO` sin ticket ni notas de autoría. Si un archivo se modifica, se eliminan todos los comentarios no permitidos de ese archivo.

### 8.2 Backend: capas y fronteras

- Cuatro responsabilidades en todo servidor: transporte (decodifica, llama al caso de uso, codifica), aplicación (orquesta un caso de uso: autorización, validación del contrato, reglas, persistencia, efectos), dominio (reglas e invariantes sin conocer transporte ni almacenamiento), persistencia (tablas y estructuras detrás de una frontera del módulo). Las dependencias apuntan hacia dentro.
- Toda entrada que cruza una frontera de confianza se valida una sola vez, en la frontera que la posee. Las escrituras rechazan o descartan campos desconocidos, y se documenta cuál. Los parámetros de lectura (filtros, `select`) vienen de una lista permitida.
- Autorización en el servidor, antes de cualquier efecto, para toda operación. La identidad nunca la aporta el cliente.
- Las lecturas que pueden crecer van acotadas (paginación o límite) en la frontera de datos, no en el llamador.
- Un contrato de errores por frontera con códigos estables; la traducción a HTTP ocurre una vez. Los resultados esperados (búsqueda vacía) son valores de retorno, no excepciones. Nada interno (stack, causas, nombres de tablas) llega al cliente.
- Pruebas por capa: casos de uso y reglas con pruebas sin I/O cuando sea posible; transporte con pruebas de contrato por endpoint (validación, contrato de errores, rechazo de autorización). Las fixtures reflejan permisos reales; una prueba que pasa con datos de otro alcance es un defecto.

### 8.3 Frontend

- Componentes pequeños con una responsabilidad; las reglas de negocio no viven en componentes visuales: la decisión de qué mostrar sale del mapa `access` recibido del servidor, no de reglas duplicadas en el cliente.
- Estado en el nivel más bajo posible; el estado global se limita a la identidad simulada seleccionada.
- Estados de carga, error y vacío gestionados en cada pantalla.
- Componentes compartidos solo con reutilización real (≥ 2 consumidores); los específicos de un proyecto se quedan en su carpeta.
- Accesibilidad básica: etiquetas en formularios, botones reales, navegación por teclado.

### 8.4 Nombres, tipos y exports (NT)

- NT-1 Booleanos con prefijo `is`, `has` o `can` (`isEnabled`, `hasAccess`, `canEdit`). Excepción: `enabled` es contrato público de la librería y se conserva en los bloques de `registerActions`.
- NT-2 Una variable conserva un solo tipo en toda su vida; no inicializar con `null` lo que luego es objeto o lista.
- NT-3 El nombre describe exactamente el comportamiento. Nada de `handle`, `process`, `doStuff`; sí `listVisibleOrders`, `assignPermissionsToUser`.
- NT-4 `camelCase` para funciones y variables, `PascalCase` para componentes y tipos, `CONSTANT_CASE` para constantes.
- NT-5 Sin sobreingeniería: ninguna abstracción sin un segundo caso de uso real; ninguna configuración para valores que no cambian; ningún punto de extensión "para el futuro".
- NT-6 Exports: funciones y componentes específicos de un módulo con `export default`; helpers globales y constantes con `export` con nombre y en archivo propio; hooks de React con prefijo `use`, `export default` y archivo propio.

### 8.5 Duplicación y simplicidad (DUP, SIM)

- DUP-1 Cada regla de negocio vive en un solo lugar. La traducción de errores, la identidad y `authorize()` existen una sola vez en `src/server/` y los cuatro proyectos las importan.
- DUP-2 Regla de tres: a la tercera copia de un bloque se extrae; a la segunda se puede.
- DUP-3 No reimplementar lo que ya ofrece la librería, la biblioteca estándar o una dependencia instalada. En particular: no reimplementar la resolución de permisos en el servidor ni en el cliente; `forUser` ya la da.
- DUP-4 Literales con significado (`'HOOK_ERROR'`, límites, códigos propios) en constantes con nombre.
- DUP-5 Guardia: dos bloques que se parecen pero pertenecen a proyectos distintos y cambiarían por motivos distintos no son duplicación. Los cuatro proyectos son deliberadamente independientes; no unifiques sus dominios en un generador común.
- SIM-1 Sin código muerto, imports sin uso ni código comentado.
- SIM-2 Sin condiciones redundantes, sin `if (x) return true; return false`, sin `else` tras `return`.
- SIM-3 Sin capas o funciones que solo delegan.
- SIM-4 Sin parámetros, opciones o ramas que ningún llamador usa.
- SIM-5 Sin código ingenioso: nada de ternarios anidados ni efectos dentro de expresiones.

### 8.6 Funciones y errores (FN, ERR)

- FN-1 Una función, una responsabilidad, un nivel de abstracción. Si describirla exige "y", se divide.
- FN-2 Alrededor de 30 líneas como guía.
- FN-3 Más de tres parámetros → un objeto con campos nombrados. Ningún flag booleano que cambie el comportamiento; dos funciones.
- FN-4 Máximo tres niveles de anidamiento; usar retornos tempranos y extracción.
- FN-5 Sin efectos ocultos: una función llamada `get`/`is`/`find` no escribe; si muta, el nombre lo dice.
- ERR-1 Ningún `catch` vacío ni que solo registre y continúe como si hubiera éxito.
- ERR-2 Los errores de negocio y validación usan el contrato estructurado con código estable; `new Error` solo para fallos inesperados.
- ERR-3 Los resultados esperados no se modelan con excepciones.
- ERR-4 No re-envolver errores perdiendo la causa; quien no puede manejar, propaga.

### 8.7 Estructura y complejidad (MOD, ALG)

- MOD-1 Sin dependencias circulares. Los proyectos no se importan entre sí; `src/server/` no importa de `src/project-*/` salvo los routers en `app.ts`.
- MOD-2 Cada lógica en su capa correcta (equivale a la prohibición dura 1).
- MOD-3 Sin archivos cajón de sastre (`utils.ts`, `helpers.ts`, `common.ts`); el archivo se llama como lo que contiene.
- MOD-4 Nada se promueve a `src/server/` o `src/client/` sin dos consumidores reales.
- ALG-1 Sin consultas o I/O dentro de bucles cuando existe una forma agrupada.
- ALG-2 Bucles anidados sobre colecciones que crecen → indexar con `Map`/`Set`. Colecciones acotadas (roles, métodos) no disparan la regla.
- ALG-3 No recalcular en cada petición lo que es constante (el mapa `forUser` de un usuario puede calcularse por petición porque sus asignaciones cambian; el catálogo `named` no).
- ALG-4 Listados acotados con límite en el store.
- ALG-5 Sin optimizaciones sin medida ni requisito.

### 8.8 Comportamiento del agente y honestidad de entrega (AIS)

Prohibiciones absolutas: inventar archivos, APIs, resultados o requisitos (AIS-3); declarar ejecutada una verificación que no corrió o que falló (AIS-12); entregar stubs, `TODO` o pseudocódigo donde se pidió implementación completa (AIS-13); ocultar fallos con `catch` silenciosos o valores por defecto (AIS-9); añadir dependencias, abstracciones o patrones sin necesidad demostrada (AIS-6, AIS-8); ampliar el alcance sin autorización (AIS-4); presentar un reemplazo mecánico como generalización (AIS-13).

- AIS-1 Cada cambio se corresponde con un requisito de este prompt o con un supuesto declarado. Lo no atribuible se lista como incidental con su motivo.
- AIS-2 Toda decisión que el prompt deja abierta se declara como supuesto: qué, por qué y qué cambia si es incorrecto.
- AIS-3 Toda afirmación sobre el repositorio, la ejecución o las pruebas tiene una fuente abrible: ruta, comando o cita. Lo no verificado se marca "no verificado".
- AIS-4 y AIS-5 Solo se crea `e2e/`. No se modifica nada fuera de `e2e/` (ni `src/`, ni `tests/`, ni `docs/`, ni `README.md`, ni `CLAUDE.md`, ni `.gitignore`, ni el índice de Git ni los cambios preparados que ya existen). Lo que se detecte fuera se entrega como propuesta.
- AIS-6 Cada dependencia añadida a `e2e/package.json` se reporta con versión, necesidad, alternativas rechazadas y licencia.
- AIS-7 Coherencia con los patrones locales: los cuatro proyectos siguen la misma forma de carpetas y de pruebas; una desviación se justifica.
- AIS-8 La solución directa primero; cada abstracción o duplicación deliberada se justifica en el informe.
- AIS-9 Ningún fallback convierte un fallo en éxito aparente; cada uno se lista con lo que observa el llamador.
- AIS-10 No se debilita ningún control (identidad por cabecera, prefijo de rol al guardar, validación de body); ningún secreto en código ni fixtures; toda entrada nueva se valida en su frontera.
- AIS-11 Sin afirmaciones de rendimiento sin medida; la prueba de concurrencia reporta lo que midió y cómo.
- AIS-12 Solo cuenta lo ejecutado en la sesión con su salida real. Lo no ejecutable se declara con el comando que debe correr el usuario.
- AIS-13 Implementación completa en los cuatro proyectos: sin pantallas vacías, sin pruebas de relleno, sin "el resto sigue el mismo patrón".
- AIS-14 La entrega termina con el informe del apartado 10, con todas sus secciones y "none" donde no aplique.

### 8.9 Formato de excepción contextual

Toda desviación de las reglas anteriores se registra en `e2e/docs/architecture.md` con este formato. Si no hay desviaciones, la sección dice "none":

```txt
Exception name:
Related rule:
Context:
Why the exception is needed:
Scope:
Expiration or review date:
Risks:
Required safeguards:
Approved by:
```

### 8.10 Formato de hallazgo en revisión

```txt
Rule: <ID> — <nombre de la regla>
Verdict: INCUMPLIMIENTO | OBSERVACIÓN
Location: <archivo:línea>
Found: <qué hace el código>
Expected: <qué exige la regla>
Fix: <cambio concreto>
```

Cuando falte evidencia para evaluar un disparador, el hallazgo dice `not assessable with the available evidence` y nombra lo que falta.

---

## 9. Skills

### 9.1 Obligatorio, invocado solo por el usuario

- `pro-architecture`: sus reglas están en el apartado 8. No lo invoques; aplícalo. Si el usuario lo invoca, prevalece el contenido vigente del skill sobre el resumen del apartado 8.

### 9.2 Skills globales disponibles que debes invocar

Comprobados en `~/.claude/skills` y en los plugins instalados. Invócalos con la herramienta `Skill` en el momento indicado:

| Skill | Cuándo | Para qué |
| --- | --- | --- |
| `full-output-enforcement` | Al inicio de la fase 1 y de cada sub-agente de la fase 2 | Cuatro proyectos completos sin placeholders, sin "el resto es igual", sin archivos truncados |
| `tdd` | Al inicio de cada proyecto en la fase 2 | Escribir primero la matriz de pruebas de API y de pantallas (las costuras son los endpoints HTTP y el mapa de `/me`) y después la implementación; una prueba que pasa antes de implementar es sospechosa |
| `modern-web-guidance` | Antes de escribir cualquier HTML, CSS o código de cliente en `src/client/` y `src/project-*/client/` | Su descripción lo declara obligatorio para tareas de frontend; evita patrones de plataforma obsoletos |
| `caveman:lean-build` | Al inicio de `project-large` y `project-extra-large` | Delimitar aceptación y no-objetivos antes de construir; los proyectos grandes tienen riesgo de sobreconstrucción |
| `caveman:verify-and-stop` | Fase 3.3 y tras corregir hallazgos de la fase 4 | Convertir los criterios del apartado 11 en el conjunto mínimo de comprobaciones y parar cuando pasen |
| `code-review` (o agente `caveman:cavecrew-reviewer`) | Fase 4 | Revisión por proyecto con el formato 8.10 |
| `security-review` | Después de la fase 3, antes del informe | El objeto de `e2e/` es la autorización; revisar identidad, prefijo de rol, entradas y fugas de `cause` |
| `agent-browser` | Opcional, tras la fase 3 | Verificación visual de las pantallas con dos usuarios por proyecto; no sustituye las pruebas |

### 9.3 Skills que no aplican

`frontend-design`, `design-taste-frontend*`, `high-end-visual-design`, `minimalist-ui`, `redesign-existing-projects`, `web-design-guidelines`, los `gsap-*`, los `hyperframes*` y de video, los `aws-*`, `agents-*`, `brandkit`, `copywriting`, `imagegen*`, `claude-in-chrome` (se prefiere `agent-browser`), `find-skills`. El frontend de `e2e/` es un arnés de pruebas: legible y accesible, sin dirección visual.

---

## 10. Informe de entrega (obligatorio, AIS-14)

Al terminar, entrega este bloque completo. Escribe "none" donde una sección no aplique; nunca la omitas.

```txt
Requirements covered:       <requisito del prompt → archivos>; cambios incidentales con motivo
Assumptions:                <qué / por qué / impacto si es incorrecto>, o "none"
Scope:                      pedido vs cambiado; lista "Proposed, not applied"
Files changed:              modificados / creados / eliminados, uno por línea
Dependencies:               cada una de e2e/package.json: nombre, versión, necesidad, alternativas, licencia
Patterns followed:          archivos o convenciones de referencia; desviaciones
Simplicity decisions:       abstracciones añadidas; generalizaciones no hechas; duplicaciones mantenidas (DUP-5)
Fallbacks and error paths:  cada fallback nuevo y lo que observa el llamador
Security-relevant changes:  controles tocados; entradas nuevas y su validación
Performance:                estimaciones como estimaciones; medidas con sus comandos; o "not measured"
Validations executed:       <comando> → <resultado real>, una por línea
Validations not executed:   <qué> → <por qué> → <comando para el usuario>
Result:                     qué funciona ahora y cómo se ejecuta
Completeness:               "complete" o lista explícita de huecos
Residual risks:             qué podría seguir mal y cómo se manifestaría
Decisions needing approval: excepciones usadas; desviaciones; hallazgos de documentación de la librería
```

Además: la matriz de cobertura del apartado 5.5 rellena y los hallazgos de la fase 4 con su estado (corregido / pendiente con motivo).

---

## 11. Criterios de aceptación

Todo lo siguiente debe ser cierto y estar respaldado por comandos ejecutados en la sesión:

1. `bun run build` en la raíz y `bun install` en `e2e/` terminan sin error; `e2e/node_modules/endpoint-permissions-kit` resuelve a la raíz del repositorio.
2. `bunx pkit generate --check` en `e2e/` sale con 0.
3. `bunx tsc --noEmit` en `e2e/` sale con 0, incluidos los fixtures de `types.test.ts`.
4. `bun test` desde `e2e/` está en verde en los cuatro proyectos; el recuento de pruebas y aserciones se cita tal cual lo imprime `bun`.
5. `bunx vite build` desde `e2e/` termina sin error.
6. `bun run scripts/dev.ts` arranca Express y Vite; `/` lista los cuatro proyectos; cada `/<project>` muestra navegación distinta para al menos dos usuarios simulados.
7. Los mínimos numéricos del apartado 5 se cumplen y se demuestran en `e2e/docs/project-*.md` con la matriz de permisos.
8. La matriz de cobertura del apartado 5.5 no tiene celdas vacías en la fila `extra-large`.
9. Ningún archivo fuera de `e2e/` cambió (`git status` lo demuestra; los cambios preparados que ya existían en el índice se conservan intactos).
10. `e2e/CLAUDE.md` y `e2e/README.md` existen, cubren los apartados 3.1 y 3.2 y no remiten a ningún archivo de la raíz salvo `USAGE.md` como documentación de la librería.
11. Cero comentarios no permitidos en `e2e/` y cero `test.skip`, `TODO`, `any` o placeholders.
