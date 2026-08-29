export interface CtaAction {
  label: string;
  href: string;
}

export interface CtaProps {
  eyebrow?: string;
  heading?: string;
  description?: string;
  primaryAction?: CtaAction;
  secondaryAction?: CtaAction;
  footnote?: string;
  id?: string;
  className?: string;
}
