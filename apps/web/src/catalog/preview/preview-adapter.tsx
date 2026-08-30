import {
  Component,
  Suspense,
  lazy,
  type ComponentType,
  type ReactNode,
} from "react";
import type { CatalogElement } from "@auren/schemas/catalog";
import {
  createPreviewProject,
  type PreviewProject,
} from "./preview-project.js";
import { PreviewUnavailable } from "./preview-fallback.js";

export interface PreviewRuntimeProps {
  readonly project: PreviewProject;
}

export type PreviewRuntime = ComponentType<PreviewRuntimeProps>;

export interface PreviewAdapterProps {
  readonly block: CatalogElement;
  readonly runtime?: PreviewRuntime;
}

const LazyPreviewRuntime = lazy(async () => {
  const module = await import("./sandpack-preview-runtime.js");
  return { default: module.SandpackPreviewRuntime };
});

export function PreviewAdapter({ block, runtime }: PreviewAdapterProps) {
  const result = createPreviewProject(block);

  if (result.status === "unsupported") {
    return <PreviewUnavailable reason={result.reason} />;
  }

  const PreviewRuntimeComponent = runtime ?? LazyPreviewRuntime;

  return (
    <PreviewErrorBoundary
      fallback={<PreviewUnavailable reason="runtime-failure" />}
    >
      <Suspense fallback={<PreviewLoading />}>
        <PreviewRuntimeComponent project={result.project} />
      </Suspense>
    </PreviewErrorBoundary>
  );
}

function PreviewLoading() {
  return (
    <div
      aria-live="polite"
      className="flex min-h-64 items-center justify-center overflow-hidden rounded-2xl border border-[#ccd7cc] bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900"
      data-preview-status="loading"
      role="status"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52705b] dark:text-lime-300">
          Isolated preview
        </p>
        <p className="mt-2 font-serif text-2xl font-semibold text-[#17231d] dark:text-white">
          Starting the visual runner…
        </p>
      </div>
    </div>
  );
}

interface PreviewErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
}

interface PreviewErrorBoundaryState {
  readonly hasError: boolean;
}

class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  override state: PreviewErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PreviewErrorBoundaryState {
    return { hasError: true };
  }

  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
