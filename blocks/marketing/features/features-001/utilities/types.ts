export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: "bolt" | "shield" | "chart" | "plug" | "layers" | "globe";
}

export interface FeaturesProps {
  heading?: string;
  description?: string;
  items?: readonly FeatureItem[];
  id?: string;
  className?: string;
}
