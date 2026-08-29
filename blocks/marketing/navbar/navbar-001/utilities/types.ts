export interface NavbarBrand {
  name: string;
  href: string;
}

export interface NavbarLink {
  id: string;
  label: string;
  href: string;
}

export interface NavbarCta {
  label: string;
  href: string;
}

export interface NavbarProps {
  brand?: Partial<NavbarBrand>;
  links?: readonly NavbarLink[];
  cta?: NavbarCta;
  activeLinkId?: string;
  navigationLabel?: string;
  menuLabel?: string;
  closeLabel?: string;
  id?: string;
  className?: string;
}
