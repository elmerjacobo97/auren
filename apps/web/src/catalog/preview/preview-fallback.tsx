import type { PreviewUnavailableReason } from "./preview-project.js";

export interface PreviewUnavailableProps {
  readonly reason?: PreviewUnavailableReason | "runtime-failure";
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
};

export function PreviewUnavailable({
  reason = "runtime-failure",
}: PreviewUnavailableProps) {
  return (
    <div
      aria-live="polite"
      className="flex min-h-64 min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[#9eb0a0] bg-[#edf3e9] p-6 text-center dark:border-slate-700 dark:bg-slate-900"
      data-preview-status="unavailable"
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
          {reasonCopy[reason]}
        </p>
        <p className="mt-3 text-xs leading-5 text-[#63786a] dark:text-slate-500">
          The validated metadata, dependencies, source, and install command
          remain available below.
        </p>
      </div>
    </div>
  );
}
