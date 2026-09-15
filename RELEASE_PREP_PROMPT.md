# Prompt: preparar `endpoint-permissions-kit` para publicación en npm

## Objetivo

Dejar el repositorio listo para un primer `npm publish` público bajo el nombre `endpoint-permissions-kit`, autor `yellyoshua`. Sin publicar. Sin CI/CD. Sin commits.

El resultado esperado: raíz limpia, `package.json` publicable, documentación pública en inglés, `src/` y `tests/` con nombres de archivo en `dash-case`, `CLAUDE.md` reducido a lo que un agente necesita, y todas las verificaciones ejecutadas con resultado real.

## Contexto del proyecto (verificado antes de redactar este prompt)

- Librería TypeScript de autorización por endpoint, agnóstica de framework. Registro en memoria, roles tipados, hooks de validación, `seal()` cierra el registro. CLI `pkit generate` genera tipos de roles desde `pkit.config.*`.
- Runtime de desarrollo: Bun. Salida compilada: ESM + CJS + `.d.ts` en `dist/` (ignorado en git), consumible desde Node >=20.
- `package.json` actual: `"private": true`, `description` en español, sin `license`, sin `author`, sin `repository`, sin `keywords`. `exports` expone `.`, `./types`, `./package.json`. `bin.pkit` apunta a `bin/pkit.mjs`, que importa `dist/esm/cli/generate.js`. `files: ["dist", "bin"]`.
- Scripts: `build` (`scripts/build.ts`, usa `Bun.build` + `tsc -p tsconfig.build.json`), `clean`, `test` (`bun test`), `typecheck` (`tsc --noEmit && tsc --noEmit -p tests/typecheck`).
- `src/`: `cli/child.ts`, `cli/generate.ts`, `cli/protocol.ts`, `constants.ts`, `context.ts`, `errors.ts`, `index.ts`, `permissions.ts`, `registry.ts`, `resolve.ts`, `seal.ts`, `state.ts`, `types.ts`, `validate.ts`, `Validators.ts`.
  - Único archivo fuera de `dash-case`: `src/Validators.ts`. Lo importan `src/context.ts`, `src/permissions.ts`, `src/validate.ts`, `src/seal.ts`, `src/registry.ts`, `src/cli/generate.ts`. También lo mencionan `README.md` y `USAGE.md`.
- `tests/`: `architecture.test.ts`, `audit-fixes.test.ts`, `generate.test.ts`, `helpers.ts`, `permissions.test.ts`, `pkit.generated.d.ts`, `registry.test.ts`, `typecheck.test.ts`, `validate.test.ts`, `typecheck/pkit.generated.d.ts`, `typecheck/roles.ts`, `typecheck/tsconfig.json`. Ya cumplen `dash-case`. `pkit.generated.d.ts` es salida generada por el CLI: su nombre es contrato del generador, no se renombra.
- Raíz actual: `README.md` (español, describe la librería como "privada"), `USAGE.md` (español, ~20 KB, guía completa de uso), `CLAUDE.md` (plantilla genérica de Bun, sin nada específico del proyecto), `E2E_PROMPT.md`, `SECURITY_AUDIT_PROMPT.md`, `docs/architecture.md`, `docs/refactor-report.md`, `bin/`, `scripts/`, `tests/`, `tsconfig.json`, `tsconfig.build.json`, `.gitignore`, `bun.lock`.
- `e2e/` ya está eliminado en el working tree (aparece como `D` en `git status`, sin commit). No hay que recrearlo.
- `tsconfig.json` mapea `endpoint-permissions-kit` y `endpoint-permissions-kit/types` a `src/`. `include` cubre `src`, `tests/*.ts`, `tests/*.d.ts`, `scripts`.
- Convención de exports observada en `src/index.ts`: exports nombrados para cada pieza pública más `export default pkit` (objeto congelado). Esa convención del proyecto prevalece sobre cualquier regla genérica.

## Decisiones ya tomadas (no volver a preguntar)

| Tema | Decisión |
| --- | --- |
| Nombre npm | `endpoint-permissions-kit` |
| Autor | `yellyoshua` |
| Licencia | Apache-2.0 (archivo `LICENSE` + campo `license`) |
| Repositorio | `https://github.com/yellyoshua/endpoint-permissions-kit` (`repository`, `bugs`, `homepage`) |
| Versión | Se mantiene `0.1.0` |
| Idioma de docs públicas | Inglés |
| `README.md` | Se reescribe completo en inglés. No se borra. |
| `USAGE.md` | Se conserva y se traduce a inglés. Contenido íntegro, sin resumir. |
| `docs/` | Se elimina completa. Lo útil de `docs/architecture.md` (mapa de archivos, contrato de errores) pasa al README o a `USAGE.md` antes de borrar. |
| `E2E_PROMPT.md`, `SECURITY_AUDIT_PROMPT.md` | Se eliminan. |
| Este archivo (`RELEASE_PREP_PROMPT.md`) | Se conserva. No borrar. |
| Archivos `.md` nuevos en raíz | `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` |
| Publicación | No ejecutar `npm publish` ni `bun publish`. |
| CI/CD | No crear workflows ni pipelines. |
| Git | No hacer commits. Dejar cambios en el working tree (stage permitido). |

## Restricciones absolutas

1. No publicar. No crear `.github/workflows` ni equivalentes.
2. No hacer `git commit`. `git rm` / `git mv` permitidos para que el diff sea legible.
3. No cambiar comportamiento en runtime de `src/`. Solo renombres de archivo y actualización de imports.
4. No añadir dependencias.
5. No borrar `README.md`, `USAGE.md`, `LICENSE` (una vez creado) ni `RELEASE_PREP_PROMPT.md`.
6. No inventar rutas, APIs ni resultados de comandos. Cada afirmación de "verificado" va con el comando y su salida real.
7. No dejar marcadores `TODO`, secciones vacías ni texto tipo "add description here" en ningún `.md`.

## Skills

### Skill obligatoria (la invoca el usuario, no el agente): `pro-architecture`

No la invoques. Aplica sus reglas tal como se resumen aquí:

**Comentarios (COM-1, COM-4, COM-5).** Prohibido escribir comentarios en prosa en código. Permitidos únicamente: pragmas de herramientas (`// @ts-expect-error`), shebang, cabeceras de licencia (`// SPDX-License-Identifier: Apache-2.0`), bloques JSDoc/TSDoc, banners de archivo generado. Al tocar un archivo, elimina comentarios no permitidos que ya tuviera. El "por qué" va en el reporte de entrega, no en el código.

**Nombres (NT-3, NT-4).** Una convención observada de forma consistente en el proyecto prevalece sobre la genérica. Aquí: archivos en `dash-case`, identificadores `camelCase`, tipos `PascalCase`, constantes `CONSTANT_CASE`. Un nombre describe exactamente lo que hace.

**Exports (NT-6).** El proyecto ya fija su convención en `src/index.ts` (nombrados + default del objeto `pkit`). No la cambies.

**Prohibición dura 3.** No introducir patrones arquitectónicos nuevos. Este trabajo es de empaquetado y documentación; no hay motivo para ninguno.

**Reglas AIS (comportamiento del agente), prohibiciones absolutas:**
- Inventar archivos, rutas, APIs, resultados de tests o métricas (AIS-3).
- Declarar una verificación como ejecutada o exitosa sin haberla corrido o con resultado distinto (AIS-12).
- Entregar placeholders, stubs o secciones vacías cuando se pidió contenido completo (AIS-13).
- Ocultar fallos tras fallbacks silenciosos (AIS-9).
- Ampliar el alcance sin autorización (AIS-4). Si detectas un problema fuera de alcance, repórtalo en "Proposed, not applied".
- Reportar un find/replace mecánico como refactor (AIS-13).

**Supuestos (AIS-2).** Cada supuesto se declara con el formato `qué / por qué / impacto si es incorrecto`. Nunca se infiere silenciosamente.

**Reporte de entrega (AIS-14).** La entrega final termina obligatoriamente con este bloque, todas las secciones, escribiendo `none` donde no aplique:

```txt
Requirements covered:       <requisito → archivos>; cambios incidentales con motivo
Assumptions:                <qué / por qué / impacto si es incorrecto>, o "none"
Scope:                      pedido vs cambiado; lista "Proposed, not applied"
Files changed:              modificados / creados / eliminados, uno por línea
Dependencies:               añadidas o cambiadas; o "none"
Patterns followed:          archivo o convención usada como referencia; desviaciones
Simplicity decisions:       abstracciones añadidas; generalizaciones no hechas
Fallbacks and error paths:  o "none"
Security-relevant changes:  o "none"
Performance:                "not measured"
Validations executed:       <comando> → <resultado real>, uno por línea
Validations not executed:   <qué> → <por qué> → <comando para el usuario>
Result:                     resultado observable
Completeness:               "complete" o huecos explícitos
Residual risks:             qué podría seguir mal y cómo se notaría
Decisions needing approval: lo que el usuario debe confirmar
```

### Skills globales disponibles en este entorno que sí debes invocar

Invoca cada una con la herramienta `Skill` en el momento indicado. Verifica que exista en el listado de skills de la sesión antes de invocarla; si no existe, dilo en el reporte y sigue sin ella.

| Skill | Cuándo | Para qué |
| --- | --- | --- |
| `full-output-enforcement` | Antes de escribir `README.md` y antes de traducir `USAGE.md` | Garantiza traducción y redacción íntegras, sin "..." ni secciones resumidas. |
| `caveman:safe-refactor` | Antes de renombrar `src/Validators.ts` | Renombre preservando comportamiento, con verificación de regresión. |
| `caveman:verify-and-stop` | Fase final | Comprobar criterios de aceptación sin ampliar el trabajo. |
| `ponytail:ponytail` | Ya activo en sesión (modo full). No reinvocar. | Solución mínima; no añadir tooling ni abstracciones. |

Skills revisadas y descartadas por no aplicar: `tdd` (no hay lógica nueva), `code-review`/`security-review` (ya se hizo auditoría en commit `777cc30`), `init` (CLAUDE.md se redacta a mano con criterio de este prompt), `caveman:migration` (no hay migración de contrato), `modern-web-guidance` (no hay frontend), skills de AWS/video/diseño.

## Plan de trabajo con sub-agentes

Ejecuta las fases en orden. Dentro de cada fase, lanza los sub-agentes listados **en paralelo, en un solo mensaje**. Cada sub-agente recibe: este prompt completo, su fase, y la instrucción de no tocar archivos fuera de su lista. El agente principal integra, resuelve conflictos y ejecuta las verificaciones.

### Fase 0 — Lectura (agente principal, sin sub-agentes)

1. Lee completos: `package.json`, `src/index.ts`, `src/types.ts`, `README.md`, `USAGE.md`, `docs/architecture.md`, `CLAUDE.md`, `scripts/build.ts`, `bin/pkit.mjs`, `tsconfig.json`, `tsconfig.build.json`, `.gitignore`.
2. Ejecuta y guarda la salida como línea base:
   ```sh
   bun install
   bun run typecheck
   bun test
   bun run build
   ```
   Si algo falla en línea base, detente y repórtalo. No arregles código de la librería.
3. Extrae de `docs/architecture.md` lo que no está ya en `USAGE.md`: mapa de archivos, contrato de errores, límites (sin adaptadores de framework, sin DB, sin descubrimiento de rutas). Guárdalo en tu contexto para la Fase 1.

### Fase 1 — Tres sub-agentes en paralelo

**Sub-agente A: limpieza y `package.json`.** Archivos: `package.json`, `docs/`, `E2E_PROMPT.md`, `SECURITY_AUDIT_PROMPT.md`, `.gitignore`, `LICENSE`.
- `git rm -r docs E2E_PROMPT.md SECURITY_AUDIT_PROMPT.md`. Confirma que `e2e/` sigue borrado; no lo restaures.
- Crea `LICENSE` con el texto completo de Apache-2.0, `Copyright 2026 yellyoshua`.
- `package.json`: eliminar `private`; `description` en inglés (una frase: framework-agnostic endpoint permissions with in-memory registry, typed roles and validation hooks); añadir `license: "Apache-2.0"`, `author: "yellyoshua"`, `repository` (`{ type: git, url: git+https://github.com/yellyoshua/endpoint-permissions-kit.git }`), `bugs`, `homepage`, `keywords` (permissions, authorization, rbac, endpoint, typescript, bun, framework-agnostic), `sideEffects: false`, `publishConfig: { access: "public" }`. Añadir script `prepublishOnly: "bun run typecheck && bun test && bun run build"`. Mantener `version`, `exports`, `bin`, `files`, `engines`, `type` intactos.
- Verifica contenido del tarball sin publicar:
  ```sh
  bun run build && npm pack --dry-run
  ```
  Debe incluir `dist/`, `bin/`, `package.json`, `README.md`, `LICENSE`. No debe incluir `tests/`, `scripts/`, `src/`, `*.map` innecesarios ni los `.md` de raíz distintos de README/LICENSE (si `npm pack` incluye `CHANGELOG.md` u otros por defecto, es aceptable; repórtalo).
- `.gitignore`: sin cambios salvo que falte algo evidente. No añadir reglas especulativas.

**Sub-agente B: documentación pública.** Archivos: `README.md`, `USAGE.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`.
- Invoca `full-output-enforcement` primero.
- `README.md` (inglés, reescrito desde cero, tomando como fuente de verdad `src/index.ts`, `src/types.ts` y `USAGE.md`). Secciones, en este orden: título + una frase; badges (npm version, license) apuntando a `endpoint-permissions-kit`; Features (lista corta, solo lo real); Install (`bun add` y `npm install`); Quick start (ejemplo mínimo con `pkit.module().registerActions()`, `pkit.seal()`, `pkit.validate()`; debe compilar contra la API real); Concepts (rol `general` como respaldo, herencia por método, `[role]::[module]::[name]`, definición vs asignación vs concesión); Error contract (`validate()` devuelve `{ result, errors }`, códigos `NOT_SEALED`, `INVALID_INPUT`, `VALIDATION_ERROR`, la app traduce a HTTP); CLI (`pkit generate`, `pkit generate --check`, config `.js/.mjs/.cjs` en Node 20); ESM/CJS usage; Project layout (tabla archivo → responsabilidad, con `validators.ts` ya renombrado); Development (`bun install`, `bun run typecheck`, `bun test`, `bun run build`); link a `USAGE.md`, `CONTRIBUTING.md`, `SECURITY.md`; License (Apache-2.0). Sin secciones vacías. Sin decir que la librería es privada.
- `USAGE.md`: traducción íntegra a inglés, misma estructura, mismos ejemplos. Sustituir referencias a `Validators.ts` por `validators.ts` y a `docs/architecture.md` por la sección de layout del README. Incorporar el contrato de errores y límites extraídos de `docs/architecture.md` si no estaban ya.
- `CHANGELOG.md`: formato Keep a Changelog, encabezado `## [0.1.0] - 2026-09-15`, con lo que realmente contiene la primera versión (registro, roles, hooks, CLI, ESM/CJS). Sin `Unreleased` vacío.
- `CONTRIBUTING.md`: requisitos (Bun), setup, comandos, convención de nombres de archivo `dash-case`, dónde van los tests, que los cambios de comportamiento requieren test. Corto.
- `SECURITY.md`: versiones soportadas (0.1.x), cómo reportar en privado (GitHub Security Advisories del repo), tiempo de respuesta orientativo. Sin inventar correo.
- `CODE_OF_CONDUCT.md`: Contributor Covenant 2.1 con contacto vía issues del repositorio.

**Sub-agente C: estandarización de `src/` y `tests/`.** Archivos: `src/**`, `tests/**`, `tsconfig.json`, `tsconfig.build.json`, `scripts/build.ts`.
- Invoca `caveman:safe-refactor` primero.
- `git mv src/Validators.ts src/validators.ts`. Actualiza los seis imports listados en Contexto. En macOS el filesystem es case-insensitive: usa `git mv` en dos pasos si hace falta (`Validators.ts` → `validators.tmp.ts` → `validators.ts`) y confirma con `git status` que el rename quedó registrado.
- Recorre `src/` y `tests/` comprobando: todos los archivos en `dash-case` (`pkit.generated.d.ts` se acepta por ser salida del generador; documenta la excepción en el reporte), un módulo por responsabilidad, sin archivos vacíos ni exports muertos. No renombres identificadores internos ni reorganices carpetas: solo nombres de archivo.
- Elimina comentarios en prosa de los archivos que toques (COM-4). No toques archivos que no necesiten cambios.
- Verifica: `bun run typecheck && bun test && bun run build`. Adjunta salida real.

### Fase 2 — Integración (agente principal)

1. Revisa el diff completo de los tres sub-agentes. Resuelve cualquier referencia cruzada (README menciona `validators.ts`; `package.json` y README coinciden en nombre, versión, licencia, URL).
2. Reescribe `CLAUDE.md`. Contenido máximo ~40 líneas, sin explicar lo obvio, sin la plantilla genérica de Bun actual (no hay frontend, no hay SQLite, no hay Redis). Incluir solo:
   - Qué es la librería en una línea.
   - Runtime: Bun para desarrollo; `dist/` debe funcionar en Node >=20 sin APIs de Bun en el núcleo.
   - Comandos: `bun install`, `bun run typecheck`, `bun test`, `bun run build`.
   - Layout: `src/` (módulos por responsabilidad, `cli/` para el generador), `tests/` (`*.test.ts`, `typecheck/` para contratos de tipos), `bin/`, `scripts/`.
   - Convenciones: archivos `dash-case`; exports nombrados + default `pkit` en `src/index.ts`; sin comentarios en prosa; sin dependencias nuevas sin justificación; cambios de comportamiento requieren test.
   - Contrato de errores en una línea (`validate()` nunca lanza; devuelve `{ result, errors }`).
   - Qué no hacer: no publicar, no tocar `pkit.generated.d.ts` a mano, no añadir adaptadores de framework.
3. Ejecuta la verificación final completa:
   ```sh
   bun install
   bun run typecheck
   bun test
   bun run build
   npm pack --dry-run
   git status --short
   ls
   ```
4. Invoca `caveman:verify-and-stop` y contrasta contra los criterios de aceptación.

## Criterios de aceptación

- [ ] `package.json`: sin `private`, `name` = `endpoint-permissions-kit`, `license` = `Apache-2.0`, `author` = `yellyoshua`, `repository`/`bugs`/`homepage` presentes, `publishConfig.access` = `public`, `prepublishOnly` presente.
- [ ] `npm pack --dry-run` lista `dist/`, `bin/`, `README.md`, `LICENSE`, `package.json` y no lista `src/`, `tests/`, `scripts/`.
- [ ] Raíz contiene exactamente: `README.md`, `USAGE.md`, `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CLAUDE.md`, `RELEASE_PREP_PROMPT.md`, `package.json`, `bun.lock`, `tsconfig.json`, `tsconfig.build.json`, `.gitignore`, `bin/`, `scripts/`, `src/`, `tests/` (más `dist/`, `node_modules/`, `.git/` ignorados).
- [ ] No existen `docs/`, `e2e/`, `E2E_PROMPT.md`, `SECURITY_AUDIT_PROMPT.md`.
- [ ] `src/` y `tests/` sin archivos fuera de `dash-case` salvo `pkit.generated.d.ts`.
- [ ] `README.md`, `USAGE.md` y demás `.md` públicos en inglés, sin secciones vacías ni placeholders. El ejemplo de Quick start compila contra la API real.
- [ ] `CLAUDE.md` ≤ ~40 líneas, sin plantilla genérica.
- [ ] `bun run typecheck`, `bun test`, `bun run build` pasan, con salida adjunta.
- [ ] Ningún commit nuevo (`git log -1` muestra `777cc30`).
- [ ] Reporte de entrega AIS-14 completo al final.
