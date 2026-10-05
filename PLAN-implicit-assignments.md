# PLAN: asignaciones implícitas (`assignToAllUsers()` y la name reservada `required`)

**Estado: LISTO.** No quedan decisiones que bloqueen ni investigación esencial pendiente. Las decisiones Q1–Q21 y D1–D5 las confirmó el usuario.

| Dato | Valor |
| --- | --- |
| Fecha | 2026-10-04 |
| Repositorio | `endpoint-permissions-kit`, rama `main`, commit `3fb027f` (`chore: bump version to 0.3.1`). Árbol limpio antes de crear este archivo |
| Entorno verificado | Bun 1.4.2, Node v24.20.0, TypeScript 5.9.3 (`node_modules/typescript`), versión del paquete 0.3.1 |
| Línea base ejecutada | `bun run typecheck`: exit 0. `bun test`: `251 pass, 0 fail, 521 expect() calls, 9 files` |
| CodeGraph | No hay `.codegraph/` en el repo. No se usa (instrucción global de `~/.claude/CLAUDE.md`) |

**Vigencia, antes de empezar.**
1. Ejecuta `git rev-parse --short HEAD` y `git status --short`. Lo esperado: `3fb027f`, y como único cambio `?? PLAN-implicit-assignments.md`.
2. Si `HEAD` difiere, ejecuta `git diff 3fb027f -- src/constants.ts src/registry.ts src/snapshot.ts src/resolve.ts src/validate.ts src/permissions.ts src/module-builder.ts tests/usage-example.test.ts tests/typecheck/roles.ts README.md USAGE.md CHANGELOG.md CLAUDE.md`.
3. Revisa solo los pasos que toquen archivos con diferencias.

---

## 1. Solicitud y trazabilidad

**Solicitud original, resumida.** El usuario guarda en cada usuario todos sus permisos, de negocio y personales. Quiere declarar, según el role y la name, permisos "auto-inyectados" que no se guarden en base. Ejemplos: `/logout` (todo usuario con sesión) y `/sessions` (lista las sesiones del propio perfil). Pide además:
- conservar la validación actual;
- investigar el término de esta práctica;
- alinear el plan con el flujo de `USAGE.md`;
- proponer tres caminos: un caso real, librerías o frameworks y una solución adaptada a esta librería.

| Requisito | Origen | Pasos | Aceptación |
| --- | --- | --- | --- |
| R1. Declarar permisos que tiene todo usuario de un rol, sin guardarlos | Solicitud | 1–7 | T4–T5, T8, U1–U2 |
| R2. Mantener la validación actual | "La validación actual está perfecta" | Todos | Los 251 tests previos pasan sin editar ninguna aserción existente (§11.3) |
| R3. Cubrir `/logout` (todos) y `/sessions` (solo las suyas) | Solicitud | 8, 9 | U1–U4, T4–T8 |
| R4. Investigar el término | Solicitud | §4 | §4 con fuentes fechadas |
| R5. Alinearse con el flujo de `USAGE.md` | Solicitud | 7, 9 | Registro en el archivo de cada módulo con los builders. Sección nueva de USAGE más U1–U6 |
| R6. Tres caminos | Solicitud | §5 | P1, P2 y P3, con código y motivo de la elección |
| R7. Decisiones Q1–Q21 y D1–D5 | Entrevista | §6, §7 | Cada una se refleja en un paso y un test |

## 2. Alcance y exclusiones

**Dentro del alcance**
- `ModuleBuilder.assignToAllUsers()` y la reserva de la name `required`.
- Inyección de las names `required` del rol en `resolve.checkIdentity`.
- Exclusión de `required` en `permissions.forRole`.
- Lista efectiva de identificadores en el argumento `permissions` de los hooks.
- Tests, fixture de tipos y documentación: `USAGE.md`, `README.md`, `CHANGELOG.md` y `CLAUDE.md`.

**Fuera del alcance**
- Filtrar datos por propiedad ("solo mis sesiones"). Lo resuelve la aplicación con un hook y la consulta del handler (Q8). README, "Scope limits": "No database access".
- Adaptadores de framework, acceso a base de datos y descubrimiento de rutas (`CLAUDE.md`, "Do not").
- Subir la versión, publicar o tocar CI (`CLAUDE.md`: "Do not publish"; `.github/workflows/publish.yml` no se toca).
- Una variante "la implícita es solo un mínimo y los grants la amplían" (descartada en Q16).
- Exportar constantes nuevas: `src/index.ts` sigue publicando solo `METHODS`.
- Crear `registerImplicitActions`. Lo reemplaza `assignToAllUsers()` (Q15).

## 3. Contexto verificado

### 3.1 Flujo actual (código en `3fb027f`)

1. **Registro** (`USAGE.md`, "Registration and startup"). El consumidor crea `new Pkit({ roles, cropper, reservedFields })` en `pkit.ts`. Cada archivo de módulo encadena `pkit.module(...).module(...).name(...).role(...).registerActions({...})`. El constructor de `NameBuilder` llama a `identifiers.checkName`. `registry.registerActions` (`src/registry.ts`) guarda las acciones por `module → name → role` y anula el snapshot.
2. **Snapshot diferido.** `snapshot.of` (`src/snapshot.ts:7`) memoiza `snapshot.build`. Este construye:
   - `named`: un `role::module::name` por cada (módulo, name, rol), en el bucle de `src/snapshot.ts:20-24`;
   - `assignable`;
   - `grantsBySource`.

   Después ejecuta los chequeos cruzados (`checkModule`, `checkGrants`, `checkRoleHooks`).
3. **`validate`** (`src/validate.ts`). `run` → `prepareRequest`:
   - valida la forma de la entrada;
   - `resolve.checkIdentity` (`src/resolve.ts:23`) recorre `permissions`: parsea cada id, comprueba el rol (`PERMISSION_ROLE_MISMATCH`), comprueba que sea asignable (`UNKNOWN_PERMISSION`, `src/resolve.ts:42`) y que haya una sola name por módulo (`AMBIGUOUS_PERMISSION`). Devuelve `{ assigned, names }` (`src/resolve.ts:54`);
   - `resolve.resolveAccess` → `resolveName`. Si existe una name directa en `identity.names`, decide ella. Si no, se usan los grants cuyos orígenes están en `identity.assigned`. Si no hay nada: `PERMISSION_NOT_ASSIGNED`;
   - después vienen las propiedades (`deny` o `crop`) y los hooks de módulo, de name y de rol. Reciben `(data, context, permissions)`, donde `permissions` es hoy el array de entrada (`src/validate.ts:84` y `:92`).
4. **Vistas** (`src/permissions.ts`).
   - `forUser` usa `checkIdentity` y `resolveName` sobre cada módulo.
   - `forRole` llama a `checkIdentity(snapshot, role, [])` solo para validar el rol. Luego agrupa las claves de `named` del rol en un árbol (`src/permissions.ts:43`).

**Consecuencia.** `checkIdentity` es el único punto por donde pasan `validate`, `forUser` y `forRole`. Si la inyección se hace ahí, `resolveName`, `resolveAccess` y `properties` no cambian.

### 3.2 Convenciones que aplican (`CLAUDE.md`, `CONTRIBUTING.md`, `tests/architecture.test.ts`)

- Cada módulo de `src/` expone un único `export default`. Solo los archivos de `CLASS_EXPORT_FILES` declaran clases, y `src/module-builder.ts` está entre ellos.
- Sin arrow functions, parámetros por defecto ni bindings por defecto. Lo comprueba `tests/architecture.test.ts` en `src`, `scripts` y `tests`; solo exime los callbacks de `describe` y `test`.
- Sin comentarios en prosa. Se permiten `@ts-expect-error` y JSDoc.
- Línea en blanco entre métodos y entre bloques lógicos.
- Constantes en CONSTANT_CASE dentro de `src/constants.ts`.
- Un cambio de comportamiento requiere un test que falle sin el cambio.
- Un cambio público requiere actualizar `USAGE.md`, `README.md` y `CHANGELOG.md` (paso 3 de "Pull requests" en CONTRIBUTING).
- `USAGE.md` se recortó a propósito a una guía breve, sin teoría ni tablas (prompt eliminado en `74228c4`, `prompt-simplificar-usage.md`). La sección nueva respeta ese tamaño.

### 3.3 Datos que fijan decisiones

- Ningún test ni documento usa hoy la name `required`. Verificado con `grep -rn "'required'\|::required" tests README.md USAGE.md`, sin resultados. En `src/` solo aparece la palabra en los mensajes `'role is required'` y `'action is required'`.
- Los tests que capturan el argumento `permissions` de los hooks comparan con `toEqual` y no usan implícitas: `tests/validate.test.ts:85`, `:206-207`, `:609` y `tests/security.test.ts:375`. Ninguno compara la identidad del array.
- `README.md:68` dice "A role alone authorizes nothing." Con esta feature deja de ser cierto y hay que corregirlo (paso 9).

## 4. Investigación: el concepto y su nombre

No existe un término estándar "permisos inyectados". La práctica, conceder algo a todo miembro de un grupo o rol sin guardarlo por usuario, aparece con estos nombres. Todas las fuentes se consultaron el 2026-10-04.

| Fuente | Nombre | Qué dice | Relevancia |
| --- | --- | --- | --- |
| Discord, [Permissions](https://docs.discord.com/developers/topics/permissions) | `@everyone` y base permissions | "The `@everyone` role has the same ID as the guild it belongs to." El pseudocódigo `compute_base_permissions` empieza con `role_everyone.permissions` y luego aplica OR con `member.roles`. Que el rol no esté en la lista de cada miembro es una inferencia del pseudocódigo | Caso real de permisos calculados, no guardados por miembro (P1) |
| GitHub, [Setting base permissions](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/setting-base-permissions-for-an-organization) | Base permissions | "You can set base permissions that apply to all members of an organization…" y "…the higher level of access overrides the base permission." | Modelo de "la guardada gana" (Q3) |
| Microsoft, [Special identity groups](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/understand-special-identities-groups) (actualizado 2026-02-16) | Special identity groups ("Authenticated Users", SID `S-1-5-11`) | "you can't view or modify the membership of a special identity group… Users are automatically assigned to special identity groups when they sign in." y "Membership is controlled by the operating system." | La pertenencia la calcula el sistema y no se guarda (equivale a `/logout`) |
| Keycloak, default roles ([Red Hat build of Keycloak 22, roles and groups](https://docs.redhat.com/en/documentation/red_hat_build_of_keycloak/22.0/html/server_administration_guide/assigning_permissions_using_roles_and_groups); [Server Admin 26.8.0](https://www.keycloak.org/docs/latest/server_admin/)) | Default roles (`default-roles-<realm>`) | Rol compuesto que se asigna a cada usuario al crearlo o importarlo. **Verificado solo en parte:** la descarga de la guía 26.8.0 llegó truncada. El dato procede del resumen de búsqueda de la guía de Red Hat | Se **guarda** una asignación por usuario, pero su contenido se gestiona en un solo lugar (P2) |
| OpenFGA, [Public access](https://openfga.dev/docs/modeling/public-access) | Type-bound public access (`user:*`) | Una sola tupla `{ user: "user:*", relation: "view", object: "document:…" }` sirve para todos los usuarios del tipo | Una declaración en lugar de una por usuario (P2) |
| [`accesscontrol`](https://github.com/onury/accesscontrol), npm 3.1.1 (publicado 2026-09-24) | Grants por rol en código; posesión *own* o *any* | `ac.grant('user').createOwn('video')…`; `.extend('user')`. Los grants se definen en código y no por usuario | Modelo para P3. *own* = el alcance de `/sessions` |
| [CASL](https://github.com/stalniy/casl/blob/master/packages/casl-ability/README.md), `@casl/ability` 7.0.1 (publicado 2026-07-06) | Reglas calculadas | `can('manage', 'BlogPost', { author: user.id })` dentro de `defineAbilitiesFor(user)` | Reglas calculadas en código y alcance por propiedad |
| Supabase, [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) | Roles `anon` y `authenticated` + RLS | `create policy "Individuals can view their own todos." on todos for select to authenticated using ( (select auth.uid()) = user_id );` | Separa *quién puede* (rol) de *qué filas* (propiedad). Es el patrón de Q8 |

Las versiones de npm salen de `https://registry.npmjs.org/<paquete>` (`dist-tags.latest` y `time`), consultado el 2026-10-04. No hace falta instalar ninguna: la investigación es conceptual y la solución no añade dependencias.

**Conclusiones**
1. El término elegido es ***implicit assignment*** (asignación implícita), Q1. En esta librería, *assignment* es el identificador que la aplicación guarda (`README.md:68`). Una asignación implícita la sostiene la librería sin que nadie la guarde.
2. "Default" se descartó: en Keycloak, el default sí se guarda al crear el usuario.
3. "Base" se descartó: sugiere un mínimo que se suma a otros permisos. Aquí hay una sola name por `role::module`.
4. Una asignación implícita **no es un rol implícito**. El usuario sigue necesitando el rol, y `README.md:66` ("There is no implicit role anywhere") sigue siendo cierto.
5. `/logout` es **autorización** pura. `/sessions` es autorización más **alcance** (solo las suyas). La librería cubre la autorización. El alcance se resuelve con un hook y el filtro del handler (Q8), igual que en Supabase RLS y en el *own* de `accesscontrol`.

## 5. Caminos

### P1. Caso real: capa base en la aplicación (Discord `@everyone`, GitHub base permissions)

La aplicación une, al cargar la sesión, los permisos guardados con una lista base por rol. **Funciona hoy sin cambiar la librería.**

```js
const BASE_PERMISSIONS = {
  admin: ['admin::account.logout::all'],
  staff: ['staff::account.logout::all', 'staff::account.sessions::own'],
  public: [],
};

const permissions = [...storedPermissions, ...BASE_PERMISSIONS[session.role]];
```

- **A favor:** cero cambios en la librería; se puede revertir al instante.
- **En contra:**
  - Hay dos fuentes de verdad (la lista y la definición).
  - Un error de tipeo en la lista hace que **todas** las peticiones de todos los usuarios del rol fallen con `UNKNOWN_PERMISSION` (`src/resolve.ts:42`).
  - Si se guarda otra name del mismo módulo, da `AMBIGUOUS_PERMISSION`: no hay "la guardada gana".
  - `forRole` las lista como asignables, lo que invita a guardarlas.
  - `forUser` solo las ve si la aplicación repite la unión.
- **Uso en este plan:** respaldo temporal en la reversión (§15).

### P2. Librerías y frameworks: una asignación compuesta (Keycloak default roles, OpenFGA `user:*`)

Se guarda **una** fila por usuario, `staff::account.base::all`, y se da acceso a `logout` y `sessions` con los `grantTo` que ya existen. **Funciona hoy.**

```js
const base = pkit.module('account').module('base').name('all');

base.role('staff').registerActions({ find: { enabled: true, properties: [] } });

const logout = pkit.module('account').module('logout').name('all');

logout.role('staff').registerActions({ create: { enabled: true, properties: [] } });
logout.grantTo('staff::account.base::all').registerActions({ create: { enabled: true, properties: [] } });
```

- **A favor:** sin cambios en la librería; el contenido se gestiona en un solo lugar.
- **En contra:**
  - Sigue guardando una fila por usuario, y el requisito es no guardar.
  - Obliga a insertarla al crear cada usuario y a migrar a todos los existentes.
  - Los grants exigen listar las propiedades (sin `'*'`, `src/definitions.ts:37`).
  - Los grants ceden ante una asignación directa y solo alcanzan un salto.
  - Necesita un módulo `base` artificial.
- **Descartado:** incumple R1.

### P3. Adaptado a la librería (elegido): `assignToAllUsers()` y la name reservada `required`

Inspirado en los grants por rol en código (`accesscontrol`, CASL), en la pertenencia calculada (Discord, Windows) y en "la explícita gana" (GitHub).

```js
const logout = pkit.module('account').module('logout').assignToAllUsers();

logout.role('staff').registerActions({ create: { enabled: true, properties: [] } });
```

- **A favor:**
  - Una sola fuente de verdad, junto a la definición, en el archivo del módulo (flujo de `USAGE.md`).
  - El identificador sale de la cadena, así que no se puede escribir mal.
  - `forUser` y `forRole` quedan coherentes.
  - Los chequeos diferidos actuales cubren `required` sin cambios.
  - "La guardada gana" permite migrar sin cortes.
- **En contra:**
  - Reservar `required` es un cambio breaking (Q19).
  - Los hooks reciben un array nuevo cuando hay inyección (Q20).

**Decisión: P3.** P1 y P2 quedan documentados aquí como alternativas que funcionan hoy.

## 6. Decisiones cerradas

| Id | Decisión |
| --- | --- |
| Q1 | El concepto se llama *implicit assignment*. Plan: `PLAN-implicit-assignments.md` |
| Q2 → Q15 | Se declara en el builder. `assignToAllUsers()` reemplaza a `registerImplicitActions`, que no se crea |
| Q3 / Q10 | **La guardada gana** (modelo GitHub). Una name guardada del mismo módulo reemplaza a `required` para ese usuario. `.name('required')` está prohibido; `assignToAllUsers()` devuelve el `NameBuilder` de `required`, con los mismos métodos que `.name(...)` |
| Q4 | Una implícita activa grants, igual que una guardada. Con test y advertencia en la documentación |
| Q5 / Q12 / Q20 | Los hooks reciben la lista efectiva: la entrada sin tocar, más al final las implícitas que se aplicaron y que no estaban en la entrada. Si no se aplicó ninguna, el mismo array por referencia |
| Q6 | `forUser` las incluye, `named` las conserva y `forRole` las excluye |
| Q7 / Q17 | Una fila guardada `…::required` se acepta (tras el chequeo de `assignable`) y se ignora, sin efecto |
| Q8 | La propiedad de los datos queda fuera de la librería: hook de rol sobre `context.user` y filtro en el handler |
| Q9 | P1 y P2 documentados con código; P3 se implementa |
| Q16 | Precedencia: **guardada directa > implícita > grants**. Una implícita reemplazada no entra en `assigned` y no activa grants |
| Q18 | Migración de filas en 4 pasos, con copia de los hooks (§15) |
| Q19 | Breaking en `CHANGELOG.md` `[Unreleased]`, sin subir versión ni publicar |
| Q21 | `constants.NAME_FOR_ALL_USERS_PERMISSIONS = 'required'`, nunca `'all'`: `'all'` es la name de USAGE y de los tests, y reservarla escalaría privilegios |
| D1 | El snapshot precalcula `requiredByRole` en el mismo bucle que construye `named` |
| D2 | `Identity` gana `injected: readonly string[]` |
| D3 | Tests: `tests/assign-to-all-users.test.ts` nuevo, un `describe` nuevo en `tests/usage-example.test.ts` y casos nuevos en `tests/typecheck/roles.ts` |
| D4 | Documentación: `USAGE.md` (sección breve), `README.md`, `CHANGELOG.md` y `CLAUDE.md` |
| D5 | Plan en español, estado LISTO |

## 7. Contrato nuevo

### 7.1 API pública

- `ModuleBuilder<R>.assignToAllUsers(): NameBuilder<R>`.
  - Ligado en el constructor, como los demás métodos.
  - Devuelve siempre el mismo `NameBuilder`: el de la name `required`, guardado en la misma caché `#names` del módulo.
  - Ese builder tiene `role`, `grantTo` y `hook`, sin cambios.
- `ModuleBuilder<R>.name('required')` lanza un `PkitError` con código `INVALID_DEFINITION` y el mensaje `Permission name required is reserved: use assignToAllUsers()`. Lo lanza antes de mirar la caché, así que también falla después de `assignToAllUsers()`.
- Tipos públicos: no cambia ninguno de `src/types.ts`. `ModuleBuilder` ya se exporta como tipo desde `src/index.ts`, así que el método nuevo aparece solo en `dist/types`.
- Identificadores: `role::module::required` es válido para `identifiers.parse`. Sirve como clave de `named` y de `forUser`, y como origen de `grantTo`.

### 7.2 Semántica de la resolución (`resolve.checkIdentity`)

Orden por cada petición o llamada a una vista:

1. Se recorre la entrada igual que hoy: parseo (`INVALID_INPUT`), rol (`PERMISSION_ROLE_MISMATCH`) y asignable (`UNKNOWN_PERMISSION`).
2. **Nuevo:** si `reference.name === 'required'`, la fila se ignora (`continue`) y no entra en `names` ni en `assigned` (Q17).
3. El resto sigue igual que hoy: chequeo `AMBIGUOUS_PERMISSION`, `assigned.add` y `names.set`.
4. **Nuevo:** tras el bucle, se recorre `snapshot.requiredByRole.get(role)` en orden de registro. Por cada referencia cuyo módulo **no** esté en `names`: `assigned.add(id)`, `names.set(module, 'required')` e `injected.push(id)`.
5. Se devuelve `{ assigned, names, injected }`.

Consecuencias, sin tocar `resolveName` ni `resolveAccess`:
- Una guardada directa gana porque ya está en `names` (Q3).
- Una implícita cuenta como directa y gana a los grants (Q16).
- Una implícita activa grants porque está en `assigned` (Q4).
- Una implícita reemplazada no activa grants (Q16).
- Un rol sin acciones en `required` no recibe nada, porque solo los roles con acciones generan claves en `named`.

### 7.3 Errores

- No hay códigos nuevos.
- `validate()` sigue sin lanzar nunca.
- `.name('required')` lanza durante el registro, como cualquier `INVALID_DEFINITION`.
- Los chequeos diferidos existentes se aplican también a `required`. Por ejemplo, un hook sin acciones da `VALIDATION_ERROR` con `cause.code === 'INVALID_DEFINITION'`.
- La documentación de `PERMISSION_NOT_ASSIGNED` se amplía: ahora también significa que no hay `required` del módulo para ese rol.

### 7.4 Vistas y hooks

- **`permissions.forUser`:** incluye las claves `…::required` que se aplicaron. No hay cambio de código: lo da `checkIdentity`.
- **`permissions.forRole`:** omite las referencias con name `required`. Un módulo que solo tiene `required` no aparece en el árbol.
- **`permissions.named`:** sin cambios. Incluye `…::required`.
- **Hooks:** reciben `effectivePermissions(entrada, identity.injected)`. Es la entrada tal cual si `injected` está vacío; si no, un array nuevo con la entrada más las inyectadas que no estaban en ella.

## 8. Restricciones y reglas aplicadas

`pro-architecture` (v0.3.0) se **consultó leyendo sus archivos** (`~/.claude/skills/pro-architecture/SKILL.md` y `references/`). No se invocó, y el ejecutor tampoco debe invocarla: solo el usuario la activa. Reglas que aplican:

| Regla | Cómo se cumple |
| --- | --- |
| NT-5 / AIS-8 (sin abstracciones innecesarias) | Sin flag, sin clave de contexto y sin método `registerImplicitActions`. La marca implícita es solo `name === 'required'` |
| NT-6 y la forma de exportación del proyecto | Ningún módulo gana exportaciones. La constante vive en `src/constants.ts` y no se publica |
| NT-4 (nombres) | `NAME_FOR_ALL_USERS_PERMISSIONS` (CONSTANT_CASE), `assignToAllUsers`, `requiredByRole`, `injected`, `effectivePermissions` |
| FN-3 (≤3 parámetros) | Los helpers nuevos reciben 2 parámetros |
| FN-4 (≤3 niveles de anidamiento) | `snapshot.build` ya tiene 3 `for` anidados. La condición `required` va en el helper `addRequired`, no inline. Por eso no se aplica aquí la regla de `CLAUDE.md` de dejar inline un helper trivial de un solo uso: la anidación lo impide |
| DUP-2 | `name()` y `assignToAllUsers()` comparten la caché mediante el método privado `#nameBuilder`. Justificación: usa el estado privado `#names`, `#registry` y `#path`. No es lógica pura que migra a una clase, que es el riesgo nombrado en la excepción de clases de `CLAUDE.md`. Una función de módulo necesitaría 4 parámetros (FN-3) |
| DUP-4 | El literal `'required'` aparece solo en `src/constants.ts` |
| SIM-1 | No queda código muerto ni el método descartado |
| COM-1 / Prohibición 4 | Sin comentarios. Solo se permite `// @ts-expect-error` en la fixture de tipos |
| ERR-2 | Contrato de errores intacto (§7.3) |
| ALG-3 / AIS-11 | `requiredByRole` se calcula una vez por snapshot memoizado. Por petición se suma un recorrido O(r), donde r es el número de `required` del rol. Los hooks suman O(p·r) con `includes`; p y r están acotados por los registros y la entrada. Es una estimación, no una medición |
| AIS-1/2/3 | Trazabilidad en §1, supuestos en §17, evidencia con rutas y comandos |
| AIS-4/5 | Solo los archivos de §16.1. No se edita ninguna aserción existente (§11.3) |
| AIS-6 | Sin dependencias nuevas |
| AIS-7 | Se siguen los patrones de los hermanos: caché de builders en `src/module-builder.ts`, el patrón `get ?? [] / set / push` de `pushHook` en `src/registry.ts`, los tests de `tests/validate.test.ts` (`capturePermissions`) y los de `tests/security.test.ts` (`codesOf`) |
| AIS-9 | Ignorar una fila `…::required` es un efecto nulo documentado en el contrato (§7.2): nunca amplía el acceso, porque la vuelve a inyectar solo si el rol tiene acciones |
| AIS-10 | §14 |
| AIS-12/14 | El ejecutor entrega el informe de §18 y solo declara las validaciones que ejecutó |
| Backend: autorización | La autorización sigue en el servidor. `role` sigue saliendo de la sesión confiable (README, Concepts) |

## 9. Capacidades y herramientas para el ejecutor

- **Herramientas:** Bun 1.4.2 (`bun test`, `bun run typecheck`, `bun run build`) y Node para la prueba rápida de `dist/`. No hacen falta MCP, red ni navegador.
- **Skill opcional `tdd`:** sirve para el ciclo red-green: escribir T1–T22 primero y verlos fallar. Es opcional; el orden de §10 ya es test-first.
- **`pro-architecture`:** sus reglas están incorporadas en §8. No invocarla.
- **CodeGraph:** no aplica (no hay `.codegraph/`).
- **Subagentes:** no son necesarios (§16).
- **Durante la planificación:** se usó un único fork (`/btw`), iniciado por el usuario, para responder la ronda 1. Sus citas de tests se comprobaron con `sed`.

## 10. Pasos de implementación

Ejecuta todo desde la raíz del repositorio. El orden es test-first: paso 0, luego 1–7 (código) y 8–9 (documentación).

### Paso 0. Escribir los tests en rojo

- **Depende de:** nada.
- **Archivos:** crear `tests/assign-to-all-users.test.ts` (§11.1) y añadir el `describe` nuevo a `tests/usage-example.test.ts` (§11.2).
- **Aceptación:** `bun test tests/assign-to-all-users.test.ts` falla con `TypeError` (`assignToAllUsers is not a function`). Anota la salida real para el informe.

### Paso 1. Constante

- **Depende de:** nada.
- **Archivo:** `src/constants.ts`. Tras `GENERAL_ROLE: 'general',` (línea 4), y con una línea en blanco antes y después, añade:
  ```ts
  NAME_FOR_ALL_USERS_PERMISSIONS: 'required',
  ```
- **Aceptación:** `grep -rn "'required'" src` muestra solo `src/constants.ts`.

### Paso 2. Tipo `Snapshot` y construcción del índice (D1)

- **Depende de:** el paso 1. Haz 2a y 2b juntos: sin los dos, `typecheck` falla.
- **2a. `src/registry.ts`, `interface Snapshot` (líneas 25-31).** Añade, tras `grantsBySource`:
  ```ts
  readonly requiredByRole: ReadonlyMap<string, readonly PermissionReference[]>;
  ```
  `PermissionReference` ya se importa como tipo en la línea 1.
- **2b. `src/snapshot.ts`.**
  1. Imports. Añade `import type { PermissionReference } from './identifiers';` antes del import de `./registry`, y `import constants from './constants';` antes de `import errors`.
  2. En `build`, declara `const requiredByRole = new Map<string, PermissionReference[]>();` junto a `named`.
  3. Convierte la línea 22 en un bloque:
     ```ts
     for (const [role, actions] of nameEntry.actions) {
       const permissionId = identifiers.build(role, modulePath, name);

       named[permissionId] = actions;
       addRequired(requiredByRole, { id: permissionId, role, module: modulePath, name });
     }
     ```
  4. Añade `requiredByRole,` al `Object.freeze({...})` de retorno, tras `grantsBySource,`.
  5. Añade este helper a nivel de módulo, debajo de `export default snapshot;` y antes de `checkModule`:
     ```ts
     function addRequired(requiredByRole: Map<string, PermissionReference[]>, reference: PermissionReference): void {
       if (reference.name !== constants.NAME_FOR_ALL_USERS_PERMISSIONS) return;

       const references = requiredByRole.get(reference.role) ?? [];

       requiredByRole.set(reference.role, references);
       references.push(Object.freeze(reference));
     }
     ```
- **Contrato:** las listas por rol siguen el orden de registro (orden de inserción de `target.modules`, luego de `names` y luego de `actions`).
- **Aceptación:** `bun run typecheck` termina con exit 0.

### Paso 3. Inyección en `checkIdentity` (Q3, Q16, Q17, D2)

- **Depende de:** el paso 2.
- **Archivo:** `src/resolve.ts`.
  1. Añade `import constants from './constants';` antes de `import errors`.
  2. Añade `readonly injected: readonly string[];` a `interface Identity` (línea 6).
  3. En `checkIdentity`, después de la línea 42 (chequeo de `assignable`) y antes de `const held`, añade, separado por líneas en blanco:
     ```ts
     if (reference.name === constants.NAME_FOR_ALL_USERS_PERMISSIONS) continue;
     ```
  4. Reemplaza `return { assigned, names };` (línea 54) por:
     ```ts
     const injected: string[] = [];

     for (const reference of snapshot.requiredByRole.get(role) ?? []) {
       if (names.has(reference.module)) continue;

       assigned.add(reference.id);
       names.set(reference.module, reference.name);
       injected.push(reference.id);
     }

     return { assigned, names, injected };
     ```
- **Aceptación:** `bun run typecheck` termina con exit 0. Los tests previos de `tests/validate.test.ts`, `tests/security.test.ts` y `tests/permissions.test.ts` siguen pasando: `bun test tests/validate.test.ts tests/security.test.ts tests/permissions.test.ts` da 0 fail.

### Paso 4. Permisos de los hooks (Q20)

- **Depende de:** el paso 3.
- **Archivo:** `src/validate.ts`.
  1. En `prepareRequest`, tras `const access = …` (línea 71), añade `const heldPermissions = effectivePermissions(permissions, identity.injected);`.
  2. En los dos `return` (líneas 84 y 92), cambia `permissions` por `permissions: heldPermissions`.
  3. Añade el helper a nivel de módulo, tras `readOptionalObject`:
     ```ts
     function effectivePermissions(permissions: readonly string[], injected: readonly string[]): readonly string[] {
       if (injected.length === 0) return permissions;

       const effective = [...permissions];

       for (const permissionId of injected) {
         if (!permissions.includes(permissionId)) effective.push(permissionId);
       }

       return effective;
     }
     ```
- **Aceptación:** T15–T18 en verde tras el paso 7. `tests/validate.test.ts:85`, `:206-207` y `:609` y `tests/security.test.ts:375` siguen pasando sin cambios.

### Paso 5. `forRole` excluye `required` (Q6)

- **Depende de:** el paso 1.
- **Archivo:** `src/permissions.ts`, línea 43. La condición pasa a ser:
  ```ts
  if (reference === null || reference.role !== role || reference.name === constants.NAME_FOR_ALL_USERS_PERMISSIONS) continue;
  ```
  `constants` ya está importado.
- **Aceptación:** T21 y U5.

### Paso 6. Sin cambios en `resolveName`, `resolveAccess`, `properties`, `types` ni `index`

- **Aceptación:** `git diff --stat` no lista `src/properties.ts`, `src/types.ts`, `src/index.ts`, `src/definitions.ts`, `src/identifiers.ts`, `src/name-builder.ts`, `src/role-builder.ts`, `src/grant-builder.ts`, `src/pkit.ts` ni `src/errors.ts`.

### Paso 7. `ModuleBuilder.assignToAllUsers()` y la name reservada (Q15, Q3)

- **Depende de:** el paso 1.
- **Archivo:** `src/module-builder.ts`.
  1. Imports, siguiendo el orden de los hermanos (clases primero, luego objetos en orden alfabético): `NameBuilder`, `constants`, `errors`, `identifiers`, `registry`.
  2. En el constructor, entre `this.name = …` y `this.hook = …`, añade `this.assignToAllUsers = this.assignToAllUsers.bind(this);`.
  3. Reemplaza el cuerpo de `name` (líneas 41-51) y añade los métodos nuevos. El privado va al final de la clase:
     ```ts
     name(name: string): NameBuilder<R> {
       if (name === constants.NAME_FOR_ALL_USERS_PERMISSIONS) {
         throw errors.create('INVALID_DEFINITION', `Permission name ${name} is reserved: use assignToAllUsers()`);
       }

       return this.#nameBuilder(name);
     }

     assignToAllUsers(): NameBuilder<R> {
       return this.#nameBuilder(constants.NAME_FOR_ALL_USERS_PERMISSIONS);
     }

     hook(method: Method, fn: HookFn): this { …sin cambios… }

     #nameBuilder(name: string): NameBuilder<R> {
       const existing = this.#names.get(name);

       if (existing !== undefined) return existing;

       const created = new NameBuilder<R>(this.#registry, identifiers.joinModule(this.#path), name);

       this.#names.set(name, created);

       return created;
     }
     ```
- **No toques `identifiers.checkName`:** el constructor de `NameBuilder` la usa, y si rechazara `required` bloquearía a `assignToAllUsers()`.
- **Aceptación:**
  - `bun run typecheck` termina con exit 0.
  - `bun test` da 0 fail. T1–T22 y U1–U6 en verde.
  - `bun test tests/architecture.test.ts` en verde: sin arrows, sin defaults y una sola exportación por defecto.

### Paso 8. Fixture de tipos

- **Depende de:** el paso 7.
- **Archivo:** `tests/typecheck/roles.ts`. Dentro de `verifyRoleContracts`, tras el bloque de `items` y antes de `const identity`, añade:
  ```ts
  const logout = pkit.module('account').module('logout').assignToAllUsers();
  logout.role('staff').registerActions({ create: { enabled: true, properties: [] } });
  logout.role('admin').hook('create', inspectHookArguments);
  // @ts-expect-error
  logout.role('adminn');
  ```
- **Límite:** `.name('required')` no puede fallar al compilar (TypeScript no excluye un literal de `string`). Solo se prueba en runtime (T2).
- **Aceptación:** `bun run typecheck` termina con exit 0 y `bun test tests/typecheck.test.ts` pasa.

### Paso 9. Documentación (textos en §12)

- **Depende de:** los pasos 1–8.
- **Archivos:** `USAGE.md`, `README.md`, `CHANGELOG.md` y `CLAUDE.md`, con los textos exactos de §12.
- **Aceptación:**
  - `grep -n "A role alone authorizes nothing" README.md` no devuelve nada.
  - El ancla `#registration-and-startup` sigue existiendo (README la enlaza).
  - El árbol de `forRole` en USAGE no cambia y U5 lo comprueba.

## 11. Tests con resultados esperados

### 11.1 `tests/assign-to-all-users.test.ts` (nuevo)

Los imports siguen el estilo de los tests hermanos: `import { describe, expect, test } from 'bun:test'`, `import type { Context, Data, ValidationError } from '../src/types'` e `import Pkit from '../src/index'`. Define helpers locales con `function`, nunca con arrow: `codesOf` (copia el de `tests/security.test.ts:663`) y `capturePermissions(captured, _data, _context, permissions)` (como en `tests/validate.test.ts:577`).

**El setup debe respetar este orden exacto**, porque los resultados esperados dependen del orden de inserción:

```ts
const STAFF_LOGOUT = 'staff::account.logout::required';
const ADMIN_LOGOUT = 'admin::account.logout::required';
const STAFF_SESSIONS_REQUIRED = 'staff::account.sessions::required';
const STAFF_SESSIONS_ALL = 'staff::account.sessions::all';
const STAFF_PROFILE = 'staff::account.profile::all';
const STAFF_SUPPORT = 'staff::support::all';
const PUBLIC_CATALOG = 'public::catalog::all';

function setupAccount(captured: (readonly string[])[]) {
  const pkit = new Pkit({ roles: ['admin', 'staff', 'public'] });
  const account = pkit.module('account');
  const logout = account.module('logout').assignToAllUsers();
  const sessions = account.module('sessions');
  const sessionsRequired = sessions.assignToAllUsers();
  const sessionsAll = sessions.name('all');
  const profile = account.module('profile').name('all');
  const support = pkit.module('support').name('all');
  const catalog = pkit.module('catalog').name('all');
  const capture = capturePermissions.bind(null, captured);

  logout.role('staff').registerActions({ create: { enabled: true, properties: [] } });
  logout.role('admin').registerActions({ create: { enabled: true, properties: [] } });

  sessionsRequired.role('staff').registerActions({ find: { enabled: true, properties: ['id', 'device'] } });
  sessionsAll.role('staff').registerActions({
    find: { enabled: true, properties: ['id', 'device', 'userId'] },
    remove: { enabled: true, properties: ['id'] },
  });

  profile.role('admin').registerActions({ find: { enabled: true, properties: '*' } });
  profile.grantTo(STAFF_SESSIONS_REQUIRED).registerActions({ find: { enabled: true, properties: ['id'] } });

  support.role('staff').registerActions({ find: { enabled: true, properties: '*' } });
  sessionsAll.grantTo(STAFF_SUPPORT).registerActions({ find: { enabled: true, properties: ['id', 'device', 'userId'] } });

  catalog.role('public').registerActions({ find: { enabled: true, properties: ['id'] } });

  sessionsRequired.role('staff').hook('find', capture);
  sessionsAll.role('staff').hook('find', capture);
  catalog.role('public').hook('find', capture);

  return { pkit, account };
}
```

`acc(...)` abrevia en esta tabla un `MethodAccessMap`, por ejemplo `{ find: true, update: false, create: false, remove: false }`. Los resultados se derivaron leyendo el código en `3fb027f` y **no se han ejecutado** (§17).

| Id | Caso | Llamada | Resultado esperado |
| --- | --- | --- | --- |
| T1 | Caché | `account.module('logout').assignToAllUsers()` dos veces | La misma instancia (`toBe`) |
| T2 | Name reservada | `account.module('x').name('required')`, también después de `assignToAllUsers()` en ese módulo | `toThrow(/reserved: use assignToAllUsers\(\)/)` y `toThrow(expect.objectContaining({ code: 'INVALID_DEFINITION', name: 'PkitError' }))` |
| T3 | Los chequeos diferidos cubren `required` | Instancia aparte: `pkit.module('x').assignToAllUsers().hook('find', fn)` sin acciones; luego `validate` con cualquier petición válida | `errors[0]` con `code: 'VALIDATION_ERROR'`, `message: 'registry has invalid definitions'` y `cause.code === 'INVALID_DEFINITION'` |
| T4 | Logout sin filas | staff, `permissions: []`, `account.logout`, `create`, `data: {}` | `{ result: { data: {} }, errors: [] }` |
| T5 | Otro rol con `required` | admin, `[]`, `account.logout`, `create` | `errors: []` |
| T6 | Rol sin `required` | public, `[]`, `account.logout`, `create` | `codesOf` = `['PERMISSION_NOT_ASSIGNED']` |
| T7 | Aislamiento por rol | admin, `[]`, `account.sessions`, `find` | `['PERMISSION_NOT_ASSIGNED']` |
| T8 | `required` decide | staff, `[]`, `account.sessions`, `find`, con `{ id: 1, device: 'd' }`, luego `{ id: 1, userId: 2 }`, luego `remove` con `{ id: 1 }` | `errors: []`; luego `PROPERTIES_NOT_ALLOWED` con `fields: ['userId']`; luego `['METHOD_DISABLED']` |
| T9 | La guardada gana (Q3) | staff, `[STAFF_SESSIONS_ALL]`, `find` con `{ id: 1, userId: 2 }`, luego `remove` con `{ id: 1 }` | `errors: []` en ambos |
| T10 | Implícita antes que grants (Q16) | staff, `[STAFF_SUPPORT]`, `account.sessions`, `find`, `{ id: 1, userId: 2 }` | `PROPERTIES_NOT_ALLOWED`, `fields: ['userId']` |
| T11 | Fila `required` ignorada (Q17) | staff, `[STAFF_SESSIONS_REQUIRED, STAFF_SESSIONS_ALL]`, `find`, `{ userId: 2 }`; luego `[STAFF_SESSIONS_REQUIRED]` con el mismo `data` | `errors: []`, sin `AMBIGUOUS_PERMISSION`; luego `PROPERTIES_NOT_ALLOWED` con `['userId']` |
| T12 | Filas inválidas siguen fallando cerrado | public, `['public::account.logout::required']`; staff, `['admin::account.logout::required']` | `['UNKNOWN_PERMISSION']`; `['PERMISSION_ROLE_MISMATCH']` |
| T13 | Implícita como origen de grant (Q4) | staff, `[]`, `account.profile`, `find`, `{ id: 1 }`, luego `{ id: 1, email: 'x' }`; staff, `[STAFF_SESSIONS_ALL]`, `account.profile`, `find`, `{ id: 1 }` | `errors: []`; luego `PROPERTIES_NOT_ALLOWED` con `['email']`; la última da `['PERMISSION_NOT_ASSIGNED']` porque la implícita reemplazada no activa el grant |
| T14 | Migración (Q18) | Misma instancia: usuario A `[STAFF_SESSIONS_ALL]` y usuario B `[]`, ambos `find` con `{ id: 1, userId: 2 }` | A: `errors: []`. B: `PROPERTIES_NOT_ALLOWED` con `['userId']` |
| T15 | Hooks sin entrada (Q20) | staff, `[]`, `account.sessions`, `find`, `{ id: 1 }` | `captured[0]` `toEqual` `[STAFF_LOGOUT, STAFF_SESSIONS_REQUIRED]` |
| T16 | Hooks sin duplicados | staff, `[STAFF_SESSIONS_REQUIRED]`, igual | `[STAFF_SESSIONS_REQUIRED, STAFF_LOGOUT]` |
| T17 | Hooks solo con las aplicadas | staff, `[STAFF_SESSIONS_ALL]`, `find`, `{ id: 1 }` | `[STAFF_SESSIONS_ALL, STAFF_LOGOUT]` |
| T18 | Mismo array sin inyección | `const input = [PUBLIC_CATALOG]`; public, `catalog`, `find`, `{ id: 1 }` | `captured[0]` `toBe(input)` |
| T19 | `forUser` sin filas (Q6) | `forUser({ role: 'staff', permissions: [] })` | `toEqual({ [STAFF_LOGOUT]: acc(create), [STAFF_SESSIONS_REQUIRED]: acc(find), [STAFF_PROFILE]: acc(find) })` |
| T20 | `forUser` con la guardada | `forUser({ role: 'staff', permissions: [STAFF_SESSIONS_ALL] })` | `toEqual({ [STAFF_LOGOUT]: acc(create), [STAFF_SESSIONS_ALL]: acc(find, remove) })` |
| T21 | `forRole` excluye `required` | `forRole('staff')` y `forRole('admin')` | staff: `{ modules: [{ name: 'account', identifier: 'account', actions: [], modules: [{ name: 'sessions', identifier: 'sessions', actions: [{ name: 'all', identifier: 'all', resourceName: STAFF_SESSIONS_ALL }] }] }, { name: 'support', identifier: 'support', actions: [{ name: 'all', identifier: 'all', resourceName: STAFF_SUPPORT }] }] }`. admin: `{ modules: [{ name: 'account', identifier: 'account', actions: [], modules: [{ name: 'profile', identifier: 'profile', actions: [{ name: 'all', identifier: 'all', resourceName: 'admin::account.profile::all' }] }] }] }` |
| T22 | `named` las conserva | `Object.keys(pkit.permissions.named)` | Contiene `STAFF_LOGOUT`, `ADMIN_LOGOUT` y `STAFF_SESSIONS_REQUIRED` |

### 11.2 `tests/usage-example.test.ts`: `describe` nuevo, sin editar los existentes

1. Añade `function accountPermissions(pkit: ExamplePkit): void`, que replica el bloque `modules/account/permissions.js` de §12.1 con tipos: `checkOwnSessions(data: Data, context: Context)` compara `data.userId` con `(context.user as { id: number }).id`.
2. Añade `describe('USAGE.md implicit assignments', …)` con su propio `beforeEach`: `pkitConfig()`, `portalsPermissions(pkit, log)`, `dashboardPermissions(pkit)` y `accountPermissions(pkit)`, en ese orden.

| Id | Llamada | Resultado esperado |
| --- | --- | --- |
| U1 | staff, `[STAFF_DASHBOARD]`, `account.logout`, `create`, `data: {}` | `errors: []` |
| U2 | admin, `[]`, `account.logout`, `create` | `errors: []` |
| U3 | public, `[]`, `account.logout`, `create` | `errors[0].code === 'PERMISSION_NOT_ASSIGNED'` |
| U4 | staff, `[STAFF_DASHBOARD]`, `account.sessions`, `find`, `{ userId: 7 }`, `context: { user: { id: 7 } }`; luego con `{ userId: 9 }` | `errors: []`; luego `errors[0].code === 'HOOK_ERROR'` |
| U5 | `pkit.permissions.forRole('staff')` | `toEqual` el árbol de `USAGE.md` (sección "Listing the permissions of a role", hoy líneas 124-148): `marketing` → `portals` [`all`, `update-only`] y `dashboard` [`all`] |
| U6 | `forUser({ role: 'staff', permissions: [STAFF_DASHBOARD] })` | `toEqual({ 'staff::marketing.portals::all': acc(find), [STAFF_DASHBOARD]: acc(find), 'staff::account.logout::required': acc(create), 'staff::account.sessions::required': acc(find) })` |

### 11.3 Regla de preservación

No se edita ni se borra ninguna línea de aserción existente.

- **Comando:** `git diff --numstat tests/usage-example.test.ts tests/typecheck/roles.ts`.
- **Resultado esperado:** la segunda columna (líneas borradas) es `0` en ambos archivos.

El único cambio permitido en líneas existentes es el `import type`, si hace falta añadir un tipo. En ese caso se aceptan 1 borrada y 1 añadida en esa línea, y se debe declarar en el informe.

## 12. Documentación: textos exactos (en inglés, como el resto de la documentación)

### 12.1 `USAGE.md`

1. En `permissions.ts` ("Registration and startup"), añade `import './modules/account/permissions.js';` tras los imports de `marketing`.
2. Inserta esta sección nueva entre "Validating requests" y "Listing the permissions of a role":

````md
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
````

3. En "Listing the permissions of a role", añade al final del primer párrafo: `Names registered with assignToAllUsers() are left out: nobody assigns them.`, con `assignToAllUsers()` entre comillas invertidas. El árbol de ejemplo **no cambia**, y U5 lo comprueba.

### 12.2 `README.md`

- **Features** (tras la línea 17), añade: `- Implicit assignments: \`assignToAllUsers()\` registers the \`required\` name of a module, held by every user of the roles that register actions on it, so routes such as logout need no stored row.`
- **Concepts**, línea 68: cambia `A role alone authorizes nothing.` por `A role alone authorizes only the \`required\` names registered for it.`
- **Concepts**, tras el bullet de la línea 73 ("Direct assignment precedence"), añade:
  `- **Implicit assignment.** \`module.assignToAllUsers()\` returns the builder of the reserved name \`required\`, with the same \`role\`, \`grantTo\` and \`hook\` methods as \`.name(...)\`. Every user whose role registers actions on it holds \`[role]::[module]::required\` without storing it: \`validate()\`, \`permissions.forUser()\` and the \`permissions\` argument of hooks include it, and it can activate grants. A stored name of the same module replaces it for that user; otherwise it counts as a direct assignment and takes precedence over grants. \`.name('required')\` throws \`INVALID_DEFINITION\`, a stored \`::required\` row is accepted and ignored, and \`permissions.forRole()\` leaves these names out. It is not an implicit role: the user still needs the role.`
- **Tabla de errores**, línea 88, fila de `PERMISSION_NOT_ASSIGNED`: `No assignment under \`role::module::\`, no \`required\` name of the module for the role and no active grant for the module`.
- **Project layout**:
  - línea 125 (`src/constants.ts`): `Available methods, the \`general\` role, the reserved \`required\` name, the global hook owner marker and the field wildcard`;
  - línea 133 (`src/resolve.ts`): `Identity checks with the role's \`required\` names and access resolution, shared by \`validate\` and the permission views`;
  - línea 138 (`tests/`): añade `implicit assignments` tras `permissions`.

### 12.3 `CHANGELOG.md`

Añade esta sección encima de `## [0.3.1] - 2026-09-26`. No añadas enlace de versión.

```md
## [Unreleased]

### Added

- `ModuleBuilder.assignToAllUsers()`: returns the `NameBuilder` of the reserved name `required`, with the same `role`, `grantTo` and `hook` methods as `.name(...)`. Every user whose role registers actions on it holds `[role]::[module]::required` without storing it. A stored name of the same module replaces it for that user; otherwise it counts as a direct assignment, takes precedence over grants and can activate grants. `permissions.forUser()` includes it and `permissions.forRole()` leaves it out.

### Changed

- **Breaking.** `required` is a reserved permission name: `.name('required')` throws `INVALID_DEFINITION`. Rename any existing `required` name before upgrading.
- Hooks receive the caller's identifiers followed by the `required` identifiers injected for the request that the input did not contain. When nothing is injected they receive the input array itself, as before.
- A stored `[role]::[module]::required` row is accepted and ignored; it never causes `AMBIGUOUS_PERMISSION`.

### Migration

1. Register `assignToAllUsers()` on the module next to the old name and copy the old name's hooks.
2. Deploy: users with an old stored row keep the old name; the rest use `required`.
3. Delete the old rows from your store.
4. Remove the old name's registrations.
```

### 12.4 `CLAUDE.md`

En la línea 25, añade `` `assign-to-all-users` `` a la lista de tests, tras `` `permissions` ``.

## 13. Verificación

Se ejecuta desde la raíz del repositorio. Prerrequisitos: `bun install` hecho (ya lo está en `3fb027f`) y Node ≥20 en el `PATH`.

| Comando | Resultado esperado |
| --- | --- |
| `bun run typecheck` | Exit 0, sin errores de `tsc` |
| `bun test tests/assign-to-all-users.test.ts tests/usage-example.test.ts` | `0 fail` |
| `bun test` | `0 fail`. Total: los 251 previos más los nuevos. Anota la cifra real |
| `bun test tests/architecture.test.ts` | `0 fail` (forma de exportación, sin arrows ni defaults) |
| `bun run build` | Última línea `dist ready: esm, cjs, types` |
| `grep -c "assignToAllUsers" dist/types/module-builder.d.ts` | `1` o más |
| Prueba rápida CJS: `node -e "const { Pkit } = require('./dist/cjs/index.cjs'); const pkit = new Pkit({ roles: ['staff'] }); pkit.module('account').module('logout').assignToAllUsers().role('staff').registerActions({ create: { enabled: true, properties: [] } }); pkit.validate({ action: 'account.logout', method: 'create', role: 'staff', permissions: [] }).then(function (v) { console.log(JSON.stringify(v)); });"` | `{"result":{"data":{}},"errors":[]}` |
| Prueba rápida ESM: `node --input-type=module -e "import Pkit from './dist/esm/index.js'; const pkit = new Pkit({ roles: ['staff'] }); try { pkit.module('a').name('required'); } catch (e) { console.log(e.code); }"` | `INVALID_DEFINITION` |

**Comprobaciones contra antipatrones**

| Antipatrón | Comando | Resultado esperado |
| --- | --- | --- |
| Método descartado o lógica paralela (AIS-7, NT-5) | `grep -rn "registerImplicitActions" src tests README.md USAGE.md CHANGELOG.md CLAUDE.md` | Sin resultados |
| Valor mágico duplicado (DUP-4) | `grep -rn "'required'" src` | Solo `src/constants.ts` |
| Comentarios en prosa (COM-1) | `grep -rnE "^\s*//" src` | Sin resultados. La única coincidencia de comentario en `src/` es el JSDoc que ya existe en `src/errors.ts:12` |
| Cambios fuera de alcance (AIS-4) | `git status --short` | Solo los archivos de §16.1, además de `dist/` ignorado y este plan |
| Aserciones relajadas (AIS-9) | §11.3 | 0 líneas borradas |
| Exportaciones nuevas (NT-6) | `git diff src/index.ts` | Vacío |
| Dependencias (AIS-6) | `git diff package.json bun.lock` | Vacío |
| Tests sin resultado esperado | Revisión de T1–T22 y U1–U6 | Cada caso tiene la salida esperada de §11 |

No hay revisión visual: es una librería sin UI.

## 14. Seguridad

- **Cambia el modelo de amenaza:** el rol por sí solo ya autoriza las names `required`. `role` debe seguir saliendo de la sesión confiable y nunca del body ni de la query. La documentación lo exige y el README se corrige en la línea 68.
- **Riesgo de un registro erróneo:** `assignToAllUsers().role('admin')` sobre un módulo sensible da acceso a todos los admin. Mitigación para el consumidor: revisar `grep -rn "assignToAllUsers"` en cada release; `forUser` muestra el efecto real.
- **Grant con origen implícito (Q4):** da acceso a todo el rol. Está documentado (README y CHANGELOG) y cubierto por T13.
- **Fila `…::required` ignorada (Q17):** nunca amplía el acceso. Solo se vuelve a inyectar si el rol tiene acciones, y una guardada directa sigue ganando. Las filas inválidas siguen fallando cerrado (T12).
- **Los hooks siguen ejecutándose con `required`:** la propiedad de los datos (Q8) se aplica con hooks (U4).
- **Sin superficie de entrada nueva:** `validate()` no acepta campos nuevos y el orden de fases y códigos no cambia.

## 15. Migración y reversión

**Consumidor, para dejar de guardar filas** (Q18; textos en §12.1 y §12.3):
1. En el mismo módulo, registrar `assignToAllUsers()` junto a la name vieja (por ejemplo `all`) y **copiar los hooks** de la name vieja a `required`. Si no se copian, quien use la implícita los pierde.
2. Desplegar. Los usuarios con la fila vieja usan `all`, porque la guardada gana; el resto usa `required`.
3. Borrar las filas viejas en la base. Lo hace la aplicación; la librería no hace nada aquí.
4. Quitar los registros de la name vieja.

**Consumidor que ya usa `.name('required')`:** renombrar esa name antes de actualizar (Q19).

**Reversión**
- *Librería:* revertir el commit de la feature. No hay datos ni formatos persistidos que migrar.
- *Consumidor, antes del paso 3:* quitar los registros de `assignToAllUsers()`. Las filas viejas siguen funcionando.
- *Consumidor, después del paso 3:* reinsertar las filas, o aplicar temporalmente P1 (unión en la sesión, §5) con los identificadores viejos.

## 16. Coordinación

### 16.1 Archivos

| Tipo | Archivos |
| --- | --- |
| Modificados (`src/`) | `src/constants.ts`, `src/registry.ts` (solo el tipo `Snapshot`), `src/snapshot.ts`, `src/resolve.ts`, `src/validate.ts`, `src/permissions.ts`, `src/module-builder.ts` |
| Modificados (tests) | `tests/usage-example.test.ts` (solo añadidos), `tests/typecheck/roles.ts` (solo añadidos) |
| Creados | `tests/assign-to-all-users.test.ts` |
| Documentación | `USAGE.md`, `README.md`, `CHANGELOG.md`, `CLAUDE.md` |
| No se tocan | El resto de `src/`, `package.json`, `bun.lock`, `scripts/`, `.github/` y `tests/architecture.test.ts` |

### 16.2 Paralelismo

- **Recomendación: un único ejecutor.** El código es secuencial (1 → 2 → 3 → 4, y 7) y son unas 60 líneas en 7 archivos.
- **Si se quiere dividir, dos responsables con archivos disjuntos:**
  - **A:** `src/*` y `tests/*`. Pasos 0–8. Entrega: `bun test` en verde.
  - **B:** `USAGE.md`, `README.md`, `CHANGELOG.md` y `CLAUDE.md`. Paso 9. Usa los textos de §12, que ya fijan la API, así que no depende de A para redactar.
  - **Integración:** el coordinador ejecuta §13 completo después de A y B. B no da por terminado nada antes de que U5 (árbol de USAGE) pase con el código de A.

## 17. Supuestos, riesgos y verificaciones no ejecutadas

**Supuestos (AIS-2)**
- S1. El consumidor toma `role` de una sesión confiable. Ya era requisito (README). Si fuera falso, la implícita amplía el impacto de suplantar el rol.
- S2. Ningún consumidor usa hoy la name `required`. No se puede verificar fuera del repo; el CHANGELOG lo marca como Breaking. En el repo no hay usos (§3.3).
- S3. Los resultados de §11 se derivaron leyendo el código en `3fb027f` y siguiendo el orden de inserción de los `Map`. Si un test no coincide, revisa primero el orden del setup antes de tocar el código.

**Riesgos**
- K1. El argumento `permissions` de los hooks cambia (array nuevo cuando hay inyección). Mitigación: CHANGELOG, más T15–T18.
- K2. El invariante "A role alone authorizes nothing" cambia. Mitigación: README §12.2.
- K3. Una UI de administración basada en `forRole` deja de mostrar las `required`. Es lo que se busca (Q6).

**Ejecutado durante la planificación**
- `bun run typecheck`: exit 0.
- `bun test`: `251 pass, 0 fail, 521 expect() calls, Ran 251 tests across 9 files`.
- Versiones de Bun, Node y TypeScript.
- Consultas al registro de npm y lecturas web de §4 (2026-10-04).
- `grep` de §3.3.

**No ejecutado**
- La implementación y los tests nuevos.
- `bun run build` y las pruebas rápidas de Node. La regla de esta fase es no modificar código, y `build` reescribe `dist/`.
- Lo ejecuta todo el ejecutor según §13.

## 18. Informe de entrega que debe producir el ejecutor (AIS-14)

Secciones, en este orden. Escribe "none" si alguna queda vacía:
1. **Scope:** lo pedido (este plan) y lo cambiado.
2. **Requirements → files:** la tabla R1–R7 con los archivos reales.
3. **Assumptions:** S1–S3 y cualquier supuesto nuevo.
4. **Files changed:** separados en modificados, creados y borrados.
5. **Patterns followed:** `src/module-builder.ts` (caché), `pushHook` en `src/registry.ts`, `capturePermissions` en `tests/validate.test.ts` y `codesOf` en `tests/security.test.ts`.
6. **Simplicity decisions:** no se crea `registerImplicitActions` ni ningún flag; `#nameBuilder` y `addRequired` se justifican en §8.
7. **Fallbacks and error paths:** la fila `…::required` ignorada (§7.2).
8. **Security-relevant changes:** §14.
9. **Dependencies:** none.
10. **Performance:** la estimación de §8; nada medido.
11. **Validations executed:** cada comando de §13 con su salida real, incluido el rojo del paso 0.
12. **Validations not executed:** con su motivo.
13. **Completeness:** complete, o la lista de lo que falta.
14. **Proposed, not applied:** por ejemplo, subir a 0.4.0 al hacer el release.
