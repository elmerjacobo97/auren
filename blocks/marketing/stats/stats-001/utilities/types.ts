export interface StatItem {
  id: string;
  value: string;
  label: string;
  detail?: string;
}

export interface StatsProps {
  heading?: string;
  description?: string;
  items?: readonly StatItem[];
  id?: string;
  className?: string;
}
