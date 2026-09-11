# Endpoint Permissions Kit

Librería privada de autorización para endpoints, independiente del framework. Registra permisos en memoria, resuelve roles y campos permitidos, y ejecuta hooks de validación. Distribuye ESM, CommonJS y declaraciones TypeScript.

```ts
import pkit from 'endpoint-permissions-kit';

pkit.module('portals').registerActions({
  find: { enabled: true, properties: ['id', 'name'] },
});
pkit.seal();

const validation = await pkit.validate({ action: 'portals', method: 'find' });
```

Sin rol explícito se usa `general`. Un rol declarado hereda de `general` los métodos que no define; un método explícitamente deshabilitado permanece denegado. Los roles desconocidos nunca reciben ese respaldo.

`validate()` devuelve `{ result, errors }`. Los fallos de sus fases, incluidos `NOT_SEALED` e `INVALID_INPUT`, llegan en `errors`; los hooks conservan la causa original. Los errores inesperados incluyen `VALIDATION_ERROR` y `cause`. La aplicación decide cómo traducirlos a HTTP y qué información registrar. Las escrituras requieren `data`; los hooks reciben `undefined` cuando se omiten datos opcionales o contexto.

## Organización

| Ubicación | Responsabilidad |
| --- | --- |
| `src/index.ts`, `src/types.ts` | API pública y contratos |
| `src/context.ts`, `src/registry.ts` | Catálogo de roles y registro de permisos/hooks |
| `src/state.ts`, `src/constants.ts`, `src/errors.ts` | Estado compartido, constantes y excepciones |
| `src/resolve.ts`, `src/seal.ts`, `src/permissions.ts` | Resolución por rol y vistas de permisos |
| `src/Validators.ts` | Validaciones compartidas de datos, configuración y autorización |
| `src/validate.ts` | Ejecución de validaciones/hooks y formato de errores |
| `src/cli/`, `bin/pkit.mjs` | Generador de tipos de roles |
| `scripts/build.ts` | Compilación ESM/CJS y declaraciones |
| `tests/`, `tests/typecheck/` | Pruebas funcionales, CLI y contratos de tipos |
| `docs/architecture.md` | Mapa completo, decisiones y límites |
| `dist/` | Archivos generados por la compilación |

## Desarrollo

```sh
bun install
bun run typecheck
bun test
bun run build
```

Bun se usa para desarrollo, compilación y pruebas. El paquete compilado usa JavaScript estándar en el núcleo y APIs de Node en el CLI; `package.json` declara Node >=20. Los archivos `.ts` de configuración del CLI necesitan soporte de TypeScript en el runtime: para Node 20 usa un config `.js`, `.mjs` o `.cjs`.

## Consumo

```js
import pkit from 'endpoint-permissions-kit';
```

```js
const { pkit } = require('endpoint-permissions-kit');
```

Para ampliar los roles reconocidos por TypeScript, declara el catálogo en `pkit.config.js` y ejecuta el binario instalado:

```sh
pkit generate
pkit generate --check
```

Consulta [USAGE.md](USAGE.md) para registrar roles, permisos y hooks; [el mapa de arquitectura](docs/architecture.md) describe cada archivo y el contrato de errores.
