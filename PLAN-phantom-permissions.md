# PLAN: permisos fantasma (`required` y nombres heredados por grant no chequeables)

Estado: **LISTO**
Fecha: 2026-10-05. Repo: rama `main`, HEAD `9c4a195`, árbol limpio.
Línea base verificada hoy: `bun test` → 279 pass / 0 fail; `bun run typecheck` → sin errores. `bun run build` no ejecutado (el ejecutor lo corre al final).
El ejecutor debe comprobar que HEAD sigue en `9c4a195`; si no, revisar solo los archivos afectados por la divergencia.

## 1. Solicitud y decisiones cerradas (usuario, 2026-10-05)

| Id | Decisión |
|----|----------|
| D1 | `named`, `forUser` y el argumento `permissions` de los hooks dejan de incluir `required` y los nombres heredados por grant. `forRole` ya excluye `required`. Solo se validan (`validate()`). |
| D2 | Guardar `role::módulo::required` lanza `UNKNOWN_PERMISSION` (hoy se acepta e ignora). Guardar un nombre solo-grant lanza lo mismo. Sin código de error nuevo. |
| D3 | Un nombre es válido si tiene acciones directas **o** grants. Los ids asignables salen solo de `registerActions` por rol; un rol con solo grants nunca tiene id. |
| D4 | Versión 0.5.0 con sección **Breaking** y migración en `CHANGELOG.md`; se actualizan `README.md` y `USAGE.md`. No se publica nada. |

Semántica interna que **no cambia**: `required` se inyecta en `identity.assigned` y puede activar grants; A (guardado) activa por dentro la lógica de B (`grantsBySource`, `resolveName`, `resolveAccess`); un nombre guardado del mismo módulo reemplaza a `required`; la precedencia directo > grant se mantiene; `validate()` mantiene todos sus errores.

## 2. Alcance

Dentro: `src/snapshot.ts`, `src/resolve.ts`, `src/permissions.ts`, `src/validate.ts`, pruebas listadas en §5, `CHANGELOG.md`, `README.md`, `USAGE.md`, `package.json` (versión).
Fuera: nuevas APIs, nuevos códigos de error, cambios en `src/types.ts` (las formas públicas no cambian; `UserPermissionMap` sigue válido), `src/registry.ts` (`registerGrant` ya acepta nombres sin acciones), builders, adaptadores, CI, publicación (`CLAUDE.md` "Do not").

## 3. Contexto verificado (hechos, con rutas)

- `src/snapshot.ts` `build`: `named[permissionId]` y `addRequired` se llenan por cada `(módulo, nombre, rol)` con acciones; `assignable = new Set(Object.keys(named))`. `required` está en ambos.
- `src/snapshot.ts` `checkModule` lanza `INVALID_DEFINITION` si `nameEntry.actions.size === 0` (hoy rechaza nombres solo-grant). `checkGrants` exige `assignable.has(sourceId)` y que algún rol declare cada método del grant (`declaresMethod`).
- `src/resolve.ts` `checkIdentity`: valida contra `snapshot.assignable`; si el nombre es `required` hace `continue` (acepta e ignora); calcula `injected` desde `requiredByRole`.
- `src/permissions.ts` `forUser`: itera todos los módulos con `resolveName`; crea la clave `role::módulo::nombre` también para nombres alcanzados por grant y para `required` inyectado (el "fantasma"). `methodAccess` tiene rama `direct` y rama grant. `forRole` filtra `required` por nombre.
- `src/validate.ts` `effectivePermissions` agrega los `injected` al array que reciben los hooks.
- `tests/architecture.test.ts` impone: un `export default` por módulo, sin arrow functions, sin parámetros por defecto, sin comentarios de prosa.
- Pruebas que codifican el comportamiento viejo (deben cambiar): `tests/assign-to-all-users.test.ts` (líneas ~108, 151–185, 190–210, 236–239), `tests/usage-example.test.ts` (~316–323), `tests/registry.test.ts` (~133–145), `tests/security.test.ts` (~523–527).
- Pruebas que deben seguir pasando sin cambio: `tests/permissions.test.ts` bloque `forUser resolution` salvo la expectativa de grants (ver §5, T5).

## 4. Reglas de arquitectura aplicables

Fuente: `SKILL.md` de `pro-architecture` (leído) y `CLAUDE.md` del repo. Los archivos `references/*` de la skill **no se abrieron** en esta investigación; no se citan IDs de regla que no consten en `SKILL.md`/`CLAUDE.md`. No invocar la skill (activación exclusiva del usuario).
- Reutilizar patrones: lógica solo-interna en funciones de módulo bajo el objeto; sin arrows, sin defaults, sin comentarios de prosa; líneas en blanco entre bloques.
- Sin exports nuevos innecesarios; sin dependencias nuevas; cambio de comportamiento ⇒ prueba.
- Alcance mínimo (AIS-4/AIS-5 de la skill): no tocar archivos fuera de §2.

## 5. Pasos (secuenciales; un solo ejecutor, no hay paralelismo: los pasos comparten `snapshot.ts`/`resolve.ts` y las pruebas dependen de ellos)

### P1 — `src/snapshot.ts`: separar "declarado" de "asignable" y permitir solo-grant (D1, D3)
Dependencias: ninguna.
1. Interfaz `Snapshot`: agregar `declared: ReadonlySet<string>` (todos los ids con acciones, incluido `required`). `assignable` pasa a excluir los ids con `reference.name === constants.NAME_FOR_ALL_USERS_PERMISSIONS`; `named` también los excluye.
2. `build`: en el bucle, siempre `addRequired(...)` y `declared.add(permissionId)`; solo si el nombre no es `required`: `named[permissionId] = actions` y `assignable.add(permissionId)`. Usar `name !== constants.NAME_FOR_ALL_USERS_PERMISSIONS` directamente (ya hay import de `constants`); no parsear el id.
3. `checkModule`/`checkGrants`: `checkGrants` recibe `declared` en lugar de `assignable` (un grant puede tener como fuente `required`: `assignToAllUsers` activa grants; ese caso ya está cubierto por pruebas y debe seguir válido).
4. `checkModule`: la condición pasa a `nameEntry.actions.size === 0 && nameEntry.grants.size === 0`; mensaje: `"${permissionPath}" has no registered actions or grants`. Un nombre solo con hooks sigue rechazado.
5. `checkGrants`: la validación `declaresMethod` solo aplica cuando `nameEntry.actions.size > 0` (guarda contra typos); en nombres solo-grant el propio grant declara sus métodos.
6. `checkRoleHooks`/`hasAccessPath`: sin cambio (ya cuentan grants como camino de acceso).
Aceptación: `new Pkit({roles:['staff']})` con `reports` (acciones staff) y `items.name('all').grantTo('staff::reports::all').registerActions(...)` sin `role(...)` **no** lanza al leer `permissions.named`; `named` no contiene ninguna clave `::required`.

### P2 — `src/resolve.ts`: guardar `required` falla; limpiar `injected` (D2)
Dependencias: P1.
1. `checkIdentity`: eliminar el `continue` de `required`. Un `::required` guardado ya no está en `snapshot.assignable` ⇒ cae en el `UNKNOWN_PERMISSION` existente (mismo mensaje `"<id>" is not an assignable permission`). El orden de comprobaciones (formato → `PERMISSION_ROLE_MISMATCH` → `UNKNOWN_PERMISSION`) no cambia.
2. Tras el bucle, la inyección de `requiredByRole` se conserva en `assigned`/`names`. Eliminar `injected` de la interfaz `Identity` y de la función (queda sin consumidores tras P3/P4). Verificar con `grep -rn injected src tests` que no quede referencia.
Aceptación: `validate({role:'staff', permissions:['staff::account.logout::required'], ...})` → `errors[0].code === 'UNKNOWN_PERMISSION'`; `permissions: []` sobre una acción `required` sigue autorizada.

### P3 — `src/validate.ts`: hooks reciben el array de entrada (D1)
Dependencias: P2.
1. Eliminar `effectivePermissions` y su uso; `PreparedRequest.permissions` recibe `permissions` tal cual (mismo array, por referencia).
Aceptación: un hook de una ruta `required` con `permissions: []` recibe `[]`; con `[A]` recibe el mismo objeto array.

### P4 — `src/permissions.ts`: `forUser` solo lista permisos guardados (D1)
Dependencias: P2.
1. `forUser`: tras `checkIdentity` (mantiene `INVALID_INPUT`, `UNKNOWN_ROLE`, `PERMISSION_ROLE_MISMATCH`, `UNKNOWN_PERMISSION`, `AMBIGUOUS_PERMISSION` entre permisos guardados), iterar `assignments.permissions`; para cada id, `identifiers.parse` → entrada `snapshot.modules.get(module).names.get(name)` → `access[id] = methodAccess(entry, role)`. Sin `resolveName`, sin grants, sin `required`.
2. `methodAccess(entry, role)`: queda solo la rama directa (`entry.actions.get(role)`, `enabled === true`); eliminar la rama grant y los parámetros `resolved`/`identity` sobrantes. Quitar imports de tipos que queden sin uso (`Identity`, `ResolvedName`).
3. `forRole`: quitar `|| reference.name === constants.NAME_FOR_ALL_USERS_PERMISSIONS` (inalcanzable porque `named` ya no los contiene); verificar que `constants` siga usado (`MODULE_SEPARATOR`, `METHODS`).
Aceptación: `forUser({role:'staff', permissions:[]})` → `{}` aunque el rol tenga nombres `required`; con `[STAFF_REPORTS]` solo contiene `STAFF_REPORTS`, no `STAFF_ITEMS_ALL` heredado; objeto congelado, prototipo `null` (sin cambio).

### P5 — Pruebas (comportamiento ⇒ prueba) — mismo ejecutor, tras P1–P4
Ejecutar `bun test` tras cada archivo editado.
- **T1** `tests/assign-to-all-users.test.ts`:
  - "a stored required row is accepted and ignored" → renombrar a "a stored required row is rejected" y esperar `codesOf(...) === ['UNKNOWN_PERMISSION']` para `[STAFF_SESSIONS_REQUIRED]` y para `[STAFF_SESSIONS_REQUIRED, STAFF_SESSIONS_ALL]`.
  - Bloque `hook permissions`: reemplazar por: hook recibe `[]` con entrada `[]` (nada inyectado); recibe `[STAFF_SESSIONS_ALL]` con esa entrada; recibe el mismo array por referencia (`toBe(input)`). Eliminar "no duplicates" y "only the applied required".
  - `views`: `forUser` con `[]` → `{}`; con `[STAFF_SESSIONS_ALL]` → solo `{ [STAFF_SESSIONS_ALL]: FIND_AND_REMOVE }`; `named` no contiene ninguna clave que termine en `::required` (`Object.keys(...).some(k => k.endsWith('::required'))` es false; usar `function` en vez de arrow en archivos `tests/` solo si `architecture.test.ts` lo exige: comprobar que escanea `tests/`).
  - Conservar: "required takes precedence", "required puede activar grants" y "stored name replaces required" (validate-level, sin tocar).
- **T2** `tests/usage-example.test.ts`: "forUser includes the required names of the role" → renombrar a "forUser omits the required names" y esperar solo `STAFF_DASHBOARD`. El test `forUser for the staff user with dashboard` (~211): esperar solo `'staff::marketing.dashboard::all'` (el grant a `portals` deja de listarse); mantener las aserciones de congelado/prototipo y de `named`.
- **T3** `tests/registry.test.ts` ~133–145: separar en dos: (a) nombre solo con hook sigue lanzando `invalidDefinition()`; (b) nombre solo-grant (`withGrant`) ya **no** lanza y `named` solo contiene `staff::reports::all`. Añadir caso: grant solo-grant con fuente inexistente sigue lanzando; grant con método no declarado sobre un nombre que **sí** tiene acciones sigue lanzando (ya cubierto en el test siguiente, ~147–165: comprobar que sigue verde).
- **T4** `tests/security.test.ts` ~523–527 "throws the grant ambiguity from forUser as well": `forUser` ya no resuelve grants. Reemplazar por una aserción `validate()` que devuelva `AMBIGUOUS_PERMISSION` para `setupAmbiguousGrant()` con `[STAFF_AUDIT]` (comprobar si ya existe una igual en el archivo; si existe, borrar el test sin duplicar).
- **T5** `tests/permissions.test.ts` `forUser resolution`: ajustar `resolves direct assignments and one-hop grants` (expectativa `STAFF_ITEMS_ALL` heredado sale; renombrar a "lists only stored permissions"), y `prefers the direct assignment over grants` (`ADMIN_ITEMS_ALL`/`STAFF_ITEMS_ALL` guardados siguen presentes; sin grants no hay cambio de valores). La precedencia directo > grant debe probarse además vía `validate()` (ya existe en `validate.test.ts`/`security.test.ts`: confirmar con `grep -n "direct" tests/*.test.ts`, no duplicar).
- **T6 (nuevas, mínimas)** en `tests/assign-to-all-users.test.ts` o `tests/permissions.test.ts`:
  1. Fantasma solo-grant: A (`staff::reports::all`, guardado) + nombre B solo-grant en módulo `items`. `validate({action:'items', role:'staff', permissions:[A]})` autoriza con las propiedades del grant; `forUser` solo contiene `A`; `named`/`forRole` no contienen B para `staff`; `validate` con `permissions:['staff::items::all']` (B) → `UNKNOWN_PERMISSION`; `forUser` con B → lanza `UNKNOWN_PERMISSION`.
  2. Sin A: `validate({action:'items', role:'staff', permissions:[]})` → `PERMISSION_NOT_ASSIGNED`.
  3. Hook de B se ejecuta cuando entra por A (`name.hook`), y el hook recibe `[A]`.
  4. Solo-grant con método de grant no restringe por `declaresMethod` (P1.5): cubierto por (1).
- **T7** `tests/typecheck/roles.ts`: sin cambio esperado; correr `bun run typecheck`.

### P6 — Documentación y versión (D4)
Dependencias: P5 verde.
1. `package.json`: `"version": "0.5.0"`.
2. `CHANGELOG.md`: nueva sección `## [0.5.0] - 2026-10-05` (si el ejecutor corre otro día, usar esa fecha): **Changed (Breaking)**: `named`, `forUser` y el argumento `permissions` de los hooks omiten `required` y los nombres alcanzados por grant; un `::required` guardado lanza `UNKNOWN_PERMISSION` (antes se ignoraba); `forUser` lista solo permisos guardados. **Added**: un nombre puede existir solo con `grantTo` (permiso dependiente no asignable). **Migration**: (1) borrar de tu almacén las filas `::required`; (2) no leer acceso heredado o `required` desde `forUser`, usar `validate()`; (3) los hooks que buscaban `::required` en `permissions` deben dejar de hacerlo. Reescribir, en 0.4.0, nada: el histórico queda intacto.
3. `README.md`: ajustar el párrafo "Implicit assignment" (~línea 75: quitar "`validate()`, `permissions.forUser()` and the `permissions` argument of hooks include it" y "a stored `::required` row is accepted and ignored"; decir que se rechaza con `UNKNOWN_PERMISSION` y que no aparece en `named`, `forUser`, `forRole` ni hooks); ajustar "Definition vs assignment vs grant" (~línea 69) añadiendo que un nombre solo-grant no es asignable; tabla de errores (~línea 90) sin cambio de códigos.
4. `USAGE.md`: líneas ~113–162: mismas correcciones; la sección de `forUser` debe decir que lista solo permisos guardados y que el acceso heredado o por `required` se obtiene con `validate()`; añadir ejemplo corto de nombre solo-grant.
Aceptación: `grep -n "accepted and ignored\|include it\|forUser.*required" README.md USAGE.md CHANGELOG.md` no devuelve afirmaciones del comportamiento viejo fuera de la sección 0.4.0.

## 6. Verificación final (directorio: raíz del repo; prerrequisito: `bun install` hecho)

1. `bun run typecheck` → sin salida de error.
2. `bun test` → 0 fail. El conteo cambia (T1–T6); registrar el nuevo total en la entrega.
3. `bun run build` → termina sin error; sin efectos externos.
4. `grep -rn "injected\|effectivePermissions" src tests` → vacío.
5. `git diff --stat` → solo archivos de §2.
6. Casos de error esperados (ya cubiertos por T1/T6): `UNKNOWN_PERMISSION` al guardar `::required` o B; `PERMISSION_NOT_ASSIGNED` sin A; `INVALID_DEFINITION` para nombre solo con hook, fuente de grant inexistente o método de grant no declarado en un nombre con acciones.

## 7. Seguridad, errores, reversión

- Frontera de confianza (`validate()` / `checkIdentity`): se endurece (rechaza más entradas, no menos). `required` sigue sin poder ser forjado: no se acepta almacenado.
- Sin migración de datos en la librería; el consumidor borra sus filas `::required` (documentado en P6). Quien no las borre recibirá `UNKNOWN_PERMISSION` en `validate()`: es el cambio incompatible aceptado (D2).
- Reversión: `git revert` del commit; no hay estado persistente.

## 8. Supuestos y riesgos (marcados, no bloqueantes)

- S1 (propuesta mía, derivada de D1/D3): `forUser` pasa a ser "permisos guardados con su mapa de métodos". Si se quisiera una vista de acceso efectivo, sería una API nueva, fuera de alcance.
- S2 (propuesta): en nombres solo-grant se omite la comprobación `declaresMethod` (el grant declara sus métodos); se conserva en nombres con acciones.
- S3 (propuesta): `required` sigue siendo fuente válida de `grantTo` (`declared` en lugar de `assignable`). Riesgo si se olvida: `checkGrants` rompería el caso "required activa grants" (hay prueba en `assign-to-all-users.test.ts`).
- R1: el test de la línea ~236 y otros pueden depender del orden de claves; usar `toEqual`/`arrayContaining` como ya hacen.
- No ejecutado: `bun run build`; revisión visual: no aplica (sin UI).

## 9. Trazabilidad

| Requisito | Paso | Aceptación |
|-----------|------|------------|
| `required` no mostrado/chequeable | P1, P3, P4 | T1, T2, §6.1–2 |
| Heredados no chequeables | P4 | T2, T5, T6.1 |
| Guardar fantasma ⇒ error "no existe" | P1, P2 | T1, T6.1 |
| Nombre solo-grant (B fantasma) válido | P1 | T3, T6.1–3 |
| Lógica de B se evalúa vía A | sin cambio (`resolve.ts`) | T6.1, pruebas existentes de grants |
| Docs + versión | P6 | grep §P6, `package.json` |
