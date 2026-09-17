# Contributing

Thanks for taking the time to contribute to Endpoint Permissions Kit.

## Requirements

- [Bun](https://bun.sh) 1.x. It runs the development scripts, the tests and the build. The published package runs on Node 20 or newer, but development tooling is Bun-only.
- Git.

## Setup

```sh
git clone https://github.com/yellyoshua/endpoint-permissions-kit.git
cd endpoint-permissions-kit
bun install
```

## Commands

| Command | What it does |
| --- | --- |
| `bun run typecheck` | Type-checks the sources and the isolated fixture in `tests/typecheck/` |
| `bun test` | Runs every `tests/*.test.ts` file, including the architecture and typecheck tests |
| `bun run build` | Produces `dist/esm`, `dist/cjs` and `dist/types` |
| `bun run clean` | Removes `dist` |

Run `bun run typecheck` and `bun test` before opening a pull request.

## Conventions

- File names use dash-case (`usage-example.test.ts`, `audit-fixes.test.ts`).
- Functions are declared with `function` at module scope. `tests/architecture.test.ts` rejects arrow functions, function expressions, nested functions and parameter defaults or destructuring in `src/`.
- No prose comments in code. Only functional directives (`@ts-expect-error`, the executable shebang) are allowed. Explain behavior in `USAGE.md` or the README instead.
- Tests live in `tests/*.test.ts`. Type contracts (what must and must not compile) live in `tests/typecheck/`.
- Every behavior change requires a test that fails without the change.
- No new dependencies without a written justification in the pull request describing why the standard library or existing code cannot cover the need.
- Public names exported from `src/index.ts` and `src/types.ts` are part of the API; renaming them is a breaking change and needs a changelog entry.

## Pull requests

1. Create a branch from `main`.
2. Make the change with its test.
3. Update `USAGE.md`, `README.md` and `CHANGELOG.md` when the public behavior changes.
4. Open the pull request against `main` with a short description of the problem and the change.

## Reporting bugs

Open an issue at https://github.com/yellyoshua/endpoint-permissions-kit/issues with a minimal reproduction. For security vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
