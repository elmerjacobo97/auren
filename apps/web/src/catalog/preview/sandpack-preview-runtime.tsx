import {
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { useEffect, useRef, useState } from "react";
import type { PreviewDescriptor } from "@auren/schemas/preview";
import { PreviewUnavailable } from "./preview-fallback.js";
import type { PreviewRuntimeProps } from "./preview-runtime-adapters.js";
import { previewExecutionPolicy } from "./preview-policy.js";

export type SandpackPreviewRuntimeProps = PreviewRuntimeProps;

const SANDPACK_BUILD_DEPENDENCIES = new Set(["@vitejs/plugin-react", "vite"]);
const PREVIEW_READY_MESSAGE = "auren-preview-ready";

export function SandpackPreviewRuntime({
  project,
  descriptor,
}: SandpackPreviewRuntimeProps) {
  const dependencies = Object.fromEntries(
    Object.entries(project.dependencies).filter(
      ([name]) => !SANDPACK_BUILD_DEPENDENCIES.has(name),
    ),
  );
  const files = Object.fromEntries(
    Object.entries(project.files).filter(
      ([path]) => path !== "/vite.config.ts",
    ),
  );

  return (
    <SandpackProvider
      customSetup={{
        dependencies,
        devDependencies: {},
        entry: project.entry,
      }}
      files={files}
      options={{
        autorun: true,
        initMode: "lazy",
        recompileMode: "delayed",
      }}
      template="vite-react-ts"
    >
      <SandpackPreviewState descriptor={descriptor} />
    </SandpackProvider>
  );
}

function SandpackPreviewState({
  descriptor,
}: {
  readonly descriptor?: PreviewDescriptor | undefined;
}) {
  const { sandpack, listen } = useSandpack();
  const [runtimeState, setRuntimeState] = useState<RuntimeState>({
    status: "loading",
  });

  useEffect(() => {
    const unsubscribe = listen((message) => {
      if (message.type === "start" && message.firstLoad === true) {
        setRuntimeState({ status: "loading" });
      }

      if (message.type === "action") {
        setRuntimeState({ status: "failure", category: "runtime" });
      }

      if (message.type === "done") {
        if (message.compilatonError) {
          setRuntimeState({ status: "failure", category: "build" });
        }
      }
    });

    return unsubscribe;
  }, [listen]);

  useEffect(() => {
    if (runtimeState.status !== "loading") {
      return;
    }

    const timeout = window.setTimeout(
      () => setRuntimeState({ status: "failure", category: "timeout" }),
      previewExecutionPolicy.timeoutMs,
    );

    return () => window.clearTimeout(timeout);
  }, [runtimeState]);

  useEffect(() => {
    if (sandpack.status === "initial" || sandpack.status === "idle") {
      setRuntimeState({ status: "loading" });
    }
  }, [sandpack.status]);

  const previewHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previewHost = previewHostRef.current;

    if (previewHost === null) {
      return;
    }

    let previewFrame: HTMLIFrameElement | null = null;

    const handleMessage = (event: MessageEvent) => {
      if (
        event.source !== previewFrame?.contentWindow ||
        !isPreviewReadyMessage(event.data)
      ) {
        return;
      }

      setRuntimeState({ status: "ready" });
    };

    const attachPreviewFrame = () => {
      const nextFrame = previewHost.querySelector("iframe");

      if (
        !(nextFrame instanceof HTMLIFrameElement) ||
        nextFrame === previewFrame
      ) {
        return;
      }

      nextFrame.setAttribute("referrerpolicy", "no-referrer");
      nextFrame.setAttribute("sandbox", "allow-scripts allow-same-origin");
      nextFrame.setAttribute("data-preview-isolated", "true");
      previewFrame = nextFrame;
    };

    attachPreviewFrame();
    window.addEventListener("message", handleMessage);
    const observer = new MutationObserver(attachPreviewFrame);
    observer.observe(previewHost, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  if (
    sandpack.error !== null ||
    sandpack.status === "timeout" ||
    runtimeState.status === "failure"
  ) {
    return (
      <PreviewUnavailable
        contentId={descriptor?.contentId}
        failureCategory={
          sandpack.status === "timeout"
            ? "timeout"
            : runtimeState.status === "failure"
              ? runtimeState.category
              : "runtime"
        }
        reason={
          sandpack.status === "timeout" ||
          (runtimeState.status === "failure" &&
            runtimeState.category === "timeout")
            ? "timeout"
            : "runtime-failure"
        }
        identity={descriptor?.identity}
        phase="runtime"
        runtime={descriptor?.runtime}
      />
    );
  }

  const isReady = runtimeState.status === "ready";

  return (
    <div
      aria-busy={!isReady}
      className="relative min-w-0 overflow-hidden rounded-2xl border border-[#ccd7cc] bg-white dark:border-slate-800 dark:bg-slate-900"
      data-preview-identity={descriptor?.identity}
      data-preview-status={isReady ? "ready" : "loading"}
      data-preview-runtime={descriptor?.runtime}
      data-preview-isolated="true"
      ref={previewHostRef}
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

function isPreviewReadyMessage(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === PREVIEW_READY_MESSAGE
  );
}

type RuntimeState =
  | { readonly status: "loading" }
  | { readonly status: "ready" }
  | {
      readonly status: "failure";
      readonly category: "build" | "runtime" | "timeout";
    };
