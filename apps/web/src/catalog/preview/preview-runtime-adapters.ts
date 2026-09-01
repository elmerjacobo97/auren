import type { ComponentType } from "react";
import type { CatalogElement } from "@auren/schemas/catalog";
import type { PreviewDescriptor } from "@auren/schemas/preview";
import {
  createPreviewProject,
  type PreviewProject,
  type PreviewProjectResult,
  REACT_PREVIEW_RUNTIME,
} from "./preview-project.js";

export interface PreviewRuntimeProps {
  readonly project: PreviewProject;
  readonly descriptor?: PreviewDescriptor | undefined;
}

export type PreviewRuntime = ComponentType<PreviewRuntimeProps>;

export interface PreviewRuntimeAdapter {
  readonly framework: string;
  readonly key: string;
  readonly delivery: "inline";
  readonly createProject: (
    block: CatalogElement,
    descriptor: PreviewDescriptor,
  ) => PreviewProjectResult;
  readonly loadRuntime: () => Promise<PreviewRuntime>;
}

const reactPreviewRuntimeAdapter: PreviewRuntimeAdapter = {
  framework: "react",
  key: REACT_PREVIEW_RUNTIME,
  delivery: "inline",
  createProject: (block, descriptor) => createPreviewProject(block, descriptor),
  loadRuntime: async () => {
    const module = await import("./sandpack-preview-runtime.js");
    return module.SandpackPreviewRuntime;
  },
};

export const previewRuntimeAdapters: readonly PreviewRuntimeAdapter[] = [
  reactPreviewRuntimeAdapter,
];

export function selectPreviewRuntime(
  descriptor: PreviewDescriptor,
): PreviewRuntimeAdapter | undefined {
  return previewRuntimeAdapters.find(
    (adapter) =>
      adapter.framework === descriptor.framework &&
      adapter.key === descriptor.runtime &&
      adapter.delivery === descriptor.delivery,
  );
}
