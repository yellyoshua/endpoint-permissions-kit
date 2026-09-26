# Simplificar USAGE.md

## Objetivo

Reescribe únicamente `USAGE.md` como una guía breve de utilización para lectores técnicos. Conserva la base de los ejemplos actuales y sus rutas; elimina explicaciones redundantes e internas. No cambies la biblioteca ni su comportamiento.

## Contexto relevante

- Verificado en `README.md`, `CONTRIBUTING.md`, `CLAUDE.md` y `package.json`: biblioteca TypeScript independiente de frameworks, con instancia explícita de `Pkit`, salidas ESM/CJS, Node >=20 y Bun para desarrollo y pruebas.
- `USAGE.md` utiliza `marketing.portals`, `marketing.dashboard`, los roles `admin`, `staff`, `public` y los nombres `all`, `update-only`. Conserva ese vocabulario y las rutas `pkit.ts`, `permissions.ts`, `modules/marketing/portals/permissions.js`, `modules/marketing/dashboard/permissions.js` y `app.js`.
- `src/pkit.ts`, `src/types.ts` y `src/validate.ts` establecen que `.validate()` devuelve una promesa de `{ result, errors }`; en caso satisfactorio los datos están en `result.data`. `tests/usage-example.test.ts` contiene la configuración y comprobaciones del ejemplo actual.
- Supuesto editorial: mantener el inglés del documento y entender «un par de ejemplos» como dos ejemplos principales —registro y utilización—, aunque el registro necesite bloques separados por archivo.

## Instrucciones de ejecución

1. Lee completo `USAGE.md` y revisa las referencias anteriores antes de editar. Respeta las instrucciones `AGENTS.md` proporcionadas o presentes y los cambios pendientes. Actualmente no hay `.codegraph/`; si existe al ejecutar esta tarea, consulta CodeGraph antes de localizar o leer código.
2. Condensa los ejemplos existentes en los dos ejemplos principales. Mantén la instancia compartida, los imports y los registros necesarios para que las llamadas mostradas funcionen. Conserva un uso representativo de `grantTo` si forma parte del ejemplo retenido; elimina variantes duplicadas. No introduzcas dominios ajenos, roles nuevos ni operaciones sin registrar.
3. Muestra directamente los valores enviados a `.validate()`, su resolución con `await` y el acceso a los datos mediante `const { result } = await pkit.validate(...)` y `if (result) { console.log(result.data); }`. Sustituye los puntos suspensivos por los argumentos completos del ejemplo. No presentes la promesa como los datos ni uses aserciones de TypeScript para omitir la comprobación.
4. Reduce la prosa a una frase breve cuando el ejemplo no baste. Usa placeholders claramente identificados solo para valores aportados por la aplicación; conserva completos los registros e imports. Enumera alternativas con comentarios como `method: 'find', // find, update, create, remove`, sin enums ni variantes de tipos. Estos comentarios solicitados por el usuario prevalecen sobre la convención general de evitar comentarios explicativos.
5. Elimina teoría del modelo, definiciones conceptuales, scopes, tablas de errores, escenarios fallidos, flujos de validación, algoritmos, precedencias, detalles de implementación y variantes de TypeScript. Elimina o simplifica los hooks que introduzcan demostraciones de errores. Conserva el registro de permisos necesario para usar la API. No traslades lo eliminado a otros documentos.
6. Mantén ejemplos válidos y coherentes: permisos existentes, campos permitidos y roles coincidentes. Los valores de identidad de una integración proceden de la sesión o de una fuente confiable; no los obtengas del cuerpo de la petición. Conserva el ancla `registration-and-startup`, enlazada desde `README.md`.
7. Aplica las pautas pertinentes consultadas de `pro-architecture`: ejemplos directos, nombres del dominio, patrones existentes, ninguna abstracción o dependencia innecesaria, preservación del trabajo ajeno y comprobaciones declaradas con honestidad. No invoques esa skill: su activación corresponde exclusivamente al usuario. No agregues funciones vacías ni APIs ficticias para abreviar.
8. Revisa el diff y verifica los ejemplos contra la API y `tests/usage-example.test.ts`; ejecuta `bun test tests/usage-example.test.ts`. Esa prueba respalda el escenario existente, pero no ejecuta automáticamente los bloques Markdown: comprueba también los fragmentos editados. Informa qué verificaste y cualquier limitación, sin modificar pruebas para acomodar la redacción.

La edición es de un único documento y requiere coherencia global: realiza el trabajo sin subagentes. No requiere skills adicionales ni recursos de diseño; `copywriting` está orientada a texto comercial y no corresponde a esta guía técnica.

## Criterios de aceptación

- Solo cambia `USAGE.md`, con una reducción clara de prosa y redundancias.
- Dos ejemplos principales breves, consistentes entre sí, con las rutas existentes y sin escenarios fallidos.
- Se ve qué valores enviar, cómo esperar `.validate()` y cómo acceder a `result.data`.
- No quedan explicaciones internas, scopes, catálogos de errores ni variantes de TypeScript.
- Los fragmentos y enlaces conservados son coherentes; la entrega resume la edición y las verificaciones realmente realizadas.
