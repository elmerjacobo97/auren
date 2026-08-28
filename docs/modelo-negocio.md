# Auren — Modelo de Negocio

## 1. Qué es Auren

Auren es una plataforma de bloques, secciones, páginas y sistemas visuales construidos con Tailwind CSS, diseñados para ser reutilizados directamente en proyectos modernos.

El objetivo no es funcionar como una librería tradicional que se instala como dependencia, sino como un catálogo de código reutilizable que el desarrollador puede copiar, instalar mediante CLI o consumir desde agentes de IA mediante MCP.

Auren está pensado tanto para desarrolladores como para coding agents.

---

## 2. Problema

Los desarrolladores pierden tiempo creando repetidamente interfaces comunes como:

- Heroes
- Navbars
- Pricing
- Features
- FAQs
- Footers
- Dashboards
- Settings
- Billing
- Authentication
- Tables
- Empty states
- Ecommerce sections

Aunque una IA puede generar estos elementos, muchas veces el resultado necesita varias iteraciones para conseguir:

- Diseño consistente
- Responsive correcto
- Accesibilidad
- Dark mode
- Buen spacing
- Estados interactivos
- Compatibilidad con el design system existente
- Código limpio
- Buenas prácticas

Auren ofrece un punto de partida probado en lugar de generar cada interfaz desde cero.

---

## 3. Propuesta de Valor

Auren ofrece bloques UI production-ready que pueden instalarse directamente dentro del código del proyecto.

El desarrollador mantiene control completo sobre el código.

Auren busca ofrecer:

- Código reutilizable
- Tailwind CSS como base
- React como framework inicial
- Compatibilidad con shadcn/ui cuando sea necesario
- Responsive
- Dark mode
- Accesibilidad
- Código editable
- Variantes visuales
- Sistemas visuales coherentes
- CLI
- Registry
- MCP para coding agents

La propuesta principal es:

> Auren es una fuente de interfaces reutilizables para humanos y agentes de IA.

---

## 4. Tipos de Contenido

### Components

Elementos pequeños y reutilizables.

Ejemplos:

- Buttons
- Inputs
- Badges
- Cards
- Tabs
- Dialogs
- Dropdowns

---

### Blocks

Secciones completas.

Ejemplos:

- Hero
- Features
- Pricing
- Testimonials
- CTA
- FAQ
- Navbar
- Footer
- Dashboard sidebar
- Settings sections

---

### Pages

Páginas completas listas para adaptar.

Ejemplos:

- Login
- Register
- Pricing
- Dashboard
- Settings
- Billing
- Team management
- Ecommerce product page

---

### Collections

Conjuntos de bloques diseñados para combinar entre sí.

Ejemplos:

- SaaS Minimal
- Fintech Dark
- AI Startup
- Developer Tools
- Editorial Portfolio
- Modern Ecommerce

Una colección mantiene consistencia visual entre todas sus secciones.

---

### Templates

Experiencias completas formadas por múltiples páginas y bloques.

Ejemplos:

- SaaS Starter
- Admin Dashboard
- Ecommerce Starter
- Portfolio
- AI Product Landing

---

## 5. Organización del Catálogo

Cada elemento puede clasificarse por diferentes dimensiones.

### Categoría

Ejemplos:

- Marketing
- Application UI
- Ecommerce
- Authentication

### Tipo

Ejemplos:

- Hero
- Pricing
- Features
- Sidebar
- Table

### Estilo

Ejemplos:

- Minimal
- Bold
- Editorial
- Corporate
- Glass
- Brutalist
- Luxury
- Developer

### Industria

Ejemplos:

- SaaS
- Fintech
- AI
- Developer Tools
- Ecommerce
- Education
- Portfolio
- Agency

### Features

Ejemplos:

- Dark mode
- Mobile first
- Responsive
- Product screenshot
- Two CTA
- Animated
- Sidebar
- Search
- Command palette

---

## 6. Distribución

Auren tendrá varias formas de consumir el mismo catálogo.

### Web

El usuario podrá explorar visualmente los componentes.

Ejemplo:

auren.dev/blocks/heroes

Funciones:

- Preview
- Búsqueda
- Filtros
- Código
- Copy
- Install
- Variantes
- Collections

---

### CLI

Ejemplos:

```bash
npx auren add hero-001
npx auren add pricing-003
npx auren search hero
npx auren info hero-001
```

El código se instala directamente dentro del proyecto.

El usuario pasa a ser propietario del código instalado y puede modificarlo libremente.

---

### MCP

Los coding agents podrán consultar directamente el catálogo de Auren.

Ejemplo:

```text
Busca en Auren un hero minimalista para un SaaS.

Debe incluir:
- dark mode
- screenshot del producto
- dos CTA
- diseño responsive

Instálalo en la landing y adapta el contenido al proyecto.
```

El agente podrá buscar, analizar e instalar bloques desde Auren.

---

## 7. Usuarios Objetivo

### Developers

Desarrolladores que construyen:

- SaaS
- Landing pages
- Dashboards
- Ecommerce
- Productos internos
- Side projects

### Freelancers

Profesionales que necesitan entregar interfaces rápidamente.

### Agencies

Equipos que desarrollan numerosos sitios y aplicaciones.

### Startups

Equipos pequeños que necesitan acelerar desarrollo sin contratar un equipo completo de diseño.

### AI Coding Agents

Auren también estará diseñado para herramientas como:

- Codex
- Claude Code
- Cursor
- OpenCode
- Windsurf
- Otros agentes compatibles con MCP

---

## 8. Modelo Freemium

### Auren Free

Objetivo:

Facilitar adopción y permitir probar el producto sin pagar.

Incluye:

- CLI
- MCP
- Componentes gratuitos
- Bloques gratuitos
- React
- Tailwind CSS
- Uso personal
- Uso comercial
- Collections gratuitas seleccionadas

Ejemplo:

50-100 bloques gratuitos.

---

### Auren Pro

Precio inicial sugerido:

**$79-$99 USD lifetime**

Incluye:

- Catálogo completo
- Premium blocks
- Pages
- Collections premium
- Templates
- Nuevas colecciones
- Uso ilimitado en proyectos propios
- Uso comercial
- CLI completo
- MCP completo
- Actualizaciones

---

## 9. Posibles Planes Futuros

### Auren Team

Dirigido a equipos y agencias.

Podría incluir:

- Varios miembros
- Private collections
- Shared favorites
- Team registry
- Brand presets
- Centralized configuration

Modelo posible:

Suscripción anual.

---

### Auren Enterprise

Para empresas que quieran usar Auren como registry interno.

Podría incluir:

- Private registry
- SSO
- Custom components
- Custom design systems
- Dedicated support
- Internal MCP
- Private infrastructure

---

## 10. Estrategia de Monetización

La monetización principal inicialmente será:

### Lifetime License

Pago único para desbloquear Auren Pro.

Ventajas:

- Fácil de entender
- Reduce fricción
- Atractivo para developers
- Facilita adopción inicial

Posteriormente pueden introducirse productos recurrentes para equipos y empresas.

---

## 11. Diferenciación

Auren no debe competir únicamente ofreciendo más componentes.

Su diferenciación será:

### Tailwind First

Tailwind CSS es la base del producto.

### Open Code

Los componentes se copian o instalan dentro del proyecto.

No existe dependencia obligatoria con una librería runtime.

### Agent First

El catálogo está diseñado desde el principio para ser comprendido por agentes de IA.

Cada bloque tendrá metadata semántica.

### Design Systems

Los bloques pueden formar parte de sistemas visuales completos.

### Collections

Los componentes están diseñados para combinar entre ellos.

### CLI + MCP

El mismo catálogo puede consumirse desde humanos o agentes.

---

## 12. Metadata para IA

Cada bloque tendrá información estructurada.

Ejemplo:

```json
{
  "id": "hero-042",
  "category": "marketing",
  "type": "hero",
  "styles": ["minimal"],
  "industries": ["saas", "ai"],
  "features": ["responsive", "dark-mode", "product-screenshot", "two-cta"],
  "frameworks": ["react"]
}
```

Esto permite que Auren responda consultas semánticas.

Ejemplo:

```text
Necesito un hero minimalista para una plataforma fintech con dark mode.
```

Auren puede encontrar los bloques que mejor coincidan con esos requisitos.

---

## 13. Visión

Auren busca convertirse en una capa entre el diseño UI y los coding agents.

En lugar de que una IA genere cada interfaz desde cero:

```text
Prompt
↓
Generación
↓
Correcciones
↓
Iteraciones
```

Auren ofrece:

```text
Prompt
↓
Auren
↓
Bloque probado
↓
Adaptación
```

La visión a largo plazo es:

> Convertir Auren en un registry de interfaces que desarrolladores y agentes consulten antes de generar una UI desde cero.
