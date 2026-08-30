import type { ReactNode } from "react";

export interface CatalogPageIntroProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children?: ReactNode;
}

export function CatalogPageIntro({
  eyebrow,
  title,
  description,
  children,
}: CatalogPageIntroProps) {
  return (
    <div className="border-b border-[#ccd7cc] pb-8 dark:border-slate-800">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#52705b] dark:text-lime-300">
        {eyebrow}
      </p>
      <h1 className="mt-3 max-w-4xl font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-[#17231d] sm:text-5xl lg:text-6xl dark:text-white">
        {title}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[#63786a] sm:text-lg dark:text-slate-400">
        {description}
      </p>
      {children}
    </div>
  );
}
