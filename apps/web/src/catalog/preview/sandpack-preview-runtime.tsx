import {
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { PreviewUnavailable } from "./preview-fallback.js";
import type { PreviewProject } from "./preview-project.js";

export interface SandpackPreviewRuntimeProps {
  readonly project: PreviewProject;
}

export function SandpackPreviewRuntime({
  project,
}: SandpackPreviewRuntimeProps) {
  return (
    <SandpackProvider
      customSetup={{ dependencies: project.dependencies }}
      files={project.files}
      options={{
        autorun: true,
        initMode: "lazy",
        recompileMode: "delayed",
      }}
      template="react-ts"
    >
      <SandpackPreviewState />
    </SandpackProvider>
  );
}

function SandpackPreviewState() {
  const { sandpack } = useSandpack();

  if (sandpack.error !== null || sandpack.status === "timeout") {
    return <PreviewUnavailable reason="runtime-failure" />;
  }

  return (
    <div
      className="min-w-0 overflow-hidden rounded-2xl border border-[#ccd7cc] bg-white dark:border-slate-800 dark:bg-slate-900"
      data-preview-status="ready"
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
    </div>
  );
}
