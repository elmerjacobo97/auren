import type { MouseEventHandler, ReactNode } from "react";

export type AdminSidebarBrand = {
  name: string;
  description?: string;
  href?: string;
  mark?: ReactNode;
};

export type AdminSidebarNavItem = {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
};

export type AdminSidebarNavSection = {
  id: string;
  label?: string;
  items: readonly AdminSidebarNavItem[];
};

export type AdminSidebarAccount = {
  name: string;
  email?: string;
  avatar?: ReactNode;
  profileHref?: string;
  profileLabel?: string;
  actionLabel?: string;
  onAction?: MouseEventHandler<HTMLButtonElement>;
};

export type AdminSidebarProps = {
  brand?: AdminSidebarBrand;
  sections?: readonly AdminSidebarNavSection[];
  activeItemId?: string;
  account?: AdminSidebarAccount;
  navigationLabel?: string;
  menuLabel?: string;
  closeLabel?: string;
  backdropLabel?: string;
  id?: string;
  className?: string;
};
