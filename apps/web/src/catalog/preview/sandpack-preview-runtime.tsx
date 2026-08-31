import {
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { useEffect, useState } from "react";
import { PreviewUnavailable } from "./preview-fallback.js";
import type { PreviewProject } from "./preview-project.js";

const PREVIEW_TIMEOUT_MS = 30_000;

export interface SandpackPreviewRuntimeProps {
  readonly project: PreviewProject;
}

export function SandpackPreviewRuntime({
  project,
}: SandpackPreviewRuntimeProps) {
  return (
    <SandpackProvider
      customSetup={{
        dependencies: project.dependencies,
        entry: project.entry,
      }}
      files={project.files}
      options={{
        autorun: true,
        initMode: "lazy",
        recompileMode: "delayed",
      }}
      template="vite-react-ts"
    >
      <SandpackPreviewState />
    </SandpackProvider>
  );
}

function SandpackPreviewState() {
  const { sandpack, listen } = useSandpack();
  const [runtimeState, setRuntimeState] = useState<
    "loading" | "ready" | "failure"
  >("loading");

  useEffect(() => {
    const unsubscribe = listen((message) => {
      if (message.type === "start" && message.firstLoad === true) {
        setRuntimeState("loading");
      }

      if (message.type === "action") {
        setRuntimeState("failure");
      }

      if (message.type === "done") {
        setRuntimeState(message.compilatonError ? "failure" : "ready");
      }
    });

    return unsubscribe;
  }, [listen]);

  useEffect(() => {
    if (runtimeState !== "loading") {
      return;
    }

    const timeout = window.setTimeout(
      () => setRuntimeState("failure"),
      PREVIEW_TIMEOUT_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [runtimeState]);

  useEffect(() => {
    if (sandpack.status === "initial" || sandpack.status === "idle") {
      setRuntimeState("loading");
    }
  }, [sandpack.status]);

  if (
    sandpack.error !== null ||
    sandpack.status === "timeout" ||
    runtimeState === "failure"
  ) {
    return <PreviewUnavailable reason="runtime-failure" />;
  }

  const isReady = runtimeState === "ready";

  return (
    <div
      aria-busy={!isReady}
      className="relative min-w-0 overflow-hidden rounded-2xl border border-[#ccd7cc] bg-white dark:border-slate-800 dark:bg-slate-900"
      data-preview-status={isReady ? "ready" : "loading"}
    >
      <SandpackPreview
        showNavigator={false}
        showOpenInCodeSandbox={false}
        showOpenNewtab={false}
        showRefreshButton={false}
        showRestartButton={false}
        showSandpackErrorOverlay={false}
        style={{ minHeight: "20rem", width: "100%" }}
      />
      {!isReady ? (
        <div
          aria-live="polite"
          className="absolute inset-0 flex min-h-64 min-w-0 items-center justify-center bg-white/95 p-6 text-center dark:bg-slate-900/95"
          role="status"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52705b] dark:text-lime-300">
              Isolated preview
            </p>
            <p className="mt-2 font-serif text-2xl font-semibold text-[#17231d] dark:text-white">
              Rendering the block…
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
