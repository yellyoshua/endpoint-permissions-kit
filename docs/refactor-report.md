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
