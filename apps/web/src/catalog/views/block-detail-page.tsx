import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { CatalogElement } from "@auren/schemas/catalog";
import { BlockPlayground } from "../components/block-playground.js";
import { CatalogLoadingState } from "../components/catalog-loading-state.js";
import { CatalogUnavailableState } from "../components/catalog-unavailable-state.js";
import { CatalogClassificationList } from "../components/catalog-classification-list.js";
import {
  useBlockDetail,
  type BlockDetailViewState,
} from "../hooks/use-block-detail.js";

export interface BlockDetailPageProps {
  readonly id: string;
}

export function BlockDetailPage({ id }: BlockDetailPageProps) {
  const { state, retryIndex, retryDetail } = useBlockDetail(id);

  if (state.status === "index-loading") {
    return <CatalogLoadingState />;
  }

  if (state.status === "index-error") {
    return <CatalogUnavailableState onRetry={retryIndex} />;
  }

  if (state.status === "not-found") {
    return <BlockDetailNotFound id={state.id} />;
  }

  if (state.status === "detail-loading") {
    return <BlockDetailLoading id={state.indexedBlock.id} />;
  }

  if (state.status === "detail-error") {
    return (
      <BlockDetailErrorState
        error={state.error}
        id={state.indexedBlock.id}
        onRetry={retryDetail}
      />
    );
  }

  return <BlockDetailContent block={state.block} />;
}

function BlockDetailLoading({ id }: { readonly id: string }) {
  return (
    <div className="space-y-6">
      <BlockBackLink />
      <div
        aria-live="polite"
        className="rounded-2xl border border-[#cfd8cc] bg-white/70 p-6 shadow-[0_12px_40px_rgba(33,57,42,0.06)] dark:border-slate-800 dark:bg-slate-900/70"
        role="status"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52705b] dark:text-lime-300">
          Auren / block detail
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold text-[#17231d] dark:text-white">
          Loading {id}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#63786a] dark:text-slate-400">
          Fetching the validated source for this block. Nothing is rendered
          until the complete detail resource is checked.
        </p>
      </div>
    </div>
  );
}

function BlockDetailNotFound({ id }: { readonly id: string }) {
  return (
    <div className="space-y-6">
      <BlockBackLink />
      <section
        aria-labelledby="block-not-found-heading"
        className="rounded-2xl border border-dashed border-[#9eb0a0] bg-[#edf3e9] p-6 dark:border-slate-700 dark:bg-slate-900"
        role="status"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52705b] dark:text-lime-300">
          Catalog miss
        </p>
        <h1
          className="mt-2 font-serif text-3xl font-semibold text-[#17231d] dark:text-white"
          id="block-not-found-heading"
        >
          Block not found
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#63786a] dark:text-slate-400">
          No published block with the ID <code>{id}</code> exists in the
          validated Registry index.
        </p>
      </section>
    </div>
  );
}

interface BlockDetailErrorStateProps {
  readonly error: Extract<
    BlockDetailViewState,
    { readonly status: "detail-error" }
  >["error"];
  readonly id: string;
  readonly onRetry: () => void;
}

function BlockDetailErrorState({
  error,
  id,
  onRetry,
}: BlockDetailErrorStateProps) {
  const isInvalid = error.code === "invalid-detail";

  return (
    <div className="space-y-6">
      <BlockBackLink />
      <section
        aria-labelledby="block-detail-error-heading"
        className="rounded-2xl border border-[#d9b8a7] bg-[#fff8f3] p-6 shadow-[0_12px_40px_rgba(111,58,35,0.06)] dark:border-rose-900 dark:bg-rose-950/30"
        role="alert"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a85135] dark:text-rose-300">
          {isInvalid ? "Detail needs attention" : "Detail unavailable"}
        </p>
        <h1
          className="mt-2 font-serif text-3xl font-semibold text-[#4b261c] dark:text-rose-100"
          id="block-detail-error-heading"
        >
          Could not load {id}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#79584d] dark:text-rose-200/80">
          The Registry detail could not be validated completely. Try again for a
          fresh copy; no partial source or metadata is shown.
        </p>
        <button
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-[#4b261c] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#6b3325] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4b261c] motion-reduce:transition-none dark:bg-rose-200 dark:text-rose-950 dark:hover:bg-white dark:focus-visible:outline-rose-200"
          onClick={onRetry}
          type="button"
        >
          Retry detail
        </button>
      </section>
    </div>
  );
}

function BlockDetailContent({ block }: { readonly block: CatalogElement }) {
  return (
    <div className="min-w-0 space-y-8">
      <BlockBackLink />

      <header className="min-w-0 border-b border-[#ccd7cc] pb-8 dark:border-slate-800">
        <p className="truncate font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#52705b] dark:text-lime-300">
          {block.id}
        </p>
        <h1 className="mt-3 max-w-4xl break-words font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-[#17231d] sm:text-5xl lg:text-6xl dark:text-white">
          {block.name}
        </h1>
        <p className="mt-4 max-w-3xl break-words text-base leading-7 text-[#63786a] sm:text-lg dark:text-slate-400">
          {block.description}
        </p>
      </header>

      <BlockPlayground
        block={block}
        codePanel={<SourceSection block={block} />}
        installPanel={<InstallSection id={block.id} />}
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <MetadataSection block={block} />
        <DependenciesSection block={block} />
      </div>
    </div>
  );
}

function BlockBackLink() {
  return (
    <nav aria-label="Block detail navigation">
      <Link
        className="inline-flex min-h-10 items-center rounded-md px-2 py-2 text-sm font-bold text-[#52705b] underline decoration-[#a9bba9] underline-offset-4 hover:text-[#17231d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52705b] motion-reduce:transition-none dark:text-lime-300 dark:hover:text-white dark:focus-visible:outline-lime-300"
        to="/blocks"
      >
        ← Back to Blocks
      </Link>
    </nav>
  );
}

function MetadataSection({ block }: { readonly block: CatalogElement }) {
  return (
    <section
      aria-labelledby="block-metadata-heading"
      className="min-w-0 rounded-2xl border border-[#ccd7cc] bg-white p-5 shadow-[0_12px_40px_rgba(33,57,42,0.06)] dark:border-slate-800 dark:bg-slate-900"
    >
      <SectionHeading id="block-metadata-heading" title="Metadata" />
      <dl className="mt-5 grid min-w-0 gap-4 text-sm">
        <MetadataPair label="ID" value={block.id} mono />
        <MetadataPair label="Category" value={block.category} />
        <MetadataPair label="Type" value={block.type} />
        <MetadataPair label="Frameworks" value={block.frameworks.join(", ")} />
      </dl>
      <div className="mt-5 border-t border-[#e3e9e0] pt-4 dark:border-slate-800">
        <CatalogClassificationList label="Styles" values={block.styles} />
        <CatalogClassificationList
          label="Industries"
          values={block.industries}
        />
        <CatalogClassificationList label="Features" values={block.features} />
      </div>
      <div className="mt-5 border-t border-[#e3e9e0] pt-4 dark:border-slate-800">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#849787] dark:text-slate-500">
          JSON metadata
        </h3>
        <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[#f4f8f1] p-3 font-mono text-xs leading-5 text-[#354c3c] dark:bg-slate-950 dark:text-slate-300">
          {JSON.stringify(block.metadata, null, 2)}
        </pre>
      </div>
    </section>
  );
}

function MetadataPair({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#849787] dark:text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-1 min-w-0 break-words font-semibold text-[#17231d] dark:text-slate-100 ${mono ? "font-mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function DependenciesSection({ block }: { readonly block: CatalogElement }) {
  const packages = block.dependencies.filter(
    (dependency) => dependency.kind === "package",
  );
  const auren = block.dependencies.filter(
    (dependency) => dependency.kind === "auren",
  );
  const shadcn = block.dependencies.filter(
    (dependency) => dependency.kind === "shadcn",
  );

  return (
    <section
      aria-labelledby="block-dependencies-heading"
      className="min-w-0 rounded-2xl border border-[#ccd7cc] bg-white p-5 shadow-[0_12px_40px_rgba(33,57,42,0.06)] dark:border-slate-800 dark:bg-slate-900"
    >
      <SectionHeading id="block-dependencies-heading" title="Dependencies" />
      {block.dependencies.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-[#63786a] dark:text-slate-400">
          No dependencies declared.
        </p>
      ) : (
        <div className="mt-5 grid min-w-0 gap-5 sm:grid-cols-3">
          <DependencyGroup label="Packages">
            {packages.map((dependency) => (
              <li key={`${dependency.kind}-${dependency.name}`}>
                <code className="break-all">{dependency.name}</code>
                <span className="text-[#63786a] dark:text-slate-400">
                  {" "}
                  {dependency.version}
                </span>
              </li>
            ))}
          </DependencyGroup>
          <DependencyGroup label="Auren blocks">
            {auren.map((dependency) => (
              <li key={`${dependency.kind}-${dependency.id}`}>
                <code className="break-all">{dependency.id}</code>
              </li>
            ))}
          </DependencyGroup>
          <DependencyGroup label="shadcn/ui">
            {shadcn.map((dependency) => (
              <li key={`${dependency.kind}-${dependency.name}`}>
                <code className="break-all">{dependency.name}</code>
              </li>
            ))}
          </DependencyGroup>
        </div>
      )}
    </section>
  );
}

function DependencyGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#849787] dark:text-slate-500">
        {label}
      </h3>
      <ul className="mt-2 min-w-0 space-y-2 text-sm leading-6 text-[#354c3c] dark:text-slate-300">
        {children}
      </ul>
    </div>
  );
}

type ClipboardCopyState = "idle" | "copied" | "unsupported" | "failed";

function SourceSection({ block }: { readonly block: CatalogElement }) {
  return (
    <section
      aria-labelledby="block-source-heading"
      className="min-w-0 rounded-2xl border border-[#ccd7cc] bg-white p-5 shadow-[0_12px_40px_rgba(33,57,42,0.06)] dark:border-slate-800 dark:bg-slate-900"
    >
      <SectionHeading id="block-source-heading" title="Source" />
      <p className="mt-2 text-sm leading-6 text-[#63786a] dark:text-slate-400">
        Inspect the validated file inventory. Asset payloads are kept out of the
        executable source viewer.
      </p>
      <ul className="mt-5 min-w-0 space-y-3">
        {block.files.map((file) => (
          <li className="min-w-0" key={file.path}>
            <SourceFile file={file} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceFile({
  file,
}: {
  readonly file: CatalogElement["files"][number];
}) {
  const [copyState, setCopyState] = useState<ClipboardCopyState>("idle");
  const content = file.content;
  const canCopy = file.kind !== "asset" && typeof content === "string";

  async function copySource() {
    if (!canCopy || typeof content !== "string") {
      return;
    }

    const clipboard = globalThis.navigator?.clipboard;

    if (clipboard?.writeText === undefined) {
      setCopyState("unsupported");
      return;
    }

    try {
      await clipboard.writeText(content);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  const statusMessage =
    copyState === "copied"
      ? "Code copied."
      : copyState === "unsupported"
        ? "Clipboard access is not supported here; select the code to copy it."
        : copyState === "failed"
          ? "The code could not be copied; select it to copy manually."
          : "";

  return (
    <details
      className="group min-w-0 overflow-hidden rounded-xl border border-[#dce5d9] bg-[#fbfcf9] dark:border-slate-800 dark:bg-slate-950"
      open={file.path === "component.tsx"}
    >
      <summary className="flex min-h-12 min-w-0 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#17231d] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#52705b] dark:text-slate-100 dark:focus-visible:outline-lime-300">
        <span className="min-w-0 break-all font-mono">{file.path}</span>
        <span className="shrink-0 rounded-full bg-[#eaf2e5] px-2 py-1 text-[0.65rem] uppercase tracking-[0.12em] text-[#52705b] dark:bg-slate-800 dark:text-lime-200">
          {file.kind}
        </span>
      </summary>
      <div className="border-t border-[#dce5d9] p-4 dark:border-slate-800">
        {file.kind === "asset" ? (
          <p className="text-sm leading-6 text-[#63786a] dark:text-slate-400">
            This asset is available to the installer but is not treated as
            executable source in the catalog.
          </p>
        ) : (
          <>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
              <pre className="min-w-0 max-w-full flex-1 select-text overflow-x-auto rounded-lg bg-[#17231d] p-4 text-xs leading-6 text-[#eaf2e5]">
                <code>{content ?? ""}</code>
              </pre>
              {canCopy ? (
                <button
                  aria-label={`Copy code from ${file.path}`}
                  className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-md bg-[#d6ff57] px-4 py-2.5 text-sm font-bold text-[#12221c] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6ff57] motion-reduce:transition-none sm:w-auto"
                  onClick={() => void copySource()}
                  type="button"
                >
                  {copyState === "copied" ? "Copied" : "Copy code"}
                </button>
              ) : null}
            </div>
            {canCopy ? (
              <p
                aria-live="polite"
                className="mt-3 min-h-5 text-sm text-[#63786a] dark:text-slate-400"
              >
                {statusMessage}
              </p>
            ) : null}
          </>
        )}
      </div>
    </details>
  );
}

function InstallSection({ id }: { readonly id: string }) {
  const [copyState, setCopyState] = useState<
    "idle" | "copied" | "unsupported" | "failed"
  >("idle");
  const command = `npx auren add ${id}`;

  async function copyCommand() {
    const clipboard = globalThis.navigator?.clipboard;

    if (clipboard?.writeText === undefined) {
      setCopyState("unsupported");
      return;
    }

    try {
      await clipboard.writeText(command);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  const statusMessage =
    copyState === "copied"
      ? "Command copied."
      : copyState === "unsupported"
        ? "Clipboard access is not supported here; select the command to copy it."
        : copyState === "failed"
          ? "The command could not be copied; select it to copy manually."
          : "";

  return (
    <section
      aria-labelledby="block-install-heading"
      className="min-w-0 rounded-2xl bg-[#12221c] p-5 text-[#f4f1e8] shadow-[0_18px_50px_rgba(18,34,28,0.16)] dark:bg-slate-900"
    >
      <SectionHeading id="block-install-heading" title="Install" light />
      <p className="mt-2 text-sm leading-6 text-[#c5d4c5]">
        Copy the command into your project terminal. The catalog never runs it
        or changes your files.
      </p>
      <div className="mt-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
        <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-[#42624d] bg-[#1d352a] px-4 py-3 font-mono text-sm text-[#f4f1e8]">
          {command}
        </code>
        <button
          aria-label={`Copy installation command for ${id}`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-[#d6ff57] px-4 py-2.5 text-sm font-bold text-[#12221c] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6ff57] motion-reduce:transition-none"
          onClick={() => void copyCommand()}
          type="button"
        >
          {copyState === "copied" ? "Copied" : "Copy command"}
        </button>
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-[#c5d4c5]">
        {statusMessage}
      </p>
    </section>
  );
}

function SectionHeading({
  id,
  title,
  light = false,
}: {
  readonly id: string;
  readonly title: string;
  readonly light?: boolean;
}) {
  return (
    <h2
      className={`font-serif text-2xl font-semibold tracking-tight ${light ? "text-white" : "text-[#17231d] dark:text-white"}`}
      id={id}
    >
      {title}
    </h2>
  );
}
