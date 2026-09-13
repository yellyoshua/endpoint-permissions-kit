# Auditoría de seguridad de la lógica de Endpoint Permissions Kit

Actúa como auditor de seguridad especializado en bibliotecas TypeScript/JavaScript de autorización. Analiza la implementación actual de `endpoint-permissions-kit` antes de su publicación y entrega un informe en español, completo, verificable y priorizado. Esta tarea autoriza análisis y reproducciones locales aisladas; las correcciones se proponen en el informe, sin aplicarlas al proyecto.

## 1. Contexto y alcance obligatorio

Lee íntegramente `USAGE.md` en la raíz: ese es el nombre real del archivo mencionado como `usage.md`. Úsalo como contrato funcional y contrástalo con la implementación; la documentación no demuestra por sí misma que un control funcione.

El código objeto de auditoría es **todo `src/**` y exclusivamente ese código**, incluidos sus subdirectorios. No te limites a un diff, a funciones exportadas o a búsquedas por palabras clave. Lee cada archivo completo y registra su cobertura.

Puedes leer las instrucciones de trabajo aplicables y `package.json` como contexto operativo para identificar comandos y runtimes. No amplíes la auditoría a `tests/`, `e2e/`, `dist/`, `bin/`, `scripts/`, dependencias, infraestructura, servidores consumidores ni otros documentos del proyecto. Si una conclusión requiere inspeccionarlos, declara la evidencia faltante y el límite de alcance. Consultar referencias técnicas oficiales no amplía el código auditado.

La librería es agnóstica al framework y al transporte. Sus métodos de dominio son `find`, `update`, `create` y `remove`; no son verbos HTTP. `validate` recibe valores que una aplicación ensambla a partir de un endpoint, su sesión y sus recursos. La biblioteca no autentica usuarios, no carga asignaciones desde una base de datos y no ejecuta consultas ni filtra respuestas HTTP.

El proyecto utiliza TypeScript y Bun para desarrollo y pruebas. El manifiesto declara compatibilidad con Node.js `>=20`. Registra las versiones realmente disponibles y no extrapoles un resultado de Bun a todas las versiones de Node.js.

No cambies código fuente, configuraciones, dependencias, lockfiles ni pruebas existentes. No publiques el paquete. Preserva cambios previos del usuario y el estado del índice de Git. Los únicos entregables persistentes autorizados son el informe `SECURITY_AUDIT_REPORT.md` en la raíz y, si son necesarias, reproducciones autocontenidas en `security-audit/pocs/`. Esas reproducciones importan el código de `src`, no el compilado de `dist`.

## 2. Skills globales y reglas incorporadas

Las skills globales no pertenecen al repositorio. En el entorno de preparación se revisaron sus catálogos y archivos bajo `/Users/home/.agents/skills`, `/Users/home/.codex/skills` y `/Users/home/.codex/plugins/cache`. Comprueba su disponibilidad efectiva en tu sesión; encontrar una carpeta en caché no equivale a tener una capacidad habilitada. No instales skills ni servicios para completar esta auditoría.

| Skill | Decisión y motivo |
| --- | --- |
| `full-output-enforcement` | Invócala si está disponible, leyendo `/Users/home/.agents/skills/full-output-enforcement/SKILL.md` o su ubicación vigente. Aplícala a la cobertura completa, al informe y a las reproducciones: sin hallazgos omitidos por cupos, código truncado ni implementaciones pendientes. No es una metodología de seguridad. |
| `pro-architecture` | **No la invoques automáticamente: su invocación queda reservada al usuario.** Sus reglas pertinentes se incorporan abajo para orientar la auditoría y cualquier código propuesto. Fuente consultada al preparar este prompt: `/Users/home/.codex/skills/pro-architecture/SKILL.md`, versión declarada `0.3.0`, y sus referencias de revisión, calidad, semántica, complejidad y comportamiento del agente. |
| `grill-me` | Se utilizó para precisar este encargo. No es necesaria para ejecutar la auditoría con este alcance ya definido. |
| `tdd` | No invocarla en esta auditoría: no se solicita un ciclo de implementación y corrección. Las PoC demuestran comportamientos, sin iniciar una fase de cambios. Considerarla únicamente en una tarea posterior de corrección solicitada por el usuario. |
| `review-agent` | Se encontró instalada, pero no se selecciona: su flujo se centra en defectos introducidos por un cambio. Aquí se requiere revisar todo el estado actual de `src`, incluidos problemas preexistentes. |
| `pentesting-with-aws-security-agent` | No aplica: requiere una aplicación web desplegada y una prueba administrada en AWS. Este encargo es sobre lógica local de una biblioteca. |
| Skills de AWS, navegador, interfaces, diseño y artefactos visuales | No son necesarias para este alcance. No hay que desplegar, abrir una aplicación ni crear una interfaz para realizar la auditoría. |

No se identificó en el catálogo revisado una skill específica de auditoría estática de autorización en bibliotecas TypeScript. No inventes nombres ni sustituyas la inspección de código por herramientas de otro dominio. Si falta una skill auxiliar, indícalo y continúa con las instrucciones autocontenidas de este prompt.

### Reglas pertinentes de `pro-architecture`, sin invocación automática

Estas reglas rigen la evidencia, las recomendaciones y el código de reproducción o corrección que incluyas. No convierten el encargo en una revisión general de estilo, SOLID o rendimiento sin impacto de seguridad.

1. **Alcance y evidencia — AIS-1 a AIS-5, AIS-12 y AIS-13.** Relaciona cada conclusión con un requisito y evidencia real. Explicita cada supuesto, su motivo y qué cambia si es falso. No inventes archivos, llamadas, resultados, mediciones ni garantías. Una comprobación solo cuenta como ejecutada si conservas el comando y su resultado real. Declara las verificaciones pendientes y conserva el trabajo existente.
2. **Revisión antes de cambios.** Delimita, inventaría, lee completamente, establece fronteras de confianza, realiza pasadas especializadas y consolida. La revisión entrega el informe; las correcciones son propuestas y no se aplican durante esta tarea.
3. **Seguridad demostrable.** Traza entrada, validaciones, transformaciones y operación sensible. Prioriza vulnerabilidades explotables frente a riesgos teóricos. Declara categorías no aplicables y asuntos no evaluables; no deduzcas explotación remota a partir de una llamada interna arbitraria.
4. **Capas y contratos — MOD, prohibiciones 1 a 3 y AIS-7.** Conserva los límites observados: registro, validación, resolución, estado, orquestación y CLI. No introduzcas frameworks, acceso a persistencia, dependencias circulares ni patrones nuevos sin necesidad demostrada. Mantén contratos tipados y valida entradas externas en ejecución; los tipos de TypeScript no son una barrera de seguridad.
5. **Simplicidad y reutilización — DUP, NT-5 y AIS-8.** Prefiere cambios pequeños, explícitos y locales. Reutiliza la regla de dominio en su propietario, sin duplicarla ni crear abstracciones anticipadas. No unifiques código parecido si representa conceptos que evolucionan por separado. No extraigas helpers globales sin consumidores reales.
6. **Semántica y convenciones — NT.** Usa nombres concretos de dominio, tipos estables y las convenciones del proyecto. Para nuevos booleanos internos usa `is`, `has` o `can`. Conserva nombres contractuales existentes como `enabled`, `direct`, `result` y `errors`; no los renombres por estilo. Conserva el esquema de exports existente. En código propuesto para la biblioteca, sigue `USAGE.md`: funciones declaradas con `function` a nivel de módulo, sin arrow functions, funciones anidadas ni parámetros con valores por defecto; utiliza `bind` cuando corresponda a los builders.
7. **Errores — ERR y AIS-9.** Respeta el contrato por frontera: configuración y vistas lanzan errores; `validate` devuelve `{ result, errors }`. No ocultes errores ni conviertas denegaciones o fallos inesperados en éxito. Conserva contexto interno útil sin asumir que es seguro exponerlo al cliente.
8. **Complejidad — ALG y AIS-11.** Explica costos temporales y espaciales usando variables concretas. Distingue colecciones pequeñas y acotadas de entradas crecientes controladas por un atacante. No propongas optimizaciones sin necesidad o evidencia. Una caché propuesta debe especificar invalidación, responsable, límites y comportamiento ante fallo; no la añadas como solución automática.
9. **Dependencias y controles — AIS-6 y AIS-10.** Prefiere herramientas ya instaladas, biblioteca estándar y código local mínimo. No debilites autorización ni validaciones para que una prueba pase. No uses secretos ni datos reales en fixtures o registros.
10. **Comentarios — COM y prohibición 4.** Expresa la intención del código generado mediante nombres y funciones pequeñas; explica decisiones en el informe. No añadas comentarios de prosa al código. Se permiten directivas de herramientas, cabeceras de intérprete/licencia, documentación de API procesada por herramientas y marcadores requeridos. Esta regla no autoriza limpiar archivos existentes durante la auditoría.
11. **Veredictos y entrega.** Cuando corresponda a una regla real, identifica su ID y usa `INCUMPLIMIENTO` u `OBSERVACIÓN`; no inventes IDs ni fuerces una regla de estilo para justificar una vulnerabilidad. Separa esos veredictos de la severidad y del nivel de evidencia. Declara pruebas ejecutadas, no ejecutadas, riesgos residuales y correcciones propuestas.

## 3. Modelo de amenazas

Establece este modelo antes de buscar vulnerabilidades:

- **Cliente remoto:** puede controlar los campos que la aplicación derive del body, query o parámetros, principalmente `data` y `select`. No asumas que puede enviar funciones, getters, proxies, símbolos o referencias compartidas mediante JSON ordinario.
- **Identidad autenticada:** según `USAGE.md`, `role` y `permissions` se obtienen de una fuente confiable del servidor. La biblioteca comprueba coherencia y asignaciones; no prueba por sí misma la identidad del usuario.
- **Destino protegido:** la ruta fija `action`, `name` y `method`. Si el cliente puede elegirlos libremente para eludir una política, describe esa precondición como problema de integración.
- **Contexto:** `context` lo construye la aplicación. Diferencia atributos calculados o cargados por el servidor de valores trasladados del cliente, especialmente identidad, pertenencia a tenant, propietario y recurso.
- **Configuración y hooks:** son código del consumidor con capacidad de ejecución dentro del proceso. Distingue errores accidentales de hooks legítimos, valores maliciosos que alcanzan hooks y código ya comprometido. Comprueba si una entrada remota basta para provocar el efecto sin modificar el hook.
- **CLI:** sus argumentos, archivos de configuración, proceso hijo y salida estándar pertenecen a una superficie local/de desarrollo. No supongas que el endpoint puede alcanzarla.

Separa en el informe: vulnerabilidades internas, riesgos de integración, oportunidades de endurecimiento y asuntos no evaluables. Un comportamiento documentado puede tener consecuencias de seguridad: explícalas y determina si existe una violación del contrato o una limitación del modelo. No etiquetes automáticamente todo comportamiento intencional como seguro ni como vulnerabilidad.

No asumas autenticación JWT, una base de datos, un ORM, multitenencia, rate limiting, tamaños máximos de petición o aislamiento entre aplicaciones que `src` no demuestre. No exijas a la biblioteca autenticar usuarios o autorizar recursos individuales fuera de sus garantías declaradas. Evalúa qué información y controles ofrece para que la integración pueda hacerlo correctamente.

## 4. Organización con subagentes

Esta auditoría sí se beneficia de subagentes porque combina análisis independientes sobre una base de código de solo lectura. Usa hasta **tres subagentes y un coordinador**, ajustando la concurrencia a las capacidades disponibles. No delegues esta tarea de manera recursiva ni abras agentes para cada archivo.

Antes de delegar, el coordinador lee `USAGE.md`, inventaría `src`, establece el modelo de amenazas y comparte el mismo contrato, alcance, reglas de evidencia y formato de hallazgos con todos.

| Responsable | Trabajo en paralelo | Archivos principales y resultado esperado |
| --- | --- | --- |
| Subagente 1: autorización e identidad | Comprueba asignaciones, rol, destino, métodos, precedencia directa, grants, aislamiento y concordancia de vistas. Busca escalamiento, suplantación y bypass. | `resolve.ts`, `permissions.ts` y partes pertinentes de `Validators.ts`, `registry.ts`, `seal.ts`, `types.ts`. Entrega invariantes verificadas, rutas de autorización y candidatos con evidencia. |
| Subagente 2: entradas e inyección | Traza todos los campos de `validate`; revisa validación en ejecución, claves y valores especiales, contaminación de prototipos, posibles sumideros y ReDoS. | `Validators.ts`, `validate.ts`, `types.ts`, `constants.ts`, `errors.ts`. Entrega matriz de flujo por campo, aplicabilidad de inyecciones y candidatos reproducibles. |
| Subagente 3: estado, referencias y disponibilidad | Analiza sellado, mutabilidad, aliasing, hooks concurrentes, TOCTOU, contaminación entre peticiones, retención de memoria y agotamiento de recursos. | `state.ts`, `context.ts`, `registry.ts`, `seal.ts`, `validate.ts` y costos de `resolve.ts`. Entrega mapa de referencias y escenarios de concurrencia/DoS con precondiciones. |
| Coordinador | Revisa `index.ts` y `src/cli/**`, mantiene la matriz de cobertura, resuelve contradicciones y reproduce los candidatos de mayor impacto. | Entrega análisis del CLI, verificación cruzada y un único informe consolidado, sin duplicados. |

Los archivos de apoyo pueden leerse por varios agentes; el reparto define quién responde por cada tema. Ningún subagente modifica `src` ni el informe final. Para PoC, usa procesos y directorios independientes por agente y evita compartir un registro global de permisos. Solo el coordinador integra artefactos persistentes.

Si no hay subagentes disponibles, realiza las mismas pasadas secuencialmente y decláralo. La limitación de herramientas no reduce la cobertura exigida.

## 5. Recorrido obligatorio de `validate`

Verifica el recorrido actual desde las exportaciones de `src/index.ts` hasta la respuesta, incluyendo:

`validate` → `getOrCreateState` → `validateRequest` → comprobación de sellado y entrada → `validateIdentity` / `validateAssignments` / `parsePermissionId` → búsqueda de módulo y nombre → `resolveAccess` → acceso directo o concedido → datos/selección → construcción de `ResolvedPermission` → hooks → `{ result, errors }`.

Contrasta esa secuencia orientativa con el código real y documenta bifurcaciones, salidas tempranas, excepciones, cambios de referencia y puntos de espera asíncrona.

Incluye una tabla con **una fila para cada campo**: `action`, `name`, `method`, `role`, `permissions`, `data`, `select` y `context`. En cada fila indica:

- Fuente prevista y quién puede controlarlo según el modelo de amenazas.
- Tipo declarado frente a validación real, incluyendo campo omitido, `undefined`, `null` y tipos incorrectos cuando sean pertinentes.
- Funciones por las que pasa, transformaciones y accesos a propiedades.
- Uso en claves, decisiones de autorización, hooks y resultado o errores.
- Si se copia, comparte, congela superficialmente o conserva referencias anidadas.
- Comportamiento esperado por contrato, comportamiento observado y evidencia correspondiente.

Traza también los valores derivados `permissionId`, `properties`, `authorization.direct`, `authorization.grantedBy`, `result`, `errors`, `fields` y `cause`. Identifica el último control aplicado antes de devolver un resultado utilizable por el consumidor.

## 6. Comprobaciones de seguridad

### A. Autorización, suplantación y aislamiento

Comprueba que el rol por sí solo no autoriza; no hay rol implícito ni privilegios derivados de etiquetas como `all`. Una asignación malformada, de otro rol o desconocida debe denegar la petición completa aunque existan otras válidas. Revisa listas vacías, repetidos, roles no declarados y diferencias de mayúsculas o separadores sin introducir normalizaciones inexistentes.

Verifica que la asignación directa decide completamente: un método ausente o deshabilitado no se reactiva mediante grants. Sin asignación directa, solo participan las concesiones cuyos identificadores habilitantes estén asignados. Revisa unión de campos, aislamiento entre nombres, módulos y roles, autorreferencias, ciclos válidos y ausencia de transitividad: una concesión de un salto no debe convertirse en asignación persistible ni activar un segundo salto.

Comprueba la coherencia de `permissions.named`, `permissions.forUser` y `validate`. `forUser` no ejecuta hooks y su resultado no sustituye la autorización de una petición. Revocación de sesiones, autenticación, propiedad de registros y aislamiento de tenants son responsabilidades externas salvo un control interno concreto que pueda trazarse.

### B. Entradas, propiedades e inyección

Examina claves como `__proto__`, `constructor` y `prototype`, propiedades heredadas, no enumerables y símbolos; objetos con prototipo nulo, arrays dispersos, instancias, accesores, proxies y conversiones a string. Identifica cuáles se pueden construir con JSON y cuáles requieren una integración que fabrique objetos JavaScript especiales. Para contaminación de prototipos demuestra la escritura peligrosa y su efecto: aceptar una clave especial no prueba por sí solo contaminación.

Revisa claves de primer nivel frente a estructuras anidadas, nombres con puntos, operadores como `$set`, propiedades vacías y `'*'`. Determina si se interpretan o solo se comparan/pasan al consumidor. Comprueba mass assignment y escapes de la lista permitida; no supongas validación recursiva ni sanitización de valores si no están en el contrato.

Busca rutas reales hacia ejecución de código, comandos, archivos, generación de declaraciones y deserialización. SQL/NoSQL, HTML, plantillas, cabeceras, SSRF o traversal solo son vulnerabilidades internas si existe un sumidero y una ruta demostrables dentro del alcance. Si dependen de un ORM o handler no inspeccionado, clasifícalas como riesgo de integración o no evaluable. No recomiendes sanitización genérica que cambie el significado de datos legítimos.

Para `find`, comprueba la intersección con campos autorizados, omisión de `select`, selección vacía, comodín y referencias devueltas. Para escritura, comprueba rechazo de todas las claves no permitidas y que `select` no sea aceptado fuera de `find`. El resultado de escritura es el mismo objeto `data` según el contrato; analiza las consecuencias de seguridad de esa identidad de referencia.

### C. Hooks, referencias y condiciones de carrera

Verifica alcance de hooks de módulo, nombre y rol, también cuando el acceso es concedido. Revisa orden de invocación frente a terminación concurrente, ejecución única por registro, manejo de excepciones síncronas y rechazos asíncronos, y denegación si cualquiera falla. El retorno de un hook se ignora según el contrato: comprueba especialmente `false`, `undefined` y errores lanzados.

Analiza `Promise.allSettled`, hooks que nunca terminan y efectos secundarios ocurridos antes de una denegación. Determina si hay garantía de cancelación, transacción o rollback antes de atribuir su ausencia a un defecto.

Traza cambios de `data`, `context`, `select` y referencias anidadas entre validación, hooks y retorno. Busca TOCTOU, mutaciones cruzadas entre hooks y peticiones, campos agregados después de validarse y alteración de decisiones ya calculadas. Separa el escenario con hooks legítimos del que requiere código malicioso con control previo del proceso.

Comprueba la profundidad real de `Object.freeze`, los mapas/sets, las vistas públicas y el estado compartido por `globalThis[Symbol.for('endpoint-permissions-kit')]`. Revisa atomicidad de registros fallidos, errores de `seal`, idempotencia y bloqueo posterior al sellado. No describas una escritura directa a `globalThis` por código arbitrario como ataque remoto sin una ruta que lo habilite.

### D. ReDoS, DoS y memoria

Inventaría expresiones regulares literales o dinámicas y el uso de APIs que puedan evaluarlas. Para un ReDoS identifica patrón, entrada controlable, motor, ruta y crecimiento observado. Si no existe una ruta con regex, registra ReDoS como no aplicable con evidencia; no llames ReDoS a costos de `split`, `includes`, ordenación, unión de campos o iteraciones.

Evalúa por separado complejidad algorítmica y agotamiento de memoria: número y longitud de asignaciones, tamaño de `select` y `data`, campos por permiso, grants por destino, hooks y peticiones concurrentes. Expresa costos con esas variables, identifica quién controla cada tamaño y distingue configuración de arranque de entradas por petición.

Busca retención de referencias de peticiones, crecimiento persistente de estructuras globales, acumulación de promesas, errores o resultados y saturación del event loop. Distingue memoria temporal, estado deliberadamente permanente, consumo elevado y fuga: una subida aislada del heap no demuestra una fuga. No extrapoles fallos de memoria nativa que el código JavaScript no permita fundamentar.

Las pruebas de disponibilidad deben tener tamaños crecientes acotados y timeout impuesto desde un proceso supervisor. Un temporizador dentro del mismo event loop no limita una operación síncrona bloqueante. No ejecutes cargas sin límite ni bloquees el proceso principal del agente. Registra límites, tamaños, repeticiones, duración, memoria si se midió y terminación por timeout.

### E. Errores y exposición de información

Revisa el contrato `{ result, errors }`, denegaciones, errores inesperados, `PkitError`, `HOOK_ERROR` y `VALIDATION_ERROR`. Comprueba si errores aparentes pueden transformarse en éxito, si la clasificación puede suplantarse y cuál sería el impacto real.

Traza mensajes, identificadores, roles, campos rechazados y `cause`: contenido sensible, referencias mutables, valores no serializables y conversiones que ejecuten código. Distingue información devuelta al consumidor de información publicada por un endpoint. No afirmes una fuga remota sin demostrar o declarar la integración que la expone.

### F. CLI dentro de `src`

Revisa íntegramente `src/cli/generate.ts`, `child.ts` y `protocol.ts`: resolución de `config` y `out`, importación de configuración, `execFile`, argumentos, protocolo de stdout con `CATALOG_MARKER`, parseo JSON, límites del proceso hijo, escritura y escape de roles al generar TypeScript.

Diferencia inyección de comandos de ejecución intencional de un archivo de configuración y elección autorizada de una ruta de salida. Examina falsificación del marcador, salida excesiva, bloqueo del hijo y contenido adversarial, indicando el control previo necesario. Cualquier reproducción usa archivos propios en un directorio temporal. No ejecutes configuraciones reales del consumidor ni inspecciones `bin/` para completar esta superficie.

## 7. Evidencia y reproducciones

Para cada candidato formula primero la propiedad de seguridad esperada a partir del contrato. Intenta refutarlo mediante lectura completa de la ruta y un caso de control benigno. No uses como expectativa una copia de la misma implementación que estás evaluando.

Prioriza reproducciones a través de `src/index.ts` y la API pública, con configuración mínima, roles y recursos ficticios. Una reproducción que importe funciones internas debe identificarse como tal y justificar cómo esa función se alcanza desde una entrada pública. No alteres el registro mediante acceso interno para demostrar un supuesto bypass de la API.

Usa procesos independientes para escenarios que necesiten registros diferentes, dado el estado global y `seal`. Conserva comando exacto, runtime/versión, preparación, entrada, resultado esperado, resultado observado y salida relevante. Los scripts deben ser completos y ejecutables, sin placeholders. Prefiere Bun y herramientas instaladas; no ejecutes suites existentes fuera del alcance ni un `bun test` global por comodidad.

Distingue expresamente los niveles de evidencia: **reproducido**, **demostrado por análisis estático** y **no confirmado**. Una PoC no ejecutada se etiqueta como tal. La ausencia de entorno no invalida una ruta demostrada estáticamente, pero limita las afirmaciones sobre su comportamiento observado.

Si ejecutas fuzzing, informa generador, semilla, dominios, número de casos y límites. Si mides rendimiento, muestra datos reales y el método; no inventes umbrales del producto ni porcentajes de mejora. Revalida con el runtime disponible una hipótesis que dependa del motor y declara compatibilidad no probada.

Consulta fuentes primarias oficiales cuando necesites verificar semántica de runtime, APIs o clasificación CWE/OWASP. Cita enlaces y versión/año de las taxonomías utilizadas. No presentes una categoría como aplicable por semejanza nominal ni dependas de referencias para sustituir evidencia del código local.

## 8. Informe y criterio de finalización

Guarda `SECURITY_AUDIT_REPORT.md` en la raíz con esta estructura:

1. **Conclusión para publicación:** bloqueada por hallazgos, sin bloqueantes identificados en el alcance o evaluación inconclusa; justifica la decisión. Una auditoría limitada a `src` no certifica la seguridad del paquete publicado, sus dependencias o sus integraciones.
2. **Alcance y contexto:** fecha, revisión de Git y cambios relevantes si están disponibles, runtimes, archivos revisados, contrato, modelo de amenazas, supuestos y exclusiones. No confundas modificaciones previas del usuario con trabajo de la auditoría.
3. **Mapa de capas y flujo:** árbol completo de `src` con responsabilidad por archivo, recorrido de `validate`, tabla de sus ocho campos y mapa de referencias relevantes. Puede incluir un diagrama Mermaid si aclara los cruces de confianza y puntos asíncronos.
4. **Hallazgos internos priorizados:** todos los hallazgos sustentados, sin cupo artificial y sin duplicar la misma causa por cada payload o subagente.
5. **Riesgos de integración y endurecimiento:** separados de los defectos internos, con responsables y precondiciones explícitas.
6. **Verificación:** PoC, controles benignos, comandos/resultados, mediciones y verificaciones no ejecutadas con motivo. Incluye rutas a los artefactos creados.
7. **Cobertura y límites:** matriz archivo × comprobaciones aplicables, resultado, evidencia y faltantes; lista de categorías no aplicables y asuntos no evaluables. Usa «sin hallazgos en esta revisión», no «demostrado seguro».
8. **Acciones recomendadas:** correcciones prioritarias, cambios contractuales que exigirían decisión del usuario, pruebas de regresión propuestas y riesgos residuales. Las correcciones permanecen sin aplicar.

Cada hallazgo debe incluir:

- ID estable, título y categoría: interno, integración o endurecimiento.
- Severidad `Critical`, `High`, `Medium` o `Low`, razonada por impacto, privilegios, accesibilidad y precondiciones. No asignes severidad automáticamente solo por el nombre del ataque; deja sin determinar lo que no tenga evidencia suficiente.
- Nivel de evidencia y, cuando aplique a las reglas incorporadas, veredicto `INCUMPLIMIENTO` u `OBSERVACIÓN` con ID de regla real.
- Ubicación precisa `src/archivo.ts:línea`, función y fragmento real mínimo; añade ubicaciones relacionadas cuando la causa cruza capas.
- Invariante vulnerada, actor y datos que controla, frontera de confianza, ruta entrada → transformaciones → operación sensible → impacto.
- Escenario mínimo, control benigno y PoC con resultado esperado/observado, o explicación completa de la evidencia estática y de lo que falta ejecutar.
- Impacto práctico, limitaciones y CWE/OWASP solo cuando puedan justificarse.
- Corrección mínima propuesta y, cuando sea viable dentro del alcance, código completo del bloque o función afectada. Etiqueta ese código como propuesta no aplicada y no probada si corresponde. Explica compatibilidad y prueba de regresión que impediría la reaparición del fallo.

El coordinador contrasta los hallazgos de los subagentes, elimina falsos positivos y resuelve desacuerdos antes de escribir la conclusión. No des por terminado el trabajo tras la primera vulnerabilidad ni declares cobertura completa si falta leer algún archivo de `src`.

Al finalizar, enlaza el informe y resume los hallazgos por severidad, los bloqueantes de publicación, las comprobaciones realmente ejecutadas y los límites materiales. Declara explícitamente si no encontraste vulnerabilidades con la evidencia disponible. No apliques correcciones ni publiques la librería como parte de este encargo.
