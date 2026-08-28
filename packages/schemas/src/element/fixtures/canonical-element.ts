export const canonicalElement = {
  id: "hero-001",
  name: "Product launch hero",
  description:
    "A responsive hero section with a product screenshot and two calls to action.",
  category: "marketing",
  type: "hero",
  styles: ["minimal"],
  industries: ["saas", "ai"],
  features: ["responsive", "product-screenshot", "two-cta", "dark-mode"],
  frameworks: ["react"],
  dependencies: [
    {
      kind: "package",
      name: "@acme/ui",
      version: "^1.2.0",
    },
    {
      kind: "auren",
      id: "button-001",
    },
  ],
  files: [
    {
      path: "component.tsx",
      kind: "component",
      target: "src/components/hero.tsx",
      content: "export function Hero() { return null; }",
    },
    {
      path: "hero.css",
      kind: "style",
      content: ".hero { display: grid; }",
    },
  ],
  metadata: {
    author: "Auren",
    featured: true,
    score: 4.5,
    tags: ["conversion", "landing-page"],
    viewport: {
      minWidth: 320,
      maxWidth: 1440,
    },
  },
};
