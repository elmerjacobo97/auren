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
    return <div data-testid="sandpack-preview" />;
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
  entry: "/index.tsx",
  files: {
    "/index.tsx": {
      code: "export default function Preview() { return null; }",
    },
  },
  dependencies: { tailwindcss: "4.3.3" },
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

    expect(providerProps).toHaveBeenCalledWith(
      expect.objectContaining({
        customSetup: {
          dependencies: project.dependencies,
          entry: project.entry,
        },
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
