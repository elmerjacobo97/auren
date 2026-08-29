export interface LogoCloudItem {
  id: string;
  name: string;
  mark: "diamond" | "circle" | "triangle" | "hexagon" | "ring" | "bars";
}

export interface LogoCloudProps {
  heading?: string;
  description?: string;
  items?: readonly LogoCloudItem[];
  id?: string;
  className?: string;
}
