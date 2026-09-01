import {
  Component,
  Suspense,
  lazy,
  type ComponentType,
  type ReactNode,
} from "react";
import type { CatalogElement } from "@auren/schemas/catalog";
import type {
  PreviewDescriptor,
  PreviewFailureCategory,
} from "@auren/schemas/preview";
import { PreviewUnavailable } from "./preview-fallback.js";
import {
  type PreviewRuntime,
  type PreviewRuntimeProps,
  selectPreviewRuntime,
} from "./preview-runtime-adapters.js";
import { createPreviewProject } from "./preview-project.js";

export type {
  PreviewRuntime,
  PreviewRuntimeProps,
} from "./preview-runtime-adapters.js";

export interface PreviewAdapterProps {
  readonly block: CatalogElement;
  readonly runtime?: PreviewRuntime;
  readonly descriptor?: PreviewDescriptor;
}

export function PreviewAdapter({
  block,
  descriptor = block.preview,
  runtime,
}: PreviewAdapterProps) {
  if (descriptor === undefined) {
    if (runtime === undefined) {
      return (
        <PreviewUnavailable
          contentId={block.id}
          phase="runtime"
          reason="missing-descriptor"
        />
      );
    }

    return renderRuntime(
      runtime,
      createPreviewProject(block),
      undefined,
      block.id,
    );
  }

  if (descriptor.status !== "ready") {
    return (
      <PreviewUnavailable
        contentId={descriptor.contentId}
        externalUrl={descriptor.livePreview?.url}
        failureCategory={descriptor.failure?.category}
        failureMessage={descriptor.failure?.message}
        identity={descriptor.identity}
        phase="build"
        reason={reasonForDescriptor(descriptor.failure?.category)}
        runtime={descriptor.runtime}
      />
    );
  }

  if (descriptor.delivery === "external") {
    return <ExternalPreview descriptor={descriptor} />;
  }

  const adapter = selectPreviewRuntime(descriptor);

  if (adapter === undefined) {
    return (
      <PreviewUnavailable
        contentId={descriptor.contentId}
        failureCategory="unsupported"
        identity={descriptor.identity}
        phase="runtime"
        reason="unsupported-runtime"
        runtime={descriptor.runtime}
      />
    );
  }

  const result = adapter.createProject(block, descriptor);

  if (result.status === "unsupported") {
    return (
      <PreviewUnavailable
        contentId={block.id}
        phase="runtime"
        reason={result.reason}
      />
    );
  }

  const PreviewRuntimeComponent =
    runtime ??
    lazy(async () => ({
      default: await adapter.loadRuntime(),
    }));

  return renderRuntime(PreviewRuntimeComponent, result, descriptor, block.id);
}

function renderRuntime(
  PreviewRuntimeComponent: ComponentType<PreviewRuntimeProps>,
  result: ReturnType<typeof createPreviewProject>,
  descriptor?: PreviewDescriptor,
  contentId?: string,
) {
  if (result.status === "unsupported") {
    return (
      <PreviewUnavailable
        contentId={contentId}
        identity={descriptor?.identity}
        phase="runtime"
        reason={result.reason}
        runtime={descriptor?.runtime}
      />
    );
  }

  return (
    <PreviewErrorBoundary
      fallback={
        <PreviewUnavailable
          contentId={contentId}
          failureCategory="runtime"
          identity={descriptor?.identity}
          phase="runtime"
          reason="runtime-failure"
          runtime={descriptor?.runtime}
        />
      }
    >
      <Suspense fallback={<PreviewLoading />}>
        <PreviewRuntimeComponent
          descriptor={descriptor}
          project={result.project}
        />
      </Suspense>
    </PreviewErrorBoundary>
  );
}

function ExternalPreview({
  descriptor,
}: {
  readonly descriptor: PreviewDescriptor;
}) {
  const livePreview = descriptor.livePreview;

  if (livePreview === undefined) {
    return (
      <PreviewUnavailable
        contentId={descriptor.contentId}
        failureCategory="provider"
        identity={descriptor.identity}
        phase="provider"
        reason="runtime-failure"
        runtime={descriptor.runtime}
      />
    );
  }

  return (
    <section
      aria-labelledby="external-preview-heading"
      className="min-w-0 overflow-hidden rounded-2xl border border-[#ccd7cc] bg-white dark:border-slate-800 dark:bg-slate-900"
      data-preview-delivery="external"
      data-preview-status="ready"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e3e9e0] p-5 dark:border-slate-800">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52705b] dark:text-lime-300">
            External preview
          </p>
          <h3
            className="mt-2 font-serif text-2xl font-semibold text-[#17231d] dark:text-white"
            id="external-preview-heading"
          >
            Complete runtime available
          </h3>
        </div>
        <a
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#d6ff57] px-4 py-2.5 text-sm font-bold text-[#12221c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52705b] motion-reduce:transition-none"
          href={livePreview.url}
          referrerPolicy="no-referrer"
          rel="noopener noreferrer"
          target="_blank"
        >
          Open live preview
        </a>
      </div>
      {livePreview.embedding === "allowed" ? (
        <iframe
          className="block min-h-[28rem] w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-forms allow-scripts"
          src={livePreview.url}
          title="External live preview"
        />
      ) : (
        <p className="p-5 text-sm leading-6 text-[#63786a] dark:text-slate-400">
          This runtime does not permit embedding. Open the live preview in a new
          tab to view it.
        </p>
      )}
    </section>
  );
}

function reasonForDescriptor(
  category: PreviewFailureCategory | undefined,
): NonNullable<Parameters<typeof PreviewUnavailable>[0]["reason"]> {
  switch (category) {
    case "asset":
      return "unsupported-asset";
    case "unsupported":
      return "unsupported-runtime";
    case "timeout":
      return "timeout";
    default:
      return "runtime-failure";
  }
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

  override componentDidCatch(error: Error) {
    console.error("Preview runtime failure", error);
  }

  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
