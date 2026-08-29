# Endpoint Permissions Kit

Librería y framework privado para la gestión de permisos en endpoints. Configurado para desarrollo y compilación de TypeScript a JavaScript con soporte híbrido para **ESM (ECMAScript Modules)**, **CommonJS (CJS)**, **IIFE (Browser)** y definiciones de tipos TypeScript (`.d.ts`).

---

## 📁 Estructura del Proyecto

```text
endpoint-permissions-kit/
├── src/                    # Código fuente de la librería
│   ├── index.ts            # Entrypoint principal (exports)
│   ├── permissions/        # Módulo gestor de permisos
│   ├── types/              # Definición de interfaces y tipos
│   └── utils/              # Funciones auxiliares
├── tests/                  # Suite de pruebas unitarias (Bun Test)
│   ├── permission.test.ts  # Pruebas del código fuente
│   └── build-imports.test.ts # Pruebas de compatibilidad ESM y CommonJS
├── scripts/
│   └── build.ts            # Script de compilación multibundle con Bun
├── dist/                   # Artefactos compilados (generado en build)
│   ├── esm/                # Salida para import (ES Module)
│   ├── cjs/                # Salida para require (CommonJS)
│   ├── iife/               # Bundle autónomo para el navegador
│   └── types/              # Declaraciones de tipos (.d.ts)
├── package.json            # Configuración de paquete privado y exports
├── tsconfig.json           # Configuración principal de TypeScript
└── tsconfig.build.json     # Configuración para emitir .d.ts
```

---

## 🚀 Comandos Disponibles (BunJS)

### Compilar Librería
Compila el proyecto a ESM, CommonJS, IIFE y genera las declaraciones de tipos `.d.ts`:
```bash
bun run build
```

Scripts individuales de compilación:
```bash
bun run build:esm    # Compila únicamente a ES Modules (dist/esm)
bun run build:cjs    # Compila únicamente a CommonJS (dist/cjs)
bun run build:iife   # Compila paquete bundle navegador (dist/iife)
bun run build:types  # Genera únicamente archivos .d.ts (dist/types)
```

### Ejecutar Pruebas
Ejecuta la suite de pruebas unitarias con `bun test`:
```bash
bun test
```

Modo observación (watch mode):
```bash
bun run test:watch
```

### Verificación de Tipos
Comprueba el tipado de TypeScript sin generar código:
```bash
bun run typecheck
```

---

## 📦 Consumo de la Librería

Esta librería soporta todos los sistemas de módulos estándar gracias a la configuración de `exports` en `package.json`:

### 1. ECMAScript Modules (ESM)
```typescript
import { createPermissions, PermissionManager } from 'endpoint-permissions-kit';
```

### 2. CommonJS (CJS)
```javascript
const { createPermissions, PermissionManager } = require('endpoint-permissions-kit');
```

### 3. Bun Native (TypeScript directo)
Al usar Bun, se resolverá directamente desde `./src/index.ts` con rendimiento nativo.
