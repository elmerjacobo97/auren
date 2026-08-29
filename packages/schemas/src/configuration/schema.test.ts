import type {
  AurenConfiguration,
  AurenConfigurationAliases,
  AurenConfigurationIntegrations,
  AurenConfigurationOutput,
} from "./schema.js";
import { aurenConfigurationSchema } from "./schema.js";
import { frameworkSchema } from "@auren/schemas/taxonomy";
import { describe, expect, it } from "vitest";

const completeConfiguration: AurenConfiguration = {
  framework: "react",
  components: "src/components/auren",
  tailwind: true,
  output: {
    utilities: "src/lib/auren",
    styles: "src/styles/auren",
    assets: "public/auren",
  },
  aliases: {
    components: "@/components",
    lib: "@/lib",
  },
  integrations: {
    shadcn: {
      enabled: true,
      version: 4,
      theme: null,
      options: ["new-york", false, { nested: "value" }],
    },
  },
};

function expectInvalid(value: unknown) {
  expect(aurenConfigurationSchema.safeParse(value).success).toBe(false);
}

describe("aurenConfigurationSchema", () => {
  it("accepts a complete React configuration without transforming values", () => {
    const parsed = aurenConfigurationSchema.parse(completeConfiguration);

    expect(parsed).toEqual(completeConfiguration);
    expect(parsed.aliases).toEqual({
      components: "@/components",
      lib: "@/lib",
    });
    expect(parsed.integrations?.shadcn).toEqual(
      completeConfiguration.integrations?.shadcn,
    );
  });

  it("requires the documented fields and rejects unknown fields", () => {
    for (const field of ["framework", "components", "tailwind"]) {
      const incomplete: Record<string, unknown> = {
        ...completeConfiguration,
      };
      delete incomplete[field];
      expectInvalid(incomplete);
    }

    expectInvalid({ ...completeConfiguration, tailwind: "true" });
    expectInvalid({ ...completeConfiguration, extra: true });
    expectInvalid({
      ...completeConfiguration,
      output: { ...completeConfiguration.output, extra: "src/extra" },
    });
  });

  it("accepts only official framework taxonomy values", () => {
    expect(frameworkSchema.parse("react")).toBe("react");
    expectInvalid({ ...completeConfiguration, framework: "vue" });
  });

  it("rejects unsafe component and output destinations", () => {
    const unsafePaths = [
      "",
      "/absolute/components",
      "C:/components",
      "src\\components",
      "src/../components",
      "./components",
      "src//components",
    ];

    for (const unsafePath of unsafePaths) {
      expectInvalid({ ...completeConfiguration, components: unsafePath });
      expectInvalid({
        ...completeConfiguration,
        output: { utilities: unsafePath },
      });
    }
  });

  it("preserves aliases as logical values instead of resolving them as paths", () => {
    const aliases = {
      components: "@/components",
      lib: "../logical-reference",
    };

    const parsed = aurenConfigurationSchema.parse({
      ...completeConfiguration,
      aliases,
    });

    expect(parsed.aliases).toEqual(aliases);
  });

  it("accepts recursively JSON-safe integration settings", () => {
    const integrations = {
      first: "value",
      second: 3.5,
      third: false,
      fourth: null,
      nested: {
        array: ["value", 1, true, null, { child: "value" }],
      },
    };

    expect(
      aurenConfigurationSchema.parse({
        ...completeConfiguration,
        integrations,
      }).integrations,
    ).toEqual(integrations);
  });

  it("rejects invalid integration keys and runtime-only values", () => {
    for (const key of ["", "Shadcn", "shad_cn", "shadcn-value-"]) {
      expectInvalid({
        ...completeConfiguration,
        integrations: { [key]: true },
      });
    }

    class RuntimeIntegrationValue {}
    const invalidValues: unknown[] = [
      undefined,
      () => "runtime",
      Symbol("runtime"),
      Number.POSITIVE_INFINITY,
      Number.NaN,
      new Date("2026-01-01"),
      new Map<string, string>(),
      new RuntimeIntegrationValue(),
    ];

    for (const value of invalidValues) {
      expectInvalid({
        ...completeConfiguration,
        integrations: { provider: { value } },
      });
    }
  });

  it("exposes inferred public configuration types", () => {
    const output: AurenConfigurationOutput = { assets: "public/assets" };
    const aliases: AurenConfigurationAliases = { components: "@/components" };
    const integrations: AurenConfigurationIntegrations = {
      provider: { enabled: true },
    };

    expect({ output, aliases, integrations }).toEqual({
      output,
      aliases,
      integrations,
    });
  });
});
