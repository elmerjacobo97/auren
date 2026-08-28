# Auren — Architecture

Reglas generales de arquitectura que deben respetarse al diseñar e implementar cambios en Auren.

## Organización

- Evitar estructuras `src/` planas cuando el código empiece a crecer.
- Organizar por **dominio, módulo, capability o feature**, según corresponda.
- Mantener juntos los archivos relacionados.
- Mantener los tests junto a su implementación.
- No crear carpetas o abstracciones innecesarias de forma anticipada.

Ejemplo:

```text
src/
├── catalog/
├── element/
└── taxonomy/
```

## Imports

- Preferir path aliases con @/ para imports entre módulos.
- Evitar rutas relativas profundas como ../../../.
- Los imports relativos dentro del mismo módulo están permitidos.

## Barrel Files

- Evitar barrel files (index.ts) usados únicamente para reexportar módulos.
- Preferir imports directos al archivo o módulo necesario.

## Criterio de estructura

No todos los proyectos o packages deben utilizar la misma estructura.
Elegir la organización que mejor corresponda al contexto:

- Por feature cuando el código esté organizado alrededor de funcionalidades.
- Por dominio cuando represente conceptos del negocio.
- Por módulo/capability cuando agrupe responsabilidades técnicas relacionadas.
- Priorizar siempre claridad, cohesión y escalabilidad.
