import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { PassThrough } from "node:stream";
import { spawn } from "node:child_process";
import type { PackageDependency } from "@auren/core/dependencies";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InvalidPackageRequirementError,
  installPackages,
  type PackageManagerProcessError,
  type PackageManagerUnavailableError,
} from "./package-installer.js";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

const spawnMock = vi.mocked(spawn);
const packages: readonly PackageDependency[] = [
  { name: "motion", version: "^12.0.0" },
  { name: "lucide-react", version: "^0.468.0" },
];

function createChild(): ChildProcess {
  return Object.assign(new EventEmitter(), {
    stderr: new PassThrough(),
  }) as unknown as ChildProcess;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("installPackages", () => {
  it.each([
    ["npm", "npm", "install"],
    ["pnpm", "pnpm", "add"],
    ["yarn", "yarn", "add"],
    ["bun", "bun", "add"],
  ] as const)(
    "uses %s with one invocation for all packages",
    async (packageManager, executable, subcommand) => {
      const child = createChild();
      spawnMock.mockReturnValue(child);

      const resultPromise = installPackages({
        projectDir: "/consumer",
        packageManager,
        packages,
      });
      child.emit("close", 0, null);

      await expect(resultPromise).resolves.toEqual({ packages });
      expect(spawnMock).toHaveBeenCalledTimes(1);
      expect(spawnMock).toHaveBeenCalledWith(
        executable,
        [subcommand, "--", "motion@^12.0.0", "lucide-react@^0.468.0"],
        {
          cwd: "/consumer",
          shell: false,
          stdio: ["ignore", "ignore", "pipe"],
        },
      );
    },
  );

  it("does not spawn for an empty package list", async () => {
    await expect(
      installPackages({
        projectDir: "/consumer",
        packageManager: "npm",
        packages: [],
      }),
    ).resolves.toEqual({ packages: [] });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("reports a non-zero package-manager exit and stderr", async () => {
    const child = createChild();
    spawnMock.mockReturnValue(child);
    const resultPromise = installPackages({
      projectDir: "/consumer",
      packageManager: "pnpm",
      packages: [packages[0]],
    });
    (child.stderr as PassThrough).write("registry unavailable\n");
    child.emit("close", 2, null);

    await expect(resultPromise).rejects.toMatchObject({
      name: "PackageManagerProcessError",
      packageManager: "pnpm",
      exitCode: 2,
      stderr: "registry unavailable\n",
    } satisfies Partial<PackageManagerProcessError>);
  });

  it("reports an unavailable executable", async () => {
    const child = createChild();
    spawnMock.mockReturnValue(child);
    const resultPromise = installPackages({
      projectDir: "/consumer",
      packageManager: "bun",
      packages: [packages[0]],
    });
    child.emit("error", new Error("spawn bun ENOENT"));

    await expect(resultPromise).rejects.toMatchObject({
      name: "PackageManagerUnavailableError",
      packageManager: "bun",
      packages: [packages[0]],
    } satisfies Partial<PackageManagerUnavailableError>);
  });

  it("rejects unsafe package arguments before spawning", async () => {
    await expect(
      installPackages({
        projectDir: "/consumer",
        packageManager: "npm",
        packages: [{ name: "--help", version: "^1.0.0" }],
      }),
    ).rejects.toBeInstanceOf(InvalidPackageRequirementError);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
