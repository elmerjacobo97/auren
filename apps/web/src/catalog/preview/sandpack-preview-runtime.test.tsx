/** @vitest-environment happy-dom */

import { forwardRef, type ReactNode, useImperativeHandle } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PreviewProject } from "./preview-project.js";

const { providerProps, sandpackState } = vi.hoisted(() => ({
  providerProps: vi.fn(),
  sandpackState: {
    error: null as unknown,
    listener: undefined as
      | ((message: {
          type: string;
          firstLoad?: boolean;
          compilatonError?: boolean;
        }) => void)
      | undefined,
    status: "running" as string,
  },
}));

vi.mock("@codesandbox/sandpack-react", () => ({
  SandpackPreview: forwardRef((_, ref) => {
    useImperativeHandle(ref, () => ({
      clientId: "preview",
      getClient: () => null,
    }));
    return (
      <div data-testid="sandpack-preview">
        <iframe title="Sandpack Preview" />
      </div>
    );
  }),
  SandpackProvider: ({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => {
    providerProps(props);
    return <>{children}</>;
  },
  useSandpack: () => ({
    listen: (listener: typeof sandpackState.listener) => {
      sandpackState.listener = listener;
      return () => {
        if (sandpackState.listener === listener) {
          sandpackState.listener = undefined;
        }
      };
    },
    sandpack: sandpackState,
  }),
}));

import { SandpackPreviewRuntime } from "./sandpack-preview-runtime.js";

const project: PreviewProject = {
  runtime: "react-vite-tailwind-4",
  entry: "/index.tsx",
  files: {
    "/index.tsx": {
      code: "export default function Preview() { return null; }",
    },
    "/index.html": {
      code: "export default {};",
    },
    "/vite.config.ts": {
      code: "export default {};",
    },
  },
  dependencies: {
    "@tailwindcss/browser": "4.3.3",
    "@vitejs/plugin-react": "6.1.1",
    react: "19.2.8",
    "react-dom": "19.2.8",
    tailwindcss: "4.3.3",
    vite: "8.2.2",
  },
  input: { kind: "empty" },
};

beforeEach(() => {
  providerProps.mockClear();
  sandpackState.error = null;
  sandpackState.listener = undefined;
  sandpackState.status = "running";
});

afterEach(() => {
  cleanup();
});

describe("SandpackPreviewRuntime", () => {
  it("passes the generated entry and dependencies to Sandpack", () => {
    render(<SandpackPreviewRuntime project={project} />);

    act(() => {
      sandpackState.listener?.({ type: "done", compilatonError: false });
    });

    expect(
      screen
        .getByTestId("sandpack-preview")
        .parentElement?.getAttribute("data-preview-status"),
    ).toBe("loading");

    act(() => {
      const frame = screen.getByTitle("Sandpack Preview");

      if (!(frame instanceof HTMLIFrameElement)) {
        throw new Error("Expected a preview iframe");
      }

      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "auren-preview-ready" },
          source: frame.contentWindow,
        }),
      );
    });

    expect(providerProps).toHaveBeenCalledWith(
      expect.objectContaining({
        customSetup: {
          dependencies: {
            "@tailwindcss/browser": "4.3.3",
            react: "19.2.8",
            "react-dom": "19.2.8",
            tailwindcss: "4.3.3",
          },
          devDependencies: {},
          entry: project.entry,
        },
      }),
    );
    expect(providerProps).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.not.objectContaining({
          "/vite.config.ts": expect.anything(),
        }),
      }),
    );
    expect(
      screen
        .getByTestId("sandpack-preview")
        .parentElement?.getAttribute("data-preview-status"),
    ).toBe("ready");
  });

  it("shows loading until Sandpack finishes bundling", () => {
    render(<SandpackPreviewRuntime project={project} />);

    expect(
      screen
        .getByTestId("sandpack-preview")
        .parentElement?.getAttribute("data-preview-status"),
    ).toBe("loading");
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByTestId("sandpack-preview")).toBeTruthy();
  });

  it("shows the runtime fallback on timeout", () => {
    sandpackState.status = "timeout";

    render(<SandpackPreviewRuntime project={project} />);

    expect(screen.getByText("Preview unavailable")).toBeTruthy();
    expect(screen.queryByTestId("sandpack-preview")).toBeNull();
  });

  it("shows the runtime fallback when the preview reports an error", () => {
    render(<SandpackPreviewRuntime project={project} />);

    act(() => {
      sandpackState.listener?.({ type: "action" });
    });

    expect(screen.getByText("Preview unavailable")).toBeTruthy();
  });
});
