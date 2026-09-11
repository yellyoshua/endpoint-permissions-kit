# Arquitectura de Endpoint Permissions Kit

La librería mantiene un registro de permisos en memoria y lo cierra con `seal()`. La aplicación importa su catálogo y sus módulos, sella el registro y llama a `validate()` por petición. El CLI genera los tipos de roles desde un config ejecutado en un proceso aislado. No hay adaptadores de framework, acceso a bases de datos ni descubrimiento de rutas en el filesystem.

## Mapa de carpetas y archivos

```text
endpoint-permissions-kit/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── constants.ts
│   ├── errors.ts
│   ├── state.ts
│   ├── context.ts
│   ├── registry.ts
│   ├── resolve.ts
│   ├── seal.ts
│   ├── permissions.ts
│   ├── Validators.ts
│   ├── validate.ts
│   └── cli/
│       ├── generate.ts
│       ├── child.ts
│       └── protocol.ts
├── bin/
│   └── pkit.mjs
├── scripts/
│   └── build.ts
├── tests/
│   ├── architecture.test.ts
│   ├── helpers.ts
│   ├── registry.test.ts
│   ├── permissions.test.ts
│   ├── validate.test.ts
│   ├── generate.test.ts
│   ├── typecheck.test.ts
│   ├── pkit.generated.d.ts
│   └── typecheck/
│       ├── roles.ts
│       ├── pkit.generated.d.ts
│       └── tsconfig.json
├── docs/
│   ├── architecture.md
│   └── refactor-report.md
├── README.md
├── USAGE.md
├── CLAUDE.md
├── package.json
├── bun.lock
├── tsconfig.json
├── tsconfig.build.json
└── .gitignore
```

`dist/` y `node_modules/` son salidas de compilación y dependencias instaladas, respectivamente. `.git/` contiene el estado de control de versiones; ninguno es fuente que se refactorice manualmente.

| Archivo | Responsabilidad y consumidores |
| --- | --- |
| `src/index.ts` | Compone `pkit`, mantiene los exports públicos con nombre y enumera explícitamente los tipos publicados |
| `src/types.ts` | Contratos de roles, métodos, acciones, hooks, entradas, resultados, errores y vistas; subpath público `./types` |
| `src/constants.ts` | Métodos disponibles, rol general, propietario de hooks globales y comodín de campos |
| `src/errors.ts` | Crea excepciones nativas con nombre `PkitError` y código; no devuelve respuestas de validación |
| `src/state.ts` | Inicializa y devuelve el registro mediante getOrCreateState; el símbolo y su host se limitan a esa función |
| `src/context.ts` | Declara y consulta el catálogo de roles; exige configuración antes del primer registro |
| `src/registry.ts` | Builders con funciones declaradas y argumentos vinculados; registra acciones/hooks tras ejecutar Validators; mantiene identidad y alcance |
| `src/resolve.ts` | `resolveAction` comparte el respaldo por método; `resolveRole` comparte la selección del rol general |
| `src/seal.ts` | Comprueba hooks huérfanos de rol y materializa vistas congeladas; una segunda llamada no modifica el estado |
| `src/permissions.ts` | Expone el catálogo y el mapa plano por rol; exige sellado y rechaza roles desconocidos |
| `src/Validators.ts` | Validaciones explícitas y reutilizables de objetos, strings, catálogo, roles, definiciones, hooks y peticiones; nunca consulta estado global ni formatea respuestas |
| `src/validate.ts` | Invoca la validación de petición y ejecuta hooks; único propietario del formato `{ result, errors }` |
| `src/cli/generate.ts` | Carga configuración, ejecuta el hijo, construye declaraciones, escribe o comprueba el archivo y gestiona la salida del CLI |
| `src/cli/child.ts` | Importa el config y emite el catálogo marcado en stdout |
| `src/cli/protocol.ts` | Constantes compartidas del protocolo padre/hijo y códigos de salida |
| `bin/pkit.mjs` | Entrada ejecutable Node que llama al CLI compilado |
| `scripts/build.ts` | Limpia `dist`, compila ESM/CJS con Bun y emite declaraciones con TypeScript |
| `tests/architecture.test.ts` | Inspección AST que rechaza arrow functions, expresiones de función, funciones anidadas y defaults de parámetros/destructuring |
| `tests/helpers.ts` | Prepara el catálogo de portales y reinicia el estado entre pruebas |
| `tests/registry.test.ts` | Contratos de registro, roles, sellado, copia de definiciones y ausencia de mutaciones parciales |
| `tests/permissions.test.ts` | Vistas resueltas, denegaciones, acceso antes de sellar e inmutabilidad |
| `tests/validate.test.ts` | Fases de autorización, errores, campos, hooks, datos inválidos y rol general |
| `tests/generate.test.ts` | Consumidores temporales, generación real, archivo obsoleto/ausente y fallos del config |
| `tests/typecheck.test.ts` | Ejecuta el compilador sobre el fixture de tipos sin ocultar la salida del proceso |
| `tests/pkit.generated.d.ts` | Catálogo de roles para las pruebas de ejecución |
| `tests/typecheck/roles.ts` | Casos válidos e inválidos de la API TypeScript, incluyendo llamadas sin rol |
| `tests/typecheck/pkit.generated.d.ts` | Catálogo que amplía el subpath de tipos en el fixture aislado |
| `tests/typecheck/tsconfig.json` | Configura el programa de tipos del fixture |
| `package.json` | Entradas ESM/CJS/tipos, binario, scripts y dependencias de desarrollo |
| `bun.lock` | Versiones resueltas de dependencias; sin cambios en esta refactorización |
| `tsconfig.json` | Comprobación estricta de fuentes, scripts y pruebas |
| `tsconfig.build.json` | Emisión de declaraciones con tipos Node, sin tipos Bun en la librería |
| `.gitignore` | Excluye dependencias, salidas, logs y archivos locales |
| `CLAUDE.md` | Instrucciones de desarrollo existentes; conservadas |
| `README.md` | Presentación, comandos existentes y entradas públicas |
| `USAGE.md` | Ejemplos completos y comportamiento de roles, campos, hooks y CLI |
| `docs/architecture.md` | Mapa, dependencias, decisiones y excepciones |
| `docs/refactor-report.md` | Alcance, hallazgos corregidos y evidencia de verificación |

## Dependencias y estado

`index` compone la fachada. `context`, `registry`, `seal`, `permissions` y `validate` consumen el estado y los contratos del núcleo y delegan sus comprobaciones a `Validators`. Los imports de State/ModuleEntry en Validators son solo de tipos; no hay dependencia de ejecución hacia state. `resolve` comparte la regla de autorización entre `seal` y `validate`. Los contratos y las constantes no importan implementaciones. El núcleo no importa `cli`; las APIs Node quedan en el CLI y el build.

El estado vive en `globalThis[Symbol.for('endpoint-permissions-kit')]`. Las copias ESM y CJS comparten ese registro dentro del mismo proceso. Cada proceso hijo tiene un estado independiente.

| Miembro | Contenido |
| --- | --- |
| `roles` | `Set<string>`; contiene siempre `general` |
| `modules` | `Map` de ruta lógica a acciones por rol y hooks por rol/método |
| `snapshot` | `null` durante el registro; después contiene el catálogo y los mapas por rol |

Los mapas internos no se publican en la fachada. Las acciones se copian y congelan antes de insertarse. Las vistas y los diccionarios de acciones no tienen prototipo; cada definición de método es un objeto congelado. El snapshot solo se publica cuando todo el sellado termina; un error no deja vistas parciales.

## Flujo y errores

```text
config → context.set → registerActions / hook → seal
petición → validate → sellado → select compatible → rol → acción → método → datos/campos → hooks
```

La configuración, el registro, el sellado y las consultas de vistas lanzan excepciones. No retornan errores de autorización formateados. `validate()` captura las excepciones de sus fases y devuelve un único contrato. No convierte fallos en resultados exitosos.

| Error | Respuesta de `validate` |
| --- | --- |
| Registro abierto | `NOT_SEALED` |
| `select` fuera de `find`, o forma inválida de datos/contexto/select | `INVALID_INPUT` |
| Rol fuera del catálogo | `UNKNOWN_ROLE` |
| Acción no registrada | `UNKNOWN_ACTION` |
| Método ausente o deshabilitado | `METHOD_DISABLED` |
| Claves no permitidas en escritura | `PROPERTIES_NOT_ALLOWED`, con `fields` |
| Uno o varios hooks fallan | Un `HOOK_ERROR` por hook fallido, con `cause` |
| Excepción inesperada de otra fase | `VALIDATION_ERROR`, mensaje estable y `cause` original |

Todo fallo produce `result: null`. El éxito produce una selección efectiva para `find` o el mismo objeto `data` para escritura. Los arrays `errors` se congelan. Los hooks conservan su mensaje y causa; el consumidor decide qué exponer y qué registrar.

## Roles, campos y hooks

- Omitir `role` selecciona `general`; `forRole()` usa la misma convención. Se trata de ausencia/`undefined`, no de sustituir valores inválidos.
- Un rol explícito debe existir. Sus métodos ausentes heredan de `general`; `enabled: false` no hereda una autorización positiva.
- `registerActions` acepta un subconjunto de los cuatro métodos. Sin definición propia ni general, el método está denegado.
- `find` recorta la selección a los campos permitidos. Sin selección usa `properties`; el comodín devuelve `'*'` o la selección explícita.
- Escritura exige que las claves de `data` sean un subconjunto de `properties`; el comodín elimina únicamente esa restricción de campos.
- `data` es obligatoria en escritura y opcional en find; `context` es opcional. Los valores opcionales ausentes se conservan como undefined al invocar hooks. No se fabrican objetos vacíos. `null`, arrays y primitivas se rechazan.
- Los hooks globales aplican a todos los roles. Los hooks de `general` aplican exclusivamente a `general`, incluso cuando otros roles heredan sus métodos.
- Todos los hooks aplicables se esperan con `Promise.allSettled`. El orden de errores sigue el registro: globales primero, luego los del rol. No transforman resultados.

## Tipos, CLI y distribución

`RoleRegistry` declara `general` y admite ampliación en `endpoint-permissions-kit/types`. `Role` es la unión de sus claves: no se amplía a `string`. El generador emite claves ordenadas y entrecomilladas. Los tipos públicos mantienen sus nombres; los parámetros genéricos usan nombres descriptivos.

El CLI busca `pkit.config.js`, `.mjs`, `.cjs` o `.ts`, o usa `--config`. Ejecuta el config con `process.execPath` y `execFile`, sin shell. La línea marcada de stdout contiene los roles; los logs ordinarios no interfieren. Un config fallido no sobrescribe el archivo existente. `--check` no escribe y considera obsoleto un archivo ausente.

Códigos de salida: 0 éxito, 1 fallo/archivo obsoleto y 2 comando incorrecto. La frontera de shell convierte excepciones a stderr y un código distinto de cero; no usa el contrato de autorización.

El build produce `dist/esm`, `dist/cjs` y `dist/types`. Las salidas CJS usan `.cjs`; el paquete mantiene `type: module`. Los exports publicados son la raíz, `./types` y `./package.json`. El build conserva sourcemaps externos. No se publica IIFE. Node >=20 es el contrato del paquete; para configs `.ts` el runtime debe admitir el flag de borrado de tipos utilizado por el CLI.

## Convenciones y excepciones

Nombres en inglés y camelCase; constantes en CONSTANT_CASE; tipos en PascalCase. Los nombres públicos existentes (`data`, `context`, `enabled`, `ActionDef`, `HookFn`, `pkit`) se conservan para no romper consumidores. Los exports internos requieren consumidores reales. El reinicio de estado pertenece a las pruebas; el renderizado de declaraciones pertenece al generador.

No se añaden clases ni dependencias. Las funciones se declaran a nivel de módulo y los recorridos usan bucles. `Validators.ts`, solicitado explícitamente, agrupa las comprobaciones; validateRequest concentra las fases de una petición y validateActions valida/copia el bloque completo. `validate` mantiene juntos la ejecución de hooks y el formato de errores. No se usan `else` ni el operador `in` en las implementaciones.

Los comentarios explicativos se sustituyen por código legible y este documento. Solo permanecen directivas funcionales `@ts-expect-error` en las pruebas de tipos y el shebang del binario. Los archivos de roles se regeneran desde un config con `general`, `admin`, `staff` y `public`; no llevan cabecera comentada.

```txt
Exception name: Contratos públicos existentes
Related rule: NT-1, NT-6
Context: enabled, los nombres públicos de tipos y los exports con nombre forman la API existente.
Why the exception is needed: renombrarlos o retirar exports públicos rompería consumidores.
Scope: Contratos publicados por src/index.ts y src/types.ts.
Expiration or review date: Próxima modificación explícita de la API pública.
Risks: enabled no usa prefijo is/has/can.
Required safeguards: Pruebas de tipos y consumo de la distribución.
Approved by: Solicitud de conservar el comportamiento de la librería y convención existente.
```

```txt
Exception name: Validación y formato de errores en validate
Related rule: FN-2, ERR-3
Context: El usuario solicita Validators.ts, funciones declaradas sin anidación y mantener juntas las fases de cada operación.
Why the exception is needed: validateRequest agrupa la validación; solo los controles reutilizados o expuestos por Validators son métodos separados. validate sigue siendo el límite que formatea.
Scope: src/Validators.ts, src/validate.ts y operaciones relacionadas.
Expiration or review date: Cuando crezcan las fases o cambie el contrato de errores.
Risks: Funciones más largas que la guía de unas 30 líneas.
Required safeguards: Guardas explícitas, ausencia de else y pruebas de orden, denegaciones y hooks.
Approved by: Solicitud del usuario en esta refactorización.
```

```txt
Exception name: Datos y contexto definidos por el consumidor
Related rule: Hard Prohibition 2
Context: La librería conoce los campos autorizados, no la forma de cada recurso o sesión.
Why the exception is needed: Data y Context mantienen Record<string, unknown>; validate conserva el tipo de escritura.
Scope: Entrada de validate y argumentos de hooks.
Expiration or review date: Si se incorpora tipado de hooks por módulo.
Risks: Accesos incorrectos del consumidor pueden lanzar dentro del hook.
Required safeguards: Rechazar formas inválidas en la frontera y conservar los fallos de hooks en errors.
Approved by: Contrato previo del proyecto.
```

## Coste y límites

La resolución realiza hasta dos lecturas del mapa de acciones. El sellado recorre roles × módulos × cuatro métodos y los hooks registrados. La evaluación de campos usa búsquedas sobre las listas declaradas; su coste estimado es proporcional a campos solicitados × campos permitidos. No se introducen índices o cachés adicionales sin medidas que los justifiquen.

No se midió rendimiento ni se verificó carga de producción. La librería no autentica usuarios, no aplica filtros a consultas por sí sola, no verifica manifiestos de rutas y no recarga el registro en caliente. La aplicación conserva esas responsabilidades.

## Funciones y argumentos de Validators

Todos estos métodos se exportan desde `src/Validators.ts` para reutilización interna; no se añaden al entrypoint público del paquete. Reciben argumentos explícitos y no leen globalThis.

| Método | Argumentos y resultado |
| --- | --- |
| `validateObject` | Valor desconocido y `{ code, message }`; afirma un objeto de datos |
| `validateStrings` | Valor desconocido y `{ code, message, minimumLength }`; afirma una lista de strings |
| `validateContextKey` | Clave desconocida; exige roles |
| `validateOpenRegistry` | Estado explícito; exige registro abierto |
| `validateSnapshot` | Snapshot genérico o null; exige snapshot materializado |
| `validateRole` | Rol desconocido, catálogo ReadonlySet y código de la operación |
| `validateRoleCatalog` | Lista desconocida y estado; combina registro abierto, orden de configuración y strings no vacíos |
| `validateModuleName` | Nombre desconocido; string no vacío y sin puntos |
| `validateMethod` | Método desconocido y acción para identificar el error |
| `validateActions` | Acciones desconocidas, `{ action, role }` y estado; comprueba registro/rol/duplicado y devuelve una copia congelada |
| `validateHook` | Hook desconocido, `{ action, role, method }` y estado; comprueba registro, rol, método y función |
| `validateRegisteredHooks` | ReadonlyMap de módulos; comprueba hooks de rol huérfanos |
| `validateRequest` | Petición y estado; devuelve permiso, módulo, datos, contexto y resultado tras comprobar todas las fases previas a hooks |

Objetos y listas se validan una sola vez por responsabilidad. Los catálogos de roles y el resultado del proceso hijo comparten validateStrings con longitud mínima uno; properties/select la usan con longitud mínima cero. La autorización de roles se comparte entre registro, peticiones y vistas.

Los checks de salida de procesos, existencia de archivos y sintaxis del comando permanecen en el CLI/build: son control de flujo de herramientas, no reglas del dominio. El CLI sí reutiliza la validación del contenido del catálogo.

`invokeHook` es una función async de módulo necesaria para convertir también un throw síncrono en un rechazo que Promise.allSettled pueda recoger sin impedir ejecutar los demás hooks. No formatea errores.

Los builders construyen su objeto completo con Object.assign antes de devolverlo. Su scope vincula la acción, el rol y la referencia al propio builder mediante bind. Las aserciones locales durante esa construcción permiten conservar identidad sin funciones anidadas; no se expone el objeto incompleto. Una prueba cubre identidad, alcance y extracción de métodos.

Los valores globales de un solo consumidor se limitaron a su método: símbolo del estado, candidatos/nombre de salida/uso del CLI y rutas de fixtures. Permanecen compartidos los métodos permitidos, general, el marcador de hooks globales, el comodín de campos y el protocolo CLI porque tienen usos reales múltiples. La inicialización de colecciones del registro no sustituye datos de una petición.

No hay defaults de parámetros ni destructuring. Se preservan como reglas explícitas general, respaldo por método, selección de properties y rutas convencionales del CLI. El tipo genérico WriteInput conserva su argumento de tipo opcional para compatibilidad; esto no suministra un valor de ejecución. Las funciones programáticas internas del generador requieren cwd explícito; main pasa process.cwd().
