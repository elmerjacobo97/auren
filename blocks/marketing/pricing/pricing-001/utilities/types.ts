export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  cadence?: string;
  description: string;
  features: readonly string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
  current?: boolean;
}

export interface PricingProps {
  heading?: string;
  description?: string;
  plans?: readonly PricingPlan[];
  id?: string;
  className?: string;
}
