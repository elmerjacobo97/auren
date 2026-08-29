export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterGroup {
  id: string;
  label: string;
  links: readonly FooterLink[];
}

export interface FooterSocialLink {
  id: "github" | "x" | "linkedin";
  label: string;
  href: string;
}

export interface FooterProps {
  brandName?: string;
  tagline?: string;
  groups?: readonly FooterGroup[];
  socialLinks?: readonly FooterSocialLink[];
  copyright?: string;
  navigationLabel?: string;
  id?: string;
  className?: string;
}
