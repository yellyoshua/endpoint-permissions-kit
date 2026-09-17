# REWRITE-PLAN: `endpoint-permissions-kit` sin estado global

Fase 1 del prompt `REWRITE-PROMPT.md`. Ningún archivo de `src/` se ha tocado. La fase 2 empieza solo tras aprobación de este plan y de las decisiones de la sección 9.

Fuentes usadas: `USAGE.md` (reglas R1–R52 del inventario de contrato), `README.md:69` (`reservedFields`), `package.json`, `scripts/build.ts`, `tsconfig*.json`, `CLAUDE.md`, `tests/architecture.test.ts`, inventario de `tests/*.test.ts`. `src/` solo se listó para el inventario de borrado.

## 1. Árbol final de `src/`

```text
src/
  index.ts            export default Pkit; export type {...}; export const METHODS
  types.ts            contratos públicos, genéricos en el rol
  constants.ts        METHODS, GENERAL_ROLE, ALL_FIELDS, GLOBAL_HOOK_MARKER, MAX_DEPTH
  errors.ts           PkitError con code; render seguro de valores no confiables
  pkit.ts             class Pkit<R>: estado por instancia, context, module, validate, permissions
  module-builder.ts   class ModuleBuilder<R>
  name-builder.ts     class NameBuilder<R>
  role-builder.ts     class RoleBuilder<R>
  grant-builder.ts    class GrantBuilder<R>
  registry.ts         objeto: estructura del registro y mutaciones (registerActions, registerGrant, registerHook, setRoles...)
  identifiers.ts      objeto: formato role::module::name, parse, build, checks de segmento
  definitions.ts      objeto: lectura y congelado del literal de registerActions y del bloque de grant
  snapshot.ts         objeto: compila el registro en vistas congeladas y ejecuta las comprobaciones cruzadas (sustituye a seal)
  resolve.ts          objeto: validación de identidad y resolución (role, module, method) compartida por validate y forUser
  properties.ts       objeto: recorrido de data, comparación por ruta y recorte
  validate.ts         objeto: fases de validate y contrato { result, errors }
  permissions.ts      objeto: vistas named y forUser sobre un snapshot
```

Se borran: `src/state.ts`, `src/seal.ts`, `src/context.ts`, `src/cli/`, `bin/`, `tests/generate.test.ts`, `tests/pkit.generated.d.ts`, `tests/typecheck/pkit.generated.d.ts`.

Clases: solo `Pkit` y los cuatro builders (estado por instancia y encadenamiento con identidad, decisión 3 del prompt). Todo lo demás: objeto de funciones con `export default`, recibiendo el registro o el snapshot por parámetro (`CLAUDE.md`).

## 2. Responsabilidad por archivo

| Archivo | Responsabilidad | Reglas que fija |
| --- | --- | --- |
| `types.ts` | `Pkit`-agnóstico. `Role<R>`, `PermissionId<R>`, `Method`, `Properties`, `ActionDef(s)`, `GrantDef(s)`, `Data`, `Context`, `HookFn`, `ContextValues`, `ContextKey`, `UserAssignments<R>`, `ValidateInput<R>`, `ValidateResult`, `ValidationError`, `PkitError`, `PkitErrorCode`, `NamedPermissionCatalog<R>`, `UserPermissionMap<R>`, `MethodAccessMap`, `PkitOptions<R>` | Publicado como `./types` |
| `constants.ts` | `METHODS = ['find','update','create','remove'] as const`, `GENERAL_ROLE = 'general'`, `ALL_FIELDS = '*'`, `MAX_DEPTH = 1000` | R7, R30, R37 |
| `errors.ts` | `create(code, message, extra?)`, `describe(value)` para mensajes sin filtrar valores hostiles | ERR-2 |
| `identifiers.ts` | `parse(id)`, `build(role, module, name)`, `checkSegment`, `checkName`, `checkRole`, `prefix(role, module)` | R1–R5, R9, R22 |
| `definitions.ts` | `readActions(literal)`, `readGrant(literal)`, `checkPropertyPath(path)`; copia y congela | R12, R29–R30, R50, "validates the whole literal before modifying state" (R21) |
| `registry.ts` | Tipos `Registry`, `ModuleEntry`, `NameEntry`, `GrantEntry`; `create(options)`, `setRoles`, `setCropper`, `setReservedFields`, `ensureModule`, `registerActions`, `registerGrant`, `registerHook`; cada mutación valida todo antes de escribir y marca `snapshot = null` | R6–R11, R13, R18, R21, DUPLICATE_REGISTRATION, ROLE_NOT_DECLARED |
| `snapshot.ts` | `build(registry)`: comprobaciones cruzadas (R19, R20, R42) y materialización de `named` + `assignable` + índices de grants por identificador habilitante; resultado congelado y sin prototipo | Sustituye a `seal()` |
| `resolve.ts` | `checkIdentity(snapshot, input)` (R27), `resolveAccess(snapshot, role, module, method, permissions)` (R22–R26) | Compartido por `validate` y `forUser` (R48) |
| `properties.ts` | `deny(data, allowed, reserved)` y `crop(data, allowed, reserved)`; un recorrido por modo; ciclos y profundidad | R29–R37, R39 |
| `validate.ts` | `run(registry, input)`: normaliza `data`/`context` (R38), orden de fases (R28), hooks con `Promise.allSettled` (R43–R45), traduce excepciones al contrato (R51) | Códigos 2.2 del inventario menos `NOT_SEALED` |
| `permissions.ts` | `named(snapshot)`, `forUser(snapshot, assignments)` | R46–R48 |
| `pkit.ts` | Ver sección 3 | |
| Builders | Ver sección 4 | R40, R49 |

## 3. Clase `Pkit`

```ts
interface PkitOptions<R extends string> {
  roles?: readonly R[];
  cropper?: boolean;
  reservedFields?: readonly string[];
}

export default class Pkit<R extends string = 'general'> {
  readonly context: { set<K extends ContextKey>(key: K, value: ContextValues<R>[K]): void; get<K extends ContextKey>(key: K): ContextValues<R>[K] };
  readonly permissions: { readonly named: NamedPermissionCatalog<R>; forUser(assignments: UserAssignments<R>): UserPermissionMap<R> };

  constructor(options?: PkitOptions<R>);
  module(segment: string): ModuleBuilder<R>;
  validate(input: ValidateInput<R>): Promise<ValidateResult>;
}
```

- Estado privado: `#registry: Registry` (roles, cropper, reservedFields, modules, snapshot memorizado).
- `constructor` sin parámetros por defecto (regla del repo): `options` opcional, leído con `options === undefined ? {} : options`. Sin `roles` el catálogo es `['general']` (R7). `roles` tipado `readonly R[]` para inferir `R` con `as const`.
- `context.set('roles' | 'cropper' | 'reservedFields', value)` y `context.get` se conservan (decisión 7 del prompt). `set` valida (R9, R11, R39) y anula el snapshot. `roles` en runtime es `readonly string[]`; la inferencia de tipos la da solo el constructor (ver decisión D1).
- `permissions.named` es un getter que compila el snapshot si falta. `permissions.forUser` igual.
- `validate` compila el snapshot si falta; si la compilación lanza `PkitError`, devuelve `VALIDATION_ERROR` con ese error como `cause` (decisión D3).
- `context` y `permissions` son objetos congelados creados en el constructor con métodos enlazados a la instancia (`bind`), sin arrow functions.
- Sin `seal()`, sin `SEALED`, sin `NOT_SEALED`. Registrar después de validar es válido e invalida el snapshot.

Snapshot memorizado: `build` es O(módulos × nombres × grants); se ejecuta una vez tras el último registro y se reutiliza por petición. Por petición `validate` es O(|permissions| + |paths de data|) usando `Map`/`Set` del snapshot (ALG).

## 4. Builders

| Clase | Constructor | Métodos | Cache |
| --- | --- | --- | --- |
| `ModuleBuilder<R>` | `(registry, path: string[])` | `module(segment)`, `name(x)`, `hook(method, fn)` | `Map<string, ModuleBuilder>` y `Map<string, NameBuilder>` por instancia |
| `NameBuilder<R>` | `(registry, path, name)` | `role(r)`, `grantTo(id)`, `hook(method, fn)` | `Map<string, RoleBuilder>` |
| `RoleBuilder<R>` | `(registry, path, name, role)` | `registerActions(literal)`, `hook(method, fn)` | — |
| `GrantBuilder<R>` | `(registry, path, name, sourceId)` | `registerActions(literal)` | — |

- `Pkit.module(segment)` cachea `ModuleBuilder` raíz por segmento. Con la cache, `pkit.module('a').name('x') === pkit.module('a').name('x')` (identidad al encadenar, R49).
- Métodos extraídos (`const register = builder.registerActions; register({...})`): cada builder enlaza sus métodos públicos en el constructor con `this.registerActions = this.registerActions.bind(this)`. Cuatro clases, ocho enlaces en total (decisión D2).
- `ModuleBuilder.module(segment)` valida el segmento (R3) sin crear el módulo en el registro; el módulo se crea al primer `registerActions`/`hook` (test "does not create modules on a failed registration").
- `hook` de módulo con módulo sin nombres: se acepta al registrar y `snapshot.build` lo rechaza con `INVALID_DEFINITION` (test "refuses a module with hooks but no names", adaptado).
- `RoleBuilder.role` y `GrantBuilder` sin `.role()` (fixture de typecheck).

## 5. Comprobaciones que hoy hace `seal()` y dónde van

| Comprobación | Antes | Ahora |
| --- | --- | --- |
| Identificador de grant existe como asignable (R19) | seal | `snapshot.build` |
| Nombre receptor tiene acciones de algún rol (R19, R20) | seal | `snapshot.build` |
| Cada método del bloque de grant está declarado por algún rol del nombre (R19) | seal | `snapshot.build` |
| Role hook con camino directo o por grant (R42) | seal | `snapshot.build` |
| Módulo con hooks y sin nombres | seal | `snapshot.build` |
| Formato, rol, autorreferencia, forma del bloque, duplicado (R18) | registro | registro (sin cambio) |
| `cropper` booleano, `reservedFields` válidos, `*` como rol | `context.set` | `context.set` y constructor |
| Congelar `context` tras seal (R10) | seal | eliminado: `context.set` siempre válido; invalida snapshot |
| Idempotencia de seal | seal | snapshot memorizado; `build` se repite solo tras una mutación |

Cuándo se dispara `snapshot.build`: primera llamada a `validate`, `permissions.named` o `permissions.forUser` después de una mutación. `validate` devuelve `{ result: null, errors: [{ code: 'VALIDATION_ERROR', cause: PkitError }] }`; las vistas lanzan el `PkitError` (`INVALID_DEFINITION`).

## 6. Tipado de roles sin generador

- `Role<R>` = `R`; `PermissionId<R> = \`${R}::${string}::${string}\``; `ValidateInput<R>`, `UserAssignments<R>`, `NamedPermissionCatalog<R>`, `UserPermissionMap<R>` parametrizados. Valores por defecto `R = string` en `./types` para consumidores que solo importan tipos.
- Inferencia: `new Pkit({ roles: ['admin', 'staff'] as const })` produce `Pkit<'admin' | 'staff'>`; `role('adminn')` no compila; `validate({ role: 'nobody' })` no compila.
- `tests/typecheck/roles.ts` se reescribe sobre `const pkit = new Pkit({ roles: [...] as const })` manteniendo cada `@ts-expect-error` actual salvo los de `RoleRegistry`. `tests/typecheck/tsconfig.json` sin cambios.
- `RoleRegistry` desaparece de `types.ts` e `index.ts`.

## 7. Cambios fuera de `src/`

- `package.json`: quitar `bin`, quitar `"bin"` de `files`, versión `0.3.0`, `description` sin "in-memory registry"; `engines` se mantiene `>=20` (decisión D5).
- `scripts/build.ts`: entrypoints ESM = `['./src/index.ts', './src/types.ts']`; mismo array para CJS.
- `tsconfig.build.json`: `types: []` (sin Node en `src/`); decidir tras comprobar que `bunx tsc` compila sin `@types/node` (`scripts/build.ts` queda fuera de ese tsconfig).
- `tests/helpers.ts`: eliminar `resetState`; `setupInventory()` devuelve `{ pkit, ...builders }` con `new Pkit({ roles: ['staff','admin','public'] as const })`.
- `tests/architecture.test.ts`: `SINGLE_EXPORT_EXCEPTIONS` = `src/index.ts`, `src/types.ts`; aceptar `export default class` en `src/pkit.ts` y los cuatro builders (lista `CLASS_EXPORT_FILES`); `ts.isClassDeclaration` con `export default` cuenta como el único default; métodos de clase ya se inspeccionan (`isMethodDeclaration`) para arrow functions y parámetros por defecto; añadir comprobación de que ningún archivo fuera de `CLASS_EXPORT_FILES` declara una clase.
- Tests por archivo, según inventario: se eliminan 1 (`permissions`), 2 (`registry`: orden roles→registro, SEALED), 3 (`security`: after seal ×2, before seal), 1 (`validate`: NOT_SEALED), 1 (`security` cropper after seal) y todo `generate.test.ts`. Se adaptan los que usan `seal()`, `context.set('roles')`, `resetState` y `Object.isFrozen(pkit)`. Test nuevo obligatorio: dos instancias no comparten estado. Test nuevo: registro tras `validate` invalida el snapshot y el siguiente `validate` lo ve.
- Docs: `USAGE.md` (secciones Registration and startup, Context keys, Errors, Permission views, Role types, Functional implementation, Scope; añadir `reservedFields` a la tabla de claves), `README.md` (líneas 18, 34, 43, 59, 69, 79, 92, 94–106, 111, 124, 134, 140, 144–147, 149, 158, 169, 173), `CONTRIBUTING.md:31` (ejemplo `generate.test.ts`), `CLAUDE.md` (descripción, layout, excepción contextual para clases, eliminar `seal()` y CLI), `CHANGELOG.md` entrada `[0.3.0]` con `### Removed`, `### Changed` y guía de migración.

## 8. Orden de implementación (fase 2)

Paso 0, secuencial: `types.ts`, `constants.ts`, `errors.ts`. Congelados antes de lanzar bloques.

Bloques paralelos (un sub-agente cada uno, archivos disjuntos):

- **A. Registro:** `identifiers.ts`, `definitions.ts`, `registry.ts`, `pkit.ts`, los cuatro builders, `tests/helpers.ts`, `tests/registry.test.ts`. Para que A compile sin B, `pkit.validate` y `permissions` importan `validate.ts`, `snapshot.ts` y `permissions.ts`: A entrega `pkit.ts` completo y B entrega esos tres módulos con la firma acordada en el paso 0 (`validate.run(registry, input)`, `snapshot.build(registry)`, `permissions.named(snapshot)`, `permissions.forUser(snapshot, assignments)`).
- **B. Validación (tdd):** `snapshot.ts`, `resolve.ts`, `properties.ts`, `validate.ts`, `permissions.ts`, `tests/validate.test.ts`, `tests/security.test.ts`, `tests/audit-fixes.test.ts`, `tests/permissions.test.ts`.
- **C. Borrado y build:** eliminar CLI, `bin/`, `state.ts`, `seal.ts`, `context.ts`, tests generados; `package.json`, `scripts/build.ts`, `tsconfig.build.json`, `tests/architecture.test.ts`, `tests/typecheck/roles.ts`.
- **D. Documentación:** `USAGE.md`, `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `CHANGELOG.md`.

Integración secuencial: `bun run typecheck`, `bun test`, `bun run build`, `grep -rn "globalThis\|Symbol.for\|seal\|RoleRegistry" src/` vacío, `grep -c globalThis dist/esm/index.js` = 0, ejemplo de `USAGE.md` ejecutado como test de integración (`tests/usage-example.test.ts`).

## 9. Supuestos y decisiones a confirmar (AIS-2)

| ID | Decisión | Por qué | Si es incorrecta |
| --- | --- | --- | --- |
| D1 | Roles se declaran en el constructor (`roles` tipado) y también por `context.set('roles')` (runtime, sin tipado). | El prompt exige conservar `context.set` y tipar por genérico; solo el constructor puede inferir `R`. | Si solo se quiere constructor: se elimina la clave `roles` de `context.set` y una regla de USAGE.md. Si solo `context.set`: no hay tipado de roles sin generador. |
| D2 | Builders enlazan sus métodos públicos en el constructor con `bind`; cache de builders hijos por clave. | USAGE.md R49 exige identidad y métodos extraíbles; test existente lo cubre. | Sin `bind`: se borra ese test y se documenta que los métodos no se extraen. |
| D3 | Comprobaciones cruzadas en `snapshot.build`, perezoso y memorizado; `validate` las reporta como `VALIDATION_ERROR` con `cause` `INVALID_DEFINITION`; las vistas lanzan. | Sin `seal()` no hay otro punto donde todos los módulos estén cargados; `validate` nunca lanza (R51). | Alternativa: método explícito `pkit.check()` que lance; reintroduce un paso obligatorio, que es lo que se elimina. |
| D4 | `context.set` válido en cualquier momento; cada mutación invalida el snapshot. Nada se congela por instancia (`Object.isFrozen(pkit)` cae; `context`, `permissions`, vistas y definiciones siguen congelados). | Sin ciclo abierto/sellado no hay momento para congelar. | Si se quiere inmutabilidad tras el primer `validate`: reintroduce `SEALED` con otro nombre. |
| D5 | `engines.node >=20` se mantiene; `@types/node` se mantiene por `scripts/build.ts`. | Sin evidencia de que versiones anteriores funcionen; fuera del alcance probarlo. | Bajar el mínimo requiere test en esa versión. |
| D6 | `reservedFields` se trata como parte del contrato aunque USAGE.md no la documente (solo README y CHANGELOG 0.2.1); se añade a `USAGE.md`. | Está publicada en 0.2.1 y tiene tests. | Si se descarta: se borra la clave, sus tests y la mención del README. |
| D7 | `ValidationError` con `code` `VALIDATION_ERROR` por snapshot inválido lleva `cause` = `PkitError`; mensaje estable "registry has invalid definitions". | R51: mensaje estable y `cause` original. | Nombre del mensaje a gusto del usuario. |
| D8 | `ModuleBuilder.hook` sobre módulo sin nombres se rechaza en `snapshot.build`, no en registro. | Un hook puede registrarse antes de importar los nombres del módulo (mismo caso que grants, R21). | Si se quiere rechazo inmediato, se rompe la carga en cualquier orden. |
| D9 | Sin dependencias nuevas. Necesidades: `Map`/`Set`, `Object.freeze`, `Object.create(null)`, `Promise.allSettled`, template literal types de TS 5.9. Todo en stdlib y TypeScript instalado (AIS-6). | Ninguna necesidad excede el stdlib. | — |

## 10. Riesgos

- `sideEffects: false` + archivos de permisos del consumidor importados solo por efecto secundario: el bundler del consumidor puede seguir descartándolos si el archivo que los importa no usa nada de ellos. Mitigación documental en `USAGE.md`: importar los archivos de permisos desde el archivo central que crea la instancia y exportarla desde ahí. No se cambia `sideEffects`.
- Comprobaciones perezosas (D3): un grant hacia un módulo nunca importado se descubre en la primera petición, no al arrancar. Mitigación: documentar `pkit.permissions.named` como comprobación de arranque opcional (lanza si el registro es inválido).
- Genérico `R` en `./types`: consumidores que importan `PermissionId` sin genérico obtienen `string`; menos estricto que hoy con `RoleRegistry` augmentado. Documentar `PermissionId<typeof pkit extends Pkit<infer R> ? R : never>` o exportar un tipo utilitario `RolesOf<P>`.
- Tamaño de tests adaptados: unas 35 llamadas a `seal()` en `validate.test.ts` y cuatro helpers en `security.test.ts`; riesgo de pérdida accidental de casos. Mitigación: el inventario de tests (conservar/adaptar/eliminar) se usa como checklist en el informe de la fase 2.

## Informe de entrega (fase 1)

```txt
Requirements covered:       Plan de implementación → REWRITE-PLAN.md (prompt §1 fase 1, §8 fase 1). Inventarios de contrato, tests y borrado obtenidos con tres sub-agentes de solo lectura.
Assumptions:                D1–D9 en §9.
Scope:                      Pedido: plan. Cambiado: REWRITE-PLAN.md creado. src/ intacto. Proposed, not applied: tipo utilitario RolesOf<P> (§10), test de integración usage-example.test.ts (§8).
Files changed:              created REWRITE-PLAN.md
Dependencies:               none (D9)
Patterns followed:          CLAUDE.md (un export default por módulo, objetos de funciones, sin arrow functions); excepción de clases limitada a pkit.ts y builders.
Simplicity decisions:       Cinco clases, sin interfaces ni fábricas; snapshot memorizado en lugar de ciclo sellado; context.set conservado por requisito, no por necesidad (D1).
Fallbacks and error paths:  none nuevos; validate traduce PkitError de snapshot a VALIDATION_ERROR con cause (D3, D7).
Security-relevant changes:  none en fase 1. Fase 2 conserva controles R27, R33, R46, R51.
Performance:                estimación: build O(módulos × nombres × grants) una vez por mutación; validate O(|permissions| + |paths|) por petición. Not measured.
Validations executed:       none (fase de plan; no hay código).
Validations not executed:   bun run typecheck / bun test / bun run build → sin código nuevo → ejecutar en fase 2.
Result:                     plan aprobable con árbol de src/, firmas, ubicación de cada comprobación de seal(), orden de bloques paralelos y decisiones abiertas.
Completeness:               complete para fase 1.
Residual risks:             §10.
Decisions needing approval: D1–D9; excepción contextual de clases (prompt §6); versión 0.3.0 vs 1.0.0.
```
