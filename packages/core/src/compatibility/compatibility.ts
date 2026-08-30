import type { CatalogElement } from "@auren/schemas/catalog";
import type { Feature, Framework } from "@auren/schemas/taxonomy";

export type CompatibilityTarget = {
  frameworks?: readonly Framework[];
  features?: readonly Feature[];
};

export type CompatibilityReport = {
  compatible: boolean;
  missing: {
    frameworks: readonly Framework[];
    features: readonly Feature[];
  };
};

export function validateCompatibility(
  element: CatalogElement,
  target: CompatibilityTarget = {},
): CompatibilityReport {
  const elementFrameworks = new Set(element.frameworks);
  const elementFeatures = new Set(element.features);
  const missingFrameworks = (target.frameworks ?? []).filter(
    (framework) => !elementFrameworks.has(framework),
  );
  const missingFeatures = (target.features ?? []).filter(
    (feature) => !elementFeatures.has(feature),
  );

  return {
    compatible: missingFrameworks.length === 0 && missingFeatures.length === 0,
    missing: {
      frameworks: missingFrameworks,
      features: missingFeatures,
    },
  };
}
