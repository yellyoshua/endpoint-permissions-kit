# Prompt: reescritura de `endpoint-permissions-kit` sin estado global

Este archivo es un prompt para un agente de IA. Léelo completo antes de tocar el repositorio.

## 1. Rol y objetivo

Eres el agente responsable de planificar y ejecutar una reescritura completa de la funcionalidad interna de la librería `endpoint-permissions-kit`. La API pública que hoy documenta `USAGE.md` se conserva, salvo las eliminaciones que lista la sección 4. Toda la implementación interna se sustituye por una arquitectura basada en una instancia explícita, sin estado global.

Entregas en dos fases:

1. **Plan de implementación** (archivo `REWRITE-PLAN.md` en la raíz): módulos, clases, contratos, orden de trabajo, tareas paralelizables, riesgos y decisiones que el usuario debe confirmar.
2. **Ejecución del plan**, solo después de que el usuario apruebe el plan. No empieces a reescribir `src/` antes de esa aprobación.

No evalúes si el cambio es factible ni propongas alternativas al enfoque. La decisión de reescribir ya está tomada.

## 2. Contexto del proyecto

- Librería de autorización por endpoint, agnóstica de framework. Sin dependencias en runtime. TypeScript compilado a ESM y CJS más `.d.ts` con `scripts/build.ts` (Bun). `dist/` debe correr en Node >= 20.
- Comandos: `bun install`, `bun run typecheck`, `bun test`, `bun run build`.
- `package.json` expone `.` (`dist/esm/index.js`, `dist/cjs/index.cjs`, `dist/types/index.d.ts`) y `./types`. Declara `"sideEffects": false`. Hoy también expone `bin.pkit`.
- Reglas del repositorio en `CLAUDE.md` y `tests/architecture.test.ts`: sin arrow functions, sin parámetros por defecto, sin default bindings, sin comentarios en prosa, nombres de archivo en dash-case, un `export default` por módulo de `src/`, sin exports nombrados en runtime (excepciones: `src/index.ts`, `src/types.ts`).

### Motivo de la reescritura

El registro vive hoy en `globalThis[Symbol.for('endpoint-permissions-kit')]`. Los archivos del consumidor registran módulos como efecto secundario de su importación (`import './modules/x/permissions.js'`). En frameworks con tree shaking o con módulos aislados, esa configuración no llega a cargarse: `validate()` no encuentra roles ni permisos aunque todo esté en un mismo archivo. Se elimina el estado global y se sustituye por una instancia que el consumidor crea, exporta e importa explícitamente.

Observación para el plan (no la investigues, solo regístrala como riesgo): `"sideEffects": false` en `package.json` autoriza a los bundlers a eliminar importaciones sin bindings usados. Con la nueva arquitectura la instancia se importa por valor en cada archivo de permisos, así que el problema desaparece para la librería. Los archivos de permisos del consumidor seguirán siendo importaciones de efecto secundario en su `app.js`; documenta en `USAGE.md` que el consumidor debe importarlos desde el mismo archivo que crea la instancia o desde un archivo que exporte algo que la app use.

## 3. Fuentes de verdad

Basa el diseño solo en estos archivos. **No leas `src/` para diseñar**; el código actual no es referencia. Solo lo abrirás para borrarlo o para inventariar qué tests existen.

- `USAGE.md`: modelo de permisos, formato de identificadores, reglas de resolución `(role, module, method)`, comparación y recorte de propiedades, grants, hooks, códigos de error, contrato de `validate()` y vistas `permissions.named` / `permissions.forUser`. Cada regla de validación que ahí aparece es un requisito.
- `package.json`: qué se publica y cómo.
- `CLAUDE.md` y `tests/architecture.test.ts`: convenciones de código.
- `tests/*.test.ts` (solo como inventario): qué comportamientos tienen cobertura hoy, para conservar los casos que sigan aplicando.

## 4. Decisiones ya tomadas

Aplícalas sin reabrirlas.

1. **Sin estado global.** Nada en `globalThis`, ningún `Symbol.for`, ningún registro a nivel de módulo en `src/`. Todo el estado pertenece a una instancia.
2. **Una instancia exportada por el consumidor.** El consumidor crea la instancia en un archivo central (por ejemplo `pkit.ts`), la exporta y la importa en cada archivo de permisos y en el lugar donde ejecuta `validate()`. Los archivos de permisos del consumidor no tienen `export default`; registran sobre la instancia importada.
3. **Clases.** La instancia y los builders que dependen de ella son clases. Usa clases solo donde hagan falta: donde haya estado por instancia o encadenamiento que deba conservar identidad. La lógica pura (formato de identificadores, lectura del literal de `registerActions`, recorrido y recorte de `data`, resolución de acceso) se mantiene como objetos de funciones que reciben el estado por parámetro.
4. **Se elimina `seal()`.** No existe el ciclo abierto/sellado. Desaparecen los códigos `SEALED` y `NOT_SEALED`. Las comprobaciones que hoy hace `seal()` se reubican (ver sección 5, punto "Resolución sin seal").
5. **Se elimina la CLI.** Borrar `src/cli/`, `bin/`, `bin.pkit` en `package.json`, `tests/generate.test.ts`, `tests/pkit.generated.d.ts`, `tests/typecheck/pkit.generated.d.ts` y toda referencia a `pkit generate` en `README.md`, `USAGE.md` y `CONTRIBUTING.md`. `scripts/build.ts` deja de compilar la CLI.
6. **Tipado de roles sin generador.** `RoleRegistry` y la augmentación por archivo generado desaparecen. Los roles se tipan por genérico de la instancia, inferido del catálogo declarado (`as const`). `Role` y `PermissionId` derivan de ese genérico. `./types` sigue publicando los contratos públicos.
7. **API que se conserva** (misma firma y mismo comportamiento que en `USAGE.md`): `context.set` / `context.get` con las claves `roles`, `cropper`, `reservedFields`; `module(segment)` encadenable; `name(x)`; `role(r)`; `registerActions(literal)`; `grantTo(permissionId).registerActions(literal)`; `hook(method, fn)` en módulo, nombre y rol; `validate(input)` con el contrato `{ result, errors }`; `permissions.named` y `permissions.forUser(assignments)`; `METHODS`; todos los códigos de `PkitError` y `ValidationError` salvo los eliminados en el punto 4. Las reglas de las tablas de `USAGE.md` (formato de identificadores, precedencia directo sobre grant, un hop de grants, orden y ejecución de hooks con `Promise.allSettled`, matching de rutas por segmento, colapso de arrays, ciclos y profundidad 1000, `reservedFields`) se implementan tal cual.
8. **Sin dependencias nuevas.** Evalúa en el plan si alguna librería es necesaria y justifica la conclusión con el orden de preferencia de AIS-6 (instalado, stdlib, código local, dependencia nueva). La expectativa es que no haga falta ninguna.
9. **Versión y changelog.** Cambio incompatible: nueva entrada mayor en `CHANGELOG.md` (formato Keep a Changelog) que liste `seal()`, la CLI, `RoleRegistry`, `SEALED`, `NOT_SEALED` y el cambio de `import pkit from` a instancia propia, con la guía de migración para el consumidor.

## 5. Diseño esperado

Describe esto en el plan con nombres definitivos de archivos y clases. Lo siguiente marca el mínimo.

**Punto de entrada.** `src/index.ts` exporta la clase de la instancia como `export default`, sus tipos públicos y `METHODS`. Ya no exporta un objeto `pkit` preconstruido ni funciones sueltas `validate`, `seal`, `context`, `permissions`, `module`.

**Instancia.** Una clase (nombre sugerido: `Pkit`) que posee: catálogo de roles, `cropper`, `reservedFields`, mapa de módulos con nombres, definiciones por rol, grants y hooks; y los métodos `context`, `module`, `validate` y `permissions`. Todo lo que hoy está en `src/state.ts` pasa a ser campos privados de esta clase.

**Builders.** Clases `ModuleBuilder`, `NameBuilder`, `RoleBuilder`, `GrantBuilder` que reciben la instancia (o su registro interno) por constructor. Deben conservar identidad al encadenar y al extraer métodos, como exige `USAGE.md` (hoy se logra con `bind`; con clases, decide en el plan si los métodos se enlazan en el constructor o si se documenta que los métodos extraídos no se soportan; declara la decisión).

**Lógica pura como objetos de funciones.** Identificadores, definiciones, propiedades y resolución siguen la convención de `CLAUDE.md`: un `export default` con un objeto cuyos métodos reciben el estado necesario como argumento. Sin clases ahí.

**Resolución sin `seal()`.** `USAGE.md` permite registrar un grant antes de importar el módulo que referencia, y hoy `seal()` verifica referencias cruzadas, nombres sin acciones y role hooks sin camino. Sin `seal()`, el plan debe fijar dónde ocurren esas comprobaciones. Recomendación a confirmar por el usuario (regístrala como supuesto AIS-2): validar en el momento del registro todo lo que no dependa de otro módulo; el resto se comprueba de forma perezosa en la primera llamada a `validate()` o a una vista, memorizando el resultado e invalidándolo en cada registro posterior. Un registro inválido descubierto de forma perezosa hace que `validate()` devuelva `VALIDATION_ERROR` con el `PkitError` `INVALID_DEFINITION` como `cause`, y que las vistas lo lancen. Registrar después de haber validado es válido; no hay error `SEALED`.

**Tests de arquitectura.** Actualiza `tests/architecture.test.ts` para admitir `export default class` y métodos de clase, manteniendo la prohibición de arrow functions, parámetros por defecto, default bindings y exports nombrados en runtime. Documenta en `CLAUDE.md` la nueva excepción: qué archivos pueden exportar una clase y por qué.

## 6. Reglas de generación de código (skill `pro-architecture`)

La skill `pro-architecture` la invoca solo el usuario; tú no la invocas. Sus reglas se aplican igualmente y se resumen aquí. Cuando reportes un hallazgo o una desviación, usa el formato de auditoría:

```txt
Rule: <ID> — <nombre>
Verdict: INCUMPLIMIENTO | OBSERVACIÓN
Location: <archivo:línea>
Found: <qué hace el código>
Expected: <qué exige la regla>
Fix: <cambio concreto>
```

### Prohibiciones absolutas (AIS y hard prohibitions)

- No inventar archivos, rutas, APIs, firmas, resultados de tests, métricas ni requisitos (AIS-3).
- No declarar una verificación como ejecutada o exitosa si no se ejecutó o dio otro resultado (AIS-12).
- No entregar placeholders, stubs, cuerpos `TODO` ni pseudocódigo: la reescritura es una implementación completa (AIS-13).
- No ocultar fallos con fallbacks silenciosos, catches vacíos ni valores por defecto que enmascaren un error (AIS-9, ERR-1). `validate()` captura excepciones solo para traducirlas al contrato `{ result: null, errors }` con `cause`; nunca convierte un fallo en éxito.
- No introducir dependencias, abstracciones ni patrones sin necesidad demostrada (AIS-6, AIS-8, NT-5, Hard Prohibition 3). El paso a clases es el único patrón nuevo autorizado y solo donde la sección 4, punto 3, lo permite.
- No ampliar el alcance sin autorización (AIS-4). Cualquier mejora que detectes va en la lista "Proposed, not applied" del informe.
- No aplicar un reemplazo mecánico (renombrar, mover, envolver en clase el código actual) y presentarlo como reescritura (AIS-13). El diseño nace de `USAGE.md`, no de `src/`.
- No añadir comentarios en prosa (Hard Prohibition 4, COM-1). Permitidos: `@ts-expect-error`, shebang, JSDoc. Elimina los no permitidos de cualquier archivo que toques (COM-4). El porqué de una decisión va en el mensaje de commit (COM-5) o en `REWRITE-PLAN.md`.
- No introducir contratos sin tipar donde existe un tipo claro (Hard Prohibition 2, NT-2). Nada de `any` en la API pública ni en los contratos internos entre módulos.
- No colocar lógica en la capa equivocada (Hard Prohibition 1, MOD-2): `validate` es la frontera de confianza y valida la forma de `data`, `context`, método, rol e identificadores; el registro valida cada literal completo antes de mutar estado; las funciones puras no tocan la instancia.

### Reglas de calidad que debes aplicar

- **AIS-1 trazabilidad:** cada archivo creado o borrado se justifica con una regla de `USAGE.md`, una decisión de la sección 4 o un supuesto declarado.
- **AIS-2 supuestos:** cuando `USAGE.md` deje algo abierto, declara el supuesto, el porqué y qué cambia si es incorrecto, antes o junto con el cambio.
- **AIS-5 preservación:** no toques lo que la tarea no cubre (`LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, workflows existentes). Las eliminaciones autorizadas son solo las de la sección 4.
- **AIS-7 patrones locales:** sigue `CLAUDE.md`: dash-case, camelCase, PascalCase, CONSTANT_CASE, línea en blanco entre métodos y entre bloques lógicos, un `export default` por módulo, tipos exportados solo si otro archivo los importa.
- **AIS-8 y SIM-4:** solución directa primero; sin código especulativo, sin opciones de extensión que `USAGE.md` no pida. DUP-5 protege contra la sobrecorrección: dos algoritmos distintos para `cropper: false` y `cropper: true` no son duplicación.
- **FN-1 a FN-5:** una responsabilidad por función, tamaño contenido, sin efectos ocultos, sin anidamiento profundo.
- **ERR-2:** un solo contrato de error por frontera: `PkitError` con `code` en registro y vistas; `{ result, errors }` en `validate()`.
- **NT-1, NT-3, NT-4:** booleanos con semántica clara, nombres que describen el comportamiento real, lenguaje del dominio (`assignable`, `grant`, `name`, `role`) sobre nombres técnicos genéricos.
- **NT-6 exports:** el proyecto sobrescribe la convención general: un `export default` por módulo de `src/` y sin exports nombrados en runtime. Respétalo.
- **ALG:** `validate()` recorre `data` una sola vez por modo; la resolución de nombre por prefijo y la búsqueda de grants usan `Map` y `Set`, no búsquedas lineales repetidas por petición. Reporta la complejidad como estimación, sin benchmarks que no hayas ejecutado (AIS-11).
- **AIS-10 seguridad:** conserva cada control de `USAGE.md`: rechazo de `role` y `permissions` malformados, `PERMISSION_ROLE_MISMATCH`, `AMBIGUOUS_PERMISSION`, denegación de claves `constructor`, `prototype` y `__proto__` como campos ordinarios, vistas congeladas y sin prototipo, `errors` congelado, `data` nunca mutado.
- **Cambios de comportamiento requieren test** (`CLAUDE.md`). Toda regla de `USAGE.md` tiene al menos un test.

### Excepción contextual a registrar

Registra en `CLAUDE.md` (sección "Conventions") la excepción para clases con este formato:

```txt
Exception name: Clases para la instancia y los builders
Related rule: NT-6 / convención "un objeto por módulo"
Context: la instancia y los builders mantienen estado por instancia y encadenamiento con identidad
Why the exception is needed: sin estado global, el estado debe vivir en un objeto creado por el consumidor
Scope: src/index.ts, la clase de la instancia y las clases builder; ninguna otra
Expiration or review date: permanente mientras exista la API de instancia
Risks: que la lógica pura migre a métodos de clase
Required safeguards: tests/architecture.test.ts lista los archivos autorizados a exportar una clase
Approved by: el usuario, al aprobar REWRITE-PLAN.md
```

## 7. Skills disponibles y cuáles usar

Tienes acceso a un catálogo global de skills (frontend, GSAP, video, AWS, finanzas, legal, datos, plantillas de documentos, MCP, etc.). La mayoría no aplica a esta tarea. Usa solo estas, en este orden:

| Skill | Cuándo invocarla |
| --- | --- |
| `full-output-enforcement` | Al inicio de la fase 2. Garantiza archivos completos, sin truncar ni marcadores de reemplazo. |
| `ponytail:ponytail` | Al diseñar cada clase y módulo. Fuerza la solución mínima: clases solo donde haya estado o identidad, sin fábricas ni interfaces con una sola implementación. |
| `caveman:migration` | Al planificar la eliminación de `seal()`, la CLI y `RoleRegistry`: estructura el cambio incompatible, la guía de migración del `CHANGELOG.md` y la prueba de preservación de contratos. |
| `tdd` | Al implementar `validate()`, `properties` y `resolve`: escribe primero el test que fija la regla de `USAGE.md`, luego el código. |
| `caveman:verify-and-stop` | Al cierre: ejecuta `bun run typecheck`, `bun test`, `bun run build` y comprueba los criterios de aceptación sin ampliar el alcance. |

Skill obligatoria cuyas reglas ya están incluidas en la sección 6 y que **no invocas**: `pro-architecture`. Si el usuario la invoca sobre tu entrega, tu código debe pasar su auditoría sin `INCUMPLIMIENTO`.

No uses `modern-web-guidance`, `frontend-design`, ni ninguna skill de AWS, video, diseño, datos, finanzas o legal: no hay frontend, infraestructura ni documentos comerciales en esta tarea.

## 8. Sub-agentes y tareas paralelas

Usa sub-agentes solo donde las tareas sean independientes. Tú integras los resultados; ningún sub-agente edita un archivo que otro también edite.

### Fase 1: plan (lecturas en paralelo, solo lectura)

Lanza en un mismo turno:

1. **Extractor de contrato:** lee `USAGE.md` y produce la lista completa de métodos públicos, firmas, códigos de error y reglas de validación, cada una con la frase de `USAGE.md` que la origina. Es la base de trazabilidad AIS-1.
2. **Inventario de tests:** lee `tests/*.test.ts` y `tests/typecheck/` y devuelve una tabla `test → regla de USAGE.md → se conserva / se adapta / se elimina`. Los tests de `seal`, `NOT_SEALED`, `SEALED`, CLI y `RoleRegistry` se eliminan; los de `validate`, `security`, `registry`, `permissions` y `audit-fixes` se adaptan a la instancia.
3. **Inventario de borrado y build:** lee `package.json`, `scripts/build.ts`, `bin/pkit.mjs`, `README.md`, `CONTRIBUTING.md` y `CHANGELOG.md`; devuelve la lista exacta de archivos, líneas de `package.json` y secciones de documentación que cambian por la eliminación de la CLI y de `seal()`.

Con esos tres resultados redactas `REWRITE-PLAN.md`. El plan incluye: árbol de `src/` final, responsabilidad de cada archivo, qué es clase y qué es objeto de funciones, firma pública de la instancia con genéricos de rol, dónde se comprueba cada regla que hoy comprueba `seal()`, orden de implementación, tareas paralelas de la fase 2, supuestos AIS-2 y decisiones que el usuario debe confirmar.

### Fase 2: implementación (tras aprobación)

Secuencial, sin sub-agentes, porque todo depende de ella:

- **Paso 0:** `src/types.ts` y `src/constants.ts` con los contratos finales (genérico de rol, `ValidateInput`, `ValidateResult`, códigos). `src/errors.ts`.

Paralelo, un sub-agente por bloque, con los tipos del paso 0 congelados:

- **A. Núcleo de registro:** `src/identifiers.ts`, `src/definitions.ts`, la clase de la instancia, los builders y `context`. Tests: `tests/registry.test.ts`, `tests/permissions.test.ts` (parte de registro).
- **B. Validación:** `src/properties.ts`, `src/resolve.ts`, `src/validate.ts`, vistas `permissions`. Tests: `tests/validate.test.ts`, `tests/security.test.ts`, `tests/audit-fixes.test.ts`, `tests/permissions.test.ts` (parte de vistas). Este bloque usa `tdd`.
- **C. Eliminación y build:** borrar CLI y `bin/`, ajustar `package.json`, `scripts/build.ts`, `tsconfig.build.json`, `tests/typecheck/` (roles por genérico) y `tests/architecture.test.ts`.
- **D. Documentación:** `USAGE.md`, `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `CHANGELOG.md`. Toda referencia a `seal`, `pkit generate`, `globalThis`, `RoleRegistry` y `import pkit from` desaparece; los ejemplos usan la instancia exportada por el consumidor.

Integración final, secuencial: `bun run typecheck`, `bun test`, `bun run build`, y una comprobación manual de que `dist/esm/index.js` y `dist/cjs/index.cjs` exportan la clase y no tocan `globalThis` (`grep -c globalThis dist/esm/index.js` debe dar 0). Opcionalmente delega la revisión del diff completo al agente `caveman:cavecrew-reviewer`.

## 9. Criterios de aceptación

- `grep -rn "globalThis\|Symbol.for" src/` no devuelve nada.
- `src/` no contiene `seal`, `SEALED`, `NOT_SEALED`, `RoleRegistry` ni `src/cli/`.
- `bun run typecheck`, `bun test` y `bun run build` pasan y su salida real aparece en el informe.
- Cada regla de `USAGE.md` tiene un test que la fija; cada código de error conservado tiene al menos un test que lo produce.
- Dos instancias en un mismo proceso no comparten estado (test obligatorio).
- El ejemplo de `USAGE.md` funciona escrito contra la nueva API: archivo central que crea y exporta la instancia, archivos de permisos que la importan y registran, y un handler que importa el mismo archivo y llama a `validate()`.
- `tests/architecture.test.ts` pasa con la nueva excepción para clases.
- Ningún comentario en prosa en `src/`, `tests/` ni `scripts/`.

## 10. Informe de entrega (obligatorio, AIS-14)

Termina cada fase con este informe, en este orden, escribiendo `none` donde una sección esté vacía:

```txt
Requirements covered:       <requisito → archivos>; cambios incidentales con motivo (AIS-1)
Assumptions:                <qué / por qué / impacto si es incorrecto>, o "none" (AIS-2)
Scope:                      pedido vs cambiado; lista "Proposed, not applied" (AIS-4, AIS-5)
Files changed:              modificados / creados / borrados, uno por línea (AIS-5)
Dependencies:               añadidas o cambiadas; alternativas rechazadas; licencia; aprobación (AIS-6)
Patterns followed:          convención o archivo de referencia; desviaciones (AIS-7)
Simplicity decisions:       abstracciones añadidas; generalizaciones omitidas; duplicaciones mantenidas (AIS-8)
Fallbacks and error paths:  cada fallback nuevo y qué observa el llamador (AIS-9)
Security-relevant changes:  controles tocados; entradas nuevas y su validación; o "none" (AIS-10)
Performance:                estimaciones como estimaciones; mediciones con comando; o "not measured" (AIS-11)
Validations executed:       <comando> → <resultado real>, uno por línea (AIS-12)
Validations not executed:   <qué> → <por qué> → <comando para el usuario> (AIS-12)
Result:                     resultado observable: qué funciona ahora, qué cambia para el consumidor
Completeness:               "complete" o huecos explícitos (AIS-13)
Residual risks:             qué podría seguir mal y cómo se manifestaría
Decisions needing approval: excepciones usadas; desviaciones; lo que el usuario debe confirmar
```
