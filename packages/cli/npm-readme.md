# auren

Discover and install versioned UI components and block catalogs into your React + Tailwind CSS projects.

## Quick Start

```bash
npm install -g auren
# or
npx auren --version
```

## Commands

```bash
auren init               # Analyze project and create auren.json
auren search hero        # Search blocks
auren info hero-001      # Inspect a block
auren add hero-001      # Install a block
auren add collection/saas-minimal  # Install a collection
```

## Requirements

- Node.js `>=20.19.0`
- React
- Tailwind CSS v4

## Registry

The CLI uses `https://auren.elmerjacobo.dev/` as the default Registry URL. Override with:

```bash
auren search hero --registry-url https://staging.example.com/
AUREN_REGISTRY_URL=https://staging.example.com auren info hero-001
```

## License

MIT
