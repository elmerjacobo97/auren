import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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

const help = runCli("--help");

if (!help.stdout.includes("Usage: auren [options]")) {
  throw new Error("Built CLI help did not contain the root usage line");
}

if (!help.stdout.includes("init")) {
  throw new Error("Built CLI help did not advertise the init command");
}

if (!help.stdout.includes("info")) {
  throw new Error("Built CLI help did not advertise the info command");
}

if (!help.stdout.includes("search")) {
  throw new Error("Built CLI help did not advertise the search command");
}

if (help.stderr !== "") {
  throw new Error("Built CLI help wrote to stderr");
}

const info = runCli("info", "hero-001");

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

const search = runCli("search", "hero");

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

const consumerRoot = await mkdtemp(path.join(tmpdir(), "auren-cli-consumer-"));

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
  await writeFile(path.join(consumerRoot, "auren.json"), consumerConfiguration);
  const packageBefore = await readFile(
    path.join(consumerRoot, "package.json"),
    "utf8",
  );
  const add = runCliFrom(consumerRoot, "add", "hero-001");

  if (add.status !== 0) {
    throw new Error("Built CLI add did not succeed");
  }

  if (add.stderr !== "") {
    throw new Error("Built CLI add wrote to stderr");
  }

  for (const expected of [
    "Added hero-001",
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
} finally {
  await rm(consumerRoot, { recursive: true, force: true });
}

const version = runCli("--version");

if (version.stdout !== `${manifest.version}${"\n"}`) {
  throw new Error("Built CLI version did not match package.json");
}

if (version.stderr !== "") {
  throw new Error("Built CLI version wrote to stderr");
}

process.stdout.write("CLI distribution verification passed.\n");
