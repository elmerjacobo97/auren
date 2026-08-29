export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FaqProps {
  heading?: string;
  description?: string;
  items?: readonly FaqItem[];
  contactLabel?: string;
  contactHref?: string;
  id?: string;
  className?: string;
}
