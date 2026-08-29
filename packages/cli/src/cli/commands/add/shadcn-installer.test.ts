import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { PassThrough } from "node:stream";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InvalidShadcnComponentError,
  type ShadcnInstallerUnavailableError,
  type ShadcnProcessError,
  installShadcnComponents,
} from "./shadcn-installer.js";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));

const spawnMock = vi.mocked(spawn);
const components = ["button", "dialog"] as const;

function createChild(): ChildProcess {
  return Object.assign(new EventEmitter(), {
    stderr: new PassThrough(),
  }) as unknown as ChildProcess;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("installShadcnComponents", () => {
  it.each([
    [
      "npm",
      "npx",
      ["--yes", "shadcn@latest", "add", "--yes", "button", "dialog"],
    ],
    [
      "pnpm",
      "pnpm",
      ["dlx", "shadcn@latest", "add", "--yes", "button", "dialog"],
    ],
    [
      "yarn",
      "yarn",
      ["dlx", "shadcn@latest", "add", "--yes", "button", "dialog"],
    ],
    [
      "bun",
      "bunx",
      ["--bun", "shadcn@latest", "add", "--yes", "button", "dialog"],
    ],
  ] as const)(
    "uses %s with one non-interactive invocation",
    async (packageManager, executable, args) => {
      const child = createChild();
      spawnMock.mockReturnValue(child);

      const resultPromise = installShadcnComponents({
        projectDir: "/consumer",
        packageManager,
        components,
      });
      child.emit("close", 0, null);

      await expect(resultPromise).resolves.toEqual({ components });
      expect(spawnMock).toHaveBeenCalledTimes(1);
      expect(spawnMock).toHaveBeenCalledWith(executable, args, {
        cwd: "/consumer",
        shell: false,
        stdio: ["ignore", "ignore", "pipe"],
      });
    },
  );

  it("does not spawn for an empty component list", async () => {
    await expect(
      installShadcnComponents({
        projectDir: "/consumer",
        packageManager: "npm",
        components: [],
      }),
    ).resolves.toEqual({ components: [] });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("reports a non-zero exit and concise stderr", async () => {
    const child = createChild();
    spawnMock.mockReturnValue(child);
    const resultPromise = installShadcnComponents({
      projectDir: "/consumer",
      packageManager: "pnpm",
      components: ["button"],
    });
    (child.stderr as PassThrough).write("registry unavailable\nsecond line\n");
    child.emit("close", 2, null);

    await expect(resultPromise).rejects.toEqual(
      expect.objectContaining({
        name: "ShadcnProcessError",
        packageManager: "pnpm",
        components: ["button"],
        exitCode: 2,
        stderr: "registry unavailable\nsecond line\n",
      } satisfies Partial<ShadcnProcessError>),
    );
    await expect(resultPromise).rejects.toThrow("registry unavailable");
  });

  it("reports an unavailable executable", async () => {
    const child = createChild();
    spawnMock.mockReturnValue(child);
    const resultPromise = installShadcnComponents({
      projectDir: "/consumer",
      packageManager: "bun",
      components: ["button"],
    });
    child.emit("error", new Error("spawn bunx ENOENT"));

    await expect(resultPromise).rejects.toEqual(
      expect.objectContaining({
        name: "ShadcnInstallerUnavailableError",
        packageManager: "bun",
        components: ["button"],
      } satisfies Partial<ShadcnInstallerUnavailableError>),
    );
  });

  it("rejects unsafe component arguments before spawning", async () => {
    await expect(
      installShadcnComponents({
        projectDir: "/consumer",
        packageManager: "npm",
        components: ["--overwrite"],
      }),
    ).rejects.toBeInstanceOf(InvalidShadcnComponentError);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("never adds an overwrite flag", async () => {
    const child = createChild();
    spawnMock.mockReturnValue(child);
    const resultPromise = installShadcnComponents({
      projectDir: "/consumer",
      packageManager: "npm",
      components: ["button"],
    });
    child.emit("close", 0, null);
    await resultPromise;

    const args = spawnMock.mock.calls[0]?.[1];
    expect(args).not.toContain("--overwrite");
  });
});
