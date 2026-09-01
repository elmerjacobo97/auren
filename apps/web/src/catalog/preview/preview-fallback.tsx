import { useEffect } from "react";
import type { PreviewUnavailableReason } from "./preview-project.js";
import type {
  PreviewDiagnostic,
  PreviewFailureCategory,
} from "@auren/schemas/preview";
import { reportPreviewDiagnostic } from "./preview-diagnostics.js";

export interface PreviewUnavailableProps {
  readonly reason?:
    | PreviewUnavailableReason
    | "runtime-failure"
    | "missing-descriptor"
    | "unsupported-runtime"
    | "timeout"
    | undefined;
  readonly failureCategory?: PreviewFailureCategory | undefined;
  readonly failureMessage?: string | undefined;
  readonly externalUrl?: string | undefined;
  readonly contentId?: string | undefined;
  readonly identity?: string | undefined;
  readonly phase?: PreviewDiagnostic["phase"] | undefined;
  readonly runtime?: string | undefined;
}

const reasonCopy: Record<PreviewUnavailableProps["reason"] & string, string> = {
  "unsupported-framework":
    "Only React blocks are currently supported by the visual runner.",
  "missing-component": "The block does not include a component.tsx entry file.",
  "missing-content":
    "The block detail did not include complete source content.",
  "unsupported-asset":
    "This block includes an asset the visual runner will not execute.",
  "unsupported-file":
    "One of the block files is outside the supported preview subset.",
  "unresolved-dependency":
    "The preview cannot provide every declared dependency safely.",
  "unsupported-import":
    "The block uses an import shape the isolated runner cannot resolve.",
  "missing-export": "The component has no unambiguous renderable export.",
  "required-props":
    "The component requires runtime props that the catalog cannot provide.",
  "runtime-failure":
    "The isolated runner reported a compile or runtime failure.",
  "missing-descriptor":
    "This catalog version has no compatible published preview yet.",
  "unsupported-runtime":
    "This preview runtime is not registered in the Web application.",
  timeout: "The isolated preview exceeded its time limit and was stopped.",
  "resource-limit": "This preview exceeds the isolated runner resource limits.",
  "disallowed-dependency":
    "This preview declares a dependency outside the approved execution policy.",
};

export function PreviewUnavailable({
  reason = "runtime-failure",
  failureCategory,
  failureMessage,
  externalUrl,
  contentId,
  identity,
  phase = "runtime",
  runtime,
}: PreviewUnavailableProps) {
  useEffect(() => {
    reportPreviewDiagnostic({
      category: failureCategory ?? categoryForReason(reason),
      contentId,
      identity,
      message: failureMessage ?? reasonCopy[reason],
      phase,
      runtime,
    });
  }, [
    contentId,
    failureCategory,
    failureMessage,
    identity,
    phase,
    reason,
    runtime,
  ]);

  return (
    <div
      aria-live="polite"
      className="flex min-h-64 min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#9eb0a0] bg-[#edf3e9] p-6 text-center dark:border-slate-700 dark:bg-slate-900"
      data-preview-status="unavailable"
      data-preview-failure-category={failureCategory}
      role="status"
    >
      <div className="max-w-md min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52705b] dark:text-lime-300">
          Isolated preview
        </p>
        <h3 className="mt-2 font-serif text-2xl font-semibold text-[#17231d] dark:text-white">
          Preview unavailable
        </h3>
        <p className="mt-2 break-words text-sm leading-6 text-[#63786a] dark:text-slate-400">
          {failureMessage ?? reasonCopy[reason]}
        </p>
        <p className="mt-3 text-xs leading-5 text-[#63786a] dark:text-slate-500">
          The validated metadata, dependencies, source, and install command
          remain available below.
        </p>
        {externalUrl ? (
          <a
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md border border-[#52705b] px-4 py-2 text-sm font-bold text-[#355642] underline-offset-4 hover:bg-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52705b] dark:border-lime-300 dark:text-lime-200 dark:hover:bg-slate-800 dark:focus-visible:outline-lime-300"
            href={externalUrl}
            referrerPolicy="no-referrer"
            rel="noopener noreferrer"
            target="_blank"
          >
            Open external preview
          </a>
        ) : null}
      </div>
    </div>
  );
}

function categoryForReason(
  reason: NonNullable<PreviewUnavailableProps["reason"]>,
): PreviewFailureCategory {
  switch (reason) {
    case "unsupported-asset":
      return "asset";
    case "timeout":
      return "timeout";
    case "runtime-failure":
      return "runtime";
    default:
      return "unsupported";
  }
}
