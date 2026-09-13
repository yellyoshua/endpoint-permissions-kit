# Informe de refactorización funcional

Fecha: 2026-09-09. Esta entrega parte del resultado de la refactorización anterior, que estaba preparado en el índice de Git. No se alteró ese índice. Las ubicaciones del estado anterior pueden consultarse mediante `git show :<archivo>` mientras permanezca intacto.

## Requisitos cubiertos

| Requisito | Archivos y resultado |
| --- | --- |
| Declaraciones function en lugar de constantes con arrow functions | Fuentes, build, pruebas y ejemplos de USAGE; comprobado mediante AST |
| Sin funciones dentro de funciones | Builders mediante bind, recorridos con bucles y callbacks declarados a nivel de módulo; pruebas también adaptadas |
| Agrupar operaciones y quitar funciones innecesarias | validateRequest concentra las fases previas a hooks; validateActions concentra registro y copia; validate ejecuta hooks y formatea |
| Crear Validators con argumentos explícitos | src/Validators.ts expone sus validaciones sin consultar globalThis; inventario de argumentos en architecture.md |
| Unificar validaciones | Objetos, strings, roles, estado abierto/sellado y métodos compartidos entre sus consumidores; CLI reutiliza validateStrings |
| Limitar globales de un solo uso | Símbolo/host del estado dentro de getOrCreateState; opciones convencionales del CLI y rutas de pruebas locales |
| Evitar defaults | Sin inicializadores de parámetros/destructuring; sin sustitución de data/context por objetos; generador programático exige cwd |
| Mantener general y los errores en validate | resolveRole comparte la regla general; solo validate retorna result/errors y conserva fallos de hooks |

## Supuestos

- “Sin funciones dentro de otras” se interpreta como no definir implementaciones anidadas. Los callbacks necesarios son declaraciones de módulo y bind vincula argumentos sin introducir cuerpos de función locales. También se aplicó a las pruebas.
- “Evitar valores por default” elimina sustitutos de datos ausentes y defaults de parámetros. Se mantienen las reglas pedidas previamente: general, respaldo por método, selección de properties y rutas convencionales del CLI. Si se pretendía eliminar esas reglas, sería un cambio adicional de comportamiento.
- Los métodos de Validators se exportan desde ese archivo para sus consumidores internos, sin ampliar el entrypoint público de la librería.

## Alcance y archivos

Alcance: código propio, pruebas, build, ejemplos y documentación. Configuración, binario, constantes compartidas y declaraciones generadas se revisaron y se conservaron cuando no necesitaban cambios. Los archivos de dependencias no se editaron; dist se regeneró con el build. Propuesto y no aplicado: ninguno.

Modificados:

```text
README.md
USAGE.md
docs/architecture.md
docs/refactor-report.md
scripts/build.ts
src/cli/generate.ts
src/context.ts
src/errors.ts
src/permissions.ts
src/registry.ts
src/resolve.ts
src/seal.ts
src/state.ts
src/types.ts
src/validate.ts
tests/generate.test.ts
tests/helpers.ts
tests/permissions.test.ts
tests/registry.test.ts
tests/typecheck.test.ts
tests/typecheck/roles.ts
tests/validate.test.ts
```

Creados: src/Validators.ts y tests/architecture.test.ts. Eliminados por esta intervención: ninguno. Las eliminaciones preparadas en Git eran anteriores a esta tarea.

Dependencias: ninguna añadida ni actualizada. La comprobación AST usa TypeScript, que ya era dependencia de desarrollo.

## Hallazgos y correcciones

Las restricciones sobre sintaxis function, ausencia absoluta de anidación y defaults provienen directamente del usuario. No se presentan como prohibiciones universales de la skill. Quedan registradas como convenciones del proyecto y verificadas por tests/architecture.test.ts.

```txt
Rule: DUP-1 — Duplicated Business Logic
Verdict: INCUMPLIMIENTO
Location: src/context.ts:16; src/registry.ts:86; src/validate.ts:48; src/cli/generate.ts:47 (estado previo)
Found: La comprobación de listas de strings se implementaba por separado en catálogo, propiedades, select y protocolo CLI.
Expected: Un criterio compartido que preserve las diferencias reales de cada contrato.
Fix: validateStrings recibe código, mensaje y longitud mínima; los consumidores pasan explícitamente cero o uno.

Rule: DUP-1 — Duplicated Business Logic
Verdict: INCUMPLIMIENTO
Location: src/validate.ts:38; src/validate.ts:41; src/registry.ts:75 (estado previo)
Found: La comprobación de forma de objeto aparecía en varias operaciones.
Expected: Un validador reutilizable que rechace null, arrays y primitivas sin sustituir datos.
Fix: validateObject recibe valor desconocido y descripción del error; configuración y petición comparten la comprobación.

Rule: SIM-3 — Needless Indirection
Verdict: OBSERVACIÓN
Location: src/registry.ts:97; src/registry.ts:111 (estado previo)
Found: Callbacks anidados delegaban el registro de hooks y retornaban el builder capturado.
Expected: Mantener el alcance y el encadenamiento sin cuerpos locales, según el nuevo requisito.
Fix: registerHook es una única declaración genérica de módulo; su scope explícito conserva la referencia al builder.
```

## Decisiones y efectos

Patrones seguidos: funciones, objetos de fachada, registro por símbolo global, mapas de permisos y contratos de errores del proyecto. La nueva ubicación Validators es una decisión explícita del usuario. No se añaden clases ni adaptadores.

Simplicidad: los validadores compartidos tienen consumidores reales. validateRequest agrupa las fases de una petición; validateActions comprueba y copia un bloque completo antes de insertarlo. invokeHook permanece porque convierte throws síncronos en promesas rechazadas sin interrumpir los demás hooks. Los callbacks de pruebas ahora son funciones nombradas y no closures locales.

La construcción de builders usa un objeto local que se completa con Object.assign antes de devolverse. Bind recibe un scope explícito con acción, rol y builder. Esto conserva identidad, claves públicas y extracción de métodos; no expone el objeto incompleto. Las aserciones de tipo quedan confinadas a esa construcción.

Respaldo y errores: general y herencia por método se conservan en resolve.ts. data de escritura pasa a ser obligatoria, también en TypeScript. En find, data puede omitirse; context puede omitirse en todos los métodos. Los hooks reciben undefined cuando falta un argumento opcional. Si necesitan esos datos y fallan, validate conserva el error. generate/checkGenerated requieren opciones con cwd; main entrega process.cwd(). No se añadieron sustitutos silenciosos.

Seguridad: se mantienen las denegaciones por rol desconocido, método deshabilitado y campos prohibidos; los hooks solo corren tras autorizar. La validación de strings ahora rechaza también huecos de arrays que every podía omitir. Campos, hooks y resultado usan la misma lectura de data. La librería sigue sin autenticar usuarios ni decidir qué causas de error puede exponer un handler HTTP.

Rendimiento: no medido; no se afirma ninguna mejora. Se mantienen los mapas y el recorrido de campos. Los bucles sustituyen callbacks por claridad y por la restricción de funciones anidadas, no por una medición de velocidad.

## Validaciones ejecutadas

- `bun run typecheck` → correcto; incluye rechazo en compilación de escrituras sin data y tipos opcionales de argumentos de hooks.
- `bun test` → 65 pruebas correctas, 0 fallos, 121 assertions.
- La prueba AST recorre src, scripts y tests: ninguna implementación arrow, expresión de función, implementación anidada o default de parámetros/destructuring.
- `bun run build` → ESM, CJS y declaraciones generados correctamente.
- `bunx tsc --noEmit --noUnusedLocals --noUnusedParameters` → correcto.
- `git diff --check` → correcto.
- Consumidor temporal Node ESM/CJS → registro compartido, métodos vinculados, identidad, general, argumentos ausentes y escritura con data explícita correctos.
- Binario Node con configs mjs, cjs y ts → generación, archivo vigente, archivo obsoleto y códigos de salida correctos; check no sobrescribe el archivo.
- Consumidor externo TypeScript de dist/types, con strict y skipLibCheck false → correcto.

Las pruebas de distribución se ejecutaron con un script Python temporal de la sesión: creó un consumidor, enlazó el paquete en node_modules, ejecutó assertions con Node y TypeScript y eliminó el directorio. No se añadió ese script al proyecto.

Validaciones no ejecutadas: matriz de runtimes Node, instalación desde un registro y carga de producción. No forman parte del entorno disponible. Para otro runtime, repetir el build, las llamadas al binario y las pruebas import/require en el consumidor real. Rendimiento y compatibilidad de consumidores externos no disponibles: not assessable with the available evidence.

## Entrega

Resultado: implementación con declaraciones function sin cuerpos anidados, reglas de validación centralizadas y compartidas, globales limitados a usos reales y datos ausentes visibles. Se actualizó el mapa de arquitectura, el inventario de Validators y los ejemplos de uso.

Completitud: completa dentro del alcance revisado. Siguiente paso del consumidor: pasar data explícitamente al escribir y adaptar los hooks que suponían recibir siempre un objeto de contexto.

Riesgos residuales: los contratos de data obligatoria y context/data opcionales en hooks requieren ajustar esos consumidores; las funciones internas del generador ahora requieren cwd. Los configs TypeScript necesitan un runtime que admita el soporte de tipos utilizado por el CLI. No se modificaron versiones de runtimes o dependencias.

Decisiones que requieren aprobación: ninguna pendiente. Se mantienen las excepciones documentadas para enabled y los exports públicos existentes; las funciones extensas de validación, la ubicación Validators y los scopes vinculados están justificados por esta solicitud. Permanecen las directivas funcionales ts-expect-error y el shebang del binario.

---

# Segunda pasada de refactorización

Fecha: 2026-09-10. Esta pasada parte del árbol limpio que dejó la entrega anterior, ya consolidada en commits. La frase de apertura de este documento ("estaba preparado en el índice de Git", `git show :<archivo>`) describe el estado de aquella sesión y ya no es reproducible: el índice está vacío y esas ubicaciones viven ahora en el historial.

## Alcance y estado inicial

Inventario revisado archivo por archivo: 15 fuentes en `src/` (12 en la raíz y 3 en `src/cli/`), `bin/pkit.mjs`, `scripts/build.ts`, 11 archivos bajo `tests/`, los cuatro documentos, `package.json`, ambos `tsconfig` y `.gitignore`. Excluidos por regla: `bun.lock` y `node_modules/` (dependencias de terceros), `dist/` (salida regenerada por el build) y `tests/**/pkit.generated.d.ts` (declaraciones generadas por el propio CLI, nunca editadas a mano).

Estado inicial de Git: rama `main`, árbol limpio, índice vacío, 10 commits por delante de `origin/main`. Todas las modificaciones de esta pasada quedan solo en el working tree.

## Hallazgos y correcciones

```txt
Rule: AIS-10 — Security Posture / MOD-2
Verdict: INCUMPLIMIENTO
Location: src/Validators.ts:64 (validateRoleCatalog); colisión observable en src/registry.ts:36 y src/validate.ts:24
Found: El catálogo aceptaba un rol llamado "*", el mismo valor que GLOBAL_HOOK_OWNER. Sus hooks se guardaban en el bucket de hooks globales: se ejecutaban para todos los roles, se ejecutaban dos veces para el propio "*", y validateRegisteredHooks omitía su comprobación de hooks huérfanos.
Expected: El marcador de hooks globales no puede ser también un rol del catálogo; los hooks de un rol solo corren para ese rol.
Fix: validateRoleCatalog rechaza "*" con INVALID_DEFINITION en el único punto por donde entran los roles (context.set). Regresión en tests/registry.test.ts.

Rule: FN-1 — Single Responsibility
Verdict: INCUMPLIMIENTO
Location: src/cli/generate.ts:29 (loadRoleDeclaration, estado previo)
Found: Una función de 43 líneas mezclaba descubrimiento del config, ejecución del proceso hijo, parseo del marcador, render de declaraciones y resolución de la ruta de salida.
Expected: Un orquestador que llame a pasos nombrados, cada uno en un nivel de abstracción.
Fix: resolveConfigPath, readRoleCatalog y renderRoleDeclarations como declaraciones de módulo; loadRoleDeclaration queda en 7 líneas. La excepción documentada para funciones largas nombra validateRequest, Validators y validate, no el generador, y no se amplía por analogía.

Rule: SIM-2 — Redundant Logic
Verdict: INCUMPLIMIENTO
Location: src/cli/generate.ts:33-34 (estado previo)
Found: `if (config !== undefined)` seguido de `if (config === undefined)` evaluaba la misma condición dos veces en el mismo camino.
Expected: Una sola decisión con salida temprana.
Fix: resolveConfigPath retorna en cuanto tiene la ruta.

Rule: NT-2 — Type Ambiguity
Verdict: OBSERVACIÓN
Location: src/cli/generate.ts:32 y :50 (estado previo); src/registry.ts:36 y :41 (estado previo)
Found: `let configPath: string | undefined`, `let catalogLine: string | undefined`, `let roleHooks` y `let methodHooks` cambiaban de undefined a su tipo final.
Expected: Cada identificador con un solo tipo durante su vida.
Fix: Salidas tempranas en el generador; `?? new Map<Method, HookFn[]>()` y `?? []` con set incondicional en registerHook.

Rule: NT-6 — Export Conventions
Verdict: INCUMPLIMIENTO
Location: src/Validators.ts:24, :43, :85
Found: validateObject, validateOpenRegistry y validateMethod se exportaban sin ningún consumidor fuera del archivo, contra la convención propia del proyecto ("Los exports internos requieren consumidores reales", docs/architecture.md).
Expected: Solo se exporta lo que otro módulo consume.
Fix: Pasan a privados. Verificado por grep sobre src, tests y scripts; Validators no aparece en los exports de package.json.

Rule: COM-2 — Lying or Outdated Documentation Block (aplicado a la documentación del proyecto)
Verdict: INCUMPLIMIENTO
Location: docs/architecture.md (inventario de Validators, fila de src/cli/generate.ts)
Found: El documento afirmaba que "todos" los métodos de Validators se exportan y describía generate.ts con la responsabilidad monolítica anterior.
Expected: La documentación describe el código tal como queda.
Fix: Inventario, fila del generador, regla del rol reservado y USAGE.md actualizados en el mismo cambio.

Rule: ninguna regla de la skill cubre este caso (patrones de un archivo de ignorado); se reporta en vez de atribuirle un ID, según la instrucción 4 de SKILL.md
Verdict: OBSERVACIÓN
Location: .gitignore:15-16
Found: Los patrones `_.log` y `report.[0-9]_.[0-9]_.[0-9]_.[0-9]_.json` tienen el comodín sustituido por guion bajo: solo ignoran nombres literales, no los archivos que su encabezado anuncia.
Expected: Patrones que ignoren los logs y los informes de diagnóstico.
Fix: `*.log` y `report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json`.
```

## No aplicables, evaluados

- ALG-1 y ALG-4: la librería no hace E/S ni consultas; no hay cargas que paginar. No aplican.
- ALG-2: el recorte de campos es `select` × `properties` sobre listas de campos declaradas, acotadas por configuración. La excepción "Small or limited data" y el propio ALG-2 excluyen colecciones acotadas; el coste ya está declarado en architecture.md. No se añadieron índices.
- DUP-1/DUP-2: los dos bucles de campos en validateRequest recorren la misma lista con propósitos distintos (conservar permitidos frente a reunir prohibidos). DUP-5 los mantiene separados. `tests/pkit.generated.d.ts` y `tests/typecheck/pkit.generated.d.ts` son idénticos pero pertenecen a dos programas TypeScript distintos y son archivos generados.
- COM-1/COM-4: los únicos comentarios en el código son ocho directivas `@ts-expect-error` en tests/typecheck/roles.ts y el shebang de bin/pkit.mjs, ambas categorías permitidas. No hubo limpieza que hacer.
- MOD-1: sin ciclos; Validators importa de state solo tipos.
- Revisión frontend: el proyecto no tiene frontend. No aplica.

## Excepciones respetadas, no ampliadas

- "Contratos públicos existentes" (NT-1, NT-6): `enabled` sin prefijo `is/has/can` y los exports con nombre de `src/index.ts` se conservan.
- "Validación y formato de errores en validate" (FN-2, ERR-3): validateRequest y validateActions siguen concentrando sus fases. La excepción nombra Validators y validate; no se extendió a `src/cli/generate.ts`, que sí se dividió.
- "Datos y contexto definidos por el consumidor" (Hard Prohibition 2): `Data` y `Context` siguen siendo `Record<string, unknown>`.
- Decisión documentada de mantener locales los valores de un solo consumidor: los nombres de config candidatos siguen dentro de resolveConfigPath, no se promovieron a constante de módulo.
- `src/Validators.ts` en PascalCase y la longitud de sus funciones responden a una petición explícita registrada en architecture.md; no se renombró.

## Propuestas no aplicadas

- Congelar `pkit.permissions` y declarar el getter `all` como `configurable: false`. `pkit` está congelado y sus vistas también, pero el objeto `permissions` intermedio admite redefinición. Ninguna regla lo exige y es un cambio observable en una fachada publicada: queda como propuesta (AIS-4).
- `tests/architecture.test.ts:31` reasigna el parámetro `functionDepth`; un `const` derivado se leería mejor. Cambio cosmético sin defecto demostrado.
- El formato de tipos en línea de `tests/validate.test.ts:9-18` y `:44-50` parece residuo de un formateador. Cosmético.

Ninguna de las tres necesita una entrada de excepción: son propuestas, no desviaciones aplicadas. No hay entradas nuevas para contextualExceptions.md en esta pasada.

## Supuestos declarados

- Los comentarios `#` de `.gitignore` se tratan como estructura del formato del archivo, no como comentarios de código: COM-4 no se aplicó a ellos al corregir los patrones. El caso no está cubierto por la lista permitida de comments-rules.md; se reporta en vez de asumir permiso (instrucción 4 de SKILL.md).
- Rechazar `"*"` como rol es un cambio de comportamiento en `context.set`. Se asume que ningún consumidor declara hoy ese rol, porque hacerlo ya producía autorización incorrecta. Si algún consumidor lo usara, su arranque fallará con INVALID_DEFINITION en lugar de ejecutar hooks para roles ajenos.

## Validaciones ejecutadas

- `bun run typecheck` (`tsc --noEmit` y `tsc --noEmit -p tests/typecheck`) → salida 0.
- `bun test` → 66 pruebas, 0 fallos, 123 assertions (línea base antes de los cambios: 65 pruebas, 0 fallos, 121 assertions).
- Regresión verificada al revés: retirando la guarda de validateRoleCatalog, tests/registry.test.ts pasa a 20 pass / 1 fail; restaurada, vuelve a verde.
- `bunx tsc --noEmit --noUnusedLocals --noUnusedParameters` → salida 0; confirma que la división de generate.ts no dejó imports huérfanos.
- `bun run build` → `dist listo: esm, cjs, types`, salida 0.
- Binario contra `dist/` en directorios temporales: `pkit generate` escribe el catálogo ordenado y sale 0; `--check` sobre el archivo vigente sale 0; sin config sale 1 con la lista de nombres buscados; comando inválido sale 2; un config que declara `roles: ['*']` sale 1 con el mensaje de rol reservado y no escribe el archivo.
- Reproducción previa del defecto: un script de sesión registró un hook del rol `"*"` y observó que corría para `staff` y dos veces para `"*"`.

## Validaciones no ejecutadas

- Sin linter en el proyecto: `package.json` no declara script de lint ni dependencia de ESLint/Biome. No hay comando que ejecutar.
- Matriz de runtimes Node, instalación desde un registro y medidas de rendimiento: fuera del entorno disponible. Para otro runtime, repetir `bun run build`, las llamadas al binario y las pruebas import/require en el consumidor real.
- Impacto en consumidores externos del rechazo de `"*"`: no hay consumidores conocidos en el repositorio. No evaluable con la evidencia disponible.

## Estado de Git al cerrar

`git status --porcelain` muestra solo entradas en la segunda columna (working tree); el índice sigue vacío, como al empezar. No se crearon commits ni se alteraron ramas ni historial.

## Cobertura archivo por archivo

| Archivo | Estado | Motivo |
| --- | --- | --- |
| `src/index.ts` | Revisado sin cambios | Fachada y exports públicos; cubiertos por la excepción "Contratos públicos existentes" |
| `src/types.ts` | Revisado sin cambios | El default de tipo de `WriteInput` está documentado como compatibilidad; `Data`/`Context` amparados por la excepción del consumidor |
| `src/constants.ts` | Revisado sin cambios | Cuatro constantes CONSTANT_CASE con consumidores múltiples |
| `src/errors.ts` | Revisado sin cambios | Constructor de excepciones con código estable; cumple ERR-2 |
| `src/state.ts` | Revisado sin cambios | Símbolo y host ya confinados a getOrCreateState |
| `src/context.ts` | Revisado sin cambios | Delega ambas comprobaciones en Validators; la nueva guarda entró en validateRoleCatalog |
| `src/registry.ts` | Corregido | NT-2 en registerHook: `?? new Map()` / `?? []` sustituyen los bloques `let`/`if` |
| `src/resolve.ts` | Revisado sin cambios | Dos funciones de una línea con dos consumidores reales cada una |
| `src/seal.ts` | Revisado sin cambios | FN-4: tres niveles de bucle, en el límite permitido; sin snapshot parcial |
| `src/permissions.ts` | Revisado sin cambios | Congelar la fachada intermedia queda como propuesta, no aplicada |
| `src/Validators.ts` | Corregido | NT-6: tres funciones sin consumidor externo pasan a privadas; AIS-10: validateRoleCatalog rechaza `*` |
| `src/validate.ts` | Revisado sin cambios | Excepción documentada "Validación y formato de errores en validate"; único dueño de `{ result, errors }` |
| `src/cli/generate.ts` | Corregido | FN-1, SIM-2 y NT-2: dividido en resolveConfigPath, readRoleCatalog y renderRoleDeclarations |
| `src/cli/child.ts` | Revisado sin cambios | 12 líneas; script de entrada del proceso hijo |
| `src/cli/protocol.ts` | Revisado sin cambios | Constantes compartidas por padre e hijo |
| `bin/pkit.mjs` | Revisado sin cambios | Cuatro líneas; el shebang es comentario permitido |
| `scripts/build.ts` | Revisado sin cambios | buildBundles tiene dos llamadas reales; el fallo de build sale con código distinto de cero |
| `tests/architecture.test.ts` | Revisado sin cambios | La reasignación de `functionDepth` queda como propuesta cosmética |
| `tests/helpers.ts` | Revisado sin cambios | Fixture de portales y reinicio de estado |
| `tests/registry.test.ts` | Corregido | Añadida la regresión del rol reservado `*` |
| `tests/permissions.test.ts` | Revisado sin cambios | Cubre vistas, denegaciones e inmutabilidad |
| `tests/validate.test.ts` | Revisado sin cambios | El formato de tipos en línea queda como propuesta cosmética |
| `tests/generate.test.ts` | Revisado sin cambios | Sigue verde contra el generador dividido; cubre config ausente, obsoleto y fallido |
| `tests/typecheck.test.ts` | Revisado sin cambios | Ejecuta tsc sobre el fixture sin ocultar su salida |
| `tests/typecheck/roles.ts` | Revisado sin cambios | Sus ocho `@ts-expect-error` son directivas permitidas |
| `tests/typecheck/tsconfig.json` | Revisado sin cambios | Programa aislado del fixture |
| `tests/pkit.generated.d.ts` | Excluido | Declaraciones generadas por el CLI; no se editan a mano |
| `tests/typecheck/pkit.generated.d.ts` | Excluido | Igual que el anterior, para el programa del fixture |
| `package.json` | Revisado sin cambios | Exports, binario y scripts coherentes con el build; sin script de lint que ejecutar |
| `tsconfig.json` | Revisado sin cambios | Estricto, con noUncheckedIndexedAccess |
| `tsconfig.build.json` | Revisado sin cambios | Emite declaraciones solo de `src`, con tipos Node |
| `.gitignore` | Corregido | Dos patrones con el comodín sustituido por guion bajo |
| `README.md` | Revisado sin cambios | Su descripción de roles y errores sigue siendo exacta tras los cambios |
| `USAGE.md` | Corregido | Documenta que `*` está reservado y no puede declararse como rol |
| `CLAUDE.md` | Revisado sin cambios | Instrucciones de desarrollo del proyecto; fuera del alcance de corrección |
| `docs/architecture.md` | Corregido | Inventario de Validators, fila del generador y regla del rol reservado |
| `docs/refactor-report.md` | Corregido | Sección de esta pasada; la anterior se conserva íntegra |
| `bun.lock` | Excluido | Dependencias de terceros |
| `dist/`, `node_modules/` | Excluidos | Salida de compilación y dependencias instaladas |

Pendientes: ninguno. Todo el inventario tiene estado asignado.

## Informe de entrega

- **Requirements covered:** refactor integral archivo por archivo con las correcciones aplicadas → los ocho archivos de la tabla marcados "Corregido". Cambios incidentales: ninguno; cada edición mapea a un hallazgo con regla.
- **Assumptions:** las dos declaradas en "Supuestos declarados" (comentarios de `.gitignore` fuera de COM-4; ningún consumidor declara hoy el rol `*`).
- **Scope:** solicitado, código propio, pruebas, scripts, infraestructura y documentación del proyecto; cambiado, 8 archivos. Propuesto y no aplicado: las tres entradas de "Propuestas no aplicadas". No se tocó la skill, `dist/`, `bun.lock` ni las declaraciones generadas.
- **Files changed:** modificados `.gitignore`, `USAGE.md`, `docs/architecture.md`, `docs/refactor-report.md`, `src/Validators.ts`, `src/cli/generate.ts`, `src/registry.ts`, `tests/registry.test.ts`. Creados: ninguno. Eliminados: ninguno.
- **Dependencies:** ninguna añadida, retirada ni actualizada. `bun.lock` y `package.json` sin cambios de dependencias.
- **Patterns followed:** declaraciones `function` a nivel de módulo, sin anidación ni defaults, verificadas por `tests/architecture.test.ts`; excepciones lanzadas con `pkitError` y código estable; mensajes en español como el resto del código; validaciones concentradas en `Validators.ts`. Referencias: `src/registry.ts` y `src/seal.ts` como archivos hermanos. Desviaciones: ninguna.
- **Simplicity decisions:** se añadieron tres funciones en `src/cli/generate.ts`, cada una con un paso real del flujo y un consumidor; ninguna abstracción nueva, interfaz ni opción de configuración. No se generalizó `resolveConfigPath` a otros formatos de config, ni se promovieron los nombres candidatos a constante de módulo, respetando la decisión documentada de mantener locales los valores de un solo consumidor. Se mantuvieron separados los dos bucles de campos de `validateRequest` por DUP-5.
- **Fallbacks and error paths:** ninguno nuevo. Los `??` introducidos en `registerHook` inicializan colecciones del registro, no sustituyen datos de una petición ni convierten un fallo en éxito. La guarda del rol reservado lanza; no degrada a un comportamiento permisivo.
- **Security-relevant changes:** se corrigió un defecto de autorización. Control tocado: aislamiento entre hooks de rol y hooks globales, ahora protegido en `validateRoleCatalog` (`src/Validators.ts`). Antes, un rol llamado `*` hacía que sus hooks — reglas de autorización — se ejecutaran para todos los demás roles y dos veces para él mismo, y evitaba la comprobación de hooks huérfanos al sellar. Cambio observable para el consumidor: `pkit.context.set('roles', [... , '*'])` lanza ahora `INVALID_DEFINITION` en el arranque en vez de sellar un registro con hooks cruzados. No se debilitó ningún control, no se añadieron entradas externas nuevas ni secretos.
- **Performance:** no medido y no se afirma ninguna mejora. `registerHook` hace ahora un `Map.set` incondicional donde antes lo hacía solo al crear la entrada: coste constante por registro, en fase de arranque, no por petición. El resto de rutas calientes queda igual.
- **Validations executed:** las listadas en "Validaciones ejecutadas".
- **Validations not executed:** las listadas en "Validaciones no ejecutadas".
- **Result:** un rol llamado `*` ya no puede declararse, con lo que los hooks de rol no pueden colarse en el bucket de hooks globales; el generador del CLI queda en pasos nombrados con el mismo comportamiento y los mismos códigos de salida; `Validators.ts` expone solo lo que otros módulos consumen; `.gitignore` ignora de verdad los logs. La documentación describe el código resultante.
- **Completeness:** completo dentro del alcance. Todo el inventario tiene estado y no quedan hallazgos sin resolver ni archivos sin revisar.
- **Residual risks:** un consumidor que hoy declare el rol `*` verá fallar su arranque; se manifiesta como `INVALID_DEFINITION` en `context.set`, no en silencio. La división de `generate.ts` cambia la traza de llamadas del CLI, aunque los mensajes y códigos de salida se verificaron idénticos. No hay linter en el proyecto, así que ninguna comprobación de estilo automática respalda estos cambios.
- **Decisions needing approval:** ninguna excepción nueva se usó ni se aplicó. Las tres propuestas no aplicadas quedan a decisión del usuario. No hay entradas pendientes para contextualExceptions.md.
