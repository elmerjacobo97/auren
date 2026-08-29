import { readFileSync } from "node:fs";
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
  const result = spawnSync(process.execPath, [entrypoint, ...args], {
    cwd: packageRoot,
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

const version = runCli("--version");

if (version.stdout !== `${manifest.version}${"\n"}`) {
  throw new Error("Built CLI version did not match package.json");
}

if (version.stderr !== "") {
  throw new Error("Built CLI version wrote to stderr");
}

process.stdout.write("CLI distribution verification passed.\n");
