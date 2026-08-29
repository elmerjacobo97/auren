export interface HeroCta {
  label: string;
  href: string;
}

export interface HeroProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  primaryCta?: HeroCta;
  secondaryCta?: HeroCta;
  footnote?: string;
  id?: string;
  className?: string;
}
