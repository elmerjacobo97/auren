import { useState, type ReactNode } from "react";
import type { CatalogElement } from "@auren/schemas/catalog";
import { PreviewAdapter } from "../preview/preview-adapter.js";

type PlaygroundTab = "preview" | "code" | "install";
type PreviewViewport = "desktop" | "tablet" | "mobile";

const viewportWidths: Record<PreviewViewport, string> = {
  desktop: "1120px",
  tablet: "768px",
  mobile: "390px",
};

export interface BlockPlaygroundProps {
  readonly block: CatalogElement;
  readonly codePanel: ReactNode;
  readonly installPanel: ReactNode;
}

export function BlockPlayground({
  block,
  codePanel,
  installPanel,
}: BlockPlaygroundProps) {
  const [activeTab, setActiveTab] = useState<PlaygroundTab>("preview");
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const [previewRevision, setPreviewRevision] = useState(0);
  const playgroundId = `block-playground-${block.id}`;

  return (
    <section
      aria-labelledby={`${playgroundId}-heading`}
      className="min-w-0 overflow-hidden rounded-2xl border border-[#dfe1e6] bg-[#f8f8f9] shadow-[0_18px_50px_rgba(33,57,42,0.08)] dark:border-slate-800 dark:bg-slate-900"
      data-active-tab={activeTab}
    >
      <h2 className="sr-only" id={`${playgroundId}-heading`}>
        Block playground
      </h2>
      <div className="flex flex-col gap-2 border-b border-[#e1e2e6] bg-white p-2 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
        <div
          aria-label="Block playground views"
          className="flex min-w-0 items-center gap-1"
          role="tablist"
        >
          <PlaygroundTabButton
            activeTab={activeTab}
            icon={<EyeIcon />}
            label="Preview"
            onSelect={() => setActiveTab("preview")}
            panelId={`${playgroundId}-preview-panel`}
            tabId={`${playgroundId}-preview-tab`}
            value="preview"
          />
          <PlaygroundTabButton
            activeTab={activeTab}
            icon={<CodeIcon />}
            label="Code"
            onSelect={() => setActiveTab("code")}
            panelId={`${playgroundId}-code-panel`}
            tabId={`${playgroundId}-code-tab`}
            value="code"
          />
          <PlaygroundTabButton
            activeTab={activeTab}
            icon={<TerminalIcon />}
            label="Install"
            onSelect={() => setActiveTab("install")}
            panelId={`${playgroundId}-install-panel`}
            tabId={`${playgroundId}-install-tab`}
            value="install"
          />
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:justify-end">
          <span className="hidden min-h-9 items-center gap-2 rounded-md border border-[#e1e2e6] px-3 text-xs font-semibold text-[#5f6670] sm:inline-flex dark:border-slate-700 dark:text-slate-300">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-[#d6ff57] ring-2 ring-[#eff5e9] dark:ring-slate-800"
            />
            React + Tailwind
          </span>
          <fieldset className="m-0 flex min-h-10 min-w-0 items-center gap-0.5 rounded-lg border border-[#e1e2e6] bg-[#fafafa] p-0.5 dark:border-slate-700 dark:bg-slate-900">
            <legend className="sr-only">Preview viewport</legend>
            <ViewportButton
              icon={<DesktopIcon />}
              label="Preview at desktop width"
              onSelect={() => setViewport("desktop")}
              selected={viewport === "desktop"}
            />
            <ViewportButton
              icon={<TabletIcon />}
              label="Preview at tablet width"
              onSelect={() => setViewport("tablet")}
              selected={viewport === "tablet"}
            />
            <ViewportButton
              icon={<MobileIcon />}
              label="Preview at mobile width"
              onSelect={() => setViewport("mobile")}
              selected={viewport === "mobile"}
            />
          </fieldset>
          <button
            aria-label="Refresh preview"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-transparent text-[#68707a] transition-colors hover:border-[#e1e2e6] hover:bg-[#fafafa] hover:text-[#17231d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52705b] active:scale-[0.97] motion-reduce:transition-none dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-white dark:focus-visible:outline-lime-300"
            onClick={() => setPreviewRevision((revision) => revision + 1)}
            title="Refresh preview"
            type="button"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      <div>
        <div
          aria-labelledby={`${playgroundId}-preview-tab`}
          className="grid min-h-[28rem] place-items-center bg-[#f7f7f8] bg-[radial-gradient(#d7d9de_1px,transparent_1px)] bg-[size:16px_16px] p-4 sm:min-h-[32rem] sm:p-8"
          hidden={activeTab !== "preview"}
          id={`${playgroundId}-preview-panel`}
          role="tabpanel"
        >
          <div
            className="w-full min-w-0 transition-[max-width] duration-200 ease-out motion-reduce:transition-none"
            style={{ maxWidth: viewportWidths[viewport] }}
          >
            <PreviewAdapter block={block} key={previewRevision} />
          </div>
        </div>
        <div
          aria-labelledby={`${playgroundId}-code-tab`}
          className="min-w-0 bg-white p-4 sm:p-6 dark:bg-slate-950"
          hidden={activeTab !== "code"}
          id={`${playgroundId}-code-panel`}
          role="tabpanel"
        >
          {codePanel}
        </div>
        <div
          aria-labelledby={`${playgroundId}-install-tab`}
          className="min-w-0 bg-white p-4 sm:p-6 dark:bg-slate-950"
          hidden={activeTab !== "install"}
          id={`${playgroundId}-install-panel`}
          role="tabpanel"
        >
          {installPanel}
        </div>
      </div>
    </section>
  );
}

function PlaygroundTabButton({
  activeTab,
  icon,
  label,
  onSelect,
  panelId,
  tabId,
  value,
}: {
  readonly activeTab: PlaygroundTab;
  readonly icon: ReactNode;
  readonly label: string;
  readonly onSelect: () => void;
  readonly panelId: string;
  readonly tabId: string;
  readonly value: PlaygroundTab;
}) {
  const isActive = activeTab === value;

  return (
    <button
      aria-controls={panelId}
      aria-selected={isActive}
      className={[
        "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52705b] active:scale-[0.98] motion-reduce:transition-none dark:focus-visible:outline-lime-300",
        isActive
          ? "bg-[#f1f2f4] text-[#17231d] shadow-sm dark:bg-slate-800 dark:text-white"
          : "text-[#777d86] hover:bg-[#f7f7f8] hover:text-[#17231d] dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white",
      ].join(" ")}
      id={tabId}
      onClick={onSelect}
      role="tab"
      tabIndex={isActive ? 0 : -1}
      type="button"
    >
      <span aria-hidden="true" className="size-4 shrink-0">
        {icon}
      </span>
      {label}
    </button>
  );
}

function ViewportButton({
  icon,
  label,
  onSelect,
  selected,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly onSelect: () => void;
  readonly selected: boolean;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={selected}
      className={[
        "inline-flex size-9 items-center justify-center rounded-md text-[#737983] transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#52705b] active:scale-[0.97] motion-reduce:transition-none dark:focus-visible:outline-lime-300",
        selected
          ? "bg-white text-[#17231d] shadow-sm dark:bg-slate-700 dark:text-white"
          : "hover:bg-white/80 hover:text-[#17231d] dark:hover:bg-slate-800 dark:hover:text-white",
      ].join(" ")}
      onClick={onSelect}
      title={label}
      type="button"
    >
      {icon}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="M2.5 12s3.4-5.25 9.5-5.25 9.5 5.25 9.5 5.25-3.4 5.25-9.5 5.25S2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="m8.5 7-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      viewBox="0 0 24 24"
      width="16"
    >
      <path
        d="m4 6 5 5-5 5M12.5 16H20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DesktopIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <rect
        height="13"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        width="18"
        x="3"
        y="4"
      />
      <path
        d="M8 20h8M12 17v3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function TabletIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <rect
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
        width="12"
        x="6"
        y="3"
      />
      <path
        d="M11 16h2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MobileIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <rect
        height="18"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        width="9"
        x="7.5"
        y="2"
      />
      <path
        d="M11 17h2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="17"
      viewBox="0 0 24 24"
      width="17"
    >
      <path
        d="M20 11a8 8 0 0 0-14.8-4L3 10M3 5.5V10h4.5M4 13a8 8 0 0 0 14.8 4L21 14m0 4.5V14h-4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
