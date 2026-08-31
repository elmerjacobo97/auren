import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
let manifest;

try {
  manifest = JSON.parse(
    readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  );
} catch {
  throw new Error("Unable to load the CLI package manifest");
}

const entrypoint = path.join(packageRoot, "dist", "index.js");

function runCli(...args) {
  return runCliFrom(packageRoot, ...args);
}

function runCliFrom(cwd, ...args) {
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `dist/index.js ${args.join(" ")} exited with ${String(result.status)}:\n${result.stderr}`,
    );
  }

  return result;
}

async function writeRegistryFixture(registryRoot) {
  const indexElement = {
    id: "hero-001",
    name: "Product launch hero",
    description: "A responsive product launch hero.",
    category: "marketing",
    type: "hero",
    styles: ["minimal"],
    industries: ["saas"],
    features: ["mobile-first", "responsive"],
    frameworks: ["react"],
    dependencies: [],
    files: [
      { path: "component.tsx", kind: "component" },
      { path: "utilities/types.ts", kind: "utility" },
    ],
    metadata: {},
  };
  const indexNavbar = {
    ...indexElement,
    id: "navbar-001",
    name: "Product launch navbar",
    description: "A responsive navigation bar.",
    type: "navbar",
    files: [{ path: "component.tsx", kind: "component" }],
  };
  const detailElement = {
    ...indexElement,
    files: [
      {
        path: "component.tsx",
        kind: "component",
        content: "export function Hero() { return null; }\n",
      },
      {
        path: "utilities/types.ts",
        kind: "utility",
        content: "export type HeroSize = 'large' | 'small';\n",
      },
    ],
  };

  const detailNavbar = {
    ...indexNavbar,
    files: [
      {
        path: "component.tsx",
        kind: "component",
        content: "export function Navbar() { return null; }\n",
      },
    ],
  };
  const collection = {
    id: "saas-minimal",
    name: "SaaS Minimal",
    description: "A minimal SaaS collection.",
    category: "marketing",
    styles: ["minimal"],
    industries: ["saas"],
    features: ["responsive"],
    frameworks: ["react"],
    blocks: ["hero-001", "navbar-001"],
    metadata: {},
  };

  await mkdir(path.join(registryRoot, "blocks"), { recursive: true });
  await mkdir(path.join(registryRoot, "collections"), { recursive: true });
  await writeFile(
    path.join(registryRoot, "registry.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        blocks: [indexElement, indexNavbar],
        collections: [collection],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(registryRoot, "blocks/hero-001.json"),
    `${JSON.stringify(detailElement, null, 2)}\n`,
  );
  await writeFile(
    path.join(registryRoot, "blocks/navbar-001.json"),
    `${JSON.stringify(detailNavbar, null, 2)}\n`,
  );
  await writeFile(
    path.join(registryRoot, "collections/saas-minimal.json"),
    `${JSON.stringify(collection, null, 2)}\n`,
  );
}

async function startRegistryServer(registryRoot) {
  const serverRoot = await mkdtemp(path.join(tmpdir(), "auren-cli-server-"));
  const serverScript = path.join(serverRoot, "server.mjs");
  await writeFile(
    serverScript,
    `import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.argv[2];
const resources = new Map([
  ["/registry.json", "registry.json"],
  ["/blocks/hero-001.json", "blocks/hero-001.json"],
  ["/blocks/navbar-001.json", "blocks/navbar-001.json"],
  ["/collections/saas-minimal.json", "collections/saas-minimal.json"],
]);
const server = createServer(async (request, response) => {
  const relativePath = resources.get(request.url);

  if (request.method !== "GET" || relativePath === undefined) {
    response.writeHead(404, { "content-type": "application/json" });
    response.end("{}\\n");
    return;
  }

  try {
    const body = await readFile(path.join(root, relativePath));
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-length": String(body.byteLength),
    });
    response.end(body);
  } catch {
    response.writeHead(500, { "content-type": "application/json" });
    response.end("{}\\n");
  }
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  process.stdout.write(String(typeof address === "object" && address ? address.port : 0));
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
`,
  );

  const child = spawn(process.execPath, [serverScript, registryRoot], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  child.stdout.setEncoding("utf8");

  try {
    const port = await new Promise((resolve, reject) => {
      let output = "";
      const onData = (chunk) => {
        output += chunk;
        const match = output.match(/\d+/);

        if (match) {
          cleanup();
          resolve(Number(match[0]));
        }
      };
      const onError = (error) => {
        cleanup();
        reject(error);
      };
      const onExit = (code) => {
        cleanup();
        reject(
          new Error(`Registry fixture server exited with ${String(code)}`),
        );
      };
      const cleanup = () => {
        child.stdout.off("data", onData);
        child.off("error", onError);
        child.off("exit", onExit);
      };

      child.stdout.on("data", onData);
      child.once("error", onError);
      child.once("exit", onExit);
    });

    return {
      child,
      serverRoot,
      url: `http://127.0.0.1:${port}/`,
    };
  } catch (error) {
    child.kill("SIGTERM");
    await rm(serverRoot, { recursive: true, force: true });
    throw error;
  }
}

async function stopRegistryServer(server) {
  if (server.child.exitCode === null) {
    await new Promise((resolve) => {
      server.child.once("exit", resolve);
      server.child.kill("SIGTERM");
    });
  }

  await rm(server.serverRoot, { recursive: true, force: true });
}

const help = runCli("--help");

if (!help.stdout.includes("Usage: auren [options]")) {
  throw new Error("Built CLI help did not contain the root usage line");
}

for (const command of ["init", "info", "search", "add"]) {
  if (!help.stdout.includes(command)) {
    throw new Error(`Built CLI help did not advertise the ${command} command`);
  }
}

if (help.stderr !== "") {
  throw new Error("Built CLI help wrote to stderr");
}

const registryRoot = await mkdtemp(path.join(tmpdir(), "auren-cli-registry-"));
let registryServer;

try {
  await writeRegistryFixture(registryRoot);
  registryServer = await startRegistryServer(registryRoot);
  const registryUrl = registryServer.url;
  const info = runCli("info", "hero-001", "--registry-url", registryUrl);

  for (const expected of [
    "ID: hero-001",
    "Name: Product launch hero",
    "Category: marketing",
    "Files:",
    "component.tsx",
  ]) {
    if (!info.stdout.includes(expected)) {
      throw new Error(`Built CLI info output did not contain ${expected}`);
    }
  }

  if (info.stderr !== "") {
    throw new Error("Built CLI info wrote to stderr");
  }

  const search = runCli("search", "hero", "--registry-url", registryUrl);

  for (const expected of [
    "1 result",
    "hero-001 - Product launch hero",
    "Category: marketing, Type: hero",
  ]) {
    if (!search.stdout.includes(expected)) {
      throw new Error(`Built CLI search output did not contain ${expected}`);
    }
  }

  if (search.stderr !== "") {
    throw new Error("Built CLI search wrote to stderr");
  }

  const consumerRoot = await mkdtemp(
    path.join(tmpdir(), "auren-cli-consumer-"),
  );

  try {
    const consumerPackage = `${JSON.stringify(
      { dependencies: { react: "^19.0.0", tailwindcss: "^4.0.0" } },
      null,
      2,
    )}\n`;
    const consumerConfiguration = `${JSON.stringify(
      {
        framework: "react",
        components: "src/components/auren",
        tailwind: true,
      },
      null,
      2,
    )}\n`;

    await writeFile(path.join(consumerRoot, "package.json"), consumerPackage);
    await writeFile(
      path.join(consumerRoot, "auren.json"),
      consumerConfiguration,
    );
    const packageBefore = await readFile(
      path.join(consumerRoot, "package.json"),
      "utf8",
    );
    const componentsConfigPath = path.join(consumerRoot, "components.json");

    try {
      await readFile(componentsConfigPath, "utf8");
      throw new Error(
        "Built CLI fixture unexpectedly started with components.json",
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("unexpectedly")) {
        throw error;
      }
    }

    const add = runCliFrom(
      consumerRoot,
      "add",
      "hero-001",
      "--registry-url",
      registryUrl,
    );

    if (add.status !== 0) {
      throw new Error("Built CLI add did not succeed");
    }

    if (add.stderr !== "") {
      throw new Error("Built CLI add wrote to stderr");
    }

    if (add.stdout.includes("shadcn/ui")) {
      throw new Error(
        "Built CLI invoked or reported shadcn for a dependency-free block",
      );
    }

    try {
      await readFile(componentsConfigPath, "utf8");
      throw new Error("Built CLI add unexpectedly created components.json");
    } catch (error) {
      if (error instanceof Error && error.message.includes("unexpectedly")) {
        throw error;
      }
    }

    for (const expected of [
      "Added hero-001",
      "Resolved blocks:\n- hero-001",
      "Satisfied package requirements:\n- none",
      "Installed package requirements:\n- none",
      "src/components/auren/hero-001/component.tsx",
      "src/components/auren/hero-001/utilities/types.ts",
    ]) {
      if (!add.stdout.includes(expected)) {
        throw new Error(`Built CLI add output did not contain ${expected}`);
      }
    }

    for (const relativePath of [
      "src/components/auren/hero-001/component.tsx",
      "src/components/auren/hero-001/utilities/types.ts",
    ]) {
      const filePath = path.join(consumerRoot, ...relativePath.split("/"));

      try {
        await readFile(filePath, "utf8");
      } catch {
        throw new Error(`Built CLI add did not create ${relativePath}`);
      }
    }

    if (
      (await readFile(path.join(consumerRoot, "package.json"), "utf8")) !==
      packageBefore
    ) {
      throw new Error("Built CLI add modified package.json");
    }

    const collectionAdd = runCliFrom(
      consumerRoot,
      "add",
      "collection/saas-minimal",
      "--force",
      "--registry-url",
      registryUrl,
    );

    if (collectionAdd.status !== 0 || collectionAdd.stderr !== "") {
      throw new Error("Built CLI Collection add did not succeed cleanly");
    }

    for (const expected of [
      "Added collection/saas-minimal",
      "Collection: saas-minimal",
      "Authored members:\n- hero-001\n- navbar-001",
      "Resolved blocks:\n- hero-001\n- navbar-001",
      "src/components/auren/hero-001/component.tsx",
      "src/components/auren/navbar-001/component.tsx",
    ]) {
      if (!collectionAdd.stdout.includes(expected)) {
        throw new Error(
          `Built CLI Collection add output did not contain ${expected}`,
        );
      }
    }

    for (const relativePath of [
      "src/components/auren/hero-001/component.tsx",
      "src/components/auren/navbar-001/component.tsx",
    ]) {
      const filePath = path.join(consumerRoot, ...relativePath.split("/"));

      try {
        await readFile(filePath, "utf8");
      } catch {
        throw new Error(
          `Built CLI Collection add did not create ${relativePath}`,
        );
      }
    }
  } finally {
    await rm(consumerRoot, { recursive: true, force: true });
  }
} finally {
  if (registryServer !== undefined) {
    await stopRegistryServer(registryServer);
  }
  await rm(registryRoot, { recursive: true, force: true });
}

const version = runCli("--version");

if (version.stdout !== `${manifest.version}\n`) {
  throw new Error("Built CLI version did not match package.json");
}

if (version.stderr !== "") {
  throw new Error("Built CLI version wrote to stderr");
}

process.stdout.write("CLI distribution verification passed.\n");
