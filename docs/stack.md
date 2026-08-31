# Auren — Stack Tecnológico

## 1. Arquitectura

Auren utilizará un monorepo.

El objetivo es mantener en un mismo repositorio:

- Web
- CLI
- Registry
- Core
- Schemas
- MCP
- Bloques UI

Todas las partes compartirán tipos, metadata y lógica.

---

# 2. Monorepo

## Package Manager

**pnpm**

Responsable de:

- Workspaces
- Dependencias
- Packages internos
- Scripts

---

## Build System

**Turborepo**

Responsable de:

- Builds
- Cache
- Pipelines
- Ejecución de tareas entre packages

---

# 3. Estructura Inicial

```text
auren/
├── apps/
│   └── web/
│
├── packages/
│   ├── cli/
│   ├── core/
│   ├── registry/
│   ├── schemas/
│   └── mcp/
│
├── blocks/
│   ├── marketing/
│   ├── application-ui/
│   ├── ecommerce/
│   └── authentication/
│
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

# 4. Web

## Framework

**React**

## Build Tool

**Vite**

## Lenguaje

**TypeScript**

## CSS

**Tailwind CSS v4**

## Routing

**TanStack Router**

## Fetching

**TanStack Query**

Solo cuando sea necesario consumir APIs o información dinámica.

---

# 5. UI

Auren utilizará:

**Tailwind CSS v4 como base.**

Los bloques deben depender lo mínimo posible de otras librerías.

---

## shadcn/ui

Será una integración opcional.

Se utilizará principalmente para componentes interactivos como:

- Dialog
- Select
- Dropdown
- Accordion
- Command
- Popover
- Sheet

Los bloques simples no dependerán de shadcn/ui.

Ejemplos:

```text
Hero          → Tailwind
Pricing       → Tailwind
Features      → Tailwind
CTA           → Tailwind

Dialog        → shadcn compatible
Dropdown      → shadcn compatible
Accordion     → shadcn compatible
```

---

# 6. Framework Inicial

El MVP será:

```text
React
+
TypeScript
+
Tailwind CSS v4
```

Auren se diseñará para poder soportar posteriormente:

```text
Vue
Svelte
HTML
```

sin cambiar el modelo del Registry.

---

# 7. Registry

El Registry será el corazón de Auren.

Será responsable de almacenar:

- Componentes
- Blocks
- Pages
- Collections
- Templates
- Metadata
- Dependencias
- Archivos
- Compatibilidad

Ejemplo:

```json
{
  "id": "hero-001",
  "name": "Hero Minimal",
  "category": "marketing",
  "type": "hero",
  "styles": ["minimal"],
  "industries": ["saas"],
  "features": ["responsive", "dark-mode", "two-cta"],
  "frameworks": ["react"]
}
```

---

# 8. Schemas

## Validación

**Zod**

Se utilizará para:

- Registry schemas
- CLI configuration
- Metadata
- MCP inputs
- API responses

Ejemplo:

```text
packages/schemas
```

Será compartido entre:

```text
Web
CLI
Registry
MCP
Core
```

---

# 9. Core

Package:

```text
packages/core
```

Responsabilidades:

- Resolver bloques
- Descargar archivos
- Resolver dependencias
- Detectar framework
- Detectar Tailwind
- Detectar shadcn/ui
- Instalar componentes
- Resolver paths
- Manejar configuración

El CLI y MCP deberán reutilizar esta lógica.

---

# 10. CLI

Package:

```text
packages/cli
```

## Runtime

**Node.js**

## Lenguaje

**TypeScript**

## Librerías sugeridas

### Commander

Para comandos CLI.

### @clack/prompts

Para prompts interactivos.

### Zod

Para validación.

### picocolors

Para salida visual del terminal.

---

## Comandos Iniciales

```bash
auren init
auren search
auren add
auren info
auren list
```

El CLI consulta el Registry público estático por defecto. Puede usarse
`--registry-url <url>` por comando o `AUREN_REGISTRY_URL` por proceso; la
precedencia es opción de comando, variable de entorno y, por último,
`https://auren.elmerjacobo.dev/`.

Ejemplos:

```bash
npx auren add hero-001
```

```bash
npx auren search hero --registry-url https://staging.example.test/auren/
```

```bash
AUREN_REGISTRY_URL=https://staging.example.test/auren npx auren info hero-001
```

---

# 11. Configuración

El proyecto consumidor podría tener:

```text
auren.json
```

Ejemplo:

```json
{
  "framework": "react",
  "tailwind": true,
  "components": "src/components/auren",
  "aliases": {
    "components": "@/components",
    "lib": "@/lib"
  }
}
```

---

# 12. MCP

Package:

```text
packages/mcp
```

Se implementará después del Registry y CLI.

El MCP reutilizará:

```text
packages/core
packages/registry
packages/schemas
```

---

## Tools Iniciales

```text
search_blocks
get_block
get_block_code
list_categories
list_collections
install_block
```

Ejemplo:

```text
search_blocks({
  type: "hero",
  style: "minimal",
  industry: "saas"
})
```

---

# 13. Flujo de Arquitectura

```text
                 Registry
                    │
                    ↓
                  Core
                    │
        ┌───────────┼───────────┐
        │           │           │
       Web         CLI         MCP
        │           │           │
        └───────────┴───────────┘
                    │
                    ↓
              User Project
```

El Registry será la única fuente de verdad.

---

# 14. Blocks

Los bloques estarán dentro del mismo repositorio.

Ejemplo:

```text
blocks/
└── marketing/
    └── hero/
        ├── hero-001/
        │   ├── component.tsx
        │   └── registry.json
        │
        └── hero-002/
            ├── component.tsx
            └── registry.json
```

---

# 15. Registry Público

Inicialmente no será necesario un backend.

El catálogo se publica como un document root estático y el CLI puede consultar
directamente estos recursos:

```text
https://auren.elmerjacobo.dev/registry.json
https://auren.elmerjacobo.dev/blocks/hero-001.json
https://auren.elmerjacobo.dev/blocks/pricing-001.json
```

`info` y `search` solicitan solo `registry.json`; `add` solicita los detalles
de los bloques resueltos. El CLI no persiste una caché ni vuelve a un checkout
local de `blocks/` si el Registry remoto no está disponible.

---

# 16. Backend

No será parte del MVP.

Se añadirá cuando Auren necesite:

- Login
- Usuarios
- Compras
- Licencias
- Auren Pro
- Favoritos
- Analytics
- Teams
- Private registries

---

# 17. Backend Futuro

Stack recomendado:

```text
NestJS
PostgreSQL
Prisma
Stripe
```

Responsabilidades:

- Authentication
- Users
- Licenses
- Purchases
- Teams
- Billing
- Premium registry access

---

# 18. Storage Futuro

Para bloques premium o assets:

```text
S3-compatible object storage
```

Opciones posibles:

- Cloudflare R2
- AWS S3

---

# 19. Hosting

## Web

Vercel o Cloudflare Pages.

## Registry

Cloudflare CDN / R2 o hosting estático.

## Backend

Cuando exista:

- Railway
- Fly.io
- Render
- AWS
- VPS

---

# 20. Testing

## Unit Testing

**Vitest**

Para:

- Core
- Schemas
- Registry
- CLI helpers

## E2E

**Playwright**

Para:

- Web
- Component previews
- CLI integration cuando sea necesario

---

# 21. Calidad

## Formatter / Linter

**Biome**

Para:

- Formatting
- Linting
- Imports

---

# 22. Primera Versión

El MVP debería contener únicamente:

```text
pnpm
Turborepo
TypeScript

React
Vite
Tailwind CSS v4
TanStack Router

Zod

Registry
Core
CLI

10-20 bloques iniciales
```

No incluir inicialmente:

```text
Backend
Database
Stripe
Accounts
Teams
Vue
Svelte
```

---

# 23. Orden de Implementación

```text
1. Monorepo
2. Schemas
3. Registry
4. Primeros bloques
5. Core
6. CLI
7. Web/catalog
8. Collections
9. MCP
10. Backend
11. Auren Pro
12. Vue/Svelte
```

La prioridad técnica de Auren debe ser:

> Registry primero. CLI después. Web y MCP consumen el mismo sistema.
