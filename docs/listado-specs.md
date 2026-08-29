# Auren — Listado de Specs

Este documento define el orden recomendado de implementación de Auren.

Cada spec debe desarrollarse e implementarse de forma independiente antes de continuar con la siguiente.

---

## Spec 01 — Bootstrap del Monorepo

- [x] Implementada y archivada

Crear la estructura base del proyecto con:

- pnpm workspaces
- Turborepo
- TypeScript
- estructura `apps/`, `packages/` y `blocks/`
- scripts principales
- configuración compartida

Objetivo: tener la base sobre la que vivirán todas las piezas de Auren.

---

## Spec 02 — Shared Configuration

- [x] Implementada y archivada

Crear las configuraciones compartidas del monorepo.

Incluye:

- TypeScript
- Biome
- aliases
- convenciones
- configuración de packages

Objetivo: evitar configuraciones duplicadas entre Web, CLI, Core, Registry y MCP.

---

## Spec 03 — Registry Schema

- [x] Implementada y archivada

Definir formalmente cómo se representa un elemento de Auren.

Debe contemplar:

- id
- name
- description
- category
- type
- styles
- industries
- features
- frameworks
- dependencies
- files
- metadata

Utilizar Zod como fuente de validación.

Objetivo: crear el contrato central de Auren.

---

## Spec 04 — Taxonomía del Catálogo

- [x] Implementada y archivada

Definir oficialmente las clasificaciones disponibles.

Incluye:

- Categories
- Block Types
- Styles
- Industries
- Features
- Frameworks

Ejemplos:

- Marketing
- Hero
- Minimal
- SaaS
- Dark Mode
- React

Objetivo: establecer una taxonomía consistente para humanos, CLI y agentes.

---

## Spec 05 — Registry Local

- [x] Implementada y archivada

Implementar el primer Registry funcional dentro del monorepo.

Debe poder:

- registrar bloques
- validarlos
- indexarlos
- consultarlos
- encontrarlos por ID
- filtrar por metadata

Objetivo: convertir el Registry en la fuente de verdad de Auren.

---

## Spec 06 — Block Standard

- [x] Implementada y archivada

Definir cómo debe construirse y organizarse cada bloque.

Ejemplo:

```text
blocks/
└── marketing/
    └── hero/
        └── hero-001/
            ├── component.tsx
            └── registry.json
```

Definir reglas sobre:

- estructura
- naming
- imports
- assets
- dependencies
- responsive
- dark mode
- accesibilidad

Objetivo: que todos los bloques sigan el mismo estándar.

---

## Spec 07 — Primer Bloque

- [x] Implementada y archivada

Crear el primer bloque real de Auren.

Recomendación:

```text
hero-001
```

Debe utilizar:

- React
- TypeScript
- Tailwind CSS v4

Objetivo: validar todo el flujo del Registry usando un bloque real.

---

## Spec 08 — Initial Block Catalog

- [x] Implementada y archivada

Crear el catálogo inicial del MVP.

Priorizar aproximadamente 10-20 bloques.

Primeras categorías sugeridas:

### Marketing

- Navbar
- Hero
- Logo Cloud
- Features
- Stats
- Pricing
- Testimonials
- FAQ
- CTA
- Footer

Objetivo: disponer de suficiente contenido real para desarrollar y probar el resto de Auren.

---

## Spec 09 — Core Package

- [x] Implementada y archivada

Implementar `packages/core`.

Debe contener la lógica compartida para:

- buscar bloques
- resolver bloques
- cargar metadata
- resolver archivos
- validar compatibilidad
- resolver dependencias

Objetivo: evitar que CLI, Web y MCP implementen la misma lógica.

---

## Spec 10 — Project Detection

- [x] Implementada y archivada

Añadir al Core detección automática del proyecto consumidor.

Detectar:

- React
- TypeScript
- Tailwind CSS
- versión de Tailwind
- shadcn/ui
- estructura `src`
- aliases
- package manager

Objetivo: permitir instalaciones adaptadas al proyecto del usuario.

---

## Spec 11 — Auren Configuration

- [x] Implementada y archivada

Crear el archivo:

```text
auren.json
```

Debe permitir configurar:

- framework
- output paths
- aliases
- components directory
- Tailwind
- integraciones

Objetivo: mantener configuración persistente dentro de cada proyecto consumidor.

---

## Spec 12 — CLI Foundation

- [x] Implementada y archivada

Crear `packages/cli`.

Implementar:

```bash
auren --help
auren --version
```

Configurar:

- Commander
- Clack
- manejo de errores
- salida de terminal

Objetivo: establecer la infraestructura del CLI.

---

## Spec 13 — `auren init`

- [x] Implementada y archivada

Implementar:

```bash
auren init
```

Debe:

- analizar el proyecto
- detectar tecnologías
- crear `auren.json`
- validar Tailwind
- detectar shadcn
- preparar Auren

Objetivo: inicializar correctamente cualquier proyecto consumidor.

---

## Spec 14 — `auren info`

- [x] Implementada y archivada

Implementar:

```bash
auren info hero-001
```

Debe mostrar:

- descripción
- categoría
- estilo
- features
- dependencias
- framework
- archivos

Objetivo: permitir inspeccionar un elemento antes de instalarlo.

---

## Spec 15 — `auren search`

- [x] Implementada y archivada

Implementar búsqueda desde CLI.

Ejemplo:

```bash
auren search hero
```

Posteriormente:

```bash
auren search hero --style minimal
```

Permitir filtros por:

- type
- category
- style
- industry
- features

Objetivo: hacer descubrible el catálogo sin entrar a la web.

---

## Spec 16 — `auren add`

- [ ] Pendiente

Implementar la función central del CLI.

Ejemplo:

```bash
auren add hero-001
```

Debe:

- localizar el bloque
- validar compatibilidad
- resolver dependencias
- copiar archivos
- resolver aliases
- evitar sobrescrituras accidentales

Objetivo: instalar código de Auren dentro del proyecto del usuario.

---

## Spec 17 — Dependency Resolution

- [ ] Pendiente

Implementar resolución automática de dependencias.

Ejemplos:

- paquetes npm
- componentes internos
- utilidades
- icon libraries
- shadcn/ui components

Objetivo: que un bloque pueda instalarse sin que el usuario tenga que resolver manualmente sus requisitos.

---

## Spec 18 — shadcn/ui Compatibility

- [ ] Pendiente

Añadir compatibilidad explícita con proyectos que utilicen shadcn/ui.

Debe permitir:

- detectar shadcn
- reutilizar componentes existentes
- instalar requisitos faltantes
- evitar duplicados

Objetivo: integrarse con shadcn sin convertirlo en una dependencia obligatoria de Auren.

---

## Spec 19 — Registry Build

- [ ] Pendiente

Crear el proceso que transforme los bloques fuente en un Registry distribuible.

Generar:

```text
registry.json
blocks/hero-001.json
blocks/pricing-001.json
...
```

Objetivo: separar el catálogo fuente del formato consumido públicamente.

---

## Spec 20 — Public Registry

- [ ] Pendiente

Publicar el Registry como recursos estáticos.

Ejemplo conceptual:

```text
registry.auren.dev/registry.json
registry.auren.dev/blocks/hero-001.json
```

Objetivo: permitir que Auren CLI funcione sin necesitar clonar el repositorio.

---

## Spec 21 — Remote CLI Registry

- [ ] Pendiente

Modificar el CLI para consumir el Registry remoto.

Flujo:

```text
CLI
↓
Auren Registry
↓
Metadata
↓
Files
↓
User Project
```

Objetivo: convertir el CLI en un producto distribuible real.

---

## Spec 22 — Web Foundation

- [ ] Pendiente

Crear:

```text
apps/web
```

Stack:

- React
- Vite
- TypeScript
- Tailwind CSS v4
- TanStack Router

Objetivo: establecer la aplicación pública de Auren.

---

## Spec 23 — Catalog Web

- [ ] Pendiente

Crear el catálogo visual.

Debe permitir navegar:

- Components
- Blocks
- Pages
- Collections

Objetivo: permitir descubrir visualmente el contenido de Auren.

---

## Spec 24 — Block Preview

- [ ] Pendiente

Crear páginas individuales para cada bloque.

Ejemplo:

```text
/blocks/hero-001
```

Mostrar:

- preview
- metadata
- código
- dependencias
- comandos de instalación

Objetivo: convertir el Registry en una experiencia visual útil.

---

## Spec 25 — Catalog Filters

- [ ] Pendiente

Implementar filtros en la web.

Permitir filtrar por:

- category
- type
- style
- industry
- features
- framework

Objetivo: facilitar la exploración cuando el catálogo crezca.

---

## Spec 26 — Copy Code

- [ ] Pendiente

Permitir copiar directamente el código desde la web.

Objetivo: mantener Auren usable incluso sin CLI.

---

## Spec 27 — Collections Model

- [ ] Pendiente

Extender el Registry para soportar Collections.

Una Collection agrupa bloques visualmente compatibles.

Ejemplo:

```text
SaaS Minimal
├── Navbar
├── Hero
├── Features
├── Pricing
├── FAQ
└── Footer
```

Objetivo: ir más allá de bloques individuales y ofrecer sistemas visuales coherentes.

---

## Spec 28 — Collections Installation

- [ ] Pendiente

Permitir instalar Collections completas.

Ejemplo:

```bash
auren add collection/saas-minimal
```

Objetivo: instalar múltiples secciones compatibles en una sola operación.

---

## Spec 29 — Pages

- [ ] Pendiente

Añadir soporte para páginas completas.

Ejemplos:

- Login
- Pricing
- Dashboard
- Settings
- Billing

Objetivo: ampliar el catálogo más allá de secciones individuales.

---

## Spec 30 — Templates

- [ ] Pendiente

Añadir soporte para templates completos.

Ejemplos:

- SaaS Starter
- Dashboard Starter
- Ecommerce Starter

Objetivo: proporcionar puntos de partida completos para aplicaciones.

---

## Spec 31 — MCP Foundation

- [ ] Pendiente

Crear:

```text
packages/mcp
```

Conectar el MCP con:

```text
Core
Registry
Schemas
```

Objetivo: exponer Auren directamente a coding agents.

---

## Spec 32 — MCP Discovery Tools

- [ ] Pendiente

Implementar herramientas como:

```text
search_blocks
get_block
list_categories
list_collections
```

Objetivo: permitir que los agentes exploren Auren mediante lenguaje natural.

---

## Spec 33 — MCP Installation Tools

- [ ] Pendiente

Implementar herramientas relacionadas con instalación.

Ejemplos:

```text
get_block_code
install_block
install_collection
```

Objetivo: permitir que los coding agents implementen interfaces directamente en proyectos.

---

## Spec 34 — Agent Metadata

- [ ] Pendiente

Mejorar la metadata específicamente para IA.

Añadir información como:

- visual intent
- recommended use
- compatible blocks
- incompatible combinations
- composition hints
- content slots
- customization hints

Objetivo: que un agente pueda elegir correctamente entre diferentes bloques.

---

## Spec 35 — Smart Block Matching

- [ ] Pendiente

Implementar ranking de bloques según los requisitos solicitados.

Ejemplo:

```text
Hero
SaaS
Minimal
Dark
Product Screenshot
```

Resultado:

```text
hero-018   96%
hero-042   91%
hero-007   84%
```

Objetivo: mejorar la selección automática realizada por agentes.

---

## Spec 36 — Quality Validation

- [ ] Pendiente

Crear validaciones automáticas para los bloques.

Validar:

- Registry schema
- TypeScript
- build
- responsive
- imports
- dependencies
- archivos faltantes

Objetivo: evitar publicar bloques defectuosos.

---

## Spec 37 — Visual Testing

- [ ] Pendiente

Añadir pruebas visuales de los bloques.

Utilizar Playwright.

Objetivo: detectar regresiones visuales antes de publicar cambios.

---

## Spec 38 — Accessibility Validation

- [ ] Pendiente

Añadir controles automáticos y reglas de accesibilidad.

Objetivo: mantener un estándar mínimo de calidad en todo el catálogo.

---

## Spec 39 — Versioning

- [ ] Pendiente

Definir cómo se versionarán:

- Auren CLI
- Registry
- bloques
- schemas

Objetivo: evitar romper proyectos existentes cuando Auren evolucione.

---

## Spec 40 — Documentation

- [ ] Pendiente

Crear documentación oficial para:

- instalación
- CLI
- Registry
- creación de bloques
- Collections
- MCP
- integración con agentes

Objetivo: hacer que Auren pueda ser utilizado y extendido sin conocer internamente el proyecto.

---

# Post-MVP

Las siguientes specs no deberían bloquear el lanzamiento inicial.

---

## Spec 41 — Authentication

- [ ] Pendiente

Sistema de cuentas de usuario.

---

## Spec 42 — Auren Pro

- [ ] Pendiente

Separar contenido gratuito y premium.

---

## Spec 43 — Licensing

- [ ] Pendiente

Sistema de licencias para usuarios Pro.

---

## Spec 44 — Payments

- [ ] Pendiente

Integración de pagos para adquirir Auren Pro.

---

## Spec 45 — Private Registry

- [ ] Pendiente

Protección y distribución del contenido premium.

---

## Spec 46 — User Library

- [ ] Pendiente

Favoritos, historial y contenido guardado.

---

## Spec 47 — Teams

- [ ] Pendiente

Soporte para organizaciones y equipos.

---

## Spec 48 — Vue Support

- [ ] Pendiente

Añadir Vue como framework soportado.

---

## Spec 49 — Svelte Support

- [ ] Pendiente

Añadir Svelte como framework soportado.

---

## Spec 50 — Community Registry

- [ ] Pendiente

Permitir que terceros creen o publiquen bloques compatibles con Auren.

---

# Primer Milestone

Antes de pensar en MCP, pagos o cientos de bloques, Auren debería conseguir este flujo completo:

```text
Crear bloque
      ↓
Registrar bloque
      ↓
Publicar Registry
      ↓
auren search
      ↓
auren info
      ↓
auren add
      ↓
Código dentro del proyecto
```

El primer objetivo práctico debería ser poder ejecutar:

```bash
npx auren init
npx auren search hero
npx auren add hero-001
```

y obtener un Hero completamente funcional dentro de un proyecto React + Tailwind CSS.

Ese será el primer núcleo real de Auren.
