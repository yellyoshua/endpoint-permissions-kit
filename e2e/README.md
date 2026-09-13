# e2e — four simulated consumers of endpoint-permissions-kit

`e2e/` integrates the permission library into four applications of increasing size, each with an Express backend, React screens and an integration test suite against real HTTP. It proves the library configuration survives real modules, submodules, roles, grants, hooks and screens, using only the public API and the compiled `dist/`.

| Project | Domain | Modules | Roles | Assignable ids | Screens |
| --- | --- | --- | --- | --- | --- |
| small | team notebook | 3 flat modules (`notes`, `tags`, `profile`) | 3 (`public` anonymous) | 7 | 4 |
| medium | marketing | `marketing.portals`, `marketing.dashboard`, `campaigns.assets` | 4 | 10 | 5 |
| large | light ERP | 6 modules in 4 domains, 3 levels deep | 6 | 19 | 9 |
| extra-large | multi-area platform | 8 modules in 6 domains, 4 levels deep | 8 (`public` anonymous) | 30 | 12 |

Simulated user ids per project are listed in `docs/project-*.md`; the header selector in the client offers them.

## Requirements

- `bun` (tested with 1.4.0).
- The library built once in the repository root (`bun run build:library` does it from here).

## Install and run

```sh
cd e2e
bun run build:library
bun install
bunx pkit generate
bun run test
bun run dev
```

`bun run dev` starts the API on http://localhost:3001 and the client on http://localhost:5173. Open `/` and pick a project; the header has a "Simulated user" selector. The selected id is sent as the `x-user-id` header; "anonymous" sends no header (available only in small and extra-large). Navigation and buttons come from `GET /api/<project>/me`.

## Where things are

- Specification per project (domain, users, module tree, permission matrix, routes, screens, scenarios): `docs/project-small.md`, `docs/project-medium.md`, `docs/project-large.md`, `docs/project-extra-large.md`.
- Layers, identity and error contract, coverage matrix: `docs/architecture.md`.
- Agent instructions: `CLAUDE.md`.
